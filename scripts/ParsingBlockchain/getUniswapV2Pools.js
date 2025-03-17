const fs = require('fs');
const axios = require('axios');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const appendFileAsync = promisify(fs.appendFile);
const path = require('path');

// Configuration
const UNISWAP_V2_FACTORY_ADDRESS = '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // Wrapped ETH address on Ethereum mainnet
const OUTPUT_FILE = 'sushiswap_v2_weth_pairs.json';
const TOKEN_METADATA_FILE = 'sushi_token_metadata.json';
const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;
const LOG_FILE = 'sushi_fetcher.log';

// Create a stream for logging
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Logger with different levels
const logger = {
  info: (message) => {
    const logMessage = `[${new Date().toISOString()}] INFO: ${message}`;
    console.log(logMessage);
    logStream.write(logMessage + '\n');
  },
  error: (message, error) => {
    const logMessage = `[${new Date().toISOString()}] ERROR: ${message}${error ? ' - ' + error.message : ''}`;
    console.error(logMessage);
    logStream.write(logMessage + '\n');
    if (error && error.stack) {
      logStream.write(`[${new Date().toISOString()}] STACK: ${error.stack}\n`);
    }
  },
  debug: (message, data) => {
    const logMessage = `[${new Date().toISOString()}] DEBUG: ${message}`;
    console.log(logMessage);
    if (data) {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      logStream.write(logMessage + '\n' + dataStr + '\n');
    } else {
      logStream.write(logMessage + '\n');
    }
  },
  retry: (message) => {
    const logMessage = `[${new Date().toISOString()}] RETRY: ${message}`;
    console.log(logMessage);
    logStream.write(logMessage + '\n');
  }
};

// API Endpoints
const endpoints = [
  {
    name: 'Endpoint 1',
    url: `https://eth-mainnet.g.alchemy.com/v2/ifbux2lDtNf63qjvhI6A3M53YsLthsoO`,
  },
  {
    name: 'Endpoint 2',
    url: `https://eth-mainnet.g.alchemy.com/v2/2zjJDflumUqtW-sHxvsvYQYdzDH1oPBv`,
  },
  {
    name: 'Endpoint 3',
    url: `https://eth-mainnet.g.alchemy.com/v2/1OSAlFFrFJ17QeARZcLYIkIlsmOPJ2SE`,
  }
];

// Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Adaptive rate limiter with performance tracking
class AdaptiveRateLimiter {
  constructor(initialRate = 200, timeWindow = 1000) {
    this.rate = initialRate;
    this.timeWindow = timeWindow;
    this.timestamps = [];
    this.successCount = 0;
    this.failureCount = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.adjustmentInterval = 50; // Adjust rate every 50 operations
    this.operationCount = 0;
  }

  async limit() {
    const now = Date.now();
    
    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(ts => ts > now - this.timeWindow);
    
    // If we're at capacity, wait
    if (this.timestamps.length >= this.rate) {
      const oldestTimestamp = this.timestamps[0];
      const waitTime = Math.max(oldestTimestamp + this.timeWindow - now, 0);
      await sleep(waitTime + 5); // Add small buffer to ensure we're outside the window
    }
    
    // Add the current timestamp
    this.timestamps.push(Date.now());
    
    // Adjust the rate periodically
    this.operationCount++;
    if (this.operationCount % this.adjustmentInterval === 0) {
      this.adjustRate();
    }
  }

  recordSuccess() {
    this.successCount++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
  }

  recordFailure() {
    this.failureCount++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    
    // Immediate adjustment for consecutive failures
    if (this.consecutiveFailures >= 3) {
      this.rate = Math.max(50, this.rate * 0.8);
      logger.info(`Rate reduced to ${this.rate} after ${this.consecutiveFailures} consecutive failures`);
      this.consecutiveFailures = 0;
    }
  }

  adjustRate() {
    const totalOps = this.successCount + this.failureCount;
    if (totalOps === 0) return;
    
    const successRate = this.successCount / totalOps;
    
    if (successRate > 0.95 && this.consecutiveSuccesses > 20) {
      // Gradually increase rate if we're doing well
      this.rate = Math.min(300, this.rate * 1.1);
      logger.info(`Rate increased to ${this.rate} (success rate: ${(successRate * 100).toFixed(2)}%)`);
    } else if (successRate < 0.8) {
      // Reduce rate if we're seeing too many failures
      this.rate = Math.max(50, this.rate * 0.9);
      logger.info(`Rate reduced to ${this.rate} (success rate: ${(successRate * 100).toFixed(2)}%)`);
    }
    
    // Reset counters for next interval
    this.successCount = 0;
    this.failureCount = 0;
  }
}

