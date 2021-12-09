import {
  Controller,
  Body,
  Put,
  BadRequestException,
  UseGuards,
  Req,
  Get,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JedsignService } from '../jedsign.service';

@ApiTags('Signing Management')
@Controller('sign')
export class SignController {
  constructor(private readonly jedsignService: JedsignService) {}
}
