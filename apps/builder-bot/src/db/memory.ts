import { drizzle } from 'drizzle-orm/node-postgres';
import { pgSchema, serial, bigint, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { eq, and, desc } from 'drizzle-orm';
import { Pool } from 'pg';

// Используем отдельную схему builder_bot (не конфликтует с platform)
const builderSchema = pgSchema('builder_bot');

// Таблица истории разговоров
export const conversations = builderSchema.table('conversations', {
  id: serial('id').primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Таблица сессий
export const sessions = builderSchema.table('sessions', {
  id: serial('id').primaryKey(),
  userId: bigint('user_id', { mode: 'number' }).notNull().unique(),
  sessionId: text('session_id').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'waiting_input' | 'expired'
  context: jsonb('context'),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// Класс для работы с памятью
export class MemoryManager {
  private db: ReturnType<typeof drizzle>;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 минут таймаут

  constructor(pool: Pool) {
    this.db = drizzle(pool);
  }

  // Получить или создать сессию
  async getOrCreateSession(userId: number): Promise<Session> {
    const existing = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const session = existing[0];
      const lastActivity = new Date(session.lastActivityAt).getTime();
      const now = Date.now();

      // Если сессия истекла - создаем новую
      if (now - lastActivity > this.SESSION_TIMEOUT_MS) {
        await this.db.delete(sessions).where(eq(sessions.userId, userId));
        return this.createSession(userId);
      }

      // Обновляем время активности
      await this.db
        .update(sessions)
        .set({ lastActivityAt: new Date() })
        .where(eq(sessions.userId, userId));

      return session;
    }

    return this.createSession(userId);
  }

  // Создать новую сессию
  private async createSession(userId: number): Promise<Session> {
    const sessionId = `sess_${userId}_${Date.now()}`;
    const [session] = await this.db
      .insert(sessions)
      .values({
        userId,
        sessionId,
        status: 'active',
        context: {},
      })
      .returning();
    return session;
  }

  // Установить статус ожидания ввода
  async setWaitingForInput(
    userId: number,
    waitingFor: string,
    extraContext: Record<string, any> = {}
  ): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        status: 'waiting_input',
        context: {
          waitingFor,
          ...extraContext,
        },
        lastActivityAt: new Date(),
      })
      .where(eq(sessions.userId, userId));
  }

  // Сбросить ожидание
  async clearWaiting(userId: number): Promise<void> {
    await this.db
      .update(sessions)
      .set({
        status: 'active',
        context: {},
        lastActivityAt: new Date(),
      })
      .where(eq(sessions.userId, userId));
  }

  // Проверить, ждем ли ввод
  async getWaitingContext(userId: number): Promise<{ waitingFor: string; context: any } | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        eq(sessions.status, 'waiting_input')
      ))
      .limit(1);

    if (!session) return null;

    return {
      waitingFor: (session.context as any)?.waitingFor as string,
      context: session.context || {},
    };
  }

  // Добавить сообщение в историю
  async addMessage(
    userId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const session = await this.getOrCreateSession(userId);

    await this.db.insert(conversations).values({
      userId,
      sessionId: session.sessionId,
      role,
      content,
      metadata: metadata || {},
    });
  }

  // Получить историю разговора
  async getConversationHistory(
    userId: number,
    limit: number = 20
  ): Promise<Array<{ role: string; content: string; metadata?: any }>> {
    const session = await this.getOrCreateSession(userId);

    const history = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.sessionId, session.sessionId))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);

    return history
      .reverse()
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata,
      }));
  }

  // Получить историю для LLM (формат messages)
  async getLLMHistory(
    userId: number,
    limit: number = 10
  ): Promise<Array<{ role: string; content: string }>> {
    const history = await this.getConversationHistory(userId, limit);
    return history.map((h) => ({
      role: h.role,
      content: h.content,
    }));
  }

  // Очистить историю пользователя
  async clearHistory(userId: number): Promise<void> {
    const session = await this.getOrCreateSession(userId);
    await this.db.delete(conversations).where(eq(conversations.sessionId, session.sessionId));
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  // Получить контекст сессии
  async getSessionContext(userId: number): Promise<Record<string, any>> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .limit(1);

    return session?.context || {};
  }

  // Обновить контекст сессии
  async updateSessionContext(
    userId: number,
    contextUpdate: Record<string, any>
  ): Promise<void> {
    const current = await this.getSessionContext(userId);
    await this.db
      .update(sessions)
      .set({
        context: { ...current, ...contextUpdate },
        lastActivityAt: new Date(),
      })
      .where(eq(sessions.userId, userId));
  }
}

// Singleton instance
let memoryManager: MemoryManager | null = null;

export function initMemoryManager(pool: Pool): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager(pool);
  }
  return memoryManager;
}

export function getMemoryManager(): MemoryManager {
  if (!memoryManager) {
    throw new Error('MemoryManager not initialized. Call initMemoryManager first.');
  }
  return memoryManager;
}
