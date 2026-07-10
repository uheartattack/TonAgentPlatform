const { TonClient, Address } = require('@ton/ton');
const ADDR = process.env.ADDR || 'UQCfRrLVr7MeGbVw4x1XgZ42ZUS7tdf2sEYSyRvmoEB4y_dh';
const a = Address.parse(ADDR);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  console.log('PLATFORM_RAW=' + a.toString());
  for (const [net, ep] of [['mainnet', 'https://toncenter.com/api/v2/jsonRPC'], ['testnet', 'https://testnet.toncenter.com/api/v2/jsonRPC']]) {
    try {
      const c = new TonClient({ endpoint: ep });
      const b = await c.getBalance(a);
      console.log(net + '_GRAM=' + (Number(b) / 1e9).toFixed(4));
    } catch (e) { console.log(net + '_ERR=' + (e && e.message)); }
    await sleep(1300);
  }
})();
