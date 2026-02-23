import { getCodeTools } from '../tools/code-tools';
import { getDBTools, type ToolResult } from '../tools/db-tools';
import { getSecurityScanner } from '../tools/security-scanner';
import { getMemoryManager } from '../../db/memory';

// Параметры для создания агента
export interface CreateAgentParams {
  userId: number;
  description: string;
  knownParams?: Record<string, any>;
  name?: string; // опционально, можно сгенерировать
  triggerType?: 'manual' | 'scheduled' | 'webhook' | 'event';
  triggerConfig?: Record<string, any>;
}

// Результат создания
export interface CreateAgentResult {
  success: boolean;
  agentId?: number;
  name: string;
  code: string;
  explanation: string;
  placeholders?: Array<{ name: string; description: string; example?: string }>;
  securityPassed: boolean;
  securityScore: number;
  message: string;
  needsClarification?: boolean;
  clarificationQuestion?: string;
  triggerType?: string;
  triggerConfig?: Record<string, any>;
  autoStart?: boolean; // true — агент определён как scheduled и нужно сразу запустить
}

// ===== Авто-определение триггера из описания =====
// Если пользователь пишет "каждую минуту", "каждый час" и т.д. — auto-trigger = scheduled

export function detectTriggerFromDescription(description: string): {
  triggerType: 'manual' | 'scheduled';
  triggerConfig: Record<string, any>;
} {
  const d = description.toLowerCase();

  const patterns: Array<{ re: RegExp; ms: number }> = [
    // секунды
    { re: /каждые?\s+(\d+)\s+секунд/,            ms: 0 },
    { re: /каждую\s+секунду/,                     ms: 1_000 },
    // минуты
    { re: /каждую\s+минуту|раз\s+в\s+минуту|every\s+minute/, ms: 60_000 },
    { re: /каждые?\s+(\d+)\s+минут/,             ms: 0 },
    { re: /every\s+(\d+)\s+minute/,              ms: 0 },
    // часы
    { re: /каждый\s+час|раз\s+в\s+час|every\s+hour/, ms: 3_600_000 },
    { re: /каждые?\s+(\d+)\s+час/,               ms: 0 },
    { re: /every\s+(\d+)\s+hour/,                ms: 0 },
    // день
    { re: /каждый\s+день|ежедневно|раз\s+в\s+день|every\s+day/, ms: 86_400_000 },
    // 30 минут
    { re: /каждые?\s+30\s*мин|every\s+30\s*min/, ms: 30 * 60_000 },
    // 5 минут
    { re: /каждые?\s+5\s*мин|every\s+5\s*min/,  ms: 5 * 60_000 },
    // 10 минут
    { re: /каждые?\s+10\s*мин|every\s+10\s*min/, ms: 10 * 60_000 },
  ];

  for (const { re, ms } of patterns) {
    const m = d.match(re);
    if (m) {
      let intervalMs = ms;
      if (ms === 0 && m[1]) intervalMs = parseInt(m[1]) * (re.source.includes('секунд') ? 1_000 : re.source.includes('час') ? 3_600_000 : 60_000);
      if (intervalMs > 0) {
        return {
          triggerType: 'scheduled',
          triggerConfig: { intervalMs },
        };
      }
    }
  }

  // Ключевые слова без числа
  if (/мониторинг|слежу|отслеживай|следи|периодически|автоматически|monitor|watch|track|alert/.test(d)) {
    // По умолчанию — каждые 5 минут для мониторинга
    return { triggerType: 'scheduled', triggerConfig: { intervalMs: 5 * 60_000 } };
  }

  return { triggerType: 'manual', triggerConfig: {} };
}

// ===== Sub-Agent: Creator =====
// Отвечает за создание новых агентов

export class CreatorAgent {
  // Ленивая инициализация (чтобы избежать ошибок при импорте)
  private get codeTools() { return getCodeTools(); }
  private get dbTools() { return getDBTools(); }
  private get securityScanner() { return getSecurityScanner(); }

