import {
  Controller,
  UseGuards,
  Post,
  Request,
  Get,
  Param,
  BadRequestException,
  Put,
  Body,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiOperation,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { LoginUserDTO } from 'src/users/dto/login-user.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('/login')
  @ApiOperation({
    summary: 'User Login',
    description: 'authToken will be presented upon successful login.',
  })
  @ApiBody({ type: LoginUserDTO })
  @ApiUnauthorizedResponse({ description: 'Unauthorized. Probable cause: invalid credentials.' })
  @ApiCreatedResponse({ description: 'Login Successful. authToken is created.' })
  @ApiTags('Account Management')
  async login(@Request() req) {
    try {
      console.log('1')
      return this.authService.login(req.user);
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message: e.message,
      });
    }
  }

  @Get('/verify/:encode')
  @ApiParam({ name: 'encode' })
  @ApiOperation({ summary: 'Verify Email Address', description: 'For account activation.' })
  @ApiBadRequestResponse({
    description: 'Bad Request. Probable cause: invalid verify token or not presented.',
  })
  @ApiOkResponse({ description: 'Account activated successfully' })
  @ApiTags('Account Management')
  async activateUserLink(@Param() { encode }) {
    try {
      await this.usersService.activateUserByEmail(encode);
      return 'Account has been successfully activated.';
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        message: e.message,
      });
    }
  }

  //Verify SMS OTP Function
  @Get('/verifyOTP/:otp')
  @ApiParam({ name: 'otp' })
  @ApiOperation({ summary: 'Verify SMS OTP', description: 'For account activation.' })
  @ApiBadRequestResponse({
    description: 'Bad Request. Probable cause: invalid verify token or not presented.',
  })
  @ApiOkResponse({ description: 'SMS OTP Verified' })
  @ApiTags('Account Management')
  async activateUserOtp(@Param() { otp }) {
    try {
      await this.usersService.activateUserByOTP(otp);
      return 'SMS OTP Verified.';
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        error: e.message,
      });
    }
  }

  //verify email otp for forget password
  @Get('/forget/Password/verify/:encode')
  @ApiOperation({ summary: 'Verify Forget password request  ' })
  @ApiParam({ name: 'encode' })
  @ApiBadRequestResponse({ description: 'Bad Request. Probable cause: invalid otp/email' })
  @ApiOkResponse({
    description: 'forget password request verified, can proceed to update password',
    schema: {
      properties: {
        authToken: {
          type: 'string',
          description: 'authentication Token'
        },
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Bad Request: Possible cause: user does not exists' })
  @ApiTags('Account Management')
  async forgetPassVerify(@Param() { encode }) {
    try {
      return await this.authService.forgetPassUpdate(encode)
    } catch (e) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        error: e.message,
      });
    }
  }
}
