import type Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      intent TEXT NOT NULL,
      files TEXT,
      mode TEXT DEFAULT 'guided',
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      code TEXT NOT NULL,
      explanation TEXT NOT NULL,
      file_path TEXT,
      lines_start INTEGER,
      lines_end INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      chunk_id TEXT,
      question TEXT NOT NULL,
      question_type TEXT DEFAULT 'design_decision',
      expected_insight TEXT,
      developer_answer TEXT,
      score REAL,
      skipped INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS familiarity (
      file_path TEXT PRIMARY KEY,
      score REAL DEFAULT 0,
      last_interaction TEXT NOT NULL,
      interactions INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS design_reviews (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      scope TEXT NOT NULL,
      question TEXT NOT NULL DEFAULT 'pending_ai_generation',
      developer_response TEXT,
      file_paths TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS score_history (
      date TEXT PRIMARY KEY,
      overall_score REAL DEFAULT 0,
      checks_passed INTEGER DEFAULT 0,
      checks_skipped INTEGER DEFAULT 0,
      chunks_modified INTEGER DEFAULT 0,
      chunks_accepted INTEGER DEFAULT 0
    );
  `);
}
