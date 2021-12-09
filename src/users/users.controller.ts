import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  Put,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './interfaces/user.interface';
import { AuthGuard } from '@nestjs/passport';
import { CreateFinancierDto } from './dto/create-financier.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import {
  ApiForbiddenResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotImplementedResponse,
  ApiParam,
  ApiBody,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';

@ApiTags('Account Management')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Administrator User Signup',
    description:
      'Email verification to be sent to registered email address upon successful signup.',
  })
  @ApiForbiddenResponse({ description: 'Forbidden. Probable cause: email exists.' })
  @ApiBadRequestResponse({
    description:
      'Bad Request. Probable cause: invalid email format, or password less than 6 characters long.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal Server Error. Probable cause: Insufficient funds in cryptowallet.',
  })
  @ApiCreatedResponse({ description: 'User is created.' })
  async createUser(@Body() createUserDto: CreateUserDto, @Res() res) {
    try {
      if (await this.usersService.findOneByActiveEmail(createUserDto.email)) {
        throw new ForbiddenException({
          status: HttpStatus.FORBIDDEN,
          error: 'Email/Mobile already in use',
        });
      }
      const user = await this.usersService.create(createUserDto);
      return res.send(user);
    } catch (e) {
      if (e instanceof HttpException) {
        throw e;
      } else if (e.message == 'Error: Returned error: insufficient funds for gas * price + value') {
        throw new InternalServerErrorException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'insufficient funds for gas * price + value',
        });
      } else {
        throw new BadRequestException({
          status: HttpStatus.BAD_REQUEST,
          error: e.message,
        });
      }
    }
  }

  @Put('resendEmail/:email')
  @ApiParam({ name: 'email' })
  @ApiOperation({
    summary: 'Resend Email Verification',
    description: 'For account with unverified email address.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Probable cause: invalid email or account is verified.',
  })
  @ApiOkResponse({ description: 'Email Verification Sent.' })
  async resendEmailOtp(@Param() { email }) {
    // TODO: what param is required here?
    //
    try {
      await this.usersService.resendEmailOtp(email);
    } catch (e) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        error: e.message,
      });
    }
  }

  @Put('resendOTP/:mobileNo')
  @ApiParam({ name: 'mobileNo' })
  @ApiOperation({
    summary: 'Resend Mobile No Verification',
    description: 'For account with unverified Mobile No.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden. Probable cause: invalid email or account is verified.',
  })
  @ApiOkResponse({ description: 'SMS OTP Sent.' })
  async resendOtp(@Param() { mobileNo }) {
    // TODO: what param is required here?
    //
    try {
      await this.usersService.resendOtp(mobileNo);
    } catch (e) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        error: e.message,
      });
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get User Info', description: 'Bearer authToken required.' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiOkResponse({ description: 'User retrieved.' })
  async getUserByAuthToken(@Req() req) {
    try {
      const user = await this.usersService.findOneById(req.user.id);
      if (!user) {
        throw new ForbiddenException();
      }
      user.password = undefined;
      user.wallet = user.wallet.address;
      return user;
    } catch (e) {
      throw new ForbiddenException({
        status: HttpStatus.FORBIDDEN,
        error: e.message,
      });
    }
  }

  @Get('/:id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get User Info by _Id' })
  @ApiOkResponse({ description: 'User retrieved.' })
  @ApiNotFoundResponse({
    description: 'Not Found. Probable cause: invalid id or id not presented.',
  })
  async getUserById(@Param() { id }): Promise<User> {
    try {
      const user = await this.usersService.findOneById(id);
      if (!user) {
        throw new NotFoundException();
      }
      user.password = undefined;
      user.wallet = user.wallet.address;
      return user;
    } catch (e) {
      throw new NotFoundException();
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Put()
  @ApiBearerAuth()
  @ApiBody({ type: UpdateUserDto })
  @ApiOperation({ summary: 'Update User Info', description: 'Bearer jwtToken required.' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiNotImplementedResponse({ description: 'Not Implemented. WIP.' })
  @ApiOkResponse({ description: 'credentials updated.' })
  @ApiBadRequestResponse({
    description: 'Bad Request Error: Probable cause: Email already exists.',
  })
  async updateUser(@Req() req, @Res() res, @Body() updateUserDto: UpdateUserDto) {
    // TODO: implement update user info
    try {
      const s = await this.usersService.updateUser(updateUserDto, req.user);
      return res.status(200).send(s);
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        error: e.message,
      });
    }
  }

  @Post('/FinancierSignup')
  @ApiOperation({
    summary: 'Financier User Signup',
    description:
      'Email verification to be sent to registered email address upon successful signup.',
  })
  @ApiForbiddenResponse({ description: 'Forbidden. Probable cause: email exists.' })
  @ApiBadRequestResponse({
    description:
      'Bad Request. Probable cause: invalid email format, or password less than 6 characters long.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal Server Error. Probable cause: Insufficient funds in cryptowallet.',
  })
  @ApiCreatedResponse({ description: 'User is created.' })
  async createFinanceUser(@Body() createFinanceDto: CreateFinancierDto, @Res() res) {
    try {
      if (await this.usersService.findOneByActiveEmail(createFinanceDto.email)) {
        throw new ForbiddenException({
          status: HttpStatus.FORBIDDEN,
          error: 'Email/Mobile already in use',
        });
      }
      const user = await this.usersService.createFinancer(createFinanceDto);
      return res.send(user);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      else if (e.message == 'Error: Returned error: insufficient funds for gas * price + value') {
        throw new InternalServerErrorException({
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'insufficient funds for gas * price + value',
        });
      } else
        throw new BadRequestException({
          status: HttpStatus.BAD_REQUEST,
          error: e.message,
        });
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('/Change/Password/')
  @ApiBearerAuth()
  @ApiBody({ type: ChangePasswordDto })
  @ApiOperation({ summary: 'Change password', description: 'Bearer jwtToken required.' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiNotImplementedResponse({ description: 'Not Implemented. WIP.' })
  @ApiOkResponse({ description: 'User Password Updated.' })
  @ApiBadRequestResponse({ description: 'Bad Request: Possible cause: Incorrect old password' })
  async changePassword(@Req() req, @Res() res, @Body() changePassDto: ChangePasswordDto) {
    console.log(req.user);
    // TODO: implement update user info
    //res.status(501).send();
    try {
      const s = await this.usersService.changePassword(req.user, changePassDto);
      return res.status(200).send(s);
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        error: e.message,
      });
    }
  }

  @Post('/forgetPassword/request/:email')
  @ApiOperation({ summary: 'send forget password request' })
  @ApiParam({ name: 'email' })
  @ApiCreatedResponse({
    description: 'change password request sent to email',
  })
  @ApiBadRequestResponse({ description: 'Bad Request: Possible cause: email does not exists' })
  async forgetPassRequest(@Req() req, @Res() res, @Param() { email }) {
    try {
      console.log('1');
      await this.usersService.forgetPassRequest(email);
      return res.status(201).send();
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        error: e.message,
      });
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('/forget/Password/update/:newPassword')
  @ApiBearerAuth()
  @ApiParam({ name: 'newPassword' })
  @ApiOperation({
    summary: 'Update password via forget password.',
    description: 'Bearer jwtToken required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Probable cause: invalid bearer token or not presented.',
  })
  @ApiNotImplementedResponse({ description: 'Not Implemented. WIP.' })
  @ApiOkResponse({ description: 'User Password Updated.' })
  @ApiBadRequestResponse({ description: 'Bad Request: Possible cause: Incorrect old password' })
  async forgetPasswordUpdate(@Req() req, @Res() res, @Param() { newPassword }) {
    console.log(req.user);
    // TODO: implement update user info
    //res.status(501).send();
    try {
      const msg = await this.usersService.updateForgetPassword(req.user, newPassword);
      return res.status(200).send(msg);
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        error: e.message,
      });
    }
  }

  @Get('/User/Exists/:email')
  @ApiParam({ name: 'email' })
  @ApiOperation({ summary: 'checks if user exists and returns values' })
  @ApiNotImplementedResponse({ description: 'Not Implemented. WIP.' })
  @ApiOkResponse({
    description: 'User Found.',
    schema: {
      properties: {
        name: {
          type: 'string',
          description: 'name of user',
        },
        mobileNo: {
          type: 'string',
          description: 'mobileNo of user',
        },
        companyName: {
          type: 'string',
          description: 'company name of user',
        },
        address1: {
          type: 'string',
          description: 'address 1 of user',
        },
        address2: {
          type: 'string',
          description: 'address 2 of user',
        },
        country: {
          type: 'string',
          description: 'country of user',
        },
        zipcode: {
          type: 'string',
          description: 'zipcode of user',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Bad Request: Possible cause: User Does not exists' })
  async checkUserExists(@Req() req, @Res() res, @Param() { email }) {
    try {
      console.log('1');
      const s = await this.usersService.checkUserExists(email);
      return res.status(200).send(s);
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        error: e.message,
      });
    }
  }
}
