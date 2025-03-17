const { BigNumber: bn } = require('bignumber.js');
const { ethers, BigNumber } = require("ethers");
const { logFatal, logSuccess, logDebug, logError, logTrace, logInfo } = require("./logging.js");
const { parseUnits } = require("@ethersproject/units");
const { ArbitrageRoutes} = require("./constants.js")

const {V2Pool, V3Pool} = require("./PoolsClasses.js");
const { sec, det } = require('mathjs');

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })
const match = (a, b, caseIncensitive = true) => {
    if (a === null || a === undefined) return false;
  
    if (Array.isArray(b)) {
      if (caseIncensitive) {
        return b.map((x) => x.toLowerCase()).includes(a.toLowerCase());
      }
  
      return b.includes(a);
    }
  
    if (caseIncensitive) {
      return a.toLowerCase() === b.toLowerCase();
    }
  
    return a === b;
  };
  
const sortTokens = (tokenA, tokenB) => {
    if (ethers.BigNumber.from(tokenA).lt(ethers.BigNumber.from(tokenB))) {
      return [tokenA, tokenB];
    }
    return [tokenB, tokenA];
  };
function fromReadableAmount(amount, decimals) {
    return ethers.utils.parseUnits(amount.toString(), decimals)
  };
  
function toReadableAmount(rawAmount, decimals) {
    return ethers.utils.formatUnits(rawAmount, decimals)
  };

// function encodePriceSqrt(reserveA, reserveB, tokenA, tokenB) { 
//     const [token0] = sortTokens(tokenA, tokenB);
//     let reserve1 = reserveA;
//     let reserve0 = reserveB;
//     if (match(token0, tokenA)) {
//         reserve0 = reserveA;
//         reserve1 = reserveB;
//     }
//     return BigNumber.from(
//         new bn(reserve1.toString()).div(reserve0.toString()).sqrt()
//         .multipliedBy(new bn(2).pow(96))
//         .integerValue(3)
//         .toString()
//     )
// }

//1 tokenA -> N tokenB
function convertSqrtPriceX96toInt(sqrtPriceX96, tokenAdecimals, tokenBdecimals, tokenA, tokenB) {
    const numerator = new bn(sqrtPriceX96.toString()).pow(2);
    const denominator = new bn(2).pow(192);
    const ratio = numerator.div(denominator);
    const decimalShift = new bn(10).pow(Number(tokenAdecimals) - Number(tokenBdecimals));
    const [token0] = sortTokens(tokenA, tokenB);
    if (token0 != tokenA) {
      return  decimalShift.div(ratio);
    }
    return ratio.multipliedBy(decimalShift);
};


const getUniv2PairAddress = (tokenA, tokenB) => {
    const [token0, token1] = sortTokens(tokenA, tokenB);
  
    const salt = ethers.utils.keccak256(token0 + token1.replace("0x", ""));
    const address = ethers.utils.getCreate2Address(
      "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
      salt,
      "0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f"
    );
  
    return [token0.toLowerCase(), token1.toLowerCase(), address.toLowerCase()];
};

const getUniv3PairAddress = (tokenA, tokenB, feeTier) => {
    const [token0, token1] = sortTokens(tokenA, tokenB);
    const encoded = ethers.utils.defaultAbiCoder.encode(['address', 'address', 'uint24'], [token0, token1, feeTier]);
    const salt = ethers.utils.keccak256(encoded);
    const address = ethers.utils.getCreate2Address(
        "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        salt,
        "0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54"
    );
    return [token0, token1, address];

};

//we can just add the specifier of the DEX in the file!
function determineDEX(poolsOnDEX, poolAddress) {
    for (let index = 0; index < poolAddress.length; ++index) {
        if (poolsOnDEX[index] == poolAddress) {
            if (index == 1 && poolsOnDEX[index].length == 1) return "Sushiswap";
            return "Uniswap";
        }
    }
    return "Uniswap";
}


