import * as mongoose from 'mongoose';

export const OtpSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    indexed: true,
    required: true,
    validate: [/[a-zA-Z0-9]{5,}/, 'Invalid code'],
  },
  docHash: { type: Array },
  userId: { type: String },
  email: { type: String, required: true },
  mobileNo: { type: String, required: true },
  createdAt: { type: Date, expires: '3h', default: Date.now },
});
