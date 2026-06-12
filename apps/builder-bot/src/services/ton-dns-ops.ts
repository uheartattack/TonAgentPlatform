/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TON DNS Operations — domain auctions, resolver records, .ton management
 *
 * Wraps the TON DNS NFT contract interactions for AI agents:
 *   • bidOnDomain()          → place a bid in an active auction
 *   • startAuction()         → initialize an auction for an unowned domain
 *   • setDnsRecord()         → write resolver record (wallet/site/storage)
 *   • clearDnsRecord()       → wipe a resolver record
 *   • setSite(adnl)          → set TON Site record (ADNL pointer)
 *
 * TON DNS Root contract: EQC3dNlesgVD8YbAazcauIrXBPfiVhMMr5YYk2in0Mtsz0Bz
 *
 * Op-codes (per TON DNS spec):
 *   0x4eb1f0f9 — change_dns_record
 *   0x69fb306c — auction bid (sent as text comment "ton.<name>")
 *
 * Record categories (sha256 → key):
 *   wallet  → 0xe8d44050873dba865aa7c170ab4cce64d90839a34dcfd6cf71d14e0205443b1b
 *   site    → 0xfbae041b021c5560e6d8de70b169fc4f0fb35bf2fa6e3b3a6a31fff1e0fcfd3b
 *   storage → 0x49a25f9fc4d4f4a1f5cdcc1f60d0b27a73f7f31f2a0d7e95a04eaa6a44b1bf67
 *   dns_next_resolver → 0x19f02441ee588fdb26ee24b2568dd035c3c9206e11ab979be62e55558a1d17ff
 *
 * Spec: https://docs.ton.org/develop/dapps/dns
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { TonClient, WalletContractV4 } from '@ton/ton';
import { Address, internal, beginCell, toNano, Cell } from '@ton/core';
import { mnemonicToWalletKey } from '@ton/crypto';

const DNS_ROOT = 'EQC3dNlesgVD8YbAazcauIrXBPfiVhMMr5YYk2in0Mtsz0Bz';

// Op-codes (4-byte big-endian)
const OP_CHANGE_DNS_RECORD = 0x4eb1f0f9;

// Record category hashes (precomputed sha256 of the category name)
const CATEGORY_HASHES: Record<string, bigint> = {
  wallet:            BigInt('0xe8d44050873dba865aa7c170ab4cce64d90839a34dcfd6cf71d14e0205443b1b'),
  site:              BigInt('0xfbae041b021c5560e6d8de70b169fc4f0fb35bf2fa6e3b3a6a31fff1e0fcfd3b'),
  storage:           BigInt('0x49a25f9fc4d4f4a1f5cdcc1f60d0b27a73f7f31f2a0d7e95a04eaa6a44b1bf67'),
  dns_next_resolver: BigInt('0x19f02441ee588fdb26ee24b2568dd035c3c9206e11ab979be62e55558a1d17ff'),
};

function getTonClient(): TonClient {
  return new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_API_KEY || undefined,
  });
}

async function openWallet(mnemonic: string) {
  const keyPair = await mnemonicToWalletKey(mnemonic.split(' '));
  const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
  const tonClient = getTonClient();
  const walletContract = tonClient.open(wallet);
  return { walletContract, keyPair, tonClient };
}

/**
 * Resolves the NFT contract address for a .ton domain.
 * Returns null if domain doesn't exist.
 */
