import { ToolResult } from './db-tools';

// Типы угроз
export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityThreat {
  type: string;
  severity: ThreatSeverity;
  description: string;
  line?: number;
  code?: string;
  recommendation: string;
}

export interface ScanResult {
  passed: boolean;
  threats: SecurityThreat[];
  score: number; // 0-100
  summary: string;
}

// ===== Базовый сканер безопасности =====

export class SecurityScanner {
  // Паттерны угроз
  private readonly threatPatterns: Array<{
    type: string;
    severity: ThreatSeverity;
    pattern: RegExp;
    description: string;
    recommendation: string;
  }> = [
    // ── КРИТИЧЕСКИЕ угрозы (блокируют выполнение) ──────────────
    {
      type: 'eval_execution',
      severity: 'critical',
      pattern: /\beval\s*\(/i,
      description: 'eval() — выполнение произвольного кода',
      recommendation: 'Используйте JSON.parse() или другие безопасные методы',
    },
    {
      type: 'function_constructor',
      severity: 'critical',
      pattern: /new\s+Function\s*\(/i,
      description: 'new Function() — динамическое создание кода',
      recommendation: 'Избегайте динамического создания функций',
    },
    {
      type: 'exec_script',
      severity: 'critical',
      pattern: /\bexecScript\s*\(/i,
      description: 'execScript() — выполнение кода в глобальном контексте',
      recommendation: 'Удалите execScript',
    },
    {
      type: 'crypto_mining',
      severity: 'critical',
      pattern: /\b(CryptoNight|CoinHive|coinhive|stratum\+tcp|cryptonight|minero|xmrig)\b/i,
      description: 'Паттерн майнинга криптовалюты',
      recommendation: 'Майнинг в агентах запрещён',
    },
    {
      type: 'ddos_pattern',
      severity: 'critical',
      pattern: /(?:while\s*\(true\)|for\s*\(;;\))\s*\{[^}]*fetch\s*\(/i,
      description: 'Бесконечный цикл с HTTP-запросами — возможная DDoS атака',
      recommendation: 'Добавьте задержку и условие выхода',
    },
    {
      type: 'data_exfiltration',
      severity: 'critical',
      // Обращение к известным дата-сборщикам или отправка больших объёмов данных
      pattern: /fetch\s*\(\s*['"`][^'"`]*(?:requestbin|webhook\.site|pipedream|beeceptor|mockbin)/i,
      description: 'Возможная утечка данных на публичный сборщик',
      recommendation: 'Проверьте назначение этого URL',
    },
    {
      type: 'drain_pattern_approve',
      severity: 'critical',
      pattern: /approve\s*\(\s*(?:0x|[^,]*max|[^,]*unlimited)/i,
      description: 'Approve на неограниченную сумму — риск drain-атаки',
      recommendation: 'Используйте точные суммы для approve',
    },

    // ── ВЫСОКИЕ угрозы ──────────────────────────────────────────
    {
      type: 'hardcoded_private_key',
      severity: 'high',
      // Приватные ключи TON/ETH (длинные hex/base64 строки рядом с "key"/"secret"/"mnemonic")
      pattern: /(?:private[_\s]?key|secret[_\s]?key|mnemonic)\s*[:=]\s*['"`][a-zA-Z0-9+/=]{20,}/i,
      description: 'Возможно захардкоженный приватный ключ или мнемоника',
      recommendation: 'Используйте context.config для передачи секретов',
    },
    {
      type: 'bot_token_hardcoded',
      severity: 'high',
      pattern: /(?:bot[_\s]?token|telegram[_\s]?token)\s*[:=]\s*['"`]\d{8,}:[A-Za-z0-9_-]{35,}/i,
      description: 'Захардкоженный Telegram Bot токен',
      recommendation: 'Передавайте токен через context.config.BOT_TOKEN',
    },
    {
      type: 'settimeout_string',
      severity: 'high',
      pattern: /setTimeout\s*\(\s*['"`]/i,
      description: 'setTimeout со строкой — выполнение строки как кода',
      recommendation: 'Используйте функцию вместо строки',
    },
    {
      type: 'setinterval_string',
      severity: 'high',
      pattern: /setInterval\s*\(\s*['"`]/i,
      description: 'setInterval со строкой — выполнение строки как кода',
      recommendation: 'Используйте функцию вместо строки',
    },
    {
      type: 'drain_loop_transfer',
      severity: 'high',
      pattern: /for\s*\([^)]*\)\s*\{[^}]*(?:send|transfer)\s*\(/i,
      description: 'Цикл с переводом средств — риск drain-атаки',
      recommendation: 'Проверьте логику переводов в цикле',
    },

    // ── СРЕДНИЕ угрозы ──────────────────────────────────────────
    {
      type: 'debugger_statement',
      severity: 'medium',
      pattern: /\bdebugger\s*;?/i,
      description: 'Оператор debugger в коде',
      recommendation: 'Удалите debugger',
    },
    {
      type: 'infinite_loop_risk',
      severity: 'medium',
      // while(true) без await — заблокирует поток
      pattern: /while\s*\(\s*(true|1)\s*\)\s*\{(?![^}]*await)/i,
      description: 'Бесконечный цикл без await — заблокирует выполнение',
      recommendation: 'Добавьте await или условие выхода',
    },
    // console.log НЕ является угрозой для агентов — это основной способ показать результат пользователю
  ];

  // Запрещенные модули Node.js (недоступны в vm2 sandbox)
  private readonly forbiddenModules = [
    'child_process',
    'fs',
    'net',
    'dgram',
    'cluster',
    'module',
    'os',
    'path',
    'vm',
    'repl',
    'readline',
    'tty',
    'worker_threads',
  ];

  // Сканировать код
  async scanCode(code: string): Promise<ToolResult<ScanResult>> {
    const threats: SecurityThreat[] = [];
    const lines = code.split('\n');

    // Проверяем каждый паттерн
    for (const threatPattern of this.threatPatterns) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (threatPattern.pattern.test(line)) {
          threats.push({
            type: threatPattern.type,
            severity: threatPattern.severity,
            description: threatPattern.description,
            line: i + 1,
            code: line.trim().substring(0, 100),
            recommendation: threatPattern.recommendation,
          });
        }
      }
    }

    // Проверяем импорты
    const importThreats = this.checkImports(code, lines);
    threats.push(...importThreats);

    // Проверяем drain-атаки специфичные для блокчейна
    const drainThreats = this.checkDrainAttacks(code, lines);
    threats.push(...drainThreats);

    // Вычисляем score
    const score = this.calculateScore(threats);

    // Определяем passed (критические — стоп; высокие допустимы только если не более 1)
    const criticalCount = threats.filter((t) => t.severity === 'critical').length;
    const highCount = threats.filter((t) => t.severity === 'high').length;
    const passed = criticalCount === 0 && highCount <= 1;

    // Генерируем summary
    const summary = this.generateSummary(threats, passed);

    return {
      success: true,
      data: {
        passed,
        threats,
        score,
        summary,
      },
    };
  }

  // Быстрая проверка (только критические)
  async quickScan(code: string): Promise<ToolResult<{ safe: boolean; issues: string[] }>> {
    const result = await this.scanCode(code);
    if (!result.success) return result as unknown as ToolResult<{ safe: boolean; issues: string[] }>;

    const critical = result.data!.threats.filter((t) => t.severity === 'critical');
    const high = result.data!.threats.filter((t) => t.severity === 'high');

    const issues = [...critical, ...high].map((t) =>
      `[${t.severity.toUpperCase()}] Line ${t.line}: ${t.description}`
    );

    return {
      success: true,
      data: {
        safe: critical.length === 0 && high.length <= 1,
        issues,
      },
    };
  }

  // Проверка импортов
  private checkImports(code: string, lines: string[]): SecurityThreat[] {
    const threats: SecurityThreat[] = [];
    const importPattern = /(?:import|require)\s*\(?\s*['"`]([^'"`]+)['"`]/g;

    let match;
    while ((match = importPattern.exec(code)) !== null) {
      const moduleName = match[1];

      for (const forbidden of this.forbiddenModules) {
        if (moduleName === forbidden || moduleName.startsWith(`${ forbidden}/`)) {
          // Находим номер строки
          const lineIndex = code.substring(0, match.index).split('\n').length - 1;

          threats.push({
            type: 'forbidden_import',
            severity: 'critical',
            description: `Запрещенный модуль: ${moduleName}`,
            line: lineIndex + 1,
            code: lines[lineIndex]?.trim(),
            recommendation: 'Удалите этот импорт - модуль не разрешен в sandbox',
          });
        }
      }
    }

    return threats;
  }

  // Проверка drain-атак
  private checkDrainAttacks(code: string, lines: string[]): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    // Паттерны drain-атак
    const drainPatterns = [
      {
        pattern: /for\s*\([^)]*\)\s*\{[^}]*\.(send|transfer|call)/i,
        type: 'drain_loop',
        description: 'Цикл с переводом средств - потенциальная drain-атака',
        severity: 'critical' as ThreatSeverity,
      },
      {
        pattern: /while\s*\([^)]*\)\s*\{[^}]*\.(send|transfer|call)/i,
        type: 'drain_while',
        description: 'While цикл с переводом средств - потенциальная drain-атака',
        severity: 'critical' as ThreatSeverity,
      },
      {
        pattern: /\.call\s*\{[^}]*value:[^}]*\}/i,
        type: 'unchecked_call_value',
        description: 'Вызов с value без проверки - потенциальная уязвимость',
        severity: 'high' as ThreatSeverity,
      },
    ];

    for (const drainPattern of drainPatterns) {
      for (let i = 0; i < lines.length; i++) {
        if (drainPattern.pattern.test(lines[i])) {
          threats.push({
            type: drainPattern.type,
            severity: drainPattern.severity,
            description: drainPattern.description,
            line: i + 1,
            code: lines[i].trim().substring(0, 100),
            recommendation: 'Проверьте логику циклов и переводов',
          });
        }
      }
    }

    return threats;
  }

  // Вычисление score
  private calculateScore(threats: SecurityThreat[]): number {
    const weights = {
      critical: 30,
      high: 15,
      medium: 5,
      low: 1,
    };

    const totalDeduction = threats.reduce((sum, t) => sum + weights[t.severity], 0);
    return Math.max(0, 100 - totalDeduction);
  }

  // Генерация summary
  private generateSummary(threats: SecurityThreat[], passed: boolean): string {
    if (threats.length === 0) {
      return '✅ Код прошел проверку безопасности. Угроз не обнаружено.';
    }

    const counts = {
      critical: threats.filter((t) => t.severity === 'critical').length,
      high: threats.filter((t) => t.severity === 'high').length,
      medium: threats.filter((t) => t.severity === 'medium').length,
      low: threats.filter((t) => t.severity === 'low').length,
    };

    const parts: string[] = [];
    if (counts.critical > 0) parts.push(`${counts.critical} критических`);
    if (counts.high > 0) parts.push(`${counts.high} высоких`);
    if (counts.medium > 0) parts.push(`${counts.medium} средних`);
    if (counts.low > 0) parts.push(`${counts.low} низких`);

    if (passed) {
      return `⚠️ Обнаружено ${parts.join(', ')} угроз. Код может быть выполнен с осторожностью.`;
    } else {
      return `🚫 Обнаружено ${parts.join(', ')} угроз. Код НЕ БЕЗОПАСЕН для выполнения!`;
    }
  }

  // Получить рекомендации по исправлению
  getFixRecommendations(threats: SecurityThreat[]): string[] {
    const uniqueRecommendations = [...new Set(threats.map((t) => t.recommendation))];
    return uniqueRecommendations;
  }
}

// Singleton instance
let securityScanner: SecurityScanner | null = null;

export function getSecurityScanner(): SecurityScanner {
  if (!securityScanner) {
    securityScanner = new SecurityScanner();
  }
  return securityScanner;
}