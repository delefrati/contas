import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: Partial<AuthService>;

  beforeEach(() => {
    authService = {};
    strategy = new JwtStrategy(authService as AuthService);
  });

  describe('validate', () => {
    it('should return auth payload for valid token payload', async () => {
      const payload = { memberId: 1, email: 'test@test.com', name: 'Test', oidcSub: 'sub1' };
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        memberId: 1,
        email: 'test@test.com',
        name: 'Test',
        oidcSub: 'sub1',
      });
    });

    it('should throw UnauthorizedException when memberId is missing', async () => {
      const payload = { email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when memberId is falsy', async () => {
      const payload = { memberId: 0, email: 'test@test.com', name: 'Test' };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should handle payload with undefined optional fields', async () => {
      const payload = { memberId: 5 };
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        memberId: 5,
        email: undefined,
        name: undefined,
        oidcSub: undefined,
      });
    });
  });
});
