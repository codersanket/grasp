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

  const totalQuestions = checks.length;
  const answered = checks.filter((c) => c.developer_answer !== null && c.skipped !== 1);
  const passed = checks.filter((c) => c.score !== null && c.score > 0.5);
  const skipped = checks.filter((c) => c.skipped === 1);

  // Quiz pass rate: correct / total
  const quiz = totalQuestions > 0 ? (passed.length / totalQuestions) * 100 : 0;

  // Modification rate: placeholder — in V0.2 we'll track actual edits
  // For now, assume 50% (neutral) since we can't measure edits yet
  const modification = 50;

  // Review depth: answered questions / total chunks
  const reviewDepth = chunks.length > 0 ? Math.min(100, (answered.length / chunks.length) * 100) : 0;

  // Skip rate inverse: 1 - (skipped / total)
  const skipRate = totalQuestions > 0 ? (1 - skipped.length / totalQuestions) * 100 : 100;

  // Streak: placeholder — needs session tracking (Phase 5+)
  const streak = 50;

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
  const allChecks = db.prepare("SELECT * FROM checks").all() as Array<{
    score: number | null;
    skipped: number;
    developer_answer: string | null;
  }>;
  const allChunks = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number };

  const totalQuestions = allChecks.length;
  const answered = allChecks.filter((c) => c.developer_answer !== null && c.skipped !== 1);
  const passed = allChecks.filter((c) => c.score !== null && c.score > 0.5);
  const skipped = allChecks.filter((c) => c.skipped === 1);

  const quiz = totalQuestions > 0 ? (passed.length / totalQuestions) * 100 : 0;
  const modification = 50;
  const reviewDepth =
    allChunks.count > 0 ? Math.min(100, (answered.length / allChunks.count) * 100) : 0;
  const skipRate = totalQuestions > 0 ? (1 - skipped.length / totalQuestions) * 100 : 100;
  const streak = 50;

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
