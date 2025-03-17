    const { ethers } = require("ethers");
    const fs = require("fs");
    
    // Read ABI and bytecode from Foundry's output directory
    const contractJSON = JSON.parse(fs.readFileSync("../out/ExecuteArbitrage.sol/ExecuteArbitrage.json", "utf-8"));
    const contractABI = contractJSON.abi;
    const contractBytecode = contractJSON.bytecode;

    // Set up provider and wallet
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    const wallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);

    
    
    async function deploy() {
        // Deploy contract using ABI and bytecode
        const factory = new ethers.ContractFactory(contractABI, contractBytecode, wallet);
        const contract = await factory.deploy("0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e", {
            gasLimit: 5000000,  // Adjust gas limit (if needed)
            maxFeePerGas: ethers.utils.parseUnits('50', 'gwei'),  // Adjust maxFeePerGas
            maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei')
        });
    
        await contract.deployed();
        console.log("Contract deployed to:", contract.address);

    
        // Optionally interact with your contract here
        // Example: const balance = await contract.getBalance(wallet.address);
        // console.log("Balance:", balance.toString());
    }
    
    deploy().then(() => {
        console.log("Deployment successful");
    }).catch((error) => {
        console.error("Error deploying contract:", error);
    });
    
