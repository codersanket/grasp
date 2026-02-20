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

export function getChunksByFilePath(filePaths: string[]): Chunk[] {
  const db = getDatabase();
  if (filePaths.length === 0) return [];

  const placeholders = filePaths.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM chunks WHERE file_path IN (${placeholders}) ORDER BY created_at DESC`)
    .all(...filePaths) as Chunk[];
}

export function hasChunksForFile(filePath: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare("SELECT COUNT(*) as count FROM chunks WHERE file_path = ?")
    .get(filePath) as { count: number };
  return result.count > 0;
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

// ── Design Reviews ────────────────────────────────────────

export interface DesignReview {
  id: string;
  task_id: string;
  scope: string;
  question: string;
  developer_response: string | null;
  file_paths: string | null;
  created_at: string;
}

export function createDesignReview(taskId: string, scope: string, filePaths?: string[]): DesignReview {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  const filePathsJson = filePaths ? JSON.stringify(filePaths) : null;

  db.prepare(
    "INSERT INTO design_reviews (id, task_id, scope, file_paths, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, taskId, scope, filePathsJson, now);

  return {
    id,
    task_id: taskId,
    scope,
    question: "pending_ai_generation",
    developer_response: null,
    file_paths: filePathsJson,
    created_at: now,
  };
}

export function recordDesignResponse(reviewId: string, response: string): void {
  const db = getDatabase();
  db.prepare("UPDATE design_reviews SET developer_response = ? WHERE id = ?").run(response, reviewId);
}

export function getDesignReviewsForTask(taskId: string): DesignReview[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM design_reviews WHERE task_id = ? ORDER BY created_at").all(taskId) as DesignReview[];
}

export function hasDesignReviewsForTask(taskId: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare("SELECT COUNT(*) as count FROM design_reviews WHERE task_id = ?")
    .get(taskId) as { count: number };
  return result.count > 0;
}

export function getDesignReviewsByFiles(filePaths: string[]): DesignReview[] {
  const db = getDatabase();
  if (filePaths.length === 0) return [];

  const allReviews = db.prepare("SELECT * FROM design_reviews WHERE file_paths IS NOT NULL ORDER BY created_at DESC").all() as DesignReview[];
  return allReviews.filter((review) => {
    const reviewFiles: string[] = JSON.parse(review.file_paths!);
    return reviewFiles.some((f) => filePaths.includes(f));
  });
}

export function getDesignReviewById(id: string): DesignReview | undefined {
  const db = getDatabase();
  return db.prepare("SELECT * FROM design_reviews WHERE id = ?").get(id) as DesignReview | undefined;
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

// ── Coverage ──────────────────────────────────────────────

export interface Coverage {
  ai_files: number;
  files_with_context: number;
  coverage_pct: number;
}

export function getCoverage(): Coverage {
  const db = getDatabase();
  const aiFiles = db
    .prepare("SELECT COUNT(DISTINCT file_path) as count FROM chunks WHERE file_path IS NOT NULL")
    .get() as { count: number };
  const filesWithContext = db
    .prepare("SELECT COUNT(DISTINCT file_path) as count FROM chunks WHERE file_path IS NOT NULL AND length(explanation) > 10")
    .get() as { count: number };

  const coveragePct = aiFiles.count > 0
    ? Math.round((filesWithContext.count / aiFiles.count) * 100)
    : 0;

  return {
    ai_files: aiFiles.count,
    files_with_context: filesWithContext.count,
    coverage_pct: coveragePct,
  };
}

// ── File History ──────────────────────────────────────────

export interface FileHistory {
  file_path: string;
  familiarity: number;
  chunks: Chunk[];
}

export function getFileHistory(filePath: string): FileHistory {
  const db = getDatabase();
  const fam = db
    .prepare("SELECT score FROM familiarity WHERE file_path = ?")
    .get(filePath) as { score: number } | undefined;
  const chunks = db
    .prepare("SELECT * FROM chunks WHERE file_path = ? ORDER BY created_at DESC")
    .all(filePath) as Chunk[];

  return {
    file_path: filePath,
    familiarity: fam?.score ?? 0,
    chunks,
  };
}

// ── Map Stats ─────────────────────────────────────────────

export interface FileStats {
  file_path: string;
  familiarity: number;
  chunk_count: number;
  interactions: number;
  last_interaction: string;
  last_generated: string;
}

export function getAllFileStats(): FileStats[] {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT
        c.file_path,
        COALESCE(f.score, 0) as familiarity,
        COUNT(c.id) as chunk_count,
        COALESCE(f.interactions, 0) as interactions,
        COALESCE(f.last_interaction, '') as last_interaction,
        MAX(c.created_at) as last_generated
      FROM chunks c
      LEFT JOIN familiarity f ON c.file_path = f.file_path
      WHERE c.file_path IS NOT NULL
      GROUP BY c.file_path
      ORDER BY c.file_path`
    )
    .all() as FileStats[];
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
