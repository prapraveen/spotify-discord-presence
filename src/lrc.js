const TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const MUSIC_NOTE = "♪";
const BREAK_GAP_MS = 8000;
const MAX_LINE_DISPLAY_MS = 5000;

export function parseLrc(input) {
  const lines = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(TIMESTAMP)];
    if (!timestamps.length) continue;
    const text = rawLine.replace(TIMESTAMP, "").trim() || MUSIC_NOTE;
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

export function addBreakMarkers(lines, durationMs) {
  if (!lines.length) return [];
  const timeline = [];
  if (lines[0].startMs >= BREAK_GAP_MS && lines[0].text !== MUSIC_NOTE) {
    timeline.push({ startMs: 0, text: MUSIC_NOTE });
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    timeline.push(line);
    if (
      next &&
      line.text !== MUSIC_NOTE &&
      next.text !== MUSIC_NOTE &&
      next.startMs - line.startMs >= BREAK_GAP_MS
    ) {
      timeline.push({ startMs: line.startMs + MAX_LINE_DISPLAY_MS, text: MUSIC_NOTE });
    }
  }

  const last = lines.at(-1);
  if (
    durationMs &&
    last.text !== MUSIC_NOTE &&
    durationMs - last.startMs >= BREAK_GAP_MS
  ) {
    timeline.push({ startMs: last.startMs + MAX_LINE_DISPLAY_MS, text: MUSIC_NOTE });
  }
  return timeline.sort((a, b) => a.startMs - b.startMs);
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
  let windowStart = index;
  if (count > 1 && lines[index].text !== MUSIC_NOTE) {
    let segmentStart = index;
    while (segmentStart > 0 && lines[segmentStart - 1].text !== MUSIC_NOTE) segmentStart -= 1;
    windowStart = segmentStart + Math.floor((index - segmentStart) / count) * count;
  }
  return {
    key: `${windowStart}:${count}`,
    lines: lines.slice(windowStart, windowStart + count).map((line) => line.text),
  };
}
