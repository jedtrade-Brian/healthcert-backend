import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { MyLogger } from './logger.service';
import { LoggerMiddleware } from './logger.middleware';

@Module({
  providers: [MyLogger],
  exports: [MyLogger],
})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('/');
  }
}
