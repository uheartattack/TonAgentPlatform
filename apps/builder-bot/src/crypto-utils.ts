import * as crypto from 'crypto';

const _ENC_ALGO = 'aes-256-gcm';
const _ENC_KEY: Buffer = (() => {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) return Buffer.from(envKey.slice(0, 32), 'utf8');
  if (envKey) return crypto.createHash('sha256').update(envKey).digest();

  // Production REQUIRES ENCRYPTION_KEY. If missing, we fall back to a BOT_TOKEN
  // hash (deterministic across restarts — better than random which makes data
  // unrecoverable). In non-production we warn loudly.
  const botToken = process.env.BOT_TOKEN;
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  if (!botToken && (nodeEnv === 'production' || nodeEnv === 'prod')) {
    // Hard fail: crashing is better than silently encrypting with random key
    // which would make every decrypt fail after next restart.
    throw new Error('[SECURITY] ENCRYPTION_KEY missing in production. Set it in .env before starting.');
  }
  if (!botToken) {
    console.error('[SECURITY] ENCRYPTION_KEY and BOT_TOKEN both missing — using ephemeral random key. Previously encrypted data WILL be unrecoverable after restart!');
    return crypto.randomBytes(32);
  }
  console.warn('[SECURITY] ENCRYPTION_KEY not set — falling back to BOT_TOKEN-derived key. Set a proper ENCRYPTION_KEY in .env.');
  return crypto.createHash('sha256').update(botToken).digest();
})();

/** Encrypt a plaintext API key using AES-256-GCM. Returns prefixed string "enc:...". */
export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(_ENC_ALGO, _ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/** Decrypt a stored API key. Transparently handles legacy plain-text values. */
export function decryptApiKey(stored: string): string {
  if (!stored.startsWith('enc:')) return stored; // plain text (legacy)
  const parts = stored.slice(4).split(':');
  if (parts.length !== 3) return stored;
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv(_ENC_ALGO, _ENC_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (e) {
    console.warn('[crypto-utils] decryptApiKey failed, returning raw value:', (e as Error).message);
    return stored;
  }
}
