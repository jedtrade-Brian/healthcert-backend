import * as mongoose from 'mongoose';

export const ConfigSchema = new mongoose.Schema({
  certIssueUnitPrice: {
    type: Number
  },
  billingSurCharge: {
    type: Number
  },
  automatedMonthlyBill: {
    type: Boolean
  },
  automatedEmailDate: {
    type: Number
  },
  adminEmail: {
    type: String
  },
  createdAt: {
    type: Number,
  },
  updatedAt: {
    type: Number,
  },
});

ConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  if (!this.createdAt) {
    this.createdAt = this.updatedAt;
  }

  next();
});