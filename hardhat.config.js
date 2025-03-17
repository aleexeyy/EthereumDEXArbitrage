require("@nomiclabs/hardhat-ethers");
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version:"0.8.18",
    settings: {
        optimizer: {
          enabled: true, // Enable the optimizer
          runs: 200 // Number of optimization runs
        }
      }
  },
  networks: {
    // Hardhat network with mainnet forking (for testing against mainnet state)
    hardhat: {
      chainId: 1337,
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/1OSAlFFrFJ17QeARZcLYIkIlsmOPJ2SE`,  // Replace with your Alchemy/Infura URL
      },
      mining: {
        auto: true, // Auto mining of transactions
        interval: 12000, // 12 seconds block time
      },
    },
    // Localhost configuration for running a local blockchain (e.g., for real deployment and testing)
    localhost: {
      url: "http://127.0.0.1:8545", // Standard localhost URL for Hardhat node
    },
  }
};
