import { Injectable } from '@nestjs/common';
import { config, Credentials, SES } from 'aws-sdk';
import {
  activationTmpl,
  PGDSLITmpl,
  revokeTmpl,
  revokeInvTmpl,
  signingTmpl,
  NoaVerifiedTmpl,
  NoaBuyerVerifiedTmpl,
  financingRequestDenied,
  dnsConfigureTmpl,
  forgetPasswordTmpl,
  NoaBuyerAcknowledgedTmpl,
  CertTmpl,
  ADCSTmpl,
  DICTTmpl,
  PDDMCSTmpl,
  ADSMTmpl,
  Cert2Tmpl,
  emailPdf,
  generateReport,
  ErrorMail,
} from './templates';
import * as AWS from 'aws-sdk';

@Injectable()
export class MailerService {
  ses: SES;

  constructor() {
    config.credentials = new Credentials(
      process.env.AWS_ACCESS_KEY_ID,
      process.env.AWS_SECRET_ACCESS_KEY,
    );
    config.update({ region: 'ap-southeast-1' });
    this.ses = new SES();
  }

  async sendActivationEmail(email: string, link: string, name: string) {
    const params = {
      Destination: {
        /* required */
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: activationTmpl(link, name),
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'Activate Your ConsenTrade Account',
        },
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
      ReplyToAddresses: ['support@jupyton.com'],
    };

    return this.ses.sendEmail(params).promise();
  }

  async sendSigningEmail(email: string, link: string) {
    const params = {
      Destination: {
        /* required */
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: signingTmpl(link),
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'Sign Document',
        },
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
      ReplyToAddresses: ['support@jupyton.com'],
    };

    return this.ses.sendEmail(params).promise();
  }

