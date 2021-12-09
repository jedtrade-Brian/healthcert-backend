import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TokensModule } from './tokens/tokens.module';
import { MailerModule } from './mailer/mailer.module';
import { JedsignModule } from './jedsign/jedsign.module';
import { Web3Module } from './web3/web3.module';
import { LoggerModule } from './logger/logger.module';
import { TerminusOptionsService } from './terminus-options.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGO_URL,
        useCreateIndex: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
      }),
    }),
    ScheduleModule.forRoot(),
    TerminusModule.forRootAsync({
      useClass: TerminusOptionsService,
    }),
    UsersModule,
    AuthModule,
    TokensModule,
    MailerModule,
    JedsignModule,
    Web3Module,
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
