// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWETH {
    function deposit() external payable;
    function withdraw(uint wad) external;
    function transfer(address dst, uint wad) external returns (bool);
    function balanceOf(address guy) external view returns (uint);
}

contract SimpleWETH is IWETH {
    string public constant name = "Wrapped Ether";
    string public constant symbol = "WETH";
    uint8 public constant decimals = 18;

    mapping(address => uint) public balances;
    uint public totalSupply;

    function deposit() external payable override {
        balances[msg.sender] += msg.value;
        totalSupply += msg.value;
    }

    function withdraw(uint wad) external override {
        require(balances[msg.sender] >= wad, "Insufficient balance");
        balances[msg.sender] -= wad;
        totalSupply -= wad;
        payable(msg.sender).transfer(wad);
    }

    function transfer(address dst, uint wad) external override returns (bool) {
        require(balances[msg.sender] >= wad, "Insufficient balance");
        balances[msg.sender] -= wad;
        balances[dst] += wad;
        return true;
    }

    function balanceOf(address guy) external view override returns (uint) {
        return balances[guy];
    }
}


contract FundWithWETH {
    address public wethAddress = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    IWETH public weth = IWETH(wethAddress);
    // address public wbtcAddress = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    // IWETH public weth = IWETH(wbtcAddress);

    constructor() {
    }

    function wrapEther() external payable {
        weth.deposit{value: msg.value}();
    }

    function withdrawWETH(uint amount) external {
        require(weth.balanceOf(address(this)) >= amount, "Insufficient WETH balance");
        weth.withdraw(amount);
        payable(msg.sender).transfer(amount);
    }

    function getWETHBalance() external view returns (uint) {
        return weth.balanceOf(address(this));
    }

    function fundContractWithWETH(address targetContract, uint amount) external {
        require(weth.balanceOf(address(this)) >= amount, "Insufficient WETH balance");
        weth.transfer(targetContract, amount);
    }
}