export async function getDomainNftAddress(domain: string): Promise<string | null> {
  const name = domain.replace(/\.ton$/, '').toLowerCase().trim();
  if (!name) return null;
  try {
    const res = await fetch(`https://tonapi.io/v2/dns/${encodeURIComponent(name)}.ton`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data?.item?.address || data?.address || null;
  } catch { return null; }
}

/**
 * Place a bid in the auction for a .ton domain.
 * Auction protocol: send TON to the DNS_ROOT with text comment matching the domain.
 * Minimum bid varies by domain length (4 chars = 100 TON, 5 = 50, 6 = 20, 7+ = 10).
 *
 * Returns { ok, tx_estimated } on success, { ok: false, error } on failure.
 */
export async function bidOnDomain(params: {
  mnemonic: string;
  domain: string;
  amountTon: number;
}): Promise<{ ok: boolean; error?: string; bid_amount_ton?: number; tx_sent?: boolean }> {
  const { mnemonic, domain, amountTon } = params;
  const name = domain.replace(/\.ton$/, '').toLowerCase().trim();
  if (!name) return { ok: false, error: 'Domain name is empty' };
  if (amountTon <= 0) return { ok: false, error: 'Bid amount must be positive' };

  // Recommended minimum check (informational; chain enforces it too)
  const recommendedMin =
    name.length === 4 ? 100 :
    name.length === 5 ? 50  :
    name.length === 6 ? 20  : 10;
  if (amountTon < recommendedMin) {
    return { ok: false, error: `Recommended minimum bid for ${name.length}-char .ton is ${recommendedMin} TON. Got ${amountTon}.` };
  }

  try {
    const { walletContract, keyPair } = await openWallet(mnemonic);
    const seqno = await walletContract.getSeqno();
    // Comment payload: just the domain name (without .ton suffix).
    // TON DNS root parses this and routes to the right auction.
    const body = beginCell()
      .storeUint(0, 32)                          // text comment marker
      .storeStringTail(name)                     // domain name
      .endCell();

    await walletContract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({
        to: Address.parse(DNS_ROOT),
        value: toNano(String(amountTon)),
        bounce: true,                            // ensures refund if bid rejected
        body,
      })],
    });
    return { ok: true, bid_amount_ton: amountTon, tx_sent: true };
  } catch (e: any) {
    return { ok: false, error: e?.message?.slice(0, 200) || 'bid failed' };
  }
}

/**
 * Starts a fresh auction for an unowned .ton domain.
 * Same protocol as bidOnDomain — first bidder triggers auction start automatically.
 */
export async function startAuction(params: {
  mnemonic: string;
  domain: string;
  initialBidTon: number;
}): Promise<{ ok: boolean; error?: string; tx_sent?: boolean }> {
  return bidOnDomain({
    mnemonic: params.mnemonic,
    domain: params.domain,
    amountTon: params.initialBidTon,
  });
}

/**
 * Sets a DNS record on a .ton domain.
 * Categories: 'wallet' (owner address), 'site' (ADNL pubkey), 'storage' (bag-id),
 * 'dns_next_resolver' (delegate resolution to another contract).
 *
 * For 'wallet': value is a TON address (EQ/UQ/raw).
 * For 'site': value is a 64-hex-char ADNL public key.
 * For 'storage': value is a 64-hex-char bag-id.
 * For 'dns_next_resolver': value is a TON address.
 */
