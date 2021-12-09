import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { sha3_256 as sha3 } from 'js-sha3';

const iv = crypto.randomBytes(16);
const key = Buffer.from(process.env.CRYPTO_KEY ?? '50ae298be1123b4f50ae298be1123b4f', 'utf8');
const algo = 'aes-256-cbc';

const hash = data => {
  return bcrypt.hash(data, 10);
};

const compare = (plain: string, hash: string) => {
  return bcrypt.compare(plain, hash);
};

const unsaltHash = (data: string): string => {
  const hash = sha3.create();
  hash.update(data);
  return hash.hex();
};

// encrypt
//
// encrypts a given data and returns
// an object containing the iv and the
// base64-encoded encrypted data
const encrypt = data => {
  const cipher = crypto.createCipheriv(algo, key, iv);
  let encrypted = cipher.update(data);

  // finalize
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted.toString('hex'),
  };
};

// decrypt
//
// decrypts the encrypted data with
// the correct iv.
const decrypt = (ivHex, encryptedData) => {
  const ivBuffer = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algo, key, ivBuffer);

  const encryptedDataBuffer = Buffer.from(encryptedData, 'hex');
  let decryptedData = decipher.update(encryptedDataBuffer);

  decryptedData = Buffer.concat([decryptedData, decipher.final()]);
  return decryptedData.toString();
};

const getRandomCode = (size = 6) =>
  Math.floor(Math.pow(10, size - 1) + Math.random() * 9 * Math.pow(10, size - 1));

export { hash, compare, unsaltHash, encrypt, decrypt, getRandomCode };
