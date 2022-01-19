import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Request,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  HttpException,
  NotAcceptableException,
  UnauthorizedException,
  Put,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
//import { JedsignService } from '../jedsign.service';
import { JedsignService } from '../jedsign.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiNotImplementedResponse,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotAcceptableResponse,
} from '@nestjs/swagger';
import { ADCSDto } from '../dto/adcs.dto';
import { DictDTO } from '../dto/dict.dto';

import { HCPCRDTO } from '../dto/hcpcr.dto';

import { ADSMDto } from '../dto/adsm.dto';
import { PDDMCSDto } from '../dto/pddmcs.dto';
import { AuthService } from 'src/auth/auth.service';
import { PGDSLIDto } from '../dto/pgdsli.dto';
import { NoaDto } from '../dto/noa.dto';
import { CertificateDTO } from '../dto/certificate.dto';
import { Certificate2DTO } from '../dto/certificate2.dto';
import { UpdateCert2 } from '../dto/updateCert2.dto';
import { JedLogService } from '../../jedlogger/jedlog.service';

const log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: 'cheese.log' } },
  categories: { default: { appenders: ['cheese'], level: 'all' } },
});
const logger = log4js.getLogger('cheese');

@ApiTags('Certificate Issuing Management')
@Controller('hash')
export class EnterpriseSignController {
  constructor(
    private readonly jedsignService: JedsignService,
    private readonly authService: AuthService,
    private readonly logService: JedLogService,
  ) {}

