
const { ethers } = require("hardhat");
const hre = require("hardhat");
function feeToAddress(value) {
    // Convert fee to a BigNumber and cast it to a 160-bit address
    const bigNum = ethers.BigNumber.from(value);
    // Convert the number into a 20-byte address
    const address = ethers.utils.getAddress(ethers.utils.hexZeroPad(bigNum.toHexString(), 20));
    return address;
}


async function callArbitrageContract(amountIn, notWETHToken, swapData) {
    const { logFatal, logSuccess, logDebug, logError, logTrace, logInfo } = require("./logging.js");

    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

    const signer = await provider.getSigner(0);


    const CONTRACT_ADDRESS = "0x1E53bea57Dd5dDa7bFf1a1180a2f64a5c9e222f5"; 

    const CONTRACT_ABI = [
        // Event definitions
        "event ReceivedInput(tuple(uint256 outputAmount, uint24 fee, bytes32 version, bytes32 DEX)[] route, address token)",
        "event Debug(string text)",
        "event DebugBytes(bytes32 text)",
        "event LogAmount(string text, uint256 amount)",
        
        // Function definitions
        "function requestFlashLoan(uint256 _amount, address _notWETHToken, tuple(uint256 outputAmount, uint24 fee, bytes32 version, bytes32 DEX)[] memory _route) external",
        "function getBalance(address _tokenAddress) external view returns(uint256)",
        "function withdraw(address _tokenAddress) external",
        
        // You can add other functions as needed
    ];

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    console.log("Address of the contract: ", contract.address);


    console.log("Available events:", Object.keys(contract.interface.events));




    contract.on("ReceivedInput", (route, token, event) => {
        console.log("ReceivedInput event detected!");
        console.log("Route:", route);
        console.log("Token:", token);
        console.log("Transaction Hash:", event.transactionHash);
    });
    
    contract.on("Debug", (text, event) => {
        console.log(`Debug event: ${text}`);
        console.log("Transaction Hash:", event.transactionHash);
    });
    
    console.log("Listening for events...");


   

    const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const WETH_ABI = [
        "function deposit() public payable",
        "function transfer(address to, uint256 amount) public returns (bool)",
        "function balanceOf(address owner) public view returns (uint256)"
    ]
    const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);

    console.log("Wrapping ETH into WETH...");
    const depositTx = await wethContract.deposit({ value: amountIn });
    await depositTx.wait();
    console.log(`Deposited ${ethers.utils.formatEther(amountIn)} WETH`);



    console.log(`Sending WETH to contract: ${CONTRACT_ADDRESS}`);
    const transferTx = await wethContract.transfer(CONTRACT_ADDRESS, amountIn);
    await transferTx.wait();
    console.log(`Sent ${ethers.utils.formatEther(amountIn)} WETH to Arbitrage contract`);

    try {
        const balance_before = ethers.BigNumber.from((await wethContract.balanceOf(CONTRACT_ADDRESS)).toString());
        console.log(`Contract WETH Balance Before Arbitrage: ${ethers.utils.formatEther(balance_before)} WETH`);
        
        logTrace("Amount WETH Borrowed: ", ethers.utils.formatEther(amountIn));
        
        const tx = await contract.requestFlashLoan(amountIn, notWETHToken, swapData, {gasLimit: 5000000});
        logDebug("Flash Loan requested - Transaction hash:", tx.hash);
        
        const receipt = await tx.wait();
        logSuccess("Transaction confirmed in block:", receipt.blockNumber);
        
        // Look through events in the receipt
        if (receipt.events) {
            console.log("Events emitted in transaction:");
            receipt.events.forEach((event, i) => {
                console.log(`Event ${i}:`, event.event || "Anonymous event");
                if (event.args) {
                    console.log("Arguments:", event.args);
                }
            });
        }
        
        const balance_after = ethers.BigNumber.from((await wethContract.balanceOf(CONTRACT_ADDRESS)).toString());
        console.log(`Contract WETH Balance After Arbitrage: ${ethers.utils.formatEther(balance_after)} WETH`);
        
        // Calculate profit/loss
        const profitLoss = balance_after.sub(balance_before);
        if (profitLoss.gt(0)) {
            logSuccess(`Profit: ${ethers.utils.formatEther(profitLoss)} WETH`);
        } else if (profitLoss.lt(0)) {
            logError(`Loss: ${ethers.utils.formatEther(profitLoss.abs())} WETH`);
        } else {
            logInfo("No profit or loss");
        }
        
    } catch (error) {
        logError("Error executing arbitrage:", error.message);
        if (error.data) {
            // Try to decode the error data if available
            try {
                const decodedError = contract.interface.parseError(error.data);
                logError("Decoded error:", decodedError);
            } catch (e) {
                logError("Raw error data:", error.data);
            }
        }
    }
    
    // Remove event listeners to prevent memory leaks
    contract.removeAllListeners();
    return;
}


async function test() {
    const  amountIn = "0x4461a173e8e38554"; // BigNumber from input
    const token = "0x64c5cbA9A1BfBD2A5faf601D91Beff2dCac2c974"; // notWETHToken

        const swapRoute = [
        {
            outputAmount: ethers.utils.parseEther("0"),
            fee: 10000,  // uint24
            version: "0x5633000000000000000000000000000000000000000000000000000000000000",
            DEX: "0x556e697377617000000000000000000000000000000000000000000000000000"
        },
        {
            outputAmount: ethers.utils.parseEther("0"), // Adjust based on your expected output
            fee: 3000,
            version: "0x5632000000000000000000000000000000000000000000000000000000000000",
            DEX: "0x556e697377617000000000000000000000000000000000000000000000000000"
        }];
        await callArbitrageContract(amountIn, token, swapRoute);
}
// test();
module.exports = {
    callArbitrageContract,
  };