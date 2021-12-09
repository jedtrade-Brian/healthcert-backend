import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as uuid from 'uuid/v4';
import { unsaltHash } from '../utils/crypto';
import { UsersService } from '../users/users.service';

@Injectable()
export class TokensService {
  constructor(
    @InjectModel('Token') private readonly tokenModel: Model<any>,

    private readonly usersService: UsersService,
  ) {}

  async create(userId: string): Promise<any> {
    const tokenInfo = await this.tokenModel.findOne({ owner: userId });
    if (tokenInfo) {
      await this.tokenModel.deleteOne({ owner: userId });
    }
    const token = uuid();
    const createToken = new this.tokenModel({ token, owner: userId });
    await createToken.save();
    return { token };
  }

  async findOneByToken(token: string) {
    // token is hashed w/o salt in DB to protect tokens in the event of DB attack
    const hash = unsaltHash(token);
    const tokenEntity = await this.tokenModel.findOne({ token: hash });
    if (!tokenEntity) throw new Error('Token not found');
    return this.usersService.findOneById(tokenEntity.owner);
  }

  async findDocAddrByToken(token: string) {
    const hash = unsaltHash(token);
    const tokenEntity = await this.tokenModel.findOne({ token: hash });
    if (!tokenEntity) throw new Error('Token not found');
    return this.usersService.findDocStoreById(tokenEntity.owner);
  }
}
