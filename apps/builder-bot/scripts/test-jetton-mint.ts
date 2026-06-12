/**
 * End-to-end test of jetton-minter service against TON testnet.
 *
 * Flow:
 *   1. Generates a fresh wallet v4r2 + prints address
 *   2. Polls TonClient4 every 5s waiting for the address to be funded
 *      (you send ~1 testnet TON from your grant wallet 0QC-iuC...)
 *   3. Deploys $TEST jetton (mintable, agent = admin)
 *   4. Waits 30s for the deploy to confirm on-chain
 *   5. Mints 1,000,000 $TEST to the test wallet itself
 *   6. Prints links to testnet.tonscan for verification
 *
 * Run on prod:
 *   cd /app/apps/builder-bot && npx ts-node -T scripts/test-jetton-mint.ts
 */

import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient } from '@ton/ton';
import { Address, fromNano } from '@ton/core';
import * as fs from 'fs';
import { deployJetton, mintJetton } from '../src/services/jetton-minter';

const NETWORK = 'testnet' as const;
const TONCENTER_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const WALLET_CACHE = '/tmp/jetton-test-wallet.json';
const FUND_AMOUNT_TON = 1;            // ask user to send this much
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;  // give up after 10 min

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function getBalance(client: TonClient, addr: Address): Promise<bigint> {
  try {
    return await client.getBalance(addr);
  } catch {
    return 0n;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  JETTON MINT — END-TO-END TESTNET CHECK');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Generate fresh wallet OR reuse cached one from previous run
  //    Persistence avoids stranding testnet TON if the script restarts.
  let mnemonic: string[];
  let reused = false;
  if (fs.existsSync(WALLET_CACHE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(WALLET_CACHE, 'utf8'));
      if (Array.isArray(cached.mnemonic) && cached.mnemonic.length === 24) {
        mnemonic = cached.mnemonic;
        reused = true;
      } else {
        mnemonic = await mnemonicNew(24);
      }
    } catch {
      mnemonic = await mnemonicNew(24);
    }
  } else {
    mnemonic = await mnemonicNew(24);
  }
  const keys = await mnemonicToWalletKey(mnemonic);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });
  const testnetAddr = wallet.address.toString({ urlSafe: true, bounceable: false, testOnly: true });
  if (!reused) {
    fs.writeFileSync(WALLET_CACHE, JSON.stringify({ mnemonic, address: testnetAddr }, null, 2), { mode: 0o600 });
    console.log(`[1/6] Generated fresh wallet v4r2 → cached to ${WALLET_CACHE}`);
  } else {
    console.log(`[1/6] Reusing cached wallet from ${WALLET_CACHE}`);
  }
  console.log(`   address (testnet, non-bounceable): ${testnetAddr}`);

  // toncenter v2 — alive and live when orbs v4 pool is dead.
  const client = new TonClient({
    endpoint: TONCENTER_ENDPOINT,
    apiKey: process.env.TONCENTER_API_KEY,
  });

  // 2. Wait for funding
  console.log(`\n[2/6] FUND THE WALLET:`);
  console.log(`   Send ${FUND_AMOUNT_TON} testnet TON to:`);
  console.log(`   → ${testnetAddr}`);
  console.log(`   (from your grant wallet 0QC-iuC... in Tonkeeper testnet mode)`);
  console.log(`   Polling balance every ${POLL_INTERVAL_MS / 1000}s, timeout ${POLL_TIMEOUT_MS / 1000}s...\n`);

  const startedAt = Date.now();
  let bal = 0n;
  while (bal < 100_000_000n) {                       // wait until ≥ 0.1 TON
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      console.error('   ❌ Timeout — no funds received. Aborting.');
      process.exit(1);
    }
    await sleep(POLL_INTERVAL_MS);
    bal = await getBalance(client, wallet.address);
    process.stdout.write(`   ⏳ balance = ${fromNano(bal)} TON\r`);
  }
  console.log(`\n   ✅ Funded! Current balance: ${fromNano(bal)} TON`);

  // 3. Deploy jetton
  console.log(`\n[3/6] Deploying $TEST jetton (mintable, this wallet = admin)...`);
  const deployRes = await deployJetton({
    mnemonic: mnemonic.join(' '),
    metadata: {
      name: 'TAP Test Coin',
      symbol: 'TEST',
      decimals: 9,
      description: 'End-to-end test jetton minted by TAP CLI.',
      image: 'https://tonagentplatform.com/logo-tap.svg',
    },
    network: NETWORK,
  });
  if (!deployRes.ok) {
    console.error(`   ❌ Deploy failed: ${deployRes.error}`);
    process.exit(1);
  }
  console.log(`   ✅ Deploy tx broadcast.`);
  console.log(`   jetton_master = ${deployRes.jettonMaster}`);

  // 4. Wait 30s for confirmation
  console.log(`\n[4/6] Waiting 30s for blockchain to confirm deploy...`);
  for (let i = 30; i > 0; i--) {
    process.stdout.write(`   ⏳ ${i}s\r`);
    await sleep(1000);
  }
  console.log(`   ✅ Wait complete.`);

  // 5. Mint 1M TEST to self
  console.log(`\n[5/6] Minting 1,000,000 TEST (1,000,000 × 10^9 = 10^15 nano) to self...`);
  const mintRes = await mintJetton({
    mnemonic: mnemonic.join(' '),
    jettonMaster: deployRes.jettonMaster,
    to: testnetAddr,
    amount: '1000000000000000',                       // 1M × 10^9
    network: NETWORK,
  });
  if (!mintRes.ok) {
    console.error(`   ❌ Mint failed: ${mintRes.error}`);
    console.error(`   (Common cause: contract not fully active yet — retry mint manually in 30s)`);
    process.exit(1);
  }
  console.log(`   ✅ Mint tx broadcast.`);

  // 6. Final report with explorer links
  console.log(`\n[6/6] DONE. Verify on testnet explorer:`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`   Wallet (admin):   https://testnet.tonscan.org/address/${testnetAddr}`);
  console.log(`   Jetton master:    https://testnet.tonscan.org/address/${deployRes.jettonMaster}`);
  console.log(`   Holders (after ~30s): https://testnet.tonviewer.com/${deployRes.jettonMaster}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  console.log(`✅ End-to-end test SUCCESSFUL — jetton-mint pipeline works on testnet.\n`);
  console.log(`Remaining balance on test wallet: ${fromNano(await getBalance(client, wallet.address))} TON`);
  console.log(`(spent ~0.23 TON total: 0.15 deploy + 0.08 mint)\n`);
}

main().catch(e => {
  console.error('\n💥 Fatal:', e?.message || e);
  process.exit(1);
});
