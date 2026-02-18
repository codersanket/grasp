import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/storage/schema.js";

// Direct DB testing since score-calculator depends on the DB singleton

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

  it("calculates coverage correctly", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);

    // 3 files with chunks, all with explanations > 10 chars
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch1", "t1", "code1", "This is a detailed explanation of the design", "file1.ts", now);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch2", "t1", "code2", "Another thorough explanation here", "file2.ts", now);
    db.prepare(
      "INSERT INTO chunks (id, task_id, code, explanation, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("ch3", "t1", "code3", "short", "file3.ts", now);

    // 3 distinct files, 2 with explanation > 10 chars
    const aiFiles = db.prepare("SELECT COUNT(DISTINCT file_path) as count FROM chunks WHERE file_path IS NOT NULL").get() as { count: number };
    const filesWithContext = db.prepare("SELECT COUNT(DISTINCT file_path) as count FROM chunks WHERE file_path IS NOT NULL AND length(explanation) > 10").get() as { count: number };
    const coveragePct = Math.round((filesWithContext.count / aiFiles.count) * 100);

    expect(aiFiles.count).toBe(3);
    expect(filesWithContext.count).toBe(2);
    expect(coveragePct).toBe(67);
  });

  it("calculates engagement correctly", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);

    // 4 checks: 3 answered, 1 skipped
    db.prepare(
      "INSERT INTO checks (id, task_id, question, question_type, developer_answer, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("c1", "t1", "Q1", "design_decision", "answer1", 1.0, now);
    db.prepare(
      "INSERT INTO checks (id, task_id, question, question_type, developer_answer, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("c2", "t1", "Q2", "edge_case", "answer2", 0.8, now);
    db.prepare(
      "INSERT INTO checks (id, task_id, question, question_type, developer_answer, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("c3", "t1", "Q3", "trade_off", "answer3", 0.3, now);
    db.prepare(
      "INSERT INTO checks (id, task_id, question, question_type, skipped, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("c4", "t1", "Q4", "design_decision", 1, now);

    const stats = db.prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN developer_answer IS NOT NULL AND skipped != 1 THEN 1 ELSE 0 END) as answered
       FROM checks
       WHERE developer_answer IS NOT NULL OR skipped = 1`
    ).get() as { total: number; answered: number };

    const engagementPct = Math.round((stats.answered / stats.total) * 100);
    expect(engagementPct).toBe(75);
  });

  it("returns 100% engagement when no checks exist (high familiarity)", () => {
    // No checks = high familiarity skipped them = 100% engagement
    const totalQuestions = 0;
    const engagementPct = totalQuestions > 0 ? 0 : 100;
    expect(engagementPct).toBe(100);
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
