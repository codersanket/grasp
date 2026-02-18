import { getDatabase } from "../storage/db.js";

export interface LineageRecord {
  task_id: string;
  chunk_id: string;
  file_path: string;
  lines_start: number;
  lines_end: number;
  intent: string;
  created_at: string;
}

export function recordLineage(
  taskId: string,
  chunkId: string,
  filePath: string,
  linesStart: number,
  linesEnd: number
): void {
  const db = getDatabase();
  // Lineage data is stored in chunks table + tasks table
  // This function updates the chunk with file location data
  db.prepare(
    "UPDATE chunks SET file_path = ?, lines_start = ?, lines_end = ? WHERE id = ?"
  ).run(filePath, linesStart, linesEnd, chunkId);
}

export function getLineage(filePath: string, line?: number): LineageRecord[] {
  const db = getDatabase();

  if (line !== undefined) {
    return db
      .prepare(
        `SELECT c.task_id, c.id as chunk_id, c.file_path, c.lines_start, c.lines_end,
                t.intent, c.created_at
         FROM chunks c
         JOIN tasks t ON c.task_id = t.id
         WHERE c.file_path = ? AND c.lines_start <= ? AND c.lines_end >= ?
         ORDER BY c.created_at DESC`
      )
      .all(filePath, line, line) as LineageRecord[];
  }

  return db
    .prepare(
      `SELECT c.task_id, c.id as chunk_id, c.file_path, c.lines_start, c.lines_end,
              t.intent, c.created_at
       FROM chunks c
       JOIN tasks t ON c.task_id = t.id
       WHERE c.file_path = ?
       ORDER BY c.created_at DESC`
    )
    .all(filePath) as LineageRecord[];
}
