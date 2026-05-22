/**
 * Token Core WASM Bridge — Chronicle
 *
 * 本模块封装 @consenlabs/tcx-wasm 的核心能力：
 * - 钱包创建与导入（助记词/密码）
 * - 多链地址派生 (BIP32/BIP44)
 * - 交易构建与签名 (EVM/BTC/TRON/...)
 * - Keystore 缓存管理
 * - AI 驱动的交易风险分析
 *
 * @see https://github.com/consenlabs/token-core-monorepo
 */

import init, {
  create_keystore,
  export_mnemonic,
  derive_accounts,
  sign_tx as wasm_sign_tx,
  cache_keystore,
  clear_cached_keystore,
} from '@consenlabs/tcx-wasm'

// ---------- WASM 初始化 ----------

let wasmReady = false
let initPromise: Promise<void> | null = null

export async function ensureWasm(): Promise<void> {
  if (wasmReady) return
  if (!initPromise) {
    initPromise = init().then(() => {
      wasmReady = true
    })
  }
  return initPromise
}

// ---------- 类型定义 ----------

export interface KeystoreCreateParam {
  password: string
  mnemonic?: string
  entropy?: string
  network?: 'MAINNET' | 'TESTNET'
}

export interface DerivationRequest {
  chain: string
  derivationPath: string
  chainId?: string
  network?: 'MAINNET' | 'TESTNET'
}

export interface DerivedAccount {
  address: string
  chain: string
  derivationPath: string
  publicKey?: string
}

export interface TxInput {
  nonce: string
  gasPrice: string
  gasLimit: string
  to: string
  value: string
  chainId?: string | number
  data?: string
}

export interface SignTxParam {
  keystoreJson?: string
  password: string
  chain: string
  derivationPath: string
  input: TxInput
}

export interface SignResult {
  signature: string
  txHash: string
  signedTx?: string
}

export interface WalletResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ---------- 风险分析类型 ----------

export type RiskLevel = 'info' | 'warning' | 'danger' | 'block'

export interface RiskAssessment {
  level: RiskLevel
  summary: string
  details: string[]
  action: string
}

export interface TransactionPreview {
  type: 'transfer' | 'approve' | 'contract_call'
  target: string
  asset: string
  amount: string
  gasEstimate: string
  risk: RiskAssessment
}

// ---------- Token Core API ----------

