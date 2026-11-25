import { describeRequestBodies } from '../common/request-validation.testing';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { signInThrottlerOptions } from '../common/sign-in-throttle';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    loginWithGoogle: jest.Mock;
    logout: jest.Mock;
    logoutAll: jest.Mock;
    currentAccount: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      currentAccount: jest.fn(),
      loginWithGoogle: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      // For the sign-in routes' rate limit (see sign-in-throttle.spec.ts)
      imports: [ThrottlerModule.forRoot(signInThrottlerOptions)],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('loginWithGoogle', () => {
    it('should return login response wrapped in data', async () => {
      const loginResponse = { token: 'jwt', member: { id: 1, name: 'Test', email: 'test@test.com' } };
      authService.loginWithGoogle.mockResolvedValue(loginResponse);

      const result = await controller.loginWithGoogle({ credential: 'google-token' });

      expect(authService.loginWithGoogle).toHaveBeenCalledWith('google-token');
      expect(result).toEqual({ data: loginResponse });
    });
  });

  describe('getMe', () => {
    it('should return the account as it is now, not as it was at sign-in', async () => {
      const user = { memberId: 1, name: 'Test', email: 'test@test.com' };
      const current = { ...user, name: 'Renamed' };
      authService.currentAccount.mockResolvedValue(current);
      const req = { user } as any;

      const result = await controller.getMe(req);

      expect(authService.currentAccount).toHaveBeenCalledWith(user);
      expect(result).toEqual({ data: current });
    });

    it('should throw when user not in request', async () => {
      const req = { user: undefined } as any;

      await expect(controller.getMe(req)).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      authService.logout.mockResolvedValue(undefined);
      const req = {
        user: { memberId: 1, name: 'Test' },
        headers: { authorization: 'Bearer token-123' },
      } as any;

      const result = await controller.logout(req);

      expect(authService.logout).toHaveBeenCalledWith(req.user, 'token-123');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should throw when user not in request', async () => {
      const req = { user: undefined, headers: {} } as any;
      await expect(controller.logout(req)).rejects.toThrow(BadRequestException);
    });

    it('should throw when authorization header missing', async () => {
      const req = { user: { memberId: 1, name: 'Test' }, headers: {} } as any;
      await expect(controller.logout(req)).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid authorization header format', async () => {
      const req = {
        user: { memberId: 1, name: 'Test' },
        headers: { authorization: 'InvalidFormat' },
      } as any;
      await expect(controller.logout(req)).rejects.toThrow(BadRequestException);
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices', async () => {
      authService.logoutAll.mockResolvedValue(undefined);
      const req = { user: { memberId: 1, name: 'Test' } } as any;

      const result = await controller.logoutAll(req);

      expect(authService.logoutAll).toHaveBeenCalledWith(req.user);
      expect(result).toEqual({ message: 'Logged out from all devices' });
    });

    it('should throw when user not in request', async () => {
      const req = { user: undefined } as any;
      await expect(controller.logoutAll(req)).rejects.toThrow(BadRequestException);
    });
  });
});

const resolves = () => jest.fn().mockResolvedValue({ id: 1 });

describeRequestBodies(
  'AuthController',
  () => ({
    controllers: [AuthController],
    services: [[AuthService, {
      loginWithGoogle: resolves(), centralLoginWithGoogle: resolves(), exchangeLoginCode: resolves(),
    }]],
  }),
  {
    accepts: [
      // useAuth
      ['a sign-in on the band host', 'post', '/api/auth/login/google', { credential: 'token' }],
      ['a central sign-in', 'post', '/api/auth/central/google', { credential: 'token' }],
      ['a central sign-in for a picked band', 'post', '/api/auth/central/google', { credential: 'token', band: 'maverick' }],
      ['a login code', 'post', '/api/auth/central/exchange', { code: 'abc' }],
    ],
    refuses: [
      ['a sign-in without a credential', 'post', '/api/auth/login/google', {}],
      ['a credential that is not text', 'post', '/api/auth/login/google', { credential: { token: 'x' } }],
      ['an extra field', 'post', '/api/auth/login/google', { credential: 'token', bandId: 2 }],
      ['a band that is not text', 'post', '/api/auth/central/google', { credential: 'token', band: 3 }],
      ['a login code that is not text', 'post', '/api/auth/central/exchange', { code: 123 }],
      ['an extra field with the code', 'post', '/api/auth/central/exchange', { code: 'abc', memberId: 1 }],
    ],
  },
);
