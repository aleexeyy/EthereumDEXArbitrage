// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../lib/forge-std/src/SafeTransfer.sol";
import "../lib/forge-std/src/interfaces/IUniswapV2Router02.sol";
import "../lib/forge-std/src/interfaces/IUniswapV2Pair.sol";
import "../lib/forge-std/src/TransferHelper.sol";

interface ISwapRouter02 {
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

    struct ExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountOut;
        uint256 amountInMaximum;
        uint160 sqrtPriceLimitX96;
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        returns (uint256 amountIn);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}


contract EthHolder {

    using SafeTransfer for IERC20;
    address private constant UNISWAP_V2_FACTORY = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address private constant UNISWAP_V2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    IUniswapV2Router02 private V2router = IUniswapV2Router02(UNISWAP_V2_ROUTER);
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "Not the owner");
        require(address(this).balance >= amount, "Insufficient balance");
        payable(owner).transfer(amount);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getReserves(address _tokenA, address _tokenB) internal view returns (uint112 reserveA, uint112 reserveB) {
        address pair = IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(_tokenA, _tokenB);
        require(pair != address(0), "UniswapReserves: Pair does not exist");
        (uint112 reserve0, uint112 reserve1, ) = IUniswapV2Pair(pair).getReserves();

        address token0 = IUniswapV2Pair(pair).token0();

        if (_tokenA == token0) {
            reserveA = reserve0;
            reserveB = reserve1;
        } else {
            reserveA = reserve1;
            reserveB = reserve0;
        }
    }

    function getAmountOutV2(uint256 _amountIn, address _tokenIn, address _tokenOut) internal view returns (uint256 amountOut) {
        (uint112 reserveIn, uint112 reserveOut) = getReserves(_tokenIn, _tokenOut);
        require(_amountIn > 0, "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "UniswapV2Library: INSUFFICIENT_LIQUIDITY");
        uint amountInWithFee = _amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn*1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function swapExactInputV2(uint256 _amountIn, address _tokenIn, address _tokenOut)
        internal
        returns (uint256 amountOut)
    {
        uint256 amountOutMin = getAmountOutV2(_amountIn, _tokenIn, _tokenOut) * 995 / 1000;
        // IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);
        IERC20(_tokenIn).approve(address(V2router), _amountIn);

        address[] memory path;
        path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;

        uint256[] memory amounts = V2router.swapExactTokensForTokens(
            _amountIn, amountOutMin, path, address(this), block.timestamp
        );
        return amounts[1];
    }

    function simulateTransaction() external {
        swapExactInputV2(1000e18, 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2, 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);
    }
}