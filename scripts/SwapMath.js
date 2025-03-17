const { SqrtPriceMath } = require("./SqrtPriceMath.js");
const { FullMath }  = require("./FullMath.js");

class SwapMath {

    static computeSwapStep(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, amountRemaining, feePips) {
        let sqrtRatioNextX96, amountIn, amountOut, feeAmount;

        const zeroForOne = sqrtRatioCurrentX96 >= sqrtRatioTargetX96;
        const exactIn = amountRemaining >= 0;

        if (exactIn) {
            const amountRemainingLessFee = FullMath.mulDiv(amountRemaining, BigInt(1e6 - feePips), BigInt(1e6));
            amountIn = zeroForOne 
                ? SqrtPriceMath.getAmount0DeltaExt(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
                : SqrtPriceMath.getAmount1DeltaExt(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true);
            if (amountRemainingLessFee >= amountIn) { sqrtRatioNextX96 = sqrtRatioTargetX96; }
            else sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(sqrtRatioCurrentX96, liquidity, amountRemainingLessFee, zeroForOne);

        } else {
            amountOut = zeroForOne
                ? SqrtPriceMath.getAmount1DeltaExt(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false)
                : SqrtPriceMath.getAmount0DeltaExt(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false);
            if (-amountRemaining >= amountOut) { sqrtRatioNextX96 = sqrtRatioTargetX96; }
            else sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromOutput(sqrtRatioCurrentX96, liquidity, -amountRemaining, zeroForOne);
        }
        const max = (sqrtRatioTargetX96 == sqrtRatioNextX96);

        if (zeroForOne) {
            amountIn = (max && exactIn)
                ? amountIn
                : SqrtPriceMath.getAmount0DeltaExt(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true);
            amountOut = (max && !exactIn)
                ? amountOut
                : SqrtPriceMath.getAmount1DeltaExt(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false);
        } else {
            amountIn = (max && exactIn)
                ? amountIn
                : SqrtPriceMath.getAmount1DeltaExt(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, true);
            amountOut = (max && !exactIn)
                ? amountOut
                : SqrtPriceMath.getAmount0DeltaExt(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, false);
        }

        if (!exactIn && (amountOut > -amountRemaining)) {
            amountOut = -amountRemaining;
        }

        if (exactIn && (sqrtRatioNextX96 != sqrtRatioTargetX96)) {
            feeAmount = amountRemaining - amountIn;
        } else {
            feeAmount = FullMath.mulDivRoundingUp(amountIn, BigInt(feePips), BigInt(1e6 - feePips));
        }


        return [sqrtRatioNextX96, amountIn, amountOut, feeAmount];
    }

}

module.exports = {
    SwapMath,
}
// export default {SwapMath};
