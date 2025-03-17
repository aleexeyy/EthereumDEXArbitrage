// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "../lib/forge-std/src/Test.sol";
import "../lib/forge-std/src/Vm.sol";
import {ExecuteArbitrage} from "../src/ExecuteArbitrage.sol";
import {IWETH, FundWithWETH} from "../src/WrapEther.sol";

contract ExecuteArbitrageTest is Test {
    ExecuteArbitrage public executeArbitrageContract;
    FundWithWETH public wethToken;
    address user = address(1);


    function setUp() public {
        executeArbitrageContract = new ExecuteArbitrage(0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e);
        wethToken = new FundWithWETH();
        wethToken.wrapEther{value : 10000e18}();

        wethToken.fundContractWithWETH(address(executeArbitrageContract), 200e18);

    }

    function testRequestFlashLoan() public {
        uint256 amountIn = 0x4461a173e8e38554; // BigNumber from input
        address token = 0x64c5cbA9A1BfBD2A5faf601D91Beff2dCac2c974; // notWETHToken

        ExecuteArbitrage.PoolData[] memory swapRoute = new ExecuteArbitrage.PoolData[](2);
        swapRoute[0] = ExecuteArbitrage.PoolData({
            outputAmount: 756589230006396102402915313883,
            fee: 10000,  // uint24
            version: 0x5633000000000000000000000000000000000000000000000000000000000000,
            DEX: 0x556e697377617000000000000000000000000000000000000000000000000000
        });

        swapRoute[1] = ExecuteArbitrage.PoolData({
            outputAmount: 272654791936756302056489861454, // Adjust based on your expected output
            fee: 3000,
            version: 0x5632000000000000000000000000000000000000000000000000000000000000,
            DEX: 0x556e697377617000000000000000000000000000000000000000000000000000
        });

        uint256 oldAmount = executeArbitrageContract.getBalance(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        assertEq(oldAmount, 200e18);


        executeArbitrageContract.requestFlashLoan(amountIn, token, swapRoute);

        uint256 newAmount = executeArbitrageContract.getBalance(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

        assertGt(newAmount, 0);

        // console.log("New Amount After Swap: ", newAmount);
    }




}