async function getOptimalSwapRoute(transaction) {
    console.log("It gets inside the optimal route search");
    // const token0 = ethers.utils.getAddress(transaction.token0);
    // const token1 = ethers.utils.getAddress(transaction.token1);
    const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const notWETHToken = transaction.token0 == WETH ? transaction.token1.toLowerCase() : transaction.token0.toLowerCase();
    let poolsOnAllExchanges = [];
    if (ArbitrageRoutes.has(notWETHToken)) {
        poolsOnAllExchanges = ArbitrageRoutes.get(notWETHToken);
    } else {
        logError("Found no Pools On DEXes: ", notWETHToken);
        return null;
    }
    console.log("Target Pool on All Exchanges: ");
    console.log(poolsOnAllExchanges);
    let maxWETHReserve = ethers.BigNumber.from("0");
    const poolsInstances = [];
    let targetPool;


    if (transaction.version == "V2") {
        console.log("DEX: ", determineDEX(poolsOnAllExchanges, transaction.poolAddress));
        targetPool = await V2Pool.create(transaction.poolAddress, transaction.token0, transaction.token1, determineDEX(poolsOnAllExchanges, transaction.poolAddress));

        if (transaction.type == "In") {
            const updatedState = targetPool.getDataGivenIn(
                transaction.givenAmount,
                transaction.zeroForOne
            );
            [targetPool.reserveToken0, targetPool.reserveToken1] = transaction.zeroForOne ? [updatedState.newReserveA, updatedState.newReserveB] : [updatedState.newReserveB, updatedState.newReserveA];
        } else if (transaction.type == "Out") {
            const updatedState = targetPool.getDataGivenOut(
                transaction.givenAmount,
                transaction.zeroForOne
            );
            [targetPool.reserveToken0, targetPool.reserveToken1] = transaction.zeroForOne ? [updatedState.newReserveA, updatedState.newReserveB] : [updatedState.newReserveB, updatedState.newReserveA];
        }
        maxWETHReserve = targetPool.token0 == WETH ? targetPool.reserveToken0 : targetPool.reserveToken1;
        // blockchainState.push([targetPoolNewReserveOut, targetPoolNewReserveIn]);
    } else if (transaction.version == "V3") {

        //we just calculate the reserves of WETH in the target Pool
        targetPool = await V3Pool.create(transaction.poolAddress, transaction.token0, transaction.token1, transaction.feeTier, "Uniswap");
        const amountIn = BigInt(10**18) * BigInt(10**18);
        const zeroForOne = targetPool.token0 == WETH ? true : false;  // need to swap always WETH -> Token, to determine WETH reserves
        const result = await targetPool.executeSwap(amountIn, zeroForOne);

        console.log("AmountOut: ", result.amountOut);
        console.log("AmountUsed: ", result.amountUsed);

        maxWETHReserve = ethers.BigNumber.from(result.amountUsed.toString());  
        //assuming all transactions execute completely
    }

    const exchangeRates = [];
    let targetPoolExchangeRate = 0;
    for (let i = 0; i < poolsOnAllExchanges.length; ++i) {
        if (poolsOnAllExchanges[i] == transaction.poolAddress.toLowerCase() || poolsOnAllExchanges[i].length == 2 && poolsOnAllExchanges[i][0] == transaction.poolAddress.toLowerCase()) {
            if (poolsOnAllExchanges[i].length == 2) {

                //simulate target transaction, to update the state
                const result = transaction.type == "In" ? await targetPool.executeSwap(transaction.givenAmount, transaction.zeroForOne) : await targetPool.executeSwap(-transaction.givenAmount, transaction.zeroForOne);
                // blockchainState.push(targetPool);
                targetPoolExchangeRate = targetPool.getExchangeRate(result.newSqrtPriceX96, !transaction.zeroForOne);
                targetPool.updateStateLocaly(result.newSqrtPriceX96);
            
            } else {
                targetPoolExchangeRate = targetPool.getExchangeRate(!transaction.zeroForOne);
            }
            poolsInstances.push(targetPool);
            exchangeRates.push(targetPoolExchangeRate);
            continue;
        }


        if (poolsOnAllExchanges[i].length == 2) {

            //we just calculate the reserves of WETH in the Pool
            //maybe need to make more global, so to use for future swaps
            const v3Pool = await V3Pool.create(poolsOnAllExchanges[i][0], transaction.token0, transaction.token1, poolsOnAllExchanges[i][1], "Uniswap");
            poolsInstances.push(v3Pool);
            const amountIn = BigInt(maxWETHReserve.toString());
            const zeroForOne = v3Pool.token0 == WETH ? true : false; // need to always swap WETH -> Token
            const result = await v3Pool.executeSwap(amountIn, zeroForOne);

            if (result == 0n){ 
                exchangeRates.push(new bn(0));
                continue;
            }
            maxWETHReserve = (ethers.BigNumber.from(result.amountUsed.toString()) < maxWETHReserve) ? ethers.BigNumber.from(result.amountUsed.toString()) : maxWETHReserve;
            exchangeRates.push(v3Pool.getExchangeRate(v3Pool.slot0.sqrtPriceX96, transaction.zeroForOne));
        } else {
            const v2Pool = await V2Pool.create(poolsOnAllExchanges[i], transaction.token0, transaction.token1, determineDEX(poolsOnAllExchanges, poolsOnAllExchanges[i]));
            poolsInstances.push(v2Pool);
            maxWETHReserve = (v2Pool.token0 == WETH) ? ((v2Pool.reserveToken0 < maxWETHReserve) ? v2Pool.reserveToken0 : maxWETHReserve) : ((v2Pool.reserveToken1 < maxWETHReserve) ? v2Pool.reserveToken1 : maxWETHReserve);
            exchangeRates.push(v2Pool.getExchangeRate(transaction.zeroForOne));
        }
    }
    let maxExchangeRate = new bn(0);
    let potentialPool = "";
    logInfo("Exchange Rates: ");
    for (let i = 0; i < exchangeRates.length; i++) {
        console.log(exchangeRates[i].toString());
    }
    for (let i = 0; i < exchangeRates.length; ++i) {
        if (exchangeRates[i] == targetPoolExchangeRate) continue;
        const product = targetPoolExchangeRate.multipliedBy(exchangeRates[i]);
        if (product.gt(maxExchangeRate)) {
            potentialPool = poolsInstances[i];
            maxExchangeRate = product;
        }
    }
    console.log("Max Exchange Rate: ", maxExchangeRate.toString());
    if (maxExchangeRate.gt(0.99)) {

        if ((transaction.token0 == WETH) == transaction.zeroForOne) {
            return {
                "firstPool" : potentialPool,
                "secondPool" : targetPool,
                "WethReserve" : maxWETHReserve,
            };
        } else {
            return {
                "firstPool" : targetPool,
                "secondPool" : potentialPool,
                "WethReserve" : maxWETHReserve,
            };
        }
    }
    return null;

}

