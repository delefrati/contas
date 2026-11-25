import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';

// How often one IP may call each sign-in route. Leaves room for a band signing in together on
// one venue's Wi-Fi (a central sign-in is up to three calls), and little for guessing.
export const SIGN_IN_LIMIT = { limit: 10, ttl: 60_000 };

// Named 'default' so the 429 carries the standard Retry-After header (others get a suffix)
export const signInThrottlerOptions: ThrottlerModuleOptions = [{ name: 'default', ...SIGN_IN_LIMIT }];

// The backend only takes requests from Caddy, which replaces any X-Forwarded-For a client sends
// with the address the request came from. Trusting that one hop makes req.ip the user's
// address; otherwise every user would share Caddy's address, and one limit.
export function trustCaddy(app: NestExpressApplication): void {
  app.set('trust proxy', 1);
}

// Put on the sign-in routes only, keyed on req.ip. The rest of the API isn't limited.
// Answers with a code, as the sign-in errors do, so the pages can say it in the user's language.
@Injectable()
export class SignInThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Too many sign-in attempts. Please try again in a moment.',
        code: 'TOO_MANY_ATTEMPTS',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
