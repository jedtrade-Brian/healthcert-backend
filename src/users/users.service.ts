import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { getRandomCode, compare, hash } from '../utils/crypto';
import { MailerService } from '../mailer/mailer.service';
import { Web3Service } from 'src/web3/web3.service';
import fs = require('fs');
import { CreateFinancierDto } from './dto/create-financier.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const EthereumTx = require('ethereumjs-tx').Transaction;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<User>,
    @InjectModel('Otp') private readonly otpModel: Model<any>,
    @InjectModel('DocStore') private readonly storeModel: Model<any>,
    private readonly mailerService: MailerService,
    private readonly web3Service: Web3Service,
  ) {}

  async sendOtp(user: User) {
    const code = getRandomCode();
    const otp = new this.otpModel({
      code,
      email: user.email,
      mobileNo: user.mobileNo,
      userId: user._id,
    });
    await otp.save();
    this.mailerService.sendActivationMsg(user.mobileNo, code);
  }

  async sendOtpNOA(user: User, docHash: any) {
    const code = getRandomCode();
    const otp = new this.otpModel({ code, email: user.email, mobileNo: user.mobileNo, docHash });
    await otp.save();
    this.mailerService.sendActivationMsg(user.mobileNo, code);
  }

  private async sendEmailOTP(user: User) {
    const code = getRandomCode();
    const otp = new this.otpModel({ code, email: user.email, mobileNo: user.mobileNo });
    await otp.save();
    const encode = Buffer.from(`${user.email}:${code}`).toString('base64');
    // TODO: FIXME: replace localhost with url from env
    const link = `${process.env.BASEURL ?? 'http://localhost:3000'}${process.env.API_PREFI ??
      '/api/v1'}/auth/verify/${encode}`;
    const userInfo = await this.userModel.findOne({ email: user.email });
    const name = userInfo.name;
    this.mailerService.sendActivationEmail(user.email, link, name);
  }

  async create(createUserDto: CreateUserDto) {
    const startTime = new Date();
    const web3 = await this.web3Service.getWeb3();
    await this.web3Service.updateGasPrice();

    const createUser = new this.userModel(createUserDto);
    await createUser.save();

    const userPrivateKey = createUser.getPrivateKey();
    console.log(userPrivateKey);
    const userAddr = createUser.wallet.address;
    const userEmail = createUser.email;
    const userCompany = createUser.companyName;
    const nonce = await web3.eth.getTransactionCount(process.env.WALLET_ADDR, 'pending');
    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      to: web3.utils.toHex(createUser.wallet.address),
      value: web3.utils.toHex(web3.utils.toWei(process.env.VALUE)),
      data: '0x00',
    };

    try {
      const tx = new EthereumTx(rawTx, { chain: `${this.web3Service.net}` });
      tx.sign(Buffer.from(process.env.WALLET_PRIV, 'hex'));
      const serializedTx = tx.serialize();
      await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
    } catch (e) {
      await this.userModel.findOneAndDelete({ email: userEmail });
      throw new Error(e);
    }

    const contract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const data = await contract.methods.deployDocStore(`${userCompany}`).encodeABI();
    const nonce1 = await web3.eth.getTransactionCount(userAddr, 'pending');
    


    const rawDocStoreTx = {
      nonce: web3.utils.toHex(nonce1),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: process.env.DOCSTORE_FACTORY,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT_DOCSTORE),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    try {
      const docStoreTx = await new EthereumTx(rawDocStoreTx, { chain: `${this.web3Service.net}` });
      docStoreTx.sign(Buffer.from(`${userPrivateKey}`, 'hex'));
      const docStoreSerialize = docStoreTx.serialize();
      await web3.eth
        .sendSignedTransaction('0x' + docStoreSerialize.toString('hex'))
        .on('receipt', console.log);
    } catch (e) {
      await this.userModel.findOneAndDelete({ email: userEmail });
      throw new Error(e);
    }
    await this.sendOtp(createUser);

    //DNS name configure
    const userDomain = await this.dnsName(userEmail);
    await this.userModel.findOneAndUpdate({ email: userEmail }, { domain: userDomain });

    const otpSignUpRequired = /true/i.test(process.env.OTP_REQUIRED_SIGN_UP);
    const userInfo = {
      email: createUser.email,
      name: createUser.name,
    };
    const userCreated = { userCreated: true };
    const otpRequirement = { otpRequired: otpSignUpRequired };

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log('CreateAccount', userEmail, duration);

    return { ...userInfo, ...otpRequirement, ...userCreated };
  }

  async resendEmailOtp(email: string) {
    const user = await this.userModel.findOne({ email, activeEmail: false });
    if (!user) {
      throw new Error('Inactive user not found');
    }
    await this.sendEmailOTP(user);
  }

  async resendOtp(mobileNo: string) {
    const user = await this.userModel.findOne({ mobileNo, activeOTP: false });
    if (!user) {
      throw new Error('Inactive user not found');
    }
    await this.sendOtp(user);
  }

  async activateUserByEmail(encode: string) {
    const [email, code] = Buffer.from(encode, 'base64')
      .toString('ascii')
      .split(':');
    if (await this.otpModel.exists({ code, email })) {
      await this.otpModel.findOneAndRemove({ code, email });
      await this.userModel.findOneAndUpdate({ email }, { $set: { activeEmail: true } });
    } else {
      throw new Error('Not found');
    }
  }

  async activateUserByOTP(otp: string) {
    const findOne = await this.findOneByOTP(otp);
    const email = findOne.email;
    const mobileNo = `${findOne.mobileNo}`;
    const code = otp;
    if (await this.otpModel.exists({ code, mobileNo })) {
      await this.otpModel.findOneAndRemove({ code, mobileNo });
      await this.userModel.findOneAndUpdate({ email }, { $set: { activeOTP: true } });
    } else {
      throw new Error('Not found');
    }
    const findEmail = await this.findOneByEmail(email);
    const findActiveOTP = findEmail.activeOTP;
    if (findActiveOTP == true) {
      await this.sendEmailOTP(findEmail);
    }
  }

  async etherCheck(userAddr: string) {
    const web3 = await this.web3Service.getWeb3();
    await this.web3Service.updateGasPrice();
    const balance = await web3.eth.getBalance(userAddr);
    const fromWeiBalance = Number(web3.utils.fromWei(balance));
    if (fromWeiBalance < 0.2) {
      const nonce = await web3.eth.getTransactionCount(process.env.WALLET_ADDR, 'pending');
      const rawTx = {
        nonce: web3.utils.toHex(nonce),
        gasPrice: web3.utils.toHex(
          (this.web3Service.gasPrice.average *
            (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
            100,
        ),
        gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
        to: web3.utils.toHex(userAddr),
        value: web3.utils.toHex(web3.utils.toWei(process.env.VALUE)),
        data: '0x00',
      };

      const tx = new EthereumTx(rawTx, { chain: `${this.web3Service.net}` });
      tx.sign(Buffer.from(process.env.WALLET_PRIV, 'hex'));
      const serializedTx = tx.serialize();
      await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
    }
  }

  async findOneByActiveEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email, activeEmail: true, activeOTP: true }).exec();
  }

  async findOneByOTP(code: string) {
    return this.otpModel.findOne({ code });
  }

  async findOneByMobileNo(mobileNo: string) {
    return this.userModel.findOne({ mobileNo });
  }

  async findOneByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async findOneByCpyName(companyName: string, role: string) {
    return this.userModel.findOne({ companyName, role });
  }

  async findOneById(id: string): Promise<User> {
    return this.userModel.findById(id).exec();
  }

  async findDocStoreById(userId: string) {
    return this.storeModel.findOne({ userId });
  }

  async createFinancer(createFinanceDto: CreateFinancierDto) {
    const web3 = await this.web3Service.getWeb3();
    await this.web3Service.updateGasPrice();

    const createUser = new this.userModel(createFinanceDto);
    await createUser.save();

    const userPrivateKey = createUser.getPrivateKey();
    const userEmail = createUser.email;
    const userAddr = createUser.wallet.address;
    const userCompany = createUser.companyName;

    const nonce = await web3.eth.getTransactionCount(process.env.WALLET_ADDR, 'pending');

    const rawTx = {
      nonce: web3.utils.toHex(nonce),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT),
      to: web3.utils.toHex(createUser.wallet.address),
      value: web3.utils.toHex(web3.utils.toWei(process.env.VALUE)),
      data: '0x00',
    };

    try {
      const tx = new EthereumTx(rawTx, { chain: `${this.web3Service.net}` });
      tx.sign(Buffer.from(process.env.WALLET_PRIV, 'hex'));
      const serializedTx = tx.serialize();
      await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
    } catch (e) {
      await this.userModel.findOneAndDelete({ email: userEmail });
      throw new Error(e);
    }

    const contract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const data = await contract.methods.deployDocStore(`${userCompany}`).encodeABI();
    const nonce1 = await web3.eth.getTransactionCount(userAddr, 'pending');

    const rawDocStoreTx = {
      nonce: web3.utils.toHex(nonce1),
      gasPrice: web3.utils.toHex(
        (this.web3Service.gasPrice.average * (100 + parseInt(process.env.GAS_PRICE_PREMIUM_PCT))) /
          100,
      ),
      to: process.env.DOCSTORE_FACTORY,
      gasLimit: web3.utils.toHex(process.env.GAS_LIMIT_DOCSTORE),
      value: web3.utils.toHex(web3.utils.toWei('0')),
      data: data,
    };

    try {
      const docStoreTx = await new EthereumTx(rawDocStoreTx, { chain: `${this.web3Service.net}` });
      docStoreTx.sign(Buffer.from(`${userPrivateKey}`, 'hex'));
      const docStoreSerialize = docStoreTx.serialize();
      await web3.eth
        .sendSignedTransaction('0x' + docStoreSerialize.toString('hex'))
        .on('receipt', console.log);
    } catch (e) {
      await this.userModel.findOneAndDelete({ email: userEmail });
      throw new Error(e);
    }

    await this.sendOtp(createUser);

    //DNS name configure
    const userDomain = await this.dnsName(userEmail);
    await this.userModel.findOneAndUpdate({ email: userEmail }, { domain: userDomain });

    const otpSignUpRequired = /true/i.test(process.env.OTP_REQUIRED_SIGN_UP);
    const userInfo = {
      email: createUser.email,
      name: createUser.name,
    };
    const userCreated = { userCreated: true };
    const otpRequirement = { otpRequired: otpSignUpRequired };

    return { ...userInfo, ...otpRequirement, ...userCreated };
  }

  async dnsName(email: string) {
    const web3 = await this.web3Service.getWeb3();
    const getUserInfo = await this.findOneByEmail(email);
    const devOps = /true/i.test(process.env.DEVELOPMENT_MODE);
    console.log('DEVELOPMENT_MODE: ', devOps);
    const factoryContract = new web3.eth.Contract(
      JSON.parse(process.env.DocStoreFactoryABI),
      process.env.DOCSTORE_FACTORY,
    );
    const walletAddr = getUserInfo.wallet.address;
    const docStore = await factoryContract.methods.assets(walletAddr).call();
    let domain;
    if (devOps == true) {
      //query wallet address from db

      const { execSync } = require('child_process');
      const success = execSync(
        `open-attestation dns txt-record create --address ${docStore} --network-id 4`,
      );
      domain = success.toString().substring(31, success.length - 89);
      console.log(`Used generated domain name. "${domain}" is valid for 24 hours only.`);
    } else {
      //when not in development mode.
      domain = getUserInfo.domain;
      const userEmail = getUserInfo.email;
      const userName = getUserInfo.name;
      this.mailerService.sendDnsConfigure(userEmail, userName, docStore, domain);
    }
    return domain;
  }
  async changePassword(user: any, changePassDto: ChangePasswordDto) {
    console.log(changePassDto);
    const getUserInfo = await this.findOneByEmail(user.email);
    console.log(getUserInfo.password);
    const oldpassmatch = await compare(changePassDto.oldpassword, getUserInfo.password);
    console.log('condition', oldpassmatch);
    if (oldpassmatch == true) {
      const newPassCipher = await hash(changePassDto.newpassword);
      await this.userModel.findOneAndUpdate({ email: user.email }, { password: newPassCipher });
      return `Password Changed to ${changePassDto.newpassword}`;
    } else {
      throw new Error('Old Password is incorrect');
    }
  }

  async updateUser(updateUserDto: UpdateUserDto, user: any) {
    // if (await this.userModel.find({ email: updateUserDto.email }) != null) {
    //   throw new Error('Email already exists')
    // }
    //   for (var key in updateUserDto) {
    //     if (updateUserDto.hasOwnProperty(key)) {
    //         if(updateUserDto[key] != null || updateUserDto[key] != "string"){
    //           console.log(key + " -> " + updateUserDto[key]);
    //         }
    //         //console.log(key + " -> " + updateUserDto[key]);
    //     }
    // }
    return await this.userModel.findOneAndUpdate(
      { email: user.email },
      {
        name: updateUserDto.fullName,
        address1: updateUserDto.address1,
        address2: updateUserDto.address2,
        zipcode: updateUserDto.zipcode,
        country: updateUserDto.country,
        mobileNo: updateUserDto.mobileNo,
      },
    );
  }

  async forgetPassRequest(email: string) {
    console.log('2');
    const code = getRandomCode();
    console.log('3');
    const user = await this.userModel.findOne({ email });
    console.log('4');
    const otp = new this.otpModel({ code, email, mobileNo: user.mobileNo });
    console.log('5');
    await otp.save();
    console.log('6');
    const encode = Buffer.from(`${email}:${code}`).toString('base64');
    console.log('7');
    //To Do: send email
    const link = `${process.env.BASEURL ?? 'http://localhost:3000'}${process.env.API_PREFI ??
      '/api/v1'}/auth/forget/Password/verify/:${encode}`;
    console.log('8');
    const userInfo = await this.userModel.findOne({ email });
    console.log('9');
    const name = userInfo.name;
    console.log('10');
    this.mailerService.sendForgetPassword(email, link, name);
    return;
  }

  async updateForgetPassword(user: any, newPassword: string) {
    //password in the dto is already hashed as it should be the input from forgetpassword verified api.
    const getUserInfo = await this.findOneByEmail(user.email);
    const newPassCipher = await hash(newPassword);
    await this.userModel.findOneAndUpdate({ email: user.email }, { password: newPassCipher });
    return `Password Changed to ${newPassword}`;
  }

  async checkUserExists(email: string) {
    console.log('2');
    const user = await this.findOneByEmail(email);
    if (user != null) {
      console.log('3');
      const userDetails = {
        name: user.name,
        mobileNo: user.mobileNo,
        companyName: user.companyName,
        address1: user.address1,
        address2: user.address2,
        country: user.country,
        zipcode: user.zipcode,
      };
      console.log(userDetails);
      return userDetails;
    } else {
      throw new Error('No such user found.');
    }
  }
}