// Endpoint manager to track performance and select optimal endpoints
class EndpointManager {
  constructor(endpoints) {
    this.endpoints = endpoints.map(endpoint => ({
      ...endpoint,
      successCount: 0,
      failureCount: 0,
      averageResponseTime: 200,
      lastUsed: 0,
      limiter: new AdaptiveRateLimiter()
    }));
  }

  selectEndpoint() {
    const now = Date.now();
    
    // Calculate a score for each endpoint based on performance metrics
    return this.endpoints.sort((a, b) => {
      // Calculate success rates with a small constant to avoid division by zero
      const aTotal = a.successCount + a.failureCount + 1;
      const bTotal = b.successCount + b.failureCount + 1;
      const aSuccessRate = a.successCount / aTotal;
      const bSuccessRate = b.successCount / bTotal;
      
      // Calculate time since last used
      const aTimeFactor = (now - a.lastUsed) / 1000; // seconds since last used
      const bTimeFactor = (now - b.lastUsed) / 1000;
      
      // Response time factor - lower is better
      const aResponseFactor = 1000 / (a.averageResponseTime + 50);
      const bResponseFactor = 1000 / (b.averageResponseTime + 50);
      
      // Combine factors - weight success rate most heavily
      const aScore = (aSuccessRate * 0.6) + (aTimeFactor * 0.2) + (aResponseFactor * 0.2);
      const bScore = (bSuccessRate * 0.6) + (bTimeFactor * 0.2) + (bResponseFactor * 0.2);
      
      return bScore - aScore; // Higher score is better
    })[0];
  }

  async executeRequest(requestFn) {
    const endpoint = this.selectEndpoint();
    const startTime = Date.now();
    endpoint.lastUsed = startTime;
    
    try {
      // Apply rate limiting
      await endpoint.limiter.limit();
      
      // Execute the request
      const result = await requestFn(endpoint);
      
      // Record metrics
      const responseTime = Date.now() - startTime;
      endpoint.averageResponseTime = endpoint.averageResponseTime * 0.9 + responseTime * 0.1;
      endpoint.successCount++;
      endpoint.limiter.recordSuccess();
      
      return result;
    } catch (error) {
      endpoint.failureCount++;
      endpoint.limiter.recordFailure();
      throw error;
    }
  }

  getEndpointStats() {
    return this.endpoints.map(endpoint => ({
      name: endpoint.name,
      successCount: endpoint.successCount,
      failureCount: endpoint.failureCount,
      averageResponseTime: Math.round(endpoint.averageResponseTime),
      successRate: endpoint.successCount / (endpoint.successCount + endpoint.failureCount + 1)
    }));
  }
}

// Create the endpoint manager
const endpointManager = new EndpointManager(endpoints);

// Smart retry mechanism with exponential backoff
async function executeWithRetry(operation, operationName = 'Operation', maxRetries = MAX_RETRIES, initialDelay = RETRY_DELAY) {
  let retries = 0;
  let lastError = null;
  
  while (retries <= maxRetries) {
    try {
      if (retries > 0) {
        logger.retry(`${operationName}: Attempt ${retries + 1}/${maxRetries + 1} started`);
      }
      
      const result = await operation();
      
      if (retries > 0) {
        logger.retry(`${operationName}: Retry succeeded after ${retries} attempts`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      retries++;
      
      if (retries <= maxRetries) {
        const delay = initialDelay * Math.pow(1.5, retries); // Exponential backoff
        logger.retry(`${operationName}: Attempt ${retries}/${maxRetries} failed with error: ${error.message}. Retrying after ${delay}ms delay`);
        await sleep(delay);
      } else {
        logger.retry(`${operationName}: All ${maxRetries + 1} attempts failed. Giving up.`);
        logger.error(`${operationName}: Failed after ${maxRetries} retries`, lastError);
        throw lastError;
      }
    }
  }
}

// Function to get the total number of pools from the Uniswap V2 Factory
async function getTotalPoolCount() {
  return executeWithRetry(async () => {
    const response = await endpointManager.executeRequest(endpoint => 
      axios.post(endpoint.url, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: UNISWAP_V2_FACTORY_ADDRESS,
            data: '0x574f2ba3' // Function signature of allPairsLength()
          },
          'latest'
        ]
      })
    );
    
    if (!response || !response.data || !response.data.result) {
      throw new Error('Invalid response format');
    }
    
    const totalPools = parseInt(response.data.result, 16);
    logger.info(`Total Sushiswap V2 pools found: ${totalPools}`);
    return totalPools;
  }, 'GetTotalPoolCount');
}

