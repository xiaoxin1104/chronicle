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

function computeInsights(): AIInsight[] {
  const insights: AIInsight[] = []
  const ethAsset = walletAssets.find(a => a.symbol === 'ETH')
  const usdcAsset = walletAssets.find(a => a.symbol === 'USDC')

  if (ethAsset && parseFloat(ethAsset.amount) > 1) {
    insights.push({
      icon: '💡',
      title: `${parseFloat(ethAsset.amount).toFixed(1)} ETH 闲置中 — 质押可年获 ~0.08 ETH`,
      description: '存入 Lido 获取 stETH，APY 3.1%。stETH 还可作 Aave 抵押品实现双重收益。',
      prompt: `我有 ${ethAsset.amount} ETH 闲置，帮我分析最好的收益策略`,
      priority: 'high',
    })
  }
  if (usdcAsset && parseFloat(usdcAsset.amount.replace(',', '')) > 1000) {
    insights.push({
      icon: '💰',
      title: `${usdcAsset.amount} USDC 零收益 — Aave 存款 APY 4.2%`,
      description: '闲置稳定币在钱包里不会增值。一句话存入 Aave 开始赚利息。',
      prompt: `帮我把 ${usdcAsset.amount} USDC 存入 Aave`,
      priority: 'high',
    })
  }
  insights.push({
    icon: '⏳',
    title: '还没创建过时间胶囊？',
    description: '锁定一笔资产给未来的自己或家人。"帮我把 0.5 ETH 锁到 2027 年作为女儿生日礼物"',
    prompt: '帮我创建一个时间胶囊，锁定 0.5 ETH 到 2027 年 6 月',
    priority: 'medium',
  })
  return insights
}

// ---------- 快捷操作 ----------

const QUICK_ACTIONS = [
  { icon: '💸', label: '转账', prompt: '转 0.05 ETH 给 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1', gradient: 'from-[#007fff]/10 to-[#007fff]/5' },
  { icon: '⏳', label: '创建时间胶囊', prompt: '帮我创建一个时间胶囊，锁定 0.5 ETH 到 2027 年', gradient: 'from-[#0cc5ff]/10 to-[#0cc5ff]/5' },
  { icon: '🛡️', label: '安全检查', prompt: '检查我的钱包安全状态', gradient: 'from-[#4bce71]/10 to-[#4bce71]/5' },
  { icon: '📊', label: '资产分析', prompt: '分析我的资产分布，推荐优化方案', gradient: 'from-[#8b5cf6]/10 to-[#8b5cf6]/5' },
]

// ---------- 主页面 ----------

export default function DashboardPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputVal, setInputVal] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [chainBalances, setChainBalances] = useState<ChainBalance[] | null>(null)
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null)
  const [rpcReady, setRpcReady] = useState<boolean | null>(null)
  const [connectedChains, setConnectedChains] = useState(0)
  const apiConnected = hasApiKey()
  const demoReady = isDemoWalletReady()

  const insights = useMemo(computeInsights, [])

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
    navigate('/assistant?demo=transfer')
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

        {/* 快捷操作 */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.prompt)}
              className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-gradient-to-br ${action.gradient} px-4 py-2 text-body-sm font-medium transition-all hover:border-[#007fff]/20 hover:shadow-[var(--shadow-card)]`}
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* 演示按钮 — 在快捷操作下方，不抢输入框的视觉焦点 */}
        <div className="mt-3 flex justify-center gap-3">
          <button onClick={handleDemoStart} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium text-white transition-all duration-300 ${BRAND_GRADIENT} hover:opacity-90 hover:shadow-[var(--shadow-cta-sm)]`}>
            <span>▶</span><span>演示转账</span>
          </button>
          <button onClick={() => navigate('/assistant?q=' + encodeURIComponent('换成 USDC 然后存入 Aave'))} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-body-sm font-medium text-muted-foreground transition-colors hover:border-[#007fff]/30 hover:text-[#007fff]">
            <span>🔀</span><span>演示 DeFi</span>
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

        {/* WalletConnect 占位 — DApp 生态集成 */}
        <Card className="lg:col-span-2 border-dashed border-[#007fff]/20 bg-gradient-to-br from-[#007fff]/[0.02] to-transparent">
          <CardHeader>
            <CardTitle>🔌 DApp 生态集成</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-[#007fff]/20 bg-[#007fff]/[0.04] text-2xl">
                🔗
              </div>
              <div className="min-w-0">
                <p className="text-body-sm font-semibold">WalletConnect · Permit 签名</p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  连接 DApp、签署 Permit/EIP-712 签名、合约交互——基于 Token Core 的 DApp 沙箱正在接入中。
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#007fff]/10 px-2 py-0.5 text-2xs font-medium text-[#007fff]">
                    ⏳ 路线图中
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    当前独立钱包模式已覆盖转账、DeFi 存款、代币兑换
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
