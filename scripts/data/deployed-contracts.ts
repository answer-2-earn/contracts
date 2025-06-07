import { Address } from "viem";

export const CONTRACTS: {
  [key: string]: {
    question: Address | undefined;
  };
} = {
  luksoTestnet: {
    question: "0x4eca13c538d53b9adecf872c66a4db6ff98b0074",
  },
  luksoMainnet: {
    question: "0xf81abf7d2d09369cda771f4b432ef01e75576759",
  },
};
