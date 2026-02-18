#!/usr/bin/env tsx

/**
 * End-to-end test: runs the full Grasp flow in a single process.
 * Usage: tsx tests/e2e.ts
 */

import { createServer } from "../src/server.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

async function main() {
  console.log("\n  Grasp E2E Test — Full Flow\n");

  // Create server and client with in-memory transport
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  const client = new Client({ name: "e2e-test", version: "1.0" });
  await client.connect(clientTransport);

  // Step 1: Start a task
  console.log("  1. Starting task...");
  const startResult = await client.callTool({
    name: "grasp_start_task",
    arguments: {
      intent: "Add rate limiting middleware to the upload endpoint",
      files: ["src/middleware/rate-limit.ts"],
    },
  });
  const startData = JSON.parse((startResult.content as any)[0].text);
  console.log(`     Task ID: ${startData.task_id}`);
  console.log(`     Mode: ${startData.suggested_mode}`);
  assert(startData.task_id, "task_id should exist");
  assert(startData.suggested_mode, "suggested_mode should exist");

  // Step 2: Log a code chunk
  console.log("\n  2. Logging code chunk...");
  const chunkResult = await client.callTool({
    name: "grasp_log_chunk",
    arguments: {
      task_id: startData.task_id,
      code: `import { RateLimiterRedis } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_upload',
  points: 10,
  duration: 60,
  blockDuration: 120,
});

export async function rateLimitMiddleware(req, res, next) {
  try {
    const key = req.user?.id || req.ip;
    await rateLimiter.consume(key);
    next();
  } catch (rejRes) {
    res.status(429).json({ error: 'Too many requests' });
  }
}`,
      explanation:
        "Using sliding window via rate-limiter-flexible instead of fixed window because fixed windows allow burst traffic at boundaries. Key is per-user when authenticated, falling back to IP. blockDuration of 120s penalizes repeat offenders.",
      file_path: "src/middleware/rate-limit.ts",
    },
  });
  const chunkData = JSON.parse((chunkResult.content as any)[0].text);
  console.log(`     Chunk ID: ${chunkData.chunk_id}`);
  console.log(`     Logged: ${chunkData.logged}`);
  assert(chunkData.chunk_id, "chunk_id should exist");
  assert(chunkData.logged === true, "logged should be true");

  // Step 3: Generate comprehension questions
  // grasp_check returns plain text, not JSON
  console.log("\n  3. Generating comprehension questions...");
  const checkResult = await client.callTool({
    name: "grasp_check",
    arguments: { task_id: startData.task_id },
  });
  const checkText = (checkResult.content as any)[0].text as string;
  console.log(`     Response preview: ${checkText.substring(0, 100)}...`);

  // Extract check_ids from the plain text response
  const checkIdMatches = checkText.match(/\[check_id: ([^\]]+)\]/g);
  assert(checkIdMatches && checkIdMatches.length > 0, "should have at least 1 check_id");
  const checkIds = checkIdMatches!.map((m: string) => m.match(/\[check_id: ([^\]]+)\]/)![1]);
  console.log(`     Questions generated: ${checkIds.length}`);
  console.log(`     Check IDs: ${checkIds.join(", ")}`);

  // Step 4: Record an answer with quality evaluation
  console.log("\n  4. Recording answer...");
  const recordResult = await client.callTool({
    name: "grasp_record",
    arguments: {
      check_id: checkIds[0],
      answer:
        "Fixed windows allow burst traffic at the boundary — a user could make 10 requests at 0:59 and 10 more at 1:01. Sliding window prevents this by tracking the actual time window per request.",
      quality: "correct",
    },
  });
  const recordText = (recordResult.content as any)[0].text as string;
  console.log(`     Response: ${recordText}`);
  assert(recordText.length > 0, "should have a response message");

  // Step 5: Get score
  console.log("\n  5. Getting comprehension score...");
  const scoreResult = await client.callTool({
    name: "grasp_score",
    arguments: { task_id: startData.task_id },
  });
  const scoreData = JSON.parse((scoreResult.content as any)[0].text);
  console.log(`     Overall: ${scoreData.score}/100`);
  console.log(`     Breakdown:`);
  console.log(`       Quiz: ${scoreData.breakdown.quiz}%`);
  console.log(`       Review depth: ${scoreData.breakdown.review_depth}%`);
  console.log(`       Skip rate: ${scoreData.breakdown.skip_rate}% (inverse)`);
  assert(typeof scoreData.score === "number", "score should be a number");
  assert(scoreData.score >= 0 && scoreData.score <= 100, "score should be 0-100");

  // Step 6: Check context/familiarity
  // grasp_context returns plain text, not JSON
  console.log("\n  6. Checking familiarity...");
  const contextResult = await client.callTool({
    name: "grasp_context",
    arguments: { file_paths: ["src/middleware/rate-limit.ts"] },
  });
  const contextText = (contextResult.content as any)[0].text as string;
  console.log(`     Response: ${contextText.trim()}`);
  assert(contextText.includes("src/middleware/rate-limit.ts"), "should contain the file path");
  assert(contextText.includes("familiarity:"), "should contain familiarity score");

  console.log("\n  All 6 tools working. Grasp is operational.\n");

  await client.close();
  process.exit(0);
}

function assert(condition: any, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

main().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});
