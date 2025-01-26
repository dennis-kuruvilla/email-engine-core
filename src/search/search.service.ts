import { Injectable, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchResponse } from '@elastic/elasticsearch/lib/api/types';

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
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async onModuleInit() {
    try {
      const health = await this.elasticsearchService.ping();
      console.log('elasticsearch connection is healthy:', health);

      const emailIndexExists = await this.elasticsearchService.indices.exists({
        index: 'emails',
      });
      if (!emailIndexExists) {
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
      }

      const mailboxIndexExists = await this.elasticsearchService.indices.exists(
        { index: 'mailboxes' },
      );
      if (!mailboxIndexExists) {
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
      }
    } catch (error) {
      console.error('elasticsearch connection failed:', error);
      throw new Error('elasticsearch connection failed');
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
}
