import { Module } from '@nestjs/common';
import { EnterpriseSignController } from './controllers/tvCertsIssue.controller';
import { JedsignService } from './jedsign.service';
import { UsersModule } from '../users/users.module';
import { Web3Module } from '../web3/web3.module';
import { SignController } from './controllers/sign.controller';
import { TokensModule } from 'src/tokens/tokens.module';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentSchema } from './schemas/documents.schema';
import { MailerModule } from 'src/mailer/mailer.module';
import { AuthModule } from 'src/auth/auth.module';
import { OtpSchema } from 'src/users/schemas/otp.schema';
import { StudentSchema } from './schemas/students.schema';
import { BatchesSchema } from './schemas/batches.schema';
import { UserSchema } from 'src/users/schemas/user.schema';
import { EnterpriseViewController } from './controllers/tvCertsView.controller';
import { AdminConfigController } from './controllers/tvCertsConfig.controller';
import { ConfigSchema } from './schemas/config.schema';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JedLogSchema } from '../jedlogger/schemas/jedlog.schema';
import { JedLogService } from '../jedlogger/jedlog.service';
import * as dotenv from 'dotenv';
dotenv.config();

const log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: 'cheese.log' } },
  categories: { default: { appenders: ['cheese'], level: 'all' } },
});
const logger = log4js.getLogger('cheese');
logger.info('Jedsign.module: process.env.RABBITMQ_CONN_STRING: ', process.env.RABBITMQ_CONN_STRING);
logger.info('Jedsign.module: process.env.RABBITMQ_Q_NAME: ', process.env.RABBITMQ_Q_NAME);

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Documents', schema: DocumentSchema },
      { name: 'Otp', schema: OtpSchema },
      { name: 'Student', schema: StudentSchema },
      { name: 'Batches', schema: BatchesSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Config', schema: ConfigSchema },
    ]),
    UsersModule,
    Web3Module,
    TokensModule,
    MailerModule,
    AuthModule,
    ClientsModule.register([
      {
        name: 'MerkleRoot_Service',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_CONN_STRING],
          queue: process.env.RABBITMQ_Q_NAME,
          //urls: ['amqp://guest:guest@localhost:5672/hello'],
          //queue: 'jcert-root-message',
          noAck: false,
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
    MongooseModule.forFeature([{ name: 'Log', schema: JedLogSchema }]),
  ],
  controllers: [
    EnterpriseSignController,
    EnterpriseViewController,
    SignController,
    AdminConfigController,
  ],
  providers: [JedsignService, JedLogService],
})
export class JedsignModule {}
