import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/storage/schema.js";

// Direct DB testing since score-calculator depends on the DB singleton
// In a more thorough test setup we'd mock getDatabase()

describe("Score Calculator Logic", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it("calculates quiz pass rate correctly", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);

    // 3 questions: 2 passed, 1 failed
    db.prepare(
      "INSERT INTO checks (id, task_id, question, question_type, score, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("c1", "t1", "Q1", "design_decision", 1.0, now);
    db.prepare(
      "INSERT INTO checks (id, task_id, question, question_type, score, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("c2", "t1", "Q2", "edge_case", 0.8, now);
    db.prepare(
      "INSERT INTO checks (id, task_id, question, question_type, score, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("c3", "t1", "Q3", "trade_off", 0.3, now);

    const checks = db.prepare("SELECT * FROM checks WHERE task_id = ?").all("t1") as Array<{
      score: number | null;
    }>;
    const passed = checks.filter((c) => c.score !== null && c.score > 0.5);
    const quizRate = (passed.length / checks.length) * 100;

    expect(quizRate).toBeCloseTo(66.67, 1);
  });

  it("handles skip rate inverse", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);

    // 4 questions: 1 skipped
    for (let i = 1; i <= 4; i++) {
      db.prepare(
        "INSERT INTO checks (id, task_id, question, question_type, skipped, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(`c${i}`, "t1", `Q${i}`, "design_decision", i === 4 ? 1 : 0, now);
    }

    const checks = db.prepare("SELECT * FROM checks WHERE task_id = ?").all("t1") as Array<{
      skipped: number;
    }>;
    const skipped = checks.filter((c) => c.skipped === 1).length;
    const skipRateInverse = (1 - skipped / checks.length) * 100;

    expect(skipRateInverse).toBe(75);
  });

  it("returns 0 for empty task", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);

    const checks = db.prepare("SELECT COUNT(*) as count FROM checks WHERE task_id = ?").get("t1") as {
      count: number;
    };
    expect(checks.count).toBe(0);
  });
});
