import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, Document, MongoClient } from 'mongodb';
import { Config } from '../../config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private client!: MongoClient;

  constructor(private readonly config: ConfigService<Config>) {}

  async onModuleInit() {
    const uri = this.config.get('database_url', { infer: true })!;
    this.client = new MongoClient(uri);
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  getCollection<T extends Document>(name: string): Collection<T> {
    const dbName = this.config.get('database_name', { infer: true })!;
    return this.client.db(dbName).collection<T>(name);
  }
}
