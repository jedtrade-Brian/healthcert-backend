import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
    @ApiProperty()
    readonly fullName: string;
    @ApiProperty()
    readonly mobileNo: string;
    @ApiProperty()
    readonly address1: string;
    @ApiProperty()
    readonly address2?: string;
    @ApiProperty()
    readonly zipcode: string;
    @ApiProperty()
    readonly country: string;
}