  async sendPGDSLI(
    email: string,
    link: string,
    buyerName: string,
    issuerName: string,
    quoteNo: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: PGDSLITmpl(email, link, buyerName, issuerName, quoteNo, fileName, file),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async sendADCS(
    email: string,
    link: string,
    buyerName: string,
    issuerName: string,
    quoteNo: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: ADCSTmpl(email, link, buyerName, issuerName, quoteNo, fileName, file),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async sendCert(
    docType: string,
    email: string,
    link: string,
    buyerName: string,
    issuerName: string,
    quoteNo: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: CertTmpl(docType, email, link, buyerName, issuerName, quoteNo, fileName, file),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async sendDICT(
    email: string,
    link: string,
    buyerName: string,
    issuerName: string,
    quoteNo: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: DICTTmpl(email, link, buyerName, issuerName, quoteNo, fileName, file),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async sendADSM(
    email: string,
    link: string,
    buyerName: string,
    issuerName: string,
    quoteNo: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: ADSMTmpl(email, link, buyerName, issuerName, quoteNo, fileName, file),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async sendCert2(
    email: string,
    link: string,
    buyerName: string,
    issuerName: string,
    quoteNo: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: Cert2Tmpl(email, link, buyerName, issuerName, quoteNo, fileName, file),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async emailPDF(
    docType: string,
    email: string,
    buyerName: string,
    quoteNo: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: emailPdf(docType, email, buyerName, quoteNo, fileName, file),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async generateReport(email: string, fileName: string, file: Buffer) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: generateReport(email, fileName, file),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async sendPDDMCS(
    email: string,
    link: string,
    buyerName: string,
    issuerName: string,
    quoteNo: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: PDDMCSTmpl(email, link, buyerName, issuerName, quoteNo, fileName, file),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async sendNoaBuyerApproval(
    email: string,
    link: string,
    buyerName: string,
    html: string,
    invNo: string,
    financierCompany: string,
    supplierCompany: string,
    buyerCompany: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: NoaBuyerVerifiedTmpl(
          email,
          link,
          buyerName,
          html,
          invNo,
          financierCompany,
          supplierCompany,
          buyerCompany,
          fileName,
          file,
        ),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }

  async sendNoaBuyerAcknowledged(
    email: string,
    buyerCompany: string,
    html: string,
    docName: string,
  ) {
    const params = {
      Destination: {
        /* required */
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: NoaBuyerAcknowledgedTmpl(buyerCompany, html, docName),
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: `Notification of NOA Acknowledged by Buyer for ${docName}`,
        },
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
      ReplyToAddresses: ['support@jupyton.com'],
    };
    return this.ses.sendEmail(params).promise();
  }

  //Send SMS OTP
  async sendActivationMsg(mobileNo, code) {
    config.update({ region: 'ap-southeast-1' });
    const params = {
      Message: `The OTP is ${code}` /* required */,
      PhoneNumber: `${mobileNo}`,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'JEDKEPLER',
        },
      },
    };

    const sendPromise = new AWS.SNS({ apiVersion: '2010-03-31' }).publish(params).promise();

    sendPromise
      .then(function(data) {
        console.log(data.MessageId);
      })
      .catch(function(err) {
        console.error(err, err.stack);
      });
  }

  async sendRevokeEmail(
    email: string,
    link: string,
    docType: string,
    signerCompany: string,
    docNumber: string,
    issuerCompany: string,
    signerName: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: revokeTmpl(
          email,
          link,
          docType,
          signerCompany,
          docNumber,
          issuerCompany,
          signerName,
          fileName,
          file,
        ),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };

    return this.ses.sendRawEmail(params).promise();
  }

  async sendRevokeInvEmail(
    email: string,
    link: string,
    docType: string,
    signerCompany: string,
    docNumber: string,
    issuerCompany: string,
    signerName: string,
    fileName: string,
    file: Buffer,
  ) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: revokeInvTmpl(
          email,
          link,
          docType,
          signerCompany,
          docNumber,
          issuerCompany,
          signerName,
          fileName,
          file,
        ),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };

    return this.ses.sendRawEmail(params).promise();
  }

  async sendNoaVerifiedEmail(
    email: string,
    supplierName: string,
    html: string,
    financierName: string,
  ) {
    const params = {
      Destination: {
        /* required */
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: NoaVerifiedTmpl(supplierName, html, financierName),
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'Notification of Financing Request Approval',
        },
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
      ReplyToAddresses: ['support@jupyton.com'],
    };

    return this.ses.sendEmail(params).promise();
  }

  async sendSupplierFinancingRequestDenied(
    email: string,
    html: string,
    supplierName: string,
    financierCompany: string,
  ) {
    const params = {
      Destination: {
        /* required */
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: financingRequestDenied(html, supplierName, financierCompany),
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'Notification of Financing Request Rejection for Financing Request',
        },
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
      ReplyToAddresses: ['support@jupyton.com'],
    };

    return this.ses.sendEmail(params).promise();
  }

  async sendDnsConfigure(email, userName, docStore, userDomain) {
    const params = {
      Destination: {
        /* required */
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: dnsConfigureTmpl(userName, docStore, userDomain),
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'Notification Email for User Sign Up - DNS Configuration',
        },
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
      ReplyToAddresses: ['support@jupyton.com'],
    };

    return this.ses.sendEmail(params).promise();
  }

  async sendForgetPassword(email, link, userName) {
    const params = {
      Destination: {
        /* required */
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: forgetPasswordTmpl(link, userName),
          },
        },
        Subject: {
          Charset: 'UTF-8',
          Data: 'Forget Password Email',
        },
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
      ReplyToAddresses: ['support@jupyton.com'],
    };

    return this.ses.sendEmail(params).promise();
  }
  async sendErrorToUser(email: string, error: string, method: string) {
    const params = {
      Destinations: [email],
      RawMessage: {
        Data: ErrorMail(email, error, method),
      },
      Source: 'Jupyton <support@jupyton.com>' /* required */,
    };
    return this.ses.sendRawEmail(params).promise();
  }
}
