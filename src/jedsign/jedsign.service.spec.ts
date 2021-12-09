import { Test, TestingModule } from '@nestjs/testing';
import { JedsignService } from './jedsign.service';

describe('JedsignService', () => {
  let service: JedsignService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JedsignService],
    }).compile();

    service = module.get<JedsignService>(JedsignService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