// Function to get a pool address by index
async function getPoolByIndex(index) {
  return executeWithRetry(async () => {
    // Format the index parameter for the Ethereum call
    const indexHex = index.toString(16).padStart(64, '0');
    const callData = `0x1e3dd18b${indexHex}`;
    
    const response = await endpointManager.executeRequest(endpoint => 
      axios.post(endpoint.url, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: UNISWAP_V2_FACTORY_ADDRESS,
            data: callData
          },
          'latest'
        ]
      })
    );
    
    if (!response || !response.data || !response.data.result) {
      throw new Error('Invalid response format');
    }
    
    const result = response.data.result;
    
    // Handle empty or invalid results
    if (!result || result === '0x' || result === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return '0x0000000000000000000000000000000000000000';
    }
    
    // Extract the address
    let poolAddress;
    if (result.length >= 42) {
      poolAddress = '0x' + result.substring(result.length - 40);
    } else if (result.length >= 26) {
      poolAddress = '0x' + result.slice(26);
    } else {
      throw new Error(`Result too short to extract address: ${result}`);
    }
    
    // Validate address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(poolAddress)) {
      throw new Error(`Invalid address format: ${poolAddress}`);
    }
    
    return poolAddress;
  }, `GetPoolByIndex(${index})`);
}

// Get token addresses from a pool
async function getPoolTokens(poolAddress) {
  // Skip invalid addresses
  if (poolAddress === '0x0000000000000000000000000000000000000000') {
    return null;
  }
  
  try {
    // Call token0() function - selector: 0x0dfe1681
    const token0Response = await executeWithRetry(() => 
      endpointManager.executeRequest(endpoint => 
        axios.post(endpoint.url, {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            {
              to: poolAddress,
              data: '0x0dfe1681'
            },
            'latest'
          ]
        })
      )
    , `GetToken0(${poolAddress})`);
    
    // Call token1() function - selector: 0xd21220a7
    const token1Response = await executeWithRetry(() => 
      endpointManager.executeRequest(endpoint => 
        axios.post(endpoint.url, {
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_call',
          params: [
            {
              to: poolAddress,
              data: '0xd21220a7'
            },
            'latest'
          ]
        })
      )
    , `GetToken1(${poolAddress})`);
    
    // Extract token addresses
    const token0Result = token0Response.data.result;
    const token1Result = token1Response.data.result;
    
    if (!token0Result || !token1Result) {
      throw new Error(`Failed to get tokens for pool ${poolAddress}`);
    }
    
    const token0 = '0x' + token0Result.slice(-40);
    const token1 = '0x' + token1Result.slice(-40);
    
    return { token0, token1 };
  } catch (error) {
    logger.error(`Error fetching tokens for pool ${poolAddress}`, error);
    return null;
  }
}

// Get token decimals
async function getTokenDecimals(tokenAddress) {
  try {
    // Call decimals() function - selector: 0x313ce567
    const response = await executeWithRetry(() => 
      endpointManager.executeRequest(endpoint => 
        axios.post(endpoint.url, {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            {
              to: tokenAddress,
              data: '0x313ce567'
            },
            'latest'
          ]
        })
      )
    , `GetTokenDecimals(${tokenAddress})`);
    
    const result = response.data.result;
    if (!result) {
      throw new Error(`Failed to get decimals for token ${tokenAddress}`);
    }
    
    return parseInt(result, 16);
  } catch (error) {
    logger.error(`Error fetching decimals for token ${tokenAddress}`, error);
    return null;
  }
}

// Concurrency controller for parallel processing
class ConcurrencyController {
  constructor(initialConcurrency = 20) {
    this.maxConcurrent = initialConcurrency;
    this.activeCount = 0;
    this.queue = [];
    this.successCount = 0;
    this.failureCount = 0;
  }
  
