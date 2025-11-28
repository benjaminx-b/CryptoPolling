export type PollSummary = {
  id: number;
  name: string;
  options: string[];
  startTime: number;
  endTime: number;
  creator: string;
  isPublic: boolean;
};

export type PollPhase = "upcoming" | "live" | "ended" | "finalized";
