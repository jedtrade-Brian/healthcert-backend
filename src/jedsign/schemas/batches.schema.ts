import * as mongoose from 'mongoose';

export const BatchesSchema = new mongoose.Schema({
  issuerDocStore: {
    type: String
  },
  documentBatch: {
    type: Array
  },
  merkleRoot: {
    type: String
  },
  createdAt: {
    type: Number,
  },
  updatedAt: {
    type: Number,
  },
});

BatchesSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  if (!this.createdAt) {
    this.createdAt = this.updatedAt;
  }

  next();
});