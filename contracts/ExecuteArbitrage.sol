// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../lib/forge-std/src/SafeTransfer.sol";
import "../lib/forge-std/src/TransferHelper.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";

interface ISwapRouterV3 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}


contract ExecuteArbitrage is FlashLoanSimpleReceiverBase {
    // using SafeTransfer for IERC20;
    // using SafeMath for uint256;

    address payable private immutable owner;

    address constant SWAP_ROUTER_UNISWAP_V3_ADDRESS = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address private constant SWAP_ROUTER_UNISWAP_V2_ADDRESS = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address private constant SWAP_ROUTER_SUSHI_V2_ADDRESS = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
    address private constant UNISWAP_V2_FACTORY_ADDRESS = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;

    IUniswapV2Router02 private constant uniswapV2Router = IUniswapV2Router02(SWAP_ROUTER_UNISWAP_V2_ADDRESS);
    IUniswapV2Router02 private constant sushiV2Router = IUniswapV2Router02(SWAP_ROUTER_SUSHI_V2_ADDRESS);
    ISwapRouterV3 private constant uniswapV3Router = ISwapRouterV3(SWAP_ROUTER_UNISWAP_V3_ADDRESS);

    bytes32 private constant UNISWAP = keccak256("Uniswap");
    bytes32 private constant V2 = keccak256("V2");

    struct PoolData {
        uint256 outputAmount;
        uint24 fee;
        bytes32 version;
        bytes32 DEX;
    } 

    constructor(address _provider) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_provider)) {
        owner = payable(msg.sender);
    }

    function swapOnV2(uint256 _amountIn, uint256 _minAmountOut, address _tokenIn, address _tokenOut, bytes32 _DEX) internal returns(uint256) {
        
        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;
        if (_DEX == UNISWAP) {
            IERC20(_tokenIn).approve(address(uniswapV2Router), _amountIn);
            uint256[] memory amounts = uniswapV2Router.swapExactTokensForTokens(_amountIn, _minAmountOut, path, address(this), block.timestamp);
            return amounts[1];
        } else {
            IERC20(_tokenIn).approve(address(sushiV2Router), _amountIn);
            uint256[] memory amounts = sushiV2Router.swapExactTokensForTokens(_amountIn, _minAmountOut, path, address(this), block.timestamp);
            return amounts[1];
        }
    }

    function swapOnV3(uint256 _amountIn, uint256 _minAmountOut, address _tokenIn, address _tokenOut, uint24 _fee) internal returns(uint256 amountOut) {
        IERC20(_tokenIn).approve(address(uniswapV3Router), _amountIn);
        ISwapRouterV3.ExactInputSingleParams memory params = ISwapRouterV3.ExactInputSingleParams({
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            fee: _fee,
            recipient: address(this),
            amountIn: _amountIn,
            amountOutMinimum: _minAmountOut,
            sqrtPriceLimitX96: 0
        });
        amountOut = uniswapV3Router.exactInputSingle(params);
    }

    function swapExactIn(uint256 amountIn, address notWETHToken, PoolData[] memory _route) internal returns(uint256) {
        address tokenIn = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        address tokenOut = notWETHToken;

        for (uint256 i = 0; i < _route.length; i++) {
            uint256 minimumOutputAmount = _route[i].outputAmount;
            uint24 fee = _route[i].fee;
            bytes32 version = _route[i].version;
            bytes32 DEX = _route[i].DEX;
            

            if (version == keccak256("V2")) {

                amountIn = swapOnV2(amountIn, minimumOutputAmount, tokenIn, tokenOut, DEX);
            } else {
                amountIn = swapOnV3(amountIn, minimumOutputAmount , tokenIn, tokenOut, fee);
            }

            (tokenIn, tokenOut) = (tokenOut, tokenIn);
        }
        return amountIn;
    }


    function executeOperation(
        address _asset,
        uint256 _amount,
        uint256 _premium,
        address _initiator,
        bytes calldata _params
    ) external override returns (bool) {
        require(_initiator == address(this), "Flash Loan was not initiated by this contract");
        (address notWETHToken, PoolData[] memory route) = abi.decode(_params, (address, PoolData[]));
        uint256 finalOutputAmount = swapExactIn(_amount, notWETHToken, route);

        uint256 amountOwned = _amount + _premium;
        assert(finalOutputAmount > amountOwned);

        IERC20(_asset).approve(address(POOL), amountOwned);



        return true;
    }
    
    function requestFlashLoan(uint256 _amount, address _notWETHToken, PoolData[] calldata _route) external onlyOwner {
        address receiverAddress = address(this);
        address asset = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        uint256 amount = _amount;
        bytes memory params = abi.encode(_notWETHToken, _route);
        uint16 referralCode = 0;
        POOL.flashLoanSimple(receiverAddress, asset, amount, params, referralCode);
    }

    function getBalance(address _tokenAddress) external view returns(uint256) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    function withdraw(address _tokenAddress) external onlyOwner {
        IERC20 token = IERC20(_tokenAddress);
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner of the contract can call this function");
        _;
    }

    receive() external payable {}
}