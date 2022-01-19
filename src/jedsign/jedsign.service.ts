import { Injectable, Inject } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { Web3Service } from '../web3/web3.service';
import { ADCSDto } from './dto/adcs.dto';
import { Certificate2DTO } from './dto/certificate2.dto';
import { CertificateDTO } from './dto/certificate.dto';
import { DictDTO } from './dto/dict.dto';
import { HCPCRDTO } from './dto/hcpcr.dto';
import { ADSMDto } from './dto/adsm.dto';
import { PDDMCSDto } from './dto/pddmcs.dto';
import { UpdateCert2 } from './dto/updateCert2.dto';
import fs = require('fs');
import path = require('path');
import os = require('os');
import hb = require('handlebars');
import { TokensService } from 'src/tokens/tokens.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MailerService } from '../mailer/mailer.service';
const { wrapDocument, wrapDocuments, getData, MerkleTree } = require('@govtechsg/open-attestation');
const { verify, isValid } = require('@govtechsg/oa-verify');
import * as util from 'util';
import { PGDSLIDto } from './dto/pgdsli.dto';
import { NoaDto } from './dto/noa.dto';
import { adcs, adsm, dict, pddmcs, pgdsli, hcpcr } from './templates/';
const EthereumTx = require('ethereumjs-tx').Transaction;
import pdf = require('html-pdf');
import PDFDocument = require('pdfkit');
import moment = require('moment');
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClientProxy } from '@nestjs/microservices';
import { async } from 'rxjs/internal/scheduler/async';
import { info } from 'console';
import { doc } from 'prettier';
import { JedLogService } from '../jedlogger/jedlog.service';
import { cpus } from 'os';
import { WrapperWorker } from '../jedsign/wrapdocs/WrapperWorker';
import { waitFor, waitForAll } from 'wait-for-event';

const { encryptString, decryptString } = require('@govtechsg/oa-encryption');

const log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: 'cheese.log' } },
  categories: { default: { appenders: ['cheese'], level: 'all' } },
});
const logger = log4js.getLogger('cheese');

type Hash = string | Buffer;

@Injectable()
export class JedsignService {
  constructor(
    @InjectModel('Documents') private readonly documentModel: Model<any>,
    @InjectModel('Otp') private readonly otpModel: Model<any>,
    @InjectModel('Batches') private readonly batchesModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Student') private readonly studentModel: Model<any>,
    @InjectModel('Config') private readonly configModel: Model<any>,
    private readonly usersService: UsersService,
    private readonly web3Service: Web3Service,
    private readonly mailerService: MailerService,
    private readonly tokensService: TokensService,
    @Inject('MerkleRoot_Service') private readonly client: ClientProxy,
    private readonly logService: JedLogService,
  ) {}

