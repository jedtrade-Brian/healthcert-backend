import { ApiProperty } from '@nestjs/swagger';

export class DictDTO {
  @ApiProperty({
    type: 'array',
    items: {
      properties: {
        recipient: {
          type: 'object',
          properties: {
            patientId: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
            nric: {
              type: 'string',
            },
            email: {
              type: 'string',
            },
            lastName: {
              type: 'string',
            },
            passportNo: {
              type: 'string',
            },
            nationality: {
              type: 'string',
            },
            dob: {
              type: 'number',
            },
            completionDate: {
              type: 'number',
            },
          },
        },
        transcript: {
          type: 'array',
          items: {
            properties: {
              moduleName: {
                type: 'string',
                description: 'Module Name',
              },
              grade: {
                type: 'string',
                description: 'Module Grade',
              },
            },
          },
        },
        id: {
          type: 'string',
        },
      },
    },
  })
  readonly documents: object[];
}
