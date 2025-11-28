# CryptoPolling

CryptoPolling delivers fully encrypted, time-bound polls on Ethereum Sepolia using Zama's FHEVM. Poll creators define 2–4 choices, opening and closing times, and control when tallies become public. Votes remain encrypted end-to-end, and results can only be decrypted after the creator finalizes the poll.

## Why It Matters
- Keeps voter choices confidential with FHE; no on-chain plaintext or early tally leakage.
- Enforces single-vote-per-address and honors poll schedules on-chain.
- Lets creators decide when results become public by explicitly finalizing polls.
- Anyone can independently decrypt finalized tallies via the Zama relayer flow—no trusted off-chain server.
- Ships with both a CLI (Hardhat tasks) and a polished dApp using the generated ABI; no mocks or placeholder data.

## Architecture & Tech
- **Smart contracts**: Solidity (`contracts/CryptoPolling.sol`) on Hardhat with `@fhevm/solidity` for encrypted counters and `hardhat-deploy` for repeatable deployments.
- **Off-chain crypto**: Zama relayer SDK for encrypted inputs, user decryption, and public decryptable outputs.
- **Frontend** (`app/`): React + Vite + TypeScript, RainbowKit/wagmi for wallet UX, `viem` for reads, `ethers` for writes, custom CSS (no Tailwind), and relayer-based encryption/decryption.
- **Tooling**: TypeScript-first Hardhat setup, coverage, linting, and TypeChain typings.
- **Artifacts**: Canonical ABI and address stored in `deployments/sepolia/CryptoPolling.json`; the frontend mirrors these values in `app/src/config/contracts.ts`.

## How It Works
1. **Create poll**: Creator sets a name, 2–4 options, start time, and end time. Contract initializes encrypted zero counters and allows the contract to update them.
2. **Cast vote**: User encrypts the chosen option index client-side (relayer) and submits `castVote`. The contract conditionally increments encrypted counts; duplicate voting is blocked.
3. **Wait for end**: Before `endTime`, tallies stay encrypted and non-decryptable.
4. **Finalize**: After `endTime`, the creator calls `finalizePoll`, marking counts as publicly decryptable.
5. **Decrypt**: Anyone can decrypt finalized counts via the dApp or Hardhat task; no private data is revealed before finalization.

## Repository Layout
- `contracts/` — CryptoPolling FHE contract.
- `deploy/` — Deployment script with `hardhat-deploy`.
- `deployments/sepolia/` — Deployed address and ABI (source of truth for the frontend).
- `tasks/` — CLI tasks to create polls, vote, decrypt, and read the address.
- `test/` — Contract tests using the FHE mock.
- `app/` — Vite React dApp (no environment variables; network pinned to Sepolia).

## Backend: Setup & Usage
Prerequisites: Node.js 20+, npm, and a funded Sepolia account for live deploys.

1) **Install dependencies**
```bash
npm install
```

2) **Environment variables (`.env`)**
```
PRIVATE_KEY=0xYourPrivateKey          # required for deploys; use a raw key, not a mnemonic
INFURA_API_KEY=yourInfuraKey          # required for Sepolia RPC
ETHERSCAN_API_KEY=optionalForVerify
```
`hardhat.config.ts` loads these via `dotenv`. Private key is the only supported signer secret; mnemonics are not used.

3) **Compile & test**
```bash
npm run compile
npm run test          # uses the FHE mock on the Hardhat network
npm run coverage      # optional
```

4) **Local iteration**
- Start a local node: `npm run chain`
- Deploy locally (in another terminal): `npm run deploy:localhost`

5) **Sepolia deployment**
```bash
npm run deploy:sepolia
# Optional verification after deployment
npm run verify:sepolia -- <contract-address>
```

6) **Hardhat tasks (examples)**
```bash
# Show deployed address (per network)
npx hardhat poll:address --network sepolia

# Create a poll (end time in unix seconds)
npx hardhat poll:create --network sepolia --name "Roadmap" --options "A,B,C" --end 1738368000

# Cast an encrypted vote for option index 1
npx hardhat poll:vote --network sepolia --poll 0 --choice 1

# Decrypt a finalized poll
npx hardhat poll:decrypt --network sepolia --poll 0
```

## Frontend dApp (`app/`)
- **Install & run**:
```bash
cd app
npm install
npm run dev -- --host --port 4173
```
- **Network**: preconfigured for Sepolia; no localhost RPC or env vars are used.
- **Contract config**: `app/src/config/contracts.ts` is synced from `deployments/sepolia/CryptoPolling.json`. After redeploying, copy the new address and ABI from `deployments/sepolia` into that file so reads (viem) and writes (ethers) stay aligned.
- **User flows**:
  - Connect wallet (RainbowKit), create polls with 2–4 options and time windows.
  - Vote with encrypted inputs via the Zama relayer SDK.
  - Creators finalize ended polls to make tallies public.
  - Anyone decrypts finalized counts in-session (no localstorage).

## Advantages
- **Confidential by design**: Encrypted vote storage and homomorphic increments prevent premature insights.
- **Deterministic control**: Only the creator can finalize; before that, counts stay non-decryptable.
- **Verifiable UX**: Both CLI tasks and the dApp rely on the same ABI and contract, ensuring consistent behavior.
- **Lean frontend**: Static network config, no environment variables, no Tailwind, and no mocked data.
- **Developer-ready**: TypeChain typings, relayer-integrated tasks, and coverage support accelerate iteration.

## Future Plans
- Rich results: charts, shareable permalinks, and historical poll views.
- Governance features: role-based creators, optional whitelists, and poll templates.
- Reliability: subgraph/indexer-backed lists and pagination for large poll sets.
- UX polish: mobile-responsive refinements, notifications for finalize/decrypt steps, and gas estimation hints.
- Security hardening: additional fuzzing, property-based tests, and per-network deployment checklists.

## License
BSD-3-Clause-Clear. See `LICENSE` for details.
