import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { SearchService, EmailData } from 'src/search/search.service';
// eslint-disable-next-line prettier/prettier
const Imap = require('node-imap');

@Processor('email-sync')
export class EmailSyncProcessor {
  constructor(private readonly searchService: SearchService) {}

  @Process('test-job')
  async handleTestJob(job: Job) {
    console.log('Test job data:', job.data);
    console.log('Test job done!, Redis is working!');
  }

  @Process('sync-emails')
  async handleSyncEmails(job: Job) {
    const { userId, mailId, oauthToken } = job.data;

    const auth2 = Buffer.from(
      [`user=${mailId}`, `auth=Bearer ${oauthToken}`, '', ''].join('\x01'),
      'utf-8',
    ).toString('base64');

    const imap = new Imap({
      xoauth2: auth2,
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
      authTimeout: 25000,
      connTimeout: 30000,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: 'outlook.office365.com',
      },
    });

    return new Promise<void>((resolve, reject) => {
      imap.once('ready', async () => {
        console.log('IMAP connection established');

        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          const batchSize = 50; // sync emails in batches of 50
          const totalMessages = box.messages.total;
          let start = 1;

          const fetchNextBatch = () => {
            if (start > totalMessages) {
              console.log('done fetching all messages!');
              imap.end();
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
                    emailData.body = ''; // skip body for now
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
              console.log('Fetch error: ' + err);
              imap.end();
              return reject(err);
            });

            f.once('end', async () => {
              console.log(`fetched emails ${start} to ${end}`);
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
  }
}
