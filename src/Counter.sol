// // SPDX-License-Identifier: MIT
// pragma solidity >=0.8.0;

// import "../lib/forge-std/src/SafeTransfer.sol";
// import "../lib/forge-std/src/TransferHelper.sol";
// import "../lib/forge-std/src/IQuoter.sol";

// import "../node_modules/@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
// import "../node_modules/@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
// import "@aave/protocol-v2/contracts/interfaces/IPoolAddressesProvider.sol";
// import "@aave/protocol-v2/contracts/interfaces/IPool.sol";
// import "@aave/protocol-v2/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";

// interface ISwapRouter02 {
//     struct ExactInputSingleParams {
//         address tokenIn;
//         address tokenOut;
//         uint24 fee;
//         address recipient;
//         uint256 amountIn;
//         uint256 amountOutMinimum;
//         uint160 sqrtPriceLimitX96;
//     }

//     function exactInputSingle(ExactInputSingleParams calldata params)
//         external
//         payable
//         returns (uint256 amountOut);

//     struct ExactOutputSingleParams {
//         address tokenIn;
//         address tokenOut;
//         uint24 fee;
//         address recipient;
//         uint256 amountOut;
//         uint256 amountInMaximum;
//         uint160 sqrtPriceLimitX96;
//     }

//     function exactOutputSingle(ExactOutputSingleParams calldata params)
//         external
//         payable
//         returns (uint256 amountIn);
// }

// interface IUniswapV2Router {
//     function swapExactTokensForTokens(
//         uint256 amountIn,
//         uint256 amountOutMin,
//         address[] calldata path,
//         address to,
//         uint256 deadline
//     ) external returns (uint256[] memory amounts);

//     function swapTokensForExactTokens(
//         uint256 amountOut,
//         uint256 amountInMax,
//         address[] calldata path,
//         address to,
//         uint256 deadline
//     ) external returns (uint256[] memory amounts);
// }

// interface IUniswapV2Factory {
//     function getPair(address tokenA, address tokenB) external view returns (address pair);
// }

// contract Arbitrage is FlashLoanSimpleReceiverBase {

//     using SafeTransfer for IERC20;
//     using SafeMath for uint256;

//     address private immutable owner;
//     address constant internal WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
//     address constant SWAP_ROUTER_UNISWAP_V3_ADDRESS = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
//     address private constant SWAP_ROUTER_UNISWAP_V2_ADDRESS = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
//     address private constant SWAP_ROUTER_SUSHI_V2_ADDRESS = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
//     address private constant UNISWAP_V2_FACTORY_ADDRESS = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;


//     IUniswapV2Router02 private constant uniswapV2Router = IUniswapV2Router02(SWAP_ROUTER_UNISWAP_V2_ADDRESS);
//     IUniswapV2Router02 private constant sushiV2Router = IUniswapV2Router02(SWAP_ROUTER_SUSHI_V2_ADDRESS);
//     ISwapRouter02 private constant uniswapV3Router = ISwapRouter02(SWAP_ROUTER_UNISWAP_V3_ADDRESS);  
    
//     // _provider = 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e

//     receive() external payable {}

//     function getReserves(address _tokenA, address _tokenB) internal view returns (uint112 reserveA, uint112 reserveB) {
//         address pair = IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(_tokenA, _tokenB);
//         require(pair != address(0), "UniswapReserves: Pair does not exist");
//         (uint112 reserve0, uint112 reserve1, ) = IUniswapV2Pair(pair).getReserves();

//         address token0 = IUniswapV2Pair(pair).token0();

//         if (_tokenA == token0) {
//             reserveA = reserve0;
//             reserveB = reserve1;
//         } else {
//             reserveA = reserve1;
//             reserveB = reserve0;
//         }
//     }