const toBytes32 = (text) => ethers.utils.formatBytes32String(text);

async function calculateOptimalAmountIn(swapRoute) {
    const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const firstPool = swapRoute.firstPool;
    const secondPool = swapRoute.secondPool;
    const zeroForOne = firstPool.token0 == WETH ? true : false;

    
    let leftBorder = ethers.BigNumber.from("0");
    let rightBorder = swapRoute.WethReserve;
    const precision = ethers.BigNumber.from("5000000000000");
    
    while (rightBorder.sub(leftBorder).gt(precision)) {
        
        const leftInputAmount = leftBorder.add((rightBorder.sub(leftBorder)).div(3));
        const rightInputAmount = rightBorder.sub((rightBorder.sub(leftBorder)).div(3));

        const [leftOutputAmount, rightOutputAmount] = await Promise.all([calculateOutputAmount(leftInputAmount, [firstPool, secondPool], zeroForOne, false), calculateOutputAmount(rightInputAmount, [firstPool, secondPool], zeroForOne, false)]);
        // const leftOutputAmount = await calculateOutputAmount(leftInputAmount, [firstPool, secondPool], zeroForOne);
        // const rightOutputAmount = await calculateOutputAmount(rightInputAmount, [firstPool, secondPool], zeroForOne);

        // console.log(" LeftProfit: ", leftOutputAmount.sub(leftInputAmount).toString());
        // console.log("RightProfit: ", rightOutputAmount.sub(rightInputAmount).toString());

        if ((rightOutputAmount.sub(rightInputAmount)).gte(leftOutputAmount.sub(leftInputAmount))) {
            leftBorder = leftInputAmount;
        } else {
            rightBorder = rightInputAmount;
        }
    }

    const optimalAmountIn = (rightBorder.add(leftBorder)).div(2);
    const outputAmounts = await calculateOutputAmount(optimalAmountIn, [firstPool, secondPool], zeroForOne, true);

    // console.log("Calculated maximised Output Amount: ", maxOutputAmount.toString());

    const profit = outputAmounts[1].sub(optimalAmountIn);
    const eth = new bn(10**18);
    console.log("Profit from that shit with slippage: ", new bn(profit.toString()).dividedBy(eth).toString());

    //TODO: Change output amounts to real ones!!!

    if (profit.gte(0)) {
        console.log("YYYYEEES");
        console.log({
            "amountIn" : optimalAmountIn,
            "swapData" : [{
                outputAmount : ethers.BigNumber.from("0"), 
                fee : firstPool.fee, 
                version : toBytes32(firstPool.version), 
                DEX : toBytes32(firstPool.DEX)
            }, 
            {
                outputAmount : ethers.BigNumber.from("0"), 
                fee : secondPool.fee, 
                version : toBytes32(secondPool.version), 
                DEX : toBytes32(secondPool.DEX)

            }],
            "notWETHToken" : zeroForOne == true ? ethers.utils.getAddress(firstPool.token1) : ethers.utils.getAddress(firstPool.token0)
        });
        return {
            "amountIn" : optimalAmountIn,
            "swapData" : [{
                outputAmount : ethers.BigNumber.from("0"), 
                fee : firstPool.fee, 
                version : toBytes32(firstPool.version), 
                DEX : toBytes32(firstPool.DEX)
            }, 
            {
                outputAmount : ethers.BigNumber.from("0"), 
                fee : secondPool.fee, 
                version : toBytes32(secondPool.version), 
                DEX : toBytes32(secondPool.DEX)

            }],
            "notWETHToken" : zeroForOne == true ? ethers.utils.getAddress(firstPool.token1) : ethers.utils.getAddress(firstPool.token0)
        }
    } else {
        console.log("Sucks to Suck");
        return ethers.BigNumber.from("0");
    }

}

