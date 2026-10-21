import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { RequestContextService } from '../common/request-context.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: Partial<AuthService>;
  let requestContext: { getBandId: jest.Mock; requireBandId: jest.Mock; getMemberId: jest.Mock };

  beforeEach(() => {
    authService = {};
    requestContext = {
      getBandId: jest.fn().mockReturnValue(1),
      requireBandId: jest.fn().mockReturnValue(1),
      getMemberId: jest.fn(),
    };
    strategy = new JwtStrategy(
      authService as AuthService,
      requestContext as unknown as RequestContextService,
    );
  });

  describe('validate', () => {
    it('should return auth payload for valid token payload', async () => {
      const payload = { memberId: 1, bandId: 1, email: 'test@test.com', name: 'Test', oidcSub: 'sub1' };
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        memberId: 1,
        bandId: 1,
        email: 'test@test.com',
        name: 'Test',
        oidcSub: 'sub1',
      });
    });

    it('should throw UnauthorizedException when memberId is missing', async () => {
      const payload = { bandId: 1, email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when memberId is falsy', async () => {
      const payload = { memberId: 0, bandId: 1, email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle payload with undefined optional fields', async () => {
      const payload = { memberId: 5, bandId: 1 };
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        memberId: 5,
        bandId: 1,
        email: undefined,
        name: undefined,
        oidcSub: undefined,
      });
    });

    it('should reject a token issued for another band', async () => {
      const payload = { memberId: 1, bandId: 2, email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(payload)).rejects.toThrow('Token does not belong to this band');
    });

    it('should reject a token without bandId (issued before multi-band)', async () => {
      const payload = { memberId: 1, email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when the request has no band resolved', async () => {
      requestContext.getBandId.mockReturnValue(undefined);
      const payload = { memberId: 1, bandId: 1 };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
