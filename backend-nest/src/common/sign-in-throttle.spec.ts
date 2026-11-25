import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AdminAuthController } from '../admin/admin.controller';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { BandService } from '../band/band.service';
import { SIGN_IN_LIMIT, signInThrottlerOptions, trustCaddy } from './sign-in-throttle';

// Each request comes through Caddy, as in production: a test sets the X-Forwarded-For that
// Caddy would send for the user's address.
describe('Sign-in rate limit', () => {
  let app: INestApplication;
  const authService = {
    loginWithGoogle: jest.fn().mockResolvedValue({ token: 't', member: {} }),
    centralLoginWithGoogle: jest.fn().mockResolvedValue({ code: 'c', band: 'maverick' }),
    exchangeLoginCode: jest.fn().mockResolvedValue({ token: 't', member: {} }),
    adminLoginWithGoogle: jest.fn().mockResolvedValue({ token: 't', superAdmin: {} }),
    getSessionState: jest.fn().mockResolvedValue('active'),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(signInThrottlerOptions)],
      controllers: [AuthController, AdminAuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        // For AdminAuthGuard on /api/admin/auth/me and /logout, which these tests never call
        { provide: BandService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    trustCaddy(app as NestExpressApplication);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function post(path: string, ip: string) {
    return request(app.getHttpServer()).post(path).set('X-Forwarded-For', ip).send({ credential: 'x', code: 'x' });
  }

  async function useUpLimit(path: string, ip: string) {
    for (let i = 0; i < SIGN_IN_LIMIT.limit; i++) {
      await post(path, ip).expect(201);
    }
  }

  it.each([
    '/api/auth/login/google',
    '/api/auth/central/google',
    '/api/auth/central/exchange',
    '/api/admin/auth/google',
  ])('answers %s with 429 and a code once an IP is over the limit', async (path) => {
    await useUpLimit(path, '203.0.113.7');

    const response = await post(path, '203.0.113.7').expect(429);
    expect(response.body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_ATTEMPTS' });
    expect(response.headers['retry-after']).toBe('60');
  });

  it('gives each forwarded IP its own limit', async () => {
    await useUpLimit('/api/auth/central/google', '203.0.113.7');

    await post('/api/auth/central/google', '198.51.100.20').expect(201);
    await post('/api/auth/central/google', '203.0.113.7').expect(429);
  });

  it('keys on the address Caddy adds, not on one a client sent along', async () => {
    // Caddy replaces a client's own header; were it appended, the last address is Caddy's view
    await useUpLimit('/api/auth/login/google', '10.0.0.1, 203.0.113.7');

    await post('/api/auth/login/google', '10.0.0.99, 203.0.113.7').expect(429);
  });

  it('counts each sign-in route apart', async () => {
    await useUpLimit('/api/auth/central/google', '203.0.113.7');

    await post('/api/auth/central/exchange', '203.0.113.7').expect(201);
  });

  it('leaves other routes unlimited', async () => {
    for (let i = 0; i < SIGN_IN_LIMIT.limit * 2; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/session-state')
        .set('X-Forwarded-For', '203.0.113.7')
        .expect(200);
    }
  });
});
