import { randomBytes } from 'crypto';
import { TokenDecryptError, decryptToken, encryptToken } from './token-crypto';

describe('token-crypto', () => {
  const key = randomBytes(32);

  it('should give back the token it encrypted, without the token in the stored text', () => {
    const stored = encryptToken('AQD-refresh-token', key);

    expect(stored).toMatch(/^v1:/);
    expect(stored).not.toContain('AQD-refresh-token');
    expect(decryptToken(stored, key)).toBe('AQD-refresh-token');
  });

  it('should never encrypt the same token to the same text', () => {
    expect(encryptToken('same', key)).not.toBe(encryptToken('same', key));
  });

  it('should refuse another key, a changed text and an unknown format', () => {
    const stored = encryptToken('AQD-refresh-token', key);
    const [v, iv, tag, data] = stored.split(':');
    const changed = [v, iv, tag, Buffer.from('x' + Buffer.from(data, 'base64').toString()).toString('base64')].join(':');

    expect(() => decryptToken(stored, randomBytes(32))).toThrow(TokenDecryptError);
    expect(() => decryptToken(changed, key)).toThrow(TokenDecryptError);
    expect(() => decryptToken('plain-token', key)).toThrow(TokenDecryptError);
  });
});
