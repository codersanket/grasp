# Grasp Protocol

You have access to Grasp MCP tools. Follow these rules for every coding task.

**IMPORTANT: Do NOT use plan mode (EnterPlanMode) for coding tasks.** Grasp's `grasp_design_review` replaces plan mode — it captures design decisions in a database so they can be recalled later. If you enter plan mode first, you bypass Grasp's design capture entirely. Instead: call `grasp_start_task` → `grasp_design_review` (if guided) → then implement.

## Before Generating Code — REQUIRED
1. Call `grasp_start_task` with the developer's intent and involved files — this gives you familiarity context and a task ID

## Design Review — Before Writing Code — MANDATORY WHEN FAMILIARITY IS LOW
2. If start_task returns low familiarity (≤ 50), you MUST call `grasp_design_review` with the task_id. Do NOT write code until design review is complete.
3. When design review returns scopes: propose your approach, then ask ONE design question at a time
4. Wait for the developer to answer. Do NOT ask multiple design questions at once.
5. Call `grasp_record_design` with their response. Then ask the next design question and STOP.
6. After all design questions: proceed to implementation.
7. Design review questions should be deep and meaningful — ask about WHY, failure modes, debugging, and real consequences. Quality over quantity.

## While Generating Code — ALWAYS DO THIS
8. For each meaningful block of code, call `grasp_log_chunk` with the code AND a structured explanation in this EXACT format:
   ```
   WHAT: One-line summary of what this code does
   HOW:
     → Step one
     → Step two
     → Step three
   WHY: Why this approach was chosen over alternatives
   ```
   - The WHAT/HOW/WHY format is mandatory — do NOT write prose paragraphs.
   - A "block" = a function, middleware, schema change, config, or logical unit. Don't log single imports or one-line tweaks.
   - If you skipped `grasp_start_task`, omit `task_id` — a task will be auto-created

## After Generating Code
9. Call `grasp_check` after generating code.
   - If design review was completed → check is skipped automatically. Give a brief summary of what was built.
   - If NO design review → check will return comprehension questions. Ask them ONE at a time.
10. When `grasp_check` returns questions: ask ONLY the first question, then STOP your response completely.
11. When the developer answers, call `grasp_record` with the check_id and their answer. Then ask the next question and STOP again.
12. After all questions are answered, give a brief summary.

CRITICAL RULES:
- ALWAYS call `grasp_log_chunk` for every code block you generate. This is non-negotiable.
- ALWAYS call `grasp_check` after finishing code generation.
- When start_task indicates guided mode, you MUST call `grasp_design_review` BEFORE writing any code. Do NOT skip this.
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
