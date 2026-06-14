import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import type { Config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService<Config>);
  const port = configService.getOrThrow('port', { infer: true });

  app.setGlobalPrefix('api/v1');

  await app.listen(port);

  console.log(`Server is running on port ${port}`);
}
void bootstrap();
