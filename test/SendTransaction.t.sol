// // SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

// import {Test, console} from "forge-std/Test.sol";
// import {EthHolder} from "../src/SendTransaction.sol";
// import {Arbitrage} from "../src/Counter.sol";

// import "../src/WrapEther.sol";
// import "../lib/forge-std/src/SafeTransfer.sol";

// contract TransactionTest is Test {
//     using SafeTransfer for IERC20;

//     EthHolder ethHolder;
//     function setUp() public {
//         ethHolder = new EthHolder();
//     }
//     uint256 amountOfWETHtoWrap = 6000;
//     function test_Transaction() public {
//         //Wraping ETH
//         FundWithWETH fundWithWETH = new FundWithWETH();
//         fundWithWETH.wrapEther{value: amountOfWETHtoWrap * 10**18}();
//         console.log("Wrapped", amountOfWETHtoWrap, "Ether into WETH");

//         //Funding Contract
//         address FUNDED_CONTRACT = address(ethHolder);
//         fundWithWETH.fundContractWithWETH(FUNDED_CONTRACT, amountOfWETHtoWrap * 10**18);
//         uint256 balance = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).balanceOf(FUNDED_CONTRACT);
//         console.log("Contract Balance After Funding:", balance);
        
//         //Creating Arbitrage Opportunity
//         ethHolder.simulateTransaction();
//         balance = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599).balanceOf(FUNDED_CONTRACT);
//         console.log("Contract balance in WBTC after Transaction:", balance);

//         //Arbitrage
//         Arbitrage arbitrage = new Arbitrage(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
//         address ARBITRAGE_ADDRESS = address(arbitrage);
//         arbitrage.executeArbitrage([
//             [0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, 0x0000000000000000000000000000000000000bb8], 
//             [0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, 0x0000000000000000000000000000000000000001]], 
//             200e18);
//         balance = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2).balanceOf(ARBITRAGE_ADDRESS);
//         console.log("Arbitrage Contract Final Balance: ", balance);
//     }
// }
