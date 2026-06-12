import * as fs from "fs";
import { mintJetton } from "/app/apps/builder-bot/src/services/jetton-minter";
(async () => {
  const w = JSON.parse(fs.readFileSync("/tmp/jetton-test-wallet.json","utf8"));
  const r = await mintJetton({
    mnemonic: w.mnemonic.join(" "),
    jettonMaster: "EQDLYS-FBG2rJDCcu0-Zb1QvPcosNEpnD51As3iaREFatQ7u",
    to: w.address,
    amount: "1000000000000000",  // 1M × 10^9
    network: "testnet",
  });
  console.log(JSON.stringify(r, null, 2));
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