  async execute(fn) {
    return new Promise((resolve, reject) => {
      // Add to queue
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    // If we're at max capacity or queue is empty, return
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    
    // Process as many items as we can
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      this.activeCount++;
      
      // Execute the function
      fn().then(result => {
        this.activeCount--;
        this.successCount++;
        resolve(result);
        this.processQueue();
      }).catch(error => {
        this.activeCount--;
        this.failureCount++;
        reject(error);
        this.processQueue();
      });
    }
  }
  
  // Adjust concurrency based on success rate
  adjustConcurrency() {
    const total = this.successCount + this.failureCount;
    if (total < 50) return; // Not enough data to adjust
    
    const successRate = this.successCount / total;
    
    if (successRate > 0.95 && this.maxConcurrent < 50) {
      this.maxConcurrent += 5;
      logger.info(`Increased concurrency to ${this.maxConcurrent}`);
    } else if (successRate < 0.8 && this.maxConcurrent > 10) {
      this.maxConcurrent -= 5;
      logger.info(`Decreased concurrency to ${this.maxConcurrent}`);
    }
    
    // Reset counters
    this.successCount = 0;
    this.failureCount = 0;
  }
}

// Create concurrency controller
const concurrencyController = new ConcurrencyController();

// Save results with efficient streaming approach
class ResultManager {
  constructor() {
    this.processedCount = 0;
    this.wethPairCount = 0;
    this.lastSaveTime = Date.now();
    this.saveInterval = 60000; // Save every minute
    this.tokenMetadata = new Map(); // Use a Map for better key-value performance
    this.retryStats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0
    };
    
    // Initialize WETH token data once
    this.WETH_LOWER = WETH_ADDRESS.toLowerCase();
    
    // Create directory if it doesn't exist
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Initialize stream for incremental pair saving
    this.pairStream = fs.createWriteStream(OUTPUT_FILE + '.temp', { flags: 'w' });
    this.pairStream.write('[\n'); // Start JSON array
  }
  
  addWethPair(poolAddress, otherTokenAddress) {
    const pair = {
      poolAddress,
      otherTokenAddress
    };
    
    this.wethPairCount++;
    
    // Write to stream with proper JSON formatting
    const pairJson = JSON.stringify(pair);
    this.pairStream.write(this.wethPairCount > 1 ? `,\n${pairJson}` : pairJson);
    
    // Try to save periodically
    this.processedCount++;
    const now = Date.now();
    if (now - this.lastSaveTime > this.saveInterval) {
      this.saveProgress();
      this.lastSaveTime = now;
    }
  }
  
  async addTokenMetadata(tokenAddress, decimals) {
    // Only add if we don't already have it
    if (!this.tokenMetadata.has(tokenAddress.toLowerCase())) {
      this.tokenMetadata.set(tokenAddress.toLowerCase(), { 
        address: tokenAddress, 
        decimals
      });
      
      // Special logging for first few tokens
      if (this.tokenMetadata.size <= 10) {
        logger.debug(`Added token metadata: ${tokenAddress} (decimals: ${decimals})`);
      }
    }
  }
  
  updateRetryStats(success) {
    this.retryStats.totalRetries++;
    if (success) {
      this.retryStats.successfulRetries++;
    } else {
      this.retryStats.failedRetries++;
    }
  }
  
  async saveProgress() {
    try {
      // Save processing statistics
      const stats = {
        timestamp: new Date().toISOString(),
        processedCount: this.processedCount,
        wethPairCount: this.wethPairCount,
        uniqueTokens: this.tokenMetadata.size,
        retryStats: this.retryStats,
        endpointStats: endpointManager.getEndpointStats()
      };
      
      await writeFileAsync('sushiswap_fetcher_stats.json', JSON.stringify(stats, null, 2));
      logger.info(`Progress saved: ${this.processedCount} pools processed, ${this.wethPairCount} WETH pairs found, ${this.tokenMetadata.size} unique tokens, retries: ${this.retryStats.totalRetries} (${this.retryStats.successfulRetries} successful)`);
      
      // Save token metadata periodically
      await this.saveTokenMetadata();
    } catch (error) {
      logger.error('Error saving progress', error);
    }
  }
  
