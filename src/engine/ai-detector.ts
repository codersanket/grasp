export interface DetectionResult {
  probability: number;
  signals: string[];
}

export function isLikelyAIGenerated(code: string): DetectionResult {
  const signals: string[] = [];
  let score = 0;

  const lines = code.split("\n");
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);

  // Signal: Excessive inline comments (AI loves to comment everything)
  const commentLines = nonEmptyLines.filter(
    (l) => l.trim().startsWith("//") || l.trim().startsWith("#") || l.trim().startsWith("*")
  );
  const commentRatio = nonEmptyLines.length > 0 ? commentLines.length / nonEmptyLines.length : 0;
  if (commentRatio > 0.3) {
    signals.push("high_comment_ratio");
    score += 0.2;
  }

  // Signal: Generic variable names (data, result, response, item, temp, value)
  const genericNames = /\b(data|result|response|item|temp|value|output|input|obj|arr|res|req)\b/g;
  const genericMatches = code.match(genericNames);
  if (genericMatches && genericMatches.length > 5) {
    signals.push("generic_variable_names");
    score += 0.15;
  }

  // Signal: Consistent indentation (AI is very consistent)
  const indents = nonEmptyLines.map((l) => l.match(/^(\s*)/)?.[1]?.length ?? 0);
  const indentSet = new Set(indents.filter((i) => i > 0));
  if (indentSet.size <= 2 && nonEmptyLines.length > 10) {
    signals.push("uniform_indentation");
    score += 0.1;
  }

  // Signal: Try-catch wrapping everything
  const tryCatchCount = (code.match(/try\s*\{/g) || []).length;
  if (tryCatchCount > 2 && nonEmptyLines.length < 50) {
    signals.push("excessive_error_handling");
    score += 0.15;
  }

  // Signal: Console.log or print statements for debugging
  const debugStatements = (code.match(/console\.(log|debug|info)/g) || []).length;
  if (debugStatements > 3) {
    signals.push("debug_statements");
    score += 0.1;
  }

  // Signal: Long functions (AI tends to generate monolithic blocks)
  if (nonEmptyLines.length > 50) {
    const functionCount = (code.match(/(function |const \w+ = |=> \{)/g) || []).length;
    if (functionCount <= 1) {
      signals.push("monolithic_block");
      score += 0.15;
    }
  }

  // Signal: Boilerplate imports at top
  const importLines = lines.filter((l) => l.trim().startsWith("import "));
  if (importLines.length > 5 && nonEmptyLines.length < 30) {
    signals.push("heavy_imports_for_small_code");
    score += 0.1;
  }

  return {
    probability: Math.min(1, score),
    signals,
  };
}