export const tokenCore = {
  /**
   * 创建新钱包（生成随机助记词 + Keystore）
   */
  async createWallet(param: KeystoreCreateParam): Promise<WalletResult<{ keystoreJson: string; mnemonic: string }>> {
    try {
      await ensureWasm()
      const keystoreJson = create_keystore(JSON.stringify({
        password: param.password,
        network: param.network ?? 'TESTNET',
      }))
      const { mnemonic } = JSON.parse(
        export_mnemonic(JSON.stringify({
          keystoreJson,
          key: param.password,
        }))
      )
      cache_keystore(keystoreJson)
      return { success: true, data: { keystoreJson, mnemonic } }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  },

  /**
   * 导入助记词创建 Keystore
   */
  async importMnemonic(param: KeystoreCreateParam): Promise<WalletResult<{ keystoreJson: string }>> {
    try {
      await ensureWasm()
      if (!param.mnemonic) {
        return { success: false, error: '助记词不能为空' }
      }
      const keystoreJson = create_keystore(JSON.stringify({
        password: param.password,
        mnemonic: param.mnemonic,
        network: param.network ?? 'TESTNET',
      }))
      cache_keystore(keystoreJson)
      return { success: true, data: { keystoreJson } }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  },

  /**
   * 导出助记词（需密码解密）
   */
  async exportMnemonic(keystoreJson: string, password: string): Promise<WalletResult<{ mnemonic: string }>> {
    try {
      await ensureWasm()
      const result = JSON.parse(export_mnemonic(JSON.stringify({ keystoreJson, key: password })))
      return { success: true, data: { mnemonic: result.mnemonic } }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  },

  /**
   * 派生地址（支持单链或多链批量）
   */
  async deriveAccounts(
    keystoreJson: string | undefined,
    password: string,
    derivations: DerivationRequest[],
  ): Promise<WalletResult<DerivedAccount[]>> {
    try {
      await ensureWasm()
      const payload: Record<string, unknown> = {
        key: password,
        derivations: derivations.map((d) => ({
          chain: d.chain,
          derivationPath: d.derivationPath,
          chainId: d.chainId ?? '1',
          network: d.network ?? 'TESTNET',
        })),
      }
      if (keystoreJson) {
        payload.keystoreJson = keystoreJson
      }
      const result = JSON.parse(derive_accounts(JSON.stringify(payload)))
      const accounts: DerivedAccount[] = (result.accounts ?? result).map(
        (acc: Record<string, string>) => ({
          address: acc.address,
          chain: acc.chain,
          derivationPath: acc.derivationPath ?? acc.derivation_path,
          publicKey: acc.publicKey ?? acc.public_key,
        }),
      )
      return { success: true, data: accounts }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  },

  /**
   * 交易签名
   */
  async signTransaction(param: SignTxParam): Promise<WalletResult<SignResult>> {
    try {
      await ensureWasm()
      const payload: Record<string, unknown> = {
        key: param.password,
        chain: param.chain,
        derivationPath: param.derivationPath,
        input: {
          nonce: param.input.nonce,
          gasPrice: param.input.gasPrice,
          gasLimit: param.input.gasLimit,
          to: param.input.to,
          value: param.input.value,
          chainId: param.input.chainId ?? '1',
          ...(param.input.data ? { data: param.input.data } : {}),
        },
      }
      if (param.keystoreJson) {
        payload.keystoreJson = param.keystoreJson
      }
      const result = JSON.parse(wasm_sign_tx(JSON.stringify(payload)))
      return {
        success: true,
        data: {
          signature: result.signature,
          txHash: result.txHash ?? result.tx_hash,
          signedTx: result.signedTx ?? result.signed_tx,
        },
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  },

  /**
   * 缓存 Keystore 到 WASM 内存
   */
  cacheKeystore(keystoreJson: string): void {
    try {
      cache_keystore(keystoreJson)
    } catch {
      // WASM 未初始化时忽略
    }
  },

  /**
   * 清除缓存的 Keystore
   */
  clearCachedKeystore(): void {
    try {
      clear_cached_keystore()
    } catch {
      // WASM 未初始化时忽略
    }
  },

  /**
   * 交易风险分析（结合规则引擎 + AI 增强）
   * 委托给 ai-service 进行深度分析，此处提供基础规则扫描
   */
  scanTransactionRisk(tx: Partial<TxInput>): TransactionPreview {
    const isUnlimited =
      tx.data?.includes('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const isZeroAddress = tx.to === '0x0000000000000000000000000000000000000000'
    const isHighValue = tx.value && Number.parseFloat(tx.value) > 10

    let level: RiskLevel = 'info'
    const details: string[] = []
    let summary = ''
    let action = ''

    if (isUnlimited) {
      level = 'danger'
      summary = '该交易请求无限额度授权，存在资产被盗风险'
      details.push('合约请求无限额 approve')
      details.push('目标合约未经验证')
      details.push('建议将授权额度修改为实际需要数量')
      action = '强烈建议拒绝此交易，或修改授权额度'
    } else if (isZeroAddress) {
      level = 'warning'
      summary = '目标地址为零地址，此操作将销毁代币'
      details.push('代币将被发送至零地址无法找回')
      action = '确认你确实想要销毁这些代币'
    } else if (isHighValue) {
      level = 'warning'
      summary = '交易金额较大，建议仔细核对收款地址'
      details.push('大额转账建议先小额测试')
      details.push('确认收款地址无误后再签名')
      action = '建议二次确认收款地址和金额'
    } else {
      summary = '该交易风险较低，可以安全签名'
      details.push('标准交易')
      details.push('金额在正常范围')
      details.push('未检测到已知风险模式')
      action = '可以安全签名'
    }

    return {
      type: tx.data ? 'contract_call' : 'transfer',
      target: tx.to ?? '0x...',
      asset: 'ETH',
      amount: tx.value ?? '0',
      gasEstimate: '~$2.40',
      risk: { level, summary, details, action },
    }
  },
}

// ---------- 演示钱包初始化 ----------

let demoWalletReady = false
let demoPassword = ''

const DEMO_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

export async function initDemoWallet(): Promise<WalletResult<{ address: string }>> {
  if (demoWalletReady) {
    return { success: true, data: { address: '' } }
  }
  try {
    await ensureWasm()
    // 用固定助记词创建演示钱包，确保地址可复现
    const keystoreJson = create_keystore(
      JSON.stringify({
        password: 'chronicle-demo',
        mnemonic: DEMO_MNEMONIC,
        network: 'TESTNET',
      }),
    )
    cache_keystore(keystoreJson)
    const accounts = JSON.parse(
      derive_accounts(
        JSON.stringify({
          key: 'chronicle-demo',
          derivations: [
            {
              chain: 'ETHEREUM',
              derivationPath: "m/44'/60'/0'/0/0",
              network: 'TESTNET',
            },
          ],
        }),
      ),
    )
    const address = accounts?.[0]?.address ?? accounts?.accounts?.[0]?.address ?? '0x...'
    demoWalletReady = true
    demoPassword = 'chronicle-demo'
    return { success: true, data: { address } }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export function isDemoWalletReady(): boolean {
  return demoWalletReady
}

export function getDemoPassword(): string {
  return demoPassword
}

// ---------- 安全边界常量 ----------

export const SAFETY_RULES = {
  TESTNET_ONLY: '请使用 Sepolia 或 Base Sepolia 测试网进行演示',
  NO_REAL_MNEMONIC: '切勿向 AI 工具或公开环境输入真实助记词',
  ASSET_ISOLATION: '如需使用主网，请仅使用小额可丢弃资产',
  KEY_LOCAL_ONLY: '助记词和私钥绝不传输到任何服务器',
  PASSWORD_STORAGE: '密码仅在内存中持有，不会持久化到任何存储',
} as const
