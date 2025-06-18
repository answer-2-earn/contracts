import { Address } from "viem";

export const CONTRACTS: {
  [key: string]: {
    question: Address | undefined;
    questionManager: Address | undefined;
    questionManagerImpl: Address | undefined;
  };
} = {
  luksoTestnet: {
    question: "0xCd0A759BdD491355E6d6Fdd6c83c2198a5Dcc299",
    questionManager: "0xd16b351c93f802135e34E065B53E5af400519bb0",
    questionManagerImpl: "0x64b98714fb8c448c1a8Ff982886F286464287f39",
  },
  luksoMainnet: {
    question: "0x67e3648A46f970f91D2989643bF8479b76795Bb2",
    questionManager: "0xe9b3E53Cd4f92DE36aF02e9B763c3Fe5eb02ee0C",
    questionManagerImpl: "0x1a477251Bc52F3Ef572A2668d073f315659eb2D2",
  },
};
