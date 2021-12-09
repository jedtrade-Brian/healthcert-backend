import { ApiProperty } from '@nestjs/swagger';

export class UpdateCert2 {
  @ApiProperty()
  readonly signature: string;

  @ApiProperty()
  readonly otp: string;
}
