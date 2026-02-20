import { getDatabase } from "../storage/db.js";
import { hasChunksForFile, getChunksByFilePath } from "../storage/queries.js";
import { trackInteraction } from "../engine/familiarity-tracker.js";
import { getRelativeTime } from "../utils/time.js";

export interface HookEvent {
  session_id: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export interface HookResponse {
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
    additionalContext?: string;
  };
}

export function handleHookEvent(event: HookEvent): HookResponse {
  if (event.hook_event_name === "PreToolUse") {
    return handlePreToolUse(event);
  }

  if (event.hook_event_name === "PostToolUse") {
    return handlePostToolUse(event);
  }

  return {};
}

function handlePreToolUse(event: HookEvent): HookResponse {
  // Only check Write/Edit operations
  if (!event.tool_name || !["Write", "Edit"].includes(event.tool_name)) {
    return {};
  }

  const db = getDatabase();
  const recentTask = db
    .prepare(
      "SELECT id, files FROM tasks WHERE replace(replace(started_at, 'T', ' '), 'Z', '') > datetime('now', '-1 hour') ORDER BY started_at DESC LIMIT 1"
    )
    .get() as { id: string; files: string | null } | undefined;

  if (!recentTask) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        additionalContext:
          "Reminder: Call grasp_log_chunk with explanation for each code block to capture design decisions.",
      },
    };
  }

  const chunkCount = (db
    .prepare("SELECT COUNT(*) as count FROM chunks WHERE task_id = ?")
    .get(recentTask.id) as { count: number }).count;

  const checkCount = (db
    .prepare("SELECT COUNT(*) as count FROM checks WHERE task_id = ?")
    .get(recentTask.id) as { count: number }).count;

  const designReviewCount = (db
    .prepare("SELECT COUNT(*) as count FROM design_reviews WHERE task_id = ?")
    .get(recentTask.id) as { count: number }).count;

  const reminders: string[] = [];

  // Chunks logged but no checks and no design reviews — remind about grasp_check
  if (chunkCount > 0 && checkCount === 0 && designReviewCount === 0) {
    reminders.push(
      `Reminder: Task ${recentTask.id} has ${chunkCount} code chunks logged but grasp_check has not been called. You MUST call grasp_check(task_id: "${recentTask.id}") after finishing code generation.`
    );
  }

  // No code yet, no design review, low familiarity — remind about design review
  if (chunkCount === 0 && designReviewCount === 0 && recentTask.files) {
    try {
      const filePaths: string[] = JSON.parse(recentTask.files);
      if (filePaths.length > 0) {
        const placeholders = filePaths.map(() => "?").join(",");
        const famRows = db
          .prepare(`SELECT score FROM familiarity WHERE file_path IN (${placeholders})`)
          .all(...filePaths) as { score: number }[];
        const avgFam = famRows.length > 0
          ? famRows.reduce((sum, r) => sum + r.score, 0) / famRows.length
          : 0;

        if (avgFam < 50) {
          reminders.push(
            `Reminder: Familiarity is low (${Math.round(avgFam)}/100). You should call grasp_design_review(task_id: "${recentTask.id}") before writing code.`
          );
        }
      }
    } catch {
      // Malformed files JSON — skip familiarity check
    }
  }

  if (reminders.length > 0) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        additionalContext: reminders.join("\n"),
      },
    };
  }

  return {};
}

function handlePostToolUse(event: HookEvent): HookResponse {
  if (!event.tool_name) return {};

  // Handle Read events — surface stored design context
  if (event.tool_name === "Read") {
    return handlePostRead(event);
  }

  if (!["Write", "Edit"].includes(event.tool_name)) {
    return {};
  }

  // Track modifications to AI-generated files
  const filePath =
    (event.tool_input?.file_path as string) ??
    (event.tool_input?.path as string);

  if (filePath && hasChunksForFile(filePath)) {
    trackInteraction(filePath, "modified");
  }

  return {};
}

function handlePostRead(event: HookEvent): HookResponse {
  const filePath =
    (event.tool_input?.file_path as string) ??
    (event.tool_input?.path as string);

  if (!filePath || !hasChunksForFile(filePath)) {
    return {};
  }

  const chunks = getChunksByFilePath([filePath]);
  if (chunks.length === 0) return {};

  const lines = [`Grasp context for ${filePath}:`];
  for (const chunk of chunks) {
    const age = getRelativeTime(chunk.created_at);
    lines.push(`  - "${chunk.explanation}" (${age})`);
  }

  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: lines.join("\n"),
    },
  };
}

