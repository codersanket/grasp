import { randomUUID } from "node:crypto";
import { getDatabase } from "./db.js";

// ── Tasks ──────────────────────────────────────────────────

export interface Task {
  id: string;
  intent: string;
  files: string | null;
  mode: string;
  started_at: string;
  completed_at: string | null;
}

export function createTask(intent: string, files?: string[]): Task {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const filesJson = files ? JSON.stringify(files) : null;

  db.prepare(
    "INSERT INTO tasks (id, intent, files, mode, started_at) VALUES (?, ?, ?, 'guided', ?)"
  ).run(id, intent, filesJson, now);

  return { id, intent, files: filesJson, mode: "guided", started_at: now, completed_at: null };
}

export function getTask(id: string): Task | undefined {
  const db = getDatabase();
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined;
}

export function completeTask(id: string): void {
  const db = getDatabase();
  db.prepare("UPDATE tasks SET completed_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    id
  );
}

// ── Chunks ─────────────────────────────────────────────────

export interface Chunk {
  id: string;
  task_id: string;
  code: string;
  explanation: string;
  file_path: string | null;
  lines_start: number | null;
  lines_end: number | null;
  created_at: string;
}

export function createChunk(
  taskId: string,
  code: string,
  explanation: string,
  filePath?: string,
  linesStart?: number,
  linesEnd?: number
): Chunk {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO chunks (id, task_id, code, explanation, file_path, lines_start, lines_end, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, taskId, code, explanation, filePath ?? null, linesStart ?? null, linesEnd ?? null, now);

  return {
    id,
    task_id: taskId,
    code,
    explanation,
    file_path: filePath ?? null,
    lines_start: linesStart ?? null,
    lines_end: linesEnd ?? null,
    created_at: now,
  };
}

export function getChunksForTask(taskId: string): Chunk[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM chunks WHERE task_id = ? ORDER BY created_at").all(taskId) as Chunk[];
}

// ── Checks ─────────────────────────────────────────────────

export interface Check {
  id: string;
  task_id: string;
  chunk_id: string | null;
  question: string;
  question_type: string;
  expected_insight: string | null;
  developer_answer: string | null;
  score: number | null;
  skipped: number;
  created_at: string;
}

export function createCheck(
  taskId: string,
  question: string,
  questionType: string,
  expectedInsight?: string,
  chunkId?: string
): Check {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO checks (id, task_id, chunk_id, question, question_type, expected_insight, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, taskId, chunkId ?? null, question, questionType, expectedInsight ?? null, now);

  return {
    id,
    task_id: taskId,
    chunk_id: chunkId ?? null,
    question,
    question_type: questionType,
    expected_insight: expectedInsight ?? null,
    developer_answer: null,
    score: null,
    skipped: 0,
    created_at: now,
  };
}

export function recordAnswer(checkId: string, answer: string, score: number): void {
  const db = getDatabase();
  db.prepare("UPDATE checks SET developer_answer = ?, score = ? WHERE id = ?").run(
    answer,
    score,
    checkId
  );
}

export function recordSkip(checkId: string): void {
  const db = getDatabase();
  db.prepare("UPDATE checks SET skipped = 1 WHERE id = ?").run(checkId);
}

export function getChecksForTask(taskId: string): Check[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM checks WHERE task_id = ? ORDER BY created_at").all(taskId) as Check[];
}

// ── Familiarity ────────────────────────────────────────────

export interface Familiarity {
  file_path: string;
  score: number;
  last_interaction: string;
  interactions: number;
}

export function getFamiliarity(filePaths: string[]): Familiarity[] {
  const db = getDatabase();
  if (filePaths.length === 0) return [];

  const placeholders = filePaths.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM familiarity WHERE file_path IN (${placeholders})`)
    .all(...filePaths) as Familiarity[];
}

export function updateFamiliarity(filePath: string, scoreDelta: number): Familiarity {
  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = db
    .prepare("SELECT * FROM familiarity WHERE file_path = ?")
    .get(filePath) as Familiarity | undefined;

  if (existing) {
    const newScore = Math.max(0, Math.min(100, existing.score + scoreDelta));
    db.prepare(
      "UPDATE familiarity SET score = ?, last_interaction = ?, interactions = interactions + 1 WHERE file_path = ?"
    ).run(newScore, now, filePath);
    return { file_path: filePath, score: newScore, last_interaction: now, interactions: existing.interactions + 1 };
  } else {
    const score = Math.max(0, Math.min(100, scoreDelta));
    db.prepare(
      "INSERT INTO familiarity (file_path, score, last_interaction, interactions) VALUES (?, ?, ?, 1)"
    ).run(filePath, score, now);
    return { file_path: filePath, score, last_interaction: now, interactions: 1 };
  }
}

// ── Score History ──────────────────────────────────────────

export interface ScoreRecord {
  date: string;
  overall_score: number;
  checks_passed: number;
  checks_skipped: number;
  chunks_modified: number;
  chunks_accepted: number;
}

export function getScoreHistory(limit: number = 30): ScoreRecord[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM score_history ORDER BY date DESC LIMIT ?")
    .all(limit) as ScoreRecord[];
}

export function getOverallStats(): {
  total_tasks: number;
  total_chunks: number;
  total_checks: number;
  checks_passed: number;
  checks_skipped: number;
} {
  const db = getDatabase();
  const tasks = db.prepare("SELECT COUNT(*) as count FROM tasks").get() as { count: number };
  const chunks = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number };
  const checks = db.prepare("SELECT COUNT(*) as count FROM checks").get() as { count: number };
  const passed = db
    .prepare("SELECT COUNT(*) as count FROM checks WHERE score IS NOT NULL AND score > 0.5")
    .get() as { count: number };
  const skipped = db
    .prepare("SELECT COUNT(*) as count FROM checks WHERE skipped = 1")
    .get() as { count: number };

  return {
    total_tasks: tasks.count,
    total_chunks: chunks.count,
    total_checks: checks.count,
    checks_passed: passed.count,
    checks_skipped: skipped.count,
  };
}
