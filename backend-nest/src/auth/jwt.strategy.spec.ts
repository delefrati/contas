import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { RequestContextService } from '../common/request-context.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: { isBandSessionLive: jest.Mock };
  let requestContext: { getBandId: jest.Mock; requireBandId: jest.Mock; getIdentity: jest.Mock };
  const req = { headers: { authorization: 'Bearer the-token' } } as unknown as Request;

  beforeEach(() => {
    authService = { isBandSessionLive: jest.fn().mockResolvedValue(true) };
    requestContext = {
      getBandId: jest.fn().mockReturnValue(1),
      requireBandId: jest.fn().mockReturnValue(1),
      getIdentity: jest.fn(),
    };
    strategy = new JwtStrategy(
      authService as unknown as AuthService,
      requestContext as unknown as RequestContextService,
    );
  });

  describe('validate', () => {
    it('should return auth payload for valid token payload', async () => {
      const payload = { memberId: 1, bandId: 1, email: 'test@test.com', name: 'Test', oidcSub: 'sub1' };
      const result = await strategy.validate(req, payload);

      expect(result).toEqual({
        memberId: 1,
        bandId: 1,
        email: 'test@test.com',
        name: 'Test',
        oidcSub: 'sub1',
      });
      expect(authService.isBandSessionLive).toHaveBeenCalledWith('the-token', { memberId: 1 }, 1);
    });

    it('should accept a super admin token', async () => {
      const payload = { superAdminId: 3, bandId: 1, email: 'root@test.com', name: 'Root' };
      const result = await strategy.validate(req, payload);

      expect(result).toEqual(expect.objectContaining({ superAdminId: 3, bandId: 1, name: 'Root' }));
      expect(result.memberId).toBeUndefined();
      expect(authService.isBandSessionLive).toHaveBeenCalledWith('the-token', { superAdminId: 3 }, 1);
    });

    it('should reject a token whose session ended or whose account was disabled', async () => {
      authService.isBandSessionLive.mockResolvedValue(false);
      const payload = { memberId: 1, bandId: 1 };

      await expect(strategy.validate(req, payload)).rejects.toThrow('Session expired or account disabled');
    });

    it('should throw UnauthorizedException when memberId is missing', async () => {
      const payload = { bandId: 1, email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(req, payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when memberId is falsy', async () => {
      const payload = { memberId: 0, bandId: 1, email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(req, payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle payload with undefined optional fields', async () => {
      const payload = { memberId: 5, bandId: 1 };
      const result = await strategy.validate(req, payload);

      expect(result).toEqual({
        memberId: 5,
        bandId: 1,
        email: undefined,
        name: undefined,
        oidcSub: undefined,
      });
    });

    it('should reject a token issued for another band without looking up the session', async () => {
      const payload = { memberId: 1, bandId: 2, email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(req, payload)).rejects.toThrow('Token does not belong to this band');
      expect(authService.isBandSessionLive).not.toHaveBeenCalled();
    });

    it('should reject a token without bandId (issued before multi-band)', async () => {
      const payload = { memberId: 1, email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(req, payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an admin panel token, which has no band', async () => {
      const payload = { scope: 'platform', superAdminId: 3, name: 'Root' };

      await expect(strategy.validate(req, payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when the request has no band resolved', async () => {
      requestContext.getBandId.mockReturnValue(undefined);
      const payload = { memberId: 1, bandId: 1 };

      await expect(strategy.validate(req, payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
