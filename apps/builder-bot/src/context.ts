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

// Проверка прав доступа
export function checkPermission(userId: number, requiredRole: UserRole): boolean {
  const ownerId = parseInt(process.env.OWNER_ID || '130806013');

  if (userId === ownerId) return true;
  if (requiredRole === 'user') return true;

  // Здесь можно добавить проверку ролей из БД
  return false;
}

// Получение роли пользователя
export function getUserRole(userId: number): UserRole {
  const ownerId = parseInt(process.env.OWNER_ID || '130806013');

  if (userId === ownerId) return 'owner';

  // Здесь можно добавить проверку админов из БД
  return 'user';
}
