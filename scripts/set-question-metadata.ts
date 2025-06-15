import hre from "hardhat";
import { CONTRACTS } from "./data/deployed-contracts";
import ERC725 from "@erc725/erc725.js";
import { PinataSDK } from "pinata";

const CONFIG_METADATA = {
  LSP4Metadata: {
    name: "Question Token Collection",
    description: "A collection of tokens issued by the Answer 2 Earn project.",
    links: [
      {
        title: "Website",
        url: "https://answer-2-earn.vercel.app/",
      },
    ],
    images: [
      [
        {
          width: 256,
          height: 256,
          url: "ipfs://bafkreiahpktywfs64j6fpdu7cyl4yifj4ivxvudge3zuv7sga6qh3x7h74",
        },
      ],
    ],
  },
};

const CONFIG_METADATA_KEY =
  "0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e";

function getEncodedMetadataValue(metadata: object, url: string): `0x${string}` {
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
        json: metadata,
        url: url,
      },
    },
  ]);
  return encodedMetadata.values[0] as `0x${string}`;
}

async function uploadMetadataToIpfs(metadata: object): Promise<string> {
  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: "https://yellow-mute-echidna-168.mypinata.cloud/ipfs/",
  });
  const upload = await pinata.upload.public.json(metadata);
  return `ipfs://${upload.cid}`;
}

async function main() {
  console.log("Set question metadata...");

  // Get the contract address from the deployed contracts
  const network = hre.network.name;
  const contractAddress = CONTRACTS[network].questionManager;
  if (!contractAddress) {
    console.error(
      "QuestionManager contract address not found in deployed contracts"
    );
    return;
  }

  // Get the contract instance
  const contract = await hre.viem.getContractAt(
    "QuestionManager",
    contractAddress
  );

  // Upload metadata to IPFS
  const url = await uploadMetadataToIpfs(CONFIG_METADATA);
  console.log("Metadata URL:", url);

  // Encode metadata
  const metadataValue = getEncodedMetadataValue(CONFIG_METADATA, url);

  // Call the function on the contract
  await contract.write.setQuestionData([CONFIG_METADATA_KEY, metadataValue]);

  console.log("Metadata set");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
