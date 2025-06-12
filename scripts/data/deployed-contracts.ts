import { Address } from "viem";

export const CONTRACTS: {
  [key: string]: {
    question: Address | undefined;
    questionManager: Address | undefined;
    questionManagerImpl: Address | undefined;
  };
} = {
  luksoTestnet: {
    question: "0xA958c128203d2671636f8820E943640A097e6A60",
    questionManager: "0xEDe254159220fEE61bC83FDa5A9f1EA5b510472e",
    questionManagerImpl: "0x7e303efc29e24e5CD8dC619976C0599e4a17E46e",
  },
  luksoMainnet: {
    question: undefined,
    questionManager: undefined,
    questionManagerImpl: undefined,
  },
};
