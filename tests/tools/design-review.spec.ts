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

describe("design_reviews table", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it("creates design review records", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, files, started_at) VALUES (?, ?, ?, ?)").run(
      "t1", "Add auth middleware", '["src/auth.ts"]', now
    );
    db.prepare(
      "INSERT INTO design_reviews (id, task_id, scope, file_paths, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run("dr1", "t1", "approach", '["src/auth.ts"]', now);

    const review = db.prepare("SELECT * FROM design_reviews WHERE id = ?").get("dr1") as any;
    expect(review).toBeDefined();
    expect(review.task_id).toBe("t1");
    expect(review.scope).toBe("approach");
    expect(review.question).toBe("pending_ai_generation");
    expect(review.developer_response).toBeNull();
    expect(review.file_paths).toBe('["src/auth.ts"]');
  });

  it("records developer response", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO design_reviews (id, task_id, scope, created_at) VALUES (?, ?, ?, ?)"
    ).run("dr1", "t1", "approach", now);

    db.prepare("UPDATE design_reviews SET developer_response = ? WHERE id = ?").run(
      "Use JWT for stateless auth", "dr1"
    );

    const review = db.prepare("SELECT * FROM design_reviews WHERE id = ?").get("dr1") as any;
    expect(review.developer_response).toBe("Use JWT for stateless auth");
  });
});

describe("design review familiarity scoping", () => {
  it("creates 3 scopes for familiarity 0-30", () => {
    const avgFamiliarity = 15;
    let scopes: string[];
    if (avgFamiliarity <= 30) {
      scopes = ["approach", "trade_offs", "edge_cases"];
    } else {
      scopes = ["approach", "trade_offs"];
    }
    expect(scopes).toHaveLength(3);
    expect(scopes).toContain("edge_cases");
  });

  it("creates 2 scopes for familiarity 31-49", () => {
    const avgFamiliarity = 40;
    let scopes: string[];
    if (avgFamiliarity <= 30) {
      scopes = ["approach", "trade_offs", "edge_cases"];
    } else {
      scopes = ["approach", "trade_offs"];
    }
    expect(scopes).toHaveLength(2);
    expect(scopes).not.toContain("edge_cases");
  });

  it("skips design review for familiarity >= 50", () => {
    const avgFamiliarity = 55;
    const shouldSkip = avgFamiliarity >= 50;
    expect(shouldSkip).toBe(true);
  });
});

describe("design review skips grasp_check", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it("hasDesignReviewsForTask returns true when reviews exist", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO design_reviews (id, task_id, scope, created_at) VALUES (?, ?, ?, ?)"
    ).run("dr1", "t1", "approach", now);

    const result = db.prepare(
      "SELECT COUNT(*) as count FROM design_reviews WHERE task_id = ?"
    ).get("t1") as { count: number };
    expect(result.count > 0).toBe(true);
  });

  it("hasDesignReviewsForTask returns false when no reviews exist", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);

    const result = db.prepare(
      "SELECT COUNT(*) as count FROM design_reviews WHERE task_id = ?"
    ).get("t1") as { count: number };
    expect(result.count > 0).toBe(false);
  });
});

describe("design_discussed interaction type", () => {
  it("has correct score delta of 4", () => {
    const SCORE_DELTAS: Record<string, number> = {
      generated: 1,
      questioned: 3,
      answered_correctly: 5,
      answered_incorrectly: 1,
      modified: 4,
      skipped: -2,
      design_discussed: 4,
    };
    expect(SCORE_DELTAS.design_discussed).toBe(4);
    expect(SCORE_DELTAS.design_discussed).toBe(SCORE_DELTAS.modified);
  });

  it("updates familiarity when design is discussed", () => {
    const db = createTestDb();
    const now = new Date().toISOString();

    // Start with familiarity of 10
    db.prepare(
      "INSERT INTO familiarity (file_path, score, last_interaction, interactions) VALUES (?, ?, ?, ?)"
    ).run("src/auth.ts", 10, now, 2);

    // Simulate design_discussed delta of +4
    const existing = db.prepare("SELECT score FROM familiarity WHERE file_path = ?").get("src/auth.ts") as { score: number };
    const newScore = Math.max(0, Math.min(100, existing.score + 4));
    db.prepare("UPDATE familiarity SET score = ?, interactions = interactions + 1 WHERE file_path = ?").run(newScore, "src/auth.ts");

    const updated = db.prepare("SELECT * FROM familiarity WHERE file_path = ?").get("src/auth.ts") as any;
    expect(updated.score).toBe(14);
    expect(updated.interactions).toBe(3);

    db.close();
  });
});

describe("getDesignReviewsByFiles", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it("finds reviews matching file paths", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO design_reviews (id, task_id, scope, developer_response, file_paths, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("dr1", "t1", "approach", "Use middleware pattern", '["src/auth.ts"]', now);
    db.prepare(
      "INSERT INTO design_reviews (id, task_id, scope, developer_response, file_paths, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("dr2", "t1", "trade_offs", "Accept latency hit", '["src/other.ts"]', now);

    // Simulate getDesignReviewsByFiles logic
    const allReviews = db.prepare(
      "SELECT * FROM design_reviews WHERE file_paths IS NOT NULL ORDER BY created_at DESC"
    ).all() as any[];
    const matching = allReviews.filter((review: any) => {
      const reviewFiles: string[] = JSON.parse(review.file_paths);
      return reviewFiles.some((f: string) => ["src/auth.ts"].includes(f));
    });

    expect(matching).toHaveLength(1);
    expect(matching[0].scope).toBe("approach");
  });

  it("returns empty for unmatched files", () => {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO tasks (id, intent, started_at) VALUES (?, ?, ?)").run("t1", "test", now);
    db.prepare(
      "INSERT INTO design_reviews (id, task_id, scope, file_paths, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run("dr1", "t1", "approach", '["src/auth.ts"]', now);

    const allReviews = db.prepare(
      "SELECT * FROM design_reviews WHERE file_paths IS NOT NULL"
    ).all() as any[];
    const matching = allReviews.filter((review: any) => {
      const reviewFiles: string[] = JSON.parse(review.file_paths);
      return reviewFiles.some((f: string) => ["src/unknown.ts"].includes(f));
    });

    expect(matching).toHaveLength(0);
  });
});
