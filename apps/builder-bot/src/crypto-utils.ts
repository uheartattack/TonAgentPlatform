import * as crypto from 'crypto';

const _ENC_ALGO = 'aes-256-gcm';

// Derive key lazily AND from a list of candidates so decrypt can recover values
// that were encrypted with any of (ENCRYPTION_KEY, BOT_TOKEN-fallback). Module-load
// time is too early — pm2/dotenv may inject env after some imports run.
function _candidateKeys(): Buffer[] {
  const out: Buffer[] = [];
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) out.push(Buffer.from(envKey.slice(0, 32), 'utf8'));
  if (envKey) out.push(crypto.createHash('sha256').update(envKey).digest());
  const botToken = process.env.BOT_TOKEN;
  if (botToken) out.push(crypto.createHash('sha256').update(botToken).digest());
  return out;
}

function _primaryKey(): Buffer {
  const cands = _candidateKeys();
  if (cands.length > 0) return cands[0];
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    throw new Error('[SECURITY] ENCRYPTION_KEY missing in production. Set it in .env before starting.');
  }
  console.error('[SECURITY] ENCRYPTION_KEY and BOT_TOKEN both missing — using ephemeral random key. Previously encrypted data WILL be unrecoverable after restart!');
  return crypto.randomBytes(32);
}

/** Encrypt a plaintext API key using AES-256-GCM. Returns prefixed string "enc:...". */
export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(_ENC_ALGO, _primaryKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/** Decrypt a stored API key. Transparently handles legacy plain-text values.
 *  Tries each candidate key (ENCRYPTION_KEY slice/sha256, BOT_TOKEN sha256) so values
 *  encrypted before a key rotation still open. */
export function decryptApiKey(stored: string): string {
  if (!stored.startsWith('enc:')) return stored;
  const parts = stored.slice(4).split(':');
  if (parts.length !== 3) return stored;
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');
    let lastErr: any = null;
    for (const key of _candidateKeys()) {
      try {
        const decipher = crypto.createDecipheriv(_ENC_ALGO, key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
    return stored;
  } catch (e) {
    const ekLen = (process.env.ENCRYPTION_KEY || '').length;
    const btSet = !!process.env.BOT_TOKEN;
    console.warn(`[crypto-utils] decryptApiKey failed (ENC_KEY len=${ekLen}, BOT_TOKEN set=${btSet}, value head=${stored.slice(0, 28)}…):`, (e as Error).message);
    return stored;
  }
}
