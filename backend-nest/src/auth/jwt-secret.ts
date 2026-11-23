// Values published in this repo's examples and docs: anyone can sign tokens with them
const PUBLIC_SECRETS = [
  'CHANGE_ME_LONG_RANDOM_SECRET',
  'dev-secret-change-in-production',
  'your-secret-key-change-in-production',
];

const MIN_PRODUCTION_LENGTH = 32;

const HOW_TO = 'Make one with: openssl rand -base64 48';

// The secret every token is signed and checked with. There is no fallback: without one, or with a
// weak one in production, the backend must not start.
export function readJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = (env.JWT_SECRET ?? '').trim();
  if (!secret) {
    throw new Error(`JWT_SECRET is not set. ${HOW_TO}`);
  }

  if (env.NODE_ENV === 'production') {
    if (PUBLIC_SECRETS.includes(secret)) {
      throw new Error(`JWT_SECRET is one of the example values, which are public. ${HOW_TO}`);
    }
    if (secret.length < MIN_PRODUCTION_LENGTH) {
      throw new Error(`JWT_SECRET must be at least ${MIN_PRODUCTION_LENGTH} characters in production. ${HOW_TO}`);
    }
  }

  return secret;
}
