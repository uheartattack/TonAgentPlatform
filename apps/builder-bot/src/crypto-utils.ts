import * as crypto from 'crypto';

const _ENC_ALGO = 'aes-256-gcm';
const _ENC_KEY: Buffer = (() => {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) return Buffer.from(envKey.slice(0, 32), 'utf8');
  if (envKey) return crypto.createHash('sha256').update(envKey).digest();
  // Deterministic fallback from BOT_TOKEN so it survives restarts
  return crypto.createHash('sha256').update(process.env.BOT_TOKEN || 'default-key').digest();
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