  private async topup(networkId: number, address: string) {
    const web3 = await this.web3Service.getWeb3(networkId);
    const accounts = await web3.eth.getAccounts();
    const bal = await web3.eth.getBalance(address);
    if (Number(web3.utils.fromWei(bal, 'ether')) < 0.2) {
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: address,
        value: web3.utils.toWei('0.2', 'ether'),
        gasPrice: this.web3Service.gasPrice.average,
      });
    }
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  async monthlyReport() {
    const config = await this.configModel.findOne({});
    if (config.automatedMonthlyBill == true) {
      await this.generateMonthlyReport();
    } else {
      console.log('Monthly billing off');
    }
  }

  async generateMonthlyReport() {
    const doc = new PDFDocument({ margin: 50 });
    const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
    const month = moment().format('MMMM-YYYY');
    const toDate = new Date();
    const fromDate = new Date();
    const m = fromDate.getMonth();
    fromDate.setMonth(fromDate.getMonth() - 1);
    if (fromDate.getMonth() == m) fromDate.setDate(0);
    fromDate.setHours(0, 0, 0, 0);
    const dictJSON = `${month} Billing Report.pdf`;
    const finalFile = `${folderPath}/${dictJSON}`;
    const configRecord = await this.configModel.findOne({});
    const email = configRecord.adminEmail;
    doc.pipe(fs.createWriteStream(finalFile));

    const config = await this.configModel.find({});
    const certificates = await this.documentModel.count({
      createdAt: {
        $gte: fromDate,
        $lt: toDate,
      },
    });
    const certificateArr = await this.documentModel.find({
      createdAt: {
        $gte: fromDate,
        $lt: toDate,
      },
    });
    const prices = config[0];
    const itemTotal = prices.certIssueUnitPrice * certificates;
    const items = [
      {
        item: 'Certificate Issuance',
        unitCost: prices.certIssueUnitPrice,
        quantity: certificates,
        itemTotal,
      },
    ];
    const totalArr = [];
    for (const i of items) {
      totalArr.push(i.itemTotal);
    }
    totalArr.reduce((a, b) => a + b, 0);
    const invoice = {
      items,
      subtotal: totalArr[0],
    };
    this.generateHeader(doc);
    this.generateCustomerInfo(doc);
    this.generateInvoiceTable(doc, invoice);
    this.generateConsumptionReport(doc, certificateArr);

    doc.end();

    setTimeout(() => {
      const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
      this.mailerService.generateReport(email, dictJSON, file);
    }, 5000);
  }

  async generateHeader(doc: any) {
    doc
      .image('src/jedsign/static/jedtrade_logo.png', 50, 50, { width: 50 })
      .fillColor('#444444')
      .fontSize(20)
      .text('JEDTrade Pte Ltd', 110, 59)
      .fontSize(10)
      .text('79 Ayer Rajah Crescent', 200, 65, { align: 'right' })
      .text('#01-03, LaunchPad@one-north, S139955', 200, 80, { align: 'right' })
      .moveDown();
  }

  async generateCustomerInfo(doc: any) {
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('Summary Report', 50, 110)
      .fontSize(15)
      .font('Helvetica-Bold')
      .text(`To: `, 50, 150)
      .text(`Email: `, 50, 180)
      .text(`About: `, 50, 210)
      .text(`From`, 50, 240)
      .text(`Date:`, 50, 260)
      .text(`To`, 350, 240)
      .text(`Date:`, 350, 260)

      .font('Helvetica')
      .text(`Training Vision`, 120, 150)
      .text(`tvi@gmail.com`, 120, 180)
      .text(`Usage Summary Report`, 120, 210)
      .text(`01/05/2021`, 120, 250)
      .text(`01/06/2021`, 420, 250)
      .text(`Report generated date: 31/05/2020`, 50, 300)
      .font('Helvetica-Bold')

      .moveDown();
  }

  async generateTableRow(doc: any, y: any, c1: any, c2: any, c3: any, c4: any, c5: any) {
    doc
      .fontSize(10)
      .text(c1, 50, y)
      .text(c2, 150, y)
      .text(c3, 280, y, { width: 90, align: 'right' })
      .text(c4, 370, y, { width: 90, align: 'right' })
      .text(c5, 0, y, { align: 'right' });
  }

  async generateConsumptionHeader(doc: any, y: any, index: any, date: any, time: any, hash: any) {
    doc
      .fontSize(10)
      .text(index, 15, y)
      .text(date, 67, y)
      .text(time, 133, y)
      .text(hash, 380, y);
  }

  async generateConsumptionRow(doc: any, y: any, index: any, date: any, time: any, hash: any) {
    doc
      .fontSize(11)
      .font('src/jedsign/static/Inconsolata-Medium.ttf')
      .text(index, 20, y)
      .text(date, 52, y)
      .text(time, 127, y)
      .text(hash, 195, y);
  }

  async generateHr(doc, y) {
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(570, y)
      .stroke();
  }

  async generateLine(doc, y) {
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(10, y)
      .lineTo(570, y)
      .stroke();
  }

  async generateInvoiceTable(doc: any, invoice: any) {
    let i;
    const invoiceTableTop = 330;

    doc.font('Helvetica-Bold');
    this.generateTableRow(
      doc,
      invoiceTableTop,
      'S/N',
      'Description',
      'Unit Cost',
      'Quantity',
      'Total',
    );
    this.generateHr(doc, invoiceTableTop + 20);

    for (i = 0; i < invoice.items.length; i++) {
      const item = invoice.items[i];
      const serialNo = i + 1;
      const position = invoiceTableTop + (i + 1) * 30;
      this.generateTableRow(
        doc,
        position,
        serialNo,
        item.item,
        `$${(item.unitCost / 100).toFixed(2)}`,
        item.quantity,
        `$${(item.itemTotal / 100).toFixed(2)}`,
      );

      this.generateHr(doc, position + 20);
    }

    const subtotalPosition = invoiceTableTop + (i + 1) * 30;
    const subtotal = `$${(invoice.subtotal / 100).toFixed(2)}`;
    this.generateTableRow(doc, subtotalPosition, '', '', '', 'Subtotal', subtotal);
  }

  async generateConsumptionReport(doc: any, certificateArr: any) {
    doc.addPage({
      margin: 50,
    });
    const toDate = moment().format('DD MMMM YYYY');
    const d = new Date();
    const m = d.getMonth();
    d.setMonth(d.getMonth() - 1);
    if (d.getMonth() == m) d.setDate(0);
    d.setHours(0, 0, 0, 0);
    const fromDate = moment(d).format('DD MMMM YYYY');
    doc.fontSize(25);
    doc.text('Usage Report', 10, 20);
    doc.fontSize(14);
    doc.text(`From Date: ${fromDate}`, 10, 60);
    doc.text(`To Date: ${toDate}`, 300, 60);

    let i;
    const invoiceTableTop = 100;
    this.generateConsumptionHeader(doc, invoiceTableTop, 'S/N', 'Date', 'Time', 'Hash');
    this.generateLine(doc, invoiceTableTop + 20);

    let position = invoiceTableTop;
    for (i = 0; i < certificateArr.length; i++) {
      const item = certificateArr[i];
      const serialNo = i + 1;
      const date = moment(item.updatedAt).format('DD MMMM YYYY');
      const time = moment(item.updatedAt).format('LT');
      if (position > 720) {
        doc.addPage({
          margin: 50,
        });
        position = 10;
      }
      position = position + 30;
      this.generateConsumptionRow(doc, position, serialNo, date, time, item.docHash);
    }
  }

  async setNewConfig(apiToken: string, config: object) {
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    if (getUserInfo.role == 'superUser') {
      const configRecord = await this.configModel.count();
      if (configRecord == 0) {
        const adminConfig = new this.configModel({
          certIssueUnitPrice: config['certIssueUnitPrice'],
          billingSurCharge: config['billingSurCharge'],
          automatedMonthlyBill: config['automatedMonthlyBill'],
          automatedEmailDate: config['automatedEmailDate'],
          adminEmail: config['adminEmail'],
        });
        await adminConfig.save();
      } else {
        await this.configModel.findOneAndRemove({});
        const adminConfig = new this.configModel({
          certIssueUnitPrice: config['certIssueUnitPrice'],
          billingSurCharge: config['billingSurCharge'],
          automatedMonthlyBill: config['automatedMonthlyBill'],
          automatedEmailDate: config['automatedEmailDate'],
          adminEmail: config['adminEmail'],
        });
        await adminConfig.save();
      }
    }
  }

  async setUnitPriceForCertIssue(apiToken: string, unitPrice: number) {
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    if (getUserInfo.role == 'superUser') {
      await this.configModel.findOneAndUpdate({}, { certIssueUnitPrice: unitPrice['unitPrice'] });
    } else {
      throw new Error('User is unauthorised to make Administrative changes');
    }
  }

  async setSurCharge(apiToken: string, surcharge: number) {
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    if (getUserInfo.role == 'superUser') {
      console.log(surcharge);
      await this.configModel.findOneAndUpdate({}, { billingSurCharge: surcharge['surCharge'] });
    } else {
      throw new Error('User is unauthorised to make Administrative changes');
    }
  }

  async setAutomatedMonthlyBill(apiToken: string, automated: boolean) {
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    if (getUserInfo.role == 'superUser') {
      console.log(automated);
      await this.configModel.findOneAndUpdate({}, { automatedMonthlyBill: automated['automated'] });
    } else {
      throw new Error('User is unauthorised to make Administrative changes');
    }
  }

  async setAutomatedEmailDate(apiToken: string, date: number) {
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    if (getUserInfo.role == 'superUser') {
      await this.configModel.findOneAndUpdate({}, { automatedEmailDate: date['sendDate'] });
    } else {
      throw new Error('User is unauthorised to make Administrative changes');
    }
  }

  async setAdminEmail(apiToken: string, email: string) {
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    if (getUserInfo.role == 'superUser') {
      await this.configModel.findOneAndUpdate({}, { adminEmail: email['email'] });
    } else {
      throw new Error('User is unauthorised to make Administrative changes');
    }
  }

  async viewConfig(apiToken: string) {
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    if (getUserInfo.role == 'superUser') {
      const configRecord = await this.configModel.find({});
      return configRecord;
    }
  }

  async getTransactionCount(networkId: number, address: string): Promise<number> {
    const web3 = await this.web3Service.getWeb3(networkId);
    return web3.eth.getTransactionCount(address, 'pending');
  }

  async createCertificateDoc(apiToken: string, certificateDTO: CertificateDTO) {
    const certArr = [];
    const rawJSONArr = [];
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getCompanyName = getUserInfo.companyName;
    const getUserEmail = getUserInfo.email;
    const getUserAddr = getUserInfo.wallet.address;
    const getDomain = getUserInfo.domain;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();

    const issuerPrivateKey = await getUserInfo.getPrivateKey();

    const valuesAlreadySeen = [];
    await this.web3Service.updateGasPrice();
    await Promise.all(
      certificateDTO.documents.map(async document => {
        const docType = document['docType'];
        const issuers = {
          $template: {
            name: 'JEDTRADE_DEMO',
            type: 'EMBEDDED_RENDERER',
            url: 'https://jrenderer.sandbox158.run/',
          },
          name: `${docType} Certificate`,
          issuers: [
            {
              name: `${getCompanyName}`,
              individualName: `${getUserInfo.name}`,
              address1: `${getUserInfo.address1}`,
              address2: `${getUserInfo.address2}`,
              zipcode: `${getUserInfo.zipcode}`,
              country: `${getUserInfo.country}`,
              phoneNo: `${getUserInfo.mobileNo}`,
              documentStore: `${docStore}`,
              identityProof: {
                type: 'DNS-TXT',
                location: `${getDomain}`,
              },
              email: `${getUserEmail}`,
              walletAddress: `${getUserAddr}`,
            },
          ],
        };
        const documentId = document['id'];
        if (valuesAlreadySeen.indexOf(documentId) !== -1) {
          throw new Error(`Duplicate ID - ${documentId}`);
        }
        valuesAlreadySeen.push(documentId);
        const findDocId = await this.documentModel.findOne({ documentId });
        if (findDocId != null) {
          throw new Error(`Document ID - ${documentId} already in use`);
        } else {
          const certDoc = { ...issuers, ...document };
          const documentId = document['id'];
          const certJSON = `${documentId}-${docType}.json`;
          const dictString = JSON.stringify(certDoc);
          const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
          const finalFile = `${folderPath}/${certJSON}`;
          fs.writeFileSync(finalFile, dictString);
          const bufferReadFile = fs.readFileSync(finalFile);
          const readFile = bufferReadFile.toString();
          rawJSONArr.push(JSON.parse(readFile));
        }
      }),
    );

    const wrappedDocuments = wrapDocuments(rawJSONArr);

    let merkleRoot;
    const targetArr = [];
    await Promise.all(
      wrappedDocuments.map(async wrappedDoc => {
        const wrapDocInfo = JSON.stringify(wrappedDoc);
        const rawDocInfo = getData(wrappedDoc);
        console.log(rawDocInfo);
        const docInfo = JSON.stringify(rawDocInfo);
        const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
        const certJSON = `${rawDocInfo.id}-${rawDocInfo.docType}.json`;
        const finalFile = `${folderPath}/${certJSON}`;
        fs.writeFileSync(finalFile, wrapDocInfo);
        const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
        const docRoot = wrappedDoc['signature'].targetHash;
        const docName = `${rawDocInfo.id}-${rawDocInfo.docType}`;
        const docStore = rawDocInfo.issuers[0].documentStore;
        const name = `${rawDocInfo.recipient.name} ${rawDocInfo.recipient.lastName}`;

        //Save Student Info to DB
        const studentId = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });
        if (studentId == null) {
          const student = new this.studentModel({
            studentId: rawDocInfo.recipient.studentId,
            nric: rawDocInfo.recipient.nric,
            email: rawDocInfo.recipient.email,
            name,
            dob: rawDocInfo.recipient.dob,
            graduationDate: rawDocInfo.recipient.completionDate,
          });
          await student.save();
        }

        const studentInfo = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });

        //Save Doc Info to DB
        const doc = new this.documentModel({
          docHash: `0x${docRoot}`,
          issuerDocStore: docStore,
          docInfo,
          wrapDocInfo,
          docType: `${rawDocInfo.docType}`,
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
          studentId: studentInfo._id,
        });
        await doc.save();

        const link = `https://jviewer.sandbox158.run/`;
        this.mailerService.sendCert(
          rawDocInfo.docType,
          rawDocInfo.recipient.email,
          link,
          name,
          rawDocInfo.issuers[0].name,
          rawDocInfo.id,
          docName,
          file,
        );

        this.usersService.etherCheck(getUserAddr);
        console.log('docInfo', rawDocInfo);
        const docs = {
          docName,
          email: rawDocInfo.recipient.email,
          name,
          docHash: `0x${docRoot}`,
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
        };
        merkleRoot = `0x${wrappedDoc['signature'].merkleRoot}`;
        certArr.push(docs);
        targetArr.push(`0x${docRoot}`);
      }),
    );

    //Save batch info to DB
    const batch = new this.batchesModel({
      issuerDocStore: docStore,
      documentBatch: targetArr,
      merkleRoot,
    });
    await batch.save();

    //Issue Document
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const data = await contract.methods.issue(merkleRoot).encodeABI();
    const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');

    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: docStore,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
    tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
    const serializedTx = tx.serialize();
    web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('receipt', console.log);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('CreateCert', duration);
    return { certArr };
  }

  async getAllCertificate(apiToken: string) {
    let loginUserEmail = '';
    try {
      const startTime = new Date();
      const web3 = await this.web3Service.getWeb3();

      const getUserInfo = await this.tokensService.findOneByToken(apiToken);
      loginUserEmail = getUserInfo.email;
      const getUserAddr = getUserInfo.wallet.address;
      const factoryContract = new web3.eth.Contract(
        JSON.parse(process.env.DocStoreFactoryABI),
        process.env.DOCSTORE_FACTORY,
      );
      const docStore = await factoryContract.methods.assets(getUserAddr).call();

      //logger.info('Jedsign.service: getAllCertificate: docStore: ', docStore);
      //const getCerts = await this.documentModel.find({ issuerDocStore: docStore });

      //const oldCerts = await this.documentModel.find({ issuerDocStore: docStore , issuedDate: { $gt: 0 } });
      const oldCerts = await this.documentModel.find({
        $and: [
          { issuerDocStore: docStore },
          { issuedDate: { $gt: 0 } },
          {
            $or: [
              {
                revokedDate: 0,
              },
              {
                revokedDate: { $gt: 1 },
              },
            ],
          },
        ],
      });

      const newCerts = await this.documentModel.find({ issuerDocStore: docStore, issuedDate: 0 });
      const revokedCerts = await this.documentModel.find({
        issuerDocStore: docStore,
        revokedDate: 1,
      });
      //logger.info('Jedsign.service: getAllCertificate: oldCerts: ', oldCerts);
      //logger.info('Jedsign.service: getAllCertificate: newCerts: ', newCerts);
      //logger.info('Jedsign.service: getAllCertificate: revokedCerts: ', revokedCerts);
      const nerCertsMer = [],
        revokeCertMer = [];
      newCerts.map(async document => {
        const wrapCertInfo = JSON.parse(document.wrapDocInfo);
        const merkleRoot = wrapCertInfo.signature.merkleRoot;
        nerCertsMer.push({ MerkleRoot: merkleRoot, DocumentId: document.documentId });
      });
      revokedCerts.map(async document => {
        const wrapCertInfo = JSON.parse(document.wrapDocInfo);
        revokeCertMer.push({
          MerkleRoot: wrapCertInfo.signature.merkleRoot,
          DocumentId: document.documentId,
        });
      });

      //logger.info('Jedsign.service: getAllCertificate: nerCertsMer: ', nerCertsMer);
      // logger.info('Jedsign.service: getAllCertificate: revokeCertMer: ', revokeCertMer);
      //Get Distinct Merkle root
      const nerCertsMerUnique = [...new Set(nerCertsMer.map(item => item.MerkleRoot))];
      const revokeCertMerUnique = [...new Set(revokeCertMer.map(item => item.MerkleRoot))];
      //logger.info('Jedsign.service: getAllCertificate: nerCertsMerUnique: ', nerCertsMerUnique);
      // logger.info('Jedsign.service: getAllCertificate: nerCertsMerUnique: ', revokeCertMerUnique);
      //Get Issue Date
      const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
      const nerCertsMerUniIssueDate = [],
        nerCertsMerUniRevokedDate = [];
      await Promise.all(
        nerCertsMerUnique.map(async merkleRoot => {
          const issuedBlock = await contract.methods.documentIssued(`0x${merkleRoot}`).call();
          if (issuedBlock == 0) {
            nerCertsMerUniIssueDate.push({ MerkleRoot: merkleRoot, IssuedDate: 0 });
          } else {
            const issuedBlockDate = await web3.eth.getBlock(issuedBlock);
            nerCertsMerUniIssueDate.push({
              MerkleRoot: merkleRoot,
              IssuedDate: issuedBlockDate.timestamp,
            });
          }
        }),
      );
      //Get Batch RevokedDate
      await Promise.all(
        revokeCertMerUnique.map(async merkleRoot => {
          const batchRevoked = await contract.methods.documentRevoked(`0x${merkleRoot}`).call();
          if (batchRevoked == 0) {
            nerCertsMerUniRevokedDate.push({ MerkleRoot: merkleRoot, RevokedDate: 0 });
          } else {
            const revokedBlockDate = await web3.eth.getBlock(batchRevoked);
            nerCertsMerUniRevokedDate.push({
              MerkleRoot: merkleRoot,
              RevokedDate: revokedBlockDate.timestamp,
            });
          }
        }),
      );
      logger.info(
        'Jedsign.service: getAllCertificate: nerCertsMerUniIssueDate: ',
        nerCertsMerUniIssueDate,
      );
      logger.info(
        'Jedsign.service: getAllCertificate: nerCertsMerUniRevokedDate: ',
        nerCertsMerUniRevokedDate,
      );

      //Get Revoke Date and Update Revoke Date
      const revokeCertMerUniRevokedDate = [];
      let revokedDate;
      await Promise.all(
        revokedCerts.map(async document => {
          if (document.isBatchRevoke) {
            const merkleRootObj = revokeCertMer.find(i => i.DocumentId === document.documentId);
            // logger.info('Jedsign.service: getAllCertificate: merkleRootObj: ', merkleRootObj);
            logger.info(
              'Jedsign.service: getAllCertificate:merkleRootObj.MerkleRoot ',
              merkleRootObj.MerkleRoot,
            );
            const revokedObj = nerCertsMerUniRevokedDate.find(
              i => i.MerkleRoot === merkleRootObj.MerkleRoot,
            );
            //logger.info('Jedsign.service: getAllCertificate:revokedObj ', revokedObj);
            logger.info(
              'Jedsign.service: getAllCertificate:issueObj.IssuedDate ',
              revokedObj.IssuedDate,
            );
            revokedDate = revokedObj.RevokedDate;
          } else {
            const isRevoked = await contract.methods.documentRevoked(`${document.docHash}`).call();
            if (isRevoked > 0) {
              const revokeBlockInfo = await web3.eth.getBlock(isRevoked);
              revokedDate = revokeBlockInfo.timestamp;
            } else {
              revokedDate = 0;
            }
          }
          revokeCertMerUniRevokedDate.push({
            docHash: document.docHash,
            docInfo: document.docInfo,
            issuedDate: document.issuedDate,
            revokedDate: revokedDate,
            documentId: document.documentId,
            docType: document.docType,
            wrapDocInfo: document.wrapDocInfo,
          });
          //Update Database
          let filter, updateDocument;
          if (revokedDate > 0) {
            filter = { documentId: document.documentId };
            updateDocument = { $set: { revokedDate: revokedDate } };
            // logger.info(
            //   `Jedsign.service: getAllCertificate: updateMany: documentId: ${document.documentId}, revokedDate: ${document.revokedDate}`,
            // );
            const result = await this.documentModel.updateOne(filter, updateDocument);
          }
        }),
      );
      logger.info(
        'Jedsign.service: getAllCertificate: revokeCertMerUniRevokedDate: ',
        revokeCertMerUniRevokedDate,
      );
      //update Issue Date
      const newCertsWithIssuedate = [];
      await Promise.all(
        newCerts.map(async document => {
          const merkleRootObj = nerCertsMer.find(i => i.DocumentId === document.documentId);
          logger.info('Jedsign.service: getAllCertificate: merkleRootObj: ', merkleRootObj);
          logger.info(
            'Jedsign.service: getAllCertificate:merkleRootObj.MerkleRoot ',
            merkleRootObj.MerkleRoot,
          );
          const issueObj = nerCertsMerUniIssueDate.find(
            i => i.MerkleRoot === merkleRootObj.MerkleRoot,
          );
          logger.info('Jedsign.service: getAllCertificate:issueObj ', issueObj);
          logger.info(
            'Jedsign.service: getAllCertificate:issueObj.IssuedDate ',
            issueObj.IssuedDate,
          );
          //logger.info('Jedsign.service: getAllCertificate:issueObj.IssuedDate ', {...document, issuedDate:issueObj.IssuedDate});
          logger.info('Jedsign.service: getAllCertificate:document ', document);
          // document.issuedDate=issueObj.IssuedDate;
          //  logger.info('Jedsign.service: getAllCertificate:document up ', document);
          newCertsWithIssuedate.push({
            docHash: document.docHash,
            docInfo: document.docInfo,
            issuedDate: issueObj.IssuedDate,
            revokedDate: document.revokedDate,
            documentId: document.documentId,
            docType: document.docType,
            wrapDocInfo: document.wrapDocInfo,
          });
          //Update Database
          let filter, updateDocument;
          if (issueObj.IssuedDate > 0) {
            filter = { documentId: document.documentId };
            updateDocument = { $set: { issuedDate: issueObj.IssuedDate } };
            // logger.info(
            //   `Jedsign.service: getAllCertificate: updateMany:  documentId: ${document.documentId}, isissuedDate: ${issueObj.IssuedDate}`,
            // );
            const result = await this.documentModel.updateOne(filter, updateDocument);
          }
        }),
      );

      // logger.info(
      //   'Jedsign.service: getAllCertificate: newCertsWithIssuedate: ',
      //   newCertsWithIssuedate,
      // );
      const allcerts = [...oldCerts, ...newCertsWithIssuedate, ...revokeCertMerUniRevokedDate];
      //logger.info('Jedsign.service: getAllCertificate: allcerts: ', allcerts);

      const certificateInfo = [];
      await Promise.all(
        allcerts.map(async document => {
          logger.info('Jedsign.service: getAllCertificate: document: ', document);
          logger.info('Jedsign.service: getAllCertificate: document.docInfo: ', document.docInfo);
          const stringCertInfo = document.docInfo;
          logger.info('Jedsign.service: getAllCertificate: stringCertInfo: ', stringCertInfo);
          const certInfo = JSON.parse(stringCertInfo);

          //console.log(certInfo);

          let docInfo;
          let approvers2;

          if (certInfo['approvers'] != null) {
            for (let i = 0; i < certInfo['approvers'].length; i++) {
              approvers2 = certInfo['approvers'];
            }

            docInfo = {
              docHash: document.docHash,
              issuerDocStore: document.issuerDocStore,
              docType: document.docType,
              transcriptId: certInfo.transcriptId,
              patientId: certInfo.patientId,
              name: certInfo.fhirBundle.entry[0].name[0].text,
              testName: certInfo.fhirBundle.entry[1].type.coding[0].display,
              effectiveDate: certInfo.fhirBundle.entry[2].effectiveDateTime,
              reference: certInfo.reference,
              issuedOn: document.issuedDate,
              revoked: document.revokedDate, // revokedDate,
              wrapDocInfo: document.wrapDocInfo,
              merkleroot: document.merkleRoot,
              approvers: approvers2,
              // isissuedDate: isissuedDate,
              // isRevokedDate: isRevokedDate,
              // documentId: document.documentId,
            };

            certificateInfo.push(docInfo);
          } else {
            const docInfo = {
              docHash: document.docHash,
              issuerDocStore: document.issuerDocStore,
              docType: document.docType,
              transcriptId: certInfo.transcriptId,
              patientId: certInfo.patientId,
              name: certInfo.fhirBundle.entry[0].name[0].text,
              testName: certInfo.fhirBundle.entry[1].type.coding[0].display,
              effectiveDate: certInfo.fhirBundle.entry[2].effectiveDateTime,
              reference: certInfo.reference,
              issuedOn: document.issuedDate,
              revoked: document.revokedDate,
              wrapDocInfo: document.wrapDocInfo,
              merkleroot: document.merkleRoot,

              // isissuedDate: isissuedDate,
              // isRevokedDate: isRevokedDate,
              // documentId: document.documentId,
            };

            certificateInfo.push(docInfo);
          }

          console.log('line 914 jedsignservice', certificateInfo);
        }),
      );

      // logger.info('Jedsign.service: getAllCertificate: certificateInfo: ', certificateInfo);
      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;
      console.log('getAllCert', duration);

      return { certList: certificateInfo };
      return;
      // const certLogArr = [];
      // await Promise.all(
      //   getCerts.map(async logDoc => {
      //     certLogArr.push(logDoc);
      //   }),
      // );

      //const certificateInfo = [];
      await Promise.all(
        allcerts.map(async document => {
          const stringCertInfo = document.docInfo;
          const certInfo = JSON.parse(stringCertInfo);
          const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
          const wrapCertInfo = JSON.parse(document.wrapDocInfo);

          const merkleRoot = wrapCertInfo.signature.merkleRoot; //here
          // const issuedBlock = await contract.methods.documentIssued(`0x${merkleRoot}`).call();
          // console.log('issuedBlock', `0x${merkleRoot}`, issuedBlock);
          let issuedDate = document.issuedDate;

          let isissuedDate = false,
            isRevokedDate = false;
          logger.info('Jedsign.service: getAllCertificate: issuedDate: ', issuedDate);
          logger.info('Jedsign.service: getAllCertificate: issuedDate Status: ', issuedDate == 0);
          logger.info('Jedsign.service: getAllCertificate: merkleRoot: ', merkleRoot);
          logger.info('Jedsign.service: getAllCertificate: documentId: ', document.documentId);

          //Get Issue Date
          if (issuedDate == 0) {
            logger.info(
              'Jedsign.service: getAllCertificate: issuedDate: ',
              document.issuedDate == 0,
            );
            const issuedBlock = await contract.methods.documentIssued(`0x${merkleRoot}`).call();
            //console.log('issuedBlock', `0x${merkleRoot}`, issuedBlock);
            logger.info('Jedsign.service: getAllCertificate: issuedBlock: ', issuedBlock);
            if (issuedBlock == 0) {
              console.log('issuedBlock 0');
              // revokedDate = 0;
              issuedDate = 0;
            } else {
              const issuedBlockDate = await web3.eth.getBlock(issuedBlock);
              issuedDate = issuedBlockDate.timestamp;
              isissuedDate = true;
              //console.log('issuedDate', `0x${merkleRoot}`, issuedDate);

              //update document table
              // const filter = { documentId: document.documentId };
              // const updateDocument = { $set: { issuedDate: issuedDate } };
              // const result = await this.documentModel.updateOne(filter, updateDocument);

              //Temporarly Commented
            }
          }
          logger.info(
            'Jedsign.service: getAllCertificate: revokedDate Status: ',
            document.revokedDate == 1,
          );
          //Get Revoke date
          let revokedDate;
          if (document.revokedDate == 1) {
            const isRevoked = await contract.methods.documentRevoked(`${document.docHash}`).call();
            logger.info('Jedsign.service: getAllCertificate: isRevoked: ', isRevoked);
            const batchRevoked = await contract.methods.documentRevoked(`0x${merkleRoot}`).call();
            logger.info('Jedsign.service: getAllCertificate: batchRevoked: ', batchRevoked);
            if (isRevoked == 0 && batchRevoked == 0) {
              revokedDate = 0;
            } else if ((isRevoked > 0 && batchRevoked == 0) || isRevoked > 0) {
              const revokeBlockInfo = await web3.eth.getBlock(isRevoked);
              revokedDate = revokeBlockInfo.timestamp;
              isRevokedDate = true;
            } else if (isRevoked == 0 && batchRevoked > 0) {
              const revokeBlockInfo = await web3.eth.getBlock(batchRevoked);
              revokedDate = revokeBlockInfo.timestamp;
              isRevokedDate = true;
            }
          } else {
            revokedDate = 0;
          }
          let docInfo;
          let approvers2;

          if (certInfo['approvers'] != null) {
            for (let i = 0; i < certInfo['approvers'].length; i++) {
              approvers2 = certInfo['approvers'];
            }
            docInfo = {
              docHash: document.docHash,
              docType: document.docType,
              studentId: certInfo.recipient.studentId,
              studentName: certInfo.recipient.name,
              studentLastName: certInfo.recipient.lastName,
              courseName: certInfo.recipient.courseName,
              transcriptId: certInfo.id,
              issuedOn: issuedDate,
              revoked: revokedDate,
              wrapDocInfo: document.wrapDocInfo,
              approvers: approvers2,
              isissuedDate: isissuedDate,
              isRevokedDate: isRevokedDate,
              documentId: document.documentId,
            };
            certificateInfo.push(docInfo);
          } else {
            const docInfo = {
              docHash: document.docHash,
              docType: document.docType,
              studentId: certInfo.recipient.studentId,
              studentName: certInfo.recipient.name,
              studentLastName: certInfo.recipient.lastName,
              courseName: certInfo.recipient.courseName,
              transcriptId: certInfo.id,
              issuedOn: issuedDate,
              revoked: revokedDate,
              wrapDocInfo: document.wrapDocInfo,
              isissuedDate: isissuedDate,
              isRevokedDate: isRevokedDate,
              documentId: document.documentId,
            };
            certificateInfo.push(docInfo);
          }
        }),
      );
      //Update Issue Date
      let filter, updateDocument;
      logger.info('Jedsign.service: getAllCertificate: Issuedate update started');
      logger.info(
        'Jedsign.service: getAllCertificate: Issuedate update started: certificateInfo',
        certificateInfo,
      );
      console.log('Jedsign.service: getAllCertificate: Issuedate update started');
      certificateInfo.map(async document => {
        if (document.isissuedDate) {
          filter = { documentId: document.documentId };
          updateDocument = { $set: { issuedDate: document.issuedOn } };
          logger.info(
            `Jedsign.service: getAllCertificate: updateMany: issuedDate: ${document.issuedOn}, documentId: ${document.documentId}, isissuedDate: ${document.isissuedDate}`,
          );
          const result = await this.documentModel.updateOne(filter, updateDocument);
        }
        if (document.isRevokedDate) {
          filter = { documentId: document.documentId };
          updateDocument = { $set: { revokedDate: document.revoked } };
          logger.info(
            `Jedsign.service: getAllCertificate: updateMany: issuedDate: ${document.revoked}, documentId: ${document.documentId}, isissuedDate: ${document.isRevokedDate}`,
          );
          const result = await this.documentModel.updateOne(filter, updateDocument);
        }
      });
      logger.info('Jedsign.service: getAllCertificate: Issuedate update is compelted');
      console.log('Jedsign.service: getAllCertificate: Issuedate update started');

      // const endTime = new Date();
      // const duration = (endTime.getTime() - startTime.getTime()) / 1000;
      // console.log('getAllCert', duration);
      // return { certList: certificateInfo };
    } catch (e) {
      logger.info('Jedsign.service: getAllCertificate: Error: ', e);
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: `jedsign.service: getAllCertificate: ${loginUserEmail}: Error:   ${e.message}`,
      });
      this.sendErrorToUser(loginUserEmail, e.message, 'Get Certificates');
      throw e;
    }
  }

  async verifyOTPApproval(updateCert2: UpdateCert2, docHash: string, apiToken: string) {
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const userId = getUserInfo._id;
    const getUserEmail = getUserInfo.email;

    const findOne = await this.usersService.findOneByOTP(updateCert2.otp);
    const mobileNo = findOne.mobileNo;

    if (await this.otpModel.exists({ code: updateCert2.otp, userId })) {
      await this.otpModel.findOneAndRemove({ code: updateCert2.otp, mobileNo });

      const web3 = await this.web3Service.getWeb3();

      const doc = await this.documentModel.findOne({ docHash }, { __v: 0, _id: 0 });
      const docInfo = JSON.parse(doc.docInfo);
      const wrapDocInfo = doc.wrapDocInfo;
      const getDocStore = doc.issuerDocStore;

      const issuerEmail = docInfo['issuers'][0].email.toString();
      const userSchema = await this.userModel.findOne({ email: issuerEmail });

      for (let i = 0; i < docInfo.approvers.length; i++) {
        if (docInfo.approvers[i].email === getUserEmail) {
          docInfo.approvers[i].signature = updateCert2.signature;
          const updateDoc = JSON.stringify(docInfo);
          const updateSignature = await this.documentModel.findOneAndUpdate(
            { docHash },
            { docInfo: updateDoc },
          );

          let signatureFilled = true;

          for (let i = 0; i < docInfo.approvers.length; i++) {
            if (docInfo.approvers[i].signature === '') {
              signatureFilled = false;
            }
          }
          if (signatureFilled) {
            const getUserAddr = userSchema.wallet.address;
            const issuerPrivateKey = await userSchema.getPrivateKey();

            //Issue Document
            const contract = new web3.eth.Contract(
              JSON.parse(process.env.DocStoreABI),
              getDocStore,
            );
            const data = await contract.methods.issue(docHash).encodeABI();
            const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');

            const rawTx = {
              nonce: web3.utils.toHex(nonce),
              gasPrice: web3.utils.toHex(
                (this.web3Service.gasPrice.average *
                  (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
                  100,
              ),
              to: getDocStore,
              gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
              value: web3.utils.toHex(web3.utils.toWei('0')),
              data: data,
            };

            const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
            tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
            const serializedTx = tx.serialize();
            web3.eth
              .sendSignedTransaction('0x' + serializedTx.toString('hex'))
              .on('receipt', console.log);

            //Generate JSON for viewer
            const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
            const certJSON = `${docInfo.id}-2Approver.json`;
            const finalFile = `${folderPath}/${certJSON}`;
            fs.writeFileSync(finalFile, wrapDocInfo);
            const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));

            const link = `https://jviewer.sandbox158.run/`;

            // Send email to recipient
            this.mailerService.sendCert2(
              docInfo.recipient.email,
              link,
              docInfo.recipient.name,
              docInfo.issuers[0].name,
              docInfo.id,
              docInfo.name,
              file,
            );

            //Send email to issuer
            this.mailerService.sendCert2(
              docInfo.issuers[0].email,
              link,
              docInfo.recipient.name,
              docInfo.issuers[0].name,
              docInfo.id,
              docInfo.name,
              file,
            );
          }

          return updateSignature;
        }
      }
      throw new Error('Invalid Approver');
    } else {
      throw new Error('OTP not found');
    }
  }

  // async updateCert2(updateCert2: UpdateCert2, docHash: string, apiToken) {
  //   const getUserInfo = await this.tokensService.findOneByToken(apiToken);
  //   const getUserEmail = getUserInfo.email;

  //   const web3 = await this.web3Service.getWeb3();

  //   const doc = await this.documentModel.findOne({ docHash }, { __v: 0, _id: 0 });
  //   const docInfo = JSON.parse(doc.docInfo);
  //   const getDocStore = doc.issuerDocStore;

  //   const issuerEmail = docInfo['issuers'][0].email.toString();
  //   const userSchema = await this.userModel.findOne({ email: issuerEmail });

  //   for (let i = 0; i < docInfo.approvers.length; i++) {
  //     if (docInfo.approvers[i].email === getUserEmail) {
  //       docInfo.approvers[i].signature = updateCert2.signature;
  //       const updateDoc = JSON.stringify(docInfo);
  //       const updateSignature = await this.documentModel.findOneAndUpdate(
  //         { docHash },
  //         { docInfo: updateDoc },
  //       );

  //       let signatureFilled = true;

  //       for (let i = 0; i < docInfo.approvers.length; i++) {
  //         if (docInfo.approvers[i].signature === '') {
  //           signatureFilled = false;
  //         }
  //       }
  //       if (signatureFilled) {
  //         const getUserAddr = userSchema.wallet.address;
  //         const issuerPrivateKey = await userSchema.getPrivateKey();

  //         //Issue Document
  //         const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), getDocStore);
  //         const data = await contract.methods.issue(docHash).encodeABI();
  //         const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');

  //         const rawTx = {
  //           nonce: web3.utils.toHex(nonce),
  //           gasPrice: web3.utils.toHex(
  //             (this.web3Service.gasPrice.average *
  //               (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
  //               100,
  //           ),
  //           to: getDocStore,
  //           gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
  //           value: web3.utils.toHex(web3.utils.toWei('0')),
  //           data: data,
  //         };

  //         const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
  //         tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
  //         const serializedTx = tx.serialize();
  //         web3.eth
  //           .sendSignedTransaction('0x' + serializedTx.toString('hex'))
  //           .on('receipt', console.log);
  //       } else {
  //       }
  //       return updateSignature;
  //     }
  //   }
  // }

  async getHistory(apiToken: string) {
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();

    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const batchInfo = await this.batchesModel.find({ issuerDocStore: docStore });
    const batchArr = [];
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);

    await Promise.all(
      batchInfo.map(async batch => {
        const issuedBlock = await contract.methods.documentIssued(batch.merkleRoot).call();
        const issuedReceipt = await web3.eth.getBlock(issuedBlock);
        const isRevoked = await contract.methods.documentRevoked(`${batch.merkleRoot}`).call();
        let revokedDate;
        if (isRevoked == 0) {
          revokedDate = 0;
        } else {
          const revokeBlockInfo = await web3.eth.getBlock(isRevoked);
          revokedDate = revokeBlockInfo.timestamp;
        }
        const docBatch = {
          batchId: batch._id,
          docHash: batch.documentBatch,
          merkleRoot: batch.merkleRoot,
          issuedTime: issuedReceipt.timestamp,
          revokedDate,
        };
        batchArr.push(docBatch);
      }),
    );
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('getHistory', duration);
    return { batchArr };
  }

  async getStudents(apiToken: string) {
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();

    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const documentInfo = await this.documentModel.find({ issuerDocStore: docStore });

    const patientIdArr = [];
    await Promise.all(
      documentInfo.map(document => {
        const patientId = document.patientId;
        patientIdArr.push(patientId);
      }),
    );
    const uniqueSet = new Set(patientIdArr);
    const backToArray = [...uniqueSet];

    const studentArr = [];

    await Promise.all(
      backToArray.map(async patientId => {
        const studentInfo = await this.studentModel.findOne(
          { _id: patientId },
          { __v: 0, updated: 0, created: 0 },
        );

        const documentArr = await this.documentModel.find({ patientId: patientId });
        const students = {
          noOfDocs: documentArr.length,
        };

        const info = Object.assign(studentInfo.toObject(), students);
        studentArr.push(info);
      }),
    );
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('getStudent', duration);
    return { studentArr };
  }

  async getStudentsFromBatch(apiToken: string, batchId: string) {
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();

    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const batchInfo = await this.batchesModel.findOne({ issuerDocStore: docStore, _id: batchId });

    //console.log(batchInfo);
    const documentBatch = batchInfo.documentBatch;
    const studentArr = [];

    await Promise.all(
      documentBatch.map(async document => {
        const doc = await this.documentModel.findOne({ docHash: document });

        const docInfo = doc.docInfo;
        const jsonInfo = JSON.parse(docInfo);

        //console.log(jsonInfo);

        const name = `${jsonInfo.fhirBundle.entry[0].name[0].text}`;
        const studentInfo = {
          docHash: document,
          studentId: jsonInfo.patientId,
          name,
          email: jsonInfo.patientEmail,
        };
        studentArr.push(studentInfo);
      }),
    );
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('getStudentsFromBatch', duration);
    return { batchId, issuedBatch: batchInfo.createdAt, studentArr };
  }

  async getStudentsDetail(apiToken: string, patientId: string) {
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();

    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();

    const studentCerts = await this.documentModel.find({ issuerDocStore: docStore, patientId });

    const studentArr = [];
    const students = await this.studentModel.findOne({ _id: patientId });

    //console.log(students);

    const studentInfo = {
      name: students.patientName,
      studentId: students.patientId,
      email: students.patientEmail,
      nric: students.patientNRIC,
      dob: students.dob,
      effectiveDate: students.effectiveDate,
    };

    // Get certs
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    await Promise.all(
      studentCerts.map(async document => {
        const wrapCertInfo = JSON.parse(document.wrapDocInfo);
        const merkleRoot = wrapCertInfo.signature.merkleRoot;
        const rawCertInfo = JSON.parse(document.docInfo);

        //console.log(rawCertInfo);

        const courseName = rawCertInfo.fhirBundle.entry[1].type.coding[0].display;
        const issuedBlock = await contract.methods.documentIssued(`0x${merkleRoot}`).call();
        console.log('issuedBlock', `0x${merkleRoot}`, issuedBlock);
        let issuedDate;
        let revokedDate;
        if (issuedBlock == 0) {
          console.log('issuedBlock 0');
          revokedDate = 0;
          issuedDate = 0;
        } else {
          const issuedBlockDate = await web3.eth.getBlock(issuedBlock);
          issuedDate = issuedBlockDate.timestamp;
          console.log('issuedDate', `0x${merkleRoot}`, issuedDate);
          const isRevoked = await contract.methods.documentRevoked(`${document.docHash}`).call();
          console.log('isRevoked', isRevoked);
          const batchRevoked = await contract.methods.documentRevoked(`0x${merkleRoot}`).call();
          if (isRevoked == 0 && batchRevoked == 0) {
            revokedDate = 0;
          } else if (isRevoked > 0 && batchRevoked == 0) {
            const revokeBlockInfo = await web3.eth.getBlock(isRevoked);
            revokedDate = revokeBlockInfo.timestamp;
          } else if (isRevoked == 0 && batchRevoked > 0) {
            const revokeBlockInfo = await web3.eth.getBlock(batchRevoked);
            revokedDate = revokeBlockInfo.timestamp;
          }
        }
        const documentInfo = {
          docHash: document.docHash,
          docType: document.docType,
          courseName,
          transcriptId: document.documentId,
          issuedDate,
          revokedDate,
          wrapDocInfo: document.wrapDocInfo,
        };
        studentArr.push(documentInfo);
      }),
    );
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('getStudentsDetail', duration);
    return { studentInfo, studentArr };
  }

  async getTemplateHtml(
    docType: string,
    name: string,
    lastName: string,
    month: string,
    year: number,
  ) {
    try {
      let document;
      if (docType == 'ADCS') {
        document = adcs(name, lastName, month, year);
      } else if (docType == 'ADSM') {
        document = adsm(name, lastName, month, year);
      } else if (docType == 'DICT') {
        document = dict(name, lastName, month, year);
      } else if (docType == 'PDDMCS') {
        document = pddmcs(name, lastName, month, year);
      } else if (docType == 'PGDSLI') {
        document = pgdsli(name, lastName, month, year);
      } else if (docType == 'HCPCR') {
        document = hcpcr(name, lastName, month, year);
      }

      return document;
    } catch (err) {
      return Promise.reject('Could not load html');
    }
  }

  async emailPDF(docHash: string) {
    const getDocInfo = await this.documentModel.findOne({ docHash });
    const docType = getDocInfo.docType;
    const docInfo = JSON.parse(getDocInfo.docInfo);
    const id = docInfo.id;
    const firstName = docInfo.patientFirstName;
    const lastName = docInfo.patientLastName;
    const completionDate = docInfo.effectiveDate;
    const date = new Date(completionDate * 1000);
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    const email = docInfo.patientEmail;
    console.log(email);
    const name = `${firstName} ${lastName}`;
    const data = {};
    console.log('1');
    this.getTemplateHtml(docType, firstName, lastName, month, year)
      .then(async res => {
        const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
        const dictJSON = `${id}-${docType}.pdf`;
        const finalFile = `${folderPath}/${dictJSON}`;
        const template = hb.compile(res, { strict: true });
        const result = template(data);

        console.log(result);
        console.log('2');
        // const options = {
        //   height: '15.5in',
        //   width: '14.3in',
        //   orientation: 'portrait',
        //   phantomPath: '/usr/local/bin/phantomjs',
        // };

        pdf.create(result).toFile(finalFile, function(err, data) {
          if (err) {
            console.log('3');
            console.log(err);
          } else {
            console.log(data);
          }
        });
        setTimeout(() => {
          const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
          this.mailerService.emailPDF(docType, email, name, id, dictJSON, file);
        }, 5000);
      })
      .catch(err => {
        console.log(err);
      });
  }

  async createADCSDoc(apiToken: string, ADCSDto: ADCSDto) {
    logger.info('Jedsign.service: createADCSDoc: Before the call');
    const certArr = [];
    let getUserEmail;
    try {
      const rawJSONArr = [];
      const startTime = new Date();
      const web3 = await this.web3Service.getWeb3();
      const getUserInfo = await this.tokensService.findOneByToken(apiToken);
      const getCompanyName = getUserInfo.companyName;
      getUserEmail = getUserInfo.email;
      const getUserAddr = getUserInfo.wallet.address;
      const getDomain = getUserInfo.domain;
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: `jedsign.service: createADCSDoc: ${getUserEmail}  Mongo DB test01`,
      });
      const factoryContract = new web3.eth.Contract(
        JSON.parse(process.env.DocStoreFactoryABI),
        process.env.DOCSTORE_FACTORY,
      );
      const docStore = await factoryContract.methods.assets(getUserAddr).call();

      logger.info('Jedsign.service: createADCSDoc:Test 02');
      //let renderurl='https://tender-jennings-9050df.netlify.app';
      const renderurl = 'https://jrenderer.sandbox158.run/';
      logger.info('Jedsign.service: createADCSDoc:Test 02: renderurl: ' + renderurl);
      const issuers = {
        $template: {
          name: 'JEDTRADE_DEMO',
          type: 'EMBEDDED_RENDERER',
          url: renderurl,
        },
        name: 'ADCS Certificate',
        issuers: [
          {
            name: `${getCompanyName}`,
            individualName: `${getUserInfo.name}`,
            address1: `${getUserInfo.address1}`,
            address2: `${getUserInfo.address2}`,
            zipcode: `${getUserInfo.zipcode}`,
            country: `${getUserInfo.country}`,
            phoneNo: `${getUserInfo.mobileNo}`,
            documentStore: `${docStore}`,
            identityProof: {
              type: 'DNS-TXT',
              location: `${getDomain}`,
            },
            email: `${getUserEmail}`,
            walletAddress: `${getUserAddr}`,
          },
        ],
      };
      logger.info('Jedsign.service: createADCSDoc:Test 02: renderurl: ', issuers);
      const issuerPrivateKey = await getUserInfo.getPrivateKey();
      console.log(issuerPrivateKey);

      const valuesAlreadySeen = [];
      const studentArr = [];
      await this.web3Service.updateGasPrice();
      await Promise.all(
        ADCSDto.documents.map(async document => {
          const documentId = document['id'];
          if (valuesAlreadySeen.indexOf(documentId) !== -1) {
            throw new Error(`Duplicate ID - ${documentId}`);
          }
          valuesAlreadySeen.push(documentId);
          const findDocId = await this.documentModel.findOne({ documentId });
          if (findDocId != null) {
            throw new Error(`Document ID - ${documentId} already in use`);
          } else {
            const adcsDoc = { ...issuers, ...document };
            const documentId = document['id'];
            const adcsJSON = `${documentId}-ADCS.json`;
            const dictString = JSON.stringify(adcsDoc);
            const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
            const finalFile = `${folderPath}/${adcsJSON}`;
            fs.writeFileSync(finalFile, dictString);
            const bufferReadFile = fs.readFileSync(finalFile);
            const readFile = bufferReadFile.toString();
            rawJSONArr.push(JSON.parse(readFile));
            studentArr.push(document['recipient']);
          }
        }),
      );

      const filteredArr = studentArr.reduce((acc, current) => {
        const x = acc.find(item => item.studentId === current.studentId);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);
      logger.info('Jedsign.service: createADCSDoc:Test 03:');
      console.log('Jedsign.service: createADCSDoc:Test 03:');
      await Promise.all(
        filteredArr.map(async studentInfo => {
          const studentId = await this.studentModel.findOne({
            studentId: studentInfo.studentId,
          });
          if (studentId == null) {
            const name = `${studentInfo.name} ${studentInfo.lastName}`;
            const student = new this.studentModel({
              studentId: studentInfo.studentId,
              nric: studentInfo.nric,
              email: studentInfo.email,
              name,
              dob: studentInfo.dob,
              graduationDate: studentInfo.completionDate,
            });
            await student.save();
          }
        }),
      );
      const wrappedDocuments = wrapDocuments(rawJSONArr);
      //const workerCount = this.getWorkerCount(rawJSONArr.length);
      //console.log(`workerCount: ${workerCount}`);
      //const wrappedDocuments =
      // workerCount == 0
      //? wrapDocuments(rawJSONArr)
      // : await this.wrapDocuments(rawJSONArr, workerCount);
      // const merkleRootk = wrappedDocuments[0].signature.merkleRoot;
      //wrappedDocuments.forEach(d => d.signature.merkleRoot = merkleRootk);

      logger.info('Jedsign.service: createADCSDoc:Test 04:');
      console.log('Jedsign.service: createADCSDoc:Test 04:');
      let merkleRoot;
      const targetArr = [];
      await Promise.all(
        wrappedDocuments.map(async wrappedDoc => {
          const wrapDocInfo = JSON.stringify(wrappedDoc);
          const rawDocInfo = getData(wrappedDoc);
          const docInfo = JSON.stringify(rawDocInfo);
          const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
          const adcsJSON = `${rawDocInfo.id}-ADCS.json`;
          const finalFile = `${folderPath}/${adcsJSON}`;
          fs.writeFileSync(finalFile, wrapDocInfo);
          const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
          const docRoot = wrappedDoc['signature'].targetHash;
          const docName = `${rawDocInfo.id}-ADCS`;
          const docStore = rawDocInfo.issuers[0].documentStore;
          const name = `${rawDocInfo.recipient.name} ${rawDocInfo.recipient.lastName}`;

          const studentInfo = await this.studentModel.findOne({
            studentId: rawDocInfo.recipient.studentId,
          });

          //Save Doc Info to DB
          const doc = new this.documentModel({
            docHash: `0x${docRoot}`,
            issuerDocStore: docStore,
            docInfo,
            wrapDocInfo,
            docType: 'ADCS',
            documentId: rawDocInfo.id,
            completionDate: rawDocInfo.recipient.completionDate,
            studentId: studentInfo._id,
            issuedDate: 0,
            revokedDate: 0,
            isBatchRevoke: false,
          });
          await doc.save();

          const link = `https://jviewer.sandbox158.run/`;
          this.mailerService.sendADCS(
            rawDocInfo.recipient.email,
            link,
            name,
            issuers.issuers[0].name,
            rawDocInfo.id,
            docName,
            file,
          );

          console.log('docInfo', rawDocInfo);
          const docs = {
            docName,
            email: rawDocInfo.recipient.email,
            name,
            docHash: `0x${docRoot}`,
            documentId: rawDocInfo.id,
            completionDate: rawDocInfo.recipient.completionDate,
          };
          merkleRoot = `0x${wrappedDoc['signature'].merkleRoot}`;
          certArr.push(docs);
          targetArr.push(`0x${docRoot}`);
        }),
      );
      logger.info('Jedsign.service: createADCSDoc:Test 05:');
      console.log('Jedsign.service: createADCSDoc:Test 05:');
      //Save batch info to DB
      const batch = new this.batchesModel({
        issuerDocStore: docStore,
        documentBatch: targetArr,
        merkleRoot,
      });
      await batch.save();
      logger.info('Jedsign.service: createADCSDoc:Test 06:');
      console.log('Jedsign.service: createADCSDoc:Test 06:');
      //Issue Document
      const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
      const data = await contract.methods.issue(merkleRoot).encodeABI();
      const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');

      const rawTx = {
        nonce: web3.utils.toHex(nonce),
        gasPrice: web3.utils.toHex(
          (this.web3Service.gasPrice.average *
            (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
            100,
        ),
        to: docStore,
        gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
        value: web3.utils.toHex(web3.utils.toWei('0')),
        data: data,
      };
      logger.info('Jedsign.service: createADCSDoc:Test 07:');
      console.log('Jedsign.service: createADCSDoc:Test 07:');
      const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
      tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
      const serializedTx = tx.serialize();
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: `jedsign.service: createADCSDoc:  ${getUserEmail} : Before calling root_created`,
      });
      const rootData = { data: serializedTx.toString('hex'), email: getUserEmail };
      this.client.emit<any>('root_created', rootData);
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: `jedsign.service: createADCSDoc:   ${getUserEmail} : After calling root_created`,
      });
      web3.eth
        .sendSignedTransaction('0x' + serializedTx.toString('hex'))
        .on('receipt', console.log);
      logger.info('Jedsign.service: createADCSDoc:Test 08:');
      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;
      console.log('CreateADCS', duration);
      return { certArr };
    } catch (ex) {
      logger.info('Jedsign.service: createADCSDoc: Error: ', ex);
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: `jedsign.service: createADCSDoc: ${getUserEmail}: Error:   ${ex.message}`,
      });
      this.sendErrorToUser(getUserEmail, ex.message, 'Create ADCS Document');
      throw ex;
    }
  }

  async createDICTDoc(apiToken: string, DictDTO: DictDTO) {
    const certArr = [];
    const rawJSONArr = [];
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getCompanyName = getUserInfo.companyName;
    const getUserEmail = getUserInfo.email;
    const getUserAddr = getUserInfo.wallet.address;
    const getDomain = getUserInfo.domain;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const issuers = {
      $template: {
        name: 'JEDTRADE_DEMO',
        type: 'EMBEDDED_RENDERER',
        url: 'https://jrenderer.sandbox158.run/',
      },
      name: 'DICT Certificate',
      issuers: [
        {
          name: `${getCompanyName}`,
          individualName: `${getUserInfo.name}`,
          address1: `${getUserInfo.address1}`,
          address2: `${getUserInfo.address2}`,
          zipcode: `${getUserInfo.zipcode}`,
          country: `${getUserInfo.country}`,
          phoneNo: `${getUserInfo.mobileNo}`,
          documentStore: `${docStore}`,
          identityProof: {
            type: 'DNS-TXT',
            location: `${getDomain}`,
          },
          email: `${getUserEmail}`,
          walletAddress: `${getUserAddr}`,
        },
      ],
    };

    //console.log(getDomain);
    console.log(JSON.stringify(issuers, null, 2));

    const issuerPrivateKey = await getUserInfo.getPrivateKey();

    const valuesAlreadySeen = [];
    await this.web3Service.updateGasPrice();
    await Promise.all(
      DictDTO.documents.map(async document => {
        const documentId = document['id'];
        if (valuesAlreadySeen.indexOf(documentId) !== -1) {
          throw new Error(`Duplicate ID - ${documentId}`);
        }
        valuesAlreadySeen.push(documentId);
        const findDocId = await this.documentModel.findOne({ documentId });
        if (findDocId != null) {
          throw new Error(`Document ID - ${documentId} already in use`);
        } else {
          const dictDoc = { ...issuers, ...document };
          const documentId = document['id'];
          const dictJSON = `${documentId}-DICT.json`;
          const dictString = JSON.stringify(dictDoc);
          const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
          const finalFile = `${folderPath}/${dictJSON}`;
          fs.writeFileSync(finalFile, dictString);
          const bufferReadFile = fs.readFileSync(finalFile);
          const readFile = bufferReadFile.toString();
          rawJSONArr.push(JSON.parse(readFile));

          console.log(JSON.stringify(dictDoc, null, 2));
        }
      }),
    );

    const wrappedDocuments = wrapDocuments(rawJSONArr);

    let merkleRoot;
    const targetArr = [];
    await Promise.all(
      wrappedDocuments.map(async wrappedDoc => {
        const wrapDocInfo = JSON.stringify(wrappedDoc);
        const rawDocInfo = getData(wrappedDoc);
        const docInfo = JSON.stringify(rawDocInfo);
        const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
        const dictJSON = `${rawDocInfo.id}-DICT.json`;
        const finalFile = `${folderPath}/${dictJSON}`;
        fs.writeFileSync(finalFile, wrapDocInfo);
        const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
        const docRoot = wrappedDoc['signature'].targetHash;
        const docName = `${rawDocInfo.id}-DICT`;
        const docStore = rawDocInfo.issuers[0].documentStore;
        const name = `${rawDocInfo.recipient.name} ${rawDocInfo.recipient.lastName}`;

        //Save Student Info to DB
        const studentId = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });
        if (studentId == null) {
          const student = new this.studentModel({
            studentId: rawDocInfo.recipient.studentId,
            nric: rawDocInfo.recipient.nric,
            email: rawDocInfo.recipient.email,
            name,
            dob: rawDocInfo.recipient.dob,
            graduationDate: rawDocInfo.recipient.completionDate,
          });
          await student.save();
        }

        const studentInfo = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });

        //Save Doc Info to DB
        const doc = new this.documentModel({
          docHash: `0x${docRoot}`,
          issuerDocStore: docStore,
          docInfo,
          wrapDocInfo,
          docType: 'DICT',
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
          studentId: studentInfo._id,
          issuedDate: 0,
          revokedDate: 0,
          isBatchRevoke: false,
        });
        await doc.save();

        const link = `https://jviewer.sandbox158.run/`;
        this.mailerService.sendDICT(
          rawDocInfo.recipient.email,
          link,
          name,
          issuers.issuers[0].name,
          rawDocInfo.id,
          docName,
          file,
        );

        this.usersService.etherCheck(getUserAddr);

        const docs = {
          docName,
          email: rawDocInfo.recipient.email,
          name,
          docHash: `0x${docRoot}`,
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
        };
        merkleRoot = `0x${wrappedDoc['signature'].merkleRoot}`;
        certArr.push(docs);
        targetArr.push(`0x${docRoot}`);
      }),
    );

    //Save batch info to DB
    const batch = new this.batchesModel({
      issuerDocStore: docStore,
      documentBatch: targetArr,
      merkleRoot,
    });
    await batch.save();

    //Issue Document
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const data = await contract.methods.issue(merkleRoot).encodeABI();
    const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');

    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: docStore,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
    tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
    const serializedTx = tx.serialize();
    web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')); //.on('receipt', console.log);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    //console.log('CreateDICT', duration);
    return { certArr };
  }

  async createhcpcrDoc(apiToken: string, HCPCRDTO: HCPCRDTO) {
    const certArr = [];
    const rawJSONArr = [];
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getCompanyName = getUserInfo.companyName;
    const getUserAddr = getUserInfo.wallet.address;

    const getDomain = getUserInfo.domain;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );

    const docStore = await factoryContract.methods.assets(getUserAddr).call();

    const issuers = {
      issuers: [
        {
          name: `${getCompanyName}`,
          documentStore: `${docStore}`,
          identityProof: {
            type: 'DNS-TXT',
            location: `${getDomain}`,
          },
        },
      ],
      $template: {
        name: 'HEALTH_CERT',
        type: 'EMBEDDED_RENDERER',
        url: 'https://healthcert.renderer.moh.gov.sg/',
      },
    };

    const issuerPrivateKey = await getUserInfo.getPrivateKey();

    const valuesAlreadySeen = [];
    await this.web3Service.updateGasPrice();

    const key = '2b1236683c3a842ed4a0bb032c1cf668e24bcaf8ce599aeef502c93cb628152c';
    const ttl = '1624170562596';

    await Promise.all(
      HCPCRDTO.documents.map(async document => {
        const documentId = document['transcriptId'];
        const reference = document['reference'];
        const notarisedOn = document['notarisedOn'];
        const passportNumber = document['passportNumber'];

        const encodeduri = encodeURIComponent(
          `{"type":"DOCUMENT","payload":{"uri":"https://jedtrade-eugene.github.io/${reference}-HCPCR.json","key":"${key}"}}`,
        );

        console.log(`https://dev.opencerts.io/?q=${encodeduri}`);

        const qrcosde = {
          notarisationMetadata: {
            reference: reference,
            notarisedOn: notarisedOn,
            passportNumber: passportNumber,
            url: `https://dev.opencerts.io/?q=${encodeduri}`,
          },
          logo:
            'data:image/png;base64,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',
          attachments: [
            {
              filename: 'healthcert.txt',
              type: 'text/open-attestation',
              data:
                'eyJ2ZXJzaW9uIjoiaHR0cHM6Ly9zY2hlbWEub3BlbmF0dGVzdGF0aW9uLmNvbS8yLjAvc2NoZW1hLmpzb24iLCJkYXRhIjp7ImlkIjoiOWJhZjQ4MWQtNjJjNy00NjEzLWE2MGYtYmM4ZTljMjk3NjQwOnN0cmluZzpURVNUMDAxIiwibmFtZSI6IjYxYWM0ZTY3LWQ5ZDgtNDMyMi1iYWI4LWE5MTI4ZjBjY2ZhZDpzdHJpbmc6SGVhbHRoQ2VydCIsInZhbGlkRnJvbSI6IjM1NTc3NTg0LTk3NDAtNDRjOC1iMDdiLThhMzU0NTkyMDNhMDpzdHJpbmc6MjAyMS0wNS0xOFQwNjo0MzoxMi4xNTJaIiwiZmhpclZlcnNpb24iOiI5ODQ2M2NjNC1mNGViLTQxN2QtOTY1ZC05MzUxMjBkOTFmMGU6c3RyaW5nOjQuMC4xIiwiZmhpckJ1bmRsZSI6eyJyZXNvdXJjZVR5cGUiOiI3ZGViN2QwOS1kNmIyLTRlMDMtOGY1Yy04MTE4NGViNzYyNWE6c3RyaW5nOkJ1bmRsZSIsInR5cGUiOiI0Y2ZmOTAyMy0xYjdlLTRkODEtYjJhNS03M2UzOGM4Zjg5N2U6c3RyaW5nOmNvbGxlY3Rpb24iLCJlbnRyeSI6W3sicmVzb3VyY2VUeXBlIjoiZDFlOGUwMWItN2Q5MS00ZDI5LWIyMzgtYTkzNWYwMjIyZmY3OnN0cmluZzpQYXRpZW50IiwiZXh0ZW5zaW9uIjpbeyJ1cmwiOiI1YmUwNGI1Zi0wMzkwLTQxZmItOGFmOC01NmY5MGM0Mzg3NmM6c3RyaW5nOmh0dHA6Ly9obDcub3JnL2ZoaXIvU3RydWN0dXJlRGVmaW5pdGlvbi9wYXRpZW50LW5hdGlvbmFsaXR5IiwiY29kZSI6eyJ0ZXh0IjoiYmYzNDA3YmMtNjU1Mi00YzhiLWI5YzItYzc2YTRmOGU1OTRlOnN0cmluZzpTRyJ9fV0sImlkZW50aWZpZXIiOlt7InR5cGUiOiI4OTZmZjc1Ni03ODY0LTQyYjQtYTQ1Ny1mMjNlM2U5MTZkNmY6c3RyaW5nOlBQTiIsInZhbHVlIjoiMjY0OGNhOGItYWE2Yy00M2I4LTlhMWItYjU1NDg0MGEyN2Q0OnN0cmluZzpFNzgzMTE3N0cifSx7InR5cGUiOnsidGV4dCI6ImUxYzMxY2RiLTdmMTEtNGRlNy1hZTZjLWE2MTk2NmIyYWVhZDpzdHJpbmc6TlJJQyJ9LCJ2YWx1ZSI6IjJhNDVjZDFhLTQzOTUtNGVjMS1hM2EzLWUzNGY0NjdiMzBhYzpzdHJpbmc6UzkwOTg5ODlaIn1dLCJuYW1lIjpbeyJ0ZXh0IjoiZTk0OTIxNzctZDg3ZC00NzU1LTk5YWQtNTk3ZjRjOTFjZGI3OnN0cmluZzpUYW4gQ2hlbiBDaGVuIn1dLCJnZW5kZXIiOiI3YmMxNTY1My1hMjJmLTQyMmEtODk3ZS01ZjA2NzI4MjdhYjI6c3RyaW5nOmZlbWFsZSIsImJpcnRoRGF0ZSI6IjA4NGZhNGE3LTAzZTQtNDJmYS1iMDQwLTYyNjk4ZTVjNjIwODpzdHJpbmc6MTk5MC0wMS0xNSJ9LHsicmVzb3VyY2VUeXBlIjoiYzZkNmVjNmEtZjIzNi00OWY3LWJmYjktN2Y4NTVhN2FkNDI1OnN0cmluZzpTcGVjaW1lbiIsInR5cGUiOnsiY29kaW5nIjpbeyJzeXN0ZW0iOiIwZjFiMWE3OS00MzJhLTQ1OTEtOWM1YS1iNWZlZmNkMjVkNTA6c3RyaW5nOmh0dHA6Ly9zbm9tZWQuaW5mby9zY3QiLCJjb2RlIjoiYmExMzJjZDktZTkyNy00OTM4LWE3MDQtYmNlMWQ0NzdjZDgzOnN0cmluZzoyNTg1MDAwMDEiLCJkaXNwbGF5IjoiZmRhMmU4MTYtNzc0Mi00ZDQzLWI2OTctNTFiNzRkOGZmNDhlOnN0cmluZzpOYXNvcGhhcnluZ2VhbCBzd2FiIn1dfSwiY29sbGVjdGlvbiI6eyJjb2xsZWN0ZWREYXRlVGltZSI6IjI0MzRjMDIyLTA0NDctNGFmMS05YWMzLWU0ZjMzOWU3NzZjODpzdHJpbmc6MjAyMC0wOS0yN1QwNjoxNTowMFoifX0seyJyZXNvdXJjZVR5cGUiOiI3ODc1NjlmNy1iMGJmLTRmYWMtYWY3My1hNjhlYmExMjk4NWU6c3RyaW5nOk9ic2VydmF0aW9uIiwiaWRlbnRpZmllciI6W3sidmFsdWUiOiI1NjIzYzk3My1hYmE1LTQyM2UtYWUyZi1jOTRlZmRhODkyNGQ6c3RyaW5nOjEyMzQ1Njc4OSIsInR5cGUiOiI1Mjg0ZTJhMS0wMTYzLTQwNTktOWNlYS1mNTk3NzlkZmJkMGI6c3RyaW5nOkFDU04ifV0sImNvZGUiOnsiY29kaW5nIjpbeyJzeXN0ZW0iOiJlNmIxZjNjMS1lN2U1LTQ2ZTktYTM3Mi1mYjliNmFjYjc1MGQ6c3RyaW5nOmh0dHA6Ly9sb2luYy5vcmciLCJjb2RlIjoiZjJiYWVlODUtMThhYi00YzMyLWJlZTItMTRlNzUzZjNiYmY2OnN0cmluZzo5NDUzMS0xIiwiZGlzcGxheSI6ImMxMzE4ZjkyLTc4YzUtNDM3OC1iZTg4LTE4NzQ2YjFhZDM0ODpzdHJpbmc6UmV2ZXJzZSB0cmFuc2NyaXB0aW9uIHBvbHltZXJhc2UgY2hhaW4gcmVhY3Rpb24gKHJSVC1QQ1IpIHRlc3QifV19LCJ2YWx1ZUNvZGVhYmxlQ29uY2VwdCI6eyJjb2RpbmciOlt7InN5c3RlbSI6IjkyMTA3NGE1LTQ2OGYtNGVkMC04MGUyLTMyNmM5ODA5OTJmYzpzdHJpbmc6aHR0cDovL3Nub21lZC5pbmZvL3NjdCIsImNvZGUiOiI4NmFjNDk2ZS00MmI0LTRjMmMtOWZjMy0xNGNiZjUzYTQyYjI6c3RyaW5nOjI2MDM4NTAwOSIsImRpc3BsYXkiOiI4YjA2OWYzOC1iZTQyLTRkYmYtYWVlOS0yNTRjOWVjNGM0ODM6c3RyaW5nOk5lZ2F0aXZlIn1dfSwiZWZmZWN0aXZlRGF0ZVRpbWUiOiI3MWM1ZjM5Yy03YmE2LTRjYzUtYjkxOS03Zjk5ZDgyOTA1ZjQ6c3RyaW5nOjIwMjAtMDktMjhUMDY6MTU6MDBaIiwic3RhdHVzIjoiNGUyMjZkNDMtZTNmMi00YWExLTk4NzItMWEyYmMzZDdlZGE4OnN0cmluZzpmaW5hbCIsInBlcmZvcm1lciI6eyJuYW1lIjpbeyJ0ZXh0IjoiMzNjNmYzZTQtOGY0ZS00NmFkLWJlNzMtY2FmYjNmZTI3YTI5OnN0cmluZzpEciBNaWNoYWVsIExpbSJ9XX0sInF1YWxpZmljYXRpb24iOlt7ImlkZW50aWZpZXIiOiI3Yzg0NjUzZC00YjYzLTRhMjUtODJhZS1lOGUyNjE3NjQ2ZTk6c3RyaW5nOk1DUiAxMjMyMTQiLCJpc3N1ZXIiOiIxNzk4YmVkNC1kY2FjLTQwNmYtOTQyOC05NTgyMDVjYzk1MzU6c3RyaW5nOk1PSCJ9XX0seyJyZXNvdXJjZVR5cGUiOiJkN2E5MDMzNy0xYTdhLTRkNWQtYTAzZC03Nzk0ZTE1ZmQ3ODk6c3RyaW5nOk9yZ2FuaXphdGlvbiIsIm5hbWUiOiI1YTFhOTExNC1kZWE3LTQ2MGItYWNiZS04NWFmNjEzNzNmY2E6c3RyaW5nOk1hY1JpdGNoaWUgTWVkaWNhbCBDbGluaWMiLCJ0eXBlIjoiYWU0YmU1M2QtYzU0Yi00NzZhLWI1NTgtOWM5ZjE3NDk2N2ZmOnN0cmluZzpMaWNlbnNlZCBIZWFsdGhjYXJlIFByb3ZpZGVyIiwiZW5kcG9pbnQiOnsiYWRkcmVzcyI6IjU4NTFjODY0LTA1ZTItNDYxZi05MTBhLTc0Y2FhOWNiNDQ5YjpzdHJpbmc6aHR0cHM6Ly93d3cubWFjcml0Y2hpZWNsaW5pYy5jb20uc2cifSwiY29udGFjdCI6eyJ0ZWxlY29tIjpbeyJzeXN0ZW0iOiJmYzliZWQwYS1hYTNmLTQyMjUtYTdmYS00MzU5ZTJiNDAxMjQ6c3RyaW5nOnBob25lIiwidmFsdWUiOiJlOTZjZWEwNy0yZjE5LTQyMDMtOTg4ZC0zNzUwMjM3N2E3ZTU6c3RyaW5nOis2NTYzMTEzMTExIn1dLCJhZGRyZXNzIjp7InR5cGUiOiIwYTQ5OTA5Ni1jNDRkLTRkMmEtYmJkYi03ODM0YjI5ZjQ2ZGU6c3RyaW5nOnBoeXNpY2FsIiwidXNlIjoiOTQ5ZTUxM2QtYThmMS00ZWVlLTkwOWEtMDhjZTBlMWI3NDllOnN0cmluZzp3b3JrIiwidGV4dCI6IjQ5ODZiMTRmLWViODUtNDdhMy1iNzRlLTYxMWFmZDg0ZWUxZTpzdHJpbmc6TWFjUml0Y2hpZSBIb3NwaXRhbCBUaG9tc29uIFJvYWQgU2luZ2Fwb3JlIDEyMzAwMCJ9fX0seyJyZXNvdXJjZVR5cGUiOiI4YTE4MmQ5YS1hMDZhLTQ0MDItOWMyOC02YjQzMTRiZjY5ODU6c3RyaW5nOk9yZ2FuaXphdGlvbiIsIm5hbWUiOiJhMjZjNTY5NC0xYjg3LTRlMDItYmJlYi0wY2ZiYTM2YmM4ODc6c3RyaW5nOk1hY1JpdGNoaWUgTGFib3JhdG9yeSIsInR5cGUiOiIzMTdkZDJiNS02YThhLTQwZGItODM4Yi0zNDc5ZmVjZDM0NTI6c3RyaW5nOkFjY3JlZGl0ZWQgTGFib3JhdG9yeSIsImNvbnRhY3QiOnsidGVsZWNvbSI6W3sic3lzdGVtIjoiMjc1ZDYwYjUtOTk1OC00ZGJjLTg1MzUtZjExMDVjNDJhNjVmOnN0cmluZzpwaG9uZSIsInZhbHVlIjoiMjVjYTE3ODEtMDhkMS00NmYyLWFmZDUtZWUwY2U5OTExY2YzOnN0cmluZzorNjU2MjcxMTE4OCJ9XSwiYWRkcmVzcyI6eyJ0eXBlIjoiZTNmMGFkODQtZDFjMC00MDM4LTk1ZTctNGRlYzQ3YWY2ZmJjOnN0cmluZzpwaHlzaWNhbCIsInVzZSI6ImE1Yjg3ZGU0LTgyMjQtNDU0Zi1iNThkLWUyYWZkMzA5OGI2MTpzdHJpbmc6d29yayIsInRleHQiOiI0ODM4M2Q3MC1jNmU2LTRkNjUtYmRjMi03YTU0MjNjM2IyMWE6c3RyaW5nOjIgVGhvbXNvbiBBdmVudWUgNCBTaW5nYXBvcmUgMDk4ODg4In19fV19LCJpc3N1ZXJzIjpbeyJpZCI6IjZlNTdkYzZhLTRlZWEtNGE1NC04OTg2LWFkZWVhNzExZTEwMzpzdHJpbmc6ZGlkOmV0aHI6MHhFMzk0Nzk5MjhDYzRFZkZFNTA3NzQ0ODg3ODBCOWY2MTZiZDRCODMwIiwicmV2b2NhdGlvbiI6eyJ0eXBlIjoiMDM2Nzc5MGQtNjQzYy00YTA2LWJkYjMtNjM4YmZkMjE2Yzk4OnN0cmluZzpOT05FIn0sIm5hbWUiOiI3MDQ0OTljMC02ZjM4LTRjZmQtODQxMC0wM2Q0N2UyNDA1ZTY6c3RyaW5nOlNBTVBMRSBDTElOSUMiLCJpZGVudGl0eVByb29mIjp7InR5cGUiOiI5OWM4MTQwNy05MmI0LTRhMDctODFkMC0wZDdjZDc3YTJhNWM6c3RyaW5nOkROUy1ESUQiLCJsb2NhdGlvbiI6ImQwMGRhYjhmLTJmM2EtNDE4Mi05ODAyLWRmMDE1ZGM2YmIwYjpzdHJpbmc6ZG9ub3R2ZXJpZnkudGVzdGluZy52ZXJpZnkuZ292LnNnIiwia2V5IjoiMmNiMDA1NjEtOGJhNy00MTI4LWExYzMtMTdlMGRmZjBkZDgwOnN0cmluZzpkaWQ6ZXRocjoweEUzOTQ3OTkyOENjNEVmRkU1MDc3NDQ4ODc4MEI5ZjYxNmJkNEI4MzAjY29udHJvbGxlciJ9fV0sImxvZ28iOiJmZmRhZTk0MS1iNmUwLTQyYzctOTJhMS0yOGE3Mjg1NGU3ZDQ6c3RyaW5nOmRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb0FBQUFOU1VoRVVnQUFBZlFBQUFESUNBTUFBQUFweCtQYUFBQUFNMUJNVkVVQUFBRE16TXpNek16TXpNek16TXpNek16TXpNek16TXpNek16TXpNek16TXpNek16TXpNek16TXpNek16TXpNek16TXplQ21pQUFBQUFFSFJTVGxNQVFMK0E3eEFnbjJEUDN6QndyMUNQRWwrSS9RQUFCd2RKUkVGVWVOcnNuZDEyMnlvUVJ2a0hJU0hOK3ovdHlVazlvVEVDUTFiVEJjMjNieU5zMEI1R0lEQVJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBaytJaytJZHg0ZzVONEI5R1EvclBBOUovSVBmU2d3TC9NRUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRHdQNVpQb1A1cjdGSktBZjdjdWZCaWhQTlNrWDVobEE5dStEc1A3ZFgvSksxUDJWUGlTSW9lYkVyTHdWaDVaeCs4QzFZMjJZdFAwRnBmNmhkZWErbXExV2xpeGZlajZSY0R4ajA5c3dYYmJlQlFwaWp1ZzIwYWovU0U4YnZvNWhFdWF2QXVTS3BRZkp4VEc5MWdVckNWNmpTUUUwb1BrZTR3dWtlNzA1RXFwTE5XeHRNdFNrNGp2WEdsZCt0TGx4dlZNTm5ha0Q3bUVuZFlUVldTblY4NjBXVVhsMzRSTXk3QmVtcHlHek43cEFibVhFQTZiZnZLMHUzMnVURktLVk0wcjBZdzFNVGNGdnA4aVZMUEQwKzlnSFF5KzdyU2YzZWVqcDJIdUZjc21sZGlFejBGektYZlNSdzNxZTA4WHFkOWRQNlFLT05ua3U0bEczTlNiL1JCdEt0S3QxdHRkQkppWWIyVkk3YnJjN3RjOElZb3RKekhVQjBjK08rVDNyVFF1TEtzWlJxcHprVFM3ZFpJNHZvK3FKbmRFR084RXplY3lqYWM2L0lUTjJLT1dhVUxJVC9hTGRlVW5xcGRpN1ZXMitLeWMyOUZMM3M3ZTNoaTVMVFNoZVdXcHlXbEg0WHptdldqbmlPaUZOM1lXRGl2V0k5Mld1azVjdDJDMHAzSnpsOVlONjZXSTVJVi9WeUY4NnIxYTE3cEg1VU1DMHBYL0R3WFZVNTI0S3M1WWdEWm1MNHpHejF3ODBwMzNQajFwTXZjaSt0YzJjRklqbWhIMmRXVmZ1YVZMdUxqeTllVHpncU9ycWV3djB2dW0vMUtSNCsyYTZEaDVwWE83VjlPK3M0S1JKUEFEdXhOanRqRkNDay9DbHRFemdmelN0ZXJTdmRaUVplRG95eXF4UWd1UjFsWG1CbEkvOVBTZWJacGJPZThiaXZ0MmJGSzlZYUs0ZUhlN05MTmF0TFAzcUdZTGZMNzFSb012QjZYdTk2SjNUV3Q5TFRvUU01em04WWZ4YkhJRVNQWlhYVy90b3ZUU28rUHFGeE5lc3dacWpPL1gwOU92QmdpOU9jSHc3bGxVdWtjditkaTBybmVxZjk5dVhvS2dsTU13YWxsN3gvbXkwbWxQNXBpVm52M2Z1WisxOTN4bnBUWUx6M1NqZWpQTFhwTzZUdFhielhwZklVY2VKSG1Qc1hBSnNiSSthTDdmdnNwcFZzT1g3dWFkSjlGdnVUNjNQeHNaQVEzVU14eWdMeVd2c2s2L2x1a3U0MGZiOHR0b2xERkZiMVpRUTYvbVJrdjFpVzlpMUo2Qy8xYWVqQWN2UVBWbVV0NkZCMmNuMjZKekRPNFRzYUxjV2VhVGJvN0luMDRYMDg2OTZYeFRucmttekdDSGltbUpwTHVOYVBpNzFmK0tPa3RlNUlLOU9yUzc0aW5nUFNmSmQxb0lTRDlaMG0vaFBoQjBvKy9MZDNNTUdVclNVNjhzOXlVelhTTzNzdWhXK0JoK0pqMG95ejJzblpxZ3BjemQ1aXdwdlJ2bUtmWHBZL1AweWVTZnNnSE9obGl3dExTN2NCU2lSMWFaRlAzMHErQnQzZlhiSzloUTJUcis0clNjKzhkZmxYQ08ybDZwWStQSXM1cEYxeHM0a21iWFZCNnowSldSUmRIKzZCMHc4VmVveWRlV2xWODR4YVVMbnZYMDh2RXpObitISk91K3RmVDFjU2JLUExld3ZXa2MvYzEvWXRzNFNsSitESHB1bnNGMzA2OVhTcnc3VmhRZWw0Z0hOM1F1SE84akVrL084Y0MrVW8vcFhSK3ZHMExTbi9aWHhsWHlJb2M2MFBTaGVsZHd2ZHpiNEhXM0k3MXBPLzB3SFlxT0lwOHY0MUpUNTJUTmpmNWp4MjRmbUU5NldMckc3L2Jzb002ZWhDR3BKOHMwL1pWM2s4cW5UT2RYMUI2NkhPZ2I0YjVLUmZ0bDU0ZkM3b3Z5dlpacFh0Nkp5NG8zWnFlZE92TVRkc2xQVWhEMHJsV3h2Vk1GdFMwUDFVT25QdldrODRYZGIwRElYVy9rSGlNU0xlbTdyTU1LRG10OUowSG1ndEsvM0JnN0doZ09HTENnUFQ4YWZwMXBkVEV4NDg4Nm5ndEtGMmM5T3BzZ1ZEYk9LQ0pPUWFraSsxVnJGaSt3cmlKcGZOYS9vclNoY3JXMjg2akxZc3l5ZlpMbDhTRXRuTTY1ajFTTEgrd1hWRzZqYzBEWUk5ODZGdWpLSm5RTFYwYzFNcnc3c081bi9md3dEZmtvajlnZkQ0b3poeUZBVVZNcUJSbFlyQ2Qwb1VuUnJraXlFek9QRk5MRnpUelQ1VmxCWGQzT204b3prQnRPT2REUFprVTlrOS9QQ3BMa0hhcm5aVWZJaFhPdjAvNklTdjBTT2N2ai8xYjl0emZrTjVHM3g3ZWJkSWgzNFdmRjZ0cERycllLNlBVcGQvNGZKUzNicFhhcnRPSk4rU1JEQlhPdjBsNm02RXpaMXozNWx3OWszUk8wMVdNRkJVNEg0KzIxbE1iYjhYczB2bHZZVkhwM1BVcUtDY2FPRFVzbmJOTFNSNWNUQytkWitwcFZlbENuS2ExMTdlTlROUWtTVkZpVTJ0UCtRclNPVnZaWmFVTHF3dnRQQ2gvamRNYjNSTjk5UU9rb2p2OExzUVMway9PNyt0S2YrTk1UOTZOUDBVdkx2aW5SbTlKbjI0d1ZyYkRDYkdJZEY0eFZCTkoveEpTZTZVZW8vQmovOUkvN0R5MFB2cm5KeTVvcFNJUlJaWDBhUVVBQVB6WDNoM1VBQUNBUUF4N1lBRC9hbkZCQ05kYW1JQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQURBbW1vZUs5SHppQjVJOUVCWG54OEFBQUFBQUFBQUFMQm1BSVpLbXpXSW54eU9BQUFBQUVsRlRrU3VRbUNDIiwiJHRlbXBsYXRlIjp7Im5hbWUiOiI1NjhhNjdiNC0zNzhjLTQ5MjgtYjNhNi05NDc2ZDcxYjBhOWU6c3RyaW5nOkhFQUxUSENFUlQiLCJ0eXBlIjoiMWZlNTlmNmMtODhlNC00MTUzLTg1NjgtMzAwOTU5ZDZiNzlhOnN0cmluZzpFTUJFRERFRF9SRU5ERVJFUiIsInVybCI6ImZhZThkMGJkLTExMWQtNGNjNC1hZGUzLWYyMDhlMjRhNTFiOTpzdHJpbmc6aHR0cHM6Ly9tb2gtaGVhbHRoY2VydC1yZW5kZXJlci5uZXRsaWZ5LmFwcC8ifX0sInNpZ25hdHVyZSI6eyJ0eXBlIjoiU0hBM01lcmtsZVByb29mIiwidGFyZ2V0SGFzaCI6IjBjOTIwYTEzNmZhODc3YjkzMzNmYjYyOWFjNmY2YjU0ZTAyODc5OWY2NzVkNTAxYjE3YzM1MjVlZGY1NDZkZDEiLCJwcm9vZiI6W10sIm1lcmtsZVJvb3QiOiIwYzkyMGExMzZmYTg3N2I5MzMzZmI2MjlhYzZmNmI1NGUwMjg3OTlmNjc1ZDUwMWIxN2MzNTI1ZWRmNTQ2ZGQxIn0sInByb29mIjpbeyJ0eXBlIjoiT3BlbkF0dGVzdGF0aW9uU2lnbmF0dXJlMjAxOCIsImNyZWF0ZWQiOiIyMDIxLTA1LTE5VDAzOjA5OjQxLjIyN1oiLCJwcm9vZlB1cnBvc2UiOiJhc3NlcnRpb25NZXRob2QiLCJ2ZXJpZmljYXRpb25NZXRob2QiOiJkaWQ6ZXRocjoweEUzOTQ3OTkyOENjNEVmRkU1MDc3NDQ4ODc4MEI5ZjYxNmJkNEI4MzAjY29udHJvbGxlciIsInNpZ25hdHVyZSI6IjB4NzMwOTFlZjE2MjI2MzIyYzIxMDgyZmI2YWU3MjQzZTJkMDZjMWNhNzVjZTAxZDA5MDQ5YWI5ODQyNjcwNzdiMzY2Mzk3OWFiYWZkZWZlZjllMjNjMzRlOThlZDkyZjM2NDM4N2M1ZjZhYmIzZjk1YzBjYjE3MGE4ZTJhODJhODcxYyJ9XX0=',
            },
          ],
        };

        if (valuesAlreadySeen.indexOf(documentId) !== -1) {
          throw new Error(`Duplicate ID - ${documentId}`);
        }

        valuesAlreadySeen.push(documentId);
        const findDocId = await this.documentModel.findOne({ documentId });
        if (findDocId != null) {
          throw new Error(`Document ID - ${documentId} already in use`);
        } else {
          const hcpcrDoc = { ...document, ...issuers, ...qrcosde };
          const documentId = document['id'];

          const hcpcrJSON = `${documentId}-HCPCR.json`;
          const dictString = JSON.stringify(hcpcrDoc);
          //const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
          //const finalFile = `${folderPath}/${hcpcrJSON}`;

          const finalFile = `C:/Users/Eugen/Desktop/healthcert-raw-document/${hcpcrJSON}`;
          fs.writeFileSync(finalFile, dictString);
          const bufferReadFile = fs.readFileSync(finalFile);
          const readFile = bufferReadFile.toString();
          rawJSONArr.push(JSON.parse(readFile));
        }
      }),
    );

    const wrappedDocuments = wrapDocuments(rawJSONArr);

    console.log(wrappedDocuments);

    let merkleRoot;
    const targetArr = [];
    await Promise.all(
      wrappedDocuments.map(async wrappedDoc => {
        const wrapDocInfo = JSON.stringify(wrappedDoc);
        const rawDocInfo = getData(wrappedDoc);
        const docInfo = JSON.stringify(rawDocInfo);
        //const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
        const hcpcrJSON = `${rawDocInfo.id}-HCPCR.json`;
        //const finalFile = `${folderPath}/${hcpcrJSON}`;

        const finalFile = `C:/Users/Eugen/Desktop/healthcert-wrap-document/${hcpcrJSON}`;

        fs.writeFileSync(finalFile, wrapDocInfo);

        const encDoc = encryptString(wrapDocInfo, key);
        //console.debug(encDoc);

        const decDoc = decryptString(encDoc);
        //console.debug(decDoc);

        const ouFileName = 'C:/Users/Eugen/Desktop/jedtrade-Eugene.github.io/' + hcpcrJSON;

        const outputStr =
          '{' +
          '"cipherText":"' +
          encDoc.cipherText +
          '",' +
          '"iv":"' +
          encDoc.iv +
          '",' +
          '"tag":"' +
          encDoc.tag +
          '",' +
          '"type":"' +
          encDoc.type +
          '",' +
          '"ttl":' +
          ttl +
          '}';

        console.log(outputStr);

        fs.writeFile(ouFileName, outputStr, function(err) {
          if (err) {
            return console.error(err);
          }
          console.log('Encrypted Doc written to [' + ouFileName + '] successfully!');
        });

        const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
        const docRoot = wrappedDoc['signature'].targetHash;
        const docName = `${rawDocInfo.id}-HCPCR`;
        const docStore = rawDocInfo.issuers[0].documentStore;
        const name = `${rawDocInfo.fhirBundle.patientFirstName} ${rawDocInfo.fhirBundle.patientLastName}`;

        //Save Student Info to DB

        const patientId = await this.studentModel.findOne({
          patientId: rawDocInfo.patientId,
        });

        const dobUnix = new Date(rawDocInfo.fhirBundle.entry[0].birthDate).getTime() / 1000;
        const effectiveDateUnix =
          new Date(rawDocInfo.fhirBundle.entry[0].birthDate).getTime() / 1000;
        const collectedDateUnix =
          new Date(rawDocInfo.fhirBundle.entry[1].collection.collectedDateTime).getTime() / 1000;

        if (patientId == null) {
          const patient = new this.studentModel({
            patientId: rawDocInfo.patientId,
            patientNRIC: rawDocInfo.fhirBundle.entry[0].identifier[1].value,
            patientEmail: rawDocInfo.patientEmail,
            patientName: rawDocInfo.fhirBundle.entry[0].name[0].text,
            gender: rawDocInfo.fhirBundle.entry[0].gender,
            patientPPN: rawDocInfo.fhirBundle.entry[0].identifier[0].value,
            nationally: rawDocInfo.fhirBundle.entry[0].extension[0].code.text,
            dob: dobUnix,
            effectiveDate: effectiveDateUnix,
          });

          await patient.save();
        }

        const patientInfo = await this.studentModel.findOne({
          patientId: rawDocInfo.patientId,
        });

        //Save Doc Info to DB
        const doc = new this.documentModel({
          docHash: `0x${docRoot}`,
          issuerDocStore: docStore,
          docInfo,
          wrapDocInfo,
          merkleRoot: wrappedDoc.signature.merkleRoot,
          docType: 'HCPCR',
          documentId: rawDocInfo.transcriptId,
          patientId: patientInfo._id,
          patientFirstName: rawDocInfo.patientFirstName,
          patientLastName: rawDocInfo.patientLastName,
          patientEmail: rawDocInfo.patientEmail,
          patientTKC: rawDocInfo.fhirBundle.entry[1].type.coding[0].code,
          patientTKN: rawDocInfo.fhirBundle.entry[1].type.coding[0].display,
          collectedDate: collectedDateUnix,
          effectiveDate: effectiveDateUnix,
          resultCode: rawDocInfo.fhirBundle.entry[2].valueCodeableConcept.coding[0].code,
          result: rawDocInfo.fhirBundle.entry[2].valueCodeableConcept.coding[0].display,
          performer: rawDocInfo.fhirBundle.entry[2].performer.name[0].text,
          identifier: rawDocInfo.fhirBundle.entry[2].qualification[0].identifier,
          clinicName: rawDocInfo.fhirBundle.entry[3].name,
          officeAdd: rawDocInfo.fhirBundle.entry[3].endpoint.address,
          officeNo: rawDocInfo.fhirBundle.entry[3].contact.telecom[0].value,
          webAdd: rawDocInfo.fhirBundle.entry[3].endpoint.address,
          labName: rawDocInfo.fhirBundle.entry[3].name,
          labAdd: rawDocInfo.fhirBundle.entry[4].contact.address.text,
          labNo: rawDocInfo.fhirBundle.entry[4].contact.telecom[0].value,
          issuedDate: 0,
          revokedDate: 0,
          isBatchRevoke: false,
        });

        await doc.save();

        // const link = `https://jviewer.sandbox158.run/`;
        // this.mailerService.sendDICT(
        //   rawDocInfo.recipient.email,
        //   link,
        //   name,
        //   issuers.issuers[0].name,
        //   rawDocInfo.id,
        //   docName,
        //   file,
        // );

        this.usersService.etherCheck(getUserAddr);

        const docs = {
          docName,
          //email: rawDocInfo.recipient.email,
          name,
          docHash: `0x${docRoot}`,
          //documentId: rawDocInfo.id,
          //completionDate: rawDocInfo.recipient.completionDate,
        };
        merkleRoot = `0x${wrappedDoc['signature'].merkleRoot}`;
        certArr.push(docs);
        targetArr.push(`0x${docRoot}`);
      }),
    );

    //Save batch info to DB
    const batch = new this.batchesModel({
      issuerDocStore: docStore,
      documentBatch: targetArr,
      merkleRoot,
    });
    await batch.save();

    //Issue Document
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const data = await contract.methods.issue(merkleRoot).encodeABI();
    const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');

    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: docStore,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
    tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
    const serializedTx = tx.serialize();
    web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('receipt', console.log);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('CreateHCPCR', duration);
    return { certArr };
  }

  async createADSMDoc(apiToken: string, ADSMDto: ADSMDto) {
    const certArr = [];
    const rawJSONArr = [];
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getCompanyName = getUserInfo.companyName;
    const getUserEmail = getUserInfo.email;
    const getUserAddr = getUserInfo.wallet.address;
    const getDomain = getUserInfo.domain;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const issuers = {
      $template: {
        name: 'JEDTRADE_DEMO',
        type: 'EMBEDDED_RENDERER',
        url: 'https://jrenderer.sandbox158.run/',
      },
      name: 'ADSM Certificate',
      issuers: [
        {
          name: `${getCompanyName}`,
          individualName: `${getUserInfo.name}`,
          address1: `${getUserInfo.address1}`,
          address2: `${getUserInfo.address2}`,
          zipcode: `${getUserInfo.zipcode}`,
          country: `${getUserInfo.country}`,
          phoneNo: `${getUserInfo.mobileNo}`,
          documentStore: `${docStore}`,
          identityProof: {
            type: 'DNS-TXT',
            location: `${getDomain}`,
          },
          email: `${getUserEmail}`,
          walletAddress: `${getUserAddr}`,
        },
      ],
    };

    const issuerPrivateKey = await getUserInfo.getPrivateKey();

    const valuesAlreadySeen = [];
    await this.web3Service.updateGasPrice();
    await Promise.all(
      ADSMDto.documents.map(async document => {
        const documentId = document['id'];
        if (valuesAlreadySeen.indexOf(documentId) !== -1) {
          throw new Error(`Duplicate ID - ${documentId}`);
        }
        valuesAlreadySeen.push(documentId);
        const findDocId = await this.documentModel.findOne({ documentId });
        if (findDocId != null) {
          throw new Error(`Document ID - ${documentId} already in use`);
        } else {
          const adsmDoc = { ...issuers, ...document };
          const documentId = document['id'];
          const adsmJSON = `${documentId}-ADSM.json`;
          const dictString = JSON.stringify(adsmDoc);
          const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
          const finalFile = `${folderPath}/${adsmJSON}`;
          fs.writeFileSync(finalFile, dictString);
          const bufferReadFile = fs.readFileSync(finalFile);
          const readFile = bufferReadFile.toString();
          rawJSONArr.push(JSON.parse(readFile));
        }
      }),
    );

    const wrappedDocuments = wrapDocuments(rawJSONArr);

    let merkleRoot;
    const targetArr = [];
    await Promise.all(
      wrappedDocuments.map(async wrappedDoc => {
        const wrapDocInfo = JSON.stringify(wrappedDoc);
        const rawDocInfo = getData(wrappedDoc);
        const docInfo = JSON.stringify(rawDocInfo);
        const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
        const dictJSON = `${rawDocInfo.id}-ADSM.json`;
        const finalFile = `${folderPath}/${dictJSON}`;
        fs.writeFileSync(finalFile, wrapDocInfo);
        const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
        const docRoot = wrappedDoc['signature'].targetHash;
        const docName = `${rawDocInfo.id}-ADSM`;
        const docStore = rawDocInfo.issuers[0].documentStore;
        const name = `${rawDocInfo.recipient.name} ${rawDocInfo.recipient.lastName}`;

        //Save Student Info to DB
        const studentId = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });
        if (studentId == null) {
          const student = new this.studentModel({
            studentId: rawDocInfo.recipient.studentId,
            nric: rawDocInfo.recipient.nric,
            email: rawDocInfo.recipient.email,
            name,
            dob: rawDocInfo.recipient.dob,
            graduationDate: rawDocInfo.recipient.completionDate,
          });
          await student.save();
        }

        const studentInfo = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });

        //Save Doc Info to DB
        const doc = new this.documentModel({
          docHash: `0x${docRoot}`,
          issuerDocStore: docStore,
          docInfo,
          wrapDocInfo,
          docType: 'ADSM',
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
          studentId: studentInfo._id,
          issuedDate: 0,
          revokedDate: 0,
          isBatchRevoke: false,
        });
        await doc.save();

        const link = `https://jviewer.sandbox158.run/`;
        this.mailerService.sendADSM(
          rawDocInfo.recipient.email,
          link,
          name,
          issuers.issuers[0].name,
          rawDocInfo.id,
          docName,
          file,
        );

        this.usersService.etherCheck(getUserAddr);

        const docs = {
          docName,
          email: rawDocInfo.recipient.email,
          name,
          docHash: `0x${docRoot}`,
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
        };
        merkleRoot = `0x${wrappedDoc['signature'].merkleRoot}`;
        certArr.push(docs);
        targetArr.push(`0x${docRoot}`);
      }),
    );

    //Save batch info to DB
    const batch = new this.batchesModel({
      issuerDocStore: docStore,
      documentBatch: targetArr,
      merkleRoot,
    });
    await batch.save();

    //Issue Document
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const data = await contract.methods.issue(merkleRoot).encodeABI();
    const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');

    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: docStore,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
    tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
    const serializedTx = tx.serialize();
    web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('receipt', console.log);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('CreateADSM', duration);
    return { certArr };
  }
  async createPGDSLI(apiToken: string, PGDSLIDto: PGDSLIDto) {
    const certArr = [];
    const rawJSONArr = [];
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getCompanyName = getUserInfo.companyName;
    const getUserEmail = getUserInfo.email;
    const getUserAddr = getUserInfo.wallet.address;
    const getDomain = getUserInfo.domain;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const issuers = {
      $template: {
        name: 'JEDTRADE_DEMO',
        type: 'EMBEDDED_RENDERER',
        url: 'https://jrenderer.sandbox158.run/',
      },
      name: 'PGDSLI Certificate',
      issuers: [
        {
          name: `${getCompanyName}`,
          individualName: `${getUserInfo.name}`,
          address1: `${getUserInfo.address1}`,
          address2: `${getUserInfo.address2}`,
          zipcode: `${getUserInfo.zipcode}`,
          country: `${getUserInfo.country}`,
          phoneNo: `${getUserInfo.mobileNo}`,
          documentStore: `${docStore}`,
          identityProof: {
            type: 'DNS-TXT',
            location: `${getDomain}`,
          },
          email: `${getUserEmail}`,
          walletAddress: `${getUserAddr}`,
        },
      ],
    };

    const issuerPrivateKey = await getUserInfo.getPrivateKey();

    const valuesAlreadySeen = [];
    await this.web3Service.updateGasPrice();
    await Promise.all(
      PGDSLIDto.documents.map(async document => {
        const documentId = document['id'];
        if (valuesAlreadySeen.indexOf(documentId) !== -1) {
          throw new Error(`Duplicate ID - ${documentId}`);
        }
        valuesAlreadySeen.push(documentId);
        const findDocId = await this.documentModel.findOne({ documentId });
        if (findDocId != null) {
          throw new Error(`Document ID - ${documentId} already in use`);
        } else {
          const pgdsliDoc = { ...issuers, ...document };
          const documentId = document['id'];
          const pgdsliJSON = `${documentId}-PGDSLI.json`;
          const dictString = JSON.stringify(pgdsliDoc);
          const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
          const finalFile = `${folderPath}/${pgdsliJSON}`;
          fs.writeFileSync(finalFile, dictString);
          const bufferReadFile = fs.readFileSync(finalFile);
          const readFile = bufferReadFile.toString();
          rawJSONArr.push(JSON.parse(readFile));
        }
      }),
    );

    const wrappedDocuments = wrapDocuments(rawJSONArr);

    let merkleRoot;
    const targetArr = [];
    await Promise.all(
      wrappedDocuments.map(async wrappedDoc => {
        const wrapDocInfo = JSON.stringify(wrappedDoc);
        const rawDocInfo = getData(wrappedDoc);
        const docInfo = JSON.stringify(rawDocInfo);
        const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
        const pgdsliJSON = `${rawDocInfo.id}-PGDSLI.json`;
        const finalFile = `${folderPath}/${pgdsliJSON}`;
        fs.writeFileSync(finalFile, wrapDocInfo);
        const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
        const docRoot = wrappedDoc['signature'].targetHash;
        const docName = `${rawDocInfo.id}-PGDSLI`;
        const docStore = rawDocInfo.issuers[0].documentStore;
        const name = `${rawDocInfo.recipient.name} ${rawDocInfo.recipient.lastName}`;

        //Save Student Info to DB
        const studentId = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });
        if (studentId == null) {
          const student = new this.studentModel({
            studentId: rawDocInfo.recipient.studentId,
            nric: rawDocInfo.recipient.nric,
            email: rawDocInfo.recipient.email,
            name,
            dob: rawDocInfo.recipient.dob,
            graduationDate: rawDocInfo.recipient.completionDate,
          });
          await student.save();
        }

        const studentInfo = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });

        //Save Doc Info to DB
        const doc = new this.documentModel({
          docHash: `0x${docRoot}`,
          issuerDocStore: docStore,
          docInfo,
          wrapDocInfo,
          docType: 'PGDSLI',
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
          studentId: studentInfo._id,
          issuedDate: 0,
          revokedDate: 0,
          isBatchRevoke: false,
        });
        await doc.save();

        const link = `https://jviewer.sandbox158.run/`;
        this.mailerService.sendPGDSLI(
          rawDocInfo.recipient.email,
          link,
          name,
          issuers.issuers[0].name,
          rawDocInfo.id,
          docName,
          file,
        );

        this.usersService.etherCheck(getUserAddr);

        const docs = {
          docName,
          email: rawDocInfo.recipient.email,
          name,
          docHash: `0x${docRoot}`,
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
        };
        merkleRoot = `0x${wrappedDoc['signature'].merkleRoot}`;
        certArr.push(docs);
        targetArr.push(`0x${docRoot}`);
      }),
    );

    //Save batch info to DB
    const batch = new this.batchesModel({
      issuerDocStore: docStore,
      documentBatch: targetArr,
      merkleRoot,
    });
    await batch.save();

    //Issue Document
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const data = await contract.methods.issue(merkleRoot).encodeABI();
    const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');

    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: docStore,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
    tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
    const serializedTx = tx.serialize();
    web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('receipt', console.log);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('CreateDICT', duration);
    return { certArr };
  }
  async createPDDMCS(apiToken: string, PDDMCSDto: PDDMCSDto) {
    const certArr = [];
    const rawJSONArr = [];
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getCompanyName = getUserInfo.companyName;
    const getUserEmail = getUserInfo.email;
    const getUserAddr = getUserInfo.wallet.address;
    const getDomain = getUserInfo.domain;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const issuers = {
      $template: {
        name: 'JEDTRADE_DEMO',
        type: 'EMBEDDED_RENDERER',
        url: 'https://jrenderer.sandbox158.run/',
      },
      name: 'PDDMCS Certificate',
      issuers: [
        {
          name: `${getCompanyName}`,
          individualName: `${getUserInfo.name}`,
          address1: `${getUserInfo.address1}`,
          address2: `${getUserInfo.address2}`,
          zipcode: `${getUserInfo.zipcode}`,
          country: `${getUserInfo.country}`,
          phoneNo: `${getUserInfo.mobileNo}`,
          documentStore: `${docStore}`,
          identityProof: {
            type: 'DNS-TXT',
            location: `${getDomain}`,
          },
          email: `${getUserEmail}`,
          walletAddress: `${getUserAddr}`,
        },
      ],
    };

    const issuerPrivateKey = await getUserInfo.getPrivateKey();

    const valuesAlreadySeen = [];
    await this.web3Service.updateGasPrice();
    await Promise.all(
      PDDMCSDto.documents.map(async document => {
        const documentId = document['id'];
        if (valuesAlreadySeen.indexOf(documentId) !== -1) {
          throw new Error(`Duplicate ID - ${documentId}`);
        }
        valuesAlreadySeen.push(documentId);
        const findDocId = await this.documentModel.findOne({ documentId });
        if (findDocId != null) {
          throw new Error(`Document ID - ${documentId} already in use`);
        } else {
          const pddmcsDoc = { ...issuers, ...document };
          const documentId = document['id'];
          const pddmcsJSON = `${documentId}-PDDMCS.json`;
          const dictString = JSON.stringify(pddmcsDoc);
          const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
          const finalFile = `${folderPath}/${pddmcsJSON}`;
          fs.writeFileSync(finalFile, dictString);
          const bufferReadFile = fs.readFileSync(finalFile);
          const readFile = bufferReadFile.toString();
          rawJSONArr.push(JSON.parse(readFile));
        }
      }),
    );

    const wrappedDocuments = wrapDocuments(rawJSONArr);

    let merkleRoot;
    const targetArr = [];
    await Promise.all(
      wrappedDocuments.map(async wrappedDoc => {
        const wrapDocInfo = JSON.stringify(wrappedDoc);
        const rawDocInfo = getData(wrappedDoc);
        const docInfo = JSON.stringify(rawDocInfo);
        const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
        const pddmcsJSON = `${rawDocInfo.id}-PDDMCS.json`;
        const finalFile = `${folderPath}/${pddmcsJSON}`;
        fs.writeFileSync(finalFile, wrapDocInfo);
        const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
        const docRoot = wrappedDoc['signature'].targetHash;
        const docName = `${rawDocInfo.id}-PDDMCS`;
        const docStore = rawDocInfo.issuers[0].documentStore;
        const name = `${rawDocInfo.recipient.name} ${rawDocInfo.recipient.lastName}`;

        //Save Student Info to DB
        const studentId = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });
        if (studentId == null) {
          const student = new this.studentModel({
            studentId: rawDocInfo.recipient.studentId,
            nric: rawDocInfo.recipient.nric,
            email: rawDocInfo.recipient.email,
            name,
            dob: rawDocInfo.recipient.dob,
            graduationDate: rawDocInfo.recipient.completionDate,
          });
          await student.save();
        }

        const studentInfo = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });

        //Save Doc Info to DB
        const doc = new this.documentModel({
          docHash: `0x${docRoot}`,
          issuerDocStore: docStore,
          docInfo,
          wrapDocInfo,
          docType: 'PDDMCS',
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
          studentId: studentInfo._id,
          issuedDate: 0,
          revokedDate: 0,
          isBatchRevoke: false,
        });
        await doc.save();

        const link = `https://jviewer.sandbox158.run/`;
        this.mailerService.sendPDDMCS(
          rawDocInfo.recipient.email,
          link,
          name,
          issuers.issuers[0].name,
          rawDocInfo.id,
          docName,
          file,
        );

        this.usersService.etherCheck(getUserAddr);

        const docs = {
          docName,
          email: rawDocInfo.recipient.email,
          name,
          docHash: `0x${docRoot}`,
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
        };
        merkleRoot = `0x${wrappedDoc['signature'].merkleRoot}`;
        certArr.push(docs);
        targetArr.push(`0x${docRoot}`);
      }),
    );

    //Save batch info to DB
    const batch = new this.batchesModel({
      issuerDocStore: docStore,
      documentBatch: targetArr,
      merkleRoot,
    });
    await batch.save();

    //Issue Document
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const data = await contract.methods.issue(merkleRoot).encodeABI();
    const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');

    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: docStore,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
    tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
    const serializedTx = tx.serialize();
    web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex')).on('receipt', console.log);

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('CreateDICT', duration);
    return { certArr };
  }
  async createTwoApproverCertificates(apiToken: string, Certificate2DTO: Certificate2DTO) {
    logger.info('Jedsign.service: createCert2Doc: Before the call');
    const certArr = [];
    const rawJSONArr = [];
    const approvers = [];
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserEmail = getUserInfo.email;
    const getUserAddr = getUserInfo.wallet.address;
    const getDomain = getUserInfo.domain;
    const getCompanyName = getUserInfo.companyName;

    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();

    logger.info('Jedsign.service: createCert2Doc:Test 02');
    const renderurl = 'https://jrenderer.sandbox158.run/';
    logger.info('Jedsign.service: createCert2Doc:Test 02: renderurl: ' + renderurl);
    const issuers = {
      $template: {
        name: 'JEDTRADE_DEMO',
        type: 'EMBEDDED_RENDERER',
        url: renderurl,
      },
      name: 'Certificate2 Certificate',
      issuers: [
        {
          name: `${getCompanyName}`,
          individualName: `${getUserInfo.name}`,
          address1: `${getUserInfo.address1}`,
          address2: `${getUserInfo.address2}`,
          zipcode: `${getUserInfo.zipcode}`,
          country: `${getUserInfo.country}`,
          phoneNo: `${getUserInfo.mobileNo}`,
          documentStore: `${docStore}`,
          identityProof: {
            type: 'DNS-TXT',
            location: `${getDomain}`,
          },
          email: `${getUserEmail}`,
          walletAddress: `${getUserAddr}`,
        },
      ],
    };
    logger.info('Jedsign.service: createCert2Doc:Test 02: renderurl: ', issuers);

    const valuesAlreadySeen = [];
    const studentArr = [];
    await this.web3Service.updateGasPrice();
    await Promise.all(
      Certificate2DTO.documents.map(async document => {
        const documentId = document['id'];
        if (valuesAlreadySeen.indexOf(documentId) !== -1) {
          throw new Error(`Duplicate ID - ${documentId}`);
        }
        valuesAlreadySeen.push(documentId);
        const findDocId = await this.documentModel.findOne({ documentId });
        if (findDocId != null) {
          throw new Error(`Document ID - ${documentId} already in use`);
        } else {
          // Process Approvers
          const infoDoc = document;
          let userDoc;
          let approvers1;

          for (let i = 0; i < infoDoc['approvers'].length; i++) {
            userDoc = await this.userModel.findOne(
              { email: infoDoc['approvers'][i].email },
              { name: 1, companyName: 1, role: 1, designation: 1, email: 1 },
            );

            if (userDoc && userDoc.role === 'approver') {
              const userName = userDoc.name;
              const userCompanyName = userDoc.companyName;
              const userDesignation = userDoc.designation;
              const userEmail = userDoc.email;

              approvers1 = {
                name: userName,
                email: userEmail,
                companyName: userCompanyName,
                designation: userDesignation,
                signature: '',
              };
              approvers.push(approvers1);
            } else {
              throw new Error(`Approver does not exist`);
            }
          }

          //Process documents
          const adcsDoc = { ...issuers, ...document, approvers };
          const documentId = document['id'];
          const adcsJSON = `${documentId}-ADCS.json`;
          const dictString = JSON.stringify(adcsDoc);
          const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
          const finalFile = `${folderPath}/${adcsJSON}`;
          fs.writeFileSync(finalFile, dictString);
          const bufferReadFile = fs.readFileSync(finalFile);
          const readFile = bufferReadFile.toString();
          rawJSONArr.push(JSON.parse(readFile));
          studentArr.push(document['recipient']);
        }
      }),
    );

    const filteredArr = studentArr.reduce((acc, current) => {
      const x = acc.find(item => item.studentId === current.studentId);
      if (!x) {
        return acc.concat([current]);
      } else {
        return acc;
      }
    }, []);

    await Promise.all(
      filteredArr.map(async studentInfo => {
        const studentId = await this.studentModel.findOne({
          studentId: studentInfo.studentId,
        });
        if (studentId == null) {
          const name = `${studentInfo.name} ${studentInfo.lastName}`;
          const student = new this.studentModel({
            studentId: studentInfo.studentId,
            nric: studentInfo.nric,
            email: studentInfo.email,
            name,
            dob: studentInfo.dob,
            graduationDate: studentInfo.completionDate,
          });
          await student.save();
        }
      }),
    );
    const wrappedDocuments = wrapDocuments(rawJSONArr);

    let merkleRoot;
    const targetArr = [];
    await Promise.all(
      wrappedDocuments.map(async wrappedDoc => {
        const wrapDocInfo = JSON.stringify(wrappedDoc);
        const rawDocInfo = getData(wrappedDoc);
        const docInfo = JSON.stringify(rawDocInfo);
        const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
        const cert2JSON = `${rawDocInfo.id}-ADCS.json`;
        const finalFile = `${folderPath}/${cert2JSON}`;
        fs.writeFileSync(finalFile, wrapDocInfo);
        const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));
        const docRoot = wrappedDoc['signature'].targetHash;
        const docName = `${rawDocInfo.id}-ADCS`;
        const docStore = rawDocInfo.issuers[0].documentStore;
        const name = `${rawDocInfo.recipient.name} ${rawDocInfo.recipient.lastName}`;

        const studentInfo = await this.studentModel.findOne({
          studentId: rawDocInfo.recipient.studentId,
        });

        //Save Doc Info to DB
        const doc = new this.documentModel({
          docHash: `0x${docRoot}`,
          issuerDocStore: docStore,
          docInfo,
          wrapDocInfo,
          docType: 'Cert2',
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
          studentId: studentInfo._id,
          issuedDate: 0,
          revokedDate: 0,
          isBatchRevoke: false,
        });
        await doc.save();

        const link = `https://jviewer.sandbox158.run/`;
        this.mailerService.sendADCS(
          rawDocInfo.recipient.email,
          link,
          name,
          issuers.issuers[0].name,
          rawDocInfo.id,
          docName,
          file,
        );

        await Promise.all(
          approvers.map(async approver => {
            //Send email to approvers
            const url = `https://jcerts-admin.sandbox158.run/#/api/v1/hash/0x${docRoot}`;
            await this.mailerService.sendSigningEmail(approver.email, url);
          }),
        );

        console.log('docInfo', rawDocInfo);
        const docs = {
          docName,
          email: rawDocInfo.recipient.email,
          name,
          docHash: `0x${docRoot}`,
          documentId: rawDocInfo.id,
          completionDate: rawDocInfo.recipient.completionDate,
        };
        merkleRoot = `0x${wrappedDoc['signature'].merkleRoot}`;
        certArr.push(docs);
        targetArr.push(`0x${docRoot}`);
      }),
    );

    //Save batch info to DB
    const batch = new this.batchesModel({
      issuerDocStore: docStore,
      documentBatch: targetArr,
      merkleRoot,
    });
    console.log(batch);
    await batch.save();

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('Create2Approver', duration);
    return { certArr };
  }
  async createNOA(apiToken: string, noaDto: NoaDto) {
    const arr = noaDto.noa;
    await this.web3Service.updateGasPrice();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const hashArr = [];
    for await (const i of arr) {
      //Issuer Info
      const invDocHash = i.invInfo[0].docHash;
      const invDoc = await this.documentModel.findOne({ docHash: invDocHash });
      const docInfo = JSON.parse(invDoc.docInfo);
      const invIssuers = docInfo.issuers;
      const docStore = invIssuers[0].documentStore;
      const getCompanyName = invIssuers[0].name;
      const getIndividual = invIssuers[0].individualName;
      const getUserEmail = invIssuers[0].email;
      const getDomain = invIssuers[0].identityProof.location;
      const getSupplierInfo = await this.usersService.findOneByEmail(getUserEmail);

      const issuers = {
        $template: {
          name: 'noa',
          type: 'EMBEDDED_RENDERER',
          url: 'https://kepler-doc-renderer.sandbox158.run/',
        },
        name: 'NOA ConsenTrade Certificate',
        issuers: [
          {
            name: `${getCompanyName}`,
            individualName: `${getIndividual}`,
            documentStore: `${docStore}`,
            identityProof: {
              type: 'DNS-TXT',
              location: `${getDomain}`,
            },
            email: `${getUserEmail}`,
            address: `${getSupplierInfo.address1}`,
            zipcode: `${getSupplierInfo.zipcode}`,
            image: `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`,
            walletAddress: `${getSupplierInfo.wallet.address}`,
            designation: `${getSupplierInfo.designation}`,
          },
        ],
      };

      //Recipient Info
      const recipientEmail = i.recipient.buyerEmail;
      const recipientInfo = await this.usersService.findOneByEmail(recipientEmail);
      const dateTime = Date.now();
      const recipient = {
        recipient: {
          name: `${recipientInfo.name}`,
          cpyName: `${recipientInfo.companyName}`,
          email: `${recipientEmail}`,
          address: `${recipientInfo.address1}`,
          zipcode: `${recipientInfo.zipcode}`,
          phoneNo: `${recipientInfo.mobileNo}`,
          date: `${dateTime}`,
        },
      };

      //Doc Info
      const invArr = {
        reqInfo: [],
      };
      const invHashArr = [];
      for await (const hash of i.invInfo) {
        const docHash = hash.docHash;
        const invInfo = await this.documentModel.findOne({ docHash });
        const doc = JSON.parse(invInfo.docInfo);
        const docInfo = doc.docDetails;
        const invNo = invInfo.invNo;
        const date = docInfo.date;
        const currency = docInfo.currency;
        const amt = docInfo.finalAmt;
        const transId = invInfo.transId;
        const inv = { invNo, date, amt, currency, transId };
        invHashArr.push(docHash);
        invArr.reqInfo.push(inv);
      }

      const financierDetails = {
        financierDetails: {
          name: `${getUserInfo.name}`,
          email: `${getUserInfo.email}`,
          designation: `${getUserInfo.designation}`,
          bankDetails: {
            accName: `${getUserInfo['financierDetails'].accountName}`,
            accNum: `${getUserInfo['financierDetails'].accountNumber}`,
            bankName: `${getUserInfo['financierDetails'].bankName}`,
            swiftNo: `${getUserInfo['financierDetails'].swiftNumber}`,
          },
        },
      };

      const noaDetails = i.noaDetails;
      const invtInfo = { noaDetails };
      const noaDoc = { ...issuers, ...recipient, ...invArr, ...financierDetails, ...invtInfo };

      const issuerId = getUserInfo._id;
      const noaJSON = `${issuerId}-NOA.json`;
      const dictString = JSON.stringify(noaDoc);
      const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
      const finalFile = `${folderPath}/${noaJSON}`;
      fs.writeFileSync(finalFile, dictString);

      const bufferReadFile = fs.readFileSync(finalFile);
      const readFile = bufferReadFile.toString();

      //Wrap Document
      const wrappedDoc = wrapDocument(JSON.parse(readFile));
      const docOutput = util.inspect(wrappedDoc, { showHidden: false, depth: null });
      const wrapDocInfo = JSON.stringify(wrappedDoc);
      const split = `${docOutput}`.split('\n');
      const lastLine = split.length - 3;
      const extracted = split[lastLine].match(/(.{65}$)/g)[0];
      const docHash = `0x${extracted.slice(0, -1)}`;
      const info = { docHash, docInfo: dictString, wrapDocInfo, invHashArr };
      hashArr.push(info);

      //Save docInfo to DB
      const doc = new this.batchesModel({
        docType: 'NOA',
        issuerDocStore: docStore,
        docInfo: dictString,
        wrapDocInfo,
        docHash,
        invHashArr,
      });
      await doc.save();
    }

    //Send SMS OTP
    await this.usersService.sendOtpNOA(getUserInfo, hashArr);

    const otpIssueNOA = /true/i.test(process.env.OTP_REQUIRED_NOAISSUE);

    return { otpRequired: otpIssueNOA, hashArr };
  }
  async verifyDocumentOA(docHash: string) {
    const getWrapInfo = await this.documentModel.findOne({ docHash }, { _id: 0, wrapDocInfo: 1 });
    const wrapJson = JSON.parse(getWrapInfo.wrapDocInfo);
    const statusArr = [];
    await verify(wrapJson, { network: 'rinkeby' }).then(fragments => {
      const docIntegrity = isValid(fragments, ['DOCUMENT_INTEGRITY']);
      const docStatus = isValid(fragments, ['DOCUMENT_STATUS']);
      const issuerIdentity = isValid(fragments, ['ISSUER_IDENTITY']);
      const status = { docIntegrity, docStatus, issuerIdentity };
      statusArr.push(status);
    });
    return statusArr[0];
  }
  async verifyDocumentOAFinance(docHash: string) {
    const getWrapInfo = await this.batchesModel.findOne({ docHash }, { _id: 0, wrapDocInfo: 1 });
    const wrapJson = JSON.parse(getWrapInfo.wrapDocInfo);
    const statusArr = [];
    await verify(wrapJson, { network: 'rinkeby' }).then(fragments => {
      const docIntegrity = isValid(fragments, ['DOCUMENT_INTEGRITY']);
      const docStatus = isValid(fragments, ['DOCUMENT_STATUS']);
      const issuerIdentity = isValid(fragments, ['ISSUER_IDENTITY']);
      const status = { docIntegrity, docStatus, issuerIdentity };
      statusArr.push(status);
    });
    return statusArr[0];
  }
  async sign(apiToken: string, docHash: string) {
    const web3 = await this.web3Service.getWeb3();
    await this.web3Service.updateGasPrice();
    // Get Mapping Address
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const mappingAddr = await factoryContract.methods.mappingAddress().call();
    console.log('signMappingAddr', mappingAddr);
    const signerInfo = await this.tokensService.findOneByToken(apiToken);
    console.log('signSignerInfo', signerInfo);
    const signerAddr = signerInfo.wallet.address;
    console.log('signSignerAddr', signerAddr);
    const signerPrivKey = signerInfo.getPrivateKey();
    console.log('signSignerPrivKey', signerPrivKey);

    //Get Issuer Doc Store Address
    const mappingContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreMappingABI),
      mappingAddr,
    );
    const docStore = await mappingContract.methods.mappings(signerAddr, docHash).call();
    console.log('signDocStore', docStore);

    //Sign Document Process
    const signContract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const data = await signContract.methods.sign(docHash).encodeABI();
    const nonce = await web3.eth.getTransactionCount(signerAddr, 'pending');
    console.log('signNonce', nonce);
    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: docStore,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
    tx.sign(Buffer.from(`${signerPrivKey}`, 'hex'));
    const serializedTx = tx.serialize();
    await web3.eth
      .sendSignedTransaction('0x' + serializedTx.toString('hex'))
      .on('receipt', console.log);

    const isSigned = await signContract.methods.documentSigned(`${docHash}`).call();
    let signed;
    if (isSigned == 0) {
      signed = false;
    } else {
      signed = true;
    }
    await this.documentModel.findOneAndUpdate({ docHash }, { updatedAt: Date.now() });

    //Check Amt of Ether User's Wallet
    this.usersService.etherCheck(signerAddr);

    return { signed, docHash };
  }
  async acceptNOA(apiToken: string, docHash: string) {
    const web3 = await this.web3Service.getWeb3();
    await this.web3Service.updateGasPrice();
    // Get Mapping Address
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const mappingAddr = await factoryContract.methods.mappingAddress().call();
    const signerInfo = await this.tokensService.findOneByToken(apiToken);
    const signerAddr = signerInfo.wallet.address;
    const signerPrivKey = signerInfo.getPrivateKey();

    //Get Issuer Doc Store Address
    const mappingContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreMappingABI),
      mappingAddr,
    );
    const docStore = await mappingContract.methods.mappings(signerAddr, docHash).call();

    //Sign Document Process
    const signContract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const data = await signContract.methods.sign(docHash).encodeABI();
    const nonce = await web3.eth.getTransactionCount(signerAddr, 'pending');
    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: docStore,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
    tx.sign(Buffer.from(`${signerPrivKey}`, 'hex'));
    const serializedTx = tx.serialize();
    await web3.eth
      .sendSignedTransaction('0x' + serializedTx.toString('hex'))
      .on('receipt', console.log);

    const isSigned = await signContract.methods.documentSigned(`${docHash}`).call();
    let signed;
    if (isSigned == 0) {
      signed = false;
    } else {
      signed = true;
    }
    await this.batchesModel.findOneAndUpdate({ docHash }, { updatedAt: Date.now() });

    //Check Amt of Ether User's Wallet
    this.usersService.etherCheck(signerAddr);

    return { signed, docHash };
  }
  async resendOtpSign(apiToken: string) {
    const userInfo = await this.tokensService.findOneByToken(apiToken);
    const userId = userInfo._id;
    const mobileNo = userInfo.mobileNo;
    const user = await this.userModel.findOne({
      _id: userId,
      mobileNo,
      activeOTP: true,
      activeEmail: true,
    });
    if (!user) {
      throw new Error('Inactive user not found');
    }
    await this.otpModel.findOneAndRemove({ userId, mobileNo });
    await this.usersService.sendOtp(user);
  }
  async verifyDocument(apiToken: string, docHash: string) {
    const web3 = await this.web3Service.getWeb3();
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    console.log(factoryContract);
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const isSigned = await contract.methods.documentSigned(`${docHash}`).call();
    let signed;
    if (isSigned == 0) {
      signed = false;
    } else {
      signed = true;
    }

    return { signed, docHash };
  }

  async getDocument(docHash: string) {
    const doc = await this.documentModel.findOne({ docHash }, { __v: 0, _id: 0 });
    const docInfo = JSON.parse(doc.docInfo);

    //console.log(docInfo);
    const certTitle = docInfo.title;

    //console.log(certTitle);

    const name = `${docInfo.patientFirstName} ${docInfo.patientLastName}`;

    //console.log(name);
    const document = {
      docInfo,
      certTitle,
      name,
      wrapDocInfo: JSON.parse(doc.wrapDocInfo),
    };
    return { document };
  }
  async getNOAByInv(docHash: string) {
    const docInfo = [];
    const arr = await this.batchesModel.find({ invHashArr: docHash, docType: 'NOA' });
    if (arr.length >= 1) {
      const noa = await this.batchesModel.find(
        { invHashArr: docHash, docType: 'NOA' },
        { docHash: 1, docInfo: 1 },
      );
      const noaDocInfo = JSON.parse(noa[0].docInfo);
      const issuers = noaDocInfo.issuers;
      const recipient = noaDocInfo.recipient;
      const reqInfo = noaDocInfo.reqInfo;
      const financierDetails = noaDocInfo.financierDetails;
      const noaDetails = noaDocInfo.noaDetails;
      const oaStatus = await this.verifyDocumentOAFinance(noa[0].docHash);
      docInfo.push({ issuers, recipient, reqInfo, financierDetails, noaDetails, oaStatus });
    } else {
      const noa = await this.batchesModel.find(
        { invHashArr: docHash, docType: 'FR' },
        { docInfo: 1 },
      );
      const noaDocInfo = JSON.parse(noa[0].docInfo);
      const issuers = noaDocInfo.issuers;
      const recipient = noaDocInfo.recipient;
      const reqInfo = noaDocInfo.reqInfo;
      const financierDetails = noaDocInfo.financierDetails;
      const noaDetails = noaDocInfo.noaDetails;
      docInfo.push({ issuers, recipient, reqInfo, financierDetails, noaDetails });
    }
    return docInfo[0];
  }
  async getNOAbyFR(docHash: string) {
    const docInfo = [];
    const doc = [];
    const arr = await this.batchesModel.findOne({ docHash, docType: 'FR' });
    if (arr.noaDocHash.length >= 1) {
      docInfo.push(arr.noaDocHash);
    }
    if (docInfo.length >= 1) {
      for await (const i of docInfo[0]) {
        const noa = await this.batchesModel.findOne(
          { docHash: i, docType: 'NOA' },
          { docInfo: 1, docHash: 1 },
        );
        const noaDocInfo = JSON.parse(noa.docInfo);
        const issuers = noaDocInfo.issuers;
        const recipient = noaDocInfo.recipient;
        const reqInfo = noaDocInfo.reqInfo;
        const financierDetails = noaDocInfo.financierDetails;
        const noaDetails = noaDocInfo.noaDetails;
        const oaStatus = await this.verifyDocumentOAFinance(noa.docHash);
        doc.push({ issuers, recipient, reqInfo, financierDetails, noaDetails, oaStatus });
      }
    } else {
      const fr = await this.batchesModel.findOne({ docHash, docType: 'FR' }, { docInfo: 1 });
      const noaDocInfo = JSON.parse(fr.docInfo);
      const issuers = noaDocInfo.issuers;
      const recipient = noaDocInfo.recipient;
      const reqInfo = noaDocInfo.reqInfo;
      const financierDetails = noaDocInfo.financierDetails;
      const noaDetails = noaDocInfo.noaDetails;
      doc.push({ issuers, recipient, reqInfo, financierDetails, noaDetails });
    }
    return doc;
  }
  async verifyOTPSigning(otp: string, apiToken: string, _docHash: string) {
    const findOne = await this.usersService.findOneByOTP(otp);
    const mobileNo = findOne.mobileNo;
    const userInfo = await this.tokensService.findOneByToken(apiToken);
    const userId = userInfo._id;
    if (await this.otpModel.exists({ code: otp, userId })) {
      if ((await this.batchesModel.findOne({ docHash: _docHash, docType: 'NOA' })) !== null) {
        //Acknowledge Document
        const acceptDoc = await this.acceptNOA(apiToken, _docHash);
        const isSigned = acceptDoc.signed;

        //Send Email
        const noa = await this.batchesModel.findOne({ docHash: _docHash, docType: 'NOA' });
        const docInfo = JSON.parse(noa.docInfo);

        //Get Inv Numbers
        const invArr = [];
        for await (const i of docInfo.reqInfo) {
          invArr.push(i.invNo);
        }

        //Get Buyer Company
        const buyerCpy = docInfo.recipient.cpyName;

        //Get document Name
        const frInfo = await this.batchesModel.findOne({ invHashArr: noa.invHashArr[0] });
        const docName = frInfo.docName;

        //Get Supplier and Financier Email
        const supplierEmail = docInfo.issuers[0].email;
        const financierEmail = docInfo.financierDetails.email;

        let html = "<ol type='1'>";
        invArr.forEach(element => {
          html += `<li>${element}</li>`;
        });
        html += '</ol>';

        await this.mailerService.sendNoaBuyerAcknowledged(supplierEmail, buyerCpy, html, docName);
        await this.mailerService.sendNoaBuyerAcknowledged(financierEmail, buyerCpy, html, docName);
        await this.otpModel.findOneAndRemove({ code: otp, mobileNo });

        return { acknowledgeNoa: true, isSigned };
      } else {
        await this.sign(apiToken, _docHash);
        await this.otpModel.findOneAndRemove({ code: otp, mobileNo });
        const web3 = await this.web3Service.getWeb3();
        const factoryContract = new web3.eth.Contract(
          JSON.parse(process.env.DocStoreFactoryABI),
          process.env.DOCSTORE_FACTORY,
        );
        const mappingAddr = await factoryContract.methods.mappingAddress().call();

        const signerInfo = await this.tokensService.findOneByToken(apiToken);
        const signerAddr = signerInfo.wallet.address;

        const mappingContract = new web3.eth.Contract(
          JSON.parse(process.env.DocStoreMappingABI),
          mappingAddr,
        );
        const docStore = await mappingContract.methods.mappings(signerAddr, _docHash).call();

        const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
        const isSigned = await contract.methods.documentSigned(`${_docHash}`).call();
        let signed;
        if (isSigned == 0) {
          signed = false;
        } else {
          signed = true;
        }

        const docInfo = await this.documentModel.findOne({ docHash: _docHash });
        const docType = docInfo.docType;
        const quoteNumber = docInfo.quoteNumber;
        const status = await this.getStatus(apiToken, quoteNumber);
        let docNo;
        if (docType == 'SQ') {
          return { signed, docHash: _docHash, status, quoteNumber };
        } else if (docType == 'PC') {
          const doc = JSON.parse(docInfo.docInfo);
          docNo = doc.docDetails.certNo;
          return { signed, docHash: _docHash, status, docNo };
        }
      }
    }
  }
  async verifyOTPIssuing(otp: string) {
    const web3 = await this.web3Service.getWeb3();
    await this.web3Service.updateGasPrice();
    const findOne = await this.usersService.findOneByOTP(otp);
    const mobileNo = findOne.mobileNo;
    const docHash = findOne.docHash;
    let supplierEmail;
    let supplierCompany;
    let buyerName;
    let buyerEmail;
    let buyerCpyName;

    if (await this.otpModel.exists({ code: otp, mobileNo })) {
      const hashArr = [];
      const arr2 = [];
      for await (const i of docHash) {
        hashArr.push(i.docHash);
      }
      for await (const i of docHash) {
        // Get InvInfo and Issuer Info
        const invInfo = JSON.parse(i.docInfo);
        const supplierDocStore = invInfo.issuers[0].documentStore;
        const supEmail = invInfo.issuers[0].email;
        const supCpy = invInfo.issuers[0].name;
        const getUserInfo = await this.usersService.findOneByEmail(supEmail);
        const getUserAddr = getUserInfo.wallet.address;
        const signerInfo = await this.usersService.findOneByEmail(invInfo.recipient.email);
        const signerAddr = signerInfo.wallet.address;
        const supplierPrivKey = await getUserInfo.getPrivateKey();

        const contract = new web3.eth.Contract(
          JSON.parse(process.env.DocStoreABI),
          supplierDocStore,
        );
        const data = await contract.methods.issue(i.docHash).encodeABI();
        const nonce = await web3.eth.getTransactionCount(getUserAddr, 'pending');
        const rawTx = {
          nonce: web3.utils.toHex(nonce),
          gasPrice: web3.utils.toHex(
            (this.web3Service.gasPrice.average *
              (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
              100,
          ),
          to: supplierDocStore,
          gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
          value: web3.utils.toHex(web3.utils.toWei('0')),
          data: data,
        };

        const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
        tx.sign(Buffer.from(`${supplierPrivKey}`, 'hex'));
        const serializedTx = tx.serialize();
        web3.eth
          .sendSignedTransaction('0x' + serializedTx.toString('hex'))
          .on('receipt', console.log);

        //Allow Signer
        const allowSigner = await contract.methods
          .allowSigner(i.docHash, `${signerAddr}`)
          .encodeABI();

        const rawAllowTx = {
          nonce: web3.utils.toHex(nonce + 1),
          gasPrice: web3.utils.toHex(
            (this.web3Service.gasPrice.average *
              (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
              100,
          ),
          to: supplierDocStore,
          gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
          value: web3.utils.toHex(web3.utils.toWei('0')),
          data: allowSigner,
        };

        const allowSignerTx = await new EthereumTx(rawAllowTx, {
          chain: `${process.env.ISSUEDOC_NETWORK}`,
        });
        allowSignerTx.sign(Buffer.from(`${supplierPrivKey}`, 'hex'));
        const serializedAllowTx = allowSignerTx.serialize();
        try {
          await web3.eth
            .sendSignedTransaction('0x' + serializedAllowTx.toString('hex'))
            .on('receipt', console.log);
        } catch (e) {
          console.log(e);
        }

        //Change Financing Status to 2 and Get Necessary DocInfo
        const invArr = [];
        const emailArr = [];
        const noaDoc = await this.batchesModel.findOne({ docHash: i.docHash });
        const reqInfo = JSON.parse(noaDoc.docInfo);
        const recipient = reqInfo.recipient.cpyName;
        const currency = reqInfo.reqInfo[0].currency;
        const noaNo = reqInfo.reqInfo;
        for (let l = 0; l < noaNo.length; l++) {
          invArr.push(noaNo[l].invNo);
          emailArr.push(` ${noaNo[l].invNo}`);
        }
        const dateTime = noaDoc.createdAt;
        const amtArr = [];
        for await (const i of noaNo) {
          await this.documentModel.findOneAndUpdate(
            { invNo: i.invNo },
            { financingStatus: 2, updatedAt: dateTime },
          );
          const amt = i.amt;
          amtArr.push(Number(amt));
        }
        const totalAmt = amtArr.reduce(function(a, b) {
          return a + b;
        }, 0);
        const finalAmt = Number(totalAmt.toFixed(2));
        const output = { recipient, finalAmt, dateTime, currency };
        arr2.push(output);

        //Update NOA Doc Hash in Financing request
        await this.batchesModel.update(
          { invHashArr: i.invHashArr[0], docType: 'FR' },
          { $push: { noaDocHash: i.docHash } },
        );

        //get supplier and buyer
        for await (const i of this.documentModel.findOne({ docType: 'Inv' }).lean()) {
          i.docInfo = JSON.parse(i.docInfo);
          if (i.docInfo.docDetails.invNo == invArr[0]) {
            supplierEmail = i.docInfo.issuers[0].email;
            supplierCompany = i.docInfo.issuers[0].name;
            buyerEmail = i.docInfo.recipient.emailAddress;
          }
        }
        const buyer = await this.userModel
          .findOne({ email: buyerEmail }, { _id: 0, name: 1, companyName: 1 })
          .lean();
        buyerName = buyer.name;
        buyerCpyName = buyer.companyName;

        //html invoice list display
        let html = "<ol type='1'>";
        invArr.forEach(element => {
          html += `<li>${element}</li>`;
        });
        html += '</ol>';

        // Get wrapped docInfo
        const wrapDoc = JSON.parse(i.wrapDocInfo);
        const wrapDocInfo = JSON.stringify(wrapDoc);
        const noaJSON = `${invArr[0]}-NOA.json`;
        const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
        const finalFile = `${folderPath}/${noaJSON}`;
        fs.writeFileSync(finalFile, wrapDocInfo);
        const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));

        //Send supplier Email
        this.mailerService.sendNoaVerifiedEmail(
          supEmail,
          supplierCompany,
          html,
          getUserInfo.companyName,
        );

        const invNoEmail = emailArr.toString();

        //Send buyer Email
        const link = `${process.env.BASEURL ?? 'http://localhost:3000'}${process.env.API_PREFI ??
          '/api/v1'}/hash/financing/documents/${i.docHash}`;
        this.mailerService.sendNoaBuyerApproval(
          buyerEmail,
          link,
          buyerName,
          html,
          invNoEmail,
          getUserInfo.companyName,
          supCpy,
          buyerCpyName,
          noaJSON,
          file,
        );
      }
      return { list: arr2 };
    }
  }
  async getDocumentByToken(apiToken: string) {
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    //Get Issuer Document Store
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const issuerDocStore = await factoryContract.methods.assets(getUserAddr).call();
    //Find Sales Document
    const findIssueByDoc = await this.documentModel.find(
      { issuerDocStore },
      { _id: 0, __v: 0, issuerDocStore: 0, transId: 0, quoteNumber: 0, wrapDocInfo: 0 },
    );
    const issuedByArray = [];
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), issuerDocStore);
    await Promise.all(
      findIssueByDoc.map(document => {
        const doc = document.toObject();
        if (doc.docType == 'Inv') {
          return new Promise(resolve => {
            contract.methods
              .isRevoked(`${document.docHash}`)
              .call()
              .then(d => resolve({ revoked: d }))
              .catch(e => {
                resolve({ document, e: e.message });
              });
          }).then(result => {
            const docInfo = JSON.parse(document.docInfo);
            const companyName = docInfo.recipient['companyName'];
            const documentNo = docInfo.docDetails['invNo'];
            const values = Object.values(result);
            const revoked = { revoked: values[0] };
            const invInfo = JSON.parse(doc.docInfo);
            const invAmt = parseFloat(invInfo.docDetails['finalAmt']).toFixed(2);
            const finalAmt = Number(invAmt);
            const currency = docInfo.docDetails['currency'];
            const details = { finalAmt, companyName, documentNo, currency };
            delete doc['docInfo'];
            console.log('doc', doc);
            const final = { ...doc, ...revoked, ...details };
            issuedByArray.push(final);
          });
        } else if (doc.docType == 'PC') {
          return new Promise(resolve => {
            const signerDocStore = doc.signerDocStore;
            const contract = new web3.eth.Contract(
              JSON.parse(process.env.DocStoreABI),
              signerDocStore,
            );
            contract.methods
              .documentSigned(`${document.docHash}`)
              .call()
              .then(s => {
                let signed;
                if (s == 0) {
                  signed = false;
                } else {
                  signed = true;
                }
                return signed;
              })
              .then(f => resolve({ signed: f }))
              .catch(e => {
                resolve({ document, e: e.message });
              });
          })
            .then(a => {
              return new Promise(resolve => {
                const signed = Object.values(a);
                const signerDocStore = doc.signerDocStore;
                const contract = new web3.eth.Contract(
                  JSON.parse(process.env.DocStoreABI),
                  signerDocStore,
                );
                contract.methods
                  .isRevoked(`${document.docHash}`)
                  .call()
                  .then(d => resolve({ revoked: d, signed: signed[0] }))
                  .catch(e => {
                    resolve({ document, e: e.message });
                  });
              });
            })
            .then(res2 => {
              const docInfo = JSON.parse(document.docInfo);
              const documentNo = docInfo.docDetails['certNo'];
              const companyName = docInfo.issuers[0]['name'];
              const values = Object.values(res2);
              const status = { revoked: values[0], signed: values[1] };
              const invInfo = JSON.parse(doc.docInfo);
              const currency = invInfo.docDetails['currency'];
              const invAmt = parseFloat(invInfo.docDetails['finalAmt']).toFixed(2);
              const finalAmt = Number(invAmt);
              const details = { finalAmt, companyName, documentNo, currency };
              delete doc['docInfo'];
              const final = { ...doc, ...status, ...details };
              issuedByArray.push(final);
            });
        } else if (doc.docType == 'SQ') {
          return new Promise(resolve => {
            contract.methods
              .documentSigned(`${document.docHash}`)
              .call()
              .then(s => {
                let signed;
                if (s == 0) {
                  signed = false;
                } else {
                  signed = true;
                }
                return signed;
              })
              .then(f => resolve({ signed: f }))
              .catch(e => {
                resolve({ document, e: e.message });
              });
          })
            .then(a => {
              return new Promise(resolve => {
                const signed = Object.values(a);
                contract.methods
                  .isRevoked(`${document.docHash}`)
                  .call()
                  .then(d => resolve({ revoked: d, signed: signed[0] }))
                  .catch(e => {
                    resolve({ document, e: e.message });
                  });
              });
            })
            .then(res2 => {
              const docInfo = JSON.parse(document.docInfo);
              const documentNo = docInfo.docDetails['quoteNumber'];
              const companyName = docInfo.recipient['companyName'];
              const values = Object.values(res2);
              const status = { revoked: values[0], signed: values[1] };
              const invInfo = JSON.parse(doc.docInfo);
              const currency = invInfo.docDetails['currency'];
              const invAmt = parseFloat(invInfo.docDetails['finalAmt']).toFixed(2);
              const finalAmt = Number(invAmt);
              const details = { finalAmt, companyName, documentNo, currency };
              delete doc['docInfo'];
              const final = { ...doc, ...status, ...details };
              issuedByArray.push(final);
            });
        }
      }),
    );
    const issuedBy = { salesDoc: issuedByArray };
    //Find Purchases Document
    const findIssueToDoc = await this.documentModel.find(
      { signerDocStore: issuerDocStore },
      { _id: 0, __v: 0, issuerDocStore: 0, transId: 0, quoteNumber: 0, wrapDocInfo: 0 },
    );
    const issuedToArray = [];
    await Promise.all(
      findIssueToDoc.map(document => {
        const doc = document.toObject();
        const docInfo = JSON.parse(doc.docInfo);
        const signerDocStore = docInfo.issuers[0]['documentStore'];
        const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), signerDocStore);
        if (doc.docType == 'Inv') {
          return new Promise(resolve => {
            contract.methods
              .isRevoked(`${document.docHash}`)
              .call()
              .then(d => resolve({ revoked: d }))
              .catch(e => {
                resolve({ document, e: e.message });
              });
          }).then(result => {
            const docInfo = JSON.parse(document.docInfo);
            const companyName = docInfo.issuers[0]['name'];
            const documentNo = docInfo.docDetails['invNo'];
            const supplierEmail = docInfo.issuers[0].email;
            const values = Object.values(result);
            const revoked = { revoked: values[0] };
            const invInfo = JSON.parse(doc.docInfo);
            const currency = invInfo.docDetails['currency'];
            const invAmt = parseFloat(invInfo.docDetails['finalAmt']).toFixed(2);
            const finalAmt = Number(invAmt);
            const details = { finalAmt, companyName, supplierEmail, documentNo, currency };
            delete doc['docInfo'];
            const final = { ...doc, ...revoked, ...details };
            issuedToArray.push(final);
          });
        } else if (doc.docType == 'PC') {
          return new Promise(resolve => {
            const signerDocStore = doc.signerDocStore;
            const contract = new web3.eth.Contract(
              JSON.parse(process.env.DocStoreABI),
              signerDocStore,
            );
            contract.methods
              .documentSigned(`${document.docHash}`)
              .call()
              .then(s => {
                let signed;
                if (s == 0) {
                  signed = false;
                } else {
                  signed = true;
                }
                return signed;
              })
              .then(f => resolve({ signed: f }))
              .catch(e => {
                resolve({ document, e: e.message });
              });
          })
            .then(a => {
              return new Promise(resolve => {
                const signed = Object.values(a);
                contract.methods
                  .isRevoked(`${document.docHash}`)
                  .call()
                  .then(d => resolve({ revoked: d, signed: signed[0] }))
                  .catch(e => {
                    resolve({ document, e: e.message });
                  });
              });
            })
            .then(res2 => {
              const docInfo = JSON.parse(document.docInfo);
              const companyName = docInfo.recipient['companyName'];
              const documentNo = docInfo.docDetails['certNo'];
              const values = Object.values(res2);
              const status = { revoked: values[0], signed: values[1] };
              const invInfo = JSON.parse(doc.docInfo);
              const currency = invInfo.docDetails['currency'];
              const invAmt = parseFloat(invInfo.docDetails['finalAmt']).toFixed(2);
              const finalAmt = Number(invAmt);
              const details = { finalAmt, companyName, documentNo, currency };
              delete doc['docInfo'];
              const final = { ...doc, ...status, ...details };
              issuedToArray.push(final);
            });
        } else if (doc.docType == 'SQ') {
          return new Promise(resolve => {
            contract.methods
              .documentSigned(`${document.docHash}`)
              .call()
              .then(s => {
                let signed;
                if (s == 0) {
                  signed = false;
                } else {
                  signed = true;
                }
                return signed;
              })
              .then(f => {
                resolve({ signed: f });
              })
              .catch(e => {
                resolve({ document, e: e.message });
              });
          })
            .then(a => {
              return new Promise(resolve => {
                const signed = Object.values(a);
                contract.methods
                  .isRevoked(`${document.docHash}`)
                  .call()
                  .then(d => resolve({ revoked: d, signed: signed[0] }))
                  .catch(e => {
                    resolve({ document, e: e.message });
                  });
              });
            })
            .then(res2 => {
              const docInfo = JSON.parse(document.docInfo);
              const companyName = docInfo.issuers[0]['name'];
              const documentNo = docInfo.docDetails['quoteNumber'];
              const values = Object.values(res2);
              const status = { revoked: values[0], signed: values[1] };
              const invInfo = JSON.parse(doc.docInfo);
              const currency = invInfo.docDetails['currency'];
              const invAmt = parseFloat(invInfo.docDetails['finalAmt']).toFixed(2);
              const finalAmt = Number(invAmt);
              const details = { finalAmt, companyName, documentNo, currency };
              delete doc['docInfo'];
              const final = { ...doc, ...status, ...details };
              issuedToArray.push(final);
            });
        }
      }),
    );
    const issuedTo = { purchaseDoc: issuedToArray };
    const issuedDocs = { ...issuedBy, ...issuedTo };
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(
      'Result:',
      getUserInfo.email,
      issuedToArray.length + issuedByArray.length,
      duration,
    );
    return issuedDocs;
  }
  async getInvFinancingList(apiToken: string) {
    const financierInfo = await this.tokensService.findOneByToken(apiToken);
    const financierId = financierInfo._id;
    const pendingArr = [];
    const pendingInv = await this.documentModel.aggregate([
      {
        $match: {
          docType: 'Inv',
          financierId: `${financierId}`,
          financingStatus: 1,
        },
      },
      {
        $group: {
          _id: '$issuerDocStore',
          pendingCount: {
            $sum: 1,
          },
        },
      },
    ]);

    for await (const i of pendingInv) {
      const doc = await this.documentModel.findOne({ issuerDocStore: i._id, docType: 'Inv' });
      const docInfo = JSON.parse(doc.docInfo);
      const companyName = docInfo.issuers[0]['name'];
      const email = docInfo.issuers[0].email;
      const finalName = { companyName, email };
      delete i['_id'];
      const finalInv = { ...finalName, ...i };
      pendingArr.push(finalInv);
    }

    const approvedInv = await this.documentModel.aggregate([
      {
        $match: {
          docType: 'Inv',
          financierId: `${financierId}`,
          financingStatus: 2,
        },
      },
      {
        $group: {
          _id: '$issuerDocStore',
          approvedCount: {
            $sum: 1,
          },
        },
      },
    ]);

    const approvedArr = [];
    for await (const i of approvedInv) {
      const doc = await this.documentModel.findOne({ issuerDocStore: i._id, docType: 'Inv' });
      const docInfo = JSON.parse(doc.docInfo);
      const companyName = docInfo.issuers[0]['name'];
      const email = docInfo.issuers[0].email;
      const finalName = { companyName, email };
      delete i['_id'];
      const finalInv = { ...finalName, ...i };
      approvedArr.push(finalInv);
    }

    const declineArr = [];
    const declineInv = await this.documentModel.aggregate([
      {
        $match: {
          docType: 'Inv',
          financierId: `${financierId}`,
          financingStatus: 3,
        },
      },
      {
        $group: {
          _id: '$issuerDocStore',
          declineCount: {
            $sum: 1,
          },
        },
      },
    ]);

    for await (const i of declineInv) {
      const doc = await this.documentModel.findOne({ issuerDocStore: i._id, docType: 'Inv' });
      const docInfo = JSON.parse(doc.docInfo);
      const companyName = docInfo.issuers[0]['name'];
      const email = docInfo.issuers[0].email;
      const finalName = { companyName, email };
      delete i['_id'];
      const finalInv = { ...finalName, ...i };
      declineArr.push(finalInv);
    }

    const map = new Map();
    pendingArr.forEach(item => map.set(item.companyName, item));
    approvedArr.forEach(item =>
      map.set(item.companyName, { ...map.get(item.companyName), ...item }),
    );
    declineArr.forEach(item =>
      map.set(item.companyName, { ...map.get(item.companyName), ...item }),
    );
    const mergedArr = Array.from(map.values());

    const invoiceArr = [];
    for await (const i of mergedArr) {
      if (i.hasOwnProperty('approvedCount') == false) {
        const approvedCount = { approvedCount: 0 };
        const finalDoc = { ...i, ...approvedCount };
        invoiceArr.push(finalDoc);
      } else if (i.hasOwnProperty('pendingCount') == false) {
        const pendingCount = { pendingCount: 0 };
        const finalDoc = { ...i, ...pendingCount };
        invoiceArr.push(finalDoc);
      } else {
        invoiceArr.push(i);
      }
    }

    const invoices = [];
    for await (const i of invoiceArr) {
      if (i.hasOwnProperty('declineCount') == false) {
        const declineCount = { declineCount: 0 };
        const finalDoc = { ...i, ...declineCount };
        invoices.push(finalDoc);
      } else {
        invoices.push(i);
      }
    }
    return { invoices };
  }
  async getDeclineInvoice(apiToken: string) {
    const financierInfo = await this.tokensService.findOneByToken(apiToken);
    const financierId = financierInfo._id;
    const declineArr = [];
    const declineInv = await this.documentModel.aggregate([
      {
        $match: {
          docType: 'Inv',
          financierId: `${financierId}`,
          financingStatus: 3,
        },
      },
      {
        $group: {
          _id: '$issuerDocStore',
          declineCount: {
            $sum: 1,
          },
        },
      },
    ]);

    for await (const i of declineInv) {
      const doc = await this.documentModel.findOne({ issuerDocStore: i._id, docType: 'Inv' });
      const docInfo = JSON.parse(doc.docInfo);
      const companyName = docInfo.issuers[0]['name'];
      const finalName = { companyName };
      delete i['_id'];
      const finalInv = { ...finalName, ...i };
      declineArr.push(finalInv);
      return { declineArr };
    }
  }
  async declineInvoice(invoiceNo: any, apiToken: string) {
    const declineArr = [];
    let supplierEmail;
    let supplierName;

    //get financier name
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const financierCompany = getUserInfo.companyName;
    for await (const i of invoiceNo) {
      const invNo = i.invNo;
      await this.documentModel.findOneAndUpdate(
        { invNo },
        { financingStatus: 3, financierId: getUserInfo._id, updatedAt: Date.now() },
      );
      const doc = await this.documentModel
        .findOne({ invNo }, { _id: 0, invNo: 1, financingStatus: 1, docInfo: 1 })
        .lean();
      doc.docInfo = JSON.parse(doc.docInfo);
      supplierEmail = doc.docInfo.issuers[0].email;
      supplierName = doc.docInfo.issuers[0].name;
      delete doc.docInfo;
      declineArr.push(doc);
    }

    //create list of invoice in html
    let html = `<ol type='1'>`;

    declineArr.forEach(x => {
      html += `<li>${x.invNo}</li>`;
    });
    html += `</ol>`;

    //send supplier email
    this.mailerService.sendSupplierFinancingRequestDenied(
      supplierEmail,
      html,
      supplierName,
      financierCompany,
    );
    return declineArr;
  }

  // async revokeDocuments(apiToken: string, _docHash: string) {
  //   const web3 = await this.web3Service.getWeb3();
  //   const getUserInfo = await this.tokensService.findOneByToken(apiToken);
  //   const getUserAddr = getUserInfo.wallet.address;
  //   const factoryContract = new web3.eth.Contract(
  //     JSON.parse(process.env.DocStoreFactoryABI),
  //     process.env.DOCSTORE_FACTORY,
  //   );
  //   const docStore = await factoryContract.methods.assets(getUserAddr).call();
  //   const issuerPrivateKey = await getUserInfo.getPrivateKey();

  //   //Issue Document
  //   const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);

  //   const data = await contract.methods.revoke(_docHash).encodeABI();
  //   const nonce = await web3.eth.getTransactionCount(getUserInfo.wallet.address, 'pending');

  //   const rawTx = {
  //     nonce: web3.utils.toHex(nonce),
  //     gasPrice: web3.utils.toHex(
  //       (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
  //         100,
  //     ),
  //     to: docStore,
  //     gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
  //     value: web3.utils.toHex(web3.utils.toWei('0')),
  //     data: data,
  //   };

  //   //Execute smart contract
  //   const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
  //   tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
  //   const serializedTx = tx.serialize();
  //   await web3.eth
  //     .sendSignedTransaction('0x' + serializedTx.toString('hex'))
  //     .on('receipt', console.log);

  //   // is Revoked
  //   const isRevoked = await contract.methods.isRevoked(_docHash).call();

  //   if (isRevoked) {
  //     const revokedBlockNo = await contract.methods.documentRevoked(_docHash).call();
  //     let revokedUnix: any = await (await web3.eth.getBlock(revokedBlockNo)).timestamp;
  //     revokedUnix *= 1000;
  //     await this.documentModel.findOneAndUpdate({ docHash: _docHash }, { updatedAt: revokedUnix });
  //   }

  //   //Get Signer
  //   const docInfo = await this.documentModel.findOne(
  //     { docHash: _docHash },
  //     { docInfo: 1, wrapDocInfo: 1, docType: 1 },
  //   );
  //   if (docInfo.docType == 'TVC') {
  //     return { isRevoked, docHash: _docHash };
  //   } else {
  //     const docInfoJson = JSON.parse(docInfo.docInfo);
  //     const signerEmail = docInfoJson.recipient.emailAddress;
  //     const doc1 = await this.documentModel.findOne({ docHash: _docHash });
  //     const docType = doc1.docType;
  //     const signerCompany = docInfoJson.recipient.companyName;
  //     const docNumber = docInfoJson.docDetails.quoteNumber;
  //     const issuerCompany = getUserInfo.companyName;
  //     let signerName = docInfoJson.recipient.name;
  //     let docTypeShow: string;
  //     let fileName: string;
  //     let docNo: string;
  //     if (docType == 'SQ') {
  //       docTypeShow = 'Sales Quotation';
  //       docNo = docInfoJson.docDetails.quoteNumber;
  //       fileName = `${docInfoJson.docDetails.quoteNumber}-SQ.json`;
  //     } else if (docType == 'Inv') {
  //       docTypeShow = 'Invoice';
  //       docNo = docInfoJson.docDetails.invNo;
  //       fileName = `${docInfoJson.docDetails.invNo}-Inv.json`;
  //       const signer = await this.userModel
  //         .findOne({ email: signerEmail }, { _id: 0, name: 1 })
  //         .lean();
  //       signerName = signer.name;
  //     } else if (docType == 'PC') {
  //       docTypeShow = 'Payment Certificate';
  //       docNo = docInfoJson.docDetails.certNo;
  //       fileName = `${docInfoJson.docDetails.certNo}-PC.json`;
  //     } else if (docType == 'DO') {
  //       docTypeShow = 'Delivery Order';
  //     }

  //     // Get wrapped docInfo
  //     const wrapDoc = JSON.parse(docInfo.wrapDocInfo);
  //     const wrapDocInfo = JSON.stringify(wrapDoc);
  //     const folderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'foo-'));
  //     const finalFile = `${folderPath}/${fileName}`;
  //     fs.writeFileSync(finalFile, wrapDocInfo);
  //     const file = Buffer.from(fs.readFileSync(finalFile).toString('base64'));

  //     //Send Email
  //     const link = `${process.env.BASEURL ?? 'http://localhost:3000'}${process.env.API_PREFI ??
  //       '/api/v1'}/hash/${_docHash}`;
  //     this.mailerService.sendRevokeEmail(
  //       signerEmail,
  //       link,
  //       docTypeShow,
  //       signerCompany,
  //       docNo,
  //       issuerCompany,
  //       signerName,
  //       fileName,
  //       file,
  //     );

  //     //if document is a financed invoice
  //     if (docType == 'Inv' && doc1.financingStatus == 2) {
  //       const financier = await this.usersService.findOneById(doc1.financierId);
  //       const financierCompany = financier.companyName;
  //       const financierEmail = financier.email;
  //       //send revoke to buyer
  //       this.mailerService.sendRevokeInvEmail(
  //         signerEmail,
  //         link,
  //         docTypeShow,
  //         signerCompany,
  //         docNo,
  //         issuerCompany,
  //         signerName,
  //         fileName,
  //         file,
  //       );
  //       //send to financier
  //       this.mailerService.sendRevokeInvEmail(
  //         financierEmail,
  //         link,
  //         docTypeShow,
  //         signerCompany,
  //         docNo,
  //         issuerCompany,
  //         financierCompany,
  //         fileName,
  //         file,
  //       );
  //     }
  //     //Check Amt of Ether User's Wallet
  //     this.usersService.etherCheck(getUserAddr);

  //     return { isRevoked, docHash: _docHash };
  //   }
  // }

  async getSQList(apiToken: string) {
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );

    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const findDocument = await this.documentModel.find(
      { signerDocStore: docStore, docType: 'SQ' },
      { docInfo: 1, quoteNumber: 1, _id: 0 },
    );
    const SQArray = [];
    for await (const i of findDocument) {
      const doc = i.toObject();
      const docInfo = JSON.parse(doc.docInfo);
      const issuerName = docInfo.issuers[0]['name'];
      const nameObj = { issuerName };
      delete doc['docInfo'];
      const final = { ...nameObj, ...doc };
      const finalSQArr = SQArray.push(final);
    }

    return { list: SQArray };
  }

  async getInvList(apiToken: string) {
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );

    const issuerDocStore = await factoryContract.methods.assets(getUserAddr).call();
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), issuerDocStore);

    const findDocument = await this.documentModel.find(
      { issuerDocStore, docType: 'Inv' },
      { financingStatus: 1, docInfo: 1, docHash: 1, _id: 0 },
    );
    const invArr = [];
    await Promise.all(
      findDocument.map(document => {
        return new Promise(resolve => {
          contract.methods
            .isRevoked(`${document.docHash}`)
            .call()
            .then(d => resolve({ revoked: d }))
            .catch(e => {
              resolve({ document, e: e.message });
            });
        }).then(result => {
          const docObj = document.toObject();
          const docInfo = JSON.parse(document.docInfo);
          const buyerEmail = docInfo.recipient.emailAddress;
          const buyerName = docInfo.recipient.companyName;
          const invAmt = parseFloat(docInfo.docDetails.finalAmt).toFixed(2);
          const finalAmt = Number(invAmt);
          const terms = docInfo.docDetails.terms * 86400;
          const invNo = docInfo.docDetails.invNo;
          const invDate = docInfo.docDetails.date;
          const currency = docInfo.docDetails.currency;
          const values = Object.values(result);
          const revoked = { isRevoked: values[0] };
          const dueDate = invDate + terms;
          const doc = { invNo, buyerName, buyerEmail, finalAmt, invDate, dueDate, currency };
          delete docObj['docInfo'];
          const final = { ...docObj, ...doc, ...revoked };
          invArr.push(final);
        });
      }),
    );
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('getInvList:', getUserInfo.email, duration);
    return { invoices: invArr };
  }

  async contractStatus(_docStore: string, docHash: string) {
    const web3 = await this.web3Service.getWeb3();
    const docStore = _docStore;
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);
    const issuedBlockNo = await contract.methods.getIssuedBlock(docHash).call();
    let issuedUnix: any = await (await web3.eth.getBlock(issuedBlockNo)).timestamp;
    issuedUnix *= 1000;
    const signedblockNo = await contract.methods.documentSigned(docHash).call();
    let signedUnix: any = await (await web3.eth.getBlock(signedblockNo)).timestamp;
    signedUnix *= 1000;

    const revokedBlockNo = await contract.methods.documentRevoked(docHash).call();
    let revokedUnix: any = await (await web3.eth.getBlock(revokedBlockNo)).timestamp;
    revokedUnix *= 1000;
    // const isIssued = await contract.methods.isIssued(docHash).call();
    // const isSigned = await contract.methods.documentSigned(`${docHash}`).call();
    // let signed;
    // if ( isSigned == 0 ) {
    //   signed = false;
    // } else {
    //   signed = true;
    // }
    return { issuedBlockNo, issuedUnix, signedblockNo, signedUnix, revokedBlockNo, revokedUnix };
  }

  async getStatus(apiToken: string, _quoteNumber: string) {
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    let findDocument = [];
    findDocument = await this.documentModel.find({ quoteNumber: _quoteNumber });
    const status = {
      quotationSent: null,
      quotationSigned: null,
      quotationRevoked: null,
      paymentCertSent: null,
      paymentCertSigned: null,
      paymentCertRevoked: null,
      invoiceSent: null,
      invoiceRevoked: null,
    };

    for (let i = 0; i < findDocument.length; i++) {
      if (
        docStore == findDocument[i].issuerDocStore ||
        docStore == findDocument[i].signerDocStore
      ) {
        if (findDocument[i].docType == 'SQ') {
          const statuses = await this.contractStatus(
            findDocument[i].issuerDocStore,
            findDocument[i].docHash,
          );
          if (statuses.issuedBlockNo != 0) {
            status['quotationSent'] = statuses.issuedUnix;
          }
          if (statuses.signedblockNo != 0) {
            status['quotationSigned'] = statuses.signedUnix;
          }
          if (statuses.revokedBlockNo != 0) {
            status['quotationRevoked'] = statuses.revokedUnix;
          }
        } else if (findDocument[i].docType == 'PC') {
          const buyerStatus = await this.contractStatus(
            findDocument[i].signerDocStore,
            findDocument[i].docHash,
          );
          if (buyerStatus.issuedBlockNo != 0) {
            status['paymentCertSent'] = buyerStatus.issuedUnix;
          }
          if (buyerStatus.signedblockNo != 0) {
            status['paymentCertSigned'] = buyerStatus.signedUnix;
          }
          if (buyerStatus.revokedBlockNo != 0) {
            status['paymentCertRevoked'] = buyerStatus.revokedUnix;
          }
        } else if (findDocument[i].docType == 'Inv') {
          const statuses = await this.contractStatus(
            findDocument[i].issuerDocStore,
            findDocument[i].docHash,
          );
          if (statuses.issuedBlockNo != 0) {
            status['invoiceSent'] = statuses.issuedUnix;
          }
          if (statuses.revokedBlockNo != 0) {
            status['invoiceRevoked'] = statuses.revokedUnix;
          }
        }
      }
    }
    return status;
  }

  async getFinInvList(apiToken: string, supplierEmail: string) {
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserRole = getUserInfo.role;
    const getSupplier = await this.usersService.findOneByEmail(supplierEmail);
    const supplierWallet = getSupplier.wallet.address;
    const userId = getUserInfo._id;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const supplierDocStore = await factoryContract.methods.assets(supplierWallet).call();
    const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), supplierDocStore);
    if (getUserRole == 'financier') {
      const invoice = await this.documentModel.find(
        { issuerDocStore: supplierDocStore, financierId: userId },
        { _id: 0, __v: 0 },
      );
      const invoices = [];
      for (let i = 0; i < invoice.length; i++) {
        const documentObj = JSON.parse(invoice[i].docInfo);
        const buyerInfo = await this.usersService.findOneByEmail(
          documentObj.recipient.emailAddress,
        );
        const buyerIndividualName = buyerInfo.name;
        const buyerDesignation = buyerInfo.designation;
        const isRevoked = await contract.methods.isRevoked(invoice[i].docHash).call();
        const dict = {
          supplierName: documentObj.issuers[0].name,
          buyerEmail: documentObj.recipient.emailAddress,
          buyerName: documentObj.recipient.companyName,
          buyerIndividualName: buyerIndividualName,
          buyerDesignation: buyerDesignation,
          docHash: invoice[i].docHash,
          issuerDocStore: invoice[i].issuerDocStore,
          docType: invoice[i].docType,
          docInfo: invoice[i].docInfo,
          financingStatus: invoice[i].financingStatus,
          updatedAt: invoice[i].updatedAt,
          createdAt: invoice[i].createdAt,
          invNo: documentObj.docDetails.invNo,
          invAmt: documentObj.docDetails.finalAmt,
          invDate: documentObj.docDetails.date,
          invDueDate: documentObj.docDetails.terms * 86400000 + documentObj.docDetails.date,
          isRevoked,
        };
        invoices.push(dict);
      }
      return { invoices };
    } else {
      throw 'User not authorised';
    }
  }

  async getInvChart(apiToken: string) {
    const financierInfo = await this.tokensService.findOneByToken(apiToken);
    const financierId = financierInfo._id;
    if (financierInfo.role == 'financier') {
      const invInfo = await this.documentModel.find(
        { financierId, docType: 'Inv' },
        { docInfo: 1, financingStatus: 1, docHash: 1 },
      );
      const rawArr = { invoices: [] };
      for await (const i of invInfo) {
        const docInfo = JSON.parse(i.docInfo);
        const companyName = docInfo.issuers[0].name;
        const email = docInfo.issuers[0].email;
        const amount = Number(docInfo.docDetails.finalAmt);
        const date = docInfo.docDetails.date;
        const financingStatus = i.financingStatus;
        const docHash = i.docHash;
        const rawInfo = { docHash, companyName, email, amount, date, financingStatus };
        rawArr.invoices.push(rawInfo);
      }
      return rawArr;
    } else {
      return 'User not a Financier Role';
    }
  }

  async getInvChartEnterprise(apiToken: string) {
    const web3 = await this.web3Service.getWeb3();
    const enterpriseInfo = await this.tokensService.findOneByToken(apiToken);
    const supplierWallet = enterpriseInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const issuerDocStore = await factoryContract.methods.assets(supplierWallet).call();
    if (enterpriseInfo.role == 'enterprise') {
      const invInfo = await this.documentModel.find(
        { issuerDocStore, docType: 'Inv' },
        { docInfo: 1, financingStatus: 1, docHash: 1 },
      );
      const rawArr = { invoices: [] };
      for await (const i of invInfo) {
        const docInfo = JSON.parse(i.docInfo);
        const companyName = docInfo.recipient.companyName;
        const email = docInfo.recipient.emailAddress;
        const amount = Number(docInfo.docDetails.finalAmt);
        const date = docInfo.docDetails.date;
        const financingStatus = i.financingStatus;
        const docHash = i.docHash;
        const rawInfo = { docHash, companyName, email, amount, date, financingStatus };
        rawArr.invoices.push(rawInfo);
      }
      return rawArr;
    } else {
      return 'User not an Enterprise Role';
    }
  }

  async getNoaList(apiToken: string) {
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const issuerDocStore = await factoryContract.methods.assets(getUserAddr).call();
    const financingReqDoc = await this.batchesModel.find({ issuerDocStore, docType: 'FR' });
    const frArr = [];
    for await (const i of financingReqDoc) {
      const docHash = i.docHash;
      const docInfo = JSON.parse(i.docInfo);
      //Get Invoices Requested
      const invArr = [];
      for await (const i of docInfo.reqInfo) {
        invArr.push(i.invNo);
      }

      //Get Total Invoice Count
      const totalCount = invArr.length;

      //Get Approved/Declined Invoice Count
      const approvedCount = [];
      for await (const i of invArr) {
        const approveInv = await this.documentModel.find({ invNo: i, financingStatus: 2 });
        const declineInv = await this.documentModel.find({ invNo: i, financingStatus: 3 });
        approvedCount.push({ approved: approveInv.length, declined: declineInv.length });
      }

      const mergeCount = data => {
        const result = {};
        data.forEach(basket => {
          for (const [key, value] of Object.entries(basket)) {
            if (result[key]) {
              result[key] += value;
            } else {
              result[key] = value;
            }
          }
        });
        return result;
      };

      const mergedObject = mergeCount(approvedCount);

      //Doc Info
      const financierEmail = docInfo.financierDetails.email;
      const financierInfo = await this.usersService.findOneByEmail(financierEmail);
      const financier = financierInfo.companyName;
      const docName = i.docName;
      const frInfo = {
        docHash,
        financier,
        docName,
        createdAt: i.createdAt,
        totalCount,
        mergedCount: mergedObject,
      };
      frArr.push(frInfo);
    }
    return frArr;
  }

  async getFinancierNameList() {
    const listOfCompanies = await this.userModel.find(
      { role: 'financier' },
      { companyName: 1, _id: 0 },
    );
    return { listOfCompanies };
  }

  async getFinancierDetails(_companyName: string) {
    return await this.userModel.findOne(
      { role: 'financier', companyName: _companyName },
      { financierDetails: 1, _id: 0, email: 1, companyName: 1 },
    );
  }

  async getFinancingDocument(_docHash: string) {
    const doc = await this.batchesModel.findOne({ docHash: _docHash }, { _id: 0, __v: 0 }).lean();
    if (doc.docType == 'NOA') {
      const oaStatus = { oaStatus: await this.verifyDocumentOAFinance(_docHash) };
      doc.docInfo = JSON.parse(doc.docInfo);
      delete doc.docInfo.name;
      const frInfo = await this.batchesModel.findOne({ noaDocHash: _docHash, docType: 'FR' });
      doc.docInfo.name = frInfo.docName;
      return { ...doc, ...oaStatus };
    } else {
      doc.docInfo = JSON.parse(doc.docInfo);
      return doc;
    }
  }

  async getSpecificTransaction(invHash: string, supplierEmail: string) {
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.usersService.findOneByEmail(supplierEmail);

    const inv = await this.documentModel.findOne({ docHash: invHash });
    const _transId = inv.transId;
    const documents = await this.documentModel.find(
      { transId: _transId },
      { docType: 1, docHash: 1, _id: 0, createdAt: 1, updatedAt: 1, signerDocStore: 1 },
    );
    console.log('documentsBef', documents);
    const noaList = await this.batchesModel.find({ docType: 'NOA' }).lean();

    noaList.forEach(e => {
      e.docInfo = JSON.parse(e.docInfo);
      for (let i = 0; i < e.docInfo.reqInfo.length; i++) {
        if (e.docInfo.reqInfo[i].transId == _transId) {
          const dict = {
            docHash: e.docHash,
            docType: 'NOA',
            updatedAt: e.updatedAt,
            createdAt: e.createdAt,
          };
          documents.push(dict);
        }
      }
    });
    console.log('documentsAft', documents);

    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    // let statuses = {
    //   'quotationSent': null,
    //   'quotationSigned': null,
    //   'quotationRevoked': null,
    //   'paymentCertSent': null,
    //   'paymentCertSigned': null,
    //   'paymentCertRevoked': null,
    //   'invoiceSent': null,
    //   'invoiceRevoked': null,
    //   'noaSent': null,
    //   'noaAccepted': null,
    //   'noaRevoked': null,
    // };

    // for (let i = 0; i < documents.length; i++) {
    //   console.log(documents[i])
    //   if (documents[i].docType == "SQ") {
    //     const status = await this.contractStatus(docStore, documents[i].docHash);
    //     console.log("SQ", status)
    //     if (status.issuedBlockNo != 0) {
    //       statuses['quotationSent'] = status.issuedUnix;
    //     }
    //     if (status.signedblockNo != 0) {
    //       statuses['quotationSigned'] = status.signedUnix;
    //     }
    //     if (status.revokedBlockNo != 0) {
    //       statuses['quotationRevoked'] = status.revokedUnix;
    //     }
    //   }
    //   else if (documents[i].docType == 'PC') {
    //     const status = await this.contractStatus(documents[i].signerDocStore, documents[i].docHash)
    //     console.log("PC", status)
    //     if (status.issuedBlockNo != 0) {
    //       statuses['paymentCertSent'] = status.issuedUnix;
    //     }
    //     if (status.signedblockNo != 0) {
    //       statuses['paymentCertSigned'] = status.signedUnix;
    //     }
    //     if (status.revokedBlockNo != 0) {
    //       statuses['paymentCertRevoked'] = status.revokedUnix;
    //     }
    //   }
    //   else if (documents[i].docType == 'Inv') {
    //     const status = await this.contractStatus(docStore, documents[i].docHash);
    //     console.log("Inv", status)
    //     if (status.issuedBlockNo != 0) {
    //       statuses['invoiceSent'] = status.issuedUnix;
    //     }
    //     if (status.revokedBlockNo != 0) {
    //       statuses['invoiceRevoked'] = status.revokedUnix;
    //     }
    //   }
    //   else if (documents[i].docType == "NOA") {
    //     const status = await this.contractStatus(docStore, documents[i].docHash);
    //     console.log("NOA", status)
    //     if (status.issuedBlockNo != 0) {
    //       statuses['noaSent'] = status.issuedUnix;
    //     }
    //     if (status.signedblockNo != 0) {
    //       statuses['noaAccepted'] = status.signedUnix;
    //     }
    //     if (status.revokedBlockNo != 0) {
    //       statuses['noaRevoked'] = status.revokedUnix;
    //     }
    //   }
    // }

    //restructure output
    const documentList = [];
    for await (const element of documents) {
      let docNo;
      let status;
      if (element.docType == 'SQ') {
        const doc = await this.documentModel.findOne({ docHash: element.docHash });
        docNo = doc.quoteNumber;
        status = await this.contractStatus(docStore, element.docHash);
      } else if (element.docType == 'PC') {
        const doc = await this.documentModel.findOne({ docHash: element.docHash });
        const docInfo = JSON.parse(doc.docInfo);
        docNo = docInfo.docDetails.certNo;
        status = await this.contractStatus(element.signerDocStore, element.docHash);
      } else if (element.docType == 'Inv') {
        const doc = await this.documentModel.findOne({ docHash: element.docHash });
        const docInfo = JSON.parse(doc.docInfo);
        docNo = docInfo.docDetails.invNo;
        status = await this.contractStatus(docStore, element.docHash);
      } else if (element.docType == 'NOA') {
        const noaDoc = await this.batchesModel.findOne({
          noaDocHash: element.docHash,
          docType: 'FR',
        });
        docNo = noaDoc.docName;
        status = await this.contractStatus(docStore, element.docHash);
      }
      const dict = {
        docHash: element.docHash,
        docType: element.docType,
        docNo,
        revoked: status.revokedBlockNo != 0 ? status.revokedUnix : null,
        signed: status.signedblockNo != 0 ? status.signedUnix : null,
        issued: status.issuedBlockNo != 0 ? status.issuedUnix : null,
      };
      documentList.push(dict);
    }

    return { documentList };
  }

  async buyerNoaList(apiToken: string) {
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.tokensService.findOneByToken(apiToken);
    const getUserAddr = getUserInfo.wallet.address;
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const docStore = await factoryContract.methods.assets(getUserAddr).call();
    const invList = await this.documentModel
      .find({ docType: 'Inv', signerDocStore: docStore })
      .lean();
    const invNoArr = [];

    invList.forEach(element => {
      invNoArr.push(element.invNo);
    });

    const noaList = await this.batchesModel.find({ docType: 'NOA' }).lean();

    const relatedNOAList = [];
    for await (const noa of noaList) {
      noa.docInfo = JSON.parse(noa.docInfo);
      if (invNoArr.includes(noa.docInfo.reqInfo[0].invNo) == true) {
        const buyerInfo = noa.docInfo.recipient;
        const supplierInfo = {
          name: noa.docInfo.issuers[0].individualName,
          address: noa.docInfo.issuers[0].address,
          zipcode: noa.docInfo.issuers[0].zipcode,
        };
        const invNo = noa.docInfo.reqInfo[0].invNo;
        const invInfo = await this.documentModel.findOne(
          { invNo, docType: 'Inv' },
          { docHash: 1, docInfo: 1 },
        );
        const frInfo = await this.batchesModel.findOne({ invHashArr: invInfo.docHash });
        const docName = frInfo.docName;
        const financierEmail = noa.docInfo.financierDetails.email;
        const financierUser = await this.userModel.findOne(
          { email: financierEmail },
          {
            wallet: 0,
            _id: 0,
            activeEmail: 0,
            activeOTP: 0,
            uen: 0,
            password: 0,
            role: 0,
            __v: 0,
            created: 0,
            updated: 0,
          },
        );
        const financierCompany = financierUser.companyName;
        const supplierDesignation = await this.userModel.findOne(
          { email: noa.docInfo.issuers[0].email },
          { _id: 0, designation: 1 },
        );
        const invArr = [];
        for await (const i of noa.docInfo.reqInfo) {
          invArr.push(i.invNo);
        }

        const approvedCount = [];
        for await (const i of invArr) {
          const approveInv = await this.documentModel.find({ invNo: i, financingStatus: 2 });
          const declineInv = await this.documentModel.find({ invNo: i, financingStatus: 3 });
          approvedCount.push({ approved: approveInv.length, declined: declineInv.length });
        }

        const mergeCount = data => {
          const result = {};
          data.forEach(basket => {
            for (const [key, value] of Object.entries(basket)) {
              if (result[key]) {
                result[key] += value;
              } else {
                result[key] = value;
              }
            }
          });
          return result;
        };

        const mergedObject = mergeCount(approvedCount);
        const dict = {
          createdAt: noa.createdAt,
          numberOfInvoices: noa.docInfo.reqInfo.length,
          financierCompany: financierCompany,
          noaInfo: noa.docInfo.noaDetails,
          invDetails: noa.docInfo.reqInfo,
          financierInfo: financierUser,
          supplierEmail: noa.docInfo.issuers[0].email,
          supplierDesignation: supplierDesignation,
          buyerInfo: buyerInfo,
          supplierInfo: supplierInfo,
          docName: docName,
          invNo: invArr,
          mergeCount: mergedObject,
        };
        relatedNOAList.push(dict);
      }
    }
    return relatedNOAList;
  }

  async getWrappedDocument(_docHash: string) {
    const wrappedDoc = await this.documentModel.findOne(
      { docHash: _docHash },
      { wrapDocInfo: 1, _id: 0 },
    );
    const TTfile = JSON.parse(wrappedDoc.wrapDocInfo);
    return TTfile;
  }

  async revokeTvCertificates(apiToken: string, docHash: string, isBatch: string) {
    console.log('1', apiToken, '2', docHash, '3', isBatch);
    let loginUserEmail;
    try {
      logger.info(`Jedsign.service: revokeTvCertificates: Started: docHash: ${docHash}`);
      logger.info(`Jedsign.service: revokeTvCertificates: Started: isBatch: ${isBatch}`);
      // if(isBatch === "1")
      // {
      //   logger.info(`Jedsign.service: revokeTvCertificates: Started:  true`);
      // }
      // else{
      //   logger.info(`Jedsign.service: revokeTvCertificates: Started:  false`);
      // }
      // return

      const web3 = await this.web3Service.getWeb3();
      const getUserInfo = await this.tokensService.findOneByToken(apiToken);
      loginUserEmail = getUserInfo.email;
      const getUserAddr = getUserInfo.wallet.address;
      const factoryContract = new web3.eth.Contract(
        JSON.parse(process.env.DocStoreFactoryABI),
        process.env.DOCSTORE_FACTORY,
      );
      const docStore = await factoryContract.methods.assets(getUserAddr).call();
      const issuerPrivateKey = await getUserInfo.getPrivateKey();

      //Revoke Documents
      const contract = new web3.eth.Contract(JSON.parse(process.env.DocStoreABI), docStore);

      const data = await contract.methods.revoke(docHash).encodeABI();
      const nonce = await web3.eth.getTransactionCount(getUserInfo.wallet.address, 'pending');

      const rawTx = {
        nonce: web3.utils.toHex(nonce),
        gasPrice: web3.utils.toHex(
          (this.web3Service.gasPrice.average *
            (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
            100,
        ),
        to: docStore,
        gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
        value: web3.utils.toHex(web3.utils.toWei('0')),
        data: data,
      };

      // Execute Smart Contract
      const tx = await new EthereumTx(rawTx, { chain: `${process.env.ISSUEDOC_NETWORK}` });
      tx.sign(Buffer.from(`${issuerPrivateKey}`, 'hex'));
      const serializedTx = tx.serialize();
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: `jedsign.service: revokeTvCertificates:  ${getUserInfo.email} : Before calling root_created`,
      });
      const rootData = { data: serializedTx.toString('hex'), email: getUserInfo.email };
      this.client.emit<any>('root_created', rootData);
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: `jedsign.service: revokeTvCertificates:   ${getUserInfo.email} : After calling root_created`,
      });
      await web3.eth
        .sendSignedTransaction('0x' + serializedTx.toString('hex'))
        .on('receipt', console.log);

      // check if it is revoked
      //const isRevoked = await contract.methods.isRevoked(docHash).call();
      const isRevoked = 0;
      let filter, updateDocument, merkleRoot;
      //Update DocumentDB
      logger.info(`Jedsign.service: revokeTvCertificates: docHash: ${docHash}`);
      logger.info(`Jedsign.service: revokeTvCertificates: isBatch: ${isBatch}`);
      console.log(isBatch);
      //logger.info(`Jedsign.service: revokeTvCertificates: isBatch === true: ${isBatch === true}`);
      logger.info(`Jedsign.service: revokeTvCertificates: isBatch === true: ${isBatch === '1'}`);

      if (isBatch === '1') {
        console.log('haha');
        //get All certs by merkle root
        const getCerts = await this.documentModel.find({ issuerDocStore: docStore });
        logger.info(`Jedsign.service: revokeTvCertificates: getCerts:`, getCerts);
        getCerts.map(async document => {
          logger.info(`Jedsign.service: revokeTvCertificates: document:`, document);
          const wrapCertInfo = JSON.parse(document.wrapDocInfo);
          logger.info(
            `Jedsign.service: revokeTvCertificates: wrapCertInfo.signature.merkleRoot:`,
            wrapCertInfo.signature.merkleRoot,
          );
          logger.info(`Jedsign.service: revokeTvCertificates: docHash:`, docHash);
          merkleRoot = `0x${wrapCertInfo.signature.merkleRoot}`;
          logger.info(
            `Jedsign.service: revokeTvCertificates: docHash check:`,
            docHash === merkleRoot,
          );
          if (docHash === merkleRoot) {
            //Update Database
            filter = { docHash: document.docHash };
            updateDocument = { $set: { revokedDate: 1, isBatchRevoke: true } };
            const result = await this.documentModel.updateOne(filter, updateDocument);
          }
        });
      } else {
        logger.info(
          `Jedsign.service: revokeTvCertificates:Single Revoke: Started:docHash: ${docHash}`,
        );
        filter = { docHash: docHash };
        updateDocument = { $set: { revokedDate: 1 } };
        const result = await this.documentModel.updateOne(filter, updateDocument);
        logger.info(`Jedsign.service: revokeTvCertificates:Single Revoke: result:`, result);
      }
      return { docHash, isRevoked };
    } catch (ex) {
      logger.info('Jedsign.service: revokeTvCertificates: Error: ', ex);
      this.logService.create({
        type: 'info',
        category: 'Jcert-API',
        description: `jedsign.service: revokeTvCertificates: ${loginUserEmail}:  Error:   ${ex.message}`,
      });
      this.sendErrorToUser(loginUserEmail, ex.message, 'Revoke Certificate');
      throw ex;
    }
  }

  async sendErrorToUser(email, eMessage, method) {
    console.log('sendErrorToUser:email: ', email);
    console.log('sendErrorToUser:eMessage: ', eMessage);
    this.mailerService.sendErrorToUser(email, eMessage, method);
    this.mailerService.sendErrorToUser(process.env.AdminEmail, eMessage, method);
  }

  private getWorkerCount(itemCount: number): number {
    const cpuCount = cpus().length;
    console.log('getWorkerCount: cpuCount:', cpuCount);
    console.log('getWorkerCount: itemCount:', itemCount);
    if (itemCount < 100) return 0;

    if (itemCount / 2 < cpuCount) return (itemCount / 2) | 0;

    if (itemCount < 2000) return cpuCount;

    return cpuCount * 2;
  }

  private hashToBuffer(hash: Hash): Buffer {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore https://github.com/Microsoft/TypeScript/issues/23155
    return Buffer.isBuffer(hash) && hash.length === 32 ? hash : Buffer.from(hash, 'hex');
  }

  // private async wrapDocuments(rawJSONArr: any, workerCount: number) {
  //   const minSize = rawJSONArr.length / workerCount;
  //   const workers: Array<WrapperWorker> = [];

  //   for (let i = 0; i < workerCount; i++) {
  //     workers.push(new WrapperWorker(i.toString()));
  //     workers[i].worker.postMessage({
  //       id: i,
  //       rawJSONArr: i < workerCount - 1 ? rawJSONArr.splice(0, minSize) : rawJSONArr.splice(0),
  //     });
  //   }

  //   await waitForAll(
  //     'done',
  //     workers.map(w => w.emitter),
  //     () => {
  //       workers.forEach(w => w.worker.terminate(0));
  //     },
  //   );

  //   const wrappedDocuments = [];
  //   workers.forEach(w => wrappedDocuments.push(...w.output));
  //   return wrappedDocuments;
  // }
  async wrapDocuments(rawJSONArr: any, workerCount: number) {
    const minSize = rawJSONArr.length / workerCount;
    const workers: Array<WrapperWorker> = [];

    for (let i = 0; i < workerCount; i++) {
      workers.push(new WrapperWorker(i.toString()));
      workers[i].worker.postMessage({
        id: i,
        rawJSONArr: i < workerCount - 1 ? rawJSONArr.splice(0, minSize) : rawJSONArr.splice(0),
      });
    }

    await waitForAll(
      'done',
      workers.map(w => w.emitter),
      () => {
        workers.forEach(w => w.worker.terminate(0));
      },
    );

    const documents = [];
    workers.forEach(w => documents.push(...w.output));

    // get all the target hashes to compute the merkle tree and the merkle root
    const merkleTree = new MerkleTree(
      documents.map(document => document.signature.targetHash).map(this.hashToBuffer),
    );
    const merkleRoot = merkleTree.getRoot().toString('hex');

    // for each document, update the merkle root and add the proofs needed
    return documents.map(document => {
      const merkleProof = merkleTree
        .getProof(this.hashToBuffer(document.signature.targetHash))
        .map((buffer: Buffer) => buffer.toString('hex'));
      return {
        ...document,
        schema:
          'https://schemata.openattestation.com/sg/gov/tech/notarise/1.0/notarise-open-attestation-schema.json',
        signature: {
          ...document.signature,
          proof: merkleProof,
          merkleRoot,
        },
      };
    });
  }
}
