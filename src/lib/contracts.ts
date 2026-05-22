/**
 * Sepolia 合约地址 + ABI 编码工具 — Chronicle
 *
 * 为 DeFi Intent 执行提供 Sepolia 测试网常用合约地址和 calldata 构造能力。
 * 不依赖 ethers.js，手写关键函数的 ABI 编码。
 */

// ---------- Sepolia 合约地址 ----------

export const CONTRACTS = {
  AAVE_V3_POOL: '0x6Ae43d3271fb688b2b69eF20B42bA6A28598D4dB',
  UNISWAP_V2_ROUTER: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008',
  WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  USDC: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85f5a3c0',
  LIDO_STETH: '0x3e3Eba4BdFbd3e2eBFe5d4D3E3d3bF3e3D3E3f3E', // placeholder
} as const

// ---------- 函数 Selector ----------

export const SELECTORS = {
  // Aave V3: supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
  AAVE_SUPPLY: '0x617ba037',
  // Uniswap V2: swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)
  UNISWAP_SWAP_ETH_FOR_TOKENS: '0x7ff36ab5',
} as const

// ---------- ABI 编码工具 ----------

function padLeft(hex: string, length = 64): string {
  return hex.replace('0x', '').padStart(length, '0')
}

function encodeAddress(addr: string): string {
  return padLeft(addr)
}

function encodeUint256(value: string | number): string {
  const bn = BigInt(value)
  return bn.toString(16).padStart(64, '0')
}

function encodeUint16(value: number): string {
  return value.toString(16).padStart(64, '0')
}

// ---------- calldata 构造 ----------

/** Aave V3 supply — 存入资产获取 aToken */
export function buildAaveSupplyCalldata(
  asset: string,
  amountWei: string,
  onBehalfOf: string,
): string {
  const selector = SELECTORS.AAVE_SUPPLY.replace('0x', '')
  const calldata =
    selector +
    encodeAddress(asset) +
    encodeUint256(amountWei) +
    encodeAddress(onBehalfOf) +
    encodeUint16(0) // referralCode = 0
  return '0x' + calldata
}

/** Uniswap V2 swapExactETHForTokens — ETH 换代币 */
export function buildUniswapSwapCalldata(
  amountOutMinWei: string,
  path: string[], // [WETH, token]
  to: string,
  deadline: number,
): string {
  const selector = SELECTORS.UNISWAP_SWAP_ETH_FOR_TOKENS.replace('0x', '')

  // amountOutMin (uint256)
  let calldata = selector + encodeUint256(amountOutMinWei)

  // path (address[] dynamic)
  // offset to array data = 0x60 (96 bytes = 3 params before it)
  calldata += padLeft('60')

  // to (address)
  calldata += encodeAddress(to)

  // deadline (uint256)
  calldata += encodeUint256(deadline)

  // path data: length + addresses
  calldata += encodeUint256(path.length)
  path.forEach((addr) => {
    calldata += encodeAddress(addr)
  })

  return '0x' + calldata
}

/** 获取代币合约地址（Sepolia） */
export function getTokenAddress(symbol: string): string | null {
  const map: Record<string, string> = {
    ETH: CONTRACTS.WETH,
    WETH: CONTRACTS.WETH,
    USDC: CONTRACTS.USDC,
    USDT: '0xaA8E23F1248c9e0b9D4b8d5b5F5B5E5B5B5b9d0A',
  }
  return map[symbol.toUpperCase()] ?? null
}

/** 获取 Sepolia 合约地址 */
export function getContractAddress(name: string): string | null {
  const map: Record<string, string> = {
    aave: CONTRACTS.AAVE_V3_POOL,
    aave_v3: CONTRACTS.AAVE_V3_POOL,
    uniswap: CONTRACTS.UNISWAP_V2_ROUTER,
    uniswap_v2: CONTRACTS.UNISWAP_V2_ROUTER,
    lido: CONTRACTS.LIDO_STETH,
  }
  return map[name.toLowerCase()] ?? null
}
