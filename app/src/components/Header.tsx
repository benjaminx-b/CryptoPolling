import { ConnectButton } from "@rainbow-me/rainbowkit";

type HeaderProps = {
  pollCount: number;
  finalizedCount: number;
};

export function Header({ pollCount, finalizedCount }: HeaderProps) {
  return (
    <div className="hero">
      <div className="hero-content">
        <div className="hero-text">
          <p className="pill live" style={{ width: "fit-content", marginBottom: 6 }}>
            Fully encrypted voting
          </p>
          <h1 className="hero-title">Crypto Polling with Zama FHE</h1>
          <p className="hero-subtitle">
            Create confidential polls, collect encrypted votes, and reveal results only when you decide.
            Built with ethers for writes and viem for reads, secured end-to-end by the Zama relayer.
          </p>
          <div className="hero-metrics">
            <span className="metric">Polls: {pollCount}</span>
            <span className="metric">Public results: {finalizedCount}</span>
          </div>
        </div>
        <ConnectButton />
      </div>
    </div>
  );
}
