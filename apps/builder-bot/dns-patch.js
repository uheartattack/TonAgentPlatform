// DNS patch: bypass Radmin VPN poisoning of api.telegram.org
// Radmin VPN resolves api.telegram.org -> 127.94.0.64 (times out).
// Real IP confirmed via nslookup with 1.1.1.1: 149.154.166.110
//
// node-fetch calls dns.lookup with { hints: 0, all: true }, expecting
// the callback to receive an array: (err, [{address, family}])
// Standard two-arg call expects: (err, address, family)
// We handle both forms.
const dns = require('dns');
const _real = dns.lookup.bind(dns);
const OVERRIDES = { 'api.telegram.org': '149.154.166.110' };

dns.lookup = function patchedLookup(hostname, optionsOrCb, maybeCb) {
  if (OVERRIDES[hostname]) {
    const ip = OVERRIDES[hostname];
    // Three-arg form: dns.lookup(host, options, cb)
    if (typeof optionsOrCb === 'object' && optionsOrCb !== null && typeof maybeCb === 'function') {
      const all = optionsOrCb.all === true;
      if (all) {
        // Expects array of { address, family }
        process.nextTick(() => maybeCb(null, [{ address: ip, family: 4 }]));
      } else {
        process.nextTick(() => maybeCb(null, ip, 4));
      }
      return;
    }
    // Two-arg form: dns.lookup(host, cb)
    if (typeof optionsOrCb === 'function') {
      process.nextTick(() => optionsOrCb(null, ip, 4));
      return;
    }
  }
  return _real(hostname, optionsOrCb, maybeCb);
};

console.log('[dns-patch] Loaded: api.telegram.org -> 149.154.166.110');
