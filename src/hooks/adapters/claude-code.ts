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

export function generateHookConfig(): HookConfig {
  const command = "npx -y -p grasp-mcp grasp-hook";

  return {
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            {
              type: "command",
              command,
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
              command,
              timeout: 10,
            },
          ],
        },
      ],
    },
  };
}
