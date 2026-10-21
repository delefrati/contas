import { NotFoundException } from '@nestjs/common';
import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('should return undefined when no context is active', () => {
    expect(service.getMemberId()).toBeUndefined();
  });

  it('should store and retrieve memberId within a run context', (done) => {
    service.run({ memberId: 42 }, () => {
      expect(service.getMemberId()).toBe(42);
      done();
    });
  });

  it('should isolate contexts between nested runs', (done) => {
    service.run({ memberId: 1 }, () => {
      expect(service.getMemberId()).toBe(1);
      service.run({ memberId: 2 }, () => {
        expect(service.getMemberId()).toBe(2);
        done();
      });
    });
  });

  it('should handle undefined memberId in context', (done) => {
    service.run({ memberId: undefined }, () => {
      expect(service.getMemberId()).toBeUndefined();
      done();
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
