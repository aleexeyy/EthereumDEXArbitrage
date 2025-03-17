const {ethers, BigNumber} = require("ethers");

class TickBitmap {
    static position(tick) {
        tick = BigInt(tick);
        const wordPos = (tick >> 8n);
        const bitPos = ((tick % 256n) + 256n) % 256n;
        return { wordPos, bitPos };
    }


    static leastSignificantBit(x) {
        x = BigInt(x);
        if (x <= 0n) {
            throw new Error('NEGATIVE_VALUE');
        }
        let r = 255;

        for (let i = 7; i > 0; i--) {
            if ((x & (BigInt(2)**BigInt(2**i) - 1n)) > 0n) {
                r -= 2**i;
            } else {
                x >>= BigInt(2**i);
            }
        }
        if ((x & 0x1n) > 0n) r -= 1;
        return BigInt(r);
    }


    static mostSignificantBit(x) {
        x = BigInt(x);
        if (x <= 0n) {
            throw new Error('NEGATIVE_VALUE');
        }
        let r = 0;

        if (x >= 0x100000000000000000000000000000000n) {
            x >>= 128n;
            r += 128;
        }
        if (x >= 0x10000000000000000n) {
            x >>= 64n;
            r += 64;
        }
        if (x >= 0x100000000n) {
            x >>= 32n;
            r += 32;
        }
        if (x >= 0x10000n) {
            x >>= 16n;
            r += 16;
        }
        if (x >= 0x100n) {
            x >>= 8n;
            r += 8;
        }
        if (x >= 0x10n) {
            x >>= 4n;
            r += 4;
        }
        if (x >= 0x4n) {
            x >>= 2n;
            r += 2;
        }
        if (x >= 0x2n) r += 1;
        
        return BigInt(r);
    }

    static getWord(self, wordPos) {
        for (const word of self) {
            if (word.wordPosition == wordPos) {
                return word.fullBitmap;
            }
        }
        return 0n
    }


    // Returns the next initialized tick within one word, or the word itself if it is initialized. 
    // If the tick is not initialized, it returns the next initialized tick.
    // If the tick is initialized, it returns the tick itself.
    // need to consider variable self!!!
    static nextInitializedTickWithinOneWord(tick, tickSpacing, lte, self) {
        let compressed = tick / tickSpacing;
        if (tick < 0n && (tick % tickSpacing) != 0n) { compressed -= 1n };

        let next, initialised;
        if (lte) {
            const {wordPos, bitPos} = this.position(compressed);
            const mask = BigInt("0b" + ((1n << (BigInt(bitPos) + 1n)) - 1n).toString(2));
            const masked = (this.getWord(self, wordPos) & mask);
            initialised = (masked !== 0n);

            next = initialised 
            ? (compressed - (bitPos - this.mostSignificantBit(masked))) * tickSpacing 
            : (compressed - BigInt(bitPos)) * tickSpacing;

        } else {
            const {wordPos, bitPos} = this.position(compressed+1n);
            const mask = BigInt("0b" + ((1n << 256n) - (1n << BigInt(bitPos))).toString(2));
            const masked = (this.getWord(self, wordPos) & mask);
            
            initialised = (masked !== 0n);
            next = initialised 
            ? (compressed + 1n + (this.leastSignificantBit(masked) - bitPos)) * tickSpacing 
            : (compressed + 1n + (255n - BigInt(bitPos))) * tickSpacing;
        }

        return [next, initialised];


    }

}

module.exports = {
    TickBitmap
};

// export default TickBitmap;