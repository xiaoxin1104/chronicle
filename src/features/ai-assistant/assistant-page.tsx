import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import { toast } from '@repo/ui/components/toast'
import { useNavigate, useSearchParams } from 'react-router'
import { quickPrompts, walletAssets, chronicleEvents } from '../../data/mock'
import { tokenCore, isDemoWalletReady, getDemoPassword, type TransactionPreview } from '../../lib/token-core'
import {
  sendMessageStream,
  setApiKey,
  hasApiKey,
  getApiKey,
  setWalletContext,
  resetConversation,
  getConversationHistory,
  clearApiKey,
  type AIResponse,
  type WalletIntent,
} from '../../lib/ai-service'
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
      <div className="mt-3 rounded-xl border border-success-border bg-success-surface p-4">
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
      className={`mt-3 rounded-xl border bg-card p-4 ${
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
          className="flex-1"
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
      toast.success('✅ API Key 已保存', { description: 'AI 助手现在由 Claude 驱动' })
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
  // 用于跟踪最新消息 ID 的流式更新
  const streamMsgId = useRef<string>('')

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

    const timer = setTimeout(() => {
      if (demo === 'transfer') {
        handleSendRef.current('转 0.05 ETH 给 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1')
      } else if (q) {
        handleSendRef.current(q)
      }
    }, 400)
    return () => clearTimeout(timer)
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
    if (!content || isProcessing) return

    addMessage({ role: 'user', content })
    setInput('')
    setIsProcessing(true)

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

        default:
          updateMsg({ intentStatus: 'failed', intentResult: '不支持的交易类型' })
          return
      }

      if (result.success) {
        updateMsg({
          intentStatus: 'success',
          intentResult: result.data?.txHash || result.data?.signature || '已签名',
        })
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
          {hasApiKey() && <span className="ml-2 text-success-text text-caption font-medium">● Claude 已连接</span>}
          {!hasApiKey() && <span className="ml-2 text-warning-text text-caption">● 本地模式（Intent 交易可用）</span>}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.5fr]">
        {/* 对话区域 */}
        <Card className="flex h-[calc(100vh-14rem)] flex-col">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle>💬 对话</CardTitle>
              <div className="flex items-center gap-2">
                {messages.length > 1 && (
                  <button
                    onClick={handleClear}
                    className="rounded-full px-3 py-1 text-caption font-medium text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    🗑️ 清空
                  </button>
                )}
                {!hasApiKey() && (
                  <button
                    onClick={() => setShowApiSetup(true)}
                    className="rounded-full px-3 py-1 text-caption font-medium bg-warning-surface text-warning-text hover:bg-warning-surface/80 transition-colors"
                  >
                    + 启用 AI
                  </button>
                )}
                <Badge variant={hasApiKey() ? 'success' : 'neutral'}>
                  {hasApiKey() ? 'Claude' : '本地'}
                </Badge>
              </div>
            </div>
          </CardHeader>

          {showApiSetup && (
            <div className="px-4 pb-2">
              <ApiKeySetup onSet={() => setShowApiSetup(false)} />
            </div>
          )}

          <CardContent className="flex-1 space-y-4 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-18 px-4 py-3 text-body-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground shadow-[var(--shadow-cta-sm)]'
                      : 'bg-surface-blue text-muted-foreground',
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
                    <IntentConfirmCard
                      intent={msg.intent}
                      intentStatus={msg.intentStatus}
                      intentResult={msg.intentResult}
                      onConfirm={() => executeIntent(msg.id, msg.intent!)}
                      onCancel={() => cancelIntent(msg.id)}
                    />
                  )}

                  {!msg.intent && msg.transactionPreview && !msg.isStreaming && (
                    <TransactionPreviewCard preview={msg.transactionPreview} />
                  )}

                  {msg.actions && !msg.isStreaming && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.actions.map((a) => (
                        <button
                          key={a.action}
                          className="rounded-full bg-card px-3 py-1 text-caption font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                          onClick={() => handleAction(a.action)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </CardContent>

          {/* 输入区域 */}
          <div className="shrink-0 border-t border-border p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={hasApiKey() ? '输入你的问题... (回车发送)' : '输入你的问题... (本地规则引擎模式)'}
                disabled={isProcessing}
                className="flex-1 rounded-full border border-border bg-input-background px-4 py-2.5 text-body-md outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              />
              <Button
                variant="default"
                size="default"
                disabled={!input.trim() || isProcessing}
                onClick={() => handleSend()}
              >
                {isProcessing ? '⏳' : '→'}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleQuickPrompt(prompt)}
                  disabled={isProcessing}
                  className="rounded-full border border-border bg-card px-3 py-1 text-caption text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* 侧边信息面板 */}
        <div className="space-y-4">
          {/* Intent 能力 */}
          <Card>
            <CardHeader>
              <CardTitle>🎯 Intent 交易能力</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: '自然语言转账', desc: '「转 0.1 ETH 给 0x...」', ok: true },
                { label: '时间胶囊创建', desc: '「锁定 0.5 ETH 到 2027 年」', ok: true },
                { label: 'Token Core 签名', desc: 'WASM 沙箱本地签名', ok: true },
                { label: '风险扫描', desc: '无限授权/大额/未知合约检测', ok: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-xl bg-surface-cool px-3 py-2.5">
                  <span className="text-base shrink-0">{item.ok ? '✅' : '⏳'}</span>
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium">{item.label}</p>
                    <p className="text-caption text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-xl bg-gradient-to-br from-[#007fff]/[0.04] to-[#0cc5ff]/[0.04] border border-[#007fff]/15 p-3">
                <p className="text-caption font-medium text-[#007fff]">
                  🎉 Intent-centric 交易：传统钱包点 5 次，Chronicle 一句话 + 一键确认
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 border border-border">
                <p className="text-caption text-muted-foreground">
                  📋 DApp 连接（WalletConnect）、Permit 签名、合约验证将在后续版本支持。当前为独立钱包模式。
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 技术栈 */}
          <Card>
            <CardHeader>
              <CardTitle>🔧 技术栈</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'create_keystore', desc: '钱包创建/导入' },
                { label: 'derive_accounts', desc: 'BIP44 地址派生' },
                { label: 'sign_tx', desc: '交易签名 (WASM)' },
                { label: 'cache_keystore', desc: 'Keystore 缓存' },
              ].map((api) => (
                <div key={api.label} className="flex items-center gap-3 rounded-lg bg-surface-cool px-3 py-2">
                  <code className="text-caption font-mono text-primary">{api.label}</code>
                  <span className="text-caption text-muted-foreground">{api.desc}</span>
                </div>
              ))}
              {hasApiKey() && (
                <div className="flex items-center gap-3 rounded-lg bg-[#007fff]/[0.04] px-3 py-2 border border-[#007fff]/10">
                  <code className="text-caption font-mono text-[#007fff]">claude-haiku-4.5</code>
                  <span className="text-caption text-muted-foreground">流式 SSE</span>
                </div>
              )}
              <div className="rounded-xl bg-[#2168db]/[0.04] border border-[#2168db]/10 p-3">
                <p className="text-caption text-[#2168db] font-medium">
                  🎉 imToken 十周年 AI 共创 · Intent-centric Wallet
                </p>
              </div>
              {hasApiKey() && (
                <button
                  onClick={() => { clearApiKey(); setShowApiSetup(true); toast('API Key 已清除', { description: '已切换回本地模式' }) }}
                  className="w-full rounded-xl bg-destructive/10 px-3 py-2 text-caption font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                  断开 Claude 连接
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
