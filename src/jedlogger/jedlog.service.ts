import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JedLog } from './interfaces/jedlog.interface';
import { CreateJedLogDto } from './dto/create-jedlog.dto';

const moment = require('moment');
//import { JedLogClass } from './schemas/jedlog.schema';

@Injectable()
export class JedLogService {
  constructor(
    // @InjectModel(JedLogClass.name)
    @InjectModel('Log') private readonly productModel: Model<any>, // private productModel: Model<any>,
  ) {}

  async findAll(): Promise<JedLog[]> {
    return await this.productModel.find().exec();
  }

  async findOne(id: string): Promise<JedLog> {
    return await this.productModel.findOne({ _id: id });
  }

  async create(product: CreateJedLogDto): Promise<JedLog> {
    // Date date = new Date();
    // SimpleDateFormat formatter = new SimpleDateFormat("dd/MM/yyyy");
    // String strDate= formatter.format(date);
    const day = new Date();
    const dayWrapper = moment(day);
    const dayString = dayWrapper.format('YYYY-MM-DD H:mm:ss.SSS');

    const JedLog = { ...product, time: dayString };
    console.log(JedLog);
    const newProduct = new this.productModel(JedLog);
    return await newProduct.save();
  }

  async delete(id: string): Promise<JedLog> {
    return await this.productModel.findByIdAndRemove(id);
  }

  // async update(id: string, product: JedLog): Promise<JedLog> {
  //   return await this.productModel.findByIdAndUpdate(id, product, {
  //     new: true,
  //   });
  // }
}
