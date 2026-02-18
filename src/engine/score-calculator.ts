import { getDatabase } from "../storage/db.js";
import { getChecksForTask, getChunksForTask } from "../storage/queries.js";

export interface ComprehensionScore {
  overall: number;
  breakdown: {
    quiz: number;
    modification: number;
    review_depth: number;
    skip_rate: number;
    streak: number;
  };
  raw: {
    questions_total: number;
    questions_passed: number;
    questions_skipped: number;
    chunks_total: number;
  };
}

const WEIGHTS = {
  quiz: 0.35,
  modification: 0.25,
  review_depth: 0.2,
  skip_rate: 0.15,
  streak: 0.05,
};

export function calculateTaskScore(taskId: string): ComprehensionScore {
  const checks = getChecksForTask(taskId);
  const chunks = getChunksForTask(taskId);

  // Exclude abandoned checks (never answered, not skipped) — these are orphaned placeholders
  const activeChecks = checks.filter((c) => c.developer_answer !== null || c.skipped === 1);
  const totalQuestions = activeChecks.length;
  const answered = activeChecks.filter((c) => c.developer_answer !== null && c.skipped !== 1);
  const passed = activeChecks.filter((c) => c.score !== null && c.score > 0.5);
  const skipped = activeChecks.filter((c) => c.skipped === 1);

  // Quiz pass rate: correct / total
  const quiz = totalQuestions > 0 ? (passed.length / totalQuestions) * 100 : 0;

  // Modification rate: 0 when no data, scales with answered questions
  const modification = totalQuestions > 0 ? (answered.length / totalQuestions) * 100 : 0;

  // Review depth: answered questions / total chunks
  const reviewDepth = chunks.length > 0 ? Math.min(100, (answered.length / chunks.length) * 100) : 0;

  // Skip rate inverse: 1 - (skipped / total). 0 when no questions (not 100)
  const skipRate = totalQuestions > 0 ? (1 - skipped.length / totalQuestions) * 100 : 0;

  // Engagement: based on answer rate across all chunks
  const streak = chunks.length > 0 ? Math.min(100, (answered.length / chunks.length) * 100) : 0;

  const overall = Math.round(
    WEIGHTS.quiz * quiz +
    WEIGHTS.modification * modification +
    WEIGHTS.review_depth * reviewDepth +
    WEIGHTS.skip_rate * skipRate +
    WEIGHTS.streak * streak
  );

  return {
    overall: Math.max(0, Math.min(100, overall)),
    breakdown: {
      quiz: Math.round(quiz),
      modification: Math.round(modification),
      review_depth: Math.round(reviewDepth),
      skip_rate: Math.round(skipRate),
      streak: Math.round(streak),
    },
    raw: {
      questions_total: totalQuestions,
      questions_passed: passed.length,
      questions_skipped: skipped.length,
      chunks_total: chunks.length,
    },
  };
}

export function calculateOverallScore(): ComprehensionScore {
  const db = getDatabase();
  // Use SQL aggregation instead of loading all rows into memory
  const stats = db.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN developer_answer IS NOT NULL AND skipped != 1 THEN 1 ELSE 0 END) as answered,
       SUM(CASE WHEN score IS NOT NULL AND score > 0.5 THEN 1 ELSE 0 END) as passed,
       SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) as skipped
     FROM checks
     WHERE developer_answer IS NOT NULL OR skipped = 1`
  ).get() as { total: number; answered: number; passed: number; skipped: number };
  const allChunks = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number };

  const totalQuestions = stats.total;
  const answered = { length: stats.answered };
  const passed = { length: stats.passed };
  const skipped = { length: stats.skipped };

  const quiz = totalQuestions > 0 ? (passed.length / totalQuestions) * 100 : 0;
  const modification = totalQuestions > 0 ? (answered.length / totalQuestions) * 100 : 0;
  const reviewDepth =
    allChunks.count > 0 ? Math.min(100, (answered.length / allChunks.count) * 100) : 0;
  const skipRate = totalQuestions > 0 ? (1 - skipped.length / totalQuestions) * 100 : 0;
  const streak = allChunks.count > 0 ? Math.min(100, (answered.length / allChunks.count) * 100) : 0;

  const overall = Math.round(
    WEIGHTS.quiz * quiz +
    WEIGHTS.modification * modification +
    WEIGHTS.review_depth * reviewDepth +
    WEIGHTS.skip_rate * skipRate +
    WEIGHTS.streak * streak
  );

  return {
    overall: Math.max(0, Math.min(100, overall)),
    breakdown: {
      quiz: Math.round(quiz),
      modification: Math.round(modification),
      review_depth: Math.round(reviewDepth),
      skip_rate: Math.round(skipRate),
      streak: Math.round(streak),
    },
    raw: {
      questions_total: totalQuestions,
      questions_passed: passed.length,
      questions_skipped: skipped.length,
      chunks_total: allChunks.count,
    },
  };
}

export function recordDailyScore(score: ComprehensionScore): void {
  const db = getDatabase();
  const today = new Date().toISOString().split("T")[0];

  db.prepare(
    `INSERT OR REPLACE INTO score_history (date, overall_score, checks_passed, checks_skipped, chunks_modified, chunks_accepted)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    today,
    score.overall,
    score.raw.questions_passed,
    score.raw.questions_skipped,
    0, // chunks_modified — tracked in V0.2
    score.raw.chunks_total
  );
}
