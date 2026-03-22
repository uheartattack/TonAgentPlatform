# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in TON Agent Platform, please report it privately:

- **Telegram**: [@despensive](https://t.me/despensive)
- **Do NOT** open a public GitHub issue for security vulnerabilities

We will acknowledge receipt within 24 hours and provide a fix timeline within 72 hours.

## Security Measures

### Agent Execution
- Sandboxed VM with restricted globals (no `fs`, `child_process`, `net`)
- SSRF protection: blocks localhost, private IPs, cloud metadata endpoints
- 30-second max execution time per agent tick
- Memory cap per agent

### API Security
- IDOR ownership verification on every agent endpoint
- CORS strict origin allowlist
- Rate limiting per user
- Telegram OAuth authentication (no passwords)

### AI Security
- Prompt injection defense: input sanitization, XML tag stripping
- Memory poisoning prevention: group chat writes blocked for non-owners
- Loop detection: A-B-A-B patterns, result-aware stall detection
- Atomic financial operation locks with generation counter

### Data Protection
- API keys encrypted at rest
- No plaintext secrets in logs
- Session tokens with TTL expiration

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (main branch) | Yes |
| Older commits | No |
