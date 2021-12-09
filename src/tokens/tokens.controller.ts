import {
  Controller,
  Post,
  Get,
  Param,
  NotFoundException,
  ForbiddenException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TokensService } from './tokens.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

@ApiTags('Token Management')
@Controller('auth/keys')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create API Token',
    description:
      'Bearer authToken required. New ApiToken Created for new users. Existing users who have already created ApiToken will receive new ApiTokens while their old ApiTokens will be deleted and offloaded in DB',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiCreatedResponse({ description: 'API token is created.' })
  async createToken(@Req() req) {
    try {
      return this.tokensService.create(req.user.id);
    } catch {
      throw new ForbiddenException();
    }
  }

  // FIXME: for testing, this endpoint should not be directly exposed
  // endpoints that requires to verify a token use tokens.service
  @Get('/:token')
  @ApiParam({ name: 'token' })
  @ApiOperation({ summary: 'Verify API Token' })
  @ApiNotFoundResponse({
    description: 'Not Found. Probable cause: invalid token or token not presented.',
  })
  @ApiOkResponse({ description: 'Token is verified successfully.' })
  async verifyToken(@Param() { token }) {
    try {
      const tokenEntity = await this.tokensService.findOneByToken(token);
      if (!tokenEntity) {
        throw new NotFoundException();
      }
      return;
    } catch {
      throw new NotFoundException();
    }
  }
}
