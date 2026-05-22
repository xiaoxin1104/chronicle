/**
 * Sepolia 合约地址 + ABI 编码工具 — Chronicle
 *
 * 为 DeFi Intent 执行提供 Sepolia 测试网常用合约地址和 calldata 构造。
 * 不依赖 ethers.js，手写关键 ABI 编码。
 */

// ---------- Sepolia 合约地址 ----------

export const CONTRACTS = {
  AAVE_V3_POOL: '0x6Ae43d3271fb688b2b69eF20B42bA6A28598D4dB',
  UNISWAP_V2_ROUTER: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008',
  WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  USDC: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85f5a3c0',
  USDT: '0xaA8E23F1248c9e0b9D4b8d5b5F5B5E5B5B5b9d0A',
  DAI: '0xFF34B3d4Aee8ddCd6F9AFFbF6f9Bd9cA4d5e5F6a',
} as const

// ---------- 代币地址注册表 ----------

const TOKEN_REGISTRY: Record<string, string> = {
  ETH: CONTRACTS.WETH,
  WETH: CONTRACTS.WETH,
  USDC: CONTRACTS.USDC,
  USDT: CONTRACTS.USDT,
  DAI: CONTRACTS.DAI,
  IMT: '0x0000000000000000000000000000000000000000',
  BTC: '0x0000000000000000000000000000000000000000',
  ARB: '0x0000000000000000000000000000000000000000',
  OP: '0x0000000000000000000000000000000000000000',
}

// ---------- 函数 Selector ----------

export const SELECTORS = {
  AAVE_SUPPLY: '0x617ba037',       // supply(address,uint256,address,uint16)
  UNISWAP_SWAP_ETH_FOR_TOKENS: '0x7ff36ab5', // swapExactETHForTokens
} as const

// ---------- ABI 编码 ----------

function padLeft(hex: string, len = 64): string {
  return hex.replace('0x', '').padStart(len, '0')
}

function encodeAddress(addr: string): string {
  return padLeft(addr)
}

function encodeUint256(value: string | number): string {
  return BigInt(value).toString(16).padStart(64, '0')
}

function encodeUint16(value: number): string {
  return value.toString(16).padStart(64, '0')
}

// ---------- calldata 构造 ----------

/** Aave V3 supply */
export function buildAaveSupplyCalldata(
  asset: string,
  amountWei: string,
  onBehalfOf: string,
): string {
  const sel = SELECTORS.AAVE_SUPPLY.replace('0x', '')
  return '0x' + sel + encodeAddress(asset) + encodeUint256(amountWei)
    + encodeAddress(onBehalfOf) + encodeUint16(0)
}

/** Uniswap V2 swapExactETHForTokens */
export function buildUniswapSwapCalldata(
  amountOutMinWei: string,
  path: string[],
  to: string,
  deadline: number,
): string {
  const sel = SELECTORS.UNISWAP_SWAP_ETH_FOR_TOKENS.replace('0x', '')
  let calldata = sel + encodeUint256(amountOutMinWei)
  // path offset (3 statics after: to, deadline, then path data)
  calldata += padLeft('60') // offset 96 bytes
  calldata += encodeAddress(to)
  calldata += encodeUint256(deadline)
  calldata += encodeUint256(path.length)
  path.forEach((addr) => { calldata += encodeAddress(addr) })
  return '0x' + calldata
}

// ---------- 查询方法 ----------

/** 获取代币合约地址 */
export function getTokenAddress(symbol: string): string | null {
  return TOKEN_REGISTRY[symbol.toUpperCase()] ?? null
}

/** 获取协议合约地址。Lido 等暂未支持时返回 null */
export function getContractAddress(name: string): string | null {
  const map: Record<string, string> = {
    aave: CONTRACTS.AAVE_V3_POOL,
    aave_v3: CONTRACTS.AAVE_V3_POOL,
    uniswap: CONTRACTS.UNISWAP_V2_ROUTER,
    uniswap_v2: CONTRACTS.UNISWAP_V2_ROUTER,
  }
  return map[name.toLowerCase()] ?? null
}

/** 构造 swap 路径（ETH↔token / token↔token 均通过 WETH 中转） */
export function buildSwapPath(from: string, to: string): string[] | null {
  const fromAddr = getTokenAddress(from)
  const toAddr = getTokenAddress(to)
  if (!fromAddr || !toAddr) return null

  // 如果是同资产，没必要 swap
  if (fromAddr === toAddr) return null

  // 如果某一个不是 ETH/WETH，需要经过 WETH 中转
  if (fromAddr !== CONTRACTS.WETH && toAddr !== CONTRACTS.WETH) {
    return [fromAddr, CONTRACTS.WETH, toAddr]
  }
  return [fromAddr, toAddr]
}

/** 判断协议是否实际可用 */
export function isProtocolAvailable(name: string): boolean {
  return getContractAddress(name) !== null
}

/** 支持的代币列表（用于 UI 提示） */
export function supportedTokens(): string[] {
  return Object.keys(TOKEN_REGISTRY).filter(k => TOKEN_REGISTRY[k] !== '0x0000000000000000000000000000000000000000')
}
