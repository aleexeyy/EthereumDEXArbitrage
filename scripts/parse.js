const abiDecoder = require("abi-decoder");
const { abi : IUniswapUniversalRouter} = require("./abi/UniswapUniversalRouter.json");
const { abi : IUniswapV2Router2} = require("./abi/UniswapV2Router2.json");
const { abi : IUniswapV2PairAbi} = require("./abi/UniswapV2Pair.json");
const {
    logDebug,
    logError,
    logFatal,
    logInfo,
    logSuccess,
    logTrace,
  } = require("./logging.js");
const { ethers, BigNumber } = require('ethers');
const {decodeExecute} = require('./decodeV3.js');
const {getUniv2PairAddress} = require("./univ3.js");
// abiDecoder.addABI(IUniswapUniversalRouter);
abiDecoder.addABI(IUniswapV2Router2);
abiDecoder.addABI(IUniswapV2PairAbi);

  
const parseUniV2 = async (tx) => {
    let data = null;
    const txData = tx.data;

    try {
        data = abiDecoder.decodeMethod(txData);
    } catch(e) {
        return null;
    }


    logInfo(data.name);
    let returned_answer = null;
    switch(data.name) {
        case "swapExactTokensForTokens":
            returned_answer = swapExactTokensForTokens(data.params);
            break;
        case "swapTokensForExactTokens":
            returned_answer = swapTokensForExactTokens(data.params);
            break;
        case "swapExactETHForTokens":
            returned_answer = swapExactETHForTokens(tx.value, data.params);
            break;
        case "swapTokensForExactETH":
            returned_answer = swapTokensForExactETH(data.params);
            break;
        case "swapExactTokensForETH":
            returned_answer = swapExactTokensForETH(data.params);
            break;
        case "swapETHForExactTokens":
            returned_answer = swapETHForExactTokens(data.params);
            break;
        case "swapExactTokensForTokensSupportingFeeOnTransferTokens":
            returned_answer = swapExactTokensForTokens(data.params);
            break;
        case "swapExactTokensForETHSupportingFeeOnTransferTokens":
            returned_answer = swapExactTokensForTokens(data.params);
            break;
        case "swapExactETHForTokensSupportingFeeOnTransferTokens":
            returned_answer = swapExactETHForTokensSupportingFeeOnTransferTokens(tx.value, data.params);
            break;
        case "execute":
            returned_answer = decodeExecute(tx);
            break;
    }

    return returned_answer;
    // logFatal("________________________________________________________________________________________|", "")
}

const swapETHForExactTokens = (data) => {
    let amountOut, path, to, deadline;
    try {
        [amountOut, path, to, deadline] = data.map((x) => x.value);
    } catch(e) {
        return null;
    }
    const result = [];
    for (let i = 0; i < path.length-1; i++) {
        const [token0, token1, poolAddress] = getUniv2PairAddress(path[i], path[i+1]);
        result.push({
            "poolAddress" : poolAddress,
            "token0" : token0,
            "token1" : token1,
            "feeTier" : 3000,
            "zeroForOne" : (path[i] == token0 ? true : false),
            "givenAmount" : (i == (path.length-2) ? ethers.BigNumber.from(amountOut) : ethers.BigNumber.from("0")),
            "version" : "V2",
            "type" : "Out"
        });
    }
    result.push({"deadline" : Number(deadline)});
    return result;
};
const swapExactTokensForTokens = (data) => {
    let amountIn, amountOutMin, path, to, deadline;
    try {
        [amountIn, amountOutMin, path, to, deadline] = data.map((x) => x.value);
    } catch(e) {
        return null;
    }
    const result = [];
    for (let i = 0; i < path.length-1; i++) {
        const [token0, token1, poolAddress] = getUniv2PairAddress(path[i], path[i+1]);
        result.push({
            "poolAddress" : poolAddress,
            "token0" : token0,
            "token1" : token1,
            "feeTier" : 3000,
            "zeroForOne" : (path[i] == token0 ? true : false),
            "givenAmount" : (i == 0 ? ethers.BigNumber.from(amountIn) : ethers.BigNumber.from("0")),
            "version" : "V2",
            "type" : "In"
        });
    }
    result.push({"deadline" : Number(deadline)});
    return result;
};
const swapTokensForExactTokens = (data) => {
    let amountOut, amountInMax, path, to, deadline;
    try {
        [amountOut, amountInMax, path, to, deadline] = data.map((x) => x.value);
    } catch(e) {
        return null;
    }
    const result = [];
    for (let i = 0; i < path.length-1; i++) {
        const [token0, token1, poolAddress] = getUniv2PairAddress(path[i], path[i+1]);
        result.push({
            "poolAddress" : poolAddress,
            "token0" : token0,
            "token1" : token1,
            "feeTier" : 3000,
            "zeroForOne" : (path[i] == token0 ? true : false),
            "givenAmount" : (i == (path.length-2) ? ethers.BigNumber.from(amountOut) : ethers.BigNumber.from("0")),
            "version" : "V2",
            "type" : "Out"
        });
    }
    result.push({"deadline" : Number(deadline)});
    return result;
};

