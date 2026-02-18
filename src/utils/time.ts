export function getRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = Math.max(0, now - then);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