//     function getAmountOutV2(uint256 _amountIn, address _tokenIn, address _tokenOut) internal view returns (uint256 amountOut) {
//         (uint112 reserveIn, uint112 reserveOut) = getReserves(_tokenIn, _tokenOut);
//         require(_amountIn > 0, "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT");
//         require(reserveIn > 0 && reserveOut > 0, "UniswapV2Library: INSUFFICIENT_LIQUIDITY");
//         uint amountInWithFee = _amountIn * 997;
//         uint256 numerator = amountInWithFee * reserveOut;
//         uint256 denominator = (reserveIn*1000) + amountInWithFee;
//         amountOut = numerator / denominator;
//     }

//     function getAmountOutV3(uint256 _amountIn, address _tokenIn, address _tokenOut, uint24 _fee) internal returns(uint256 amountOut) {
//         (bool success, bytes memory result) = address(quoter).staticcall(
//             abi.encodeWithSelector(
//                 IQuoter.quoteExactInputSingle.selector,
//                 IQuoter.QuoteExactInputSingleParams({
//                     tokenIn: _tokenIn,
//                     tokenOut: _tokenOut,
//                     fee: _fee,
//                     amountIn: _amountIn,
//                     sqrtPriceLimitX96: 0
//                 })
//             )
//         );

//         if (success) {
//             amountOut = abi.decode(result, (uint256));
//         } else {
//             // Handle failure case
//             amountOut = 0;  // Or any fallback logic
//             emit Log_text("Quote failed, reverting to fallback");
//         }
//     }

//     // Uniswap V3
//     function swapExactInputV3(uint256 _amountIn, address _tokenIn, address _tokenOut, uint24 _fee)
//         internal returns (uint256 amountOut)
//     {
//         uint256 amountOutMin = 0;
//         amountOutMin = getAmountOutV3(_amountIn, _tokenIn, _tokenOut, _fee);
//         amountOutMin = amountOutMin * 995 / 1000;
//         IERC20(_tokenIn).approve(address(V3router), _amountIn);
//         ISwapRouter02.ExactInputSingleParams memory params = ISwapRouter02
//             .ExactInputSingleParams({
//             tokenIn: _tokenIn,
//             tokenOut: _tokenOut,
//             fee: _fee,
//             recipient: address(this),
//             amountIn: _amountIn,
//             amountOutMinimum: amountOutMin,
//             sqrtPriceLimitX96: 0
//         });

//         amountOut = V3router.exactInputSingle(params);
//     }
//     // Uniswap V2
//     function swapExactInputV2(uint256 _amountIn, address _tokenIn, address _tokenOut, bool _Sushi)
//         internal
//         returns (uint256 amountOut)
//     {
//         IUniswapV2Router02 V2router;
//         if (_Sushi == true) {
//             V2router = SushiV2router;
//         } else {
//             V2router = UniV2router;
//         }
//         uint256 amountOutMin = getAmountOutV2(_amountIn, _tokenIn, _tokenOut) * 995 / 1000;
//         // IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);
//         IERC20(_tokenIn).approve(address(V2router), _amountIn);

//         address[] memory path;
//         path = new address[](2);
//         path[0] = _tokenIn;
//         path[1] = _tokenOut;

