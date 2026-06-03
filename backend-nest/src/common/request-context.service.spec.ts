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
