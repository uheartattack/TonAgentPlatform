/**
 * v3-roles.ts — веса ролей агентов и их интеграция с репутацией/матчингом/фильтрами (v3.0 сеть).
 *
 * Роли берём из crew-system (`agents.role`): manager|director|specialist|worker|monitor|creative|trader|admin
 *   (+ легаси-алиасы researcher→specialist, executor→worker, validator→monitor).
 *
 * Идея: trust-score (0..100 из agent-reputation) — это «насколько агенту можно доверять».
 *   Роль добавляет ДВА множителя: базовый вес роли (ответственность/координация в сети) и
 *   аффинити роли к КАТЕГОРИИ задачи. effectiveScore = trust × roleWeight × (0.5 + 0.5·fit).
 *   Используется в: гейтинге claim (лимит баунти), ранжировании агентов под задачу, фильтрах витрины.
 */
export type AgentRole = 'manager' | 'director' | 'specialist' | 'worker' | 'monitor' | 'creative' | 'trader' | 'admin';

const ROLE_ALIASES: Record<string, string> = { researcher: 'specialist', executor: 'worker', validator: 'monitor' };

export function normalizeRole(r?: string | null): AgentRole {
  const x = (r || 'worker').toString().toLowerCase().trim();
  return (ROLE_ALIASES[x] || x) as AgentRole;
}

// Базовый сетевой вес роли (вклад в координацию/ответственность). 1.0 = нейтрально.
export const ROLE_WEIGHT: Record<string, number> = {
  director: 1.30, manager: 1.20, admin: 1.20, specialist: 1.10,
  trader: 1.10, creative: 1.00, worker: 1.00, monitor: 0.95,
};
export function roleWeight(role?: string | null): number {
  return ROLE_WEIGHT[normalizeRole(role)] ?? 1.0;
}

// Категории задач доски → аффинити роли (0..1, насколько роль подходит категории).
export const JOB_CATEGORIES = ['research', 'content', 'trading', 'monitoring', 'ops', 'coordination', 'data', 'other'];
const CATEGORY_FIT: Record<string, Partial<Record<AgentRole, number>>> = {
  research:     { specialist: 1.0, creative: 0.7, director: 0.7, manager: 0.6, worker: 0.6, monitor: 0.5, trader: 0.4, admin: 0.5 },
  content:      { creative: 1.0, specialist: 0.8, worker: 0.7, manager: 0.6, director: 0.6, monitor: 0.4, trader: 0.4, admin: 0.5 },
  trading:      { trader: 1.0, specialist: 0.7, monitor: 0.7, director: 0.6, manager: 0.6, worker: 0.5, creative: 0.3, admin: 0.5 },
  monitoring:   { monitor: 1.0, specialist: 0.7, worker: 0.7, trader: 0.6, manager: 0.6, director: 0.5, creative: 0.4, admin: 0.5 },
  ops:          { worker: 1.0, specialist: 0.8, monitor: 0.7, manager: 0.7, admin: 0.7, director: 0.6, creative: 0.5, trader: 0.5 },
  coordination: { manager: 1.0, director: 1.0, admin: 0.8, specialist: 0.6, worker: 0.5, monitor: 0.5, creative: 0.5, trader: 0.5 },
  data:         { specialist: 1.0, monitor: 0.8, trader: 0.7, worker: 0.7, creative: 0.5, manager: 0.5, director: 0.5, admin: 0.5 },
};
const DEFAULT_FIT = 0.8;
export function roleFit(role?: string | null, category?: string | null): number {
  const c = (category || 'other').toString().toLowerCase();
  const map = CATEGORY_FIT[c];
  if (!map) return DEFAULT_FIT; // неизвестная/'other' категория — нейтрально
  return map[normalizeRole(role)] ?? 0.5;
}

// Эффективный матч-скор: доверие, модулированное весом роли и аффинити к категории. 0..~130.
export function effectiveScore(trustScore: number, role?: string | null, category?: string | null): number {
  const w = roleWeight(role);
  const fit = roleFit(role, category);
  const s = (trustScore || 0) * w * (0.5 + 0.5 * fit);
  return Math.round(Math.max(0, Math.min(130, s)));
}

// Тиры доверия (порог из agent-reputation: unverified<30 bronze>=30 silver>=55 gold>=75 platinum>=90).
const TIER_ORDER = ['unverified', 'bronze', 'silver', 'gold', 'platinum'];
export function tierAtLeast(tier?: string | null, min?: string | null): boolean {
  if (!min) return true;
  return TIER_ORDER.indexOf((tier || 'unverified')) >= TIER_ORDER.indexOf(min);
}

// Ранжирование агентов под категорию: добавляет fit/weight/effective и сортирует по убыванию.
export function rankForCategory<T extends { role?: string | null; trust?: number }>(
  agents: Array<T & { agentId?: number }>, category?: string | null,
): Array<T & { fit: number; weight: number; effective: number }> {
  return agents
    .map((a) => ({
      ...a,
      fit: roleFit(a.role, category),
      weight: roleWeight(a.role),
      effective: effectiveScore(a.trust ?? 0, a.role, category),
    }))
    .sort((x, y) => y.effective - x.effective);
}
