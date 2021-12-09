import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  readonly companyName: string;
  @ApiProperty()
  readonly uen: string;
  @ApiProperty()
  readonly address1: string;
  @ApiProperty()
  readonly address2?: string;
  @ApiProperty()
  readonly zipcode: string;
  @ApiProperty()
  readonly country: string;
  @ApiProperty()
  readonly domain: string;
  @ApiProperty()
  readonly email: string;
  @ApiProperty()
  readonly password: string;
  @ApiProperty()
  readonly name: string;
  @ApiProperty()
  readonly mobileNo: string;
  @ApiProperty({
    enum: ['Mr', 'Ms', 'Mrs', 'Dr'],
  })
  readonly title: string;
  @ApiProperty({
    enum: ['administrator'],
  })
  readonly role = 'administrator';
  @ApiProperty()
  readonly designation: string;
  @ApiProperty({
    description: 'letterhead is optional, this string contains a base64 image ciphertext.',
  })
  readonly letterhead: string;
  //@ApiProperty()
  //readonly type: string;
}
