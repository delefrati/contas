import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';
import { Request, Response } from 'express';

describe('RequestContextMiddleware', () => {
  let middleware: RequestContextMiddleware;
  let requestContext: { run: jest.Mock };

  beforeEach(() => {
    requestContext = {
      run: jest.fn().mockImplementation((ctx, cb) => cb()),
    };
    middleware = new RequestContextMiddleware(requestContext as unknown as RequestContextService);
  });

  it('should extract memberId from valid JWT in authorization header', () => {
    const payload = { memberId: 42, email: 'test@test.com' };
    const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: 42 }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('should set memberId to undefined when no authorization header', () => {
    const req = { headers: {} } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('should set memberId to undefined for malformed token', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('should set memberId to undefined when payload has non-numeric memberId', () => {
    const payload = { memberId: 'not-a-number' };
    const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('should handle non-Bearer authorization schemes', () => {
    const req = { headers: { authorization: 'Basic abc123' } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(requestContext.run).toHaveBeenCalledWith({ memberId: undefined }, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });
});
