import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { MemberService } from '../member/member.service';

// Mock google-auth-library
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: jest.fn(),
    })),
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let prisma: { session: { create: jest.Mock; findUnique: jest.Mock; deleteMany: jest.Mock } };
  let logService: { log: jest.Mock };
  let memberService: { findByOidcSub: jest.Mock; findByEmail: jest.Mock };

  beforeEach(async () => {
    jwtService = { sign: jest.fn(), verify: jest.fn() };
    prisma = {
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    logService = { log: jest.fn().mockResolvedValue({}) };
    memberService = { findByOidcSub: jest.fn(), findByEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: LogService, useValue: logService },
        { provide: MemberService, useValue: memberService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('loginWithGoogle', () => {
    it('should throw when idToken is empty', async () => {
      await expect(service.loginWithGoogle('')).rejects.toThrow('Google ID token is required');
    });

    it('should throw when GOOGLE_CLIENT_ID is not set', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      await expect(service.loginWithGoogle('some-token'))
        .rejects.toThrow('Google authentication is not configured');
    });
  });

  describe('createToken', () => {
    it('should create a JWT token and store session', async () => {
      jwtService.sign.mockReturnValue('jwt-token-123');
      prisma.session.create.mockResolvedValue({});

      const result = await service.createToken(1, 'test@test.com', 'Test User');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { memberId: 1, email: 'test@test.com', name: 'Test User' },
        { expiresIn: '24h' },
      );
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: { memberId: 1, token: 'jwt-token-123', expiresAt: expect.any(Date) },
      });
      expect(result).toBe('jwt-token-123');
    });

    it('should use empty string for name when not provided', async () => {
      jwtService.sign.mockReturnValue('token');
      prisma.session.create.mockResolvedValue({});

      await service.createToken(1, 'test@test.com');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { memberId: 1, email: 'test@test.com', name: '' },
        { expiresIn: '24h' },
      );
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token with active session', async () => {
      const payload = { memberId: 1, email: 'test@test.com', name: 'Test' };
      jwtService.verify.mockReturnValue(payload);
      prisma.session.findUnique.mockResolvedValue({
        token: 'valid-token', expiresAt: new Date(Date.now() + 3600000),
      });

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(payload);
    });

    it('should throw when session is expired', async () => {
      jwtService.verify.mockReturnValue({ memberId: 1 });
      prisma.session.findUnique.mockResolvedValue({
        token: 'expired-token', expiresAt: new Date(Date.now() - 3600000),
      });

      await expect(service.validateToken('expired-token'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw when session not found', async () => {
      jwtService.verify.mockReturnValue({ memberId: 1 });
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.validateToken('orphan-token'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw when token verification fails', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.validateToken('bad-token'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('should delete session and log', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout(1, 'token-123');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { memberId: 1, token: 'token-123' },
      });
      expect(logService.log).toHaveBeenCalledWith('LOGOUT', 'auth', 1, {});
    });
  });

  describe('logoutAll', () => {
    it('should delete all sessions for member and log', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });

      await service.logoutAll(1);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { memberId: 1 } });
      expect(logService.log).toHaveBeenCalledWith('LOGOUT_ALL', 'auth', 1, {});
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete sessions older than now', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 5 });

      await service.cleanupExpiredSessions();

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });
});