const swapExactETHForTokens = (value, data) => {

    let amountOut, path, to, deadline;
    try {
        [amountOut, path, to, deadline] = data.map((x) => x.value);
    } catch(e) {
        return null;
    }
    const result = [];
    for (let i = 0; i < path.length-1; i++) {
        const [token0, token1, poolAddress] = getUniv2PairAddress(path[i], path[i+1]);
        result.push({
            "poolAddress" : poolAddress,
            "token0" : token0,
            "token1" : token1,
            "feeTier" : 3000,
            "zeroForOne" : (path[i] == token0 ? true : false),
            "givenAmount" : (i == 0 ? ethers.BigNumber.from(value) : ethers.BigNumber.from("0")),
            "version" : "V2",
            "type" : "In"
        });
    }
    result.push({"deadline" : Number(deadline)});
    return result;
};


const swapTokensForExactETH = (data) => {
    let amountOut, amountInMax, path, to, deadline;
    try {
        [amountOut, amountInMax, path, to, deadline] = data.map((x) => x.value);
    } catch(e) {
        return null;
    }
    const result = [];
    for (let i = 0; i < path.length-1; i++) {
        const [token0, token1, poolAddress] = getUniv2PairAddress(path[i], path[i+1]);
        result.push({
            "poolAddress" : poolAddress,
            "token0" : token0,
            "token1" : token1,
            "feeTier" : 3000,
            "zeroForOne" : (path[i] == token0 ? true : false),
            "givenAmount" : (i == (path.length-2) ? ethers.BigNumber.from(amountOut) : ethers.BigNumber.from("0")),
            "version" : "V2",
            "type" : "Out"
        });
    }
    result.push({"deadline" : Number(deadline)});
    return result;
};

const swapExactTokensForETH = (data) => {
    let amountIn, amountOutMin, path, to, deadline;
    try {
        [amountIn, amountOutMin, path, to, deadline] = data.map((x) => x.value);
    } catch(e) {
        return null;
    }
    const result = [];
    for (let i = 0; i < path.length-1; i++) {
        const [token0, token1, poolAddress] = getUniv2PairAddress(path[i], path[i+1]);
        result.push({
            "poolAddress" : poolAddress,
            "token0" : token0,
            "token1" : token1,
            "feeTier" : 3000,
            "zeroForOne" : (path[i] == token0 ? true : false),
            "givenAmount" : (i == 0 ? ethers.BigNumber.from(amountIn) : ethers.BigNumber.from("0")),
            "version" : "V2",
            "type" : "In"
        });
    }
    result.push({"deadline" : Number(deadline)});
    return result;
};

const swapExactETHForTokensSupportingFeeOnTransferTokens = (value, data) => {
    let amountOutMin, path, to, deadline;
    try {
        [amountOutMin, path, to, deadline] = data.map((x) => x.value);
    } catch(e) {
        return null;
    }
    const result = [];
    for (let i = 0; i < path.length-1; i++) {
        const [token0, token1, poolAddress] = getUniv2PairAddress(path[i], path[i+1]);
        result.push({
            "poolAddress" : poolAddress,
            "token0" : token0,
            "token1" : token1,
            "feeTier" : 3000,
            "zeroForOne" : (path[i] == token0 ? true : false),
            "givenAmount" : (i == 0 ? ethers.BigNumber.from(value) : ethers.BigNumber.from("0")),
            "version" : "V2",
            "type" : "In"
        });
    }
    result.push({"deadline" : Number(deadline)});
    return result;
}
module.exports = {
    parseUniV2,
};
