import { Injectable } from '@nestjs/common';
import { inspect } from 'util';
import { EmailData, SearchService } from 'src/search/search.service';
// eslint-disable-next-line prettier/prettier
const Imap = require('node-imap');

@Injectable()
export class SyncEmailService {
  private imap: any;

  constructor(private readonly searchService: SearchService) {}

  async initiateSync(userId: string, mailId: string, oauthToken: string) {
    const auth2 = Buffer.from(
      [`user=${mailId}`, `auth=Bearer ${oauthToken}`, '', ''].join('\x01'),
      'utf-8',
    ).toString('base64');

    this.imap = new Imap({
      xoauth2: auth2,
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
      // debug: console.log,
      authTimeout: 25000,
      connTimeout: 30000,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: 'outlook.office365.com',
      },
    });

    this.imap.once('ready', async () => {
      await this.syncEmails(userId, mailId);
      await this.syncMailbox(userId, mailId);
      // this.subscribeToRealTimeUpdates();
    });

    this.imap.once('error', (err) => {
      console.log('IMAP error: ', err);
    });

    this.imap.once('end', () => {
      console.log('IMAP connection ended');
    });

    this.imap.connect();
  }

  async syncEmails(userId: string, mailId: string) {
    this.imap.openBox('INBOX', true, (err, box) => {
      if (err) throw err;

      const f = this.imap.seq.fetch('1:' + box.messages.total, {
        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE FLAGS)', 'TEXT'],
        struct: true,
      });

      f.on('message', (msg, seqno) => {
        let emailData: EmailData = {
          userId: '',
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
            if (info.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE FLAGS)') {
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
              emailData.body = ''; //Skip body for now
            }
          });
        });

        msg.once('attributes', (attrs) => {
          emailData.read = attrs.flags?.includes('\\Seen') || false;
          emailData.flagged = attrs.flags?.includes('\\Flagged') || false;
        });

        msg.once('end', () => {
          console.log(
            '(Message #%s) Finished processing',
            `${mailId}-${seqno}`,
          );
          this.indexEmailData(userId, emailData);
        });
      });

      f.once('error', (err) => {
        console.log('Fetch error: ' + err);
      });

      f.once('end', () => {
        console.log('Done fetching all messages!');
        this.imap.end();
      });
    });
  }

  async syncMailbox(userId: string, email: string) {
    await this.searchService.indexMailboxData(userId, email);
  }

  async indexEmailData(userId: string, emailData: any) {
    const { messageId, from, to, subject, date, read, flagged, body } =
      emailData;

    const document = {
      userId,
      messageId,
      from,
      to,
      subject,
      date,
      read,
      flagged,
      body,
    };

    await this.searchService.indexEmailData(userId, document);
  }

  // subscribeToRealTimeUpdates() {
  //   this.imap.once('ready', () => {
  //     // Open inbox to listen for changes
  //     this.imap.openBox('INBOX', true, (err, box) => {
  //       if (err) throw err;

  //       this.imap.idle();

  //       this.imap.on('mail', async (numNewMsgs) => {
  //         console.log(numNewMsgs + ' new messages');
  //         await this.syncEmails('userId');
  //       });

  //       this.imap.on('expunge', (seqnos) => {
  //         console.log('Expunged message(s):', seqnos);
  //       });
  //     });
  //   });
  // }
}
