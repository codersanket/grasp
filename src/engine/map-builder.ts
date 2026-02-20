import type { FileStats } from "../storage/queries.js";

// ── ANSI Colors ───────────────────────────────────────────

const ANSI = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function colorize(text: string, score: number, color: boolean): string {
  if (!color) return text;
  if (score <= 30) return `${ANSI.red}${text}${ANSI.reset}`;
  if (score <= 60) return `${ANSI.yellow}${text}${ANSI.reset}`;
  return `${ANSI.green}${text}${ANSI.reset}`;
}

function dim(text: string, color: boolean): string {
  if (!color) return text;
  return `${ANSI.dim}${text}${ANSI.reset}`;
}

function bold(text: string, color: boolean): string {
  if (!color) return text;
  return `${ANSI.bold}${text}${ANSI.reset}`;
}

// ── Familiarity Bar ───────────────────────────────────────

function familiarityBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

// ── Tree Building ─────────────────────────────────────────

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  file?: FileStats;
}

function buildTree(files: FileStats[]): TreeNode {
  const root: TreeNode = { name: "", children: new Map() };

  for (const file of files) {
    const parts = file.file_path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current.children.has(part)) {
        current.children.set(part, { name: part, children: new Map() });
      }
      current = current.children.get(part)!;

      if (i === parts.length - 1) {
        current.file = file;
      }
    }
  }

  return root;
}

// Collapse single-child directories: a/ -> b/ -> c/ becomes a/b/c/
function collapseTree(node: TreeNode): TreeNode {
  // Process children first
  const newChildren = new Map<string, TreeNode>();
  for (const [key, child] of node.children) {
    newChildren.set(key, collapseTree(child));
  }
  node.children = newChildren;

  // Collapse: if this node has exactly one child and no file, merge with child
  if (node.children.size === 1 && !node.file) {
    const [childKey, child] = [...node.children.entries()][0];
    if (!child.file) {
      // Merge directory names
      const merged: TreeNode = {
        name: node.name ? `${node.name}/${childKey}` : childKey,
        children: child.children,
        file: child.file,
      };
      return merged;
    }
  }

  return node;
}

// ── Tree Rendering ────────────────────────────────────────

interface RenderOptions {
  color: boolean;
}

function renderTree(node: TreeNode, prefix: string, isLast: boolean, opts: RenderOptions, isRoot: boolean): string[] {
  const lines: string[] = [];
  const entries = [...node.children.entries()];

  for (let i = 0; i < entries.length; i++) {
    const [, child] = entries[i];
    const last = i === entries.length - 1;
    const connector = isRoot ? "" : (last ? "└── " : "├── ");
    const nextPrefix = isRoot ? "  " : prefix + (last ? "    " : "│   ");

    if (child.file) {
      // File leaf — render with bar + score + chunk count
      const f = child.file;
      const bar = familiarityBar(f.familiarity);
      const score = `${f.familiarity}/100`;
      const chunks = `(${f.chunk_count} chunk${f.chunk_count !== 1 ? "s" : ""})`;
      const coloredBar = colorize(bar, f.familiarity, opts.color);
      const coloredScore = colorize(score, f.familiarity, opts.color);
      lines.push(`${prefix}${connector}${child.name}  ${coloredBar} ${coloredScore}  ${dim(chunks, opts.color)}`);
    } else {
      // Directory node
      const dirName = child.name.endsWith("/") ? child.name : child.name + "/";
      lines.push(`${prefix}${connector}${bold(dirName, opts.color)}`);
      lines.push(...renderTree(child, nextPrefix, last, opts, false));
    }
  }

  return lines;
}

// ── Sort ──────────────────────────────────────────────────

function sortFiles(files: FileStats[], sortBy: string): FileStats[] {
  const sorted = [...files];
  switch (sortBy) {
    case "score":
      sorted.sort((a, b) => a.familiarity - b.familiarity);
      break;
    case "recent":
      sorted.sort((a, b) => b.last_generated.localeCompare(a.last_generated));
      break;
    case "name":
    default:
      sorted.sort((a, b) => a.file_path.localeCompare(b.file_path));
      break;
  }
  return sorted;
}

// ── Public API ────────────────────────────────────────────

export interface MapOptions {
  sort?: string;
  color?: boolean;
}

export function buildMap(files: FileStats[], opts: MapOptions = {}): string {
  const color = opts.color !== false;
  const sortBy = opts.sort ?? "name";

  const sorted = sortFiles(files, sortBy);
  const tree = collapseTree(buildTree(sorted));
  const lines = renderTree(tree, "  ", true, { color }, true);

  // Summary stats
  const avgFamiliarity = Math.round(sorted.reduce((sum, f) => sum + f.familiarity, 0) / sorted.length);
  const needAttention = sorted.filter((f) => f.familiarity < 30).length;

  const output = [
    "",
    `  ${bold("Grasp — Codebase Familiarity Map", color)}`,
    "",
    ...lines,
    "",
    dim(`  ${sorted.length} AI-generated files | Avg familiarity: ${avgFamiliarity}/100 | ${needAttention} file${needAttention !== 1 ? "s" : ""} need attention (< 30)`, color),
    "",
  ];

  return output.join("\n");
}

// Plain text version for MCP tool (no ANSI)
export function buildMapPlain(files: FileStats[]): string {
  return buildMap(files, { color: false, sort: "name" });
}
