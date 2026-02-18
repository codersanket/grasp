#!/usr/bin/env node

import { handleHookEvent } from "../src/hooks/handler.js";

async function main(): Promise<void> {
  // Read JSON from stdin
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    process.exit(0);
  }

  try {
    const event = JSON.parse(input);
    const response = handleHookEvent(event);

    // Only write JSON if there's actual content for Claude Code
    if (response.hookSpecificOutput) {
      process.stdout.write(JSON.stringify(response));
    }

    process.exit(0);
  } catch (error) {
    // Exit 0 to not block the developer — log to stderr for verbose mode
    console.error("Grasp hook error:", error);
    process.exit(0);
  }
}

main();
