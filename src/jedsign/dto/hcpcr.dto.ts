import { ApiProperty } from '@nestjs/swagger';

export class HCPCRDTO {
  @ApiProperty({
      type: 'array',
      items: {
        properties: {
            id: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
            validFrom: {
              type: 'string',
            },
            fhirVersion: {
              type: 'string',
            },
            fhirBundle: {
              type: 'object',
              properties: {
                resourceType: {
                  type: 'string',
                },    
                type: {
                  type: 'string',
                },
                entry: {
                  type: 'object',
                  properties: {
                    resourceType: {
                      type: 'string',
                    },
                    extension:{
                      type: 'object',
                      properties: {
                        url: {
                          type: 'string',
                        },
                        code: {
                          type: 'string',
                        },
                      }
                    },
                    identifier:{
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                        },
                        value: {
                          type: 'string'
                        }, 
                      }
                    },
                    name:{
                      type: 'object',
                      properties: {
                        name: {
                          type: 'string',
                        }  
                      }
                    },
                    gender: {
                      type: 'string'
                    },
                    birthDate: {
                      type: 'string'
                    }, 

                    
                    type:{
                      type: 'object',
                      properties: {
                        coding: {
                          type: 'object',
                          properties: {
                            system: {
                              type: 'string',
                            },
                            code: {
                              type: 'number',
                            },
                            display: {
                              type: 'string',
                            },
                          }

                        }  
                      }
                    },

                    collection : {
                      type: 'string'
                    },


                    valueCodeableConcept:{
                      type: 'object',
                      properties: {
                        coding: {
                          type: 'object',
                          properties: {
                          system: { 
                            type: 'string' 
                          },
                          code: { 
                            type: 'string' 
                          },
                          display: { 
                            type: 'string' 
                          },
                         }
                        }  
                      }
                    },

                    effectiveDateTime:{
                      type: 'string'
                    },

                    status:{
                      type: 'string'
                    },

                    performer:{
                      type: 'object',
                      properties: {
                        name: {
                          type: 'object',
                          properties: {
                          text: { 
                            type: 'string' 
                          },
                         }
                        }  
                      }
                    },

                    qualification:{
                      type: 'object',
                      properties: {
                        identifier: {
                            type: 'string' 
                          },
                        issuer: {
                          type: 'string' 
                        },      
                      }
                    },
             
                    endpoint: {
                      type: 'object',
                      properties: {
                        address:{  
                          type: 'string'
                        }
                      }
                    },

                    
                    contact: {
                      type: 'object',
                      properties: {
                        telecom:{ 
                          type: 'object',
                          properties: {
                            system:{  
                              type: 'string'
                            },
                            value:{  
                              type: 'number'
                            }
                          }
                        },

                        address:{ 
                          type: 'object',
                          properties: {
                            type:{  
                              type: 'string'
                            },
                            use:{  
                              type: 'string'
                            },
                            text:{  
                              type: 'string'
                            }
                          }
                        }
                      }
                    },

                }  

              }
            }   
          }   
        }
      }
  })
  readonly documents: object[];
}
    

