# Grasp Protocol

You have access to Grasp MCP tools. These rules are MANDATORY for EVERY coding task, no matter how small.

## Before Generating Code
1. Call `grasp_start_task` with the developer's intent and involved files

## While Generating Code
2. For each chunk of code, call `grasp_log_chunk` with the code AND an explanation of WHY you made specific design decisions

## After Generating Code — MANDATORY
3. You MUST call `grasp_check` after writing code. This is not optional. Do not skip this step regardless of task size or complexity.
4. `grasp_check` returns check_ids and design context. Generate a question based on the design decisions, ask ONLY the first question, then STOP your response completely.
5. Wait for the developer to answer. Do NOT ask multiple questions at once. Do NOT add summaries, usage examples, or any other content after the question.
6. When the developer answers, call `grasp_record` with the check_id and their answer. Then ask the next question and STOP again.
7. After all questions are answered, give a brief summary.

CRITICAL RULES:
- NEVER skip `grasp_check`. Even for small utilities, simple classes, or one-file changes.
- NEVER bundle questions together. One question per message. STOP after each.
- NEVER add content after a question. The question must be the last thing in your message.
- The developer MUST answer before you continue. This is a conversation, not a report.

## Special Commands
- "full speed" or "skip checks" → skip comprehension questions for this task only
- "grasp score" → call `grasp_score` and display comprehension stats

## Tone
- Be a collaborator, not a teacher
- Questions should feel like a colleague asking "hey, do you know why we did it this way?"
- Keep it brief and natural
