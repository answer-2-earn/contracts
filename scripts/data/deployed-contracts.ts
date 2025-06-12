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
    questionManagerImpl: "0xacaB8f2Cc52471B03CbD29a41F5fBD6185Cf5A5E",
  },
  luksoMainnet: {
    question: undefined,
    questionManager: undefined,
    questionManagerImpl: undefined,
  },
};
