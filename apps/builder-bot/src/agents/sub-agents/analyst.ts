import { getCodeTools } from '../tools/code-tools';
import { getDBTools, type ToolResult } from '../tools/db-tools';
import { getSecurityScanner, type SecurityThreat } from '../tools/security-scanner';
import { getMemoryManager } from '../../db/memory';

// Параметры для анализа
export interface ExplainParams {
  code: string;
  question?: string;
  detailLevel?: 'brief' | 'normal' | 'detailed';
  language?: 'ru' | 'en';
}

// Параметры для поиска багов
export interface DebugParams {
  code: string;
  expectedBehavior?: string;
  errorMessage?: string;
}

// Результат анализа
export interface AnalysisResult {
  type: 'explanation' | 'bug_report' | 'fix' | 'security_audit';
  content: string;
  code?: string;
  threats?: SecurityThreat[];
  suggestions?: string[];
}

// ===== Sub-Agent: Analyst =====
// Отвечает за объяснение кода, поиск багов и рекомендации

export class AnalystAgent {
  // Ленивая инициализация
  private get codeTools() { return getCodeTools(); }
  private get dbTools() { return getDBTools(); }
  private get securityScanner() { return getSecurityScanner(); }

  // Объяснить код
  async explainCode(params: ExplainParams): Promise<ToolResult<AnalysisResult>> {
    try {
      const result = await this.codeTools.explainCode({
        code: params.code,
        question: params.question,
        detailLevel: params.detailLevel || 'normal',
        language: params.language || 'ru',
      });

      if (!result.success) {
        return result as unknown as ToolResult<AnalysisResult>;
      }

      return {
        success: true,
        data: {
          type: 'explanation',
          content: result.data!,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка объяснения: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Объяснить код агента по ID
  async explainAgent(
    agentId: number,
    userId: number,
    question?: string
  ): Promise<ToolResult<AnalysisResult>> {
    // Получаем код агента
    const codeResult = await this.dbTools.getAgentCode(agentId, userId);
    if (!codeResult.success) {
      return codeResult as unknown as ToolResult<AnalysisResult>;
    }

    // Объясняем
    return this.explainCode({
      code: codeResult.data!,
      question,
      detailLevel: 'normal',
      language: 'ru',
    });
  }

  // Найти баги
  async findBugs(params: DebugParams): Promise<ToolResult<AnalysisResult>> {
    try {
      const result = await this.codeTools.findBugs({
        code: params.code,
        expectedBehavior: params.expectedBehavior,
      });

      if (!result.success) {
        return result as unknown as ToolResult<AnalysisResult>;
      }

      const bugs = result.data!;

      // Форматируем отчет
      let content = '';
      if (bugs.length === 0) {
        content = '✅ Очевидных проблем не обнаружено. Код выглядит корректно.';
      } else {
        content = `🔍 Найдено ${bugs.length} проблем:\n\n`;
        bugs.forEach((bug, i) => {
          content += `${i + 1}. **[${bug.severity.toUpperCase()}]** `;
          if (bug.line) content += `(строка ${bug.line}) `;
          content += `${bug.issue}\n`;
          content += `   💡 ${bug.suggestion}\n\n`;
        });
      }

      return {
        success: true,
        data: {
          type: 'bug_report',
          content,
          threats: bugs.map((b) => ({
            type: b.issue,
            severity: b.severity,
            description: b.issue,
            line: b.line,
            code: undefined,
            recommendation: b.suggestion,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка поиска багов: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Предложить исправление
  async suggestFix(params: {
    code: string;
    issue: string;
  }): Promise<ToolResult<AnalysisResult>> {
    try {
      const result = await this.codeTools.suggestFix({
        code: params.code,
        issue: params.issue,
      });

      if (!result.success) {
        return result as unknown as ToolResult<AnalysisResult>;
      }

      const { fixedCode, explanation } = result.data!;

      return {
        success: true,
        data: {
          type: 'fix',
          content: explanation,
          code: fixedCode,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка генерации исправления: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Полный аудит безопасности
  async securityAudit(code: string): Promise<ToolResult<AnalysisResult>> {
    try {
      const result = await this.securityScanner.scanCode(code);
      if (!result.success) {
        return result as unknown as ToolResult<AnalysisResult>;
      }

      const { passed, score, threats, summary } = result.data!;

      let content = `${summary}\n\n`;
      content += `**Оценка безопасности:** ${score}/100\n\n`;

      if (threats.length > 0) {
        content += '**Обнаруженные угрозы:**\n\n';
        threats.forEach((threat, i) => {
          const emoji = threat.severity === 'critical' ? '🔴' :
                       threat.severity === 'high' ? '🟠' :
                       threat.severity === 'medium' ? '🟡' : '⚪';
          content += `${emoji} **${threat.type}** (${threat.severity})\n`;
          if (threat.line) content += `   Строка: ${threat.line}\n`;
          content += `   ${threat.description}\n`;
          content += `   💡 ${threat.recommendation}\n\n`;
        });
      }

      const recommendations = this.securityScanner.getFixRecommendations(threats);
      if (recommendations.length > 0) {
        content += '**Общие рекомендации:**\n';
        recommendations.forEach((rec) => {
          content += `- ${rec}\n`;
        });
      }

      return {
        success: true,
        data: {
          type: 'security_audit',
          content,
          threats,
          suggestions: recommendations,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка аудита: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Аудит агента по ID
  async auditAgent(agentId: number, userId: number): Promise<ToolResult<AnalysisResult>> {
    const codeResult = await this.dbTools.getAgentCode(agentId, userId);
    if (!codeResult.success) {
      return codeResult as unknown as ToolResult<AnalysisResult>;
    }

    return this.securityAudit(codeResult.data!);
  }

  // Сравнить два кода
  async compareCode(
    code1: string,
    code2: string,
    language?: 'ru' | 'en'
  ): Promise<ToolResult<{ comparison: string; similarity: number }>> {
    try {
      // Используем codeTools для анализа
      const analysis1 = await this.codeTools.analyzeCodeIntent({
        code: code1,
        intendedPurpose: 'analyze',
      });

      const analysis2 = await this.codeTools.analyzeCodeIntent({
        code: code2,
        intendedPurpose: 'analyze',
      });

      // Простое сравнение по строкам
      const lines1 = code1.split('\n').filter((l) => l.trim());
      const lines2 = code2.split('\n').filter((l) => l.trim());

      const commonLines = lines1.filter((l) =>
        lines2.some((l2) => l.trim() === l2.trim())
      ).length;

      const similarity = Math.round(
        (commonLines / Math.max(lines1.length, lines2.length)) * 100
      );

      let comparison = '';
      if (similarity > 90) {
        comparison = language === 'en'
          ? 'The codes are almost identical.'
          : 'Коды практически идентичны.';
      } else if (similarity > 70) {
        comparison = language === 'en'
          ? 'The codes are very similar with minor differences.'
          : 'Коды очень похожи с небольшими отличиями.';
      } else if (similarity > 40) {
        comparison = language === 'en'
          ? 'The codes have some common parts but significant differences.'
          : 'Коды имеют общие части, но существенные различия.';
      } else {
        comparison = language === 'en'
          ? 'The codes are quite different.'
          : 'Коды существенно различаются.';
      }

      return {
        success: true,
        data: {
          comparison,
          similarity,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка сравнения: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Получить статистику агентов пользователя
  async getUserStats(userId: number): Promise<ToolResult<{
    total: number;
    active: number;
    inactive: number;
    byTrigger: Record<string, number>;
  }>> {
    return this.dbTools.getAgentStats(userId);
  }

  // Проанализировать историю разговора
  async analyzeConversation(
    userId: number,
    focus?: 'intents' | 'issues' | 'patterns'
  ): Promise<ToolResult<{ analysis: string; insights: string[] }>> {
    try {
      const history = await getMemoryManager().getConversationHistory(userId, 50);

      if (history.length === 0) {
        return {
          success: true,
          data: {
            analysis: 'История разговоров пуста.',
            insights: [],
          },
        };
      }

      // Простой анализ
      const systemMessages = history.filter((h) => h.role === 'system');
      const userMessages = history.filter((h) => h.role === 'user');

      const insights: string[] = [];

      // Подсчитываем действия
      const creations = systemMessages.filter((m) =>
        m.metadata?.type?.includes('created')
      ).length;
      const modifications = systemMessages.filter((m) =>
        m.metadata?.type?.includes('modified')
      ).length;
      const executions = systemMessages.filter((m) =>
        m.metadata?.type?.includes('executed')
      ).length;

      if (creations > 0) insights.push(`Создано агентов: ${creations}`);
      if (modifications > 0) insights.push(`Изменений кода: ${modifications}`);
      if (executions > 0) insights.push(`Запусков агентов: ${executions}`);

      let analysis = `Всего сообщений: ${history.length}\n`;
      analysis += `- Пользователь: ${userMessages.length}\n`;
      analysis += `- Система: ${systemMessages.length}\n\n`;

      if (insights.length > 0) {
        analysis += '**Активность:**\n' + insights.join('\n');
      }

      return {
        success: true,
        data: {
          analysis,
          insights,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка анализа: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Singleton instance
let analystAgent: AnalystAgent | null = null;

export function getAnalystAgent(): AnalystAgent {
  if (!analystAgent) {
    analystAgent = new AnalystAgent();
  }
  return analystAgent;
}