# DEX Arbitrage Bot

## Overview

This project is an automated arbitrage bot that scans pending Ethereum transactions in the mempool and attempts to profit from price differences across decentralized exchanges (DEXes) such as **Uniswap V2, Uniswap V3, and SushiSwap**.

The entry point of the program is `scripts/findprofit.js`. From there, the bot analyzes transactions, decodes them, simulates the effects on liquidity pools, and attempts to build optimal arbitrage routes using WETH as the main token.

---

## 🔎 Transaction Decoding

1. **Transaction Scanning**

   * The bot monitors pending transactions in the mempool.
   * Checks if they go through DEX routers like Uniswap V2 Router, Uniswap V3 Router, or SushiSwap V2 Router.

2. **Decoding Process**

   * In `scripts/findprofit.js`, the function `decodeTransaction` attempts to decode each transaction.
   * If it matches a known router, the transaction data is decoded to extract:

     * Affected liquidity pools
     * Swap direction
     * Swap size

3. **Parsing Transaction Types**

   * The function `parseUniV2` in `scripts/parse.js` distinguishes between transaction types such as:

     * `swapExactTokensForTokens`
     * `swapTokensForExactETH`
     * `swapExactTokensForETH`
     * `and others`
   * For **Uniswap V3**, there is a special `execute` type, which is harder to decode since it's encoded in bytes.

4. **Uniswap V3 Execute Decoding**

   * Decoding for `execute` transactions is handled in `scripts/decodeV3.js`.
   * ABI is used to decode the transaction and extract the bytecode.
   * Function `decode_transaction` further decodes the bytecode into individual swaps (since multiple swaps can be wrapped in one transaction).

5. **Deadlines**

   * Transactions with expired deadlines are skipped.

---

## 💡 Simplification

The bot only works with swaps that include **WETH**, simplifying the route-building process, also it build swap routes only of length 2.

---

## 🔄 Building Arbitrage Routes

1. **Route Determination**

   * From `scripts/findprofit.js`, the function `getOptimalSwapRoute` is called.
   * Implementation is in `univ3.js`, which contains blockchain interaction logic.

2. **Logic**

   * Only **2-swap routes** are considered, and all swaps must involve WETH.
   * A prebuilt file `scripts/arb-config/token-to-pools.json` maps non-WETH tokens to their possible liquidity pools.
   * If a token is not in this config, the algorithm skips this swap.

3. **Process**

   * Identify which pool the target swap used.
   * Simulate the updated pool state after the swap using DEX math:

     * **Uniswap V2**: Simple reserve updates.
     * **Uniswap V3**: Complex simulation due to concentrated liquidity and cross-tick swaps (requires API calls for TickBitmap).
   * The affected pool becomes one leg of the arbitrage route.
   * A second pool is chosen from the JSON config.
   * Loop through pools to:

     * Compute exchange rates (using reserves)
     * Multiply exchange rates to find the most profitable route
   * Determine the **minimum WETH reserve** across chosen pools, which defines the maximum arbitrage amount.

---

## 📊 Optimal Input Calculation

* In `scripts/findprofit.js`, the function `calculateOptimalAmountIn` (from `univ3.js`) is used.
* The algorithm applies a **Ternary Search** to find the optimal input amount that maximizes profit.
* Outcome:

  * **Negative Profit**: output < input → skip
  * **Positive Profit**: output > input → execute arbitrage

---

## 🚀 Execution

If profit is found, the bot:

* Calls the smart contract.
* Provides pool information and swap amounts.
* Executes the arbitrage route.

---

## 📂 Project Structure

```
/scripts
 ├── findprofit.js        # Entry point, transaction scanning & route building
 ├── parse.js             # Decoding UniV2 transactions
 ├── decodeV3.js          # Decoding UniV3 execute transactions
 ├── univ3.js             # Blockchain interaction & route building logic
 ├── PoolsClasses.js      # V2, V3 Pools Classes with methods
 ├── interact.js          # Smartcontract call function
 └── arb-config
     └── token-to-pools.json   # Prebuilt mapping of tokens to liquidity pools
```

---

## ✅ Summary

This bot:

1. Monitors pending Ethereum transactions.
2. Decodes and simulates their impact on liquidity pools.
3. Builds optimal 2-swap arbitrage routes involving WETH.
4. Calculates optimal input size using ternary search.
5. Executes profitable arbitrage trades via a smart contract.

---


# Uniswap V3 Math

## Overview

This directory contains the mathematical logic and helper modules used to simulate and calculate Uniswap V3 swaps. These functions are essential for correctly simulating price impact, liquidity changes, and pool state transitions.

The Uniswap V3 math logic is implemented in the following files:

```
/scripts
 ├── FixedPoint96.js
 ├── FullMath.js
 ├── getTickBitMap.js
 ├── SqrtPriceMath.js
 ├── SwapMath.js
 ├── swapV3.js
 ├── TickBitmap.js
 └── TickMath.js
```

---

## 📖 References

The math implementation is based on the following resources:

1. [Uniswap V3 Book](https://uniswapv3book.com/milestone_0/uniswap-v3.html)
2. [Uniswap V3 Core Libraries](https://github.com/Uniswap/v3-core/tree/8f3e4645a08850d2335ead3d1a8d0c64fa44f222/contracts/libraries)

---

## 🔍 Understanding the Code

I am not going to explain the full logic of what happens in each file, since the math is quite extensive and interconnected.

The **best approach** is to:

* Go through the code directly.
* Visualize how each module, file, and function connects to one another.
* Cross-reference with the documentation above for deeper understanding.

---


# 🚀 Possible Future Improvements

Here are some potential directions to further improve the performance, accuracy, and efficiency of the arbitrage bot:

1. **Hardware & Node Setup**

   * Current bottleneck: API calls to the blockchain take too long, especially for **Uniswap V3 pools** (which are heavily used compared to V2).
   * Solution: Run a **local blockchain node** to speed up calls.
   * Challenge: Requires significant storage space, which is currently a limitation.

2. **Profit Calculation & Transaction Routing**

   * Improve logic by including **transaction fees** in profit calculation.
   * Instead of submitting to the public mempool, consider sending transactions **directly to validators**.
   * Explore **bundling transactions** together with the target transaction for better execution reliability.

3. **Expand Router Support**

   * Add support for more routers beyond Uniswap V2/V3 and SushiSwap.
   * Potential additions:

     * **Uniswap Universal Router**
     * **Uniswap V4 Router**

4. **Parallelization & Multi-Threading**

   * Introduce **parallel processing** to increase throughput:

     * One thread constantly fetches pending transactions.
     * A decoder thread processes them and passes decoded data.
     * Worker threads (or a pool of workers) analyze decoded transactions simultaneously.
   * This would significantly speed up transaction handling.

---

These improvements would make the arbitrage bot more **scalable, reliable, and competitive** in real-world conditions.
