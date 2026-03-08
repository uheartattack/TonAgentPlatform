/**
 * staging-manager.ts — управление staging-средой для ИИ-самоулучшений
 *
 * Структура директорий:
 *   staging/
 *     backups/{proposalId}/   — резервные копии до изменения
 *     current/                — текущие staged файлы (для Level 2)
 */
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PatchEntry {
  file: string;   // относительный путь от process.cwd(), например "src/bot.ts"
  oldStr: string;
  newStr: string;
}

export class StagingManager {
  readonly rootDir: string;
  readonly stagingDir: string;
  readonly backupsDir: string;
  readonly currentDir: string;

  constructor() {
    this.rootDir    = process.cwd();
    this.stagingDir = path.join(this.rootDir, 'staging');
    this.backupsDir = path.join(this.stagingDir, 'backups');
    this.currentDir = path.join(this.stagingDir, 'current');
    this.ensureDirs();
  }

  private ensureDirs(): void {
    [this.stagingDir, this.backupsDir, this.currentDir].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  /** Создаёт резервную копию файлов до применения патча */
  async backupFiles(proposalId: string, files: string[]): Promise<void> {
    const backupDir = path.join(this.backupsDir, proposalId);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    for (const file of files) {
      const srcPath = path.join(this.rootDir, file);
      if (!fs.existsSync(srcPath)) continue;

      const destPath = path.join(backupDir, file.replace(/\//g, '__'));
      fs.copyFileSync(srcPath, destPath);
    }
  }

  /** Применяет патч (oldStr→newStr) к реальному файлу */
  async applyPatchToFile(patch: PatchEntry): Promise<{ ok: boolean; error?: string }> {
    const fullPath = path.join(this.rootDir, patch.file);

    if (!fs.existsSync(fullPath)) {
      return { ok: false, error: `File not found: ${patch.file}` };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(patch.oldStr)) {
      return { ok: false, error: `oldStr not found in ${patch.file}` };
    }

    // Защита: запрещаем патчить критические файлы на уровнях 1-2
    const PROTECTED_FILES = ['security-scanner.ts', 'payments.ts', '.env'];
    if (PROTECTED_FILES.some(p => patch.file.includes(p))) {
      return { ok: false, error: `Protected file: ${patch.file} — requires Level 3 proposal` };
    }

    const updated = content.replace(patch.oldStr, patch.newStr);
    fs.writeFileSync(fullPath, updated, 'utf8');
    return { ok: true };
  }

  /** Применяет патч в staging/current/ (не трогает production) */
  async applyPatchToStaging(patch: PatchEntry): Promise<{ ok: boolean; error?: string }> {
    const srcPath  = path.join(this.rootDir, patch.file);
    const destPath = path.join(this.currentDir, patch.file.replace(/\//g, '__'));

    // Берём source: сначала проверяем уже staged версию, иначе production
    const readPath = fs.existsSync(destPath) ? destPath : srcPath;
    if (!fs.existsSync(readPath)) {
      return { ok: false, error: `File not found: ${patch.file}` };
    }

    const content = fs.readFileSync(readPath, 'utf8');
    if (!content.includes(patch.oldStr)) {
      return { ok: false, error: `oldStr not found in staged ${patch.file}` };
    }

    const updated = content.replace(patch.oldStr, patch.newStr);
    fs.writeFileSync(destPath, updated, 'utf8');
    return { ok: true };
  }

  /** Переносит staged файлы в production (для одобрённых Level 2 предложений) */
  async promoteToProduction(proposalId: string, files: string[]): Promise<void> {
    for (const file of files) {
      const stagedPath = path.join(this.currentDir, file.replace(/\//g, '__'));
      const prodPath   = path.join(this.rootDir, file);
      if (fs.existsSync(stagedPath)) {
        fs.copyFileSync(stagedPath, prodPath);
        fs.unlinkSync(stagedPath);  // clean up staging
      }
    }
  }

  /** Восстанавливает файлы из резервной копии */
  async restoreBackup(proposalId: string): Promise<{ restoredFiles: string[] }> {
    const backupDir = path.join(this.backupsDir, proposalId);
    const restoredFiles: string[] = [];

    if (!fs.existsSync(backupDir)) {
      return { restoredFiles };
    }

    const backupFiles = fs.readdirSync(backupDir);
    for (const backupFile of backupFiles) {
      const originalPath = path.join(this.rootDir, backupFile.replace(/__/g, '/'));
      const backupPath   = path.join(backupDir, backupFile);

      // Убедимся что родительская директория существует
      const dir = path.dirname(originalPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.copyFileSync(backupPath, originalPath);
      restoredFiles.push(backupFile.replace(/__/g, '/'));
    }

    return { restoredFiles };
  }

  /** Запускает TypeScript type-check на staged файлах */
  async typeCheck(): Promise<{ ok: boolean; errors: string[] }> {
    try {
      const tsconfig = path.join(this.rootDir, 'tsconfig.json');
      if (!fs.existsSync(tsconfig)) {
        return { ok: true, errors: [] };  // нет tsconfig — пропускаем
      }

      const { stdout, stderr } = await execAsync(
        `npx tsc --noEmit --project ${tsconfig} 2>&1`,
        { cwd: this.rootDir, timeout: 30000 }
      );

      const output = (stdout + stderr).trim();
      if (!output) return { ok: true, errors: [] };

      const errors = output.split('\n').filter(l => l.includes('error TS'));
      return { ok: errors.length === 0, errors };
    } catch (e: any) {
      const errors = (e.stdout || e.stderr || String(e))
        .split('\n')
        .filter((l: string) => l.includes('error TS'))
        .slice(0, 10);
      return { ok: false, errors };
    }
  }

  /** Перезапускает bot процесс через PM2 */
  async restartBot(): Promise<boolean> {
    try {
      await execAsync('pm2 restart ton-agent-bot --update-env', { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Проверяет: существует ли файл и содержит ли oldStr */
  validatePatch(patch: PatchEntry): { valid: boolean; error?: string } {
    const fullPath = path.join(this.rootDir, patch.file);
    if (!fs.existsSync(fullPath)) return { valid: false, error: `File not found: ${patch.file}` };
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(patch.oldStr)) return { valid: false, error: `oldStr not found in ${patch.file}` };
    return { valid: true };
  }
}

let stagingInstance: StagingManager | null = null;
export function getStagingManager(): StagingManager {
  if (!stagingInstance) stagingInstance = new StagingManager();
  return stagingInstance;
}
