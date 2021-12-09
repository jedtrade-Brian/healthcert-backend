import * as bip39 from 'bip39';
import * as hdkey from 'ethereumjs-wallet/hdkey';
import * as ethUtil from 'ethereumjs-util';

export const createHDWallet = () => {
  // seed and derive key
  const mnemonic = bip39.generateMnemonic();
  const key = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic));
  const wallet = key.derivePath("m/44'/60'/0'/0/0");

  // wallet details
  const address = ethUtil.toChecksumAddress(
    wallet
      .getWallet()
      .getAddress()
      .toString('hex'),
  );
  const publicKey = wallet
    .getWallet()
    .getPublicKey()
    .toString('hex');
  const privateKey = wallet
    .getWallet()
    .getPrivateKey()
    .toString('hex');
    
  return { address, privateKey, publicKey };
  
};
