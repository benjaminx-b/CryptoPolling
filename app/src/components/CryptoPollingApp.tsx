import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";

import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../config/contracts";
import type { PollSummary } from "../types/poll";
import { mapPollSummary, resolvePollPhase } from "../utils/pollHelpers";
import { CreatePollForm } from "./CreatePollForm";
import { Header } from "./Header";
import { PollDetails } from "./PollDetails";
import { PollList } from "./PollList";

export function CryptoPollingApp() {
  const { address } = useAccount();
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);

  const {
    data: pollCount,
    refetch: refetchCount,
    isLoading: countLoading,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "pollCount",
  });

  const {
    data: pollSummariesData,
    refetch: refetchSummaries,
    isLoading: pollsLoading,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getPollSummaries",
    args: pollCount !== undefined ? [0n, pollCount] : undefined,
    query: {
      enabled: pollCount !== undefined,
    },
  });

  const polls: PollSummary[] = useMemo(() => {
    if (!pollSummariesData) return [];
    return (pollSummariesData as any[]).map(mapPollSummary);
  }, [pollSummariesData]);

  useEffect(() => {
    if (selectedPollId === null && polls.length > 0) {
      setSelectedPollId(polls[0].id);
    }
  }, [polls, selectedPollId]);

  const refreshPolls = async () => {
    await Promise.all([refetchCount(), refetchSummaries()]);
  };

  const totalPolls = pollCount !== undefined ? Number(pollCount) : 0;
  const finalizedPolls = polls.filter((poll) => resolvePollPhase(poll) === "finalized").length;
  const selectedPoll = polls.find((poll) => poll.id === selectedPollId) || null;

  return (
    <div className="app-shell">
      <Header pollCount={totalPolls} finalizedCount={finalizedPolls} />

      <div className="content-grid">
        <CreatePollForm onCreated={refreshPolls} />
        <PollList
          polls={polls}
          isLoading={pollsLoading || countLoading}
          selectedId={selectedPollId}
          onSelect={setSelectedPollId}
        />
      </div>

      <PollDetails
        pollId={selectedPollId}
        summary={selectedPoll}
        currentAddress={address}
        onChange={refreshPolls}
      />
    </div>
  );
}
