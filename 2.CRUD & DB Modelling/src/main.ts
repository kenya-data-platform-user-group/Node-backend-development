import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import type { Config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Make sure providers implementing OnApplicationShutdown (e.g. DatabaseModule
  // closing the pg pool) are notified on SIGINT/SIGTERM.
  app.enableShutdownHooks();

  // Get the ConfigService from the app's dependency injection container
  const configService = app.get(ConfigService<Config>);

  const port = configService.getOrThrow('port', { infer: true });

  await app.listen(port);

  console.log(`Server is running on port ${port}`);
}
void bootstrap();
