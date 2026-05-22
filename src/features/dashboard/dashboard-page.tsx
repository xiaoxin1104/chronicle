import { Badge } from '@repo/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import { SectionPanel } from '@repo/ui/components/section-panel'
import { walletAssets, totalBalance, totalChange, chronicleEvents } from '../../data/mock'
import { isDemoWalletReady } from '../../lib/token-core'
import { hasApiKey, getProvider } from '../../lib/ai-service'
import { fetchAllChainBalances, fetchNetworkInfo, isRpcAvailable, DEMO_ADDRESS, CHAINS, type ChainBalance, type NetworkInfo } from '../../lib/etherscan'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'

// ---------- 品牌 ----------

const BRAND_GRADIENT = 'bg-gradient-to-r from-[#007fff] via-[#2168db] to-[#0cc5ff]'
const BRAND_TEXT_GRADIENT = 'bg-gradient-to-r from-[#007fff] to-[#0cc5ff] bg-clip-text text-transparent'

// ---------- AI 洞察计算 ----------

interface AIInsight {
  icon: string; title: string; description: string; prompt: string; priority: 'high' | 'medium'
}

function computeInsights(rpcBalances?: { eth: string; txCount: number } | null): AIInsight[] {
  const insights: AIInsight[] = []

  // 优先用 RPC 真实数据，否则 fallback 到 mock
  const hasRealEth = rpcBalances && parseFloat(rpcBalances.eth) > 0
  const ethAmount = hasRealEth ? rpcBalances!.eth : '2.48'
  const ethDisplay = hasRealEth ? `${parseFloat(ethAmount).toFixed(4)} ETH` : '2.5 ETH'
  const txCount = rpcBalances?.txCount ?? 306

  if (hasRealEth && parseFloat(ethAmount) > 0.001) {
    insights.push({
      icon: '💡',
      title: `${ethDisplay} 存在于链上 — 要不要让它帮你赚更多？`,
      description: `当前 Sepolia 余额 ${ethDisplay}，${txCount} 笔历史交易。闲置资产可以通过 Lido 质押或 Aave 存款产生收益。`,
      prompt: `我有 ${ethDisplay} 在钱包里，帮我分析怎么增值`,
      priority: 'high',
    })
  } else if (!hasRealEth) {
    insights.push({
      icon: '💡',
      title: '链上钱包已就绪，准备开始你的 Web3 之旅',
      description: `已确认 Sepolia 连接正常（${txCount} 笔历史交易）。领取测试币后即可体验完整的 Intent 交易流程。`,
      prompt: '帮我创建一个时间胶囊，锁定 0.5 ETH 到 2027 年',
      priority: 'high',
    })
  }

  const usdcAsset = walletAssets.find(a => a.symbol === 'USDC')
  if (usdcAsset && parseFloat(usdcAsset.amount.replace(',', '')) > 1000) {
    insights.push({
      icon: '💰',
      title: `${usdcAsset.amount} USDC（模拟）零收益 — Aave 存款 APY 4.2%`,
      description: '闲置稳定币在钱包里不会增值。一句话存入 Aave 开始赚利息。',
      prompt: `帮我把 ${usdcAsset.amount} USDC 存入 Aave`,
      priority: 'medium',
    })
  }
  insights.push({
    icon: '⏳',
    title: '时间胶囊是 Chronicle 最独特的功能',
    description: '锁定一笔资产给未来的自己或家人。"帮我把 0.5 ETH 锁到 2027 年作为女儿生日礼物"',
    prompt: '帮我创建一个时间胶囊，锁定 0.5 ETH 到 2027 年 6 月',
    priority: 'medium',
  })
  return insights
}

// ---------- WalletConnect 演示 ----------

