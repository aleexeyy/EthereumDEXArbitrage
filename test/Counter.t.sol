
pragma solidity ^0.8.26;
// // SPDX-License-Identifier: UNLICENSED
// pragma solidity ^0.8.13;

// import {Test, console} from "forge-std/Test.sol";
// import {Arbitrage} from "../src/Counter.sol";

// contract CounterTest is Test {
//     Arbitrage public arbitrage;
//     // Fantom Input : 0xF491e7B69E4244ad4002BC14e878a34207E38c29, 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb
//     // Ethereum Input: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D, 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e
//     function setUp() public {
//         arbitrage = new Arbitrage(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
//     }

    
//     function test_ExecuteArbitrage() public {
//         // [[0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, 0x0000000000000000000000000000000000000001], [0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, 0x0000000000000000000000000000000000000000]], 3000, 2193e18
//         // Random: [[0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,0xdAC17F958D2ee523a2206206994597C13D831ec7,0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852],[0xdAC17F958D2ee523a2206206994597C13D831ec7,0xD1e64bcc904Cfdc19d0FABA155a9EdC69b4bcdAe,0x43a68A9f1F234e639B142F0ABa946B7Add26418d],[0xD1e64bcc904Cfdc19d0FABA155a9EdC69b4bcdAe,0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,0xc9B0831A0db5F6a74b6Cf9199B910Bdf9e0b63Ac]], 1000000000
//         // arbitrage.executeArbitrage([[0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599,0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, 0x0000000000000000000000000000000000000000],[0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, 0x0000000000000000000000000000000000000001]], 3000, 29683541510);
//         arbitrage.executeArbitrage([
//             [0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, 0x0000000000000000000000000000000000000001], 
//             [0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599, 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, 0x0000000000000000000000000000000000000bb8]], 
//             200e18
//             );}
// }
