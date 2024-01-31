import { config } from './config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LogLevel } from '@nestjs/common';

function getLogLevel(): LogLevel[] {
  switch (process.env.LOG_LEVEL) {
    case 'DEBUG':
      return ['debug', 'log', 'warn', 'error', 'fatal'];
    case 'WARN':
      return ['warn', 'error', 'fatal'];
    case 'ERROR':
      return ['error', 'fatal'];

    default:
      // Default case will log level LOG
      return ['log', 'warn', 'error', 'fatal'];
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule.forRoot(), {
    logger: getLogLevel(),
  });
  await app.listen(config.PORT);
}

bootstrap();
