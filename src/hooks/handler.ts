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

  // Check if grasp_start_task was called in a recent task
  const db = getDatabase();
  const recentTask = db
    .prepare(
      "SELECT id FROM tasks WHERE replace(replace(started_at, 'T', ' '), 'Z', '') > datetime('now', '-1 hour') ORDER BY started_at DESC LIMIT 1"
    )
    .get();

  if (!recentTask) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        additionalContext:
          "Reminder: Call grasp_start_task before generating code to capture intent and enable comprehension tracking.",
      },
    };
  }

  return {};
}

function handlePostToolUse(event: HookEvent): HookResponse {
  if (!event.tool_name || !["Write", "Edit"].includes(event.tool_name)) {
    return {};
  }

  // Check if there are unquestioned chunks
  const db = getDatabase();
  const recentTask = db
    .prepare(
      "SELECT id FROM tasks WHERE replace(replace(started_at, 'T', ' '), 'Z', '') > datetime('now', '-1 hour') AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1"
    )
    .get() as { id: string } | undefined;

  if (!recentTask) return {};

  const uncheckChunks = db
    .prepare(
      `SELECT COUNT(*) as count FROM chunks c
       WHERE c.task_id = ?
       AND NOT EXISTS (SELECT 1 FROM checks ch WHERE ch.chunk_id = c.id)`
    )
    .get(recentTask.id) as { count: number };

  if (uncheckChunks.count > 2) {
    return {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext:
          "You've generated several code chunks without comprehension checks. Consider calling grasp_check to verify the developer understands the code.",
      },
    };
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
