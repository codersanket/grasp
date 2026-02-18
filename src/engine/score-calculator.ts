import { getDatabase } from "../storage/db.js";
import { getChecksForTask, getChunksForTask, getCoverage } from "../storage/queries.js";

export interface ComprehensionScore {
  overall: number;
  coverage: {
    ai_files: number;
    files_with_context: number;
    coverage_pct: number;
  };
  engagement: {
    checks_answered: number;
    checks_total: number;
    engagement_pct: number;
  };
  raw: {
    questions_total: number;
    questions_passed: number;
    questions_skipped: number;
    chunks_total: number;
  };
}

export function calculateTaskScore(taskId: string): ComprehensionScore {
  const checks = getChecksForTask(taskId);
  const chunks = getChunksForTask(taskId);
  const coverage = getCoverage();

  const activeChecks = checks.filter((c) => c.developer_answer !== null || c.skipped === 1);
  const totalQuestions = activeChecks.length;
  const answered = activeChecks.filter((c) => c.developer_answer !== null && c.skipped !== 1);
  const passed = activeChecks.filter((c) => c.score !== null && c.score > 0.5);
  const skipped = activeChecks.filter((c) => c.skipped === 1);

  // If no checks exist (high familiarity skipped them), engagement = 100
  const engagementPct = totalQuestions > 0
    ? Math.round((answered.length / totalQuestions) * 100)
    : 100;

  const overall = Math.round(coverage.coverage_pct * 0.6 + engagementPct * 0.4);

  return {
    overall: Math.max(0, Math.min(100, overall)),
    coverage,
    engagement: {
      checks_answered: answered.length,
      checks_total: totalQuestions,
      engagement_pct: engagementPct,
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
  const coverage = getCoverage();

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

  // If no checks exist (high familiarity skipped them), engagement = 100
  const engagementPct = totalQuestions > 0
    ? Math.round((stats.answered / totalQuestions) * 100)
    : 100;

  const overall = Math.round(coverage.coverage_pct * 0.6 + engagementPct * 0.4);

  return {
    overall: Math.max(0, Math.min(100, overall)),
    coverage,
    engagement: {
      checks_answered: stats.answered,
      checks_total: totalQuestions,
      engagement_pct: engagementPct,
    },
    raw: {
      questions_total: totalQuestions,
      questions_passed: stats.passed,
      questions_skipped: stats.skipped,
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
    0,
    score.raw.chunks_total
  );
}
