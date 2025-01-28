import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { EMAIL_PROVIDER_CONFIG } from 'src/common/constants';
import { SearchService, EmailData } from 'src/search/search.service';
import { InitialSyncStatus, RealTimeSyncStatus } from 'src/user/user.entity';
import { UserService } from 'src/user/user.service';
// eslint-disable-next-line prettier/prettier
const Imap = require('node-imap');

@Processor('email-sync')
export class EmailSyncProcessor {
  constructor(
    private readonly searchService: SearchService,
    private readonly userService: UserService,
  ) {}

  @Process('test-job')
  async handleTestJob(job: Job) {
    console.log('Test job data:', job.data);
    console.log('Test job done!, Redis is working!');
  }

  @Process('sync-emails')
  async handleSyncEmails(job: Job) {
    const { userId, mailId, oauthToken, provider } = job.data;

    try {
      await this.userService.updateInitialSyncStatus(
        userId,
        mailId,
        InitialSyncStatus.INITIATED,
      );

      const auth2 = Buffer.from(
        [`user=${mailId}`, `auth=Bearer ${oauthToken}`, '', ''].join('\x01'),
        'utf-8',
      ).toString('base64');

      const imap = new Imap({
        xoauth2: auth2,
        host: EMAIL_PROVIDER_CONFIG[provider].host,
        port: EMAIL_PROVIDER_CONFIG[provider].port,
        tls: true,
        authTimeout: 25000,
        connTimeout: 30000,
        tlsOptions: {
          rejectUnauthorized: false,
          servername: EMAIL_PROVIDER_CONFIG[provider].host,
        },
      });

      await new Promise<void>((resolve, reject) => {
        imap.once('ready', async () => {
          console.log('IMAP connection established');

          imap.openBox('INBOX', true, (err, box) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            const batchSize = 50; // Sync emails in batches of 50
            const totalMessages = box.messages.total;
            let start = 1;

            const fetchNextBatch = async () => {
              if (start > totalMessages) {
                console.log('Done fetching all messages!');
                imap.end();
                await this.userService.updateInitialSyncStatus(
                  userId,
                  mailId,
                  InitialSyncStatus.COMPLETED,
                );
                return resolve();
              }

              const end = Math.min(start + batchSize - 1, totalMessages);
              const f = imap.seq.fetch(`${start}:${end}`, {
                bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE FLAGS)', 'TEXT'],
                struct: true,
              });

              const emails: EmailData[] = [];

              f.on('message', (msg, seqno) => {
                let emailData: EmailData = {
                  userId,
                  messageId: '',
                  from: '',
                  to: '',
                  subject: '',
                  date: '',
                  read: false,
                  flagged: false,
                  body: '',
                };

                msg.on('body', (stream, info) => {
                  let buffer = '';
                  stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                  });

                  stream.once('end', () => {
                    if (
                      info.which ===
                      'HEADER.FIELDS (FROM TO SUBJECT DATE FLAGS)'
                    ) {
                      const header = Imap.parseHeader(buffer);

                      emailData = {
                        userId,
                        messageId: `${mailId}-${seqno}`,
                        from: header.from?.[0] || '',
                        to: header.to?.[0] || '',
                        subject: header.subject?.[0] || '',
                        date: header.date?.[0] || '',
                        read: false,
                        flagged: false,
                        body: '',
                      };
                    } else if (info.which === 'TEXT') {
                      emailData.body = ''; // Skip body for now
                    }
                  });
                });

                msg.once('attributes', (attrs) => {
                  emailData.read = attrs.flags?.includes('\\Seen') || false;
                  emailData.flagged =
                    attrs.flags?.includes('\\Flagged') || false;
                });

                msg.once('end', () => {
                  emails.push(emailData);
                });
              });

              f.once('error', (err) => {
                console.log('Fetch error: ' + err);
                imap.end();
                return reject(err);
              });

              f.once('end', async () => {
                console.log(`Fetched emails ${start} to ${end}`);
                await this.searchService.batchIndexEmails(userId, emails);
                start = end + 1;
                fetchNextBatch();
              });
            };

            fetchNextBatch();
          });
        });

        imap.once('error', (err) => {
          console.log('IMAP error:', err);
          reject(err);
        });

        imap.once('end', () => {
          console.log('IMAP connection ended');
        });

