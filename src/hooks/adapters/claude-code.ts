export interface HookConfig {
  hooks: {
    PreToolUse?: Array<{
      matcher: string;
      hooks: Array<{
        type: "command";
        command: string;
        timeout: number;
      }>;
    }>;
    PostToolUse?: Array<{
      matcher: string;
      hooks: Array<{
        type: "command";
        command: string;
        timeout: number;
      }>;
    }>;
  };
}

export function generateHookConfig(graspHookPath: string): HookConfig {
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            {
              type: "command",
              command: graspHookPath,
              timeout: 10,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            {
              type: "command",
              command: graspHookPath,
              timeout: 10,
            },
          ],
        },
      ],
    },
  };
}
