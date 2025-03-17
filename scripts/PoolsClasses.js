const { BigNumber: bn } = require('bignumber.js');
const { ethers} = require("ethers");
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });
const {PoolsDecimals} = require("./constants.js");
const {SwapV3} = require("./swapV3.js");
const { Ticks } = require("./getTickBitMap.js");
const { TickMath } = require("./TickMath.js");

class V2Pool {
    #ABI = [
        "function getReserves() view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)"
      ];
    #poolContract;
    #provider = new ethers.providers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/ifbux2lDtNf63qjvhI6A3M53YsLthsoO');
    
    static async create(poolAddress, token0, token1, DEX="Uniswap") {
        const instance = new V2Pool(poolAddress, token0, token1, DEX);

        await instance.getReserve();

        return instance;
    }
    constructor(poolAddress, token0, token1, DEX) {
        this.poolAddress = poolAddress;
        [this.token0, this.token1] = V2Pool.sortTokens(token0, token1);
        [this.token0Decimals, this.token1Decimals] = [PoolsDecimals[this.token0.toLowerCase()], PoolsDecimals[this.token1.toLowerCase()]];
        if (this.token0Decimals == undefined || this.token1Decimals == undefined) throw new Error(`Dont have Decimals for Tokens: ${this.token0} and ${this.token1}`);
        this.fee = 3000;
        this.version = "V2";
        this.DEX = DEX;

        this.#poolContract = new ethers.Contract(this.poolAddress, this.#ABI, this.#provider);
        this.reserveToken0 = ethers.BigNumber.from('0');
        this.reserveToken1 = ethers.BigNumber.from('0');

    }


    async getReserve() {
        [this.reserveToken0, this.reserveToken1] = await this.#poolContract.getReserves();

        this.sqrtPriceX96 = this.encodePriceSqrt();
    }

    getExchangeRate(zeroForOne) {
        if (this.reserveToken0.isZero() || this.reserveToken1.isZero()) {
            console.log(`The pool ${this.poolAddress} is dead!`);
            return new bn(0);
        }
        return this.convertSqrtPriceX96toRate(zeroForOne);
    }

    getDataGivenIn(amountIn, zeroForOne) {
        let [reserveA, reserveB] = [this.reserveToken0, this.reserveToken1];
        if (!zeroForOne) {
            [reserveA, reserveB] = [reserveB, reserveA];
        }
        const amountInWithFee = ethers.BigNumber.from(amountIn.toString()).mul(997);
        const numerator = amountInWithFee.mul(reserveB);
        const denominator = amountInWithFee.add(reserveA.mul(1000));
        const amountOut = numerator.div(denominator);
    
        // Underflow
        let newReserveB = reserveB.sub(amountOut);
        if (newReserveB.lt(0) || newReserveB.gt(reserveB)) {
            newReserveB = ethers.BigNumber.from(1);
        }
    
        // Overflow
        let newReserveA = reserveA.add(amountIn);
        if (newReserveA.lt(reserveA)) {
            newReserveA = ethers.constants.MaxInt256;
        }
        return {
            amount: amountOut,
            newReserveA,
            newReserveB,
          };
    }


    getDataGivenOut(amountOut, zeroForOne) {

        let [reserveA, reserveB] = [this.reserveToken0, this.reserveToken1];
        if (!zeroForOne) {
            [reserveA, reserveB] = [reserveB, reserveA];
        }
        
        // Underflow
        let newReserveB = reserveB.sub(amountOut);
        if (newReserveB.lt(0) || newReserveB.gt(reserveB)) {
            newReserveB = ethers.BigNumber.from(1);
        }
      
        const numerator = reserveA.mul(amountOut).mul(1000);
        const denominator = newReserveB.mul(997);
        const amountIn = numerator.div(denominator).add(ethers.constants.One);
      
        // Overflow
        let newReserveA = reserveA.add(amountIn);
        if (newReserveA.lt(reserveA)) {
            newReserveA = ethers.constants.MaxInt256;
        }
      
        return {
            amount: amountIn,
            newReserveA,
            newReserveB,
        };
    }

    encodePriceSqrt() { 

        if (this.reserveToken0.isZero() || this.reserveToken1.isZero()) {
            console.log("Reserves cannot be zero.");
            return new bn(0);
        }
        //always token0 -> token1 relation
        return ethers.BigNumber.from(
            new bn(this.reserveToken1.toString()).div(this.reserveToken0.toString()).sqrt()
            .multipliedBy(new bn(2).pow(96))
            .integerValue(3)
            .toString()
        );
    }


    convertSqrtPriceX96toRate(zeroForOne) {
        const numerator = new bn(this.sqrtPriceX96.toString()).pow(2);
        const denominator = new bn(2).pow(192);
        const ratio = numerator.div(denominator);
        const [tokenADecimals, tokenBDecimals] = zeroForOne ? [this.token0Decimals, this.token1Decimals] : [this.token1Decimals, this.token0Decimals];
        const decimalShift = new bn(10).pow(Number(tokenADecimals) - Number(tokenBDecimals));
        if (!zeroForOne) {
          return  decimalShift.div(ratio);
        }
        return ratio.multipliedBy(decimalShift);
    };

    static sortTokens = (tokenA, tokenB) => {
        if (ethers.BigNumber.from(tokenA).lt(ethers.BigNumber.from(tokenB))) {
          return [tokenA, tokenB];
        }
        return [tokenB, tokenA];
      };
};






