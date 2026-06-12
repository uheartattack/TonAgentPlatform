import * as fs from "fs";
import { deployJetton } from "/app/apps/builder-bot/src/services/jetton-minter";
(async () => {
  const w = JSON.parse(fs.readFileSync("/tmp/jetton-test-wallet.json","utf8"));
  const r = await deployJetton({mnemonic: w.mnemonic.join(" "), metadata: {name:"TAP Test Coin",symbol:"TEST",decimals:9,image:"https://tonagentplatform.com/logo-tap.svg"}, network: "testnet"});
  console.log(JSON.stringify(r, null, 2));
})().catch(e => { console.error("FATAL:", e.message, "\n", e.stack); process.exit(1); });