  async saveTokenMetadata() {
    try {
      // Convert Map to Array for JSON serialization
      const tokenArray = Array.from(this.tokenMetadata.values());
      await writeFileAsync(TOKEN_METADATA_FILE, JSON.stringify(tokenArray, null, 2));
      logger.info(`Token metadata saved: ${tokenArray.length} tokens`);
    } catch (error) {
      logger.error('Error saving token metadata', error);
    }
  }
  
  async finalizeResults() {
    // Close the JSON array in the stream
    this.pairStream.write('\n]');
    this.pairStream.end();
    
    // Rename temp file to final file
    await new Promise(resolve => {
      this.pairStream.on('finish', () => {
        fs.renameSync(OUTPUT_FILE + '.temp', OUTPUT_FILE);
        resolve();
      });
    });
    
    // Final save of token metadata
    await this.saveTokenMetadata();
    
    // Save final stats
    const finalStats = {
      completed: true,
      timestamp: new Date().toISOString(),
      totalProcessed: this.processedCount,
      totalWethPairs: this.wethPairCount,
      totalUniqueTokens: this.tokenMetadata.size,
      retryStats: this.retryStats,
      endpointStats: endpointManager.getEndpointStats()
    };
    
    await writeFileAsync('sushiswap_fetcher_final_stats.json', JSON.stringify(finalStats, null, 2));
    logger.info(`Final results saved: ${this.wethPairCount} WETH pairs, ${this.tokenMetadata.size} unique tokens`);
    logger.info(`Retry statistics: ${this.retryStats.totalRetries} total retries, ${this.retryStats.successfulRetries} successful (${(this.retryStats.successfulRetries / this.retryStats.totalRetries * 100).toFixed(2)}%), ${this.retryStats.failedRetries} failed`);
  }
}

// Create result manager
const resultManager = new ResultManager();

