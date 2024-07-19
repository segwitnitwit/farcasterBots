import fetch from "node-fetch";
import fs from "fs";
import { NeynarAPIClient, isApiErrorResponse } from "@neynar/nodejs-sdk";
import "dotenv/config";



// Validating necessary environment variables or configurations.
if (!process.env.SIGNER_UUID) {
  throw new Error("SIGNER_UUID is not defined");
}

if (!process.env.NEYNAR_API_KEY) {
  throw new Error("NEYNAR_API_KEY is not defined");
}

const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

console.log("UUID: " + process.env.SIGNER_UUID)

const publishCast = async (msg, type, id, block) => {
  const embedUrl = {
    type: "url",
    url: `https://hpunksframe.vercel.app/api/sale/${id}/${type}/${block}`,
  };
  try {
    let options;
    options = {
      embeds: [embedUrl],
    };
    if (
      type === "hoodie" ||
      type === "zombie" ||
      type === "ape" ||
      type === "alien"
    ) {
      options.channelId = "ham-punks";
    }
    // Using the neynarClient to publish the cast.
    await neynarClient.publishCast(
      process.env.SIGNER_UUID,
      msg,
      options
    );
    console.log("Cast published successfully");
  } catch (err) {
    // Error handling, checking if it's an API response error.
    if (isApiErrorResponse(err)) {
      console.log(err.response.data);
    } else console.log(err);
  }
};

// Utility function for delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const contracts = [
  { address: "0x3f6A1B1A0518C74f6E4AC1dF405d53bCa847c336", name: "floor" },
  { address: "0xe2b2BD6f6600c39E596fEFE2d6315F3897956b0d", name: "hoodie" },
  { address: "0x12c90d041035E49b052f0A13b9f655a1cA07dbeA", name: "zombie" },
  { address: "0xEd09AbFD8096B64A1695a12f3737FbB66214e76a", name: "ape" },
  { address: "0xFB0564B26c45fb8aBb768F27ea3724EffE827207", name: "red" }
//   { address: "0xB11b81143F5D6a7Ebecf664967281cf348636f6e", name: "alien" },
//   { address: "0xf88C2F983e1a4C9A01671965d458799bbbe04352", name: "eyes" },
//   { address: "0xd61EA851119eb8312f8fA3455a3f41277f7A748C", name: "hat" },
];

const fileNamePrefix = "lastAcceptBidTimestamp_";
const fileExtension = ".txt";

// Function to read the last acceptBid timestamp from file
function readLastAcceptBidTimestampFromFile(contractName) {
  const fileName = fileNamePrefix + contractName + fileExtension;
  try {
    const data = fs.readFileSync(fileName, "utf8");
    return data.trim(); // Trim to remove leading/trailing whitespace
  } catch (error) {
    console.error("Error reading last acceptBid timestamp from file:", error);
    return null;
  }
}

// Function to write the last acceptBid timestamp to file
function writeLastAcceptBidTimestampToFile(contractName, timestamp) {
  const fileName = fileNamePrefix + contractName + fileExtension;
  try {
    fs.writeFileSync(fileName, timestamp.toString());
    console.log(
      "Last Accept Bid Timestamp updated for " +
        contractName +
        ": " +
        timestamp +
        "\n"
    );
  } catch (error) {
    console.error(
      "Error writing last acceptBid timestamp to file for " +
        contractName +
        ":",
      error
    );
  }
}

