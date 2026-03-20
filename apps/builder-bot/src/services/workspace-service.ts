/**
 * Workspace Service — isolated file system for each agent
 * Each agent gets /app/data/workspaces/{agentId}/ as its root
 * Path traversal is prevented
 */

import { promises as fs } from 'fs';
import path from 'path';

const WORKSPACES_ROOT = process.env.WORKSPACES_ROOT || '/app/data/workspaces';

function getAgentRoot(agentId: number): string {
  return path.join(WORKSPACES_ROOT, String(agentId));
}

function validatePath(agentId: number, filePath: string): string {
  const root = getAgentRoot(agentId);
  // Resolve and ensure it's within the agent's workspace
  const resolved = path.resolve(root, filePath.replace(/^\/+/, ''));
  if (!resolved.startsWith(root)) {
    throw new Error('Path traversal detected');
  }
  // Ensure workspace root exists before realpath checks (realpath fails on missing dirs)
  const fsSync = require('fs');
  if (!fsSync.existsSync(root)) {
    fsSync.mkdirSync(root, { recursive: true });
  }
  // Check real path to prevent symlink-based traversal
  try {
    const realRoot = fsSync.realpathSync(root);
    const realResolved = fsSync.realpathSync(resolved);
    if (!realResolved.startsWith(realRoot)) {
      throw new Error('Path traversal detected via symlink');
    }
  } catch (e: any) {
    // If the file doesn't exist yet, check the parent directory
    if (e.code === 'ENOENT') {
      try {
        const parentDir = path.dirname(resolved);
        const realRoot = fsSync.realpathSync(root);
        const realParent = fsSync.realpathSync(parentDir);
        if (!realParent.startsWith(realRoot)) {
          throw new Error('Path traversal detected via symlink');
        }
      } catch (e2: any) {
        if (e2.code !== 'ENOENT') throw e2;
        // Parent also doesn't exist yet — will be created by mkdir; safe since resolved is under root
      }
    } else if (e.message?.includes('traversal')) {
      throw e;
    }
  }
  return resolved;
}

export async function ensureWorkspace(agentId: number): Promise<string> {
  const root = getAgentRoot(agentId);
  await fs.mkdir(root, { recursive: true });
  return root;
}

export async function writeFile(agentId: number, filePath: string, content: string): Promise<{ path: string; size: number }> {
  const absPath = validatePath(agentId, filePath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, 'utf-8');
  const stat = await fs.stat(absPath);
  return { path: filePath, size: stat.size };
}

export async function readFile(agentId: number, filePath: string): Promise<{ content: string; size: number }> {
  const absPath = validatePath(agentId, filePath);
  const content = await fs.readFile(absPath, 'utf-8');
  return { content: content.slice(0, 50000), size: content.length }; // limit to 50KB
}

export async function listFiles(agentId: number, dirPath: string = '.'): Promise<{ files: Array<{ name: string; type: 'file' | 'dir'; size: number }> }> {
  const absPath = validatePath(agentId, dirPath);
  try {
    const entries = await fs.readdir(absPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries.slice(0, 100)) { // max 100 entries
      const stat = await fs.stat(path.join(absPath, entry.name)).catch(() => null);
      files.push({
        name: entry.name,
        type: entry.isDirectory() ? 'dir' as const : 'file' as const,
        size: stat?.size || 0,
      });
    }
    return { files };
  } catch {
    return { files: [] };
  }
}

export async function deleteFile(agentId: number, filePath: string): Promise<{ ok: boolean }> {
  const absPath = validatePath(agentId, filePath);
  await fs.unlink(absPath);
  return { ok: true };
}

export async function appendFile(agentId: number, filePath: string, content: string): Promise<{ path: string; size: number }> {
  const absPath = validatePath(agentId, filePath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.appendFile(absPath, content, 'utf-8');
  const stat = await fs.stat(absPath);
  return { path: filePath, size: stat.size };
}

export async function fileExists(agentId: number, filePath: string): Promise<boolean> {
  try {
    const absPath = validatePath(agentId, filePath);
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

export async function getWorkspaceSize(agentId: number): Promise<{ totalFiles: number; totalSize: number }> {
  const root = getAgentRoot(agentId);
  let totalFiles = 0;
  let totalSize = 0;

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          totalFiles++;
          const stat = await fs.stat(full).catch(() => null);
          totalSize += stat?.size || 0;
        }
      }
    } catch {}
  }

  await walk(root);
  return { totalFiles, totalSize };
}