        imap.connect();
      });
    } catch (error) {
      console.error('Error during email sync:', error);
      await this.userService.updateInitialSyncStatus(
        userId,
        mailId,
        InitialSyncStatus.FAILED,
      );
      throw error;
    }
  }

  @Process('realtime-sync-emails')
  async handleRealTimeEmailSync(job: Job) {
    const { userId, mailId, oauthToken, provider } = job.data;

    try {
      await this.userService.updateRealTimeSyncStatus(
        userId,
        mailId,
        RealTimeSyncStatus.ACTIVE,
      );

      const auth2 = Buffer.from(
        [`user=${mailId}`, `auth=Bearer ${oauthToken}`, '', ''].join('\x01'),
        'utf-8',
      ).toString('base64');

      const imap = new Imap({
        xoauth2: auth2,
        host: EMAIL_PROVIDER_CONFIG[provider].host,
        port: EMAIL_PROVIDER_CONFIG[provider].port,
        tls: true,
        authTimeout: 25000,
        connTimeout: 30000,
        tlsOptions: {
          rejectUnauthorized: false,
          servername: EMAIL_PROVIDER_CONFIG[provider].host,
        },
        keepalive: {
          interval: 10000,
          idleInterval: 300000,
          forceNoop: true,
        },
      });

      imap.once('ready', () => {
        console.log('IMAP connection established for real-time sync');

        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            console.error('Error opening mailbox:', err);
            imap.end();
            throw new Error('Failed to open mailbox');
          }

          console.log(`Real-time sync started for mailbox: ${mailId}`);

          imap.on('mail', async (numNewMessages) => {
            console.log(`New emails detected: ${numNewMessages}`);
            const f = imap.seq.fetch(
              `${box.messages.total - numNewMessages + 1}:${box.messages.total}`,
              {
                bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE FLAGS)', 'TEXT'],
                struct: true,
              },
            );

            const emails: EmailData[] = [];
            f.on('message', (msg, seqno) => {
              let emailData: EmailData = {
                userId,
                messageId: '',
                from: '',
                to: '',
                subject: '',
                date: '',
                read: false,
                flagged: false,
                body: '',
              };

              msg.on('body', (stream, info) => {
                let buffer = '';
                stream.on('data', (chunk) => {
                  buffer += chunk.toString('utf8');
                });

                stream.once('end', () => {
                  if (
                    info.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE FLAGS)'
                  ) {
                    const header = Imap.parseHeader(buffer);

                    emailData = {
                      userId,
                      messageId: `${mailId}-${seqno}`,
                      from: header.from?.[0] || '',
                      to: header.to?.[0] || '',
                      subject: header.subject?.[0] || '',
                      date: header.date?.[0] || '',
                      read: false,
                      flagged: false,
                      body: '',
                    };
                  } else if (info.which === 'TEXT') {
                    emailData.body = '';
                  }
                });
              });

              msg.once('attributes', (attrs) => {
                emailData.read = attrs.flags?.includes('\\Seen') || false;
                emailData.flagged = attrs.flags?.includes('\\Flagged') || false;
              });

              msg.once('end', () => {
                emails.push(emailData);
              });
            });

            f.once('error', (err) => {
              console.error('Fetch error during real-time sync:', err);
            });

            f.once('end', async () => {
              console.log('Fetched real-time emails');
              await this.searchService.batchIndexEmails(userId, emails, true);
            });
          });

          imap.on('update', async (seqno, info) => {
            console.log(`Email updated: seqno=${seqno}`, info);

            const f = imap.seq.fetch(seqno, {
              bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE FLAGS)'],
              struct: true,
            });

            f.on('message', (msg) => {
              let flags: string[] = [];

              msg.once('attributes', (attrs) => {
                flags = attrs.flags || [];
              });

              msg.once('end', async () => {
                const isRead = flags.includes('\\Seen');

                if (isRead) {
                  console.log(`Marking email as read: seqno=${seqno}`);
                  await this.searchService.updateEmailReadStatus(
                    userId,
                    `${mailId}-${seqno}`,
                    true,
                  );
                } else {
                  console.log(`Marking email as unread: seqno=${seqno}`);
                  await this.searchService.updateEmailReadStatus(
                    userId,
                    `${mailId}-${seqno}`,
                    false,
                  );
                }
              });
            });

            f.once('error', (err) => {
              console.log('Fetch error:', err);
            });
          });

          imap.on('expunge', async (seqno) => {
            console.log(`Email deleted: seqno=${seqno}`);

            console.log(`Deleting email from search index: seqno=${seqno}`);
            await this.searchService.deleteEmail(userId, `${mailId}-${seqno}`);
          });

          imap.on('close', async (hadError) => {
            console.log(`IMAP connection closed for mailbox: ${mailId}`);
            if (hadError) {
              console.error('Connection closed with error');
            }

            await this.userService.updateRealTimeSyncStatus(
              userId,
              mailId,
              RealTimeSyncStatus.INACTIVE,
            );
          });
        });
      });

      imap.once('error', async (err) => {
        console.error('IMAP error during real-time sync:', err);

        await this.userService.updateRealTimeSyncStatus(
          userId,
          mailId,
          RealTimeSyncStatus.INACTIVE,
        );

        imap.end();
      });

      imap.once('end', async () => {
        console.log('IMAP connection ended');
      });

      imap.connect();
    } catch (error) {
      console.error('Error during real-time email sync:', error);

      await this.userService.updateRealTimeSyncStatus(
        userId,
        mailId,
        RealTimeSyncStatus.INACTIVE,
      );

      throw error;
    }
  }
}
