import * as mongoose from 'mongoose';

export const DocumentSchema = new mongoose.Schema({
  docHash: {
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
  docType: {
    type: String,
    required: true,
    indexed: true,
  },
  documentId: {
    type: Number,
    required: true,
    indexed: true,
  },
  patientId: {
    type: String,
  },
  patientTKC: {
    type: Number,
  },
  patientTKN: {
    type: String,
  },
  collectedDate: {
    type: Number,
  },
  effectiveDate: {
    type: Number,
  },
  resultcode: {
    type: Number,
  },
  result: {
    type: String,
  },
  performer: {
    type: String,
  },
  identifier: {
    type: String,
  },
  clinicName: {
    type: String,
  },
  officeAdd: {
    type: String,
  },
  officeNo: {
    type: Number,
  },
  webAdd: {
    type: String,
  },
  labName: {
    type: String,
  },
  labAdd: {
    type: String,
  },
  labNo: {
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
  createdAt: {
    type: Number,
  },
  updatedAt: {
    type: Number,
  },
});

DocumentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  if (!this.createdAt) {
    this.createdAt = this.updatedAt;
  }

  next();
});
