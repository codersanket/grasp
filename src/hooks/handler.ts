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
          "Reminder: Call grasp_log_chunk with explanation for each code block to capture design decisions.",
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

