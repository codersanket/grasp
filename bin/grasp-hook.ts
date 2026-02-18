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

    if (response.systemMessage || response.hookSpecificOutput) {
      process.stdout.write(JSON.stringify(response));
    }

    process.exit(0);
  } catch (error) {
    // Non-blocking error — don't disrupt the developer's workflow
    console.error("Grasp hook error:", error);
    process.exit(1);
  }
}

main();