// Track retries globally
// Monkey patch the executeWithRetry function to track retries
const originalExecuteWithRetry = executeWithRetry;
executeWithRetry = async function(operation, operationName = 'Operation', maxRetries = MAX_RETRIES, initialDelay = RETRY_DELAY) {
  let retries = 0;
  let lastError = null;
  
  while (retries <= maxRetries) {
    try {
      if (retries > 0) {
        logger.retry(`${operationName}: Attempt ${retries + 1}/${maxRetries + 1} started`);
      }
      
      const result = await operation();
      
      if (retries > 0) {
        logger.retry(`${operationName}: Retry succeeded after ${retries} attempts`);
        resultManager.updateRetryStats(true);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      retries++;
      
      if (retries <= maxRetries) {
        const delay = initialDelay * Math.pow(1.5, retries); // Exponential backoff
        logger.retry(`${operationName}: Attempt ${retries}/${maxRetries} failed with error: ${error.message}. Retrying after ${delay}ms delay`);
        await sleep(delay);
      } else {
        logger.retry(`${operationName}: All ${maxRetries + 1} attempts failed. Giving up.`);
        logger.error(`${operationName}: Failed after ${maxRetries} retries`, lastError);
        if (retries > 1) {
          resultManager.updateRetryStats(false);
        }
        throw lastError;
      }
    }
  }
};

// Process pool and check if it's a WETH pair
async function processPool(index) {
  try {
    // Step 1: Get pool address
    const poolAddress = await getPoolByIndex(index);
    
    // Skip invalid pools
    if (poolAddress === '0x0000000000000000000000000000000000000000') {
      return { success: true, wethPair: false };
    }
    
    // Step 2: Get token addresses
    const tokenInfo = await getPoolTokens(poolAddress);
    if (!tokenInfo) {
      return { success: false };
    }
    
    // Step 3: Check if either token is WETH
    const { token0, token1 } = tokenInfo;
    const token0Lower = token0.toLowerCase();
    const token1Lower = token1.toLowerCase();
    let isWethPair = false;
    let otherTokenAddress = null;
    
    if (token0Lower === resultManager.WETH_LOWER) {
      isWethPair = true;
      otherTokenAddress = token1;
    } else if (token1Lower === resultManager.WETH_LOWER) {
      isWethPair = true;
      otherTokenAddress = token0;
    }
    
    // Step 4: If it's a WETH pair, process the other token and save the pair
    if (isWethPair) {
      // Only fetch token decimals if we don't already have them in our metadata
      const otherTokenLower = otherTokenAddress.toLowerCase();
      if (!resultManager.tokenMetadata.has(otherTokenLower)) {
        const otherDecimals = await getTokenDecimals(otherTokenAddress);
        await resultManager.addTokenMetadata(otherTokenAddress, otherDecimals);
      }
      
      // Save the pair (without repeating WETH address)
      resultManager.addWethPair(poolAddress, otherTokenAddress);
      
      if (resultManager.wethPairCount % 100 === 0) {
        logger.info(`Found ${resultManager.wethPairCount} WETH pairs so far`);
      }
    }
    
    return { success: true, wethPair: isWethPair };
  } catch (error) {
    logger.error(`Error processing pool at index ${index}`, error);
    return { success: false, error: error.message };
  }
}

// Optimized worker function for parallel processing
async function worker(poolIndices) {
  const results = {
    processed: 0,
    successful: 0,
    wethPairs: 0,
    failed: 0
  };
  
  for (const index of poolIndices) {
    try {
      const result = await concurrencyController.execute(() => processPool(index));
      
      results.processed++;
      
      if (result.success) {
        results.successful++;
        if (result.wethPair) {
          results.wethPairs++;
        }
      } else {
        results.failed++;
      }
      
      // Log progress periodically
      if (results.processed % 500 === 0) {
        logger.info(`Worker progress: ${results.processed}/${poolIndices.length} pools processed`);
      }
      
      // Adjust concurrency every 50 operations
      if (results.processed % 50 === 0) {
        concurrencyController.adjustConcurrency();
      }
    } catch (error) {
      results.processed++;
      results.failed++;
      logger.error(`Worker failed for pool index ${index}`, error);
    }
  }
  
  return results;
}
// Main function to process all pools
async function main() {
    try {
      logger.info('Starting enhanced Sushiswap V2 pool data collection...');
      
      // Initialize WETH decimals first to prevent multiple fetches
      const wethDecimals = await getTokenDecimals(WETH_ADDRESS);
      await resultManager.addTokenMetadata(WETH_ADDRESS, wethDecimals);
      logger.info(`Initialized WETH token with ${wethDecimals} decimals`);
      
      // Step 1: Get total pools count
      const totalPools = await getTotalPoolCount();
      
      // Step 2: Create chunks for processing
      const WORKER_COUNT = 8; // Number of parallel workers
      const poolsPerWorker = Math.ceil(totalPools / WORKER_COUNT);
      const workerChunks = [];
      
      for (let i = 0; i < WORKER_COUNT; i++) {
        const startIndex = i * poolsPerWorker;
        const endIndex = Math.min(startIndex + poolsPerWorker, totalPools);
        workerChunks.push(Array.from({ length: endIndex - startIndex }, (_, j) => startIndex + j));
      }
      
      logger.info(`Starting ${WORKER_COUNT} workers to process ${totalPools} pools`);
      
      // Step 3: Start workers in parallel
      const workerPromises = workerChunks.map((chunk, index) => 
        worker(chunk).then(results => {
          logger.info(`Worker ${index} completed: ${results.successful}/${results.processed} successful, ${results.wethPairs} WETH pairs found`);
          return results;
        })
      );
      
      // Step 4: Wait for all workers to complete
      const workerResults = await Promise.all(workerPromises);
      
      // Step 5: Aggregate results
      const totalResults = workerResults.reduce((acc, result) => {
        acc.processed += result.processed;
        acc.successful += result.successful;
        acc.wethPairs += result.wethPairs;
        acc.failed += result.failed;
        return acc;
      }, { processed: 0, successful: 0, wethPairs: 0, failed: 0 });
      
      // Step 6: Finalize and save results
      await resultManager.finalizeResults();
      
      logger.info(`Process completed successfully`);
      logger.info(`Total pools processed: ${totalResults.processed}/${totalPools}`);
      logger.info(`Successful pools: ${totalResults.successful} (${(totalResults.successful / totalResults.processed * 100).toFixed(2)}%)`);
      logger.info(`WETH pairs found: ${totalResults.wethPairs}`);
      logger.info(`Failed pools: ${totalResults.failed}`);
      
      // Close log stream
      logStream.end();
    } catch (error) {
      logger.error('Critical error in main process', error);
      
      // Try to save current progress before exiting
      try {
        await resultManager.saveProgress();
        await resultManager.saveTokenMetadata();
      } catch (e) {
        logger.error('Failed to save progress during error handling', e);
      }
      
      process.exit(1);
    }
  }
  
  // Start the process
  main();