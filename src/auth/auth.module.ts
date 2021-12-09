import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.stratagy';
import { ApiStrategy } from './strategies/api.stratagy';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { TokensModule } from '../tokens/tokens.module';
import { MongooseModule } from '@nestjs/mongoose';
import { OtpSchema } from 'src/users/schemas/otp.schema';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Otp', schema: OtpSchema },
    ]),
    UsersModule,
    TokensModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secretOrKeyProvider: () => process.env.JWT_SEC ?? 'jedsign-api-jwt-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, ApiStrategy],
  exports: [AuthService],
})
export class AuthModule {}
