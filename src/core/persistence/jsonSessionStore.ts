import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import lockfile from 'proper-lockfile';
import type { Content } from '@google/gemini-cli-core';
import type { SessionStore } from './interfaces.js';

const SESSIONS_DIR = path.join(os.homedir(), '.geminiclaw', 'sessions');

export class JsonSessionStore implements SessionStore {
  private async ensureDir() {
    try {
      await fs.mkdir(SESSIONS_DIR, { recursive: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }
    }
  }

  private getFilePath(sessionId: string): string {
    // Sanitize the session ID to prevent path traversal
    const safeId = sessionId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(SESSIONS_DIR, `${safeId}.json`);
  }

  async getHistory(sessionId: string): Promise<Content[]> {
    await this.ensureDir();
    const filePath = this.getFilePath(sessionId);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data) as Content[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      console.error(`Error reading session ${sessionId}:`, err);
      return [];
    }
  }

  async save(sessionId: string, items: Content[]): Promise<void> {
    await this.ensureDir();
    const filePath = this.getFilePath(sessionId);

    // If the file doesn't exist yet, we must create it empty first so lockfile can lock it
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, '[]');
    }

    let release: () => Promise<void>;
    try {
      release = await lockfile.lock(filePath, { retries: 5 });
    } catch (err) {
      console.error(`Failed to acquire lock for session ${sessionId}:`, err);
      return;
    }

    try {
      await fs.writeFile(filePath, JSON.stringify(items, null, 2), 'utf8');
    } catch (err) {
      console.error(`Failed to save session ${sessionId}:`, err);
    } finally {
      await release();
    }
  }

  async clear(sessionId: string): Promise<void> {
    await this.ensureDir();
    const filePath = this.getFilePath(sessionId);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Failed to clear session ${sessionId}:`, err);
      }
    }
  }
}
