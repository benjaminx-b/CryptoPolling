import type { PollPhase, PollSummary } from "../types/poll";

export function mapPollSummary(entry: any): PollSummary {
  return {
    id: Number(entry.id ?? entry[0]),
    name: (entry.name ?? entry[1]) as string,
    options: (entry.options ?? entry[2]) as string[],
    startTime: Number(entry.startTime ?? entry[3]),
    endTime: Number(entry.endTime ?? entry[4]),
    creator: (entry.creator ?? entry[5]) as string,
    isPublic: Boolean(entry.isPublic ?? entry[6]),
  };
}

export function resolvePollPhase(poll: PollSummary): PollPhase {
  const now = Math.floor(Date.now() / 1000);

  if (poll.isPublic) {
    return "finalized";
  }

  if (now < poll.startTime) {
    return "upcoming";
  }

  if (now <= poll.endTime) {
    return "live";
  }

  return "ended";
}

export function formatTimestamp(value: number): string {
  return new Date(value * 1000).toLocaleString();
}

export function secondsFromNow(minutes: number): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}
