import {
  TerminusEndpoint,
  TerminusOptionsFactory,
  MongooseHealthIndicator,
  TerminusModuleOptions,
} from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TerminusOptionsService implements TerminusOptionsFactory {
  constructor(private readonly mongoose: MongooseHealthIndicator) {}

  createTerminusOptions(): TerminusModuleOptions {
    const healthEndpoint: TerminusEndpoint = {
      url: '',
      useGlobalPrefix: true,
      healthIndicators: [async () => this.mongoose.pingCheck('mongo')],
    };
    return {
      endpoints: [healthEndpoint],
    };
  }
}