function WCDemoModal({ onClose, onSign }: { onClose: () => void; onSign: () => void }) {
  const [step, setStep] = useState(0)

  const steps = [
    {
      title: '📱 扫描 WalletConnect QR 码',
      content: (
        <div className="text-center space-y-3">
          <div className="mx-auto flex size-40 items-center justify-center rounded-2xl border-2 border-[#007fff]/20 bg-white p-4">
            <svg viewBox="0 0 100 100" className="size-full">
              <rect x="10" y="10" width="80" height="80" rx="8" fill="none" stroke="#007fff" strokeWidth="2" />
              <rect x="25" y="25" width="10" height="10" fill="#007fff" /><rect x="65" y="25" width="10" height="10" fill="#007fff" />
              <rect x="25" y="65" width="10" height="10" fill="#007fff" /><rect x="45" y="45" width="10" height="10" fill="#007fff" />
              <rect x="55" y="55" width="6" height="6" fill="#007fff" /><rect x="35" y="35" width="6" height="6" fill="#007fff" />
              <rect x="55" y="25" width="6" height="6" fill="#007fff" /><rect x="25" y="55" width="6" height="6" fill="#007fff" />
            </svg>
          </div>
          <p className="text-body-sm text-muted-foreground">模拟 Uniswap DApp 连接请求</p>
          <button onClick={() => setStep(1)} className="rounded-full bg-[#007fff] px-6 py-2 text-body-sm font-medium text-white hover:opacity-90 transition-all">
            模拟扫码连接
          </button>
        </div>
      ),
    },
    {
      title: '🔗 Uniswap 请求连接你的钱包',
      content: (
        <div className="space-y-3">
          <div className="rounded-xl bg-surface-blue p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-[#ff007a]/10 text-lg">🦄</div>
              <div>
                <p className="text-body-sm font-semibold">Uniswap Interface</p>
                <p className="text-caption text-muted-foreground">https://app.uniswap.org</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border p-3 space-y-2 text-body-sm">
            <p className="font-medium">请求权限</p>
            <p className="text-muted-foreground">✅ 查看钱包地址</p>
            <p className="text-muted-foreground">✅ 请求交易签名</p>
            <p className="text-muted-foreground">❌ 不请求资产转移权限</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(prev => Math.max(0, prev - 1))} className="flex-1 rounded-full border border-border px-4 py-2 text-body-sm hover:bg-secondary">拒绝</button>
            <button onClick={() => setStep(2)} className="flex-1 rounded-full bg-[#007fff] px-4 py-2 text-body-sm font-medium text-white hover:opacity-90">连接</button>
          </div>
        </div>
      ),
    },
    {
      title: '✅ 已连接 · Uniswap 请求签名',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-success animate-pulse" />
            <span className="text-body-sm font-medium text-success-text">Uniswap (Sepolia) · 会话活跃</span>
          </div>
          <div className="rounded-xl border border-[#007fff]/20 bg-[#007fff]/[0.02] p-4">
            <p className="text-body-sm font-semibold mb-2">📝 签名请求</p>
            <div className="space-y-2 text-body-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">DApp</span><span>Uniswap</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">方法</span><span className="font-mono text-xs">swapExactETHForTokens</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">金额</span><span className="font-semibold">0.1 ETH → USDC</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">合约</span><span className="font-mono text-xs">0xC532...9008</span></div>
            </div>
          </div>
          <p className="text-caption text-muted-foreground">
            ℹ️ 这是通过 WalletConnect 发起的真实 DApp 签名请求流程演示
          </p>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 rounded-full border border-border px-4 py-2 text-body-sm hover:bg-secondary">拒绝</button>
            <button onClick={() => { onSign(); onClose() }} className="flex-1 rounded-full bg-[#007fff] px-4 py-2 text-body-sm font-medium text-white hover:opacity-90">签名并确认</button>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-surface/50 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-md animate-soft-bloom rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-dialog)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-title-sm font-bold">{steps[step].title}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary">✕</button>
        </div>
        {steps[step].content}
        <div className="mt-4 flex justify-center gap-2">
          {steps.map((_, i) => (
            <div key={i} className={`size-2 rounded-full transition-all ${i === step ? 'bg-[#007fff] scale-125' : 'bg-border'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- 主页面 ----------

export default function DashboardPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputVal, setInputVal] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showWCDemo, setShowWCDemo] = useState(false)
  const [chainBalances, setChainBalances] = useState<ChainBalance[] | null>(null)
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null)
  const [rpcReady, setRpcReady] = useState<boolean | null>(null)
  const [connectedChains, setConnectedChains] = useState(0)
  const apiConnected = hasApiKey()
  const demoReady = isDemoWalletReady()

  const insights = useMemo(() => {
    const ethBal = chainBalances?.find(cb => cb.chain.key === 'ethereum')
    return computeInsights(ethBal ? { eth: ethBal.balance?.eth ?? '0', txCount: ethBal.txCount ?? 0 } : null)
  }, [chainBalances])

  // 多链 RPC 查询
  useEffect(() => {
    Promise.all([fetchAllChainBalances(), fetchNetworkInfo()]).then(([balances, net]) => {
      setChainBalances(balances)
      setNetworkInfo(net)
      const connected = balances.filter(b => b.balance !== null).length
      setConnectedChains(connected)
      setRpcReady(connected > 0)
    })
  }, [])

  // 自动聚焦输入框
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(timer)
  }, [])

  const handleSend = () => {
    const msg = inputVal.trim()
    if (!msg) return
    navigate(`/assistant?q=${encodeURIComponent(msg)}`)
  }

  const handleQuickAction = (prompt: string) => {
    navigate(`/assistant?q=${encodeURIComponent(prompt)}`)
  }

  const handleDemoStart = () => {
    navigate('/assistant?demo=full')
  }

  const handleInsightClick = (prompt: string) => {
    navigate(`/assistant?q=${encodeURIComponent(prompt)}`)
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      {/* ===== Hero: AI 对话入口 ===== */}
      <div className="mb-8 text-center">
        {/* 状态指示 */}
        <div className="mb-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-1.5">
          <span className={`size-2 rounded-full ${demoReady ? 'bg-success animate-pulse' : 'bg-warning'}`} />
          <span className="text-caption text-muted-foreground">
            {demoReady ? 'WASM 就绪' : '初始化中...'}
          </span>
          <span className="text-caption text-muted-foreground">·</span>
          <span className={`text-caption font-medium ${rpcReady ? 'text-success-text' : rpcReady === false ? 'text-muted-foreground' : 'text-warning-text'}`}>
            {rpcReady ? `${connectedChains}/${CHAINS.length} 链实时 #${networkInfo?.blockNumber?.toLocaleString() ?? ''}` : rpcReady === false ? '多链测试网' : '连接 RPC...'}
          </span>
          <span className="text-caption text-muted-foreground">·</span>
          <span className={`text-caption font-medium ${apiConnected ? 'text-success-text' : 'text-muted-foreground'}`}>
            {apiConnected ? (getProvider() === 'anthropic' ? 'Claude' : 'DeepSeek') : '本地'}
          </span>
          <span className="text-caption text-[#2168db] bg-[#2168db]/5 px-2 py-0.5 rounded-full font-medium">
            十周年
          </span>
          {rpcReady && networkInfo && (
            <span className="text-caption text-muted-foreground">
              {networkInfo.gasPrice} Gwei
            </span>
          )}
        </div>

        {/* 主标题 */}
        <h1 className={`text-display-lg font-bold tracking-tight mb-2 ${apiConnected ? BRAND_TEXT_GRADIENT : 'text-foreground'}`}>
          {apiConnected ? '你想用钱包做什么？' : '你的 AI 时光钱包'}
        </h1>
        <p className="text-body-lg text-muted-foreground max-w-lg mx-auto">
          {apiConnected
            ? '直接告诉我——转账、创建时间胶囊、分析资产。一句话，我来执行。'
            : '用自然语言操作钱包：转账、锁定资产、分析风险。说就行了。'}
        </p>

        {/* 演示数据声明 */}
        <p className="mt-3 text-caption text-muted-foreground/60">
          {rpcReady
            ? `⚡ Sepolia 实时 · 区块 #${networkInfo?.blockNumber?.toLocaleString() ?? '...'} · ${networkInfo?.gasPrice ?? '...'} Gwei`
            : '⚡ 演示环境 · 模拟数据为基础，可选接入 Sepolia RPC'}
        </p>

        {/* AI 输入框 — 主交互入口 */}
        <div className="mt-6 mx-auto max-w-xl">
          <div className={`flex items-center gap-2 rounded-2xl border bg-card p-2 transition-all duration-300 ${
            isTyping
              ? 'border-[#007fff]/40 shadow-[0_0_0_4px_rgba(0,127,255,0.1)]'
              : 'border-border shadow-[var(--shadow-card)]'
          }`}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#007fff]/10 text-lg">
              🤖
            </div>
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onFocus={() => setIsTyping(true)}
              onBlur={() => setIsTyping(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={apiConnected ? '直接告诉我想做什么... 转账、存款、换币都行' : '直接告诉我想做什么...'}
              className="flex-1 bg-transparent px-2 py-2 text-body-md outline-none placeholder:text-muted-foreground/50"
            />
            <button
              onClick={handleSend}
              disabled={!inputVal.trim()}
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-white transition-all ${
                inputVal.trim()
                  ? `${BRAND_GRADIENT} hover:opacity-90 hover:shadow-[var(--shadow-cta-sm)]`
                  : 'bg-muted cursor-not-allowed'
              }`}
            >
              →
            </button>
          </div>
        </div>

        {/* 快捷能力 + 演示入口 — 一行简洁呈现 */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {[
            { icon: '💸', label: '转账' },
            { icon: '🔀', label: '兑换' },
            { icon: '⏳', label: '时间胶囊' },
            { icon: '🛡️', label: '安全检查' },
          ].map((cap) => (
            <button
              key={cap.label}
              onClick={() => handleQuickAction(
                cap.label === '转账' ? '转 0.05 ETH 给 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1' :
                cap.label === '兑换' ? '换 0.1 ETH 为 USDC' :
                cap.label === '时间胶囊' ? '帮我创建一个时间胶囊，锁定 0.5 ETH 到 2027 年' :
                '检查我的钱包安全状态'
              )}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-caption font-medium text-muted-foreground transition-all hover:border-[#007fff]/30 hover:text-[#007fff] hover:bg-[#007fff]/[0.03]"
            >
              <span className="text-xs">{cap.icon}</span>
              <span>{cap.label}</span>
            </button>
          ))}
          <span className="text-muted-foreground/30 mx-1">|</span>
          <button onClick={handleDemoStart} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-medium text-white transition-all duration-300 ${BRAND_GRADIENT} hover:opacity-90 hover:shadow-[var(--shadow-cta-sm)]`}>
            <span>▶</span><span>60 秒演示</span>
          </button>
        </div>
      </div>

      {/* ===== AI 洞察 ===== */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className={`size-1.5 rounded-full ${apiConnected ? 'bg-success animate-pulse' : 'bg-warning'}`} />
          <h2 className="text-title-sm font-bold">AI 洞察</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {insights.map((insight, i) => (
            <button
              key={i}
              onClick={() => handleInsightClick(insight.prompt)}
              className={`group rounded-2xl border p-4 text-left transition-all duration-300 hover:shadow-[var(--shadow-card)] ${
                insight.priority === 'high'
                  ? 'border-[#007fff]/20 bg-[#007fff]/[0.02]'
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#007fff]/8 text-lg mb-3">
                {insight.icon}
              </div>
              <p className="text-body-sm font-semibold leading-snug mb-1.5 group-hover:text-[#007fff] transition-colors">
                {insight.title}
              </p>
              <p className="text-caption text-muted-foreground leading-relaxed mb-3">
                {insight.description}
              </p>
              <span className="text-caption font-medium text-[#007fff] group-hover:underline">
                跟 AI 聊聊 →
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ===== 最小化资产摘要 + 编年史入口 ===== */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* 资产摘要 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>资产概览</CardTitle>
              <div className="flex items-center gap-2">
                {rpcReady && (
                  <Badge variant="success" size="sm">{connectedChains}/{CHAINS.length} 链</Badge>
                )}
                <Badge variant="positive" size="sm">{totalChange}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {rpcReady && chainBalances ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {chainBalances.map((cb) => (
                    <div key={cb.chain.key} className={`rounded-xl px-3 py-2 text-center border ${
                      cb.balance && Number(cb.balance.eth) > 0 ? 'border-success/20 bg-success-surface/30' : 'border-border bg-surface-cool'
                    }`}>
                      <div className="text-caption text-muted-foreground">{cb.chain.name}</div>
                      <div className={`text-body-sm font-bold ${cb.balance && Number(cb.balance.eth) > 0 ? 'text-success-text' : 'text-muted-foreground'}`}>
                        {cb.balance ? `${cb.balance.eth} ETH` : '—'}
                      </div>
                      <div className="text-2xs text-muted-foreground">
                        {cb.txCount !== null ? `${cb.txCount} 笔` : ''}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-caption text-muted-foreground font-mono">{DEMO_ADDRESS.slice(0, 12)}...{DEMO_ADDRESS.slice(-6)}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(DEMO_ADDRESS)
                      import('@repo/ui/components/toast').then(m => m.toast('已复制地址', { description: '转账前请核对完整地址' }))
                    }}
                    className="shrink-0 rounded-lg px-2 py-1 text-caption text-[#007fff] hover:bg-[#007fff]/10 transition-colors"
                    title="复制地址"
                  >
                    📋
                  </button>
                </div>
                <p className="mt-2 text-caption text-muted-foreground">
                  ↑ {connectedChains}/{CHAINS.length} 条链实时数据 ·{' '}
                  <button onClick={() => navigate('/assistant')} className="text-[#007fff] hover:underline font-medium">
                    让 AI 分析 →
                  </button>
                </p>
              </>
            ) : (
              <>
                <p className="text-title-md font-bold">{totalBalance}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {walletAssets.slice(0, 5).map((a) => (
                    <span key={a.symbol} className="inline-flex items-center gap-1 rounded-full bg-surface-cool px-2.5 py-1 text-caption font-medium">
                      <span className={`size-1.5 rounded-full ${
                        a.change.startsWith('+') ? 'bg-success' : a.change.startsWith('-') ? 'bg-destructive' : 'bg-muted-foreground'
                      }`} />
                      {a.symbol} {a.amount}
                    </span>
                  ))}
                  <span className="inline-flex items-center rounded-full bg-surface-cool px-2.5 py-1 text-caption text-muted-foreground">
                    +{walletAssets.length - 5} 种
                  </span>
                </div>
                <p className="mt-3 text-caption text-muted-foreground">
                  4 条链 · {walletAssets.length} 种资产（模拟）·{' '}
                  <button onClick={() => navigate('/assistant')} className="text-[#007fff] hover:underline font-medium">
                    让 AI 详细分析 →
                  </button>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 最近链上足迹 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>最近链上足迹</CardTitle>
              <button onClick={() => navigate('/chronicle')} className="text-caption font-medium text-[#007fff] hover:underline">
                查看编年史 →
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {chronicleEvents.slice(0, 4).map((evt) => (
              <button
                key={evt.id}
                onClick={() => navigate('/chronicle')}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-page"
              >
                <span className="text-sm shrink-0">
                  {evt.type === 'nft' ? '🎨' : evt.type === 'defi' ? '💧' : evt.type === 'staking' ? '🥩' : '💸'}
                </span>
                <span className="flex-1 truncate text-body-sm">{evt.title}</span>
                <span className="shrink-0 text-caption text-muted-foreground">{evt.value}</span>
              </button>
            ))}
            {chronicleEvents.length === 0 && (
              <p className="py-4 text-center text-body-sm text-muted-foreground">
                开始你的链上之旅，留下第一条足迹
              </p>
            )}
          </CardContent>
        </Card>

        {/* WalletConnect — DApp 生态集成 */}
        <Card
          className="lg:col-span-2 border-[#007fff]/20 bg-gradient-to-br from-[#007fff]/[0.02] to-transparent cursor-pointer hover:border-[#007fff]/40 hover:shadow-[var(--shadow-card)] transition-all duration-300"
          onClick={() => setShowWCDemo(true)}
        >
          <CardHeader>
            <CardTitle>🔌 DApp 生态集成 · WalletConnect</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-[#007fff]/20 bg-[#007fff]/[0.04] text-2xl">
                🔗
              </div>
              <div className="min-w-0">
                <p className="text-body-sm font-semibold">点击演示 WalletConnect DApp 签名流程</p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  QR 扫码 → Uniswap 连接 → 签名请求 → Token Core WASM 确认。完整 DApp→钱包交互链路。
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-2xs font-medium text-success-text">
                    ▶ 点击演示
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    WalletConnect · Permit · EIP-712 · 合约交互
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* WalletConnect 演示弹窗 */}
      {showWCDemo && (
        <WCDemoModal
          onClose={() => setShowWCDemo(false)}
          onSign={() => navigate('/assistant?q=' + encodeURIComponent('转 0.1 ETH 给 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'))}
        />
      )}
    </div>
  )
}
