
class TickMath {
    static MIN_TICK = -887272n;
    static MAX_TICK = -this.MIN_TICK;

    static MIN_SQRT_RATIO = 4295128739n;
    static MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;
    
    static getSqrtRatioAtTick(tick) {
        const absTick = BigInt(tick) < 0n ? -tick : tick;
        if (absTick > this.MAX_TICK) {
            throw new Error('TICK_BOUND');
        }
        
        let ratio = ((absTick & 0x1n) !== 0n)
            ? BigInt("0xfffcb933bd6fad37aa2d162d1a594001")
            : BigInt("0x100000000000000000000000000000000");
        if ((absTick & 0x2n) !== 0n) ratio = ((ratio * BigInt("0xfff97272373d413259a46990580e213a")) >> 128n);
        if ((absTick & 0x4n) !== 0n) ratio = ((ratio * BigInt("0xfff2e50f5f656932ef12357cf3c7fdcc")) >> 128n);
        if ((absTick & 0x8n) !== 0n) ratio = ((ratio * BigInt("0xffe5caca7e10e4e61c3624eaa0941cd0")) >> 128n);
        if ((absTick & 0x10n) !== 0n) ratio = ((ratio * BigInt("0xffcb9843d60f6159c9db58835c926644")) >> 128n);
        if ((absTick & 0x20n) !== 0n) ratio = ((ratio * BigInt("0xff973b41fa98c081472e6896dfb254c0")) >> 128n);
        if ((absTick & 0x40n) !== 0n) ratio = ((ratio * BigInt("0xff2ea16466c96a3843ec78b326b52861")) >> 128n);
        if ((absTick & 0x80n) !== 0n) ratio = ((ratio * BigInt("0xfe5dee046a99a2a811c461f1969c3053")) >> 128n);
        if ((absTick & 0x100n) !== 0n) ratio = ((ratio * BigInt("0xfcbe86c7900a88aedcffc83b479aa3a4")) >> 128n);
        if ((absTick & 0x200n) !== 0n) ratio = ((ratio * BigInt("0xf987a7253ac413176f2b074cf7815e54")) >> 128n);
        if ((absTick & 0x400n) !== 0n) ratio = ((ratio * BigInt("0xf3392b0822b70005940c7a398e4b70f3")) >> 128n);
        if ((absTick & 0x800n) !== 0n) ratio = ((ratio * BigInt("0xe7159475a2c29b7443b29c7fa6e889d9")) >> 128n);
        if ((absTick & 0x1000n) !== 0n) ratio = ((ratio * BigInt("0xd097f3bdfd2022b8845ad8f792aa5825")) >> 128n);
        if ((absTick & 0x2000n) !== 0n) ratio = ((ratio * BigInt("0xa9f746462d870fdf8a65dc1f90e061e5")) >> 128n);
        if ((absTick & 0x4000n) !== 0n) ratio = ((ratio * BigInt("0x70d869a156d2a1b890bb3df62baf32f7")) >> 128n);
        if ((absTick & 0x8000n) !== 0n) ratio = ((ratio * BigInt("0x31be135f97d08fd981231505542fcfa6")) >> 128n);
        if ((absTick & 0x10000n) !== 0n) ratio = ((ratio * BigInt("0x9aa508b5b7a84e1c677de54f3e99bc9")) >> 128n);
        if ((absTick & 0x20000n) !== 0n) ratio = ((ratio * BigInt("0x5d6af8dedb81196699c329225ee604")) >> 128n);
        if ((absTick & 0x40000n) !== 0n) ratio = ((ratio * BigInt("0x2216e584f5fa1ea926041bedfe98")) >> 128n);
        if ((absTick & 0x80000n) !== 0n) ratio = ((ratio * BigInt("0x48a170391f7dc42444e8fa2")) >> 128n);
        if (tick > 0n) {
            ratio = (BigInt(2)**256n - 1n) / ratio;
        }
        const sqrtPriceX96 = (ratio >> 32n) + ((ratio % (1n << 32n)) == 0n ? 0n : 1n);
        return (sqrtPriceX96 & ((1n << 160n) - 1n));
    }

    static getTickAtSqrtRatio(sqrtPriceX96) {
        if (sqrtPriceX96 < this.MIN_SQRT_RATIO || sqrtPriceX96 >= this.MAX_SQRT_RATIO) {
            throw new Error('SQRT_PRICE_X96_OUT_OF_BOUNDS');
        }
        let ratio = (BigInt(sqrtPriceX96) << 32n);
        let r = ratio;
        let msb = 0n;

        const checks = [
            [0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn, 7n],
            [0xFFFFFFFFFFFFFFFFn, 6n],
            [0xFFFFFFFFn, 5n],
            [0xFFFFn, 4n],
            [0xFFn, 3n],
            [0xFn, 2n],
            [0x3n, 1n]
        ];

        for (const [threshold, shift] of checks) {
            const f = ((r > threshold ? 1n : 0n) << shift);
            msb = (msb | f);
            r = (r >> f);
        }
        msb |= (r > 0x1n ? 1n : 0n);

        if (msb >= 128n) {
            r = (ratio >> (msb-127n));
        } else {
            r = (ratio << (127n-msb))
        }


        let log_2 = ((msb - 128n) << 64n);

        for (let i = 0; i < 13; i++) {
            r = ((r * r) >> 127n);
            const f = (r >> 128n);
            log_2 |= (f << BigInt(63 - i));
            r = (r >> f);
        }

        r = ((r * r) >> 127n);
        const f = (r >> 128n);
        log_2 |= (f << 50n);


        // const mask = (1n << 24n) - 1n;
        const log_sqrt10001 = log_2 * 255738958999603826347141n;
        const tickLow = ((log_sqrt10001 - 3402992956809132418596140100660247210n) >> 128n);
        const tickHigh = ((log_sqrt10001 + 291339464771989622907027621153398088495n) >> 128n);
        const tick = (tickLow == tickHigh) ? tickLow : this.getSqrtRatioAtTick(tickHigh) <= sqrtPriceX96 ? tickHigh : tickLow;
        return tick;
    }
}
module.exports = {
    TickMath
}
// export default {TickMath};

