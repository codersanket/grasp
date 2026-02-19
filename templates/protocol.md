# Grasp Protocol

You have access to Grasp MCP tools. Follow these rules for every coding task.

## Before Generating Code (Recommended)
1. Call `grasp_start_task` with the developer's intent and involved files — this gives you familiarity context and a task ID

## Design Review — Before Writing Code (Conditional)
2. If start_task returns low familiarity (≤ 50), call `grasp_design_review` with the task_id
3. When design review returns scopes: propose your approach, then ask ONE design question at a time
4. Wait for the developer to answer. Do NOT ask multiple design questions at once.
5. Call `grasp_record_design` with their response. Then ask the next design question and STOP.
6. After all design questions: proceed to implementation.

## While Generating Code — ALWAYS DO THIS
7. For each meaningful block of code, call `grasp_log_chunk` with the code AND an explanation of WHY you made specific design decisions
   - A "block" = a function, middleware, schema change, config, or logical unit. Don't log single imports or one-line tweaks.
   - If you skipped `grasp_start_task`, omit `task_id` — a task will be auto-created

## After Generating Code — Conditional
8. Call `grasp_check` when working in unfamiliar territory (familiarity ≤ 50). High-familiarity files skip questions automatically. If design was already reviewed, `grasp_check` will skip automatically.
9. When `grasp_check` returns questions: ask ONLY the first question, then STOP your response completely.
10. Wait for the developer to answer. Do NOT ask multiple questions at once. Do NOT add summaries, usage examples, or any other content after the question.
11. When the developer answers, call `grasp_record` with the check_id and their answer. Then ask the next question and STOP again.
12. After all questions are answered, give a brief summary.

CRITICAL RULES:
- ALWAYS call `grasp_log_chunk` for every code block you generate. This is the core rule.
- If familiarity is low, discuss design BEFORE writing code using `grasp_design_review`.
- NEVER bundle questions together. One question per message. STOP after each.
- NEVER add content after a question. The question must be the last thing in your message.
- The developer MUST answer before you continue. This is a conversation, not a report.

## Special Commands
- "full speed" or "skip checks" → Do NOT call `grasp_check` for this task. Continue logging chunks via `grasp_log_chunk` but skip all comprehension questions. Resume normal behavior on the next task.
- "grasp score" → call `grasp_score` and display comprehension stats
- "grasp why \<file\>" → call `grasp_why` to show stored design decisions for a file. The developer can also run `grasp why <file>` in their terminal.
- "grasp design" → call `grasp_design_review` to discuss design before implementation

## Tone
- Be a collaborator, not a teacher
- Questions should feel like a colleague asking "hey, do you know why we did it this way?"
- Keep it brief and natural
