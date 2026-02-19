import { getFamiliarity, updateFamiliarity } from "../storage/queries.js";

export type InteractionType =
  | "generated"
  | "questioned"
  | "answered_correctly"
  | "answered_incorrectly"
  | "modified"
  | "skipped"
  | "design_discussed";

const SCORE_DELTAS: Record<InteractionType, number> = {
  generated: 1,
  questioned: 3,
  answered_correctly: 5,
  answered_incorrectly: 1,
  modified: 4,
  skipped: -2,
  design_discussed: 4,
};

export function trackInteraction(filePath: string, interaction: InteractionType): void {
  const delta = SCORE_DELTAS[interaction];
  updateFamiliarity(filePath, delta);
}

export function getFileFamiliarity(
  filePaths: string[]
): Map<string, { score: number; interactions: number; lastSeen: string | null }> {
  const data = getFamiliarity(filePaths);
  const map = new Map<string, { score: number; interactions: number; lastSeen: string | null }>();

  for (const path of filePaths) {
    const entry = data.find((d) => d.file_path === path);
    map.set(path, {
      score: entry?.score ?? 0,
      interactions: entry?.interactions ?? 0,
      lastSeen: entry?.last_interaction ?? null,
    });
  }

  return map;
}

export function getAverageFamiliarity(filePaths: string[]): number {
  if (filePaths.length === 0) return 0;
  const map = getFileFamiliarity(filePaths);
  const scores = [...map.values()].map((v) => v.score);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
