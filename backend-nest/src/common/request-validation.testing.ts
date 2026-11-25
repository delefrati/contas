import { INestApplication, Provider, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SignInThrottlerGuard } from './sign-in-throttle';
import { validateRequests } from './request-validation';

// Test-only helpers, left out of the build by tsconfig.json.

// Controllers behind the same validation main.ts sets up, with their guards let through
export async function appWithValidation(
  controllers: Type<unknown>[],
  providers: Provider[],
): Promise<INestApplication> {
  const allow = { canActivate: () => true };
  const moduleRef = await Test.createTestingModule({ controllers, providers })
    .overrideGuard(JwtAuthGuard)
    .useValue(allow)
    .overrideGuard(AdminAuthGuard)
    .useValue(allow)
    .overrideGuard(SignInThrottlerGuard)
    .useValue(allow)
    .compile();

  const app = moduleRef.createNestApplication();
  validateRequests(app);
  await app.init();
  return app;
}

type Method = 'post' | 'patch' | 'put';
// A description, then the request: method, path and JSON body
export type BodyCase = [string, Method, string, unknown];

// Checks a controller's bodies over HTTP: each accepted one reaches the service, and each
// refused one is a 400 that never does. Accepted bodies are the ones the app's forms send.
export function describeRequestBodies(
  name: string,
  // The controllers, and the services they use as [class, mock] pairs
  setup: () => { controllers: Type<unknown>[]; services: [Type<unknown>, Record<string, jest.Mock>][] },
  cases: { accepts: BodyCase[]; refuses: BodyCase[] },
): void {
  describe(`${name} request bodies`, () => {
    let app: INestApplication;
    let mocks: Record<string, jest.Mock>[];

    beforeAll(async () => {
      const built = setup();
      mocks = built.services.map(([, mock]) => mock);
      app = await appWithValidation(
        built.controllers,
        built.services.map(([provide, useValue]) => ({ provide, useValue })),
      );
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    function send([, method, path, body]: BodyCase) {
      return request(app.getHttpServer())[method](path).send(body as object);
    }

    function serviceCalls(): number {
      return mocks
        .flatMap((mock) => Object.values(mock))
        .reduce((count, fn) => count + fn.mock.calls.length, 0);
    }

    it.each(cases.accepts)('accepts %s', async (...testCase) => {
      const response = await send(testCase);
      expect(response.status).toBeLessThan(300);
      expect(serviceCalls()).toBeGreaterThan(0);
    });

    it.each(cases.refuses)('refuses %s with 400', async (...testCase) => {
      const response = await send(testCase);
      expect(response.status).toBe(400);
      expect(serviceCalls()).toBe(0);
    });
  });
}
