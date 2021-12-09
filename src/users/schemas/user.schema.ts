import * as mongoose from 'mongoose';
import { hash, encrypt, decrypt } from '../../utils/crypto';
import { createHDWallet } from '../../utils/wallet';

const UserSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
  },
  uen: {
    type: String,
    required: true,
    minlength: 9,
    maxlength: 10,
  },
  address1: {
    type: String,
    required: true,
  },
  address2: {
    type: String,
    required: false,
  },
  country: {
    type: String,
    required: true,
  },
  zipcode: {
    type: String,
    required: true,
  },
  domain: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    indexed: true,
    lowercase: true,
    // very loose regex check on the existence of @ and .
    validate: [/^(.+)@(.+)\.(.+)$/, 'Not a valid email'],
  },
  password: {
    type: String,
    required: true,
    validate: [/.{6,}/, 'Password should be at least 6 characters long'],
  },
  title: {
    type: String,
    enum: ['Mr', 'Ms', 'Mrs', 'Dr'],
  },
  role: {
    type: String,
    enum: ['administrator', 'approver', 'superUser'],
  },
  designation: {
    type: String,
  },
  name: {
    type: String,
    required: true,
  },
  mobileNo: {
    type: String,
    required: true,
  },
  wallet: {
    type: Object,
    validate(v) {
      // validation needs a couple of fields to be present
      // and each fields should be of hex formatted string
      return (
        Object.keys(v).length >= 4 &&
        v.address &&
        v.public &&
        v.private &&
        v.iv &&
        /[0-9A-Fa-f]{6}/g.test(v.address) &&
        /[0-9A-Fa-f]{6}/g.test(v.public) &&
        /[0-9A-Fa-f]{6}/g.test(v.private) &&
        /[0-9A-Fa-f]{6}/g.test(v.iv)
      );
    },
  },
  activeEmail: {
    type: Boolean,
    default: false,
  },
  activeOTP: {
    type: Boolean,
    default: false,
  },
  created: {
    type: Number,
  },
  updated: {
    type: Number,
  },
  financierDetails: {
    type: Object,
    properties: {
      unknown1: { type: String },
      unknown2: { type: String },
      unknown3: { type: String },
      unknown4: { type: String },
      accountName: { type: String },
      accountNumber: { type: String },
      bankName: { type: String },
      swiftNumber: { type: String },
    },
  },
  letterhead: {
    type: String,
  },
});

// the second param has to be a normal function() instead of arrow () => {}
// due to the use of this in mongoose

/**
 * Hash password
 */
UserSchema.pre('save', function(next) {
  hash(this.password).then(hashedPwd => {
    this.password = hashedPwd;
    next();
  });
});

/**
 * generate HD wallet
 */
UserSchema.pre('save', function(next) {
  this.wallet = createHDWallet();
  const { iv, encryptedData: pk } = encrypt(this.wallet.privateKey);
  this.wallet.iv = iv;
  this.wallet.privateKey = pk;
  next();
});

/**
 * timestamp
 */
UserSchema.pre('save', function(next) {
  this.updated = Date.now();

  if (!this.created) {
    this.created = this.updated;
  }

  next();
});

UserSchema.methods.getPrivateKey = function() {
  return decrypt(this.wallet.iv, this.wallet.privateKey);
};

UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

UserSchema.pre('save', function(next) {
  if (this.role != 'financier') {
    delete this.financierDetails;
  }

  next();
});

export { UserSchema };
