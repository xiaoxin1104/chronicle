import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import { toast } from '@repo/ui/components/toast'
import { useNavigate, useSearchParams } from 'react-router'
import { quickPrompts, walletAssets, chronicleEvents } from '../../data/mock'
import { tokenCore, isDemoWalletReady, getDemoPassword, type TransactionPreview } from '../../lib/token-core'
import { CONTRACTS, buildAaveSupplyCalldata, buildUniswapSwapCalldata, buildSwapPath, getTokenAddress, isProtocolAvailable, getContractAddress } from '../../lib/contracts'
import {
  sendMessageStream,
  setApiKey,
  hasApiKey,
  getApiKey,
  getProvider,
  detectProvider,
  setWalletContext,
  resetConversation,
  getConversationHistory,
  clearApiKey,
  type AIResponse,
  type WalletIntent,
} from '../../lib/ai-service'
import type { TransferIntent, CapsuleIntent, DepositIntent, SwapIntent } from '../../lib/ai-service'
import { cn } from '../../lib/utils'
import { useState, useRef, useEffect, useCallback } from 'react'

// ---------- 工具 ----------

const CHAIN_START_DATE = new Date('2024-01-20')
function chainDays(): number {
  return Math.floor((Date.now() - CHAIN_START_DATE.getTime()) / (1000 * 60 * 60 * 24))
}

function computeSecurityScore(): number {
  return isDemoWalletReady() ? 92 : 75
}

// ---------- 子组件 ----------

function RiskBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; variant: 'success' | 'neutral' | 'destructive' }> = {
    info: { label: 'ℹ️ 信息', variant: 'success' },
    warning: { label: '⚠️ 警告', variant: 'destructive' },
    danger: { label: '🚨 危险', variant: 'destructive' },
    block: { label: '🚫 阻止', variant: 'destructive' },
  }
  const c = config[level] ?? config.info
  return <Badge variant={c.variant} size="sm">{c.label}</Badge>
}

