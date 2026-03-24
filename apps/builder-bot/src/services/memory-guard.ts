/**
 * memory-guard.ts — Prompt injection & exfiltration scanner for memory writes.
 * Scans content before writing to persistent memory to prevent attacks.
 */

export interface ScanResult {
  safe: boolean;
  threats: string[];
}

const THREAT_PATTERNS: Array<[RegExp, string]> = [
  // Prompt injection / role hijack
  [/\bsystem\s*:\s*/i, 'role hijack (system:)'],
  [/\bassistant\s*:\s*/i, 'role hijack (assistant:)'],
  [/\b(ignore|disregard|forget)\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|prompts?)/i, 'prompt injection (ignore instructions)'],
  [/\byou\s+are\s+now\b.*\b(assistant|ai|bot|agent|model)\b/i, 'role reassignment'],
  [/\bact\s+as\s+(a\s+)?(different|new|my)\b/i, 'role reassignment (act as)'],
  [/\bnew\s+instructions?\s+(for|to|:)\b/i, 'instruction injection'],
  [/\boverride\b.*\b(system|safety|rules?|instructions?)\b/i, 'rule override attempt'],
  // Exfiltration
  [/\bcurl\b.*\bhttp/i, 'exfiltration (curl)'],
  [/\bwget\b.*\bhttp/i, 'exfiltration (wget)'],
  [/\bfetch\s*\(/i, 'exfiltration (fetch)'],
  [/\bsendto\b.*\b(url|http|endpoint)/i, 'exfiltration (sendto)'],
  // Destructive / persistence
  [/\bssh\b.*\b(key|authorized_keys|backdoor)/i, 'ssh backdoor'],
  [/\brm\s+-rf\b/i, 'destructive command (rm -rf)'],
  [/\b(api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*\S+/i, 'credential in memory'],
];

export function scanMemoryContent(content: string): ScanResult {
  const threats: string[] = [];
  for (const [pattern, label] of THREAT_PATTERNS) {
    if (pattern.test(content)) threats.push(label);
  }
  return { safe: threats.length === 0, threats };
}