  // Главный метод создания агента
  async createAgent(params: CreateAgentParams): Promise<ToolResult<CreateAgentResult>> {
    try {
      // Шаг 1: Анализируем описание на полноту
      const analysis = await this.analyzeDescription(params.description, params.knownParams);

      if (analysis.needsMoreInfo) {
        return {
          success: true,
          data: {
            success: false,
            name: '',
            code: '',
            explanation: '',
            securityPassed: false,
            securityScore: 0,
            message: 'Нужно уточнение',
            needsClarification: true,
            clarificationQuestion: analysis.question,
          },
        };
      }

      // Шаг 2: Генерируем имя если не указано
      const agentName = params.name || this.generateAgentName(params.description);

      // Шаг 3: Генерируем код (без жёстких шаблонов — AI сам решает как достичь цели)
      const generationResult = await this.codeTools.generateAgentCode({
        description: params.description,
        knownParams: { ...params.knownParams, ...analysis.extractedParams },
        language: 'javascript',
      });

      if (!generationResult.success) {
        return {
          success: false,
          error: generationResult.error,
        };
      }

      const { code, explanation, placeholders } = generationResult.data!;

      // Шаг 4: Сканируем безопасность
      const securityResult = await this.securityScanner.scanCode(code);
      if (!securityResult.success) {
        return {
          success: false,
          error: securityResult.error,
        };
      }

      const { passed: securityPassed, score: securityScore } = securityResult.data!;

      // Если критические угрозы - не сохраняем
      if (!securityPassed) {
        return {
          success: true,
          data: {
            success: false,
            name: agentName,
            code,
            explanation,
            placeholders,
            securityPassed: false,
            securityScore,
            message: 'Код не прошел проверку безопасности. Требуется исправление.',
          },
        };
      }

      // Шаг 5: Авто-определяем trigger если не задан явно
      let finalTriggerType = params.triggerType;
      let finalTriggerConfig = params.triggerConfig || {};

      if (!finalTriggerType) {
        const detected = detectTriggerFromDescription(params.description);
        finalTriggerType = detected.triggerType;
        if (detected.triggerType === 'scheduled' && !finalTriggerConfig.intervalMs) {
          finalTriggerConfig = { ...finalTriggerConfig, ...detected.triggerConfig };
        }
      }

      // Шаг 6: Сохраняем в БД
      const dbResult = await this.dbTools.createAgent({
        userId: params.userId,
        name: agentName,
        description: params.description,
        code,
        triggerType: finalTriggerType || 'manual',
        triggerConfig: finalTriggerConfig,
        isActive: false,
      });

      if (!dbResult.success) {
        return {
          success: false,
          error: dbResult.error,
        };
      }

      const agent = dbResult.data!;

      // Шаг 7: Логируем в память
      await getMemoryManager().addMessage(
        params.userId,
        'system',
        `Агент "${agentName}" создан (ID: ${agent.id})`,
        {
          type: 'agent_created_complete',
          agentId: agent.id,
          hasPlaceholders: !!placeholders && placeholders.length > 0,
        }
      );

      return {
        success: true,
        data: {
          success: true,
          agentId: agent.id,
          name: agentName,
          code,
          explanation,
          placeholders,
          securityPassed: true,
          securityScore,
          message: `Агент "${agentName}" успешно создан!`,
          triggerType: finalTriggerType || 'manual',
          triggerConfig: finalTriggerConfig,
          autoStart: (finalTriggerType === 'scheduled'),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка создания агента: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Задать уточняющий вопрос
  async askClarifications(
    userId: number,
    question: string,
    context?: Record<string, any>
  ): Promise<ToolResult<void>> {
    try {
      await getMemoryManager().setWaitingForInput(userId, 'clarification', {
        question,
        ...context,
      });

      return {
        success: true,
        message: question,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Сохранить агента (после уточнений)
  async saveAgent(params: {
    userId: number;
    name: string;
    description: string;
    code: string;
    triggerType?: 'manual' | 'scheduled' | 'webhook' | 'event';
    triggerConfig?: Record<string, any>;
  }): Promise<ToolResult<CreateAgentResult>> {
    // Повторно сканируем безопасность
    const securityResult = await this.securityScanner.scanCode(params.code);
    const securityPassed = securityResult.success && securityResult.data!.passed;
    const securityScore = securityResult.success ? securityResult.data!.score : 0;

    const dbResult = await this.dbTools.createAgent({
      userId: params.userId,
      name: params.name,
      description: params.description,
      code: params.code,
      triggerType: params.triggerType || 'manual',
      triggerConfig: params.triggerConfig || {},
      isActive: false,
    });

    if (!dbResult.success) {
      return {
        success: false,
        error: dbResult.error,
      };
    }

    const agent = dbResult.data!;

    return {
      success: true,
      data: {
        success: true,
        agentId: agent.id,
        name: params.name,
        code: params.code,
        explanation: 'Агент сохранен после уточнений',
        securityPassed: securityPassed || false,
        securityScore,
        message: `Агент "${params.name}" сохранен!`,
      },
    };
  }

  // ===== Вспомогательные методы =====

  private async analyzeDescription(
    description: string,
    knownParams?: Record<string, any>
  ): Promise<{
    needsMoreInfo: boolean;
    question?: string;
    extractedParams?: Record<string, any>;
  }> {
    // Минимальная проверка — спрашиваем только если задача совсем неясна
    // AI сам подставит плейсхолдеры для параметров которых не хватает

    const desc = description.trim();

    // Слишком короткое описание — просим конкретизировать
    if (desc.length < 8) {
      return {
        needsMoreInfo: true,
        question: 'Опишите подробнее, что должен делать агент? Например: "проверяй баланс кошелька EQ... каждый час и сообщай если меньше 5 TON"',
      };
    }

    // Всё остальное — передаём прямо в генератор, пусть AI разберётся
    // Незнакомые параметры AI сам оформит как {{PLACEHOLDER}}
    return { needsMoreInfo: false };
  }

  private generateAgentName(description: string): string {
    const suffix = Date.now().toString(36).slice(-4);

    // Приоритет: ключевые слова из кириллицы (описания на русском)
    // JS \w не захватывает кириллицу → русские слова нужно искать напрямую
    const cyrillicWords = description
      .split(/\s+/)
      .filter(w => /[а-яёА-ЯЁ]{3,}/.test(w))
      .filter(w => !['для', 'или', 'при', 'это', 'как', 'что', 'где', 'все', 'его'].includes(w.toLowerCase()))
      .slice(0, 2);

    if (cyrillicWords.length > 0) {
      // Транслитерация первых двух слов → латиница для имени
      const translit: Record<string, string> = {
        а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
        к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
        х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
      };
      const translitWord = (w: string) =>
        w.toLowerCase().split('').map(c => translit[c] ?? c).join('').replace(/[^a-z0-9]/g, '').slice(0, 10);
      const key = cyrillicWords.map(translitWord).filter(Boolean).join('_') || 'agent';
      return `${key}_agent_${suffix}`;
    }

    // Fallback: латинские ключевые слова (без TON-адресов и стоп-слов)
    const stopWords = new Set(['this','that','with','from','create','make','build','have','will','every','agent']);
    const keywords = description
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w =>
        w.length > 3 &&
        w.length < 18 &&                              // wallet addresses are 48+ chars
        !stopWords.has(w) &&
        !/^(eq|uq|uf)[a-z0-9_-]{10,}/i.test(w) &&  // TON wallet address pattern
        !/^[a-f0-9]{10,}$/.test(w)                   // hex strings / hashes
      )
      .slice(0, 2);

    if (keywords.length > 0) {
      return `${keywords.join('_')}_agent_${suffix}`;
    }

    return `agent_${suffix}`;
  }
}

// Singleton instance
let creatorAgent: CreatorAgent | null = null;

export function getCreatorAgent(): CreatorAgent {
  if (!creatorAgent) {
    creatorAgent = new CreatorAgent();
  }
  return creatorAgent;
}