// Function to make the GET request to the endpoint for a specific contract
async function fetchData(contract) {
  try {
    const response = await fetch(
      `https://ham.calderaexplorer.xyz/api/v2/addresses/${contract.address}/transactions`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching data for " + contract.name + ":", error);
    return null;
  }
}

// Function to fetch user data from the API using the owner address
async function fetchUserData(ownerAddress) {
  console.log("ADDRESS: " + ownerAddress);
  const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${ownerAddress}`;
  const headers = {
    accept: "application/json",
    api_key: process.env.NEYNAR_API_KEY,
  };

  console.log("URL: " + url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: headers,
    });

    const data = await response.json();
    // console.log("DATA: " + JSON.stringify(data))
    if (data.code && data.code === "NotFound") {
      return {};
    }
    return data;
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
}

const shortenAddress = (address) => {
  // Check if the input is a valid Ethereum address
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Invalid Ethereum address format");
  }

  // Shorten the address by taking the first 5 characters and the last 4 characters
  const shortenedAddress =
    address.substring(0, 6) + "..." + address.substring(address.length - 4);

  return shortenedAddress;
};

// Function to process the response data for a specific contract
async function processResponse(contract, data) {
  if (!data || !data.items || !Array.isArray(data.items)) {
    console.log("DATA: " + JSON.stringify(data));
    console.error("Invalid response format for " + contract.name);
    return;
  }

  // Get last acceptBid timestamp from file
  let lastAcceptBidTimestamp = readLastAcceptBidTimestampFromFile(
    contract.name
  );

  // Iterate through transactions in reverse chronological order
  for (let i = data.items.length - 1; i >= 0; i--) {
    const transaction = data.items[i];
    if (transaction.method === "acceptBid") {
      if (
        !lastAcceptBidTimestamp ||
        transaction.timestamp > lastAcceptBidTimestamp
      ) {
        lastAcceptBidTimestamp = transaction.timestamp;
        const tokenId = transaction.decoded_input.parameters.find(
          (param) => param.name === "tokenId"
        ).value;
        console.log(
          "New Accept Bid Method Call Detected for " + contract.name + ":"
        );
        console.log("Timestamp:", transaction.timestamp);
        console.log("Token ID:", tokenId);

        // Look for the next placeBid transaction
        const nextTransaction = data.items[i + 1];
        let value;
        if (nextTransaction && nextTransaction.method === "placeBid") {
          value = parseFloat(nextTransaction.value) / Math.pow(10, 18); // Convert value to Ether
          console.log("Sale Price for " + contract.name + ":" + value);
        }

        writeLastAcceptBidTimestampToFile(
          contract.name,
          lastAcceptBidTimestamp
        ); // Update timestamp in file
        // const dpunkInfo = await fetchDpunkInfo(tokenId);
        // const imgHash = dpunkInfo.previews.image_medium_url.split("/")[3];
        if (value !== undefined) {
          let fromUser = {};
          let toUser = {};

          fromUser = await fetchUserData(transaction.from.hash);
          toUser = await fetchUserData(nextTransaction.from.hash);

          let fromUserMsg = transaction.from.hash;
          let toUserMsg = nextTransaction.from.hash;

          let isFromUsername = false;
          let isToUsername = false;

          if (fromUser[transaction.from.hash.toLowerCase()]) {
            fromUserMsg =
              fromUser[transaction.from.hash.toLowerCase()][0].username;
            isFromUsername = true;
          }

          if (toUser[nextTransaction.from.hash.toLowerCase()]) {
            toUserMsg =
              toUser[nextTransaction.from.hash.toLowerCase()][0].username;
            isToUsername = true;
          }

          const msg = `hpunk #${tokenId} sold for ${value.toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 0,
              maximumFractionDigits: 6,
            }
          )} eth\n\nfrom: ${isFromUsername ? "@" : ""}${
            isFromUsername ? fromUserMsg : shortenAddress(fromUserMsg)
          }\nto: ${isToUsername ? "@" : ""}${
            isToUsername ? toUserMsg : shortenAddress(toUserMsg)
          }`;

          await publishCast(msg, contract.name, tokenId, transaction.block);
          // const publishCast = async (msg, imgHash, type, ownerAddr) => {
          break; // Exit loop since we found the most recent acceptBid
        }
      }
    }
  }
}

// Function to fetch data and process it periodically for a specific contract
async function fetchDataPeriodically(contract) {
  try {
    console.log("Fetching data for " + contract.name + "...");
    const data = await fetchData(contract);
    processResponse(contract, data);
  } catch (error) {
    console.error("Error fetching data for " + contract.name + ":", error);
  }
}

// Fetch data initially and periodically for each contract
contracts.forEach((contract) => {
  fetchDataPeriodically(contract);
  setInterval(() => fetchDataPeriodically(contract), 60 * 1000);
});