import * as mongoose from 'mongoose';

export const StudentSchema = new mongoose.Schema({
  studentId: {
    type: 'string'
  },
  nric: {
    type: 'string'
  },
  name: {
    type: 'string'
  },
  email: {
    type: 'string'
  },
  dob: {
    type: 'number'
  },
  graduationDate: {
    type: 'number'
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