async function calculateOutputAmount(amountIn, route, zeroForOne, shouldOutputAmounts = false) {
    const SLIPPAGE_BPS = 9950;
    const outputAmounts = [];
    for (let i = 0; i < route.length; ++i) {
        const pool = route[i];
        if (pool.version == "V2") {
            amountIn = pool.getDataGivenIn(amountIn, zeroForOne).amount;

        } else if (pool.version == "V3") {
            amountIn = (await pool.executeSwap(amountIn, zeroForOne)).amountOut;
        }
        outputAmounts.push(ethers.BigNumber.from(amountIn.toString()).mul(SLIPPAGE_BPS).div(10000));
        zeroForOne = !zeroForOne;
    }
    if (shouldOutputAmounts) {
        return outputAmounts;
    }
    return ethers.BigNumber.from(amountIn.toString());
}


module.exports = {
    // getUniv3ExchangeRate,
    getUniv2PairAddress,
    getUniv3PairAddress,
    // getUniv2Reserve,
    toReadableAmount,
    // calcOptimalAmountIn,
    // transactionWay,
    sortTokens,
    getOptimalSwapRoute,
    calculateOptimalAmountIn
};
//0x1f925e64b23697cf5723b16fc8d7276f20770c86
//0x615cc08df9084e3fac80fe19045a55612185b6a4
