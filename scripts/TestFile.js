
const abiDecoder = require("abi-decoder");
const { abi : IUniswapV2Router2} = require("./abi/UniswapV2Router2.json");
const { abi : IUniswapV2PairAbi} = require("./abi/UniswapV2Pair.json");
const { abi: IUniswapV4UniversalAbi} = require("./abi/UniswapV4UniversalRouter.json");
const {
    logDebug,
    logError,
    logFatal,
    logInfo,
    logSuccess,
    logTrace,
  } = require("./logging.js");
const { ethers, BigNumber } = require('ethers');
const { AbiCoder } = require("ethers/lib/utils.js");

const { rpcProvider } = require("./constants.js");

const {getUniv3PairAddress, getUniv2PairAddress} = require("./univ3.js");


abiDecoder.addABI(IUniswapV2Router2);
abiDecoder.addABI(IUniswapV2PairAbi);
abiDecoder.addABI(IUniswapV4UniversalAbi);
function decodeExecute(tx) {

    const txData = tx.data;
    let data = null;
    try {
        data = abiDecoder.decodeMethod(txData);
    } catch(e) {
        return null;
    }
    const commands = data.params[0].value.replace("0x", "");
    let swaps = [];
    for (let i = 0; i < commands.length; i+=2) {
        const current_command = commands.substring(i, i+2);
        const current_input = data.params[1].value[i/2];
        const decoded = decode_transaction(current_input, current_command);
        if (decoded) {
            swaps = swaps.concat(decoded);
        }
    }
    swaps.push({"deadline" : Number(data.params[2].value)});
    return swaps;


}

function decode_transaction(input, command) {
    // used for decoding bytecode for V3 swaps
    function decode_bytes(bytes) {
        bytes = bytes.substring(2, bytes.length);
        let i = 0;
        const pools = [];
        while (i < bytes.length) {
            const address = bytes.substring(i, i+40);
            pools.push("0x" + address);
            i += 40;
            if (i != bytes.length) {
                const fee = bytes.substring(i, i+6);
                pools.push(Number("0x" + fee));
                i += 6;
            }
        }
        const result = [];
        for (let i = 0; i < pools.length-2; i+=2) {
                const [token0, token1, poolAddress] = getUniv3PairAddress(pools[i], pools[i+2], pools[i+1]);
                const transaction_info = {
                    "poolAddress" : poolAddress,
                    "token0": token0,
                    "token1": token1,
                    "feeTier": pools[i+1],
                    "zeroForOne": (pools[i] === token0 ? true : false)
                };
                result.push(transaction_info);
        }
        return result;
    }
    const abiCoder = new AbiCoder();
    let decoded;
    let decoded_bytecode;
    let result = [];
    switch(command) {
        case "00":
            decoded = abiCoder.decode(['address', 'uint256', 'uint256', 'bytes', 'bool'], input);
            decoded_bytecode = decode_bytes(decoded[3]);
            for (let i = 0; i < decoded_bytecode.length; i++) {
                
                result.push({
                        "poolAddress" : decoded_bytecode[i].poolAddress,
                        "token0" : decoded_bytecode[i].token0,
                        "token1" : decoded_bytecode[i].token1,
                        "feeTier" : decoded_bytecode[i].feeTier,
                        "zeroForOne" : decoded_bytecode[i].zeroForOne,
                        "givenAmount" : (i == 0 ? decoded[1] : ethers.BigNumber.from("0")),
                        "version" : "V3",
                        "type" : "In"
                    });
            }
            break;
        case "01":
            decoded = abiCoder.decode(['address', 'uint256', 'uint256', 'bytes', 'bool'], input);
            decoded_bytecode = decode_bytes(decoded[3]);
            for (let i = 0; i < decoded_bytecode.length; i++) {
                
                result.push({
                        "poolAddress" : decoded_bytecode[i].poolAddress,
                        "token0" : decoded_bytecode[i].token0,
                        "token1" : decoded_bytecode[i].token1,
                        "feeTier" : decoded_bytecode[i].feeTier,
                        "zeroForOne" : decoded_bytecode[i].zeroForOne,
                        "givenAmount" : (i == (decoded_bytecode.length-3) ? decoded[1] : ethers.BigNumber.from("0")),
                        "version" : "V3",
                        "type" : "Out"
                    });
            }
        case "08":
            decoded = abiCoder.decode(["address", "uint256", "uint256", "address[]", "bool"], input);
            for (let i = 0; i < decoded[3].length-1; i++) {
                const [token0, token1, poolAddress] = getUniv2PairAddress(decoded[3][i], decoded[3][i+1]);
                
                result.push({
                        "poolAddress" : poolAddress,
                        "token0" : token0,
                        "token1" : token1,
                        "feeTier" : 3000,
                        "zeroForOne" : (decoded[3][i] == token0 ? true : false),
                        "givenAmount" : (i == 0 ? decoded[1] : ethers.BigNumber.from("0")),
                        "version" : "V2",
                        "type" : "In"
                });
            }
            break;
        case "09":
            decoded = abiCoder.decode(["address", "uint256", "uint256", "address[]", "bool"], input);
            for (let i = 0; i < decoded[3].length-1; i++) {
                    const [token0, token1, poolAddress] = getUniv2PairAddress(decoded[3][i], decoded[3][i+1]);
                    result.push({
                        "poolAddress" : poolAddress,
                        "token0" : token0,
                        "token1" : token1,
                        "feeTier" : 3000,
                        "zeroForOne" : (decoded[3][i] == token0 ? true : false),
                        "givenAmount" : (i == (decoded[3].length-2) ? decoded[1] : ethers.BigNumber.from("0")),
                        "version" : "V2",
                        "type" : "Out"
                    });
            }
            break;
        default:
            break;
    }
    return result;
}

module.exports = {
    decodeExecute
};
async function test1() {
    //0xc5b1c5f0cf6b34f97e3837ae2e92782b22a74ef192e85ab47aba67214419d1cc  - V2
    //0xc61bbb0a4028e36758ca0a7fae58133fac18bf37d66c47273ed6bd6ad9521731  - V3
    const txHash = "0xc5b1c5f0cf6b34f97e3837ae2e92782b22a74ef192e85ab47aba67214419d1cc";
    try {
        const tx = await rpcProvider.getTransaction(txHash);
        if (tx) {
            const result = await main(tx);

            console.log(result);
        } else {
            console.log('Transaction not found');
        }
    } catch(e) {
        console.error('Error fetching transaction:', e);
    }
}

// test1();