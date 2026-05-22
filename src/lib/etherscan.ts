/**
 * Sepolia 实时数据服务 — Chronicle
 *
 * 通过 Sepolia 公共 RPC 获取真实链上数据。
 * 无需 API Key，零配置即可使用。
 * 无网络或 RPC 异常时返回 null，调用方降级为 mock 数据。
 */

// ---------- 配置 ----------

const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
const DEMO_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

// ---------- 缓存 ----------

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 30_000 // 30 秒

function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return Promise.resolve(entry.data as T)
  return fetcher().then((data) => {
    cache.set(key, { data, ts: Date.now() })
    return data
  })
}

// ---------- JSON-RPC 调用 ----------

let rpcAvailable: boolean | null = null

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  try {
    const res = await fetch(SEPOLIA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    })
    const json = await res.json()
    if (json.error) {
      console.warn('RPC 错误:', json.error)
      return null
    }
    rpcAvailable = true
    return json.result
  } catch (err) {
    console.warn('RPC 请求失败:', err)
    rpcAvailable = false
    return null
  }
}

// ---------- 类型 ----------

export interface LiveBalance {
  eth: string
  wei: string
}

export interface NetworkInfo {
  blockNumber: number
  gasPrice: string // gwei
}

// ---------- 公开方法 ----------

/** 获取地址 ETH 余额 */
export async function fetchEthBalance(address: string = DEMO_ADDRESS): Promise<LiveBalance | null> {
  return cached(`bal:${address}`, async () => {
    const wei = await rpcCall('eth_getBalance', [address, 'latest'])
    if (typeof wei !== 'string') return null
    const eth = (Number(BigInt(wei)) / 1e18).toFixed(6)
    return { eth, wei }
  })
}

/** 获取地址交易计数 (nonce) */
export async function fetchTxCount(address: string = DEMO_ADDRESS): Promise<number | null> {
  return cached(`nonce:${address}`, async () => {
    const count = await rpcCall('eth_getTransactionCount', [address, 'latest'])
    if (typeof count !== 'string') return null
    return parseInt(count, 16)
  })
}

/** 获取网络信息（区块高度 + Gas Price） */
export async function fetchNetworkInfo(): Promise<NetworkInfo | null> {
  return cached('network', async () => {
    const [blockNum, gasPrice] = await Promise.all([
      rpcCall('eth_blockNumber', []),
      rpcCall('eth_gasPrice', []),
    ])
    if (typeof blockNum !== 'string' || typeof gasPrice !== 'string') return null
    return {
      blockNumber: parseInt(blockNum, 16),
      gasPrice: (Number(BigInt(gasPrice)) / 1e9).toFixed(2),
    }
  })
}

/** RPC 连接状态 */
export function isRpcAvailable(): boolean {
  return rpcAvailable === true
}

/** 清除缓存（切换网络等场景） */
export function clearCache(): void {
  cache.clear()
  rpcAvailable = null
}

/** 演示钱包地址 */
export { DEMO_ADDRESS }
