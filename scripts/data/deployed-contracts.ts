import { Address } from "viem";

export const CONTRACTS: {
  [key: string]: {
    question: Address | undefined;
    questionManager: Address | undefined;
    questionManagerImpl: Address | undefined;
  };
} = {
  luksoTestnet: {
    question: "0x0E8677B7E1d529a3c5CdCd17D79013A085625cC0",
    questionManager: "0xEeD3a236ba83E91f357C2c348384CbB91b331AD7",
    questionManagerImpl: "0x2C60D91cB3E4C6bb01b22be955f3a6c788Eb19cc",
  },
  luksoMainnet: {
    question: undefined,
    questionManager: undefined,
    questionManagerImpl: undefined,
  },
};
