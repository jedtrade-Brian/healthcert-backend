import { ApiProperty } from '@nestjs/swagger';

export class CertificateDTO {
  @ApiProperty({
    type: 'array',
    items: {
      properties: {
        recipient: {
          type: 'object',
          properties: {
            studentId: {
              type: 'string',
            },
            nric: {
              type: 'string',
            },
            email: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
            lastName: {
              type: 'string',
            },
            courseName: {
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
        docType: {
          type: 'string'
        }
      },
    },
  })
  readonly documents: object[];
}
