import { ERC725 } from "@erc725/erc725.js";
import { Hex } from "viem";

export function getAskMetadataValue(): Hex {
  return getEncodedLSP4MetadataValue(
    {
      asker: "0x4018737e0D777b3d4C72B411a3BeEC286Ec5F5eF",
      question: "What is your dream?",
      questionDate: 1746028080,
      answerer: "0x2EC3af24fB102909f31535Ef0d825c8BFb873aB2",
    },
    "ipfs://ask"
  );
}

export function getAnswerMetadataValue(): Hex {
  return getEncodedLSP4MetadataValue(
    {
      answer: "To travel the world",
      answerDate: 1746028080,
    },
    "ipfs://answer"
  );
}

export function getEncodedLSP4MetadataValue(
  json: Record<string, any>,
  url: string
): Hex {
  const schema = [
    {
      name: "LSP4Metadata",
      key: "0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e",
      keyType: "Singleton",
      valueType: "bytes",
      valueContent: "VerifiableURI",
    },
  ];
  const erc725 = new ERC725(schema);
  const encodedMetadata = erc725.encodeData([
    {
      keyName: "LSP4Metadata",
      value: {
        json: json,
        url: url,
      },
    },
  ]);
  return encodedMetadata.values[0] as Hex;
}
