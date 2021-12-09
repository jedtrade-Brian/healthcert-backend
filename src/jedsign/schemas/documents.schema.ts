import * as mongoose from 'mongoose';

export const DocumentSchema = new mongoose.Schema({
  studentId: {
    type: String,
  },
  docType: {
    type: String,
    required: true,
    indexed: true,
  },
  docHash: {
    type: String,
    required: true,
    indexed: true,
  },
  documentId: {
    type: String,
    required: true,
    indexed: true,
  },
  issuerDocStore: {
    type: String,
    required: true,
    indexed: true,
  },
  docInfo: {
    type: String,
    required: true,
  },
  wrapDocInfo: {
    type: String,
  },
  createdAt: {
    type: Number,
  },
  updatedAt: {
    type: Number,
  },
  completionDate: {
    type: Number,
  },
  issuedDate: {
    type: Number,
  },
  revokedDate: {
    type: Number,
  },
  isBatchRevoke: {
    type: Boolean,
  },
});

DocumentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  if (!this.createdAt) {
    this.createdAt = this.updatedAt;
  }

  next();
});
