// Update agent #97 code from the latest nft-arbitrage-v2 template
const { Pool } = require('pg');
const fs = require('fs');

const templateFile = fs.readFileSync('/app/apps/builder-bot/src/agent-templates.ts', 'utf8');

// Find nft-arbitrage-v2 section
const startMarker = "id: 'nft-arbitrage-v2'";
const startIdx = templateFile.indexOf(startMarker);
if (startIdx === -1) { console.error('Template nft-arbitrage-v2 not found!'); process.exit(1); }

// Find "  code: `\n" after the marker
const codeLabel = "  code: `\n";
const codeLabelIdx = templateFile.indexOf(codeLabel, startIdx);
if (codeLabelIdx === -1) { console.error('code: ` not found!'); process.exit(1); }
const codeStart = codeLabelIdx + codeLabel.length;

// Find closing backtick
const codeEnd = templateFile.indexOf("\n`,\n", codeStart);
if (codeEnd === -1) { console.error('End of code block not found!'); process.exit(1); }

const newCode = templateFile.slice(codeStart, codeEnd);
console.log('✅ Extracted code: ' + newCode.length + ' chars');
console.log('   First line: ' + newCode.split('\n')[0]);

const pool = new Pool({
  host: 'localhost', port: 5432,
  user: 'ton_agent', password: 'changeme',
  database: 'ton_agent_platform'
});

pool.query(
  "UPDATE builder_bot.agents SET code = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name",
  [newCode, 97]
).then(r => {
  if (r.rows.length === 0) console.error('No rows updated! Check agent ID.');
  else console.log('✅ Updated agent #' + r.rows[0].id + ' "' + r.rows[0].name + '"');
  return pool.end();
}).catch(e => { console.error('DB error:', e.message); process.exit(1); });
