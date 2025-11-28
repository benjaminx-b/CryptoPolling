import { useEffect, useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { Contract } from "ethers";

import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../config/contracts";
import { useEthersSigner } from "../hooks/useEthersSigner";
import { useZamaInstance } from "../hooks/useZamaInstance";
import type { PollSummary } from "../types/poll";
import { formatTimestamp, mapPollSummary, resolvePollPhase } from "../utils/pollHelpers";

type PollDetailsProps = {
  pollId: number | null;
  summary: PollSummary | null;
  currentAddress?: `0x${string}`;
  onChange: () => Promise<void> | void;
};

export function PollDetails({ pollId, summary, currentAddress, onChange }: PollDetailsProps) {
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [decryptedCounts, setDecryptedCounts] = useState<number[] | null>(null);

  const { data: pollData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getPoll",
    args: pollId !== null ? [BigInt(pollId)] : undefined,
    query: {
      enabled: pollId !== null,
    },
  });

  const { data: hasVotedData, refetch: refetchVoteStatus } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "hasAddressVoted",
    args: pollId !== null && currentAddress ? ([BigInt(pollId), currentAddress] as const) : undefined,
    query: {
      enabled: pollId !== null && !!currentAddress,
    },
  });

  const { data: encryptedCounts, refetch: refetchCounts } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getEncryptedCounts",
    args: pollId !== null ? [BigInt(pollId)] : undefined,
    query: {
      enabled: pollId !== null,
    },
  });

  const poll = useMemo<PollSummary | null>(() => {
    if (pollData) return mapPollSummary(pollData);
    if (summary) return summary;
    return null;
  }, [pollData, summary]);

  const hasVoted = Boolean(hasVotedData);
  const phase = poll ? resolvePollPhase(poll) : "upcoming";

  const readyOptionIndex = selectedOption ?? (poll && poll.options.length > 0 ? 0 : null);

  useEffect(() => {
    setSelectedOption(null);
    setDecryptedCounts(null);
    setActionMessage(null);
  }, [pollId]);

  const handleVote = async () => {
    if (!poll || pollId === null) return;
    if (phase !== "live") {
      setActionMessage("Voting is not open for this poll.");
      return;
    }
    if (hasVoted) {
      setActionMessage("You already voted in this poll.");
      return;
    }
    if (readyOptionIndex === null) {
      setActionMessage("Select an option first.");
      return;
    }
    if (!instance || zamaError) {
      setActionMessage("Encryption service is not ready.");
      return;
    }
    const signer = await signerPromise;
    if (!signer || !currentAddress) {
      setActionMessage("Connect your wallet to vote.");
      return;
    }

    setIsVoting(true);
    setActionMessage(null);
    try {
      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, currentAddress)
        .add32(readyOptionIndex)
        .encrypt();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.castVote(pollId, encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      setActionMessage("Your vote was recorded.");
      await refetchVoteStatus?.();
      await onChange();
    } catch (err) {
      console.error(err);
      setActionMessage("Failed to cast vote. Please try again.");
    } finally {
      setIsVoting(false);
    }
  };

  const handleFinalize = async () => {
    if (!poll || pollId === null) return;
    if (phase !== "ended") {
      setActionMessage("Finalization is available after the end time.");
      return;
    }
    if (!currentAddress || currentAddress.toLowerCase() !== poll.creator.toLowerCase()) {
      setActionMessage("Only the poll creator can finalize results.");
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setActionMessage("Connect your wallet to finalize.");
      return;
    }

    setIsFinalizing(true);
    setActionMessage(null);
    try {
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.finalizePoll(pollId);
      await tx.wait();

      setActionMessage("Poll finalized and results are now decryptable.");
      setDecryptedCounts(null);
      await refetchCounts?.();
      await onChange();
    } catch (err) {
      console.error(err);
      setActionMessage("Unable to finalize right now.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const decryptResults = async () => {
    if (!poll || pollId === null) return;
    if (!poll.isPublic) {
      setActionMessage("Results are not public yet.");
      return;
    }
    if (!instance || zamaError) {
      setActionMessage("Encryption service is not ready.");
      return;
    }
    if (!currentAddress) {
      setActionMessage("Connect your wallet to decrypt.");
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setActionMessage("Signer unavailable.");
      return;
    }

    const ciphertexts = (encryptedCounts as string[] | undefined) ?? [];
    if (ciphertexts.length === 0) {
      setActionMessage("No counts available to decrypt.");
      return;
    }

    setIsDecrypting(true);
    setActionMessage(null);
    try {
      const keypair = instance.generateKeypair();
      const pairs = ciphertexts.map((handle) => ({
        handle,
        contractAddress: CONTRACT_ADDRESS,
      }));
      const startTime = Math.floor(Date.now() / 1000).toString();
      const durationDays = "7";
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTime, durationDays);

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        pairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        contractAddresses,
        currentAddress,
        startTime,
        durationDays,
      );

      const output = ciphertexts.map((cipher) => Number(result[cipher as string] ?? 0));
      setDecryptedCounts(output);
      setActionMessage("Results decrypted for your session.");
    } catch (err) {
      console.error(err);
      setActionMessage("Failed to decrypt results.");
    } finally {
      setIsDecrypting(false);
    }
  };

  if (pollId === null || !poll) {
    return (
      <div className="glass-card detail-card">
        <p className="empty-state">Select a poll to inspect details.</p>
      </div>
    );
  }

  return (
    <div className="glass-card detail-card">
      <div className="card-heading">
        <h3 className="card-title">{poll.name}</h3>
        <span className={`pill ${phase}`}>{resolvePollPhase(poll).toUpperCase()}</span>
      </div>
      <div className="tile-meta" style={{ marginBottom: 10 }}>
        <span>Created by: {poll.creator.slice(0, 6)}...{poll.creator.slice(-4)}</span>
        <span>Starts: {formatTimestamp(poll.startTime)}</span>
        <span>Ends: {formatTimestamp(poll.endTime)}</span>
      </div>

      {actionMessage ? (
        <div className="status-banner" style={{ marginBottom: 10 }}>
          {actionMessage}
        </div>
      ) : null}

      <h4 className="section-title">Options</h4>
      <div className="options-grid">
        {poll.options.map((option, index) => (
          <button
            key={option + index}
            className={`option-button ${readyOptionIndex === index ? "selected" : ""}`}
            onClick={() => setSelectedOption(index)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="action-row">
        <button
          className="primary-button"
          onClick={handleVote}
          disabled={isVoting || zamaLoading || phase !== "live"}
        >
          {isVoting ? "Submitting..." : "Submit encrypted vote"}
        </button>
        {hasVoted && <span className="muted">You already voted.</span>}
      </div>

      {phase === "ended" && !poll.isPublic && (
        <div className="status-banner">
          Voting has ended. The creator can finalize to unlock decryptable results.
          <br />
          <button
            className="ghost-button"
            onClick={handleFinalize}
            disabled={isFinalizing || !currentAddress || currentAddress.toLowerCase() !== poll.creator.toLowerCase()}
            style={{ marginTop: 10 }}
          >
            {isFinalizing ? "Finalizing..." : "Finalize results"}
          </button>
        </div>
      )}

      {poll.isPublic && (
        <div className="status-banner">
          Results are public. Anyone can decrypt the latest tally.
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="ghost-button" onClick={decryptResults} disabled={isDecrypting || zamaLoading}>
              {isDecrypting ? "Decrypting..." : "Decrypt results"}
            </button>
            <button
              className="ghost-button"
              onClick={() => setDecryptedCounts(null)}
              disabled={isDecrypting || decryptedCounts === null}
            >
              Clear decrypted data
            </button>
          </div>
        </div>
      )}

      {decryptedCounts && (
        <div>
          <h4 className="section-title">Tally</h4>
          <div className="result-grid">
            {poll.options.map((option, idx) => (
              <div key={option + idx} className="result-card">
                <div className="label">{option}</div>
                <div className="value">{decryptedCounts[idx] ?? 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
