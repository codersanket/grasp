import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { initSchema } from "./schema.js";

let instance: Database.Database | null = null;

export function getDataDir(): string {
  const dir = join(homedir(), ".grasp");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDatabase(dbPath?: string): Database.Database {
  if (instance) return instance;

  const path = dbPath ?? join(getDataDir(), "grasp.db");
  instance = new Database(path);

  instance.pragma("journal_mode = WAL");
  instance.pragma("synchronous = NORMAL");
  instance.pragma("foreign_keys = ON");

  initSchema(instance);

  return instance;
}

export function closeDatabase(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
