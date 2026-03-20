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
  if (userId === OWNER_ID) return true;
  if (requiredRole === 'user') return true;

  // Здесь можно добавить проверку ролей из БД
  return false;
}

// Получение роли пользователя
export function getUserRole(userId: number): UserRole {
  if (userId === OWNER_ID) return 'owner';

  // Здесь можно добавить проверку админов из БД
  return 'user';
}
