// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockUSDC: 6-decimal testnet USDC for UpHeld on Base Sepolia (chainId 84532)
/// @notice Anyone can mint up to 1,000 USDC per faucet call so judges are never blocked
///         by Circle's rate-limited faucet. Testnet only. Never deploy to mainnet.
contract MockUSDC {
    string public constant name = "USD Coin (UpHeld Base Testnet)";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    uint256 public constant FAUCET_MAX = 1_000 * 1e6; // 1,000 USDC per call
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function faucet(address to, uint256 amount) external {
        require(amount <= FAUCET_MAX, "Faucet max is 1,000 USDC per call");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient USDC");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient USDC");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
