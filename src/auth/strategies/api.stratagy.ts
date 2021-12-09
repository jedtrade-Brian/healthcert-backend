import { Strategy } from 'passport-http-bearer';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
const log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: 'cheese.log' } },
  categories: { default: { appenders: ['cheese'], level: 'all' } },
});
const logger = log4js.getLogger('cheese');
@Injectable()
export class ApiStrategy extends PassportStrategy(Strategy, 'api') {
  constructor(private readonly authService: AuthService) {
    super();
    logger.info('api.strategy: calling constructor');
  }

  async validate(token: string): Promise<any> {
    try {
      logger.info('api.strategy: validate the token');
      const user = await this.authService.validateApiToken(token);
      return { id: user._id, email: user.email, token };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
