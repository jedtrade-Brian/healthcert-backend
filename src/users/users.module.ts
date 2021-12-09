import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UserSchema } from './schemas/user.schema';
import { OtpSchema } from './schemas/otp.schema';
import { UsersService } from './users.service';
import { MailerModule } from '../mailer/mailer.module';
import { Web3Module } from '../web3/web3.module';
import { DocStoreSchema } from './schemas/docStore.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: 'Otp', schema: OtpSchema },
      { name: 'DocStore', schema: DocStoreSchema },
    ]),
    MailerModule,
    Web3Module,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
