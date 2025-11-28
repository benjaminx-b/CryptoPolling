import type { PollSummary } from "../types/poll";
import { formatTimestamp, resolvePollPhase } from "../utils/pollHelpers";

type PollListProps = {
  polls: PollSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  isLoading: boolean;
};

const statusClass = {
  upcoming: "pill upcoming",
  live: "pill live",
  ended: "pill ended",
  finalized: "pill finalized",
};

const statusLabel = {
  upcoming: "Upcoming",
  live: "Live",
  ended: "Awaiting finalize",
  finalized: "Public",
};

export function PollList({ polls, selectedId, onSelect, isLoading }: PollListProps) {
  return (
    <div className="glass-card">
      <div className="card-heading">
        <h3 className="card-title">Open polls</h3>
        <span className="muted">{polls.length} listed</span>
      </div>

      {isLoading && <p className="muted">Loading polls...</p>}
      {!isLoading && polls.length === 0 && <p className="empty-state">No polls published yet.</p>}

      <div className="poll-list">
        {polls.map((poll) => {
          const phase = resolvePollPhase(poll);
          return (
            <div
              key={poll.id}
              className={`poll-tile ${selectedId === poll.id ? "active" : ""}`}
              onClick={() => onSelect(poll.id)}
            >
              <div className="tile-header">
                <h4 className="tile-title">{poll.name}</h4>
                <span className={statusClass[phase]}>{statusLabel[phase]}</span>
              </div>
              <div className="tile-meta">
                <span>{poll.options.length} choices</span>
                <span>Opens {formatTimestamp(poll.startTime)}</span>
                <span>Ends {formatTimestamp(poll.endTime)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
