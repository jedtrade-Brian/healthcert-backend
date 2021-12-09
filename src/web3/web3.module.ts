import { Module, HttpModule } from '@nestjs/common';
import { Web3Service } from './web3.service';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [HttpModule, LoggerModule],
  providers: [Web3Service],
  exports: [Web3Service],
})
export class Web3Module {}
