import { Injectable, HttpService } from '@nestjs/common';
import Web3 from 'web3'; // this is only to provide a Web3 typed interface
import { Contract } from 'web3-eth-contract';
import { join } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MyLogger } from '../logger/logger.service';

@Injectable()
export class Web3Service {
  Web3 = require('web3'); // NOTE: only this provides actual Web3 object. reasons unknown yet
  contracts;
  gasPrice: {
    fastest: number;
    fast: number;
    average: number;
    safeLow: number;
  };
  net;

  constructor(private readonly httpService: HttpService, private readonly logger: MyLogger) {
    this.logger.setContext('Web3 Service');

    // load all ABI definations
    const abiDir = join(__dirname, '/abi');
    this.contracts = readdirSync(abiDir, 'utf8')
      .filter(filename => filename.match(/\.json/i))
      .map(fn => {
        const key = fn.split('.')[0];

        this.logger.info(key, 'Mounted ABI');
        return { key, value: JSON.parse(readFileSync(join(abiDir, fn), 'utf8')) };
      })
      .reduce((accum, curr) => {
        accum[curr.key] = curr.value;
        return accum;
      }, {});

    // init gasPrice
    this.updateGasPrice();
  }

  /**
   * update current gas price from 3rd-party api
   * currently using EthGasStation
   * scheduled to run every 30 minutes
   */
  // '0 */30 * * * *'
  @Cron(CronExpression.EVERY_30_MINUTES)
  async updateGasPrice() {
    try {
      this.logger.info('Fetching current gas price');
      const observable = this.httpService.get('https://ethgasstation.info/json/ethgasAPI.json');
      const data = (await observable.toPromise()).data;
      const { fastest, fast, average, safeLow } = data;
      // EthGasStation provide gas price in x10 scale.
      // e.g. value 10 means 1 gwei, which is 10^9 wei
      // hence from value 10 to 10^9 is diff by 10^8
      const scale = 10 ** 8;
      this.gasPrice = {
        fastest: fastest * scale,
        fast: fast * scale,
        average: average * scale,
        safeLow: safeLow * scale,
      };
      this.logger.info(
        `Fast: ${fast / 10} | Average: ${average / 10} | Safe Low: ${safeLow / 10} Gwei`,
        'Current Gas Price',
      );
    } catch {
      console.error('Failed to retrieve gas price from EthGasStation.');
    }
  }

  async getWeb3(netId?: number): Promise<Web3> {
    // the named import at the begining of this file does not work properly
    // keeps return undefined for unknown reason
    // TODO: investigate this problem
    netId = netId ? Number(netId) : 3;

    switch (netId) {
      case 1:
        this.net = 'mainnet';
        break;
      case 3:
        this.net = 'ropsten';
        break;
      case 4:
        this.net = 'rinkeby';
        break;
      case 42:
        this.net = 'kovan';
        break;
      default:
        this.net = 'local';
    }

    const Web3 = this.Web3;
    const { PROVIDER_HTTP, INFURA_VERSION, INFURA_ID } = process.env;

    return new Web3(
      new Web3.providers.HttpProvider(
        this.net === 'local'
          ? PROVIDER_HTTP //: PROVIDER_HTTP,
          : `https://${this.net}.infura.io/${INFURA_VERSION}/${INFURA_ID}`,
      ),
    );
  }

  async getContract(
    networkId: number,
    contract: string,
    isFixedAddress: boolean,
    web3?: Web3,
  ): Promise<Contract> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const contractJSON = this.contracts[contract];
    if (!contractJSON) return;
    if (!web3) web3 = await this.getWeb3(networkId);

    return new web3.eth.Contract(
      contractJSON.abi,
      isFixedAddress ? contractJSON.networks[networkId].address : null,
    );
  }
}
