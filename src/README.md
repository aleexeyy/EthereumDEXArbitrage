# Smart Contracts

## Overview

This directory contains the Solidity smart contracts used by the arbitrage bot. The contracts handle flash loans, token swaps, and testing utilities.

### File Structure

```
/src
 ├── ExecuteArbitrage.sol   # Main arbitrage contract
 ├── SendTransaction.sol    # Testing contract
 └── WrapEther.sol          # Testing contract
```

---

## ⚡ ExecuteArbitrage.sol

The core contract called by the bot to perform arbitrage.

* **Inputs:**

  * A non-WETH token (since one token is always WETH, we omit WETH data to save gas)
  * Route (swap path)
  * Amount

* **Key Functions:**

  * `requestFlashLoan`: Initiates a flash loan from Aave.
  * `executeOperation`: Default callback function required by Aave's flash loan system.

    * Decodes input parameters.
    * Calls `swapExactIn`, which:

      * Determines whether the swap should be executed on Uniswap V2 or V3.
      * Executes swaps across two pools using the correct DEX router.
    * After swaps are complete, repays the flash loan amount back to Aave.

---

## 🧪 Testing Contracts

* **SendTransaction.sol**

  * Utility contract for testing transaction flow.

* **WrapEther.sol**

  * Utility contract for testing WETH wrapping/unwrapping.

---

## ✅ Summary

* `ExecuteArbitrage.sol` is the **main contract** that manages arbitrage logic, flash loans, and pool swaps.
* `SendTransaction.sol` and `WrapEther.sol` are **support/testing contracts**.

---
