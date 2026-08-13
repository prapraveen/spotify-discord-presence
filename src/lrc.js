const TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(input) {
  const lines = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(TIMESTAMP)];
    if (!timestamps.length) continue;
    const text = rawLine.replace(TIMESTAMP, "").trim();
    if (!text) continue;
    for (const match of timestamps) {
      const fraction = (match[3] || "0").padEnd(3, "0").slice(0, 3);
      lines.push({
        startMs: Number(match[1]) * 60_000 + Number(match[2]) * 1000 + Number(fraction),
        text,
      });
    }
  }
  return lines.sort((a, b) => a.startMs - b.startMs);
}

export function activeLineIndex(lines, progressMs) {
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle].startMs <= progressMs) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}

export function lyricWindow(lines, progressMs, count = 2) {
  const index = activeLineIndex(lines, progressMs);
  if (index < 0) return { key: "waiting", lines: [] };
  const windowStart = Math.floor(index / count) * count;
  return {
    key: `${windowStart}:${count}`,
    lines: lines.slice(windowStart, windowStart + count).map((line) => line.text),
  };
}
