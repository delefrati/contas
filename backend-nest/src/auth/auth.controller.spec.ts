import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { loginWithGoogle: jest.Mock; logout: jest.Mock; logoutAll: jest.Mock };

  beforeEach(async () => {
    authService = {
      loginWithGoogle: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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
    it('should return user from request', async () => {
      const user = { memberId: 1, name: 'Test', email: 'test@test.com' };
      const req = { user } as any;

      const result = await controller.getMe(req);

      expect(result).toEqual({ data: user });
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

      expect(authService.logout).toHaveBeenCalledWith(1, 'token-123');
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

      expect(authService.logoutAll).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Logged out from all devices' });
    });

    it('should throw when user not in request', async () => {
      const req = { user: undefined } as any;
      await expect(controller.logoutAll(req)).rejects.toThrow(BadRequestException);
    });
  });
});
