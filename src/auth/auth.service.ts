import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TokensService } from '../tokens/tokens.service';
import { JwtService } from '@nestjs/jwt';
import { compare } from '../utils/crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly tokensService: TokensService,
    @InjectModel('Otp') private readonly otpModel: Model<any>,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByActiveEmail(email);
    if (user && pass) {
      const match = await compare(pass, user.password);
      if (!match) return null;

      const { _id, email } = user;
      return { _id, email };
    }
    return null;
  }

  async validateUserByApiToken(token: string, pass: string): Promise<any> {
    if (token && pass) {
      const user = await this.tokensService.findOneByToken(token);
      const otpSignUpRequired = /true/i.test(process.env.OTP_REQUIRED_SIGN_UP);
      const match = await compare(pass, user.password);
      const tokenArr = [];
      if (match) {
        await this.usersService.sendOtp(user);
        tokenArr.push(await this.tokensService.create(user._id));
      }

      return {
        userValidated: match,
        otpRequired: otpSignUpRequired,
        token: tokenArr[0].token
      };
    }
    return { userValidated: false };
  }

  async login(user: any) {
    const payload = { email: user.email, id: user.id };
    const otpNotRequired = /true/i.test(process.env.OTP_REQUIRED_SIGN_IN);
    const userDetails = await this.usersService.findOneByEmail(user.email);
    const role = userDetails.role;
    return {
      authToken: this.jwtService.sign(payload),
      otpRequired: otpNotRequired,
      role,
    };
  }

  async validateApiToken(token: string): Promise<any> {
    if (!token) throw new Error('Invalid token');
    return this.tokensService.findOneByToken(token);
  }

  async forgetPassUpdate(encode: any) {
    const [email, code] = Buffer.from(encode, 'base64')
      .toString('ascii')
      .split(':');
    if (await this.otpModel.exists({ code, email })) {
      await this.otpModel.findOneAndRemove({ code, email });
      const user = await this.usersService.findOneByEmail(email);
      const payload = { email: email, id: user.id };
      return { 'authToken': this.jwtService.sign(payload) }

    } else {
      throw new Error('Not found');
    }
  }
}
