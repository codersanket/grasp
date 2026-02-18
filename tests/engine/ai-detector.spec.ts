import { describe, it, expect } from "vitest";
import { isLikelyAIGenerated } from "../../src/engine/ai-detector.js";

describe("AI Code Detector", () => {
  it("detects high comment ratio", () => {
    const code = `
// Initialize the database connection
const db = new Database();
// Set up WAL mode for better performance
db.pragma('journal_mode = WAL');
// Enable foreign keys
db.pragma('foreign_keys = ON');
// Create the tables
initSchema(db);
// Return the database instance
return db;
    `.trim();

    const result = isLikelyAIGenerated(code);
    expect(result.signals).toContain("high_comment_ratio");
    expect(result.probability).toBeGreaterThan(0);
  });

  it("detects generic variable names", () => {
    const code = `
function processData(data) {
  const result = data.map(item => {
    const value = item.response;
    const output = transform(value);
    const temp = validate(output);
    return { data: temp, result: output };
  });
  return result;
}
    `.trim();

    const result = isLikelyAIGenerated(code);
    expect(result.signals).toContain("generic_variable_names");
  });

  it("returns low probability for clean human code", () => {
    const code = `
export function calculateMonthlyInterest(principal: number, annualRate: number): number {
  const monthlyRate = annualRate / 12 / 100;
  return principal * monthlyRate;
}
    `.trim();

    const result = isLikelyAIGenerated(code);
    expect(result.probability).toBeLessThan(0.3);
  });

  it("detects excessive error handling", () => {
    const code = `
try {
  const user = await getUser(id);
  try {
    const profile = await getProfile(user.id);
    try {
      const settings = await getSettings(profile.id);
      return settings;
    } catch (e) { console.log(e); }
  } catch (e) { console.log(e); }
} catch (e) { console.log(e); }
    `.trim();

    const result = isLikelyAIGenerated(code);
    expect(result.signals).toContain("excessive_error_handling");
  });
});
