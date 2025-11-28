import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "CryptoPolling",
  projectId: "a3f119b3b8b24c6d9e3d8d7cbdeb18aa",
  chains: [sepolia],
  ssr: false,
});
