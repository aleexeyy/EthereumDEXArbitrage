const { ethers } = require("hardhat");
const { abi : IUniswapV2Router2} = require("./abi/UniswapV2Router2.json");
const { logSuccess } = require("./logging");
async function simulateSwap() {
  const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545"); // Local forked mainnet
  const signers = await ethers.getSigners();
  const signer = signers[3];
  const uniswapRouterAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap V2 Router

  const uniswapRouter = new ethers.Contract(uniswapRouterAddress, IUniswapV2Router2, signer);

  // Now you can call Uniswap's swap functions as if you're interacting with mainnet
  const amountIn = ethers.utils.parseUnits("200", 18); // 1 token
  const amountOutMin = 0;
  const path = ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 20 mins from now
  console.log("Simulating swap...");
  const swapTransaction = await uniswapRouter.swapExactETHForTokens(
    amountOutMin,
    path,
    signer.address,
    deadline,
    {value: amountIn}
  );

  const txHash = swapTransaction.hash;
  console.log(`Transaction Hash: ${txHash}`);

  const receipt = await swapTransaction.wait();
  console.log("Transaction was mined in block:", receipt.blockNumber);
    // console.log("Transaction Details:", receipt);
}
// simulateSwap();




async function sendWETHToContract() {
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    
    // Get the first account from Anvil
    const signer = provider.getSigner(0);

    // WETH contract on local Anvil (you may need to deploy your own)
    const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Replace with your local WETH address
    const CONTRACT_ADDRESS = "0x95D7fF1684a8F2e202097F28Dc2e56F773A55D02"; // Your smart contract address

    // WETH ABI (only the needed functions)
    const WETH_ABI = [
        "function deposit() public payable",
        "function transfer(address to, uint256 amount) public returns (bool)",
        "function balanceOf(address owner) public view returns (uint256)"
    ];

    // Connect to WETH contract
    const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);

    // Step 1: Deposit ETH into WETH
    console.log("Wrapping ETH into WETH...");
    const depositTx = await wethContract.deposit({ value: ethers.utils.parseEther("50") }); // 10 ETH
    await depositTx.wait();
    console.log("Deposited 50 WETH");

    // Step 2: Send WETH to your Arbitrage contract
    console.log(`Sending WETH to contract: ${CONTRACT_ADDRESS}`);
    const transferTx = await wethContract.transfer(CONTRACT_ADDRESS, ethers.utils.parseEther("30")); // Send 2 WETH
    await transferTx.wait();
    console.log("Sent 30 WETH to Arbitrage contract");



    // Step 3: Check balances
    const balance = await wethContract.balanceOf(CONTRACT_ADDRESS);
    console.log(`Contract WETH Balance: ${ethers.utils.formatEther(balance)} WETH`);
}

sendWETHToContract().catch(console.error);
module.exports = {
    simulateSwap,
}