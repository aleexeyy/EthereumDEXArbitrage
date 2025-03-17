// const {uniV2Decimals} = require("./UniswapV2/token_metadata.json");
// const {uniV3Decimals} = require("./UniswapV3/V3_token_metadata.json");
// const {sushiDecimals} = require("./SushiSwap/sushi_token_metadata.json");
const fs = require("fs");

const uniV2RawData = fs.readFileSync("./UniswapV2/uniswap_v2_weth_pairs.json", "utf8");
const uniV2Pairs = JSON.parse(uniV2RawData);

const uniV3RawData = fs.readFileSync("./UniswapV3/uniswap_v3_weth_pairs.json", "utf8");
const uniV3Pairs = JSON.parse(uniV3RawData);

const sushiRawData = fs.readFileSync("./SushiSwap/sushiswap_v2_weth_pairs.json", "utf8");
const sushiPairs = JSON.parse(sushiRawData);

function findInV3(tokenAddress) {
    const pools = [];
    let counter = 0;
    for (let pool of uniV3Pairs) {
        if (counter == 4) return pools;
        if (pool.otherTokenAddress == tokenAddress) {
            pools.push([pool.poolAddress, pool.fee]);
            counter++;
        }
    }
    return pools;
}

function main() {
    const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";


    const tokenToPoolsMap = new Map();
    uniV2Pairs.forEach(pool => {
        tokenToPoolsMap.set(pool.otherTokenAddress, [pool.poolAddress]);
    });

    const uniV2Map = new Map();
    uniV2Pairs.forEach(pool => {
        uniV2Map.set(pool.otherTokenAddress, pool.poolAddress);
    });


    const sushiMap = new Map();
    sushiPairs.forEach(pool => {
        sushiMap.set(pool.otherTokenAddress, pool.poolAddress);
    });

    
    for (let token of uniV2Map) {
        if (sushiMap.has(token[0])) {
            tokenToPoolsMap.set(token[0], [token[1], sushiMap.get(token[0])]);
        }
        let V3Pools = findInV3(token[0]);
        if (V3Pools.length > 0) {
            const otherPools = tokenToPoolsMap.get(token[0]);
            V3Pools = otherPools.concat(V3Pools);
            tokenToPoolsMap.set(token[0], V3Pools);
        }
    }
    
    for (let Pools of tokenToPoolsMap) {
        if (Pools[1].length == 1) { 
            tokenToPoolsMap.delete(Pools[0]);
        }
    }

    // console.log(tokenToPoolsMap);

    const mapToObject = Object.fromEntries(tokenToPoolsMap);
    try {
        fs.writeFileSync('../arb-config/token-to-pools.json', JSON.stringify(mapToObject, null, 2));
        console.log("Success!!");
    } catch(error) {
        console.log(error);
    }
}   

main();