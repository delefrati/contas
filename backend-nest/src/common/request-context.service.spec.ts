import { NotFoundException } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('should return an empty identity when no context is active', () => {
    expect(service.getIdentity()).toEqual({ memberId: undefined, superAdminId: undefined });
  });

  it('should store and retrieve the member within a run context', (done) => {
    service.run({ memberId: 42 }, () => {
      expect(service.getIdentity()).toEqual({ memberId: 42, superAdminId: undefined });
      done();
    });
  });

  it('should store and retrieve the super admin within a run context', (done) => {
    service.run({ superAdminId: 3 }, () => {
      expect(service.getIdentity()).toEqual({ memberId: undefined, superAdminId: 3 });
      done();
    });
  });

  it('should isolate contexts between nested runs', (done) => {
    service.run({ memberId: 1 }, () => {
      expect(service.getIdentity().memberId).toBe(1);
      service.run({ memberId: 2 }, () => {
        expect(service.getIdentity().memberId).toBe(2);
        done();
      });
    });
  });
});

describe('RequestContextService band scoping', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('should return undefined bandId when no context is active', () => {
    expect(service.getBandId()).toBeUndefined();
  });

  it('should store and retrieve bandId within a run context', (done) => {
    service.run({ memberId: 1, bandId: 3 }, () => {
      expect(service.getBandId()).toBe(3);
      expect(service.requireBandId()).toBe(3);
      done();
    });
  });

  it('should throw NotFoundException from requireBandId when no band is set', (done) => {
    service.run({ memberId: 1 }, () => {
      expect(() => service.requireBandId()).toThrow(NotFoundException);
      done();
    });
  });
});
