import { ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AuthService } from '../auth/auth.service';
import { BandService } from '../band/band.service';

describe('AdminAuthGuard', () => {
  const admin = { scope: 'platform' as const, superAdminId: 3, email: 'root@test.com', name: 'Root' };
  let authService: { validateAdminToken: jest.Mock };
  let bandService: { isCentralHost: jest.Mock };
  let guard: AdminAuthGuard;

  function contextFor(req: Record<string, any>): ExecutionContext {
    return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    authService = { validateAdminToken: jest.fn().mockResolvedValue(admin) };
    bandService = { isCentralHost: jest.fn().mockReturnValue(true) };
    guard = new AdminAuthGuard(authService as unknown as AuthService, bandService as unknown as BandService);
  });

  it('should let a valid admin session through and expose it on the request', async () => {
    const req: Record<string, any> = { headers: { host: 'minhabanda.com', authorization: 'Bearer tok' } };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);

    expect(bandService.isCentralHost).toHaveBeenCalledWith('minhabanda.com');
    expect(authService.validateAdminToken).toHaveBeenCalledWith('tok');
    expect(req.admin).toEqual(admin);
  });

  it('should not exist on band hosts', async () => {
    bandService.isCentralHost.mockReturnValue(false);
    const req = { headers: { host: 'maverick.minhabanda.com', authorization: 'Bearer tok' } };

    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(NotFoundException);
    expect(authService.validateAdminToken).not.toHaveBeenCalled();
  });

  it('should reject requests without a bearer token', async () => {
    await expect(guard.canActivate(contextFor({ headers: { host: 'minhabanda.com' } })))
      .rejects.toThrow(UnauthorizedException);
    expect(authService.validateAdminToken).not.toHaveBeenCalled();
  });

  it('should reject tokens that are not a live admin session', async () => {
    authService.validateAdminToken.mockResolvedValue(null);
    const req = { headers: { host: 'minhabanda.com', authorization: 'Bearer band-token' } };

    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(UnauthorizedException);
  });
});
