/**
 * 多链实时数据服务 — Chronicle
 *
 * 通过各链公共 RPC 获取真实链上数据。无需 API Key。
 * 覆盖：Ethereum Sepolia / Arbitrum Sepolia / Base Sepolia / Optimism Sepolia
 * 无网络或 RPC 异常时返回 null，调用方降级为 mock 数据。
 */

// ---------- 链配置 ----------

export interface ChainInfo {
  key: string
  name: string
  rpc: string
  chainId: number
}

export const CHAINS: ChainInfo[] = [
  { key: 'ethereum',  name: 'Ethereum',  rpc: 'https://ethereum-sepolia-rpc.publicnode.com',      chainId: 11155111 },
  { key: 'arbitrum',  name: 'Arbitrum',  rpc: 'https://sepolia-rollup.arbitrum.io/rpc',            chainId: 421614 },
  { key: 'base',      name: 'Base',      rpc: 'https://sepolia.base.org',                            chainId: 84532 },
  { key: 'optimism',  name: 'Optimism',  rpc: 'https://sepolia.optimism.io',                         chainId: 11155420 },
]

const DEMO_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

// ---------- 缓存 ----------

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 30_000

function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return Promise.resolve(entry.data as T)
  return fetcher().then((data) => {
    cache.set(key, { data, ts: Date.now() })
    return data
  })
}

// ---------- JSON-RPC ----------

const chainStatus = new Map<string, boolean>()

async function rpcCall(chain: ChainInfo, method: string, params: unknown[]): Promise<unknown> {
  try {
    const res = await fetch(chain.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    })
    const json = await res.json()
    if (json.error) {
      chainStatus.set(chain.key, false)
      return null
    }
    chainStatus.set(chain.key, true)
    return json.result
  } catch {
    chainStatus.set(chain.key, false)
    return null
  }
}

// ---------- 类型 ----------

export interface LiveBalance {
  eth: string
  wei: string
}

export interface ChainBalance {
  chain: ChainInfo
  balance: LiveBalance | null
  txCount: number | null
}

export interface NetworkInfo {
  blockNumber: number
  gasPrice: string
}

// ---------- 单链查询 ----------

export async function fetchEthBalance(
  address: string = DEMO_ADDRESS,
  chain: ChainInfo = CHAINS[0],
): Promise<LiveBalance | null> {
  return cached(`bal:${chain.key}:${address}`, async () => {
    const wei = await rpcCall(chain, 'eth_getBalance', [address, 'latest'])
    if (typeof wei !== 'string') return null
    const eth = (Number(BigInt(wei)) / 1e18).toFixed(6)
    return { eth, wei }
  })
}

export async function fetchTxCount(
  address: string = DEMO_ADDRESS,
  chain: ChainInfo = CHAINS[0],
): Promise<number | null> {
  return cached(`nonce:${chain.key}:${address}`, async () => {
    const count = await rpcCall(chain, 'eth_getTransactionCount', [address, 'latest'])
    if (typeof count !== 'string') return null
    return parseInt(count, 16)
  })
}

export async function fetchNetworkInfo(chain: ChainInfo = CHAINS[0]): Promise<NetworkInfo | null> {
  return cached(`network:${chain.key}`, async () => {
    const [blockNum, gasPrice] = await Promise.all([
      rpcCall(chain, 'eth_blockNumber', []),
      rpcCall(chain, 'eth_gasPrice', []),
    ])
    if (typeof blockNum !== 'string' || typeof gasPrice !== 'string') return null
    return {
      blockNumber: parseInt(blockNum, 16),
      gasPrice: (Number(BigInt(gasPrice)) / 1e9).toFixed(2),
    }
  })
}

// ---------- 多链聚合查询 ----------

/** 查询地址在所有链上的余额 + 交易数 */
export async function fetchAllChainBalances(
  address: string = DEMO_ADDRESS,
): Promise<ChainBalance[]> {
  const key = `all:${address}`
  return cached(key, async () => {
    const results = await Promise.all(
      CHAINS.map(async (chain) => {
        const [balance, txCount] = await Promise.all([
          fetchEthBalance(address, chain),
          fetchTxCount(address, chain),
        ])
        return { chain, balance, txCount }
      }),
    )
    return results
  })
}

/** 每条链的 RPC 可用状态 */
export function getChainStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {}
  CHAINS.forEach((c) => { status[c.key] = chainStatus.get(c.key) ?? false })
  return status
}

/** 至少有一条链的 RPC 可用 */
export function isRpcAvailable(): boolean {
  return CHAINS.some((c) => chainStatus.get(c.key) === true)
}

export function clearCache(): void {
  cache.clear()
  chainStatus.clear()
}

export { DEMO_ADDRESS }
