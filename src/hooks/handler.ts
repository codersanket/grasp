import { getDatabase } from "../storage/db.js";
import { hasChunksForFile } from "../storage/queries.js";
import { trackInteraction } from "../engine/familiarity-tracker.js";

export interface HookEvent {
  session_id: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export interface HookResponse {
  continue: boolean;
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
  };
}

export function handleHookEvent(event: HookEvent): HookResponse {
  if (event.hook_event_name === "PreToolUse") {
    return handlePreToolUse(event);
  }

  if (event.hook_event_name === "PostToolUse") {
    return handlePostToolUse(event);
  }

  return { continue: true };
}

function handlePreToolUse(event: HookEvent): HookResponse {
  // Only check Write/Edit operations
  if (!event.tool_name || !["Write", "Edit"].includes(event.tool_name)) {
    return { continue: true };
  }

  // Check if grasp_start_task was called in a recent task
  const db = getDatabase();
  const recentTask = db
    .prepare(
      "SELECT id FROM tasks WHERE started_at > datetime('now', '-1 hour') ORDER BY started_at DESC LIMIT 1"
    )
    .get();

  if (!recentTask) {
    return {
      continue: true,
      systemMessage:
        "Reminder: Call grasp_start_task before generating code to capture intent and enable comprehension tracking.",
    };
  }

  return { continue: true };
}

function handlePostToolUse(event: HookEvent): HookResponse {
  if (!event.tool_name || !["Write", "Edit"].includes(event.tool_name)) {
    return { continue: true };
  }

  // Check if there are unquestioned chunks
  const db = getDatabase();
  const recentTask = db
    .prepare(
      "SELECT id FROM tasks WHERE started_at > datetime('now', '-1 hour') AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1"
    )
    .get() as { id: string } | undefined;

  if (!recentTask) return { continue: true };

  const uncheckChunks = db
    .prepare(
      `SELECT COUNT(*) as count FROM chunks c
       WHERE c.task_id = ?
       AND NOT EXISTS (SELECT 1 FROM checks ch WHERE ch.task_id = c.task_id)`
    )
    .get(recentTask.id) as { count: number };

  if (uncheckChunks.count > 2) {
    return {
      continue: true,
      systemMessage:
        "You've generated several code chunks without comprehension checks. Consider calling grasp_check to verify the developer understands the code.",
    };
  }

  // Track modifications to AI-generated files
  const filePath =
    (event.tool_input?.file_path as string) ??
    (event.tool_input?.path as string);

  if (filePath && hasChunksForFile(filePath)) {
    trackInteraction(filePath, "modified");
  }

  return { continue: true };
}
