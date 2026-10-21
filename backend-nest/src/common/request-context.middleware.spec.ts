import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';
import { BandService } from '../band/band.service';
import { Request, Response } from 'express';

describe('RequestContextMiddleware', () => {
  let middleware: RequestContextMiddleware;
  let requestContext: { run: jest.Mock };
  let bandService: { resolveSlug: jest.Mock; findBySlug: jest.Mock };

  beforeEach(() => {
    requestContext = {
      run: jest.fn().mockImplementation((ctx, cb) => cb()),
    };
    bandService = {
      resolveSlug: jest.fn().mockReturnValue('maverick'),
      findBySlug: jest.fn().mockResolvedValue({ id: 7, slug: 'maverick', name: 'Maverick' }),
    };
    middleware = new RequestContextMiddleware(
      requestContext as unknown as RequestContextService,
      bandService as unknown as BandService,
    );
  });

  it('should extract memberId from valid JWT in authorization header', async () => {
    const payload = { memberId: 42, email: 'test@test.com' };
    const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: 42, bandId: 7 }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('should set memberId to undefined when no authorization header', async () => {
    const req = { headers: {} } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined, bandId: 7 }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('should set memberId to undefined for malformed token', async () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined, bandId: 7 }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('should set memberId to undefined when payload has non-numeric memberId', async () => {
    const payload = { memberId: 'not-a-number' };
    const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined, bandId: 7 }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('should handle non-Bearer authorization schemes', async () => {
    const req = { headers: { authorization: 'Basic abc123' } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined, bandId: 7 }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  describe('band resolution', () => {
    it('should resolve the band from the request host and set bandId', async () => {
      const req = { headers: { host: 'maverick.minhabanda.com' } } as unknown as Request;
      const next = jest.fn();

      await middleware.use(req, {} as Response, next);

      expect(bandService.resolveSlug).toHaveBeenCalledWith('maverick.minhabanda.com');
      expect(bandService.findBySlug).toHaveBeenCalledWith('maverick');
      expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined, bandId: 7 }, expect.any(Function));
      expect(next).toHaveBeenCalledWith();
    });

    it('should leave bandId undefined when no slug can be resolved', async () => {
      bandService.resolveSlug.mockReturnValue(undefined);
      const req = { headers: { host: 'example.org' } } as unknown as Request;
      const next = jest.fn();

      await middleware.use(req, {} as Response, next);

      expect(bandService.findBySlug).not.toHaveBeenCalled();
      expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined, bandId: undefined }, expect.any(Function));
      expect(next).toHaveBeenCalledWith();
    });

    it('should leave bandId undefined when the band does not exist', async () => {
      bandService.findBySlug.mockResolvedValue(null);
      const req = { headers: { host: 'ghost.minhabanda.com' } } as unknown as Request;
      const next = jest.fn();

      await middleware.use(req, {} as Response, next);

      expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined, bandId: undefined }, expect.any(Function));
      expect(next).toHaveBeenCalledWith();
    });

    it('should forward band lookup errors to next without running the context', async () => {
      const error = new Error('db down');
      bandService.findBySlug.mockRejectedValue(error);
      const req = { headers: { host: 'maverick.minhabanda.com' } } as unknown as Request;
      const next = jest.fn();

      await middleware.use(req, {} as Response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(requestContext.run).not.toHaveBeenCalled();
    });
  });
});
