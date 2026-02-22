import { getCodeTools } from '../tools/code-tools';
import { getDBTools, type ToolResult } from '../tools/db-tools';
import { getSecurityScanner } from '../tools/security-scanner';
import { getMemoryManager } from '../../db/memory';

// Параметры для редактирования
export interface EditAgentParams {
  userId: number;
  agentId: number;
  modificationRequest: string;
  preserveLogic?: boolean;
}

// Параметры для обновления триггера
export interface UpdateTriggerParams {
  userId: number;
  agentId: number;
  triggerType: 'manual' | 'scheduled' | 'webhook' | 'event';
  triggerConfig: Record<string, any>;
}

// Результат редактирования
export interface EditAgentResult {
  success: boolean;
  agentId: number;
  changes: string;
  oldCode: string;
  newCode: string;
  securityPassed: boolean;
  securityScore: number;
  message: string;
}

// ===== Sub-Agent: Editor =====
// Отвечает за редактирование кода агентов

export class EditorAgent {
  // Ленивая инициализация
  private get codeTools() { return getCodeTools(); }
  private get dbTools() { return getDBTools(); }
  private get securityScanner() { return getSecurityScanner(); }

  // Получить код агента
  async getCode(agentId: number, userId: number): Promise<ToolResult<{ code: string; name: string }>> {
    const result = await this.dbTools.getAgent(agentId, userId);
    if (!result.success) {
      return result as unknown as ToolResult<{ code: string; name: string }>;
    }

    return {
      success: true,
      data: {
        code: result.data!.code,
        name: result.data!.name,
      },
    };
  }

  // Редактировать код агента
  async modifyCode(params: EditAgentParams): Promise<ToolResult<EditAgentResult>> {
    try {
      // Шаг 1: Получаем текущий код
      const agentResult = await this.dbTools.getAgent(params.agentId, params.userId);
      if (!agentResult.success) {
        return agentResult as unknown as ToolResult<EditAgentResult>;
      }

      const agent = agentResult.data!;
      const oldCode = agent.code;

      // Шаг 2: Модифицируем код
      const modificationResult = await this.codeTools.modifyCode({
        currentCode: oldCode,
        modificationRequest: params.modificationRequest,
        preserveLogic: params.preserveLogic !== false,
      });

      if (!modificationResult.success) {
        return {
          success: false,
          error: modificationResult.error,
        };
      }

      const { code: newCode, changes } = modificationResult.data!;

      // Шаг 3: Сканируем безопасность
      const securityResult = await this.securityScanner.scanCode(newCode);
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
            agentId: params.agentId,
            changes,
            oldCode,
            newCode,
            securityPassed: false,
            securityScore,
            message: 'Измененный код не прошел проверку безопасности.',
          },
        };
      }

      // Шаг 4: Сохраняем в БД
      const updateResult = await this.dbTools.updateAgentCode(
        params.agentId,
        params.userId,
        newCode
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error,
        };
      }

      // Шаг 5: Логируем в память
      await getMemoryManager().addMessage(
        params.userId,
        'system',
        `Код агента "${agent.name}" изменен`,
        {
          type: 'agent_code_modified',
          agentId: params.agentId,
          changes,
        }
      );

      return {
        success: true,
        data: {
          success: true,
          agentId: params.agentId,
          changes,
          oldCode,
          newCode,
          securityPassed: true,
          securityScore,
          message: `Код агента "${agent.name}" успешно обновлен!`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка редактирования: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Обновить триггер агента
  async updateTrigger(params: UpdateTriggerParams): Promise<ToolResult<EditAgentResult>> {
    try {
      // Получаем агента
      const agentResult = await this.dbTools.getAgent(params.agentId, params.userId);
      if (!agentResult.success) {
        return agentResult as unknown as ToolResult<EditAgentResult>;
      }

      const agent = agentResult.data!;

      // Обновляем триггер
      const updateResult = await this.dbTools.updateAgentTrigger(
        params.agentId,
        params.userId,
        params.triggerType,
        params.triggerConfig
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error,
        };
      }

      // Логируем
      await getMemoryManager().addMessage(
        params.userId,
        'system',
        `Триггер агента "${agent.name}" изменен на ${params.triggerType}`,
        {
          type: 'agent_trigger_updated',
          agentId: params.agentId,
          triggerType: params.triggerType,
        }
      );

      return {
        success: true,
        data: {
          success: true,
          agentId: params.agentId,
          changes: `Триггер изменен на: ${params.triggerType}`,
          oldCode: agent.code,
          newCode: agent.code,
          securityPassed: true,
          securityScore: 100,
          message: `Триггер агента "${agent.name}" обновлен!`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка обновления триггера: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Переименовать агента
  async renameAgent(
    agentId: number,
    userId: number,
    newName: string
  ): Promise<ToolResult<{ oldName: string; newName: string }>> {
    const result = await this.dbTools.updateAgent(agentId, userId, { name: newName });
    if (!result.success) {
      return result as unknown as ToolResult<{ oldName: string; newName: string }>;
    }

    return {
      success: true,
      data: {
        oldName: result.data!.name,
        newName: newName,
      },
      message: `Агент переименован в "${newName}"`,
    };
  }

  // Обновить описание агента
  async updateDescription(
    agentId: number,
    userId: number,
    newDescription: string
  ): Promise<ToolResult<void>> {
    return this.dbTools.updateAgent(agentId, userId, { description: newDescription }) as unknown as Promise<ToolResult<void>>;
  }

  // Сравнить две версии кода
  async compareVersions(
    code1: string,
    code2: string
  ): Promise<ToolResult<{ differences: string[]; similarity: number }>> {
    try {
      const lines1 = code1.split('\n');
      const lines2 = code2.split('\n');

      const differences: string[] = [];
      const maxLines = Math.max(lines1.length, lines2.length);

      for (let i = 0; i < maxLines; i++) {
        const line1 = lines1[i]?.trim() || '';
        const line2 = lines2[i]?.trim() || '';

        if (line1 !== line2) {
          differences.push(`Строка ${i + 1}:\n- ${line1}\n+ ${line2}`);
        }
      }

      // Простая метрика схожести
      const commonLines = lines1.filter((l) => lines2.includes(l)).length;
      const similarity = Math.round((commonLines / maxLines) * 100);

      return {
        success: true,
        data: {
          differences: differences.slice(0, 10), // Первые 10 отличий
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

  // Откат изменений (если есть история)
  async rollbackChanges(
    agentId: number,
    userId: number
  ): Promise<ToolResult<{ message: string }>> {
    // В текущей реализации откат не поддерживается
    // Можно добавить таблицу versions для хранения истории
    return {
      success: false,
      error: 'Откат изменений не поддерживается в текущей версии',
    };
  }
}

// Singleton instance
let editorAgent: EditorAgent | null = null;

export function getEditorAgent(): EditorAgent {
  if (!editorAgent) {
    editorAgent = new EditorAgent();
  }
  return editorAgent;
}