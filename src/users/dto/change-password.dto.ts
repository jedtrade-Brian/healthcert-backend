import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
    @ApiProperty()
    readonly oldpassword: string;
    @ApiProperty()
    readonly newpassword: string;
}
