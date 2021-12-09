import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JedLogController } from './jedlog.controller';
import { JedLogService } from './jedlog.service';
import { JedLogSchema } from './schemas/jedlog.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Log', schema: JedLogSchema }])],
  controllers: [JedLogController],
  providers: [JedLogService],
})
export class JedLogModule {}
