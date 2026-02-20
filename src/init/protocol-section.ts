/**
 * Replace or append the Grasp Protocol section in a markdown file.
 * Finds the `# Grasp Protocol` header and replaces from there to the next
 * top-level `# ` header (not `## `) or end of file.
 *
 * Returns null if the content is already up-to-date.
 */
export function upsertProtocolSection(
  existingContent: string,
  protocolContent: string
): { content: string; action: "created" | "updated" | "unchanged" } {
  const marker = "# Grasp Protocol";
  const markerIndex = existingContent.indexOf(marker);

  if (markerIndex === -1) {
    // Not present — append
    const prefix = existingContent.length > 0 ? existingContent.trimEnd() + "\n\n" : "";
    return { content: prefix + protocolContent + "\n", action: "created" };
  }

  // Find end of the Grasp section: next `\n# ` (h1) that isn't `\n## `
  const afterMarker = existingContent.substring(markerIndex + marker.length);
  const nextH1 = afterMarker.search(/\n# (?!#)/);

  const before = existingContent.substring(0, markerIndex).trimEnd();

  let newContent: string;
  if (nextH1 !== -1) {
    // Content exists after the Grasp section — preserve it
    const after = afterMarker.substring(nextH1);
    newContent = (before.length > 0 ? before + "\n\n" : "") + protocolContent + after;
  } else {
    // Grasp section goes to end of file
    newContent = (before.length > 0 ? before + "\n\n" : "") + protocolContent + "\n";
  }

  // Check if anything actually changed
  if (newContent.trim() === existingContent.trim()) {
    return { content: existingContent, action: "unchanged" };
  }

  return { content: newContent, action: "updated" };
}
