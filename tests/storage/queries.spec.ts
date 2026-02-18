import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/storage/schema.js";

// Use in-memory DB for tests — bypass the singleton
function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

describe("Schema", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("creates all 5 tables", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const names = tables.map((t) => t.name);
    expect(names).toContain("tasks");
    expect(names).toContain("chunks");
    expect(names).toContain("checks");
    expect(names).toContain("familiarity");
    expect(names).toContain("score_history");
  });

  it("supports task creation and retrieval", () => {
    db.prepare(
      "INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)"
    ).run("t1", "Add rate limiting", new Date().toISOString());

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get("t1") as {
      id: string;
      intent: string;
    };
    expect(task.id).toBe("t1");
    expect(task.intent).toBe("Add rate limiting");
  });

  it("supports chunk creation linked to task", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run(
      "t1",
      "test",
      now
    );
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run("c1", "t1", "const x = 1;", "Simple assignment", now);

    const chunks = db
      .prepare("SELECT * FROM chunks WHERE task_id = ?")
      .all("t1") as Array<{ id: string; code: string }>;
    expect(chunks).toHaveLength(1);
    expect(chunks[0].code).toBe("const x = 1;");
  });

  it("supports check creation and answer recording", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run(
      "t1",
      "test",
      now
    );
    db.prepare(
      "INSERT INTO checks (id, task_id, question, question_type, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "Why sliding window?", "design_decision", now);

    // Record answer
    db.prepare("UPDATE checks SET developer_answer = ?, score = ? WHERE id = ?").run(
      "Prevents burst at boundaries",
      1.0,
      "ch1"
    );

    const check = db.prepare("SELECT * FROM checks WHERE id = ?").get("ch1") as {
      developer_answer: string;
      score: number;
    };
    expect(check.developer_answer).toBe("Prevents burst at boundaries");
    expect(check.score).toBe(1.0);
  });

  it("supports familiarity tracking", () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO familiarity (file_path, score, last_interaction, interactions) VALUES (?, ?, ?, ?)"
    ).run("src/index.ts", 42, now, 5);

    const fam = db.prepare("SELECT * FROM familiarity WHERE file_path = ?").get("src/index.ts") as {
      score: number;
      interactions: number;
    };
    expect(fam.score).toBe(42);
    expect(fam.interactions).toBe(5);
  });
});
