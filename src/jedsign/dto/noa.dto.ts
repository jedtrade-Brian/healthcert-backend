import { ApiProperty } from '@nestjs/swagger';

export class NoaDto {
  @ApiProperty({
    type: 'array',
    items: {
      properties: {
        recipient: {
          type: 'object',
          properties: {
            buyerEmail: {
              type: 'string',
            },
          },
        },
        invInfo: {
          type: 'array',
          items: {
            properties: {
              docHash: {
                type: 'string',
              },
            },
          },
        },
        noaDetails: {
          type: 'array',
          items: {
            properties: {
              invtId: {
                type: 'string',
              },
              invtCpy: {
                type: 'string',
              },
              invtPercent: {
                type: 'string',
              },
              transBrief: {
                type: 'string',
              },
              transNo: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  })
  readonly noa: any;
}