  @UseGuards(AuthGuard('api'))
  @Post('/certificate')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create TV Certificate Document',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Quote Number already in use',
  })
  @ApiCreatedResponse({
    description: 'Document has been issued and Signer has been allowed to sign this document',
    schema: {
      properties: {
        certArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docName: {
                type: 'string',
                description: 'Name of document',
              },
              email: {
                type: 'string',
                description: 'Email of recipient',
              },
              name: {
                type: 'string',
                description: 'Name of recipient',
              },
              docHash: {
                type: 'string',
                description: 'Hash of document',
              },
              documentId: {
                type: 'string',
                description: 'Id of document',
              },
              completionDate: {
                type: 'number',
                description: 'Date of Course Completion',
              },
            },
          },
        },
      },
    },
  })
  async createCertificate(@Request() req, @Body() CertificateDTO: CertificateDTO) {
    try {
      return await this.jedsignService.createCertificateDoc(req.user.token, CertificateDTO);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Put('/:docHash')
  @ApiParam({ name: 'docHash' })
  @ApiBody({ type: UpdateCert2 })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve Certificate with Signature',
    description: 'Bearer apiToken required.',
  })
  @ApiOkResponse({ description: 'Signature updated.' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  async updateUser(@Param() { docHash }, @Req() req, @Res() res, @Body() updateCert2: UpdateCert2) {
    try {
      const s = await this.jedsignService.verifyOTPApproval(updateCert2, docHash, req.user.token);
      return res.status(200).send(s);
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        error: e.message,
      });
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/adcs')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create ADCS Document',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Bad Request. Probable cause: Invalid Input',
  })
  @ApiCreatedResponse({
    description: 'Document has been issued',
    schema: {
      properties: {
        certArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docName: {
                type: 'string',
                description: 'Name of document',
              },
              email: {
                type: 'string',
                description: 'Email of recipient',
              },
              name: {
                type: 'string',
                description: 'Name of recipient',
              },
              docHash: {
                type: 'string',
                description: 'Hash of document',
              },
              documentId: {
                type: 'string',
                description: 'Id of document',
              },
              completionDate: {
                type: 'number',
                description: 'Date of Course Completion',
              },
            },
          },
        },
      },
    },
  })
  async createADCS(@Request() req, @Body() ADCSDto: ADCSDto) {
    try {
      logger.info('tvCertIssueController: createADCSDoc: Before the call');
      //test
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: 'tcCertsIssue.Controller: createADCS:  called',
      });
      return await this.jedsignService.createADCSDoc(req.user.token, ADCSDto);
    } catch (e) {
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: 'tcCertsIssue.Controller: createADCS:  Error' + e,
      });
      throw new NotAcceptableException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/dict')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create DICT Document',
    description: 'Bearer apiToken required.',
  })
  @ApiCreatedResponse({
    description: 'Document has been issued',
    schema: {
      properties: {
        certArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docName: {
                type: 'string',
                description: 'Name of Document',
              },
              email: {
                type: 'string',
                description: 'Email of recipient',
              },
              name: {
                type: 'string',
                description: 'Name of recipient',
              },
              docHash: {
                type: 'string',
                description: 'Hash of document',
              },
              documentId: {
                type: 'string',
                description: 'Id of Document',
              },
              completionDate: {
                type: 'number',
                description: 'Completion Date of course',
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Bad Request: probable cause: Invalid Input.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  async createDICT(@Request() req, @Body() DictDTO: DictDTO) {
    try {
      return await this.jedsignService.createDICTDoc(req.user.token, DictDTO);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/hcpcr')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create hcpcr Document',
    description: 'Bearer apiToken required.',
  })
  @ApiCreatedResponse({
    description: 'Document has been issued',
    schema: {
      properties: {
        certArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docName: {
                type: 'string',
                description: 'Name of Document',
              },
              patientEmail: {
                type: 'string',
                description: 'Email of recipient',
              },
              patientName: {
                type: 'string',
                description: 'Name of recipient',
              },
              docHash: {
                type: 'string',
                description: 'Hash of document',
              },
              documentId: {
                type: 'string',
                description: 'Id of Document',
              },
              effectiveDate: {
                type: 'number',
                description: 'Completion Date of course',
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Bad Request: probable cause: Invalid Input.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  async createHCPCR(@Request() req, @Body() HCPCRDTO: HCPCRDTO) {
    try {
      return await this.jedsignService.createhcpcrDoc(req.user.token, HCPCRDTO);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/adsm')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create ADSM Document',
    description: 'Bearer apiToken required.',
  })
  @ApiCreatedResponse({
    description: 'Documents Issued',
    schema: {
      properties: {
        certArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docName: {
                type: 'string',
                description: 'Name of document',
              },
              email: {
                type: 'string',
                description: 'Email of description',
              },
              name: {
                type: 'string',
                description: 'Name of recipient',
              },
              docHash: {
                type: 'string',
                description: 'Hash of document',
              },
              documentId: {
                type: 'string',
                description: 'Id of document',
              },
              completionDate: {
                type: 'number',
                description: 'Completion date of course',
              },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Bad Request. Probable cause: Invalid Input.',
  })
  async createADSM(@Request() req, @Body() ADSMDto: ADSMDto) {
    try {
      return await this.jedsignService.createADSMDoc(req.user.token, ADSMDto);
    } catch (e) {
      throw new NotAcceptableException(e.message);
      // if (e instanceof HttpException) throw e;
      // throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/pgdsli')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create PGDSLI Document',
    description: 'Bearer ApiToken Required.',
  })
  @ApiCreatedResponse({
    description: 'Document has been issued',
    schema: {
      properties: {
        certArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docName: {
                type: 'string',
                description: 'Name of document',
              },
              email: {
                type: 'string',
                description: 'Email of recipient',
              },
              name: {
                type: 'string',
                description: 'Name of recipient',
              },
              docHash: {
                type: 'string',
                description: 'Hash of document',
              },
              documentId: {
                type: 'string',
                description: 'Id of document',
              },
              completionDate: {
                type: 'number',
                description: 'Date of course completion',
              },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Bad Request. Probable cause: Invalid Input.',
  })
  async createPGDSLI(@Request() req, @Body() PGDSLIDto: PGDSLIDto) {
    try {
      return await this.jedsignService.createPGDSLI(req.user.token, PGDSLIDto);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/pddmcs')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create PDDMCS Document',
    description: 'Bearer apiToken required.',
  })
  @ApiCreatedResponse({
    description: 'Document has been issued.',
    schema: {
      properties: {
        certArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docName: {
                type: 'string',
                description: 'Name of Document',
              },
              email: {
                type: 'string',
                description: 'Email of recipient',
              },
              name: {
                type: 'string',
                description: 'Name of recipient',
              },
              docHash: {
                type: 'string',
                description: 'Hash of document',
              },
              documentId: {
                type: 'string',
                description: 'Id of document',
              },
              completionDate: {
                type: 'number',
                description: 'Date of course completion',
              },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description: 'Bad Request. Probable cause: Invalid Input',
  })
  async createPDDMCS(@Request() req, @Body() PDDMCSDto: PDDMCSDto) {
    try {
      return await this.jedsignService.createPDDMCS(req.user.token, PDDMCSDto);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/twoApprover')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create Certificate with 2 Approvers',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiBadRequestResponse({
    description:
      'Bad Request. Probable cause: Invalid Input, approver email may not be present in database',
  })
  // @ApiNotAcceptableResponse({
  //   description: 'Email provided for approvers is not found in database'
  // })
  @ApiCreatedResponse({
    description: 'Document has been issued',
    schema: {
      properties: {
        certArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docName: {
                type: 'string',
                description: 'Name of document',
              },
              email: {
                type: 'string',
                description: 'Email of recipient',
              },
              name: {
                type: 'string',
                description: 'Name of recipient',
              },
              docHash: {
                type: 'string',
                description: 'Hash of document',
              },
              documentId: {
                type: 'string',
                description: 'Id of document',
              },
              completionDate: {
                type: 'number',
                description: 'Date of Course Completion',
              },
              approvers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    email: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  async createTwoApproverCertificates(@Request() req, @Body() Certificate2DTO: Certificate2DTO) {
    try {
      return await this.jedsignService.createTwoApproverCertificates(
        req.user.token,
        Certificate2DTO,
      );
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Post('/:password')
  @ApiParam({ name: 'password' })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify User based on Password',
    description: 'Bearer apiToken required.',
  })
  @ApiCreatedResponse({
    description: 'User has been Validated and SMS OTP has been sent',
    schema: {
      properties: {
        userValidated: {
          type: 'boolean',
          description: 'User Account Validation with Token and Password',
        },
        otpRequired: {
          type: 'boolean',
          description: 'OTP Required',
        },
        token: {
          type: 'string',
          description: 'New API Token will be Generated after User is Validated',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  async verifyUser(@Request() req, @Param() { password }) {
    try {
      return await this.authService.validateUserByApiToken(req.user.token, password);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  // @UseGuards(AuthGuard('api'))
  // @Get('/:otp/:docHash')
  // @ApiParam({ name: 'otp' })
  // @ApiParam({ name: 'docHash' })
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Verify SMS OTP and Sign Document',
  //   description: 'Bearer apiToken required.',
  // })
  // @ApiOkResponse({
  //   description:
  //     'SMS OTP has been verified and Document has been signed. If docHash is of NOA docType, {acknowledgeNoa: true, isSigned: true/false} will be the response',
  //   schema: {
  //     properties: {
  //       signed: {
  //         type: 'boolean',
  //         description: 'Document Signing status',
  //       },
  //       docHash: {
  //         type: 'string',
  //         description: 'Root hash of Document',
  //       },
  //       docNo: {
  //         type: 'string',
  //         description: 'Sales Quotation Number/Payment Certificate Number'
  //       },
  //       Status: {
  //         type: 'object',
  //         description:
  //           'timeStamps are in unix format. If null, it means that that specific action has not been enacted.',
  //         properties: {
  //           quotationSent: {
  //             type: 'number',
  //             description: 'timestamp when sales quotation is issued',
  //           },
  //           quotationSigned: {
  //             type: 'number',
  //             description: 'timestamp when sales quotation is signed',
  //           },
  //           quotationRevoked: {
  //             type: 'number',
  //             description: 'timestamp when sales quotation is revoked',
  //           },
  //           paymentCertSent: {
  //             type: 'number',
  //             description: 'timestamp when Payment cert is issued',
  //           },
  //           paymentCertSigned: {
  //             type: 'number',
  //             description: 'timestamp when Payment cert is signed',
  //           },
  //           paymentCertRevoked: {
  //             type: 'number',
  //             description: 'timestamp when Payment cert is revoked',
  //           },
  //           invoiceSent: {
  //             type: 'number',
  //             description: 'timestamp when invoice is issued',
  //           },
  //           invoiceRevoked: {
  //             type: 'number',
  //             description: 'timestamp when invoice is revoked',
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  // })
  // async verifyOtpSigning(@Request() req, @Param() { otp, docHash }) {
  //   try {
  //     return await this.jedsignService.verifyOTPSigning(otp, req.user.token, docHash);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new BadRequestException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @ApiBearerAuth()
  // @Put('resendOTPSign/')
  // @ApiOperation({
  //   summary: 'Resend Mobile No Verification for Signing Function',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiForbiddenResponse({
  //   description: 'Forbidden. Probable cause: invalid email or account is verified.',
  // })
  // @ApiOkResponse({ description: 'SMS OTP Sent.' })
  // async resendOtpSign(@Request() req) {
  //   try {
  //     await this.jedsignService.resendOtpSign(req.user.token);
  //   } catch (e) {
  //     throw new ForbiddenException({
  //       status: HttpStatus.FORBIDDEN,
  //       error: e.message,
  //     });
  //   }
  // }

  @UseGuards(AuthGuard('api'))
  @Post('/revokeDocument/:docHash/:isBatch')
  @ApiParam({ name: 'docHash' })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke a document',
    description: 'Bearer apiToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiCreatedResponse({
    description: 'Document has been sucessfully revoked',
    schema: {
      properties: {
        docHash: {
          type: 'string',
          description: 'Target hash of Document',
        },
        isRevoked: {
          type: 'boolean',
          description: 'status of revoke of this document',
        },
      },
    },
  })
  async revokeDocument(@Request() req, @Param() { docHash, isBatch }) {
    console.log('line 778 jedservice', docHash), console.log('line 779 jedservice', isBatch);
    try {
      logger.info(`tvCertsIssue Controller: revokeDocument: : docHash: ${docHash}`);
      logger.info(`tvCertsIssue Controller: revokeDocument: : isBatch: ${isBatch}`);
      return await this.jedsignService.revokeTvCertificates(req.user.token, docHash, isBatch);
    } catch (e) {
      throw new NotAcceptableException(e.message);
      // if (e instanceof HttpException) throw e;
      // throw new BadRequestException(e.message);
    }
  }
}
