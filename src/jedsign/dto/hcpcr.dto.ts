import { ApiProperty } from '@nestjs/swagger';

export class HCPCRDTO {
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
            patientEmail: {
              type: 'string',
            },
            patientFirstName: {
              type: 'string',
            },
            patientLastName: {
              type: 'string',
            },
            gender: {
              type: 'string',
            },
            patientPPN: {
              type: 'string',
            },
            nationality: {
              type: 'string',
            },
            dob: {
              type: 'number',
            },
            patientTKC: {
              type: 'number',
            },
            patientTKN: {
              type: 'string',
            },
            collectedDate: {
              type: 'number',
            },
            effectiveDate: {
              type: 'number',
            },
            resultCode: {
              type: 'number',
            },
            result: {
              type: 'string',
            },
            performer: {
              type: 'string',
            },
            identifier: {
              type: 'string',
            },
            clinicName: {
              type: 'string',
            },
            officeAdd: {
              type: 'string',
            },
            OfficeNo: {
              type: 'number',
            },
            webAdd: {
              type: 'string',
            },
            labName: {
              type: 'string',
            },
            labAdd: {
              type: 'string',
            },
            labNo: {
              type: 'number',
            },
          },
        },
        transcriptId: {
          type: 'string',
        },
      },
    },
  })
  readonly documents: object[];
}
