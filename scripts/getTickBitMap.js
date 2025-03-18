
const { ethers, BigNumber } = require('ethers');
const {rpcProvider} = requrie("./constants.js");
class Ticks {

    static MIN_TICK = -887272n;
    static MAX_TICK = -this.MIN_TICK;


    static async getEfficientTickBitmap(poolAddress, currentTick, tickSpacing, zeroForOne) {

        const rpc_provider = rpcProvider;

        const MULTICALL_ADDRESS = '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696';

        // Multicall ABI
        const MULTICALL_ABI = [
        {
            "inputs": [
            {"components": [
                {"name": "target", "type": "address"},
                {"name": "callData", "type": "bytes"}
            ], "name": "calls", "type": "tuple[]"}
            ],
            "name": "aggregate",
            "outputs": [
            {"name": "blockNumber", "type": "uint256"},
            {"name": "returnData", "type": "bytes[]"}
            ],
            "stateMutability": "view",
            "type": "function"
        }
        ];

        // Uniswap V3 Pool ABI for tickBitmap
        const POOL_ABI = [
        'function tickBitmap(int16 wordPosition) external view returns (uint256)',
        'function ticks(int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet)'
        ];
    // Create Multicall contract
        const multicallContract = new ethers.Contract(
            MULTICALL_ADDRESS, 
            MULTICALL_ABI, 
            rpc_provider
        );

        // Create Pool Interface
        const poolInterface = new ethers.utils.Interface(POOL_ABI);

        // Generate search ranges
        const searchRanges = this.generateOptimizedSearchRange(currentTick, tickSpacing, zeroForOne);

        // Prepare multicall data
        let calls = searchRanges.map(wordPos => ({
            target: poolAddress,
            callData: poolInterface.encodeFunctionData('tickBitmap', [wordPos])
        }));

        try {
            // Perform multicall
            let [, returnData] = await multicallContract.aggregate(calls);

            const processedBitmaps = returnData.map((data, index) => {
                const bitmap = poolInterface.decodeFunctionResult('tickBitmap', data);
                return {
                    wordPosition: searchRanges[index],
                    bitmap: bitmap.toString(),
                    hasInitializedTicks: bitmap.toString() !== '0'
                };
            });

            // Filter out zero bitmaps
            const filtered_result = processedBitmaps.filter(entry => entry.hasInitializedTicks).map(this.analyzeBitmap);
            calls = [];
            let tickIndices = [];

            for (let word_index = 0; word_index < filtered_result.length; word_index++) {
                for (let bit = 0; bit < 256; bit++) {

                    if ((filtered_result[word_index].fullBitmap & (1n << BigInt(bit))) === 0n) continue;
                    const tickIndex = ((filtered_result[word_index].wordPosition << 8n) + BigInt(bit)) * tickSpacing;

                    tickIndices.push(tickIndex);
                    calls.push({
                        target: poolAddress,
                        callData: poolInterface.encodeFunctionData('ticks', [tickIndex])
                    });
                }
            }

            try {
                [, returnData] = await multicallContract.aggregate(calls);
                const ticksInfo = tickIndices.map((tickIndex, i) => {
                    const [liquidityGross, liquidityNet] = poolInterface.decodeFunctionResult('ticks', returnData[i]);
                    const compressed = tickIndex / tickSpacing;
                    if (tickIndex < 0n && (tickIndex % tickSpacing) != 0n) { compressed -= 1n };
                    return {wordPosition: (compressed >> 8n), tickIndex, liquidityGross: BigInt(liquidityGross.toString()), liquidityNet: BigInt(liquidityNet.toString()) };
                });

                const ticksInfo_filtered = ticksInfo.filter(entry => entry.liquidityGross != '0');
                // console.log(ticksInfo_filtered);
                return [filtered_result, ticksInfo_filtered];
            } catch (error) {
                console.error('Error fetching liquidityGross:', error);
                return [];
            }

        } catch (error) {
            console.error('Bitmap retrieval error:', error);
            return [];
        }
    }
    // Smart range generation function
    static generateOptimizedSearchRange(currentTick, tickSpacing, zeroForOne) {

        const ranges = [];
        let minWord = 0;
        let maxWord = 0;

        //the problem can arise: if border tick and current tick are far away, we dont need to calc whole range, can set the max range to 200 words
        //can think about the way to optimise creation of the range, maybe use set?
        if (zeroForOne) {
            let minCompressed = this.MIN_TICK / tickSpacing;
            if ((this.MIN_TICK % tickSpacing) != 0n) { 
                minCompressed -= 1n; 
            }
            minWord = (minCompressed >> 8n);

            let compressed = currentTick / tickSpacing;
            if (currentTick < 0n && (currentTick % tickSpacing) != 0n) { compressed -= 1n };
            maxWord = (compressed >> 8n);
        } else {
            let compressed = currentTick / tickSpacing;
            if (currentTick < 0n && (currentTick % tickSpacing) != 0n) { compressed -= 1n };
            minWord = (compressed >> 8n);
            maxWord = ((this.MAX_TICK / tickSpacing) >> 8n);
        }
        console.log("Ranges of Word Index for BitMap: ", minWord, " ", maxWord);

        for (let i = minWord; i <= maxWord; i++) {
            ranges.push(i);
        }

        return ranges;
    }

    static analyzeBitmap(bitmapEntry) {
        
    const binaryRepresentation = BigInt(bitmapEntry.bitmap).toString(2);
    const initializedTicksCount = binaryRepresentation.split('1').length - 1;

    return {
        wordPosition: bitmapEntry.wordPosition,
        initializedTicksCount,
        fullBitmap: BigInt("0b" + binaryRepresentation)
    };
    }
}

// Main execution function
async function main() {

  
  // Uniswap V3 pool address (example - replace with actual pool address)
  const poolAddress = '0x50072FaeA4450f2ab683D5101b52B03bc6dBb703'; // USDC/WETH 0.3% pool

  try {
    // Retrieve bitmap
    const efficientBitmap = await Ticks.getEfficientTickBitmap(poolAddress, -81808n, 60n, true);
    
    // Analyze retrieved bitmaps
    // const analyzedBitmaps = efficientBitmap.map(analyzeBitmap);
    
    // Log results
    console.log('Efficient Bitmap Results:', efficientBitmap);
    

  } catch (error) {
    console.error('Bitmap retrieval failed:', error);
  }
}


// Uncomment to run
// main();

module.exports = {
    Ticks
};