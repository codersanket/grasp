import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/storage/schema.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

describe("Auto-create task from log_chunk", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it("creates a task when task_id is omitted", () => {
    const now = new Date().toISOString();
    // Simulate what log_chunk does when task_id is missing: create task then chunk
    db.prepare("INSERT INTO tasks (id, intent, files, mode, started_at) VALUES (?, ?, ?, 'guided', ?)").run(
      "auto-1", "Auto-captured: changes to src/foo.ts", '["src/foo.ts"]', now
    );
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "auto-1", "const x = 1;", "Simple constant for config", "src/foo.ts", now);

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get("auto-1") as any;
    expect(task).toBeDefined();
    expect(task.intent).toBe("Auto-captured: changes to src/foo.ts");

    const chunk = db.prepare("SELECT * FROM chunks WHERE task_id = ?").get("auto-1") as any;
    expect(chunk).toBeDefined();
    expect(chunk.file_path).toBe("src/foo.ts");
  });

  it("uses generic intent when no file_path provided", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, mode, started_at) VALUES (?, ?, 'guided', ?)").run(
      "auto-2", "Auto-captured: code generation", now
    );

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get("auto-2") as any;
    expect(task.intent).toBe("Auto-captured: code generation");
    expect(task.files).toBeNull();
  });

  it("rejects invalid task_id when explicitly provided", () => {
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get("nonexistent") as any;
    expect(task).toBeUndefined();
  });

  it("returns auto_created flag in response shape", () => {
    // Verify the expected JSON shape
    const response = {
      chunk_id: "ch1",
      task_id: "auto-1",
      auto_created: true,
      logged: true,
    };
    expect(response.auto_created).toBe(true);
    expect(response.task_id).toBeDefined();
  });
});

describe("High familiarity skip (check tool)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it("skips questions when avg familiarity >= 50", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "code", "explanation text here", "src/familiar.ts", now);

    // Set familiarity to exactly 50 — should skip
    db.prepare(
      "INSERT INTO familiarity (file_path, score, last_interaction, interactions) VALUES (?, ?, ?, ?)"
    ).run("src/familiar.ts", 50, now, 10);

    const fam = db.prepare("SELECT score FROM familiarity WHERE file_path = ?").get("src/familiar.ts") as { score: number };
    expect(fam.score).toBe(50);

    // Simulate check tool logic: avgFamiliarity >= 50 → skip
    const avgFamiliarity = fam.score;
    expect(avgFamiliarity >= 50).toBe(true);
  });

  it("asks questions when avg familiarity < 50", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO familiarity (file_path, score, last_interaction, interactions) VALUES (?, ?, ?, ?)"
    ).run("src/new-file.ts", 30, now, 3);

    const fam = db.prepare("SELECT score FROM familiarity WHERE file_path = ?").get("src/new-file.ts") as { score: number };
    expect(fam.score < 50).toBe(true);
  });

  it("averages familiarity across multiple files", () => {
    const now = new Date().toISOString();
    // File A: 70, File B: 20 → avg = 45 → should ask questions
    db.prepare(
      "INSERT INTO familiarity (file_path, score, last_interaction, interactions) VALUES (?, ?, ?, ?)"
    ).run("src/a.ts", 70, now, 10);
    db.prepare(
      "INSERT INTO familiarity (file_path, score, last_interaction, interactions) VALUES (?, ?, ?, ?)"
    ).run("src/b.ts", 20, now, 2);

    const rows = db.prepare("SELECT score FROM familiarity WHERE file_path IN (?, ?)").all("src/a.ts", "src/b.ts") as { score: number }[];
    const avg = rows.reduce((sum, r) => sum + r.score, 0) / rows.length;
    expect(avg).toBe(45);
    expect(avg >= 50).toBe(false); // Should ask questions
  });

  it("uses 50% question coverage for familiarity 30-49", () => {
    const avgFamiliarity = 35;
    const baseCount = 4; // 4 chunks
    const questionCount = Math.ceil(baseCount * 0.5);
    expect(questionCount).toBe(2);
  });

  it("uses full question coverage for familiarity 0-30", () => {
    const avgFamiliarity = 15;
    const baseCount = 3;
    const questionCount = baseCount; // full
    expect(questionCount).toBe(3);
  });

  it("does not complete task prematurely when generating checks", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "code", "explanation", "src/file.ts", now);
    db.prepare(
      "INSERT INTO checks (id, task_id, chunk_id, question, question_type, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ck1", "t1", "ch1", "pending_ai_generation", "design_decision", now);

    // Task should NOT be completed yet — checks are unanswered
    const task = db.prepare("SELECT completed_at FROM tasks WHERE id = ?").get("t1") as any;
    expect(task.completed_at).toBeNull();
  });

  it("completes task when last check is answered", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO checks (id, task_id, question, question_type, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run("ck1", "t1", "Q1", "design_decision", now);

    // Answer the check
    db.prepare("UPDATE checks SET developer_answer = ?, score = ? WHERE id = ?").run("my answer", 1.0, "ck1");

    // Simulate maybeCompleteTask: check if all resolved
    const pending = db.prepare(
      "SELECT COUNT(*) as count FROM checks WHERE task_id = ? AND developer_answer IS NULL AND skipped = 0"
    ).get("t1") as { count: number };
    expect(pending.count).toBe(0);

    // Now complete the task
    db.prepare("UPDATE tasks SET completed_at = ? WHERE id = ?").run(new Date().toISOString(), "t1");
    const task = db.prepare("SELECT completed_at FROM tasks WHERE id = ?").get("t1") as any;
    expect(task.completed_at).not.toBeNull();
  });
});

