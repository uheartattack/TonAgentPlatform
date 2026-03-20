import { Pool } from 'pg';

let _pool: Pool | null = null;

// Types
interface PluginListing {
  id: number;
  pluginId: number;
  creatorId: number;
  name: string;
  description: string;
  category: string; // 'data-feed', 'dex-connector', 'notification', 'analytics', 'social', 'utility'
  version: string;
  priceStars: number; // 0 = free
  priceTon: number; // 0 = free
  isActive: boolean;
  installs: number;
  avgRating: number;
  totalRatings: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PluginInstall {
  id: number;
  listingId: number;
  userId: number;
  installedAt: Date;
  expiresAt: Date | null; // null = permanent
  status: 'active' | 'expired' | 'refunded';
}

interface PluginRevenue {
  creatorId: number;
  totalEarned: number; // in stars
  totalInstalls: number;
  pendingPayout: number;
  lastPayout: Date | null;
}

const PLATFORM_FEE_PCT = 15; // 15% platform, 85% creator
const CATEGORIES = ['data-feed', 'dex-connector', 'notification', 'analytics', 'social', 'utility', 'telegram', 'defi', 'nft'];

export function initPluginMarketplace(pool: Pool) {
  _pool = pool;

  pool.query(`
    CREATE TABLE IF NOT EXISTS builder_bot.plugin_listings (
      id SERIAL PRIMARY KEY,
      plugin_id INTEGER,
      creator_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'utility',
      version TEXT DEFAULT '1.0.0',
      price_stars INTEGER DEFAULT 0,
      price_ton REAL DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      installs INTEGER DEFAULT 0,
      avg_rating REAL DEFAULT 0,
      total_ratings INTEGER DEFAULT 0,
      code TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS builder_bot.plugin_installs (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES builder_bot.plugin_listings(id),
      user_id INTEGER NOT NULL,
      installed_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      status TEXT DEFAULT 'active',
      UNIQUE(listing_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS builder_bot.plugin_ratings (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES builder_bot.plugin_listings(id),
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(listing_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS builder_bot.plugin_revenue (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      creator_id INTEGER NOT NULL,
      amount_stars INTEGER NOT NULL,
      creator_share INTEGER NOT NULL,
      platform_share INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_plugin_listings_category ON builder_bot.plugin_listings(category);
    CREATE INDEX IF NOT EXISTS idx_plugin_listings_creator ON builder_bot.plugin_listings(creator_id);
    CREATE INDEX IF NOT EXISTS idx_plugin_installs_user ON builder_bot.plugin_installs(user_id);
    CREATE INDEX IF NOT EXISTS idx_plugin_revenue_creator ON builder_bot.plugin_revenue(creator_id);
  `).catch(e => console.warn('[PluginMkt] Migration error:', e.message));
}

// ============================================================
// PUBLISH
// ============================================================

export async function publishPlugin(creatorId: number, opts: {
  name: string;
  description: string;
  category: string;
  code: string;
  priceStars?: number;
  priceTon?: number;
  version?: string;
}): Promise<{ ok: boolean; listingId?: number; error?: string }> {
  if (!_pool) return { ok: false, error: 'DB not ready' };

  if (!opts.name || opts.name.length < 2) return { ok: false, error: 'Name too short (min 2 chars)' };
  if (!opts.code || opts.code.length < 10) return { ok: false, error: 'Code too short' };
  if (!CATEGORIES.includes(opts.category)) return { ok: false, error: `Invalid category. Valid: ${CATEGORIES.join(', ')}` };

  try {
    const res = await _pool.query(
      `INSERT INTO builder_bot.plugin_listings (creator_id, name, description, category, code, price_stars, price_ton, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [creatorId, opts.name, opts.description || '', opts.category, opts.code, opts.priceStars || 0, opts.priceTon || 0, opts.version || '1.0.0']
    );
    return { ok: true, listingId: res.rows[0].id };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ============================================================
// SEARCH & BROWSE
// ============================================================

export async function searchPlugins(query?: string, category?: string, limit: number = 20): Promise<PluginListing[]> {
  if (!_pool) return [];

  let sql = 'SELECT * FROM builder_bot.plugin_listings WHERE is_active = true';
  const params: any[] = [];
  let idx = 1;

  if (category && CATEGORIES.includes(category)) {
    sql += ` AND category = $${idx++}`;
    params.push(category);
  }

  if (query) {
    sql += ` AND (name ILIKE $${idx} OR description ILIKE $${idx})`;
    params.push(`%${query}%`);
    idx++;
  }

  sql += ' ORDER BY installs DESC, avg_rating DESC LIMIT $' + idx;
  params.push(limit);

  const res = await _pool.query(sql, params);
  return res.rows.map(mapListing);
}

export async function getPluginListing(listingId: number): Promise<PluginListing | null> {
  if (!_pool) return null;
  const res = await _pool.query('SELECT * FROM builder_bot.plugin_listings WHERE id=$1', [listingId]);
  return res.rows[0] ? mapListing(res.rows[0]) : null;
}

export async function getCreatorListings(creatorId: number): Promise<PluginListing[]> {
  if (!_pool) return [];
  const res = await _pool.query('SELECT * FROM builder_bot.plugin_listings WHERE creator_id=$1 ORDER BY created_at DESC', [creatorId]);
  return res.rows.map(mapListing);
}

// ============================================================
// INSTALL (with payment)
// ============================================================

export async function installPlugin(userId: number, listingId: number): Promise<{ ok: boolean; error?: string }> {
  if (!_pool) return { ok: false, error: 'DB not ready' };

  const listing = await getPluginListing(listingId);
  if (!listing) return { ok: false, error: 'Plugin not found' };
  if (!listing.isActive) return { ok: false, error: 'Plugin is not available' };

  // Check if already installed
  const existing = await _pool.query(
    "SELECT * FROM builder_bot.plugin_installs WHERE listing_id=$1 AND user_id=$2 AND status='active'",
    [listingId, userId]
  );
  if (existing.rows.length) return { ok: false, error: 'Already installed' };

  // If paid, process payment
  if (listing.priceStars > 0) {
    // Check user balance
    const profileRes = await _pool.query('SELECT balance FROM builder_bot.profiles WHERE user_id=$1', [userId]);
    const balance = parseFloat(profileRes.rows[0]?.balance) || 0;

    // Convert stars to TON equivalent (simplified: 1 star ~ 0.01 TON)
    const costTon = listing.priceStars * 0.01;
    if (balance < costTon) return { ok: false, error: `Insufficient balance. Need ${costTon} TON, have ${balance} TON` };

    // Transactional payment
    const client = await _pool.connect();
    try {
      await client.query('BEGIN');

      // Deduct from buyer
      await client.query(
        'UPDATE builder_bot.profiles SET balance = balance - $1 WHERE user_id = $2',
        [costTon, userId]
      );

      // Revenue split
      const creatorShare = Math.floor(listing.priceStars * (100 - PLATFORM_FEE_PCT) / 100);
      const platformShare = listing.priceStars - creatorShare;

      // Credit creator
      const creatorTon = creatorShare * 0.01;
      await client.query(
        'UPDATE builder_bot.profiles SET balance = balance + $1 WHERE user_id = $2',
        [creatorTon, listing.creatorId]
      );

      // Record revenue
      await client.query(
        'INSERT INTO builder_bot.plugin_revenue (listing_id, buyer_id, creator_id, amount_stars, creator_share, platform_share) VALUES ($1,$2,$3,$4,$5,$6)',
        [listingId, userId, listing.creatorId, listing.priceStars, creatorShare, platformShare]
      );

      // Install
      await client.query(
        'INSERT INTO builder_bot.plugin_installs (listing_id, user_id, status) VALUES ($1,$2,$3) ON CONFLICT (listing_id, user_id) DO UPDATE SET status=$3, installed_at=NOW()',
        [listingId, userId, 'active']
      );

      // Increment install count
      await client.query('UPDATE builder_bot.plugin_listings SET installs = installs + 1 WHERE id=$1', [listingId]);

      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Payment failed: ' + e.message };
    } finally {
      client.release();
    }
  } else {
    // Free plugin — just install
    const installRes = await _pool.query(
      'INSERT INTO builder_bot.plugin_installs (listing_id, user_id, status) VALUES ($1,$2,$3) ON CONFLICT (listing_id, user_id) DO UPDATE SET status=$3, installed_at=NOW() RETURNING (xmax = 0) AS is_insert',
      [listingId, userId, 'active']
    );
    // Only increment install count for genuinely new installs, not re-activations
    if (installRes.rows[0]?.is_insert) {
      await _pool.query('UPDATE builder_bot.plugin_listings SET installs = installs + 1 WHERE id=$1', [listingId]);
    }
  }

  return { ok: true };
}

// ============================================================
// UNINSTALL
// ============================================================

export async function uninstallPlugin(userId: number, listingId: number): Promise<boolean> {
  if (!_pool) return false;
  const res = await _pool.query(
    "UPDATE builder_bot.plugin_installs SET status='expired' WHERE listing_id=$1 AND user_id=$2 AND status='active'",
    [listingId, userId]
  );
  return (res.rowCount || 0) > 0;
}

// ============================================================
// RATINGS
// ============================================================

export async function ratePlugin(userId: number, listingId: number, rating: number, comment: string = ''): Promise<boolean> {
  if (!_pool) return false;
  rating = Math.max(1, Math.min(5, Math.round(rating)));

  // Must be installed to rate
  const installed = await _pool.query(
    "SELECT 1 FROM builder_bot.plugin_installs WHERE listing_id=$1 AND user_id=$2",
    [listingId, userId]
  );
  if (!installed.rows.length) return false;

  await _pool.query(
    `INSERT INTO builder_bot.plugin_ratings (listing_id, user_id, rating, comment)
     VALUES ($1,$2,$3,$4) ON CONFLICT (listing_id, user_id) DO UPDATE SET rating=$3, comment=$4, created_at=NOW()`,
    [listingId, userId, rating, comment]
  );

  // Recalculate average
  const avgRes = await _pool.query(
    'SELECT AVG(rating) as avg, COUNT(*) as cnt FROM builder_bot.plugin_ratings WHERE listing_id=$1',
    [listingId]
  );
  await _pool.query(
    'UPDATE builder_bot.plugin_listings SET avg_rating=$1, total_ratings=$2 WHERE id=$3',
    [parseFloat(avgRes.rows[0].avg) || 0, parseInt(avgRes.rows[0].cnt) || 0, listingId]
  );

  return true;
}

// ============================================================
// CREATOR REVENUE
// ============================================================

export async function getCreatorRevenue(creatorId: number): Promise<PluginRevenue> {
  if (!_pool) return { creatorId, totalEarned: 0, totalInstalls: 0, pendingPayout: 0, lastPayout: null };

  const revRes = await _pool.query(
    'SELECT COALESCE(SUM(creator_share), 0) as total FROM builder_bot.plugin_revenue WHERE creator_id=$1',
    [creatorId]
  );

  const installsRes = await _pool.query(
    'SELECT COALESCE(SUM(installs), 0) as total FROM builder_bot.plugin_listings WHERE creator_id=$1',
    [creatorId]
  );

  return {
    creatorId,
    totalEarned: parseInt(revRes.rows[0].total) || 0,
    totalInstalls: parseInt(installsRes.rows[0].total) || 0,
    pendingPayout: parseInt(revRes.rows[0].total) || 0, // simplified: all earned = pending
    lastPayout: null
  };
}

// ============================================================
// USER'S INSTALLED PLUGINS
// ============================================================

export async function getUserPlugins(userId: number): Promise<PluginListing[]> {
  if (!_pool) return [];
  const res = await _pool.query(
    `SELECT l.* FROM builder_bot.plugin_listings l
     JOIN builder_bot.plugin_installs i ON i.listing_id = l.id
     WHERE i.user_id = $1 AND i.status = 'active'
     ORDER BY i.installed_at DESC`,
    [userId]
  );
  return res.rows.map(mapListing);
}

// ============================================================
// HELPERS
// ============================================================

function mapListing(r: any): PluginListing {
  return {
    id: r.id,
    pluginId: r.plugin_id,
    creatorId: r.creator_id,
    name: r.name,
    description: r.description,
    category: r.category,
    version: r.version,
    priceStars: r.price_stars,
    priceTon: r.price_ton,
    isActive: r.is_active,
    installs: r.installs,
    avgRating: parseFloat(r.avg_rating) || 0,
    totalRatings: r.total_ratings,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export { PluginListing, PluginInstall, PluginRevenue, CATEGORIES };
