import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDTO {
  @ApiProperty()
  readonly email: string;
  @ApiProperty()
  readonly password: string;
}
