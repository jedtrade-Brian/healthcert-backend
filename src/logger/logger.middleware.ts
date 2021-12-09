import { Injectable, NestMiddleware } from '@nestjs/common';
import { MyLogger } from './logger.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: MyLogger) {}

  use(req: any, res: any, next: () => void) {
    const logger = this.logger;
    logger.inbound(req.method, req.path);

    res.on('finish', function() {
      // const response = this;
      // log response result (success/failed/error message) if needed
    });

    next();
  }
}
