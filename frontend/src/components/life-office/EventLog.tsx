/** Mocked event feed. Mirrors what an append-only event stream would show. */

import type { LogEntry } from "./types";

export function EventLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) {
    return <div className="lo-stage-detail">아직 발생한 이벤트가 없습니다.</div>;
  }

  return (
    <ul className="lo-log">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className="lo-log-time">{entry.at}</span>
          <span
            className={
              entry.tone === "info"
                ? "lo-log-label"
                : `lo-log-label lo-log-${entry.tone}`
            }
          >
            {entry.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
