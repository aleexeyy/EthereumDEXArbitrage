const { TickMath } = require("./TickMath.js");
const { SwapMath } = require("./SwapMath.js");
const { TickBitmap } = require("./TickBitmap.js");
const { Ticks } = require("./getTickBitMap.js");
const { ethers } = require('ethers');
const {quoterContract} = require('./constants.js');

class SwapV3 {
    static createSwapStep(params) {
        return {
            amountSpecifiedRemaining: BigInt(params.amountSpecifiedRemaining || 0),
            amountCalculated: BigInt(params.amountCalculated || 0),
            sqrtPriceX96: BigInt(params.sqrtPriceX96 || 0),
            tick: BigInt(params.tick || 0),
            liquidity: BigInt(params.liquidity || 0)
        };
    }

    static createStepState(params) {
        return {
            sqrtPriceX96Start: BigInt(params.sqrtPriceX96Start || 0),
            sqrtPriceX96Next: BigInt(params.sqrtPriceX96Next || 0),
            initialised: Boolean(params.initialised),
            nextTick: BigInt(params.nextTick || 0),
            amountIn: BigInt(params.amountIn || 0),
            amountOut: BigInt(params.amountOut || 0),
            feeAmount: BigInt(params.feeAmount || 0)
        };
    }

    static getLiquidityNet(indexedLiquidityNet, tick) {
        for (let tickInfo of indexedLiquidityNet) {
            if (tickInfo.tickIndex == tick) {
                return tickInfo.liquidityNet;
            }
        }
        throw new Error("Pre calculation of liquidityNet didnt work!!!");
    }

    static swap(amountSpecified, zeroForOne, v3Pool) {
        amountSpecified = BigInt(amountSpecified.toString());
        const slot0 = v3Pool.slot0;
        const liquidity = v3Pool.liquidity;
        const tickSpacing = v3Pool.tickSpacing;
        const fee = v3Pool.fee;
        const sqrtPriceLimitX96 = v3Pool.sqrtPriceLimitX96;

        if (amountSpecified == 0n) throw new Error("amountSpecified must be greater than 0");
        if (liquidity == 0n) return 0n;

        const exactInput = (amountSpecified > 0);
        const state = this.createSwapStep({
                amountSpecifiedRemaining: amountSpecified,
                amountCalculated: 0n,
                sqrtPriceX96: slot0.sqrtPriceX96,
                tick: slot0.tick,
                liquidity: liquidity
            });

        // const [self, indexedLiquidityNet] = await Ticks.getEfficientTickBitmap(poolAddress, state.tick, v3Pool.tickSpacing, zeroForOne);

        while (state.amountSpecifiedRemaining > 0n && state.sqrtPriceX96 !== sqrtPriceLimitX96) {
            const step = this.createStepState(
                {
                    sqrtPriceX96Start: state.sqrtPriceX96,
                    sqrtPriceX96Next: sqrtPriceLimitX96,
                    initialised: false,
                    nextTick: 0n,
                    amountIn: 0n,
                    amountOut: 0n,
                    feeAmount: 0n
                }
            );
            [step.nextTick, step.initialised] = TickBitmap.nextInitializedTickWithinOneWord(state.tick, tickSpacing, zeroForOne, v3Pool.self);
            if (step.nextTick < TickMath.MIN_TICK) {
                step.nextTick = TickMath.MIN_TICK;
            } else if (step.nextTick > TickMath.MAX_TICK) {
                step.nextTick = TickMath.MAX_TICK;
            }

            // console.log("Next Tick: ", step.nextTick, " ", step.initialised);


            step.sqrtPriceX96Next = TickMath.getSqrtRatioAtTick(step.nextTick);
            
            [state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount] = SwapMath.computeSwapStep(
                state.sqrtPriceX96,
                (zeroForOne ? step.sqrtPriceX96Next < sqrtPriceLimitX96 : step.sqrtPriceX96Next > sqrtPriceLimitX96) ? sqrtPriceLimitX96 : step.sqrtPriceX96Next,
                state.liquidity,
                state.amountSpecifiedRemaining,
                fee
            );
            if (exactInput) {
                if ((step.amountIn + step.feeAmount) == 0) {
                    break;
                }
                state.amountSpecifiedRemaining -= (step.amountIn + step.feeAmount);
                state.amountCalculated -= step.amountOut;
            } else {
                //need to consider the sign there, because there amountIn can be negative
                state.amountSpecifiedRemaining += step.amountOut;
                state.amountCalculated += (step.amountIn + step.feeAmount);
            }


            if (state.sqrtPriceX96 == step.sqrtPriceX96Next) {
                // console.log("Crossing the Tick!!!!");
                if (step.initialised) {
                    let liquidityNet = this.getLiquidityNet(v3Pool.indexedLiquidityNet, step.nextTick);
                    if (zeroForOne) liquidityNet = -liquidityNet;
                    state.liquidity = state.liquidity + liquidityNet;
                }
                // console.log("Old Tick: ", state.tick);
                state.tick = zeroForOne ? (step.nextTick - 1n) : step.nextTick;
                // console.log("New Tick: ",state.tick);
            } else if (state.sqrtPriceX96 != step.sqrtPriceX96Start) {
                state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
            } 
            // console.log("Left money: ", state.amountSpecifiedRemaining);

        }
        let [amount0, amount1] = zeroForOne == exactInput ? [amountSpecified - state.amountSpecifiedRemaining, state.amountCalculated] : [state.amountCalculated, amountSpecified - state.amountSpecifiedRemaining];

        // make first amount is always input token, second amount is always output token
        if (zeroForOne) {
            // console.log("Input Amount: ", amountSpecified, " ", "Output Amount: ", -amount1);
            return {
                "amountOut": -amount1,
                "amountUsed": amount0,
                "newSqrtPriceX96": state.sqrtPriceX96
            };
        } else {
            // console.log("Input Amount: ", amountSpecified, " ", "Output Amount: ", -amount0);
            return {
                "amountOut": -amount0,
                "amountUsed": amount1,
                "newSqrtPriceX96": state.sqrtPriceX96
            };
        }
        // if (zeroForOne) {
        //     if (amount0 !== amountSpecified) amount1 = 0n;
        //     return [amount0, -amount1];
        // } else {
        //     if (amount1 !== amountSpecified) amount0 = 0n;
        //     return [amount1, -amount0];
        // }
    }
}



