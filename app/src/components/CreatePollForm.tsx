import { useState } from "react";
import { useAccount } from "wagmi";
import { Contract } from "ethers";

import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../config/contracts";
import { useEthersSigner } from "../hooks/useEthersSigner";
import { secondsFromNow } from "../utils/pollHelpers";

type CreatePollFormProps = {
  onCreated: () => Promise<void> | void;
};

const formatter = (input: number) => new Date(input * 1000).toISOString().slice(0, 16);

export function CreatePollForm({ onCreated }: CreatePollFormProps) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();

  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<string[]>(["Option one", "Option two"]);
  const [startTime, setStartTime] = useState(formatter(secondsFromNow(5)));
  const [endTime, setEndTime] = useState(formatter(secondsFromNow(65)));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddOption = () => {
    if (options.length >= 4) return;
    setOptions([...options, `Option ${options.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const parseToSeconds = (value: string) => Math.floor(new Date(value).getTime() / 1000);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean);
    const normalizedTitle = title.trim();
    const startSeconds = parseToSeconds(startTime);
    const endSeconds = parseToSeconds(endTime);

    if (trimmedOptions.length < 2 || trimmedOptions.length > 4) {
      setError("Please provide between 2 and 4 options.");
      return;
    }
    if (!normalizedTitle) {
      setError("Give your poll a title.");
      return;
    }
    if (Number.isNaN(startSeconds) || Number.isNaN(endSeconds)) {
      setError("Please provide valid start and end times.");
      return;
    }
    if (endSeconds <= startSeconds || endSeconds <= Math.floor(Date.now() / 1000)) {
      setError("End time must be after the start time and in the future.");
      return;
    }

    const signer = await signerPromise;
    if (!signer) {
      setError("Connect your wallet to create a poll.");
      return;
    }

    setIsSubmitting(true);
    try {
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.createPoll(normalizedTitle, trimmedOptions, startSeconds, endSeconds);
      await tx.wait();

      setSuccessMessage("Poll created successfully.");
      setTitle("");
      setOptions(["Option one", "Option two"]);
      setStartTime(formatter(secondsFromNow(5)));
      setEndTime(formatter(secondsFromNow(65)));
      await onCreated();
    } catch (err) {
      console.error(err);
      setError("Failed to create poll. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card">
      <div className="card-heading">
        <h3 className="card-title">Launch a new poll</h3>
        <span className="muted">2-4 options, encrypted tallies</span>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Title</label>
          <input
            className="text-input"
            placeholder="Which roadmap item should ship first?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label>Options</label>
          {options.map((option, index) => (
            <div key={index} className="option-row">
              <input
                className="text-input"
                value={option}
                onChange={(e) => {
                  const next = [...options];
                  next[index] = e.target.value;
                  setOptions(next);
                }}
                required
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => handleRemoveOption(index)}
                  aria-label="Remove option"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="small-button" onClick={handleAddOption} disabled={options.length >= 4}>
              + Add option
            </button>
            <span className="muted">Maximum of four choices to keep voting crisp.</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Start time</label>
            <input
              type="datetime-local"
              className="time-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>End time</label>
            <input
              type="datetime-local"
              className="time-input"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        {error ? (
          <div className="status-banner" style={{ borderColor: "rgba(255,118,118,0.45)", color: "#ffb5b5" }}>
            {error}
          </div>
        ) : null}
        {successMessage ? (
          <div className="status-banner" style={{ borderColor: "rgba(124,247,212,0.46)", color: "#7cf7d4" }}>
            {successMessage}
          </div>
        ) : null}
        {!address && <p className="hint">Connect your wallet to publish polls onchain.</p>}

        <div className="action-row">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Publishing..." : "Create poll"}
          </button>
        </div>
      </form>
    </div>
  );
}
