import { Injectable, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchResponse } from '@elastic/elasticsearch/lib/api/types';
import * as moment from 'moment';
import { WebSocketGatewayService } from 'src/websocket/websocket.gateway';

export interface EmailData {
  userId: string;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  read: boolean;
  flagged: boolean;
  body: string;
}
@Injectable()
export class SearchService implements OnModuleInit {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private webSocketService: WebSocketGatewayService,
  ) {}

  async onModuleInit() {
    const retryDelay = 3000;
    const maxRetries = 10;
    let attempt = 0;
    let connected = false;

    while (attempt < maxRetries && !connected) {
      try {
        const health = await this.elasticsearchService.ping();
        console.log('elasticsearch connection is healthy:', health);
        connected = true;

        const emailIndexExists = await this.elasticsearchService.indices.exists(
          {
            index: 'emails',
          },
        );
        if (!emailIndexExists) {
          console.log('Creating emails index...');
          await this.elasticsearchService.indices.create({
            index: 'emails',
            body: {
              mappings: {
                properties: {
                  userId: { type: 'keyword' },
                  messageId: { type: 'keyword' },
                  from: { type: 'text' },
                  to: { type: 'text' },
                  subject: { type: 'text' },
                  date: { type: 'date' },
                  read: { type: 'boolean' },
                  flagged: { type: 'boolean' },
                  body: { type: 'text' },
                },
              },
            },
          });
          console.log('Emails index created');
        }

        const mailboxIndexExists =
          await this.elasticsearchService.indices.exists({
            index: 'mailboxes',
          });
        if (!mailboxIndexExists) {
          console.log('Creating mailboxes index...');
          await this.elasticsearchService.indices.create({
            index: 'mailboxes',
            body: {
              mappings: {
                properties: {
                  userId: { type: 'keyword' },
                  email: { type: 'keyword' },
                  lastSync: { type: 'date' },
                  syncStatus: { type: 'text' },
                },
              },
            },
          });
          console.log('Mailboxes index created');
        }
      } catch (error) {
        console.error('Elasticsearch connection failed:', error);
        attempt++;
        if (attempt < maxRetries) {
          console.log(
            `Retrying in ${retryDelay}ms... (${attempt}/${maxRetries})`,
          );
          await new Promise((res) => setTimeout(res, retryDelay));
        } else {
          throw new Error('Elasticsearch connection failed after retries');
        }
      }
    }
  }

  async search(index: string, query: any) {
    try {
      const response: SearchResponse<any> =
        await this.elasticsearchService.search({
          index: index,
          body: query,
        });

      const hits = response.hits.hits;
      return hits;
    } catch (error) {
      console.error('Error in Elasticsearch search:', error);
      throw new Error('Search failed');
    }
  }

  async indexDocument(index: string, id: string, document: any) {
    try {
      const response = await this.elasticsearchService.index({
        index,
        id,
        body: document,
      });
      return response.result;
    } catch (error) {
      console.error('Error in indexing document:', error);
      throw new Error('Indexing failed');
    }
  }

  async indexEmailData(userId: string, email: any) {
    const { messageId, from, to, subject, date, read, flagged, body } = email;

    const formattedDate = new Date(date).toISOString();

    const document = {
      userId,
      messageId,
      from,
      to,
      subject,
      date: formattedDate,
      read,
      flagged,
      body,
    };

    // console.log('document:', document);

    await this.elasticsearchService.index({
      index: 'emails',
      id: messageId,
      body: document,
    });
  }

  async indexMailboxData(userId: string, email: string) {
    const document = {
      userId,
      email,
      lastSync: new Date(),
      syncStatus: 'active',
    };

    await this.elasticsearchService.index({
      index: 'mailboxes',
      id: userId,
      body: document,
    });
  }

  async batchIndexEmails(
    userId: string,
    emails: EmailData[],
    emitEvent = false,
  ) {
    const body = emails.flatMap((email) => [
      { index: { _index: 'emails', _id: email.messageId } },
      {
        ...email,
        date: moment(email.date, 'ddd, DD MMM YYYY HH:mm:ss Z').toISOString(),
      },
    ]);

    try {
      const response = await this.elasticsearchService.bulk({ body });
      if (response.errors) {
        console.error('Bulk indexing errors:', response.items);
      }
      if (emitEvent) {
        emails.forEach((email) => {
          this.sendMailUpdateEvent(email.userId, email.messageId);
        });
      }
    } catch (error) {
      console.error('Error during bulk indexing:', error);
    }
  }

  async updateEmailReadStatus(
    userId: string,
    messageId: string,
    isRead: boolean,
  ): Promise<void> {
    try {
      const result = await this.elasticsearchService.update({
        index: 'emails',
        id: messageId,
        body: {
          doc: {
            read: isRead,
          },
        },
      });

      if (result.result !== 'updated') {
        throw new Error('Failed to update read status in Elasticsearch');
      }

      console.log(
        `Successfully updated read status for messageId=${messageId} to ${isRead}`,
      );

      this.sendMailUpdateEvent(userId, messageId);
    } catch (error) {
      console.error(
        `Error updating read status for messageId=${messageId}:`,
        error,
      );
    }
  }

  async deleteEmail(userId: string, messageId: string): Promise<void> {
    try {
      const result = await this.elasticsearchService.delete({
        index: 'emails',
        id: messageId,
      });

      if (result.result !== 'deleted') {
        throw new Error('Failed to delete email from Elasticsearch');
      }

      this.sendMailUpdateEvent(userId, messageId);

      console.log(`Successfully deleted email with messageId=${messageId}`);
    } catch (error) {
      console.error(`Error deleting email with messageId=${messageId}:`, error);
    }
  }

  async searchEmails(userId: string, page: number, limit: number) {
    const from = (page - 1) * limit;

    try {
      const response = await this.elasticsearchService.search({
        index: 'emails',
        body: {
          query: {
            match: {
              userId: userId,
            },
          },
          sort: [{ date: { order: 'desc' } }],
          from,
          size: limit,
        },
      });

      const hits = response.hits.hits.map((hit) => hit._source);
      return {
        total: response.hits.total,
        page,
        limit,
        data: hits,
      };
    } catch (error) {
      console.error('Error fetching paginated emails:', error);
      throw new Error('Failed to fetch emails');
    }
  }

  sendMailUpdateEvent(userId: string, messageId: string) {
    const payload = {
      type: 'MAIL_UPDATE',
      id: messageId,
    };
    this.webSocketService.sendEventToUser(userId, payload);
  }
}