function TransactionPreviewCard({ preview }: { preview: TransactionPreview }) {
  return (
    <div className="mt-2 rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-body-sm font-semibold">交易预览</span>
        <RiskBadge level={preview.risk.level} />
      </div>
      <div className="space-y-2 text-body-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">类型</span>
          <span className="font-medium">
            {preview.type === 'transfer' ? '转账' : preview.type === 'approve' ? '授权' : '合约调用'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">目标</span>
          <span className="font-mono text-xs">{preview.target}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">金额</span>
          <span className="font-semibold">{preview.amount} {preview.asset}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Gas 预估</span>
          <span>{preview.gasEstimate}</span>
        </div>
      </div>
      <div className="mt-3 space-y-1 rounded-lg bg-surface-blue p-3">
        {preview.risk.details.map((d, i) => (
          <p key={i} className="text-caption text-muted-foreground">• {d}</p>
        ))}
      </div>
      <p className="mt-3 text-body-sm font-medium">{preview.risk.action}</p>
    </div>
  )
}

// ---------- Intent 确认执行卡片 ----------

function intentToPreview(intent: WalletIntent): { title: string; rows: { label: string; value: string }[]; riskNote?: string } {
  switch (intent.type) {
    case 'transfer':
      return {
        title: '📤 确认转账',
        rows: [
          { label: '金额', value: `${intent.params.amount} ${intent.params.asset}` },
          { label: '接收地址', value: intent.params.to },
          { label: '网络', value: 'Sepolia Testnet' },
          { label: 'Gas 预估', value: '~$2.40' },
        ],
        riskNote: '请仔细核对接收地址，交易一旦上链无法撤回。',
      }
    case 'capsule':
      return {
        title: '⏳ 确认创建时间胶囊',
        rows: [
          { label: '锁定资产', value: `${intent.params.amount} ${intent.params.asset}` },
          { label: '解锁日期', value: intent.params.unlockDate.slice(0, 10) },
          { label: '接收地址', value: intent.params.recipient },
          { label: '网络', value: 'Sepolia Testnet' },
          { label: 'Gas 预估', value: '~$2.40' },
        ],
        riskNote: intent.params.message ? `附带留言: "${intent.params.message}"` : undefined,
      }
    case 'approve':
      return {
        title: '🔓 确认授权',
        rows: [
          { label: '授权代币', value: intent.params.asset },
          { label: '授权额度', value: intent.params.amount === 'unlimited' ? '⚠️ 无限额度' : intent.params.amount },
          { label: '授权对象', value: intent.params.spender },
          { label: '网络', value: 'Sepolia Testnet' },
          { label: 'Gas 预估', value: '~$3.00' },
        ],
        riskNote: intent.params.amount === 'unlimited' ? '⚠️ 无限额度授权极度危险！建议修改为实际需要的数量。' : '授权后该合约可支配对应额度的代币。',
      }
    case 'deposit':
      return {
        title: `🏦 确认存入 ${intent.params.protocol.toUpperCase()}`,
        rows: [
          { label: '存入资产', value: `${intent.params.amount} ${intent.params.asset}` },
          { label: '目标协议', value: intent.params.protocol === 'aave' ? 'Aave V3' : intent.params.protocol === 'lido' ? 'Lido' : intent.params.protocol },
          { label: '网络', value: 'Sepolia Testnet' },
          { label: 'Gas 预估', value: '~$5.00' },
        ],
        riskNote: '确认后将资产存入 DeFi 协议。协议有智能合约风险，请自行评估。',
      }
    case 'swap':
      return {
        title: '💱 确认兑换',
        rows: [
          { label: '支付', value: `${intent.params.amount} ${intent.params.fromAsset}` },
          { label: '获得', value: intent.params.toAsset },
          { label: '途径', value: 'Uniswap V2 (Sepolia)' },
          { label: 'Gas 预估', value: '~$6.00' },
        ],
        riskNote: '兑换价格为实时市场价，存在滑点。此为测试网演示。',
      }
    case 'plan':
      return {
        title: `📋 交易计划 (${intent.params.steps.length} 步)`,
        rows: intent.params.steps.map((s, i) => {
          let val = ''
          if (s.type === 'swap') val = `${s.params.fromAsset} → ${s.params.toAsset}`
          else if (s.type === 'deposit') val = `存入 ${s.params.amount} ${s.params.asset} 到 ${s.params.protocol}`
          else if (s.type === 'transfer') val = `转账 ${s.params.amount} ${s.params.asset}`
          else val = s.type
          return { label: `第 ${i + 1} 步`, value: val }
        }),
        riskNote: `共 ${intent.params.steps.length} 步交易，将依次执行。上一步成功后才执行下一步。`,
      }
  }
}

function IntentConfirmCard({
  intent,
  intentStatus,
  intentResult,
  onConfirm,
  onCancel,
}: {
  intent: WalletIntent
  intentStatus?: string
  intentResult?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const preview = intentToPreview(intent)
  const isDanger = intent.type === 'approve' && intent.params.amount === 'unlimited'

  if (intentStatus === 'success') {
    return (
      <div className="mt-3 rounded-xl border border-success-border bg-success-surface p-4 animate-fade-in">
        <p className="text-body-sm font-semibold text-success-text">✅ 交易已签名</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground break-all">txHash: {intentResult}</p>
        <p className="mt-2 text-caption text-muted-foreground">交易已在 Token Core WASM 沙箱中签名，测试网环境。</p>
      </div>
    )
  }

  if (intentStatus === 'failed') {
    return (
      <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
        <p className="text-body-sm font-semibold text-destructive">❌ 签名失败</p>
        <p className="mt-1 text-caption text-muted-foreground">{intentResult || '未知错误'}</p>
      </div>
    )
  }

  return (
    <div
      className={`mt-3 rounded-xl border bg-card p-4 transition-all duration-300 animate-fade-in ${
        isDanger ? 'border-destructive/40 ring-1 ring-destructive/20' : 'border-primary/30'
      }`}
    >
      <p className="text-body-sm font-semibold">{preview.title}</p>
      <div className="mt-3 space-y-2 text-body-sm">
        {preview.rows.map((r) => {
          const isAddress = r.value.startsWith('0x') && r.value.length >= 40
          return (
            <div key={r.label} className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground shrink-0">{r.label}</span>
              <span
                className={`font-medium text-xs text-right ${isAddress ? 'font-mono break-all cursor-pointer hover:text-[#007fff] transition-colors' : ''}`}
                title={isAddress ? '点击复制地址' : undefined}
                onClick={() => {
                  if (isAddress) {
                    navigator.clipboard.writeText(r.value)
                    toast('已复制', { description: r.value.slice(0, 20) + '...' })
                  }
                }}
              >
                {r.value}
                {isAddress && <span className="ml-1 text-2xs text-muted-foreground">📋</span>}
              </span>
            </div>
          )
        })}
      </div>
      {preview.riskNote && (
        <div
          className={`mt-3 rounded-lg p-2 text-caption ${
            isDanger ? 'bg-destructive/10 text-destructive' : 'bg-surface-blue text-muted-foreground'
          }`}
        >
          {preview.riskNote}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          variant="default"
          size="sm"
          className="flex-1 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          disabled={intentStatus === 'executing'}
          onClick={onConfirm}
        >
          {intentStatus === 'executing' ? '⏳ 签名中...' : intent.type === 'transfer' ? '✅ 确认发送' : intent.type === 'capsule' ? '✅ 确认创建' : '⚠️ 确认授权'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={intentStatus === 'executing'}
          onClick={onCancel}
        >
          取消
        </Button>
      </div>
      <p className="mt-2 text-2xs text-muted-foreground">
        🔐 签名在本地 WASM 沙箱完成，私钥不出设备 · Sepolia 测试网
      </p>
    </div>
  )
}

function ApiKeySetup({ onSet }: { onSet: () => void }) {
  const [key, setKey] = useState(getApiKey() ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    if (!key.trim()) return
    setSaving(true)
    setApiKey(key.trim())
    setTimeout(() => {
      setSaving(false)
      toast.success('✅ API Key 已保存', { description: `AI 助手现在由 ${detectProvider(key.trim()) === 'anthropic' ? 'Claude' : 'DeepSeek'} 驱动` })
      onSet()
    }, 300)
  }

  return (
    <div className="rounded-xl border border-ai-subtle-border bg-surface-ai-tinted p-4 space-y-3">
      <p className="text-body-sm font-medium">
        🔑 配置 Anthropic API Key 以启用真实 AI 对话
      </p>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="sk-ant-api03-..."
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-body-sm font-mono outline-none transition-colors focus:border-ring"
      />
      <div className="flex gap-2">
        <Button variant="default" size="sm" disabled={!key.trim() || saving} onClick={handleSave}>
          {saving ? '保存中...' : '启用 AI'}
        </Button>
        <Button variant="outline" size="sm" onClick={onSet}>
          跳过，使用本地模式
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">
        Key 仅在浏览器内存和 localStorage 中使用，通过本地代理转发，不会泄露至第三方服务器。
      </p>
    </div>
  )
}

// ---------- 消息数据 ----------

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  riskLevel?: string
  actions?: { label: string; action: string }[]
  transactionPreview?: TransactionPreview
  isStreaming?: boolean
  intent?: WalletIntent
  intentStatus?: 'pending' | 'executing' | 'success' | 'failed'
  intentResult?: string
}

// ---------- 主页面 ----------

export default function AssistantPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // 从持久化历史恢复消息
  const [messages, setMessages] = useState<DisplayMessage[]>(() => {
    const history = getConversationHistory()
    if (history.length > 0) {
      return history.map((m, i) => ({
        id: `hist-${i}`,
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString(),
      }))
    }
    return [
      {
        id: 'msg-01',
        role: 'assistant',
        content: '你好！我是 Chronicle AI 守护助手 🤖\n\n我是你的链上伙伴，不只是聊天——我能真正帮你操作钱包：\n\n🎯 **Intent 交易** — 直接告诉我「转 0.1 ETH 给 0x...」，我会构建交易让你一键确认\n⏳ **创建时间胶囊** — 说「锁定 0.5 ETH 到 2027 年」就能创建\n🛡️ **风险分析** — 分析任何交易的安全风险\n📊 **资产管理** — 帮你理解资产分布和优化策略\n\n试试下面的快捷操作，或者直接告诉我你想做什么！',
        timestamp: new Date().toISOString(),
        riskLevel: 'info',
        actions: [
          { label: '💸 演示转账', action: 'demo_transfer' },
          { label: '⏳ 创建时间胶囊', action: 'create_capsule' },
          { label: '📊 资产分析', action: 'analyze_portfolio' },
        ],
      },
    ]
  })

  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showApiSetup, setShowApiSetup] = useState(!hasApiKey())
  const endRef = useRef<HTMLDivElement>(null)
  const streamMsgId = useRef<string>('')
  const isDemoRef = useRef(false)
  const isProcessingRef = useRef(false)

  // 注入动态钱包上下文
  useEffect(() => {
    setWalletContext({
      totalBalance: '$29,310.00',
      totalChange: '+4.2%',
      assetCount: walletAssets.length,
      chainCount: 4,
      securityScore: computeSecurityScore(),
      chainDays: chainDays(),
    })
  }, [])

  // 读取来自仪表盘的快捷输入 / 演示模式
  useEffect(() => {
    const q = searchParams.get('q')
    const demo = searchParams.get('demo')
    setSearchParams({}, { replace: true })

    if (demo === 'transfer' || demo === 'full') {
      isDemoRef.current = true
      const steps = demo === 'full'
        ? [
            '转 0.05 ETH 给 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
            '换成 USDC 然后存入 Aave',
            '分析我的资产并给建议',
          ]
        : ['转 0.05 ETH 给 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1']

      const run = async () => {
        for (let i = 0; i < steps.length; i++) {
          await new Promise(r => setTimeout(r, i === 0 ? 500 : 2000))
          handleSendRef.current(steps[i])
          // 等待上一步完成（poll isProcessing via ref）
          await new Promise(r => {
            const check = setInterval(() => {
              if (!isProcessingRef.current) { clearInterval(check); r(undefined) }
            }, 300)
            setTimeout(() => { clearInterval(check); r(undefined) }, 20000)
          })
        }
        isDemoRef.current = false
      }
      run()
    } else if (q) {
      const timer = setTimeout(() => handleSendRef.current(q), 400)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 流式输出时过滤意图标记
  const stripIntent = (text: string) => text.replace(/<intent>[\s\S]*?<\/intent>/g, '').replace(/<intent>[\s\S]*/g, '')

  // 判断是否为安全/风险相关输入
  const shouldScanTx = useCallback((text: string): boolean => {
    const lower = text.toLowerCase()
    const riskWords = ['交易', '转账', '授权', 'approve', '签名', '风险', '安全吗', '有危险', '扫描', '检查']
    return riskWords.some((w) => lower.includes(w))
  }, [])

  const handleQuickPrompt = useCallback((prompt: string) => {
    setInput(prompt)
    handleSend(prompt)
  }, [])

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    // demo 模式下跳过 isProcessing 锁
    if (!content) return
    if (!isDemoRef.current && isProcessing) return

    addMessage({ role: 'user', content })
    setInput('')
    if (!isDemoRef.current) setIsProcessing(true)
    isProcessingRef.current = true

    // 智能交易扫描：如果用户提到了交易/安全相关关键词就触发
    let txPreview: TransactionPreview | undefined
    if (shouldScanTx(content)) {
      txPreview = tokenCore.scanTransactionRisk({
        to: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        value: '0',
        data: content.includes('授权') || content.includes('approve')
          ? '0x095ea7b30000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f984ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
          : '',
      })
    }

    // 创建流式消息占位
    const streamingId = `msg-stream-${Date.now()}`
    streamMsgId.current = streamingId
    const placeholder: DisplayMessage = {
      id: streamingId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }
    setMessages((prev) => [...prev, placeholder])

    // 调用流式 AI
    const response: AIResponse = await sendMessageStream(content, (chunk) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamMsgId.current ? { ...m, content: stripIntent(m.content + chunk) } : m,
        ),
      )
    })

    // 替换流式消息为最终消息
    const finalMsg: DisplayMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response.content,
      timestamp: new Date().toISOString(),
      riskLevel: response.riskLevel,
      actions: response.actions,
      transactionPreview: txPreview,
      isStreaming: false,
      intent: response.intent,
    }
    setMessages((prev) => prev.filter((m) => m.id !== streamingId).concat(finalMsg))

    streamMsgId.current = ''
    setIsProcessing(false)
    isProcessingRef.current = false
  }, [input, isProcessing, shouldScanTx])

  // 使用 useRef 避免闭包问题
  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend

  const addMessage = (msg: Omit<DisplayMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: `msg-${Date.now()}`, timestamp: new Date().toISOString() },
    ])
  }

  const executeIntent = useCallback(async (msgId: string, intent: WalletIntent) => {
    // 更新状态为执行中
    const updateMsg = (updates: Partial<DisplayMessage>) => {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...updates } : m)))
    }
    updateMsg({ intentStatus: 'executing' })

    if (!isDemoWalletReady()) {
      updateMsg({ intentStatus: 'failed', intentResult: '演示钱包未就绪，请刷新页面后重试' })
      return
    }

    const ethToWei = (eth: string) => {
      const val = parseFloat(eth)
      if (isNaN(val)) return '0'
      return String(Math.floor(val * 1e18))
    }

    try {
      let result: { success: boolean; data?: { txHash?: string; signature?: string }; error?: string }

      switch (intent.type) {
        case 'transfer':
          result = await tokenCore.signTransaction({
            password: getDemoPassword(),
            chain: 'ETHEREUM',
            derivationPath: "m/44'/60'/0'/0/0",
            input: {
              nonce: String(Date.now() % 1000),
              gasPrice: '20000000000',
              gasLimit: '21000',
              to: intent.params.to,
              value: ethToWei(intent.params.amount),
              chainId: '11155111',
            },
          })
          break

        case 'capsule': {
          // 签名交易
          result = await tokenCore.signTransaction({
            password: getDemoPassword(),
            chain: 'ETHEREUM',
            derivationPath: "m/44'/60'/0'/0/0",
            input: {
              nonce: String(Date.now() % 1000),
              gasPrice: '20000000000',
              gasLimit: '21000',
              to: intent.params.recipient,
              value: ethToWei(intent.params.amount),
              chainId: '11155111',
            },
          })
          // 同时保存胶囊到 localStorage
          if (result.success) {
            try {
              const STORAGE_KEY = 'chronicle_capsules'
              const raw = localStorage.getItem(STORAGE_KEY)
              const capsules = raw ? JSON.parse(raw) : []
              capsules.unshift({
                id: `cap-${Date.now()}`,
                title: intent.params.message ? intent.params.message.slice(0, 20) : `${intent.params.amount} ${intent.params.asset} 胶囊`,
                asset: intent.params.asset,
                amount: intent.params.amount,
                unlockDate: intent.params.unlockDate,
                recipient: intent.params.recipient,
                message: intent.params.message || '',
                status: 'locked',
                createdAt: new Date().toISOString(),
                progress: 0,
              })
              localStorage.setItem(STORAGE_KEY, JSON.stringify(capsules))
            } catch { /* ignore */ }
          }
          break
        }

        case 'approve':
          result = await tokenCore.signTransaction({
            password: getDemoPassword(),
            chain: 'ETHEREUM',
            derivationPath: "m/44'/60'/0'/0/0",
            input: {
              nonce: String(Date.now() % 1000),
              gasPrice: '20000000000',
              gasLimit: '50000',
              to: intent.params.spender,
              value: '0',
              data: `0x095ea7b3${intent.params.spender.slice(2).padStart(64, '0')}${intent.params.amount === 'unlimited' ? 'f'.repeat(64) : String(Math.floor(parseFloat(intent.params.amount) * 1e6)).padStart(64, '0')}`,
              chainId: '11155111',
            },
          })
          break

        case 'deposit': {
          const proto = intent.params.protocol.toLowerCase()
          const protoAddr = getContractAddress(proto)
          if (!protoAddr || !isProtocolAvailable(proto)) {
            updateMsg({
              intentStatus: 'failed',
              intentResult: `${proto === 'lido' ? 'Lido' : proto} 暂未在 Sepolia 测试网部署，当前仅支持 Aave V3。请说「存入 Aave」。`,
            })
            return
          }
          const dAssetAddr = intent.params.asset === 'ETH' ? CONTRACTS.WETH
            : (getTokenAddress(intent.params.asset) || CONTRACTS.USDC)
          const dAmount = intent.params.asset === 'ETH'
            ? ethToWei(intent.params.amount)
            : String(Math.floor(parseFloat(intent.params.amount) * 1e6))
          const dCalldata = buildAaveSupplyCalldata(dAssetAddr, dAmount, '0x9858EfFD232B4033E47d90003D41EC34EcaEda94')
          result = await tokenCore.signTransaction({
            password: getDemoPassword(),
            chain: 'ETHEREUM',
            derivationPath: "m/44'/60'/0'/0/0",
            input: {
              nonce: String(Date.now() % 1000),
              gasPrice: '20000000000',
              gasLimit: '300000',
              to: protoAddr,
              value: intent.params.asset === 'ETH' ? ethToWei(intent.params.amount) : '0',
              data: dCalldata,
              chainId: '11155111',
            },
          })
          break
        }

        case 'swap': {
          const sPath = buildSwapPath(intent.params.fromAsset, intent.params.toAsset)
          if (!sPath) {
            updateMsg({
              intentStatus: 'failed',
              intentResult: `暂不支持 ${intent.params.fromAsset} ↔ ${intent.params.toAsset} 兑换。支持的代币: ETH, USDC, USDT, DAI。`,
            })
            return
          }
          const sCalldata = buildUniswapSwapCalldata(
            '0', sPath, '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
            Math.floor(Date.now() / 1000) + 3600,
          )
          result = await tokenCore.signTransaction({
            password: getDemoPassword(),
            chain: 'ETHEREUM',
            derivationPath: "m/44'/60'/0'/0/0",
            input: {
              nonce: String(Date.now() % 1000),
              gasPrice: '20000000000',
              gasLimit: '250000',
              to: CONTRACTS.UNISWAP_V2_ROUTER,
              value: intent.params.fromAsset === 'ETH' ? ethToWei(intent.params.amount) : '0',
              data: sCalldata,
              chainId: '11155111',
            },
          })
          break
        }

        case 'plan': {
          let planResult = ''
          const steps = intent.params.steps
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i]
            updateMsg({
              intentStatus: 'executing',
              intentResult: `执行中: 第 ${i + 1}/${steps.length} 步...`,
            })
            try {
              const stepAmt = 'amount' in step.params ? (step.params as { amount: string }).amount : '0'
              const stepTo = 'to' in step.params ? (step.params as { to: string }).to
                : 'recipient' in step.params ? (step.params as { recipient: string }).recipient
                : 'spender' in step.params ? (step.params as { spender: string }).spender
                : CONTRACTS.AAVE_V3_POOL
              const stepResult = await tokenCore.signTransaction({
                password: getDemoPassword(),
                chain: 'ETHEREUM',
                derivationPath: "m/44'/60'/0'/0/0",
                input: {
                  nonce: String(Date.now() % 1000 + i),
                  gasPrice: '20000000000',
                  gasLimit: '21000',
                  to: stepTo,
                  value: ethToWei(stepAmt),
                  chainId: '11155111',
                },
              })
              if (stepResult.success) {
                planResult += `✅ 第${i + 1}步: ${stepResult.data?.txHash?.slice(0, 14)}...\n`
              } else {
                planResult += `❌ 第${i + 1}步失败: ${stepResult.error}\n`
                break
              }
            } catch (err) {
              planResult += `❌ 第${i + 1}步异常: ${String(err)}\n`
              break
            }
          }
          updateMsg({
            intentStatus: planResult.includes('❌') ? 'failed' : 'success',
            intentResult: planResult.trim() || '计划执行完成',
          })
          return
        }

        default:
          updateMsg({ intentStatus: 'failed', intentResult: '不支持的交易类型' })
          return
      }

      if (result.success) {
        const txHash = result.data?.txHash || result.data?.signature || '已签名'
        updateMsg({ intentStatus: 'success', intentResult: txHash })

        // AI 主动跟进：生成交易后叙事和下一步建议
        if (hasApiKey()) {
          const intentDesc = intent.type === 'transfer'
            ? `转账 ${intent.params.amount} ${intent.params.asset} 给 ${(intent.params as { to: string }).to.slice(0, 10)}...`
            : intent.type === 'capsule'
              ? `创建时间胶囊：锁定 ${intent.params.amount} ${intent.params.asset} 到 ${(intent.params as { unlockDate: string }).unlockDate.slice(0, 10)}`
              : intent.type === 'deposit'
                ? `存入 ${intent.params.amount} ${intent.params.asset} 到 ${(intent.params as { protocol: string }).protocol}`
                : intent.type === 'swap'
                  ? `兑换 ${intent.params.amount} ${intent.params.fromAsset} → ${(intent.params as { toAsset: string }).toAsset}`
                  : intent.type
          const followUpPrompt = `用户刚刚确认了一笔交易并签名完成：${intentDesc}。交易哈希：${txHash}。请作为Chronicle AI助手，用2-3句话：1）叙事化解读这笔交易的意义 2）基于用户当前资产状况（总资产约$29,310，含ETH/BTC/USDC等），给出1个下一步建议。温暖、简洁，像朋友聊天。`
          sendMessageStream(followUpPrompt, () => {}).then((resp) => {
            if (resp.content) {
              setMessages((prev) => [...prev, {
                id: `followup-${Date.now()}`,
                role: 'assistant',
                content: resp.content,
                timestamp: new Date().toISOString(),
                riskLevel: 'info',
              }])
            }
          })
        }
      } else {
        updateMsg({
          intentStatus: 'failed',
          intentResult: result.error || '签名失败',
        })
      }
    } catch (err) {
      updateMsg({
        intentStatus: 'failed',
        intentResult: String(err),
      })
    }
  }, [])

  const cancelIntent = useCallback((msgId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, intent: undefined, intentStatus: undefined } : m)))
  }, [])

  const handleClear = () => {
    resetConversation()
    setMessages([
      {
        id: 'msg-reset',
        role: 'assistant',
        content: '对话已清空。有什么可以帮你的？',
        timestamp: new Date().toISOString(),
        riskLevel: 'info',
      },
    ])
  }

  const handleAction = (action: string) => {
    switch (action) {
      case 'go_capsules': navigate('/capsules'); break
      case 'go_dashboard': navigate('/'); break
      case 'go_chronicle': navigate('/chronicle'); break
      case 'go_security': handleQuickPrompt('检查我的钱包安全状态'); break
      case 'analyze_portfolio': handleQuickPrompt('我的资产分布怎么样'); break
      case 'simulate_defi': handleQuickPrompt('推荐一个安全的 DeFi 策略'); break
      case 'create_capsule': handleQuickPrompt('帮我创建一个时间胶囊，锁定 0.5 ETH 到明年生日'); break
      case 'demo_transfer': handleQuickPrompt('转 0.05 ETH 给 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'); break
      case 'demo_defi': handleQuickPrompt('换成 USDC 然后存入 Aave'); break
      case 'help': handleQuickPrompt('你能做什么'); break
    }
  }

  const demoReady = isDemoWalletReady()

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <div className="mb-6">
        <h2 className="text-title-lg font-bold tracking-tight">AI 守护助手</h2>
        <p className="mt-1 text-body-md text-muted-foreground">
          Intent-centric AI 钱包 — 说出你想做什么，我来执行
          {hasApiKey() && <span className="ml-2 text-success-text text-caption font-medium">● {getProvider() === 'anthropic' ? 'Claude' : 'DeepSeek'} 已连接</span>}
          {!hasApiKey() && <span className="ml-2 text-warning-text text-caption">● 本地模式</span>}
        </p>
      </div>

      <div className="mx-auto max-w-3xl">
        {showApiSetup && (
          <div className="mb-4">
            <ApiKeySetup onSet={() => setShowApiSetup(false)} />
          </div>
        )}

        <div className="flex h-[calc(100vh-13rem)] flex-col">
          {/* 消息列表 */}
          <div className="flex-1 space-y-6 overflow-y-auto pb-4">
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm',
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-[#007fff] to-[#2168db] text-white'
                    : 'bg-gradient-to-br from-[#0cc5ff]/20 to-[#007fff]/20 text-[#007fff]',
                )}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className={cn('min-w-0 max-w-[80%]', msg.role === 'user' ? 'items-end' : 'items-start')}>
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-body-sm',
                      msg.role === 'user'
                        ? 'bg-[#007fff] text-white rounded-br-md'
                        : 'bg-card border border-border rounded-bl-md',
                    )}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                      {msg.isStreaming && <span className="animate-pulse">▍</span>}
                    </div>

                    {msg.riskLevel && msg.role === 'assistant' && !msg.isStreaming && (
                      <div className="mt-2">
                        <RiskBadge level={msg.riskLevel} />
                      </div>
                    )}

                    {msg.intent && !msg.isStreaming && (
                      <div className="mt-3">
                        <IntentConfirmCard
                          intent={msg.intent}
                          intentStatus={msg.intentStatus}
                          intentResult={msg.intentResult}
                          onConfirm={() => executeIntent(msg.id, msg.intent!)}
                          onCancel={() => cancelIntent(msg.id)}
                        />
                      </div>
                    )}

                    {!msg.intent && msg.transactionPreview && !msg.isStreaming && (
                      <TransactionPreviewCard preview={msg.transactionPreview} />
                    )}

                    {msg.actions && !msg.isStreaming && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.actions.map((a) => (
                          <button
                            key={a.action}
                            className="rounded-full bg-surface-blue px-3 py-1.5 text-caption font-medium text-[#007fff] transition-colors hover:bg-[#007fff]/10"
                            onClick={() => handleAction(a.action)}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* 输入区域 */}
          <div className="shrink-0 border-t border-border pt-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {quickPrompts.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  disabled={isProcessing}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-caption text-muted-foreground transition-colors hover:border-[#007fff]/30 hover:text-[#007fff] disabled:opacity-50"
                >
                  {prompt.length > 20 ? prompt.slice(0, 20) + '...' : prompt}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 transition-colors focus-within:border-[#007fff]/40 focus-within:shadow-[0_0_0_3px_rgba(0,127,255,0.1)]">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={hasApiKey() ? '告诉我想做什么... (Enter 发送，Shift+Enter 换行)' : '告诉我想做什么...'}
                disabled={isProcessing}
                rows={1}
                className="flex-1 resize-none bg-transparent px-3 py-2 text-body-md outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 max-h-32"
                style={{ minHeight: '2.5rem' }}
              />
              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 1 && (
                  <button
                    onClick={handleClear}
                    className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary transition-colors text-sm"
                    title="清空对话"
                  >
                    🗑️
                  </button>
                )}
                {!hasApiKey() && (
                  <button
                    onClick={() => setShowApiSetup(true)}
                    className="flex size-9 items-center justify-center rounded-full bg-warning-surface text-warning-text hover:bg-warning-surface/80 transition-colors text-sm"
                    title="启用 AI"
                  >
                    🔑
                  </button>
                )}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isProcessing}
                  className={`flex size-9 items-center justify-center rounded-full text-white transition-all ${
                    input.trim()
                      ? 'bg-[#007fff] hover:bg-[#0056b3] shadow-[var(--shadow-cta-sm)]'
                      : 'bg-muted cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? '⏳' : '↑'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-4 flex items-center justify-center gap-3 text-caption text-muted-foreground/60">
          <span>🛡️ Token Core WASM · 私钥不出设备</span>
          <span>·</span>
          <span>Sepolia 测试网</span>
          <span>·</span>
          <span>imToken 十周年 AI 共创</span>
        </div>
      </div>
    </div>
  )
}
