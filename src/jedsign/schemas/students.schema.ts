import * as mongoose from 'mongoose';

export const StudentSchema = new mongoose.Schema({
  patientId: {
    type: 'string',
  },
  patientNRIC: {
    type: 'string',
  },
  patientEmail: {
    type: 'string',
  },
  patientName: {
    type: 'string',
  },
  gender: {
    type: 'string',
  },
  patientPPN: {
    type: 'string',
  },
  nationally: {
    type: 'string',
  },
  dob: {
    type: 'number',
  },
  effectiveDate: {
    type: 'number',
  },
  created: {
    type: Number,
  },
  updated: {
    type: Number,
  },
});

StudentSchema.pre('save', function(next) {
  this.updated = Date.now();

  if (!this.created) {
    this.created = this.updated;
  }

  next();
});