class V3Pool {
    #ABI = [
        'function tickSpacing() external view returns (int24)',
        "function tickBitmap(int16 wordPosition) external view returns (uint256)",
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
        'function liquidity() external view returns (uint128)',
        'function ticks(int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)',
        'function swap(address sender, bool zeroForOne, uint256 amountSpecified, uint160 sqrtPriceLimitX96, bool exactIn) external returns (int256 amount0, int256 amount1)'
    ];

    #poolContract;
    #provider = new ethers.providers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/ifbux2lDtNf63qjvhI6A3M53YsLthsoO');

    static async create(poolAddress, token0, token1, fee, DEX = "Uniswap") {
        const instance = new V3Pool(poolAddress, token0, token1, fee, DEX);

        await instance.initialise();

        return instance;
    }
    constructor(poolAddress, token0, token1, fee, DEX) {
        this.poolAddress = poolAddress;
        [this.token0, this.token1] = V3Pool.sortTokens(token0, token1);
        [this.token0Decimals, this.token1Decimals] = [PoolsDecimals[this.token0.toLowerCase()], PoolsDecimals[this.token1.toLowerCase()]];
        if (this.token0Decimals == undefined || this.token1Decimals == undefined) throw new Error(`Dont have Decimals for Tokens: ${this.token0} and ${this.token1}`);
        this.fee = fee;
        this.version = "V3";
        //in the future other DEXes can be added, need to implement logic for that
        this.DEX = DEX;

        this.#poolContract = new ethers.Contract(this.poolAddress, this.#ABI, this.#provider);


        this.sqrtPriceLimitX96 = 0;
        // this.sqrtPriceAfterSwapX96 = 0;


        this.self = new Set();
        this.indexedLiquidityNet = new Set();
        this.bitmapDirection = [];
    }

    async executeSwap(amountIn, zeroForOne) {
        try {
            if (!(this.bitmapDirection.includes(zeroForOne))) {
                await this.getTicks(zeroForOne);
            }
            this.calculateSqrtPriceLimitX96(zeroForOne);
            const result = SwapV3.swap(amountIn, zeroForOne, this);
            return result;
        } catch(error) {
            console.error('Error executing swap:', error);
            throw error;
        }
    }


    async initialise() {

        [this.slot0, this.liquidity, this.tickSpacing] = await Promise.all([this.getSlot0(), this.getLiquidity(), this.getTickSpacing()]);
    }


    getExchangeRate(sqrtPriceX96, zeroForOne) {
        const numerator = new bn(sqrtPriceX96.toString()).pow(2);
        const denominator = new bn(2).pow(192);
        const ratio = numerator.div(denominator);
        const [tokenADecimals, tokenBDecimals] = zeroForOne ? [this.token0Decimals, this.token1Decimals] : [this.token1Decimals, this.token0Decimals];
        const decimalShift = new bn(10).pow(Number(tokenADecimals) - Number(tokenBDecimals));
        if (!zeroForOne) {
          return decimalShift.div(ratio);
        }
        return ratio.multipliedBy(decimalShift);
    };
    async getTicks(zeroForOne) {
        this.bitmapDirection.push(zeroForOne);
        const [self, indexedLiquidityNet] = await Ticks.getEfficientTickBitmap(this.poolAddress, this.slot0.tick, this.tickSpacing, zeroForOne);
        self.forEach(value => this.self.add(value));
        indexedLiquidityNet.forEach(value => this.indexedLiquidityNet.add(value));
        console.log("Got the ticks for the pool: ", this.poolAddress, " Direction: ", zeroForOne);
        // console.log("TickBitMap: ", self);
        // console.log("----------------------------------------------------");
        // console.log("LiquidityNet: ", indexedLiquidityNet);
    }
    static sortTokens = (tokenA, tokenB) => {
        if (ethers.BigNumber.from(tokenA).lt(ethers.BigNumber.from(tokenB))) {
          return [tokenA, tokenB];
        }
        return [tokenB, tokenA];
      };

    async getTickSpacing() {
        try {
          const tickSpacing = await this.#poolContract.tickSpacing();
          return BigInt(tickSpacing);
        } catch (error) {
          console.error('Error fetching tick spacing:', error);
          throw error;
        }
      }
    async getLiquidityNet(tick) {
        const tickData = await this.#poolContract.ticks(tick);
        return BigInt(tickData.liquidityNet.toString());
    }
    
    updateStateLocaly(newSqrtPriceX96) {
        // this.sqrtPriceX96 = newSqrtPriceX96;
        try {
            this.slot0.tick = TickMath.getTickAtSqrtRatio(newSqrtPriceX96);
            this.slot0.sqrtPriceX96 = newSqrtPriceX96;
        } catch(error) {
            console.log("Got an error in updateStateLocaly: ");
            throw(error);
        }
        
    }

    async getSlot0() {
        try {
            const [sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked] = await this.#poolContract.slot0();
            return {
                sqrtPriceX96: sqrtPriceX96.toBigInt(),
                tick: BigInt(tick),
                observationIndex,
                observationCardinality,
                observationCardinalityNext,
                feeProtocol,
                unlocked
            };
        } catch (error) {
            console.error('Error fetching slot0:', error);
            throw error;
        }
    }
    async getLiquidity() {
        try {
            // Query liquidity from the pool contract
            const liquidity = await this.#poolContract.liquidity();
    
            // Convert the liquidity from uint128 to BigInt
            return liquidity.toBigInt();
        } catch (error) {
            console.error('Error fetching liquidity:', error);
            throw error;
        }
    }

    calculateSqrtPriceLimitX96(zeroForOne) {

        const slippageTolerance = 0.5;
        const slippageBps = BigInt(Math.floor(slippageTolerance * 10000));
        
        if (zeroForOne) {
            this.sqrtPriceLimitX96 = (this.slot0.sqrtPriceX96 * (10000n - slippageBps)) / 10000n;
        } else {
            this.sqrtPriceLimitX96 = (this.slot0.sqrtPriceX96 * (10000n + slippageBps)) / 10000n;
        }
        return this.sqrtPriceLimitX96;
    }
    async getAmountOutV3(amountIn, zeroForOne) {
        try {
            if (amountIn == 0n) {
                return amountIn;
            }
            const sqrtPriceLimitX96 = this.calculateSqrtPriceLimitX96(zeroForOne);
            let tokenIn, tokenOut;
            if (zeroForOne) {
                [tokenIn, tokenOut] = [this.token0, this.token1];
            } else {
                [tokenIn, tokenOut] = [this.token1, this.token0];
            }
            const params = {
                tokenIn : tokenIn,
                tokenOut: tokenOut,
                fee : this.fee,
                amountIn: amountIn,
                sqrtPriceLimitX96: sqrtPriceLimitX96.toString()
            };
            const result = await quoterContract.callStatic.quoteExactInputSingle(params);
            return result.amountOut.toString();
        } catch(error) {

            console.log("error Quoter: ", amountIn.toString());
            return BigNumber.from("0");
        }
    }
};

module.exports = {
    V2Pool,
    V3Pool,
}