//         uint256[] memory amounts = V2router.swapExactTokensForTokens(
//             _amountIn, amountOutMin, path, address(this), block.timestamp
//         );
//         return amounts[1];
//     }
//     // General function for swaps
//     function swapExactInput(uint256 _amountIn, address[3][2] memory _path) internal returns(uint256 amountTokenOut) {
//         // [tokenIn, tokenOut, isV2]
//         //need to work with amountOutMin
//         if (_path[0][2] == address(1)) { // first pool is V2
//             uint256 firstPoolAmountOut = swapExactInputV2(_amountIn, _path[0][0], _path[0][1], false);
//             emit Debug("Balance of the contract after 1st swap: ", IERC20(_path[0][1]).balanceOf(address(this)));
//             if (_path[1][2] == address(0)) {
//                 amountTokenOut = swapExactInputV2(firstPoolAmountOut, _path[1][0], _path[1][1], true);
//             } else {
//                 uint24 fee = uint24(uint160(_path[1][2]));
//                 amountTokenOut = swapExactInputV3(firstPoolAmountOut, _path[1][0], _path[1][1], fee);
//             }
//             emit Debug("Balance of the contract after 2nd swap: ", IERC20(_path[1][1]).balanceOf(address(this)));
//         }
//         else if (_path[1][2] == address(1)) { // second pool is V2
//             uint256 firstPoolAmountOut;
//             if (_path[0][2] == address(0)) {
//                 firstPoolAmountOut = swapExactInputV2(_amountIn, _path[0][0], _path[0][1], true);
//             } else {
//                 uint24 fee = uint24(uint160(_path[0][2]));
//                 firstPoolAmountOut = swapExactInputV3(_amountIn, _path[0][0], _path[0][1], fee);
//             }
//             emit Debug("Balance of the contract after 1st swap: ", IERC20(_path[0][1]).balanceOf(address(this)));
//             amountTokenOut = swapExactInputV2(firstPoolAmountOut, _path[1][0], _path[1][1], false);
//             emit Debug("Balance of the contract after 2nd swap: ", IERC20(_path[1][1]).balanceOf(address(this)));
//         }

//     }

//     constructor(address _provider) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_provider)) {
//         owner = msg.sender;
//     }

//     function recoverERC20(address token) public {
//         require(msg.sender == owner, "shoo");
//         IERC20(token).safeTransfer(
//             msg.sender,
//             IERC20(token).balanceOf(address(this))
//         );
//     }
//     event Log(address message);
//     event Log_text(string message);
//     event Log_number(uint256 message);
//     event Debug(string descr, uint256 balance);
    
//     function executeArbitrage(address[3][2] calldata path, // path[i][0] = token0, path[i][1] = token1, path[i][2] = pool address
//         uint256 amountWETH
//     ) external {

//         require(msg.sender == owner, "shoo");
//         require(path.length >= 2 && path.length <= 3, "Invalid path length");
//         // require(path[0][0] == WETH && path[path.length - 1][1] == WETH , "Path should start with WETH");

//         uint256 gasBefore = gasleft();
//         // Take flash loan
//         address[] memory assets = new address[](1);
//         uint256[] memory amounts = new uint256[](1);
//         uint256[] memory modes = new uint256[](1);

//         assets[0] = path[0][0];
//         amounts[0] = amountWETH;
//         modes[0] = 0;
//         POOL.flashLoan(
//             address(this),
//             assets,
//             amounts,
//             modes,
//             address(this),
//             abi.encode(path),
//             0
//         );


//         uint256 gasAfter = gasleft();
//         uint256 gasUsed = gasBefore - gasAfter;
//         emit Debug("Gas used for flash loan and arbitrage:", gasUsed);

//     }

//     function executeOperation(address[] calldata _assets, uint256[] calldata _amounts, uint256[] calldata _premiums, address _initiator, bytes calldata _params) external override returns (bool) {
//         address _asset = _assets[0];
//         uint256 _amount = _amounts[0];
//         uint256 _premium = _premiums[0];

//         require(_initiator == address(this));
//         (address[3][2] memory path) = abi.decode(_params, (address[3][2]));
//         // address[] memory swapPath = new address[](path.length);
//         uint256 gasBefore = gasleft();
//         uint256 amountReceived = swapExactInput(_amount, path);

//         emit Debug("Final Balance of the Contract:", amountReceived);
//         emit Debug("Gas used for arbitrage:", gasBefore - gasleft());
//         uint256 totalAmount = _amount + _premium;
//         emit Debug("Amount To Repay: ", totalAmount);
//         IERC20(_asset).approve(address(POOL), totalAmount);

//         return true;
//     }
// }
