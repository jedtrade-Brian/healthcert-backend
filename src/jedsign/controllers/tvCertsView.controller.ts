import {
  Controller,
  Get,
  Request,
  Param,
  UseGuards,
  BadRequestException,
  HttpException,
  UnauthorizedException,
  NotAcceptableException,
} from '@nestjs/common';
import { JedsignService } from '../jedsign.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

@ApiTags('Certificates Dashboard Management')
@Controller('hash')
export class EnterpriseViewController {
  constructor(private readonly jedsignService: JedsignService) {}

  @Get('/:docHash')
  @ApiParam({ name: 'docHash' })
  @ApiOperation({
    summary: 'Get Document Hash',
  })
  @ApiBadRequestResponse({
    description: 'A bad response. Probable cause: invalid hash or hash not presented.',
  })
  @ApiOkResponse({
    description: 'Get Document Request Sucessful.',
    schema: {
      properties: {
        docStore: {
          type: 'string',
          description: 'Address of docStore',
        },
        docHash: {
          type: 'string',
          description: 'Root hash of document',
        },
        docInfo: {
          type: 'string',
          description: 'Document Information',
        },
        docType: {
          type: 'string',
          description: 'Document Type',
        },
        createdAt: {
          type: 'number',
          description: 'Timestamp of document issuance of document',
        },
        updatedAt: {
          type: 'number',
          description:
            'Timestamp of document update. If differs from creation timestamp, it refers to timestamp of recipient signing it',
        },
        issuerDetails: {
          type: 'object',
          properties: {
            companyName: {
              type: 'string',
              description: 'Name of issuer company',
            },
            uen: {
              type: 'string',
              description: 'uen of issuer',
            },
            address1: {
              type: 'string',
              description: 'First address of issuer',
            },
            address2: {
              type: 'string',
              description: 'Second address of issuer',
            },
            zipcode: {
              type: 'string',
              description: 'Zipcode of issuer',
            },
            country: {
              type: 'string',
              description: 'location of issuer',
            },
            domain: {
              type: 'string',
              description: 'issuer domain',
            },
            email: {
              type: 'string',
              description: 'issuer email',
            },
            name: {
              type: 'string',
              description: 'issuer name',
            },
            mobileNo: {
              type: 'string',
              description: 'issuer mobile number',
            },
            title: {
              type: 'string',
              description: 'issuer title',
            },
            designation: {
              type: 'string',
              description: 'issuer designation',
            },
          },
        },
        recipientDetails: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'recipient name',
            },
            email: {
              type: 'string',
              description: 'recipient email',
            },
            phoneNumber: {
              type: 'string',
              description: 'recipient phone number',
            },
            companyName: {
              type: 'string',
              description: 'recipient company name',
            },
            customerId: {
              type: 'string',
              description: 'customer number',
            },
            fullAddress: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                  description: 'recipient address',
                },
                city: {
                  type: 'string',
                  description: 'recipient city location',
                },
                state: {
                  type: 'string',
                  description: 'state location of recipient',
                },
                zipcode: {
                  type: 'string',
                  description: 'zipcode of location of recipient',
                },
              },
            },
          },
        },
        isSigned: {
          type: 'boolean',
          description: 'Signed Status of Document',
        },
        isRevoked: {
          type: 'boolean',
          description: 'Revoked Status of Document',
        },
        oaStatus: {
          type: 'object',
          properties: {
            docIntegrity: {
              type: 'boolean',
              description: 'Verify whether Document has been Tampered',
            },
            docStatus: {
              type: 'boolean',
              description: 'Verify whether Document has been Issued',
            },
            issuerIdentity: {
              type: 'boolean',
              description:
                'Verify whether Document Issuer Identity is Valid (Checked according to DNS)',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  async getDocument(@Param() { docHash }) {
    try {
      return await this.jedsignService.getDocument(docHash);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Get('/document/list/certificate/')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retrieve List of Certificates',
    description: 'Bearer ApiToken Required',
  })
  @ApiBadRequestResponse({
    description: 'Refer to error message for more Info',
  })
  @ApiOkResponse({
    description: 'Certificate List Retrieved',
    schema: {
      properties: {
        certList: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docHash: {
                type: 'string',
                description: 'Document hash',
              },
              docType: {
                type: 'string',
                description: 'Document Type',
              },
              issuerDocStore: {
                type: 'string',
                description: 'Document docstore',
              },
              merkleRoot: {
                type: 'string',
                description: 'Document merkleRoot',
              },
              studentId: {
                type: 'string',
                description: 'Student ID',
              },
              studentName: {
                type: 'string',
                description: 'Student Name',
              },
              studentLastName: {
                type: 'string',
                description: 'Student Last Name',
              },
              courseName: {
                type: 'string',
                description: 'Course Name',
              },
              transcriptId: {
                type: 'string',
                description: 'Transcript ID',
              },
              issuedOn: {
                type: 'number',
                description: 'Certificate Issued Timestamp',
              },
              revoked: {
                type: 'number',
                description: 'Certificate Revoked Timestamp',
              },
              wrapDocInfo: {
                type: 'string',
                description: 'Wrapped Document JSON',
              },
              approvers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Name of Approver',
                    },
                    email: {
                      type: 'string',
                      description: 'Email of Approver',
                    },
                    designation: {
                      type: 'string',
                      description: 'Designation of Approver',
                    },
                    companyName: {
                      type: 'string',
                      description: 'Company name of Approver',
                    },
                    signature: {
                      type: 'string',
                      description: 'Signature of Approver',
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
  async getCertList(@Request() req) {
    try {
      return await this.jedsignService.getAllCertificate(req.user.token);
    } catch (e) {
      throw new NotAcceptableException(e.message);

      // throw e;
      // // if (e instanceof HttpException) throw e;
      // // if (e.message == 'Returned error: daily request count exceeded, request rate limited') {
      // //   throw new NotAcceptableException(e.message);
      // // } else {
      // //   throw new BadRequestException(e.message);
      // // }
    }
  }

  @UseGuards(AuthGuard('api'))
  @Get('/document/list/history')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retrieve Batch Document History',
    description: 'Bearer ApiToken Required',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiOkResponse({
    description: 'History List Retrieved',
    schema: {
      properties: {
        batchArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              batchId: {
                type: 'string',
                description: 'Document Batch ID',
              },
              docHash: {
                type: 'array',
                description: 'Target Hashes in Batch',
                items: {
                  type: 'string',
                },
              },
              merkleRoot: {
                type: 'string',
                description: 'Merkle Root of Batch',
              },
              issuedTime: {
                type: 'number',
                description: 'Issued Time of Batch',
              },
            },
          },
        },
      },
    },
  })
  async getHistoryList(@Request() req) {
    try {
      return await this.jedsignService.getHistory(req.user.token);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new UnauthorizedException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @ApiParam({ name: 'batchId' })
  @Get('/document/students/:batchId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retrieve Students from Batch ID',
    description: 'Bearer ApiToken Required',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiOkResponse({
    description: 'Student List Retrieved',
    schema: {
      properties: {
        batchId: {
          type: 'string',
          description: 'Batch Id',
        },
        issuedBatch: {
          type: 'string',
          description: 'Timestamp of Batch Issuance',
        },
        studentArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docHash: {
                type: 'string',
                description: 'Document Hash',
              },
              studentId: {
                type: 'string',
                description: 'Student ID',
              },
              name: {
                type: 'string',
                description: 'Student Name',
              },
              email: {
                type: 'string',
                description: 'Student Email',
              },
            },
          },
        },
      },
    },
  })
  async getStudentFromBatch(@Request() req, @Param() { batchId }) {
    try {
      return await this.jedsignService.getStudentsFromBatch(req.user.token, batchId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new UnauthorizedException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @Get('/document/students')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retrieve list of Students',
    description: 'Bearer ApiToken Required',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiOkResponse({
    description: 'Student List Retrieved',
    schema: {
      properties: {
        studentArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: {
                type: 'string',
                description: 'Student _id from database',
              },
              studentId: {
                type: 'string',
                description: 'Student ID',
              },
              nric: {
                type: 'string',
                description: 'Student NRIC',
              },
              email: {
                type: 'string',
                description: 'Student Email',
              },
              name: {
                type: 'string',
                description: 'Student Name',
              },
              dob: {
                type: 'string',
                description: 'Student Date of Birth',
              },
              graduationDate: {
                type: 'string',
                description: 'Student Date of Graduation',
              },
            },
          },
        },
      },
    },
  })
  async getStudents(@Request() req) {
    try {
      return await this.jedsignService.getStudents(req.user.token);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new UnauthorizedException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @ApiParam({ name: 'studentId' })
  @Get('/document/studentDetail/:studentId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retrieve Student details and certificates from Student ID',
    description: 'Bearer ApiToken Required',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiOkResponse({
    description: 'Student List Retrieved',
    schema: {
      properties: {
        studentId: {
          type: 'string',
          description: 'Student ID',
        },
        nric: {
          type: 'string',
          description: 'Student NRIC',
        },
        email: {
          type: 'string',
          description: 'Student Email',
        },
        name: {
          type: 'string',
          description: 'Student Name',
        },
        dob: {
          type: 'string',
          description: 'Student Date of Birth',
        },
        graduationDate: {
          type: 'string',
          description: 'Student Date of Graduation',
        },
        studentArr: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              docHash: {
                type: 'string',
                description: 'Document Hash',
              },
              docType: {
                type: 'string',
                description: 'Document Type',
              },
              courseName: {
                type: 'string',
                description: 'Certificate Name',
              },
              transcriptId: {
                type: 'string',
                description: 'Transcript ID',
              },
              issuedDate: {
                type: 'number',
                description: 'Issued Timestamp',
              },
              revokedDate: {
                type: 'number',
                description: 'Revoked Timestamp',
              },
              wrapDocInfo: {
                type: 'string',
                description: 'Wrapped Document JSON String',
              },
            },
          },
        },
      },
    },
  })
  async getStudentDetail(@Request() req, @Param() { studentId }) {
    try {
      return await this.jedsignService.getStudentsDetail(req.user.token, studentId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new UnauthorizedException(e.message);
    }
  }

  @UseGuards(AuthGuard('api'))
  @ApiParam({ name: 'docHash' })
  @Get('/document/emailPdf/:docHash')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Email document PDF to Student',
    description: 'Bearer ApiToken Required',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiOkResponse({
    description: 'Email Successfully sent',
  })
  async emailStudentPdf(@Param() { docHash }) {
    try {
      return await this.jedsignService.emailPDF(docHash);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new UnauthorizedException(e.message);
    }
  }

  // @UseGuards(AuthGuard('api'))
  // @Get('/enterprise/dashboard/invChart')
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Get Raw Data for Enterprise Chart',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiOkResponse({
  //   description: 'Raw Invoice Data Retrieved',
  //   schema: {
  //     properties: {
  //       invoices: {
  //         type: 'array',
  //         items: {
  //           type: 'object',
  //           properties: {
  //             docHash: {
  //               type: 'string',
  //               description: 'Invoice Doc Hash',
  //             },
  //             companyName: {
  //               type: 'string',
  //               description: 'Buyer Company Name',
  //             },
  //             email: {
  //               type: 'string',
  //               description: 'Buyer company Email',
  //             },
  //             amount: {
  //               type: 'number',
  //               description: 'Total Amount of Invoice requested for Financing',
  //             },
  //             date: {
  //               type: 'number',
  //               description: 'Unix Timestamp of Invoice Creation in Seconds',
  //             },
  //             financingStatus: {
  //               type: 'number',
  //               description:
  //                 'Financing Status of Invoice i.e 1: Financing Requested; 2: Financing Approved; 3: Financing Declined;',
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Token not Authorized',
  // })
  // async listInvChart(@Request() req) {
  //   try {
  //     return await this.jedsignService.getInvChartEnterprise(req.user.token);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new BadRequestException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/')
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Get List of Documents',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiOkResponse({
  //   description:
  //     'Documents Retrieved. For docType = "Inv", isSigned Status will not be displayed. ',
  //   schema: {
  //     properties: {
  //       salesDoc: {
  //         type: 'array',
  //         description: 'Document Issued By Issuer to Signer',
  //         items: {
  //           type: 'object',
  //           properties: {
  //             docHash: {
  //               type: 'string',
  //               description: 'Document Root Hash',
  //             },
  //             docType: {
  //               type: 'string',
  //               description: 'Document Type',
  //             },
  //             updatedAt: {
  //               type: 'number',
  //               description: 'Document Updated Timestamp',
  //             },
  //             createdAt: {
  //               type: 'number',
  //               description: 'Document Creation Timestamp',
  //             },
  //             isSigned: {
  //               type: 'boolean',
  //               description: 'Document Signing Status',
  //             },
  //             isRevoked: {
  //               type: 'boolean',
  //               description: 'Document Revoked Status',
  //             },
  //             companyName: {
  //               type: 'string',
  //               description: 'Company Name of Document Signer',
  //             },
  //             finalAmt: {
  //               type: 'number',
  //               description: 'Document Final Amount to be Paid',
  //             },
  //             documentNo: {
  //               type: 'string',
  //               description: 'Document Number',
  //             },
  //           },
  //         },
  //       },
  //       purchaseDoc: {
  //         type: 'array',
  //         description: 'Document Issued Back To Issuer from Signer',
  //         items: {
  //           type: 'object',
  //           properties: {
  //             docHash: {
  //               type: 'string',
  //               description: 'Document Root Hash',
  //             },
  //             docType: {
  //               type: 'string',
  //               description: 'Document Type',
  //             },
  //             updatedAt: {
  //               type: 'number',
  //               description: 'Document Updated Timestamp',
  //             },
  //             createdAt: {
  //               type: 'number',
  //               description: 'Document Creation Timestamp',
  //             },
  //             isSigned: {
  //               type: 'boolean',
  //               description: 'Document Signing Status',
  //             },
  //             isRevoked: {
  //               type: 'boolean',
  //               description: 'Document Revoked Status',
  //             },
  //             companyName: {
  //               type: 'string',
  //               description: 'Company Name of Document Signer',
  //             },
  //             finalAmt: {
  //               type: 'number',
  //               description: 'Document Final Amount to be Paid',
  //             },
  //             documentNo: {
  //               type: 'string',
  //               description: 'Document Number',
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Token not Authorized',
  // })
  // async listDocuments(@Request() req) {
  //   try {
  //     return await this.jedsignService.getDocumentByToken(req.user.token);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new BadRequestException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/document/list/salesquotation')
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Retrieve List of Sales Quotation made against Buyer',
  //   description: 'Bearer apiToken required.',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  // })
  // @ApiOkResponse({
  //   description: 'Sales Quotation Documents has been sucessfully retrieved',
  //   schema: {
  //     properties: {
  //       list: {
  //         type: 'array',
  //         items: {
  //           type: 'object',
  //           properties: {
  //             issuerName: {
  //               type: 'string',
  //               description: 'Issuer Name',
  //             },
  //             quoteNumber: {
  //               type: 'string',
  //               description: 'Quote Number',
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // async getSQList(@Request() req) {
  //   try {
  //     return await this.jedsignService.getSQList(req.user.token);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new BadRequestException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/document/list/invoices')
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Retrieve List of Invoices issued by Supplier',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  // })
  // @ApiOkResponse({
  //   description: 'Invoice List Retrieved',
  //   schema: {
  //     properties: {
  //       invoices: {
  //         type: 'array',
  //         items: {
  //           type: 'object',
  //           properties: {
  //             docHash: {
  //               type: 'string',
  //               description: 'Document Hash',
  //             },
  //             financingStatus: {
  //               type: 'number',
  //               description:
  //                 'Financing Status of Invoice Document i.e. 0: Invoice Ready for Financing, 1: Invoice Financing Requested, 2: Invoice Financing Approved, 3: Invoice Financing Declined',
  //               enum: [0, 1, 2, 3],
  //             },
  //             invNo: {
  //               type: 'string',
  //               description: 'Invoice Number',
  //             },
  //             buyerName: {
  //               type: 'string',
  //               description: 'Buyer Name',
  //             },
  //             buyerEmail: {
  //               type: 'string',
  //               description: 'Buyer Email',
  //             },
  //             finalAmt: {
  //               type: 'number',
  //               description: 'Final Invoice Amount',
  //             },
  //             invDate: {
  //               type: 'number',
  //               description: 'Invoice Issued Date (Format: unix in seconds)',
  //             },
  //             invDueDate: {
  //               type: 'number',
  //               description: 'Invoice Due Date (Format: unix in seconds)',
  //             },
  //             isRevoked: {
  //               type: 'boolean',
  //               description: 'Revoked Status of Invoice',
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // async getInvList(@Request() req) {
  //   try {
  //     return await this.jedsignService.getInvList(req.user.token);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new BadRequestException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/enterprise/getNOA/:invDocHash')
  // @ApiParam({ name: 'invDocHash' })
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Get NOA Document Related to Invoice; For Supplier Overview Dashboard View',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiOkResponse({
  //   description: 'NOA Document Info Retrieved',
  //   schema: {
  //     properties: {
  //       issuers: {
  //         type: 'array',
  //         items: {
  //           type: 'object',
  //           properties: {
  //             name: {
  //               type: 'string',
  //               description: 'Issuer Company Name',
  //             },
  //             documentStore: {
  //               type: 'string',
  //               description: 'Issuer Document Store',
  //             },
  //             identityProof: {
  //               type: 'object',
  //               properties: {
  //                 type: {
  //                   type: 'string',
  //                   description: 'Default: DNS-TXT',
  //                 },
  //                 location: {
  //                   type: 'string',
  //                   description: 'Issuer DNS Record',
  //                 },
  //               },
  //             },
  //             email: {
  //               type: 'string',
  //               description: 'Issuer Email',
  //             },
  //             address: {
  //               type: 'string',
  //               description: 'Issuer Address',
  //             },
  //             zipcode: {
  //               type: 'string',
  //               description: 'Issuer Zipcode',
  //             },
  //             image: {
  //               type: 'string',
  //               description: 'Issuer LetterHead',
  //             },
  //           },
  //         },
  //       },
  //       recipient: {
  //         type: 'object',
  //         properties: {
  //           name: {
  //             type: 'string',
  //             description: 'Recipient Name',
  //           },
  //           cpyName: {
  //             type: 'string',
  //             description: 'Recipient Company Name',
  //           },
  //           address: {
  //             type: 'string',
  //             description: 'Recipient Address',
  //           },
  //           zipcode: {
  //             type: 'string',
  //             description: 'Recipient Zipcode',
  //           },
  //           phoneNo: {
  //             type: 'string',
  //             description: 'Recipient Phone Number',
  //           },
  //           date: {
  //             type: 'number',
  //             description: 'Recipient Date',
  //           },
  //         },
  //       },
  //       reqInfo: {
  //         type: 'array',
  //         items: {
  //           properties: {
  //             invNo: {
  //               type: 'string',
  //               description: 'Invoice Number Approved for Financing',
  //             },
  //             date: {
  //               type: 'string',
  //               description: 'Invoice Creation Date',
  //             },
  //             amt: {
  //               type: 'string',
  //               description: 'Invoice Amount',
  //             },
  //             currency: {
  //               type: 'string',
  //               description: 'Invoice Currency',
  //             },
  //             transId: {
  //               type: 'string',
  //               description: 'Transaction ID',
  //             },
  //           },
  //         },
  //       },
  //       financierDetails: {
  //         type: 'object',
  //         properties: {
  //           email: {
  //             type: 'string',
  //             description: 'Invoice Number Approved for Financing',
  //           },
  //           designation: {
  //             type: 'string',
  //             description: 'Invoice Creation Date',
  //           },
  //           bankDetails: {
  //             type: 'object',
  //             properties: {
  //               accName: {
  //                 type: 'string',
  //                 description: 'Financier Account Name',
  //               },
  //               accNum: {
  //                 type: 'string',
  //                 description: 'Financier Account Number',
  //               },
  //               bankName: {
  //                 type: 'string',
  //                 description: 'Financier Account Bank Name',
  //               },
  //               swiftNo: {
  //                 type: 'string',
  //                 description: 'Financier Account Swift Number',
  //               },
  //             },
  //           },
  //         },
  //       },
  //       noaDetails: {
  //         type: 'array',
  //         items: {
  //           properties: {
  //             invtId: {
  //               type: 'string',
  //               description: 'Investor ID',
  //             },
  //             invtCpy: {
  //               type: 'string',
  //               description: 'Investor Company',
  //             },
  //             invtPercent: {
  //               type: 'string',
  //               description: 'Investor Percentage',
  //             },
  //             transBrief: {
  //               type: 'string',
  //               description: 'Transaction Brief',
  //             },
  //             transNo: {
  //               type: 'string',
  //               description: 'Transaction Number',
  //             },
  //           },
  //         },
  //       },
  //       oaStatus: {
  //         type: 'object',
  //         properties: {
  //           docIntegrity: {
  //             type: 'boolean',
  //             description: 'Verify whether Document has been Tampered',
  //           },
  //           docStatus: {
  //             type: 'boolean',
  //             description: 'Verify whether Document has been Issued',
  //           },
  //           issuerIdentity: {
  //             type: 'boolean',
  //             description:
  //               'Verify whether Document Issuer Identity is Valid (Checked according to DNS)',
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Token not Authorized',
  // })
  // async getNOA(@Param() { invDocHash }) {
  //   try {
  //     return await this.jedsignService.getNOAByInv(invDocHash);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new BadRequestException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/enterprise/getNOAByFR/:frDocHash')
  // @ApiParam({ name: 'frDocHash' })
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Get NOA Document Related to Financing Request; For Supplier Invoice Dashboard View',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiOkResponse({
  //   description:
  //     'NOA Document Info Retrieved. If NOA has been created for the queried Financing request, response will show NOA document. If not, response will show Financing Request',
  //   schema: {
  //     properties: {
  //       issuers: {
  //         type: 'array',
  //         items: {
  //           type: 'object',
  //           properties: {
  //             name: {
  //               type: 'string',
  //               description: 'Issuer Company Name',
  //             },
  //             documentStore: {
  //               type: 'string',
  //               description: 'Issuer Document Store',
  //             },
  //             identityProof: {
  //               type: 'object',
  //               properties: {
  //                 type: {
  //                   type: 'string',
  //                   description: 'Default: DNS-TXT',
  //                 },
  //                 location: {
  //                   type: 'string',
  //                   description: 'Issuer DNS Record',
  //                 },
  //               },
  //             },
  //             email: {
  //               type: 'string',
  //               description: 'Issuer Email',
  //             },
  //             address: {
  //               type: 'string',
  //               description: 'Issuer Address',
  //             },
  //             zipcode: {
  //               type: 'string',
  //               description: 'Issuer Zipcode',
  //             },
  //             image: {
  //               type: 'string',
  //               description: 'Issuer LetterHead',
  //             },
  //           },
  //         },
  //       },
  //       recipient: {
  //         type: 'object',
  //         properties: {
  //           name: {
  //             type: 'string',
  //             description: 'Recipient Name',
  //           },
  //           cpyName: {
  //             type: 'string',
  //             description: 'Recipient Company Name',
  //           },
  //           address: {
  //             type: 'string',
  //             description: 'Recipient Address',
  //           },
  //           zipcode: {
  //             type: 'string',
  //             description: 'Recipient Zipcode',
  //           },
  //           phoneNo: {
  //             type: 'string',
  //             description: 'Recipient Phone Number',
  //           },
  //           date: {
  //             type: 'number',
  //             description: 'Recipient Date',
  //           },
  //         },
  //       },
  //       reqInfo: {
  //         type: 'array',
  //         items: {
  //           properties: {
  //             invNo: {
  //               type: 'string',
  //               description: 'Invoice Number Approved for Financing',
  //             },
  //             date: {
  //               type: 'string',
  //               description: 'Invoice Creation Date',
  //             },
  //             amt: {
  //               type: 'string',
  //               description: 'Invoice Amount',
  //             },
  //             currency: {
  //               type: 'string',
  //               description: 'Invoice Currency',
  //             },
  //             transId: {
  //               type: 'string',
  //               description: 'Transaction ID',
  //             },
  //           },
  //         },
  //       },
  //       financierDetails: {
  //         type: 'object',
  //         properties: {
  //           email: {
  //             type: 'string',
  //             description: 'Invoice Number Approved for Financing',
  //           },
  //           designation: {
  //             type: 'string',
  //             description: 'Invoice Creation Date',
  //           },
  //           bankDetails: {
  //             type: 'object',
  //             properties: {
  //               accName: {
  //                 type: 'string',
  //                 description: 'Financier Account Name',
  //               },
  //               accNum: {
  //                 type: 'string',
  //                 description: 'Financier Account Number',
  //               },
  //               bankName: {
  //                 type: 'string',
  //                 description: 'Financier Account Bank Name',
  //               },
  //               swiftNo: {
  //                 type: 'string',
  //                 description: 'Financier Account Swift Number',
  //               },
  //             },
  //           },
  //         },
  //       },
  //       noaDetails: {
  //         type: 'array',
  //         items: {
  //           properties: {
  //             invtId: {
  //               type: 'string',
  //               description: 'Investor ID',
  //             },
  //             invtCpy: {
  //               type: 'string',
  //               description: 'Investor Company',
  //             },
  //             invtPercent: {
  //               type: 'string',
  //               description: 'Investor Percentage',
  //             },
  //             transBrief: {
  //               type: 'string',
  //               description: 'Transaction Brief',
  //             },
  //             transNo: {
  //               type: 'string',
  //               description: 'Transaction Number',
  //             },
  //           },
  //         },
  //       },
  //       oaStatus: {
  //         type: 'object',
  //         properties: {
  //           docIntegrity: {
  //             type: 'boolean',
  //             description: 'Verify whether Document has been Tampered',
  //           },
  //           docStatus: {
  //             type: 'boolean',
  //             description: 'Verify whether Document has been Issued',
  //           },
  //           issuerIdentity: {
  //             type: 'boolean',
  //             description:
  //               'Verify whether Document Issuer Identity is Valid (Checked according to DNS)',
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Token not Authorized',
  // })
  // async getNOAbyFR(@Param() { frDocHash }) {
  //   try {
  //     return await this.jedsignService.getNOAbyFR(frDocHash);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new BadRequestException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/supplier/document/list/invoices')
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Retrieve List of NOA; this endpoint is for supplier use only.',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  // })
  // @ApiOkResponse({
  //   description: 'Invoice List Retrieved',
  //   schema: {
  //     properties: {
  //       invoices: {
  //         type: 'array',
  //         items: {
  //           type: 'object',
  //           properties: {
  //             financier: {
  //               type: 'string',
  //               description: 'Financier Name',
  //             },
  //             docName: {
  //               type: 'string',
  //               description: 'Financing Request Name',
  //             },
  //             invNo: {
  //               type: 'string',
  //               description: 'Invoice Number',
  //             },
  //             createedAt: {
  //               type: 'number',
  //               description: 'Unix Timestamp of Document Creation',
  //             },
  //             totalCount: {
  //               type: 'number',
  //               description: 'Total Number of Invoices Requested in Financing Request',
  //             },
  //             mergedCount: {
  //               type: 'object',
  //               properties: {
  //                 approved: {
  //                   type: 'number',
  //                   description: 'Total Number of Invoices that have been approved by Financier',
  //                 },
  //                 declined: {
  //                   type: 'number',
  //                   description: 'Total Number of Invoices that have been declined by Financier',
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // async getNoaList(@Request() req) {
  //   try {
  //     return await this.jedsignService.getNoaList(req.user.token);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new UnauthorizedException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/all/financier/namelist')
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary:
  //     'Retrieve List of financier company names; this endpoint is for all existing users use only.',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  // })
  // @ApiOkResponse({
  //   description: 'nameList of all financier companies.',
  //   schema: {
  //     properties: {
  //       listOfCompanies: {
  //         type: 'array',
  //         items: {
  //           properties: {
  //             companyName: {
  //               type: 'string',
  //               description: 'company name',
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // async getFinancierNameList() {
  //   try {
  //     return await this.jedsignService.getFinancierNameList();
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new UnauthorizedException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/financier/bankDetails/:companyName')
  // @ApiParam({ name: 'companyName' })
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary:
  //     'Retrieve financier details using the financier company name; this endpoint is for all existing user use only.',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  // })
  // @ApiOkResponse({
  //   description: 'Details of financier',
  //   schema: {
  //     properties: {
  //       companyName: {
  //         type: 'string',
  //         description: 'Company name of financier',
  //       },
  //       email: {
  //         type: 'string',
  //         description: 'email of financier',
  //       },
  //       financierDetails: {
  //         type: 'object',
  //         properties: {
  //           unknown1: {
  //             type: 'string',
  //             description: ' unknown1 property of Financier.',
  //           },
  //           unknown2: {
  //             type: 'string',
  //             description: ' unknown2 property of Financier.',
  //           },
  //           unknown3: {
  //             type: 'string',
  //             description: ' unknown3 property of Financier.',
  //           },
  //           unknown4: {
  //             type: 'string',
  //             description: ' unknown4 property of Financier.',
  //           },
  //           accountName: {
  //             type: 'string',
  //             description: ' account name of Financier.',
  //           },
  //           accountNumber: {
  //             type: 'string',
  //             description: ' account number of Financier.',
  //           },
  //           bankName: {
  //             type: 'string',
  //             description: ' bank Name of Financier.',
  //           },
  //           swiftNumber: {
  //             type: 'string',
  //             description: ' swift number of Financier.',
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // async getFinancierDetails(@Param() { companyName }) {
  //   try {
  //     return await this.jedsignService.getFinancierDetails(companyName);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new UnauthorizedException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/financing/documents/:docHash')
  // @ApiParam({ name: 'docHash' })
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary:
  //     'Get Document using hash, from financing model(only financing requests and noa documents)',
  // })
  // @ApiBadRequestResponse({
  //   description: 'A bad response. Probable cause: invalid hash or hash not presented.',
  // })
  // @ApiOkResponse({
  //   description: 'Get Document Request Sucessful.',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  // })
  // async getFinancingDocument(@Param() { docHash }) {
  //   try {
  //     return await this.jedsignService.getFinancingDocument(docHash);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new BadRequestException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/verifySignature/:docHash')
  // @ApiParam({ name: 'docHash' })
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Check if document is signed.',
  //   description: 'Bearer apiToken Needed. If document is signed, returns True.',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  // })
  // @ApiOkResponse({
  //   description: 'Signing verification succeeded',
  //   schema: {
  //     properties: {
  //       signed: {
  //         type: 'boolean',
  //         description: 'Document Signing status ',
  //       },
  //       docHash: {
  //         type: 'string',
  //         description: 'Root hash of Document',
  //       },
  //     },
  //   },
  // })
  // @ApiBadRequestResponse({
  //   description: 'A bad response. Probable cause: invalid hash or hash not presented.',
  // })
  // async verifyDocument(@Request() req, @Param() { docHash }) {
  //   try {
  //     return await this.jedsignService.verifyDocument(req.user.token, docHash);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new BadRequestException(e.message);
  //   }
  // }

  // @UseGuards(AuthGuard('api'))
  // @Get('/buyer/document/list/invoices')
  // @ApiBearerAuth()
  // @ApiOperation({
  //   summary: 'Retrieve List of NOA; this endpoint is for buyer use only.',
  //   description: 'Bearer ApiToken Required',
  // })
  // @ApiUnauthorizedResponse({
  //   description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  // })
  // @ApiOkResponse({
  //   description: 'NOA List Retrieved',
  //   schema: {
  //     type: 'array',
  //     items: {
  //       type: 'object',
  //       properties: {
  //         createdAt: {
  //           type: 'number',
  //           description: 'TimeStamp of when NOA was created.(in unix format)',
  //         },
  //         numberOfInvoices: {
  //           type: 'number',
  //           description: 'Number of invoices in NOA',
  //         },
  //         financierCompany: {
  //           type: 'string',
  //           description: 'Company name of financier',
  //         },
  //         noaInfo: {
  //           type: 'array',
  //           description: 'NOA details',
  //           items: {
  //             type: 'object',
  //             properties: {
  //               invtId: {
  //                 type: 'string',
  //                 description: 'Investor Id',
  //               },
  //               invtCpy: {
  //                 type: 'string',
  //                 description: 'investor company',
  //               },
  //               invtPercent: {
  //                 type: 'string',
  //                 description: 'investment percentage',
  //               },
  //               transBrief: {
  //                 type: 'string',
  //                 description: 'investment transaction brief',
  //               },
  //               transNo: {
  //                 type: 'string',
  //                 description: 'investment transaction number',
  //               },
  //             },
  //           },
  //         },
  //         invDetails: {
  //           type: 'array',
  //           description: 'List of invoices and their details in the NOA.',
  //           items: {
  //             type: 'object',
  //             properties: {
  //               invNo: {
  //                 type: 'string',
  //                 description: 'Invoice Number',
  //               },
  //               date: {
  //                 type: 'string',
  //                 description: 'date inputted by User during invoice creation.(string format)',
  //               },
  //               amt: {
  //                 type: 'number',
  //                 description: 'amount of of money indicated in the invoice.',
  //               },
  //               currency: {
  //                 type: 'string',
  //                 description: 'currency type invoice amt is in.',
  //               },
  //               transId: {
  //                 type: 'string',
  //                 description: 'transaction Id used to find related documents to each invoice.',
  //               },
  //             },
  //           },
  //         },
  //         financierInfo: {
  //           type: 'object',
  //           description: 'information of financier.',
  //           properties: {
  //             companyName: {
  //               type: 'string',
  //               description: 'Company name of financier.',
  //             },
  //             address1: {
  //               type: 'string',
  //               description: 'First address of financier',
  //             },
  //             address2: {
  //               type: 'string',
  //               description: 'Second address of financier',
  //             },
  //             zipcode: {
  //               type: 'string',
  //               description: 'Zipcode of financier',
  //             },
  //             country: {
  //               type: 'string',
  //               description: 'location of financier',
  //             },
  //             domain: {
  //               type: 'string',
  //               description: 'financier domain',
  //             },
  //             email: {
  //               type: 'string',
  //               description: 'financier email',
  //             },
  //             name: {
  //               type: 'string',
  //               description: 'financier name',
  //             },
  //             mobileNo: {
  //               type: 'string',
  //               description: 'financier mobile number',
  //             },
  //             title: {
  //               type: 'string',
  //               description: 'financier title',
  //             },
  //             financierDetails: {
  //               type: 'object',
  //               properties: {
  //                 unknown1: {
  //                   type: 'string',
  //                   description: ' unknown1 property of Financier.',
  //                 },
  //                 unknown2: {
  //                   type: 'string',
  //                   description: ' unknown2 property of Financier.',
  //                 },
  //                 unknown3: {
  //                   type: 'string',
  //                   description: ' unknown3 property of Financier.',
  //                 },
  //                 unknown4: {
  //                   type: 'string',
  //                   description: ' unknown4 property of Financier.',
  //                 },
  //                 accountName: {
  //                   type: 'string',
  //                   description: ' account name of Financier.',
  //                 },
  //                 accountNumber: {
  //                   type: 'string',
  //                   description: ' account number of Financier.',
  //                 },
  //                 bankName: {
  //                   type: 'string',
  //                   description: ' bank Name of Financier.',
  //                 },
  //                 swiftNumber: {
  //                   type: 'string',
  //                   description: ' swift number of Financier.',
  //                 },
  //               },
  //             },
  //           },
  //         },
  //         supplierEmail: {
  //           type: 'string',
  //           description: 'supplierEmail',
  //         },
  //         supplierDesignation: {
  //           type: 'string',
  //           description: 'supplier designation within the company',
  //         },
  //         buyerInfo: {
  //           type: 'object',
  //           properties: {
  //             name: {
  //               type: 'string',
  //               description: 'Buyer Name',
  //             },
  //             cpyName: {
  //               type: 'string',
  //               description: 'Buyer Company Name',
  //             },
  //             address: {
  //               type: 'string',
  //               description: 'Buyer Address',
  //             },
  //             zipcode: {
  //               type: 'string',
  //               description: 'Buyer Zipcode',
  //             },
  //             phoneNo: {
  //               type: 'string',
  //               description: 'Buyer Phone number',
  //             },
  //             date: {
  //               type: 'number',
  //               description: 'Unix Timestamp of NOA Date',
  //             },
  //           },
  //         },
  //         supplierInfo: {
  //           type: 'object',
  //           properties: {
  //             name: {
  //               type: 'string',
  //               description: 'Supplier Name',
  //             },
  //             address: {
  //               type: 'string',
  //               description: 'Supplier Address',
  //             },
  //             zipcode: {
  //               type: 'string',
  //               description: 'Supplier Zipcode',
  //             },
  //           },
  //         },
  //         docName: {
  //           type: 'string',
  //           description: 'NOA Document Name',
  //         },
  //         invNo: {
  //           type: 'array',
  //           items: {
  //             type: 'number',
  //             description: 'Invoice Numbers related to NOA',
  //           },
  //         },
  //         mergeCount: {
  //           type: 'object',
  //           properties: {
  //             approved: {
  //               type: 'number',
  //               description: 'approved invoices count in specific NOA',
  //             },
  //             declined: {
  //               type: 'number',
  //               description: 'declined invoices count in specific NOA',
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // })
  // async getBuyerNoaList(@Request() req) {
  //   try {
  //     return await this.jedsignService.buyerNoaList(req.user.token);
  //   } catch (e) {
  //     if (e instanceof HttpException) throw e;
  //     throw new UnauthorizedException(e.message);
  //   }
  // }

  @Get('/wrapped/document/preview/:docHash')
  @ApiParam({ name: 'docHash' })
  @ApiOperation({
    summary: 'Get wrapped document to be dropped into renderer-web',
    description: '',
  })
  @ApiBadRequestResponse({
    description: 'Bad Request. Probable Cause: docHash is non-existent.',
  })
  @ApiOkResponse({
    description: 'Wrapped Document Information',
    schema: {
      type: 'object',
      description: 'Data in the TT file.',
    },
  })
  async getTTfile(@Request() req, @Param() { docHash }) {
    try {
      return await this.jedsignService.getWrappedDocument(docHash);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new BadRequestException(e.message);
    }
  }
}
