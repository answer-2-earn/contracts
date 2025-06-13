import { Address } from "viem";

export const CONTRACTS: {
  [key: string]: {
    question: Address | undefined;
    questionManager: Address | undefined;
    questionManagerImpl: Address | undefined;
  };
} = {
  luksoTestnet: {
    question: "0x9B0A7945cae625db7C4f929bF00f74B2E807330d",
    questionManager: "0x5775e553Cb55844A068E1B78fD46AE1cF587AF20",
    questionManagerImpl: "0x0AE60415656dEF9C1e079bCc84443D282eDFD5ee",
  },
  luksoMainnet: {
    question: undefined,
    questionManager: undefined,
    questionManagerImpl: undefined,
  },
};
