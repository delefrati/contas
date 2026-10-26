import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { MemberService } from '../member/member.service';
import { RequestContextService } from '../common/request-context.service';

// Mock google-auth-library
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: mockVerifyIdToken,
    })),
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let prisma: {
    session: { create: jest.Mock; findUnique: jest.Mock; deleteMany: jest.Mock };
    member: { findMany: jest.Mock; findFirst: jest.Mock };
    superAdmin: { findFirst: jest.Mock };
    band: { findMany: jest.Mock };
  };
  let requestContext: { requireBandId: jest.Mock; getBandId: jest.Mock; getIdentity: jest.Mock };
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
      member: { findMany: jest.fn(), findFirst: jest.fn() },
      superAdmin: { findFirst: jest.fn().mockResolvedValue(null) },
      band: { findMany: jest.fn() },
    };
    requestContext = {
      requireBandId: jest.fn().mockReturnValue(1),
      getBandId: jest.fn().mockReturnValue(1),
      getIdentity: jest.fn(),
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
        { provide: RequestContextService, useValue: requestContext },
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

    it('should sign a super admin in to a band they are not a member of', async () => {
      process.env.GOOGLE_CLIENT_ID = 'client-id';
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ sub: 'google-sub', email: 'root@test.com', email_verified: true }),
      });
      memberService.findByOidcSub.mockResolvedValue(null);
      memberService.findByEmail.mockResolvedValue(null);
      prisma.superAdmin.findFirst.mockResolvedValue({ id: 3, name: 'Root', email: 'root@test.com' });
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.loginWithGoogle('id-token');

      expect(result).toEqual({
        token: 'jwt-token',
        member: { name: 'Root', email: 'root@test.com', superAdmin: true },
      });
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: { superAdminId: 3, token: 'jwt-token', expiresAt: expect.any(Date) },
      });
    });
  });

  describe('centralLoginWithGoogle', () => {
    const maverick = { id: 1, bandId: 1, band: { id: 1, slug: 'maverick', name: 'Maverick' } };
    const outra = { id: 9, bandId: 2, band: { id: 2, slug: 'outra', name: 'Outra' } };

    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'client-id';
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({ sub: 'google-sub', email: 'me@test.com' }),
      });
    });

    it('should look up active memberships by OIDC subject or email', async () => {
      prisma.member.findMany.mockResolvedValue([maverick]);
      await service.centralLoginWithGoogle('id-token');
      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { active: true, OR: [{ oidcSub: 'google-sub' }, { email: 'me@test.com' }] },
        }),
      );
    });

    it('should issue a code when the account belongs to a single band', async () => {
      prisma.member.findMany.mockResolvedValue([maverick]);
      const result = await service.centralLoginWithGoogle('id-token');
      expect(result.band).toBe('maverick');
      expect(result.code).toEqual(expect.any(String));
      expect(result.bands).toBeUndefined();
    });

    it('should list the bands when the account belongs to several and none was requested', async () => {
      prisma.member.findMany.mockResolvedValue([maverick, outra]);
      const result = await service.centralLoginWithGoogle('id-token');
      expect(result.code).toBeUndefined();
      expect(result.bands).toEqual([
        { slug: 'maverick', name: 'Maverick' },
        { slug: 'outra', name: 'Outra' },
      ]);
    });

    it('should issue a code for the requested band', async () => {
      prisma.member.findMany.mockResolvedValue([maverick, outra]);
      const result = await service.centralLoginWithGoogle('id-token', 'outra');
      expect(result.band).toBe('outra');
      expect(result.code).toEqual(expect.any(String));
    });

    it('should reject a band the account does not belong to', async () => {
      prisma.member.findMany.mockResolvedValue([maverick]);
      await expect(service.centralLoginWithGoogle('id-token', 'outra')).rejects.toThrow(BadRequestException);
    });

    it('should reject an account with no memberships', async () => {
      prisma.member.findMany.mockResolvedValue([]);
      await expect(service.centralLoginWithGoogle('id-token')).rejects.toThrow(BadRequestException);
    });

    describe('as a super admin', () => {
      const allBands = [
        { id: 1, slug: 'maverick', name: 'Maverick' },
        { id: 2, slug: 'outra', name: 'Outra' },
      ];

      beforeEach(() => {
        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => ({ sub: 'google-sub', email: 'me@test.com', email_verified: true }),
        });
        prisma.superAdmin.findFirst.mockResolvedValue({ id: 3, name: 'Root', email: 'me@test.com' });
        prisma.band.findMany.mockResolvedValue(allBands);
      });

      it('should list every band, not only the ones the account belongs to', async () => {
        prisma.member.findMany.mockResolvedValue([]);
        const result = await service.centralLoginWithGoogle('id-token');
        expect(prisma.superAdmin.findFirst).toHaveBeenCalledWith({
          where: { email: 'me@test.com', active: true },
        });
        expect(result.bands).toEqual([
          { slug: 'maverick', name: 'Maverick' },
          { slug: 'outra', name: 'Outra' },
        ]);
      });

      it('should issue a code for a band the account is not a member of', async () => {
        prisma.member.findMany.mockResolvedValue([maverick]);
        const result = await service.centralLoginWithGoogle('id-token', 'outra');
        expect(result.band).toBe('outra');
        expect(result.code).toEqual(expect.any(String));
      });

      it('should still reject a band that does not exist', async () => {
        prisma.member.findMany.mockResolvedValue([]);
        await expect(service.centralLoginWithGoogle('id-token', 'ghost')).rejects.toThrow(BadRequestException);
      });

      it('should not trust an email Google has not verified', async () => {
        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => ({ sub: 'google-sub', email: 'me@test.com', email_verified: false }),
        });
        prisma.member.findMany.mockResolvedValue([]);
        await expect(service.centralLoginWithGoogle('id-token', 'outra')).rejects.toThrow(BadRequestException);
        expect(prisma.superAdmin.findFirst).not.toHaveBeenCalled();
      });
    });
  });

  describe('exchangeLoginCode', () => {
    const member = { id: 1, bandId: 1, name: 'Me', email: 'me@test.com', active: true };

    async function issueCode(bandId = 1): Promise<string> {
      process.env.GOOGLE_CLIENT_ID = 'client-id';
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'google-sub' }) });
      prisma.member.findMany.mockResolvedValue([
        { id: member.id, bandId, band: { id: bandId, slug: 'maverick', name: 'Maverick' } },
      ]);
      const { code } = await service.centralLoginWithGoogle('id-token');
      return code as string;
    }

    beforeEach(() => {
      jwtService.sign.mockReturnValue('jwt-token');
      prisma.session.create.mockResolvedValue({});
      prisma.member.findFirst.mockResolvedValue(member);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should exchange a valid code for a session on its band', async () => {
      const code = await issueCode();
      const result = await service.exchangeLoginCode(code);

      expect(result).toEqual({ token: 'jwt-token', member: { id: 1, name: 'Me', email: 'me@test.com' } });
      expect(prisma.member.findFirst).toHaveBeenCalledWith({ where: { id: 1, bandId: 1, active: true } });
      expect(logService.log).toHaveBeenCalledWith('LOGIN', 'auth', 1, { method: 'google-central' }, { memberId: 1 });
    });

    it('should only accept a code once', async () => {
      const code = await issueCode();
      await service.exchangeLoginCode(code);
      await expect(service.exchangeLoginCode(code)).rejects.toThrow('Invalid or expired login code');
    });

    it('should reject a code issued for another band', async () => {
      const code = await issueCode(2);
      await expect(service.exchangeLoginCode(code)).rejects.toThrow('Invalid or expired login code');
    });

    it('should reject an expired code', async () => {
      const code = await issueCode();
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now + 61_000);
      await expect(service.exchangeLoginCode(code)).rejects.toThrow('Invalid or expired login code');
    });

    it('should reject an unknown code', async () => {
      await expect(service.exchangeLoginCode('nope')).rejects.toThrow('Invalid or expired login code');
    });

    it('should reject a code for a member that was disabled meanwhile', async () => {
      const code = await issueCode();
      prisma.member.findFirst.mockResolvedValue(null);
      await expect(service.exchangeLoginCode(code)).rejects.toThrow('Member account is disabled');
    });

    describe('for a super admin', () => {
      const superAdmin = { id: 3, name: 'Root', email: 'root@test.com' };

      async function issueSuperAdminCode(memberships: unknown[] = []): Promise<string> {
        process.env.GOOGLE_CLIENT_ID = 'client-id';
        mockVerifyIdToken.mockResolvedValue({
          getPayload: () => ({ sub: 'google-sub', email: 'root@test.com', email_verified: true }),
        });
        prisma.member.findMany.mockResolvedValue(memberships);
        prisma.superAdmin.findFirst.mockResolvedValue(superAdmin);
        prisma.band.findMany.mockResolvedValue([{ id: 1, slug: 'maverick', name: 'Maverick' }]);
        const { code } = await service.centralLoginWithGoogle('id-token', 'maverick');
        return code as string;
      }

      it('should start a session that belongs to the super admin, not to a member', async () => {
        const code = await issueSuperAdminCode();
        const result = await service.exchangeLoginCode(code);

        expect(result).toEqual({
          token: 'jwt-token',
          member: { name: 'Root', email: 'root@test.com', superAdmin: true },
        });
        expect(prisma.superAdmin.findFirst).toHaveBeenLastCalledWith({ where: { id: 3, active: true } });
        expect(jwtService.sign).toHaveBeenCalledWith(
          { superAdminId: 3, bandId: 1, email: 'root@test.com', name: 'Root' },
          { expiresIn: '24h' },
        );
        expect(prisma.session.create).toHaveBeenCalledWith({
          data: { superAdminId: 3, token: 'jwt-token', expiresAt: expect.any(Date) },
        });
        expect(prisma.member.findFirst).not.toHaveBeenCalled();
        expect(logService.log).toHaveBeenCalledWith(
          'LOGIN', 'auth', undefined, { method: 'google-central' }, { superAdminId: 3 },
        );
      });

      it('should enter as a member where the super admin also belongs to the band', async () => {
        const code = await issueSuperAdminCode([
          { id: 1, bandId: 1, band: { id: 1, slug: 'maverick', name: 'Maverick' } },
        ]);
        const result = await service.exchangeLoginCode(code);

        expect(result.member).toEqual({ id: 1, name: 'Me', email: 'me@test.com' });
        expect(prisma.session.create).toHaveBeenCalledWith({
          data: { memberId: 1, token: 'jwt-token', expiresAt: expect.any(Date) },
        });
      });

      it('should reject a code for a super admin that was disabled meanwhile', async () => {
        const code = await issueSuperAdminCode();
        prisma.superAdmin.findFirst.mockResolvedValue(null);
        await expect(service.exchangeLoginCode(code)).rejects.toThrow('Account is disabled');
      });
    });
  });

  describe('createToken', () => {
    it('should create a JWT token and store session', async () => {
      jwtService.sign.mockReturnValue('jwt-token-123');
      prisma.session.create.mockResolvedValue({});

      const result = await service.createToken({ memberId: 1 }, 'test@test.com', 'Test User');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { memberId: 1, bandId: 1, email: 'test@test.com', name: 'Test User' },
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

      await service.createToken({ memberId: 1 }, 'test@test.com');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { memberId: 1, bandId: 1, email: 'test@test.com', name: '' },
        { expiresIn: '24h' },
      );
    });

    it('should refuse a session without an owner', async () => {
      await expect(service.createToken({})).rejects.toThrow('Session has no owner');
      expect(prisma.session.create).not.toHaveBeenCalled();
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

      await service.logout({ memberId: 1 }, 'token-123');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { memberId: 1, token: 'token-123' },
      });
      expect(logService.log).toHaveBeenCalledWith('LOGOUT', 'auth', 1, {});
    });
  });

  describe('logoutAll', () => {
    it('should delete all sessions for member and log', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });

      await service.logoutAll({ memberId: 1 });

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { memberId: 1 } });
      expect(logService.log).toHaveBeenCalledWith('LOGOUT_ALL', 'auth', 1, {});
    });

    it('should only delete the sessions of the super admin', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 2 });

      await service.logoutAll({ superAdminId: 3 });

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { superAdminId: 3 } });
    });

    it('should never delete every session when the owner is missing', async () => {
      await expect(service.logoutAll({})).rejects.toThrow('Session has no owner');
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
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
