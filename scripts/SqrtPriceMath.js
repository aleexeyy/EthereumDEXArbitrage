const { FullMath } = require("./FullMath.js");
const { FixedPoint96 } = require("./FixedPoint96.js");

class SqrtPriceMath {
    static getNextSqrtPriceFromAmount0RoundingUp(sqrtPriceX96, liquidity, amountIn, add) {

        if (amountIn == 0n) return sqrtPriceX96;
        const numerator1 = (BigInt(liquidity) << FixedPoint96.RESOLUTION);

        if (add) {
            let product = amountIn*sqrtPriceX96;
            if (product == sqrtPriceX96) {
                const denominator = numerator1 + product;
                if (denominator >= numerator1) return FullMath.mulDivRoundingUp(numerator1, sqrtPriceX96, denominator);
        }
        return FullMath.divRoundingUp(numerator1, (numerator1 / sqrtPriceX96) + amountIn);

        } else {
            let product = amountIn * sqrtPriceX96;
            if (product / amountIn != sqrtPriceX96 || numerator1 <= product) {
                throw new Error("SQRT_PRICE_MATH_SQRT_DENOMINATOR_UNDERFLOW");
            }
            // console.log("CHECKKKK THIIIS:: ", product);
            const denominator = numerator1 - product;
            return FullMath.mulDivRoundingUp(numerator1, sqrtPriceX96, denominator);
        }
    }


    static getNextSqrtPriceFromAmount1RoundingDown(sqrtPriceX96, liquidity, amountIn, add) {
        if (add) { 
            const quotient = (amountIn <= ((2n ** 160n) - 1n)) ? (amountIn << FixedPoint96.RESOLUTION) / liquidity : FullMath.mulDiv(amountIn, FixedPoint96.Q96, liquidity);
            return sqrtPriceX96 + quotient;
        } else {
            const quotient = (amountIn <= ((2n ** 160n) - 1n)) ? FullMath.divRoundingUp((amountIn << FixedPoint96.RESOLUTION), liquidity) 
            : FullMath.mulDivRoundingUp(amountIn, FixedPoint96.Q96, liquidity);
            
            if (sqrtPriceX96 <= quotient) {
                throw new Error("SQRT_PRICE_MATH_SQRT_PRICE_UNDERFLOW");
            }
            return sqrtPriceX96 - quotient;
        }
    }


    static getNextSqrtPriceFromInput(sqrtPriceX96, liquidity, amountIn, zeroForOne) {
        if (sqrtPriceX96 <= 0n) throw new Error("SQRT_PRICE_MATH_SQRT_PRICE_UNDERFLOW");
        if (liquidity <= 0n) throw new Error("SQRT_PRICE_MATH_LIQUIDITY_UNDERFLOW");

        return zeroForOne ? this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPriceX96, liquidity, amountIn, true) 
        : this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPriceX96, liquidity, amountIn, true);
    }

    static getNextSqrtPriceFromOutput(sqrtPriceX96, liquidity, amountOut, zeroForOne) {
        if (sqrtPriceX96 <= 0n) throw new Error("SQRT_PRICE_MATH_SQRT_PRICE_UNDERFLOW");
        if (liquidity <= 0n) throw new Error("SQRT_PRICE_MATH_LIQUIDITY_UNDERFLOW");

        return zeroForOne ? this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPriceX96, liquidity, amountOut, false) : this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPriceX96, liquidity, amountOut, false);
    }



    static getAmount0DeltaExt(sqrtPriceAX96, sqrtPriceBX96, liquidity, roundUp) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
        }
        if (sqrtPriceAX96 <= 0n) throw new Error("SQRT_PRICE_MATH_SQRT_PRICE_UNDERFLOW");
        const numerator1 = (liquidity << FixedPoint96.RESOLUTION);
        const numerator2 = sqrtPriceBX96 - sqrtPriceAX96;
        return roundUp ? FullMath.divRoundingUp(FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtPriceBX96), sqrtPriceAX96) 
        : FullMath.mulDiv(numerator1, numerator2, sqrtPriceBX96) / sqrtPriceAX96;
    }

    static getAmount1DeltaExt(sqrtPriceAX96, sqrtPriceBX96, liquidity, roundUp) {
        if (sqrtPriceAX96 > sqrtPriceBX96) {
            [sqrtPriceAX96, sqrtPriceBX96] = [sqrtPriceBX96, sqrtPriceAX96];
        }
        return roundUp ? FullMath.mulDivRoundingUp(liquidity, sqrtPriceBX96 - sqrtPriceAX96, FixedPoint96.Q96) 
        : FullMath.mulDiv(liquidity, sqrtPriceBX96 - sqrtPriceAX96, FixedPoint96.Q96);
    }


    static getAmount0Delta(sqrtPriceAX96, sqrtPriceBX96, liquidity) { 
        return (liquidity < 0n) ? -this.getAmount0DeltaExt(sqrtPriceAX96, sqrtPriceBX96, -liquidity, false) 
        : this.getAmount0DeltaExt(sqrtPriceAX96, sqrtPriceBX96, liquidity, true);
    }

    static getAmount1Delta(sqrtPriceAX96, sqrtPriceBX96, liquidity) {
        return (liquidity < 0n) ? -this.getAmount1DeltaExt(sqrtPriceAX96, sqrtPriceBX96, -liquidity, false) 
        : this.getAmount1DeltaExt(sqrtPriceAX96, sqrtPriceBX96, liquidity, true);
    }
}

module.exports = {
    SqrtPriceMath,
};

// export default SqrtPriceMath;