import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiServiceUnavailableResponse, ApiOkResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiServiceUnavailableResponse({ description: 'Service Unavailable. Health check is not ok.' })
  @ApiOkResponse({ description: 'Health check is ok.' })
  @ApiTags('Health Check')
  getHello() {
    return this.appService.getHello();
  }
}
