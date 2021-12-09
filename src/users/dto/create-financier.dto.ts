import { ApiProperty } from '@nestjs/swagger';

export class CreateFinancierDto {
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
    enum: ['financier', 'enterprise'],
  })
  readonly role = 'financier';
  @ApiProperty()
  readonly designation: string;
  @ApiProperty({
    type: 'object',
    properties: {
      unknown1: {
        type: 'string',
      },
      unknown2: {
        type: 'string',
      },
      unknown3: {
        type: 'string',
      },
      unknown4: {
        type: 'string',
      },
      accountName: {
        type: 'string',
      },
      accountNumber: {
        type: 'string',
      },
      bankName: {
        type: 'string',
      },
      swiftNumber: {
        type: 'string',
      },
    },
  })
  readonly financierDetails: Record<string, any>;

  //@ApiProperty()
  //readonly type: string;
}