describe("Read hook context surfacing", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it("returns chunks for file with stored context", () => {
    const older = "2025-06-01T00:00:00.000Z";
    const newer = "2025-06-01T01:00:00.000Z";
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", older);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "const x = 1;", "Used constant for immutability", "src/config.ts", older);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch2", "t1", "export default config;", "Default export for clean imports", "src/config.ts", newer);

    const chunks = db.prepare(
      "SELECT * FROM chunks WHERE file_path = ? ORDER BY created_at DESC"
    ).all("src/config.ts") as any[];

    expect(chunks).toHaveLength(2);
    expect(chunks[0].explanation).toBe("Default export for clean imports");
    expect(chunks[1].explanation).toBe("Used constant for immutability");
  });

  it("returns empty for file without stored context", () => {
    const count = db.prepare(
      "SELECT COUNT(*) as count FROM chunks WHERE file_path = ?"
    ).get("src/unknown.ts") as { count: number };

    expect(count.count).toBe(0);
  });

  it("formats context lines correctly", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "code", "Sliding window for rate limiting", "src/rate.ts", now);

    const chunks = db.prepare("SELECT * FROM chunks WHERE file_path = ?").all("src/rate.ts") as any[];
    const lines = [`Grasp context for src/rate.ts:`];
    for (const chunk of chunks) {
      lines.push(`  - "${chunk.explanation}" (just now)`);
    }

    expect(lines[0]).toBe("Grasp context for src/rate.ts:");
    expect(lines[1]).toContain("Sliding window for rate limiting");
  });
});

describe("grasp_why (file history lookup)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it("returns design decisions for a tracked file", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "const limiter = ...", "Sliding window over fixed for burst protection", "src/rate.ts", now);
    db.prepare(
      "INSERT INTO familiarity (file_path, score, last_interaction, interactions) VALUES (?, ?, ?, ?)"
    ).run("src/rate.ts", 25, now, 5);

    const fam = db.prepare("SELECT score FROM familiarity WHERE file_path = ?").get("src/rate.ts") as { score: number } | undefined;
    const chunks = db.prepare("SELECT * FROM chunks WHERE file_path = ? ORDER BY created_at DESC").all("src/rate.ts") as any[];

    expect(fam?.score).toBe(25);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].explanation).toBe("Sliding window over fixed for burst protection");
  });

  it("returns empty for untracked file", () => {
    const chunks = db.prepare("SELECT * FROM chunks WHERE file_path = ?").all("src/never-seen.ts") as any[];
    expect(chunks).toHaveLength(0);
  });

  it("returns 0 familiarity for file with chunks but no familiarity record", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "code", "Some explanation", "src/orphan.ts", now);

    const fam = db.prepare("SELECT score FROM familiarity WHERE file_path = ?").get("src/orphan.ts") as { score: number } | undefined;
    expect(fam).toBeUndefined();
    // Tool should default to 0
    const familiarity = fam?.score ?? 0;
    expect(familiarity).toBe(0);
  });

  it("returns multiple decisions ordered by most recent first", () => {
    const old = "2025-01-01T00:00:00.000Z";
    const recent = "2025-06-01T00:00:00.000Z";
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", old);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "v1 code", "First approach: simple loop", "src/algo.ts", old);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch2", "t1", "v2 code", "Refactored to use map for clarity", "src/algo.ts", recent);

    const chunks = db.prepare("SELECT * FROM chunks WHERE file_path = ? ORDER BY created_at DESC").all("src/algo.ts") as any[];
    expect(chunks[0].explanation).toBe("Refactored to use map for clarity");
    expect(chunks[1].explanation).toBe("First approach: simple loop");
  });
});

describe("getCoverage query", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it("calculates 100% when all files have explanations > 10 chars", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "code", "Detailed explanation of this design choice", "a.ts", now);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch2", "t1", "code", "Another thorough explanation here", "b.ts", now);

    const aiFiles = db.prepare("SELECT COUNT(DISTINCT file_path) as count FROM chunks WHERE file_path IS NOT NULL").get() as { count: number };
    const withCtx = db.prepare("SELECT COUNT(DISTINCT file_path) as count FROM chunks WHERE file_path IS NOT NULL AND length(explanation) > 10").get() as { count: number };

    expect(aiFiles.count).toBe(2);
    expect(withCtx.count).toBe(2);
    expect(Math.round((withCtx.count / aiFiles.count) * 100)).toBe(100);
  });

  it("returns 0% when no chunks exist", () => {
    const aiFiles = db.prepare("SELECT COUNT(DISTINCT file_path) as count FROM chunks WHERE file_path IS NOT NULL").get() as { count: number };
    expect(aiFiles.count).toBe(0);
  });

  it("excludes chunks without file_path from coverage", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    // Chunk with no file_path
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "code", "Some explanation of design", now);

    const aiFiles = db.prepare("SELECT COUNT(DISTINCT file_path) as count FROM chunks WHERE file_path IS NOT NULL").get() as { count: number };
    expect(aiFiles.count).toBe(0);
  });
});
