import { OpenSeaStreamClient } from "@opensea/stream-js";
import { WebSocket } from "ws";
import { LocalStorage } from "node-localstorage";
import fetch from "node-fetch";
import { NeynarAPIClient, isApiErrorResponse } from "@neynar/nodejs-sdk";
import "dotenv/config";

const CONTRACT_ADDRESS = "0x13dc8261fce63499aa25deb512bb1827b411b83b";
const COLLECTION_NAME = "swatches-by-jvmi";

// Validating necessary environment variables or configurations.
if (!process.env.SIGNER_UUID) {
  throw new Error("SIGNER_UUID is not defined");
}

// if (!process.env.NEYNAR_API_KEY) {
if (!process.env.NEYNAR_API_KEY) {
  throw new Error("NEYNAR_API_KEY is not defined");
}

if (!process.env.OS_STREAM_TOKEN) {
  throw new Error("OS_STREAM_TOKEN is not defined");
}

// const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);
const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

const client = new OpenSeaStreamClient({
  token: process.env.OS_STREAM_TOKEN,
  connectOptions: {
    transport: WebSocket,
    sessionStorage: LocalStorage,
  },
});

const publishCast = async (msg, tokenId) => {
  const embedUrl = {
    type: "url",
    url: `https://swatchesbotframe.vercel.app/api/dynamic-frame?contractAddress=${CONTRACT_ADDRESS}&tokenId=${tokenId}`,
  };
  try {
    let options;
    options = {
      embeds: [embedUrl],
    };
    // Using the neynarClient to publish the cast.
    const response = await neynarClient.publishCast(process.env.SIGNER_UUID, msg, options);
    console.log("Cast published successfully");
  } catch (err) {
    // Error handling, checking if it's an API response error.
    if (isApiErrorResponse(err)) {
      console.log(err.response.data);
    } else console.log(err);
  }
};
client.onItemSold(COLLECTION_NAME, async (event) => {
  let tokenId = Number(event.payload.item.nft_id.split("/", 3)[2]);
  const salePrice = Number(event.payload.sale_price) / 10 ** 18;

  await publishCast(
    `Swatches #${tokenId} sold for ${salePrice.toFixed(4)}${
      event.payload.payment_token.symbol
    }`,
    tokenId
  );
  console.log(
    `Swatches #${tokenId} SOLD for ${(
      Number(event.payload.sale_price) /
      10 ** 18
    ).toFixed(4)} -- ${getCurrentDateTimeCT()}`
  );
});

client.onItemListed(COLLECTION_NAME, async (event) => {
  let tokenId = Number(event.payload.item.nft_id.split("/", 3)[2]);
  const listPrice =  Number(event.payload.base_price) /
  10 ** 18

  await publishCast(
    `Swatches #${tokenId} listed for ${listPrice.toFixed(4)}${
        event.payload.payment_token.symbol
      }`,
    tokenId
  );

  console.log(
    `Swatches #${tokenId} listed for ${(
      Number(event.payload.base_price) /
      10 ** 18
    ).toFixed(4)}${
      event.payload.payment_token.symbol
    } -- ${getCurrentDateTimeCT()}`
  );
});

// Fetch price function
async function fetchPrice(tokenId) {
  if (Number(tokenId) % 50 === 0) {
    console.log((Number(tokenId) / 500) * 100 + "% done");
  }
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-api-key": "2cd45e1256034e6aab3ad85f98aa4d4b",
    },
  };

  try {
    const response = await fetch(
      `https://api.opensea.io/api/v2/orders/base/seaport/listings?asset_contract_address=${CONTRACT_ADDRESS}&limit=1&token_ids=${tokenId}`,
      options
    );
    const data = await response.json();
    if (data.orders.length > 0) {
      const price = Number(data.orders[0].current_price) / 10 ** 18;
      return { price: price, msg: `ID ${tokenId}: ${price}` };
    } else {
      return "NOT_LISTED";
    }
  } catch (error) {
    console.error(error);
    return `Error fetching price for token ID ${tokenId}`;
  }
}

// Utility function for delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to get current date and time in Central Time
function getCurrentDateTimeCT() {
  let currentDate = new Date();
  let options = {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true, // Use 12-hour format
  };

  let dateTimeString = currentDate.toLocaleString("en-US", options);

  return dateTimeString + " CT";
}
