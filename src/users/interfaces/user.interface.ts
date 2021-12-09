import { Document } from 'mongoose';

export interface User extends Document {
  readonly _id: string;
  readonly email: string;
  readonly mobileNo: string;
  readonly companyName: string;
  readonly domain: string;
  readonly role: string;
  readonly designation: string;
  readonly address1: string;
  readonly address2: string;
  readonly zipcode: string;
  readonly country: string;
  readonly name:string;
  readonly letterhead: string;
  password: string;
  wallet: any;

  getPrivateKey();
}
