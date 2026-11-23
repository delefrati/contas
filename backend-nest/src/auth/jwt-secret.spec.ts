import { readJwtSecret } from './jwt-secret';

const STRONG = 'k7Qe2vLx9pR4tY8uW1zA6sD3fG5hJ0mN';

describe('readJwtSecret', () => {
  it.each([[undefined], [''], ['   ']])('should refuse to start without a secret (%j)', (value) => {
    expect(() => readJwtSecret({ JWT_SECRET: value, NODE_ENV: 'development' })).toThrow(/JWT_SECRET is not set/);
    expect(() => readJwtSecret({ JWT_SECRET: value, NODE_ENV: 'production' })).toThrow(/JWT_SECRET is not set/);
  });

  it.each([
    ['CHANGE_ME_LONG_RANDOM_SECRET'],
    ['dev-secret-change-in-production'],
    ['your-secret-key-change-in-production'],
  ])('should refuse the public example %s in production', (value) => {
    expect(() => readJwtSecret({ JWT_SECRET: value, NODE_ENV: 'production' })).toThrow(/example values/);
  });

  it('should refuse a secret shorter than 32 characters in production', () => {
    expect(() => readJwtSecret({ JWT_SECRET: STRONG.slice(0, 31), NODE_ENV: 'production' })).toThrow(/at least 32/);
  });

  it('should say how to make a secret', () => {
    expect(() => readJwtSecret({ NODE_ENV: 'production' })).toThrow(/openssl rand -base64 48/);
  });

  it('should accept a long random secret in production', () => {
    expect(readJwtSecret({ JWT_SECRET: STRONG, NODE_ENV: 'production' })).toBe(STRONG);
  });

  it('should keep working with the example from .env.example in development', () => {
    expect(readJwtSecret({ JWT_SECRET: 'dev-secret-change-in-production', NODE_ENV: 'development' })).toBe(
      'dev-secret-change-in-production',
    );
    expect(readJwtSecret({ JWT_SECRET: 'short' })).toBe('short');
  });
});
