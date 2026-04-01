import { Context as TelegrafContext } from 'telegraf';

// Расширенный контекст бота
export interface BotContext extends TelegrafContext {
  // Дополнительные поля контекста
  session?: {
    userId: number;
    currentAgentId?: number;
    awaitingInput?: string;
    lastAction?: string;
  };
}

// Типы пользователей
export type UserRole = 'user' | 'admin' | 'owner';

// Информация о пользователе
export interface UserInfo {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  createdAt: Date;
  lastActivityAt: Date;
}

// Parse OWNER_ID once at module load instead of on every call
const OWNER_ID = parseInt(process.env.OWNER_ID || '0', 10);

// Проверка прав доступа
export function checkPermission(userId: number, requiredRole: UserRole): boolean {
  // Lazy import to avoid circular dependency
  let isAdmin = false;
  try { const { isPlatformAdmin } = require('./payments'); isAdmin = isPlatformAdmin(userId); } catch {}
  if (isAdmin || userId === OWNER_ID) return true;
  if (requiredRole === 'user') return true;
  return false;
}

// Получение роли пользователя
export function getUserRole(userId: number): UserRole {
  try { const { isPlatformAdmin } = require('./payments'); if (isPlatformAdmin(userId)) return 'owner'; } catch {}
  if (userId === OWNER_ID) return 'owner';
  return 'user';
}