export async function setDnsRecord(params: {
  mnemonic: string;
  domain: string;
  category: 'wallet' | 'site' | 'storage' | 'dns_next_resolver';
  value: string;
}): Promise<{ ok: boolean; error?: string; tx_sent?: boolean }> {
  const { mnemonic, domain, category, value } = params;
  const catHash = CATEGORY_HASHES[category];
  if (!catHash) return { ok: false, error: `Unknown category "${category}"` };

  const nftAddr = await getDomainNftAddress(domain);
  if (!nftAddr) return { ok: false, error: `Domain ${domain} not found` };

  try {
    // Build the record value cell based on category
    let valueCell: Cell;
    if (category === 'wallet') {
      // 0x9fd3 prefix + address slice
      valueCell = beginCell()
        .storeUint(0x9fd3, 16)
        .storeAddress(Address.parse(value))
        .storeUint(0, 8) // capability flags
        .endCell();
    } else if (category === 'dns_next_resolver') {
      valueCell = beginCell()
        .storeUint(0xba93, 16)
        .storeAddress(Address.parse(value))
        .endCell();
    } else if (category === 'site') {
      // ADNL: 0xad01 + 256-bit pubkey + 8-bit flags
      const adnlHex = value.replace(/^0x/, '');
      if (!/^[0-9a-fA-F]{64}$/.test(adnlHex)) {
        return { ok: false, error: 'ADNL must be 64 hex chars' };
      }
      valueCell = beginCell()
        .storeUint(0xad01, 16)
        .storeBuffer(Buffer.from(adnlHex, 'hex'))
        .storeUint(0, 8)
        .endCell();
    } else if (category === 'storage') {
      // Storage bag-id: 0x7473 + bag hash
      const bagHex = value.replace(/^0x/, '');
      if (!/^[0-9a-fA-F]{64}$/.test(bagHex)) {
        return { ok: false, error: 'Bag-id must be 64 hex chars' };
      }
      valueCell = beginCell()
        .storeUint(0x7473, 16)
        .storeBuffer(Buffer.from(bagHex, 'hex'))
        .endCell();
    } else {
      return { ok: false, error: `Category "${category}" not implemented` };
    }

    // change_dns_record message body
    const body = beginCell()
      .storeUint(OP_CHANGE_DNS_RECORD, 32)
      .storeUint(Date.now() & 0xffffffff, 64)   // query_id
      .storeUint(catHash, 256)
      .storeRef(valueCell)
      .endCell();

    const { walletContract, keyPair } = await openWallet(mnemonic);
    const seqno = await walletContract.getSeqno();
    await walletContract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({
        to: Address.parse(nftAddr),
        value: toNano('0.05'),                  // ~0.05 TON for gas + storage
        bounce: true,
        body,
      })],
    });
    return { ok: true, tx_sent: true };
  } catch (e: any) {
    return { ok: false, error: e?.message?.slice(0, 200) || 'setDnsRecord failed' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tools added to surpass Teleton's 8 — bringing TAP's TON DNS suite to 11.
// ═══════════════════════════════════════════════════════════════════════════

const OP_NFT_TRANSFER = 0x5fcc3d14;

/**
 * List all .ton domains currently owned by a wallet.
 * Queries TonAPI for NFTs whose collection is the DNS root.
 *
 * Returns: { ok, domains: [{ domain, nft_address, expires_at? }] }
 */
export async function listMyDomains(params: { wallet: string }): Promise<{
  ok: boolean; count?: number; domains?: Array<{ domain: string; nft_address: string; expires_at?: number }>; error?: string;
}> {
  try {
    const url = `https://tonapi.io/v2/accounts/${encodeURIComponent(params.wallet)}/nfts?collection=${DNS_ROOT}&limit=100`;
    const r = await fetch(url);
    if (!r.ok) return { ok: false, error: `TonAPI ${r.status}` };
    const data = await r.json() as any;
    const items = (data.nft_items || []) as any[];
    const domains = items
      .map(it => {
        const dnsName = it?.dns || it?.metadata?.name || '';
        const name = String(dnsName).replace(/\.ton$/, '').trim();
        if (!name) return null;
        // expires_at appears in some TonAPI responses under metadata.attributes
        const expAttr = (it?.metadata?.attributes || []).find((a: any) => /expir|until/i.test(a?.trait_type || ''));
        const expSeconds = expAttr ? Number(expAttr.value) || undefined : undefined;
        return { domain: `${name}.ton`, nft_address: it.address, expires_at: expSeconds };
      })
      .filter(Boolean) as Array<{ domain: string; nft_address: string; expires_at?: number }>;
    return { ok: true, count: domains.length, domains };
  } catch (e: any) {
    return { ok: false, error: e?.message?.slice(0, 200) || 'listMyDomains failed' };
  }
}

/**
 * Get auction state for a single .ton domain via its NFT contract's
 * `get_auction_info` get-method (callable read-only).
 *
 * Returns: { ok, active, max_bid_address?, max_bid_ton?, auction_end_unix? }.
 */
export async function getAuctionInfo(params: { domain: string }): Promise<{
  ok: boolean; active?: boolean; max_bid_address?: string; max_bid_ton?: number;
  auction_end_unix?: number; min_next_bid_ton?: number; error?: string;
}> {
  const nftAddr = await getDomainNftAddress(params.domain);
  if (!nftAddr) return { ok: false, error: `Domain ${params.domain} not found` };
  try {
    // Use TonAPI's /v2/blockchain/accounts/:addr/methods/get_auction_info — cheap, no API key needed
    const r = await fetch(`https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(nftAddr)}/methods/get_auction_info`);
    if (!r.ok) {
      // No auction running on this domain (get-method missing or returned exit code != 0)
      return { ok: true, active: false };
    }
    const data = await r.json() as any;
    if (data?.exit_code !== 0 && data?.success !== true) return { ok: true, active: false };
    const stack = data.stack || [];
    // Stack order per TON DNS NFT spec: max_bid_address, max_bid_amount, max_bid_at, auction_end_time
    const parseSlice = (s: any) => s?.cell || s?.slice || null;
    const parseNum  = (s: any) => Number(s?.num ?? s?.number ?? 0);
    const maxBidAddrCell = parseSlice(stack[0]);
    const maxBidAmount  = parseNum(stack[1]);
    const auctionEnd    = parseNum(stack[3]);
    const tonAmount = maxBidAmount > 0 ? maxBidAmount / 1e9 : 0;
    // Min next bid is current + 5% per TON DNS auction rules
    const minNextBid = tonAmount > 0 ? Math.ceil(tonAmount * 1.05 * 100) / 100 : undefined;
    return {
      ok: true,
      active: auctionEnd * 1000 > Date.now(),
      max_bid_ton: tonAmount > 0 ? tonAmount : undefined,
      auction_end_unix: auctionEnd || undefined,
      min_next_bid_ton: minNextBid,
      // Address rendering left to caller — cell parse is non-trivial without @ton/core round-trip
      max_bid_address: maxBidAddrCell ? String(maxBidAddrCell).slice(0, 80) : undefined,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message?.slice(0, 200) || 'getAuctionInfo failed' };
  }
}

/**
 * Transfer a .ton domain to a new owner address. Sends an NFT-transfer
 * op (0x5fcc3d14) to the domain's NFT contract. Irreversible — make sure
 * the caller has confirmed.
 *
 * Returns: { ok, tx_sent } on success.
 */
export async function transferDomain(params: {
  mnemonic: string;
  domain: string;
  new_owner: string;       // raw or EQ-form TON address
  forward_amount_ton?: number;  // optional notification amount
}): Promise<{ ok: boolean; tx_sent?: boolean; error?: string }> {
  const nftAddr = await getDomainNftAddress(params.domain);
  if (!nftAddr) return { ok: false, error: `Domain ${params.domain} not found` };
  let newOwner: Address;
  try { newOwner = Address.parse(params.new_owner); }
  catch { return { ok: false, error: `Invalid new_owner address` }; }
  try {
    const fwd = toNano(String(Math.max(0.001, Math.min(0.1, params.forward_amount_ton ?? 0.001))));
    const body = beginCell()
      .storeUint(OP_NFT_TRANSFER, 32)
      .storeUint(Date.now() & 0xffffffff, 64)   // query_id
      .storeAddress(newOwner)                   // new_owner
      .storeAddress(newOwner)                   // response_destination (refund)
      .storeBit(0)                              // no custom_payload
      .storeCoins(fwd)                          // forward_amount
      .storeBit(0)                              // no forward_payload (inline)
      .endCell();

    const { walletContract, keyPair } = await openWallet(params.mnemonic);
    const seqno = await walletContract.getSeqno();
    await walletContract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({
        to: Address.parse(nftAddr),
        value: toNano('0.1'),     // gas budget — TON DNS transfer typically uses ~0.07
        bounce: true,
        body,
      })],
    });
    return { ok: true, tx_sent: true };
  } catch (e: any) {
    return { ok: false, error: e?.message?.slice(0, 200) || 'transferDomain failed' };
  }
}

