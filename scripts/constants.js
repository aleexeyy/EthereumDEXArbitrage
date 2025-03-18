const dotenv = require('dotenv');
dotenv.config();
const { ethers } = require('ethers');
const { logError } = require('./logging.js');
const fs = require('fs');

const { abi : IUniswapUniversalRouter} = require("./abi/UniswapUniversalRouter.json");
const { abi : IUniswapV2Router2} = require("./abi/UniswapV2Router2.json");
const { abi : IUniswapV2PairAbi} = require("./abi/UniswapV2Pair.json");
const { abi: IUniswapV3PairAbi} = require("./abi/UniswapV3Pair.json");
const { abi : arbitrageABI }= require('./abi/ArbitrageContractABI.json');
const { abi: QuoterABI} = require("./abi/QuoterAbi.json");


//RPC ADDRESSES
const RPC_URL_WSS = process.env.RPC_URL_WSS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL_HTTPS = process.env.HTTPS_PROVIDER_ADDRESS;

const wssProvider = new ethers.providers.WebSocketProvider(RPC_URL_WSS);
const rpcProvider = new ethers.providers.JsonRpcProvider(RPC_URL_HTTPS);

// wssProvider.on("pending", (txHash) => {
//     console.log(`Pending transaction detected: ${txHash}`);
// });

// wssProvider._websocket.on("error", (error) => {
//     console.error("WebSocket error:", error);
// });

// wssProvider._websocket.on("close", () => {
//     console.error("WebSocket connection closed.");
// });

//CONTRACT ADDRESSES
const Contracts_Addresses = [// "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", // Universal Router
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
    "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af", // Uniswap V4 Router
    "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F" // Sushiswap V2 Router

    ];

// Routers: 
const QUOTER_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const WALLET_ADDRESS = "0x6998bdEe1A85Cd028B0a2F1f7C476Bb23643F347";
const ARBITRAGE_ADDRESS = "0x7C4BDA48bd4C9ac4FbcC60deEb66bf80d35705f0";


const searcherWallet = new ethers.Wallet(
    PRIVATE_KEY,
    wssProvider
);


const uniswapV3Pair = new ethers.Contract(
    ethers.constants.AddressZero,
    IUniswapV3PairAbi,
    rpcProvider
);


const local_provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
const ArbitrageContract = new ethers.Contract(ARBITRAGE_ADDRESS, arbitrageABI, local_provider);

//LOADING DATA
const jsonData1 = fs.readFileSync('./arb-config/token-to-pools.json', 'utf-8');
const DEXJson = JSON.parse(jsonData1);
const ArbitrageRoutes = new Map(Object.entries(DEXJson));


const jsonData2 = fs.readFileSync('./arb-config/token-decimals.json', 'utf-8');
const PoolsDecimals = JSON.parse(jsonData2);


console.log("Initiating the program");

module.exports = {
    uniswapV3Pair,
    IUniswapV2PairAbi,
    IUniswapUniversalRouter,
    IUniswapV2Router2,
    Contracts_Addresses, 
    rpcProvider,
    wssProvider,
    WALLET_ADDRESS,
    PoolsDecimals, 
    ArbitrageRoutes,
    rpcProvider,
    ArbitrageContract,

};