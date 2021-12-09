import {
  Controller,
  Post,
  Request,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  HttpException,
  Get,
} from '@nestjs/common';
import { JedsignService } from '../jedsign.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

@ApiTags('Super User Configuration')
@Controller('config')
export class AdminConfigController {
  constructor(private readonly jedsignService: JedsignService) {}

  @Post('/generatePdf')
  @ApiOperation({
    summary: 'Generate PDF Report',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Quote Number already in use',
  })
  @ApiCreatedResponse({
    description: 'Unit Price for Certificate Issuance has been updated',
  })
  async generatePDF() {
    try {
      return await this.jedsignService.generateMonthlyReport();
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/setConfig')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Set New Configuration',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Quote Number already in use',
  })
  @ApiCreatedResponse({
    description: 'Unit Price for Certificate Issuance has been updated',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        certIssueUnitPrice: {
          type: 'number',
        },
        billingSurCharge: {
          type: 'number',
        },
        automatedMonthlyBill: {
          type: 'boolean',
        },
        automatedEmailDate: {
          type: 'number',
        },
        adminEmail: {
          type: 'string',
        },
      },
    },
  })
  async setConfig(@Request() req, @Body() config: object) {
    try {
      return await this.jedsignService.setNewConfig(req.user.token, config);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/setUnitPrice/:unitPrice')
  @ApiBearerAuth()
  @ApiParam({ name: 'unitPrice' })
  @ApiOperation({
    summary: 'Set Unit Price for Certificate Issue for billing calculation in cents',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Quote Number already in use',
  })
  @ApiCreatedResponse({
    description: 'Unit Price for Certificate Issuance has been updated',
  })
  async setUnitPriceForCertIssue(@Request() req, @Param() unitPrice) {
    try {
      return await this.jedsignService.setUnitPriceForCertIssue(req.user.token, unitPrice);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/setSurCharge/:surCharge')
  @ApiBearerAuth()
  @ApiParam({ name: 'surCharge' })
  @ApiOperation({
    summary: 'Set SurCharge for billing calculation in cents',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Quote Number already in use',
  })
  @ApiCreatedResponse({
    description: 'Billing Sur Charge has been updated',
  })
  async setSurChargeForBilling(@Request() req, @Param() surCharge) {
    try {
      return await this.jedsignService.setSurCharge(req.user.token, surCharge);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/setMonthlyBill/:automated')
  @ApiBearerAuth()
  @ApiParam({ name: 'automated' })
  @ApiOperation({
    summary: 'Set Automated function for Monthly Billing in Boolean(true/false)',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Quote Number already in use',
  })
  @ApiCreatedResponse({
    description: 'Unit Price for Certificate Issuance has been updated',
  })
  async setMonthlyBilling(@Request() req, @Param() automated) {
    try {
      return await this.jedsignService.setAutomatedMonthlyBill(req.user.token, automated);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/setAutoSendDate/:sendDate')
  @ApiBearerAuth()
  @ApiParam({ name: 'sendDate' })
  @ApiOperation({
    summary: 'Set Automated Email Send Date for Monthly Billing',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Quote Number already in use',
  })
  @ApiCreatedResponse({
    description: 'Unit Price for Certificate Issuance has been updated',
  })
  async setAutoSendBillingDate(@Request() req, @Param() sendDate) {
    try {
      return await this.jedsignService.setAutomatedEmailDate(req.user.token, sendDate);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/setAdminEmail/:email')
  @ApiBearerAuth()
  @ApiParam({ name: 'email' })
  @ApiOperation({
    summary: 'Set Admin Email to send Monthly Billing report',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Quote Number already in use',
  })
  @ApiCreatedResponse({
    description: 'Unit Price for Certificate Issuance has been updated',
  })
  async setAdminEmail(@Request() req, @Param() email) {
    try {
      return await this.jedsignService.setAdminEmail(req.user.token, email);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Get('/viewConfig')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'View Super User Configuration',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Quote Number already in use',
  })
  @ApiCreatedResponse({
    description: 'Unit Price for Certificate Issuance has been updated',
  })
  async viewConfig(@Request() req) {
    try {
      return await this.jedsignService.viewConfig(req.user.token);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }
}
