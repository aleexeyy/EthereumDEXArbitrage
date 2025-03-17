class FullMath {
    static mulDivRoundingUp(a, b, denominator) {
        if (denominator == 0n) throw new Error("FULL_MATH_MUL_DIV_ROUNDING_UP_ZERO_DENOMINATOR");
        const result = (a * b + denominator - 1n) / denominator;
        return result;
    }


    static divRoundingUp(a, b) {
        if (b == 0n) throw new Error("FULL_MATH_DIV_ROUNDING_UP_ZERO_DIVISOR");
        return (a + b - 1n) / b;
    }

    static mulDiv(a, b, denominator) {
        if (denominator == 0n) throw new Error("FULL_MATH_MUL_DIV_ZERO_DENOMINATOR");
        return (a * b) / denominator;
    }
}

module.exports = {
    FullMath
};

// export default {FullMath};