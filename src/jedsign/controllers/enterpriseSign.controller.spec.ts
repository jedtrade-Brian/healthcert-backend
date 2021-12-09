import { Test, TestingModule } from '@nestjs/testing';
import { EnterpriseSignController } from './tvCertsIssue.controller';

describe('Jedsign Controller', () => {
  let controller: EnterpriseSignController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnterpriseSignController],
    }).compile();

    controller = module.get<EnterpriseSignController>(EnterpriseSignController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
