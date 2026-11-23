import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const VERSION = 'v1';

// AES-256-GCM: "v1:<iv>:<tag>:<ciphertext>", each part in base64
export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, ...[iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64'))].join(':');
}

// The stored token can't be read: another key, or a changed text
export class TokenDecryptError extends Error {}

export function decryptToken(stored: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = stored.split(':');
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new TokenDecryptError('Unknown token format');
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new TokenDecryptError('The token was encrypted with another key, or changed');
  }
}
