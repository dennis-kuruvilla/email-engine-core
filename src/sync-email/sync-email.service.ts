import { Injectable } from '@nestjs/common';
import { inspect } from 'util';
import { SearchService } from 'src/search/search.service';
// eslint-disable-next-line prettier/prettier
const Imap = require('node-imap');

@Injectable()
export class SyncEmailService {
  private imap: any;

  constructor(private readonly searchService: SearchService) {}

  async initiateSync(userId: string, oauthToken: string) {
    const mailId = 'denniskuruvilla@outlook.com';

    const auth2 = Buffer.from(
      [`user=${mailId}`, `auth=Bearer ${oauthToken}`, '', ''].join('\x01'),
      'utf-8',
    ).toString('base64');

    this.imap = new Imap({
      xoauth2: auth2,
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
      debug: console.log,
      authTimeout: 25000,
      connTimeout: 30000,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: 'outlook.office365.com',
      },
    });

    this.imap.once('ready', async () => {
      await this.syncEmails(userId);
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

  async syncEmails(userId: string) {
    this.imap.openBox('INBOX', true, (err, box) => {
      if (err) throw err;

      const f = this.imap.seq.fetch('1:' + box.messages.total, {
        bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE FLAGS)',
        struct: true,
      });

      f.on('message', (msg, seqno) => {
        const prefix = '(#' + seqno + ') ';
        let emailData = {};

        msg.on('body', (stream, info) => {
          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });

          stream.once('end', () => {
            const header = Imap.parseHeader(buffer);

            const messageId = header['message-id']
              ? header['message-id'][0]
              : `no-id-${seqno}`;

            emailData = {
              userId,
              messageId,
              from: header.from,
              to: header.to,
              subject: header.subject,
              date: header.date,
              flags: header.flags,
              body: '',
            };

            this.indexEmailData(userId, emailData);
          });
        });

        msg.once('attributes', (attrs) => {
          console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
        });

        msg.once('end', () => {
          console.log(prefix + 'Finished');
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
    const { messageId, from, to, subject, date, flags, body } = emailData;

    const document = {
      userId,
      messageId,
      from,
      to,
      subject,
      date,
      flags,
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