module.exports = {
    SwapV3
};

async function main() {

    const poolAddress = '0xBfd25092d6d5396CfA88d867c0cC73B7603b4aD8'; // Example pool address (USDC/WETH)
    const token0 = '0x420698CFdEDdEa6bc78D59bC17798113ad278F9D'; // Example token0 address (USDC)
    const token1 = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';



    const v3Pool = new V3Pool(poolAddress, token0, token1, 3000);
    await v3Pool.initialise();

    let zeroForOne = false;

    await v3Pool.getTicks(zeroForOne);

    v3Pool.calculateSqrtPriceLimitX96(zeroForOne);

    const tick = v3Pool.slot0.tick;
    console.log(tick);
    // const test1 =TickMath.getTickAtSqrtRatio(1500107875554805492624537204687965n);

    // console.log("Testing Tick Function: ", test1);
    console.log('liquidity: ', v3Pool.liquidity);

    const amountIn = BigInt(Math.floor(1098120));
    console.log("Token0: ", v3Pool.token0, " Token1: ", v3Pool.token1);
    console.log("zeroForOne: ", zeroForOne);
    console.log("AmountIn : ", (BigInt(amountIn) / BigInt(10**18)).toString());
    const result_offchain = await SwapV3.swap(BigInt(amountIn), zeroForOne, v3Pool);
    console.log("Old SqrtPrice: ", v3Pool.slot0.sqrtPriceX96);

    const result_onchain = await v3Pool.getAmountOutV3(amountIn, zeroForOne);
    console.log('Swap Result:', result_onchain);

}

// main();
//1489120247162508736793712670488204
//1477467683632233689491519374094162