/**
 * Clears a DNS record (sets it to empty).
 * Sends the same change_dns_record op but with a null ref.
 */
export async function clearDnsRecord(params: {
  mnemonic: string;
  domain: string;
  category: 'wallet' | 'site' | 'storage' | 'dns_next_resolver';
}): Promise<{ ok: boolean; error?: string; tx_sent?: boolean }> {
  const { mnemonic, domain, category } = params;
  const catHash = CATEGORY_HASHES[category];
  if (!catHash) return { ok: false, error: `Unknown category "${category}"` };

  const nftAddr = await getDomainNftAddress(domain);
  if (!nftAddr) return { ok: false, error: `Domain ${domain} not found` };

  try {
    // change_dns_record with no value ref = clear
    const body = beginCell()
      .storeUint(OP_CHANGE_DNS_RECORD, 32)
      .storeUint(Date.now() & 0xffffffff, 64)
      .storeUint(catHash, 256)
      .endCell();

    const { walletContract, keyPair } = await openWallet(mnemonic);
    const seqno = await walletContract.getSeqno();
    await walletContract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({
        to: Address.parse(nftAddr),
        value: toNano('0.05'),
        bounce: true,
        body,
      })],
    });
    return { ok: true, tx_sent: true };
  } catch (e: any) {
    return { ok: false, error: e?.message?.slice(0, 200) || 'clearDnsRecord failed' };
  }
}
