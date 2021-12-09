import * as mongoose from 'mongoose';

export const DocStoreSchema = new mongoose.Schema({
  userId: {
    type: String,
    indexed: true,
  },
  docAddr: {
    type: String,
  },
  createdAt: {
    type: Number,
    default: Date.now,
  },
});
