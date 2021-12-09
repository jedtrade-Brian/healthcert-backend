import { Injectable, Logger, Scope } from '@nestjs/common';
import * as clc from 'cli-color';
import { appendFile } from 'fs';

@Injectable({ scope: Scope.TRANSIENT })
export class MyLogger extends Logger {
  logDir = `${__dirname}/log`;

  inbound(method: string, endpoint: string, userId?: string): void {
    super.log(`${clc.black.bgGreen(method)} ${clc.green(endpoint)}`);
  }

  info(message: any, label?: string): void {
    super.log(`${clc.black.bgGreen(label)} ${clc.green(message)}`);
  }

  error(message: any, trace?: string): void {
    super.error(message, trace);
    appendFile(
      `${this.logDir}/error.log`,
      `${new Date().toLocaleString()}, ${this.context}: ${message}\n`,
      err => {
        err && console.error(err.message);
      },
    );
  }
}
