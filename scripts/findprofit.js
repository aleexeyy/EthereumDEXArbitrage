const {
  logDebug,
  logError,
  logFatal,
  logInfo,
  logSuccess,
  logTrace,
} = require("./logging.js");
const {
    Contracts_Addresses, 
    wssProvider,
    rpcProvider,} = require('./constants.js');
const {parseUniV2} = require('./parse.js');
const { calculateOptimalAmountIn, getOptimalSwapRoute} = require('./univ3.js');
const {callArbitrageContract} = require("./interact.js");
const { ethers } = require("hardhat");


const decodeTransaction = async (txHash) => {
    const strLogPrefix = `txhash=${txHash}`;

    const [tx, txRecp] = await Promise.all([
        rpcProvider.getTransaction(txHash),
        rpcProvider.getTransactionReceipt(txHash),
    ]);
    // if (txRecp !== null) {
    //     console.log(`${strLogPrefix}: Transaction has been mined.`);
    //     return;
    // }

    if (tx === null) {
        return;
    }
    
    if (!Contracts_Addresses.includes(tx.to)) return;
    logTrace(txHash, "received");

    const start = performance.now();
    const decoded_transactions = await parseUniV2(tx);
    if (decoded_transactions == null || decoded_transactions == []) {
        logInfo("Transaction", "couldn't be decoded");
        return;
    }
    console.log("Decoded Transaction: ", decoded_transactions);
    // logInfo("Transaction", "has been decoded");
    const deadline = decoded_transactions[decoded_transactions.length-1].deadline;
    // if (new Date().getTime() / 1000 >= deadline) {
    //     logInfo("Transaction has been", "already mined");
    //     return;
    // }
    const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    for (let i = 0; i < decoded_transactions.length-1; ++i) {
        if (decoded_transactions[i].givenAmount.isZero()) continue;
        if (decoded_transactions[i].token0 != WETH && decoded_transactions[i].token1 != WETH) continue;
        let swapRoute;
        try {
            swapRoute = await getOptimalSwapRoute(decoded_transactions[i]);
        } catch(error) {
            logFatal("Got an eror in getOptimalSwapRoute: ", error);
        }
        if (swapRoute == null) continue;
        // console.log("swapRoute: ", swapRoute);

        const result = await calculateOptimalAmountIn(swapRoute);
        if (ethers.BigNumber.isBigNumber(result)) return;

        console.log(result.swapData[0].outputAmount);
        console.log(result.swapData[1].outputAmount);
        
        
        try {
            await callArbitrageContract(result.amountIn, result.notWETHToken, result.swapData);
        } catch(error) {
            logTrace(error);
        }

    }

    const end = performance.now();

    totalTime += (end-start);
    iterations++;
    logDebug(`\nAverage Execution Time: ${(totalTime/iterations).toFixed(2)} ms`);

}
let totalTime = 0;
let iterations = 0;
const main = async () => {
    const { default: PQueue } = await import('p-queue'); // Use default import for ESM compatibility
    const queue = new PQueue({ concurrency: 1 });
    wssProvider.on("pending", async (txHash) => {
        if (!txHash) {
            console.warn("Received invalid or undefined transaction hash. Skipping...");
            return;
        }
        queue.add(async () => {
            console.log(`Pending transaction detected: ${txHash}`);
            try {
                await decodeTransaction(txHash);
            } catch (error) {
                logFatal(`txhash=${txHash} error ${JSON.stringify(error)}`);
            }
            
        });
    });
};

main();
async function test() {
    //Transactions To Debug: 
    //0xa24c4ff6882255a171c97ef304e7d9c5ff53debcc738b68e93fa114a84d44e8f
    //0x4513b72456ca1ebabe79e677eede3ed084acd37a97ebfc9192c0af74a920aeb2
    //0x98fff8ec84c54f7553937f5cc64dc12e322b0655eea285257962352582841d4c
    const txHash = "0x3c33cd61d159302113d4e02b13c3f93a2d70f39aacc4527fb2afdceaee667e97";
    try {
        await decodeTransaction(txHash);
    } catch(e) {
        console.error('Error fetching transaction:', e);
    }

}
// test();
