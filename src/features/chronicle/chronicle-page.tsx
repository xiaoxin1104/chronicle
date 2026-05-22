import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Chip } from '@repo/ui/components/chip'
import { cn } from '../../lib/utils'
import { chronicleEvents, type EventType, type ChronicleEvent } from '../../data/mock'
import { formatDate, formatRelative } from '../../lib/utils'
import { hasApiKey, sendMessageStream } from '../../lib/ai-service'
import { fetchTxCount, isRpcAvailable } from '../../lib/etherscan'
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router'

// ---------- 品牌常量 ----------

const BRAND_GRADIENT = 'bg-gradient-to-r from-[#007fff] via-[#2168db] to-[#0cc5ff]'
const BRAND_TEXT_GRADIENT = 'bg-gradient-to-r from-[#007fff] to-[#0cc5ff] bg-clip-text text-transparent'

// ---------- 工具 ----------

function computeChainDays(): number {
  return Math.floor((Date.now() - new Date('2024-01-20').getTime()) / (1000 * 60 * 60 * 24))
}

function truncateAddress(addr: string): string {
  if (addr.length <= 14) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const typeConfig: Record<EventType, { icon: string; label: string; color: string; gradient: string }> = {
  transfer: { icon: '💸', label: '转账', color: '#007fff', gradient: 'from-[#007fff]/20 to-[#007fff]/5' },
  defi: { icon: '💧', label: 'DeFi', color: '#0cc5ff', gradient: 'from-[#0cc5ff]/20 to-[#0cc5ff]/5' },
  nft: { icon: '🎨', label: 'NFT', color: '#8b5cf6', gradient: 'from-[#8b5cf6]/20 to-[#8b5cf6]/5' },
  staking: { icon: '🥩', label: '质押', color: '#4bce71', gradient: 'from-[#4bce71]/20 to-[#4bce71]/5' },
  contract: { icon: '📜', label: '合约', color: '#f59e0b', gradient: 'from-[#f59e0b]/20 to-[#f59e0b]/5' },
}

// ---------- AI 叙事生成 ----------

interface NarrativeSummary {
  title: string
  content: string
  mood: string
  highlight: string
}

function generateNarrative(events: ChronicleEvent[]): NarrativeSummary {
  const milestones = events.filter(e => e.isMilestone)
  const defiCount = events.filter(e => e.type === 'defi').length
  const nftCount = events.filter(e => e.type === 'nft').length
  const chainDays = computeChainDays()

  // 基于实际事件计算叙事
  if (milestones.length >= 3) {
    return {
      title: '一个探索者的链上之旅',
      content: `在 ${chainDays} 天的链上生涯中，你完成了 ${milestones.length} 个里程碑。从第一笔交易到首次 DeFi 体验，再到 NFT 收藏——你正在构建一个丰富多彩的链上身份。`,
      mood: '探索者',
      highlight: `最近一次里程碑：${milestones[milestones.length - 1]?.milestoneLabel || '持续探索中'}`,
    }
  }
  return {
    title: '链上旅程刚刚开始',
    content: `你的链上编年史记录着 ${events.length} 个值得记忆的时刻。每一个链上操作都是你数字身份的一笔。继续探索，让故事更丰富。`,
    mood: '新手探索期',
    highlight: '期待你的第一个 DeFi 里程碑',
  }
}

function computePersonality(): { style: string; traits: string[]; score: number } {
  const types = chronicleEvents.map(e => e.type)
  const uniqueTypes = new Set(types)
  const defiRatio = types.filter(t => t === 'defi' || t === 'staking').length / types.length

  if (defiRatio > 0.3 && uniqueTypes.size >= 4) {
    return { style: 'DeFi 先锋', traits: ['敢于尝试新协议', '资金效率意识强', '多元化配置'], score: 85 }
  }
  if (uniqueTypes.size >= 4) {
    return { style: '全能探索者', traits: ['涉猎广泛', '好奇心驱动', '链上活跃度高'], score: 78 }
  }
  return { style: '稳健积累者', traits: ['交易谨慎', '长期持有', '安全第一'], score: 65 }
}

// ---------- EventCard ----------

function EventCard({ event }: { event: ChronicleEvent }) {
  const config = typeConfig[event.type]
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="group relative pl-10 pb-8 last:pb-0">
      {/* 时间轴竖线 */}
      <div className="absolute left-4 top-2 h-full w-px bg-border group-last:hidden" />

      {/* 节点 */}
      <div
        className={cn(
          'absolute left-2.5 top-2 z-10 flex size-5 items-center justify-center rounded-full border-2 border-card transition-all',
          event.isMilestone ? 'ring-2 ring-[#007fff]/30' : '',
        )}
        style={{ background: config.color }}
      >
        {event.isMilestone && <div className="size-2 rounded-full bg-white" />}
      </div>

      {/* 卡片 */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'cursor-pointer rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-[var(--shadow-card)]',
          event.isMilestone && `bg-gradient-to-r ${config.gradient} ring-1 ring-${config.color}/20`,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="neutral" size="sm">{config.icon} {config.label}</Badge>
              {event.isMilestone && event.milestoneLabel && (
                <Badge variant="primary" size="sm">⭐ {event.milestoneLabel}</Badge>
              )}
            </div>
            <h4 className="text-body-md font-semibold">{event.title}</h4>
            <p className="mt-0.5 text-body-sm text-muted-foreground">{event.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-body-sm font-semibold">{event.value}</div>
            <div className="text-caption text-muted-foreground" title={formatDate(event.timestamp)}>
              {formatRelative(new Date(event.timestamp))}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 animate-fade-in border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-4 text-body-sm">
              <div>
                <span className="text-muted-foreground">交易哈希</span>
                <p className="mt-0.5 font-mono text-xs break-all" title={event.txHash}>
                  {truncateAddress(event.txHash)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">交互地址</span>
                <p className="mt-0.5 font-mono text-xs" title={event.address}>
                  {truncateAddress(event.address)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">链</span>
                <p className="mt-0.5">{event.chain}</p>
              </div>
              <div>
                <span className="text-muted-foreground">状态</span>
                <p className="mt-0.5">
                  <Badge
                    variant={event.status === 'confirmed' ? 'success' : event.status === 'pending' ? 'neutral' : 'destructive'}
                    size="sm"
                  >
                    {event.status === 'confirmed' ? '✅ 已确认' : event.status === 'pending' ? '⏳ 待确认' : '❌ 失败'}
                  </Badge>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- 主页面 ----------

export default function ChroniclePage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<EventType | 'all'>('all')
  const [realTxCount, setRealTxCount] = useState<number | null>(null)
  const apiConnected = hasApiKey()
  const rpcReady = isRpcAvailable()

  // 合并数据（必须在 AI 叙事 useEffect 之前定义）
  const allEvents = useMemo(() => chronicleEvents, [])

  // AI 生成叙事（有 Claude 时用真实 AI）
  const [aiNarrative, setAiNarrative] = useState<NarrativeSummary | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)

  useEffect(() => {
    if (!apiConnected) return
    if (allEvents.length === 0) return
    setNarrativeLoading(true)
    const eventsSummary = allEvents
      .slice(0, 10)
      .map(e => `- ${formatDate(e.timestamp)}: ${e.title} (${e.description}) — ${e.value}`)
      .join('\n')
    const prompt = `基于以下链上交易记录，用中文写一段 2-3 句的链上叙事总结，包含一个叙事标题、一句叙事内容、一个链上人格 mood（如"DeFi 先锋""NFT 收藏家""稳健积累者"）、一个亮点标注。直接回复 JSON 格式：{"title":"...","content":"...","mood":"...","highlight":"..."}。\n\n交易记录：\n${eventsSummary}`
    sendMessageStream(prompt, () => {}).then((resp) => {
      try {
        const jsonMatch = resp.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          setAiNarrative(parsed)
        }
      } catch { /* fallback to static */ }
      setNarrativeLoading(false)
    })
  }, [apiConnected, allEvents])

  // 获取真实交易计数
  useEffect(() => {
    fetchTxCount().then((count) => {
      if (count !== null) setRealTxCount(count)
    })
  }, [])

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return allEvents
    return allEvents.filter((e) => e.type === filter)
  }, [filter, allEvents])

  const narrative = useMemo(() =>
    aiNarrative || generateNarrative(allEvents),
  [allEvents, aiNarrative])
  const personality = useMemo(computePersonality, [])
  const chainDays = useMemo(computeChainDays, [])

  // 年度统计使用合并数据
  const yearStats = useMemo(() => ({
    totalTxs: allEvents.length + (realTxCount ?? 176),
    activeMonths: new Set(allEvents.map(e => e.timestamp.slice(0, 7))).size,
    contractCalls: allEvents.filter(e => e.type === 'contract' || e.type === 'defi').length,
    gasConsumed: `${(allEvents.length * 0.003).toFixed(3)} ETH`,
  }), [allEvents, realTxCount])

  const filters: { key: EventType | 'all'; label: string; icon: string }[] = [
    { key: 'all', label: '全部', icon: '📋' },
    ...Object.entries(typeConfig).map(([key, cfg]) => ({
      key: key as EventType,
      label: cfg.label,
      icon: cfg.icon,
    })),
  ]

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      {/* 标题行 */}
      <div className="mb-6">
        <h2 className="text-title-lg font-bold tracking-tight">链上编年史</h2>
        <p className="mt-1 text-body-md text-muted-foreground">
          不只是交易列表——AI 帮你读懂自己的链上人生
          {rpcReady && realTxCount !== null && (
            <span className="ml-2 text-caption text-success-text font-medium">
              ● Sepolia 实时 · {realTxCount} 笔已确认交易
            </span>
          )}
        </p>
      </div>

      {/* AI 叙事 + 链上人格 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {/* AI 叙事 */}
        <div className="rounded-2xl border border-[#007fff]/20 bg-gradient-to-br from-[#007fff]/[0.04] to-[#0cc5ff]/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤖</span>
            <span className={`text-body-sm font-semibold ${apiConnected ? BRAND_TEXT_GRADIENT : 'text-foreground'}`}>
              {narrativeLoading ? 'AI 生成叙事中...' : aiNarrative ? '🤖 AI 实时叙事' : apiConnected ? 'AI 叙事' : '链上故事'}
            </span>
          </div>
          <h3 className="text-title-sm font-bold mb-2">{narrative.title}</h3>
          <p className="text-body-sm text-muted-foreground leading-relaxed">{narrative.content}</p>
          <div className="mt-3 rounded-xl bg-[#007fff]/[0.06] px-3 py-2">
            <p className="text-caption font-medium text-[#007fff]">📌 {narrative.highlight}</p>
          </div>
        </div>

        {/* 链上人格 */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🧬</span>
            <span className="text-body-sm font-semibold text-foreground">链上人格</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex size-16 shrink-0 items-center justify-center rounded-full text-2xl ${BRAND_GRADIENT} text-white shadow-[var(--shadow-cta-sm)]`}>
              {personality.style.slice(0, 2)}
            </div>
            <div>
              <h3 className="text-title-sm font-bold">{personality.style}</h3>
              <p className="text-caption text-muted-foreground">人格指数 {personality.score}/100</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {personality.traits.map(trait => (
              <span key={trait} className="rounded-full bg-surface-blue px-2.5 py-1 text-2xs font-medium text-[#007fff]">
                {trait}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.45fr]">
        <div>
          {/* 筛选器 */}
          <div className="mb-6 flex flex-wrap gap-2">
            {filters.map((f) => (
              <Chip
                key={f.key}
                selected={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.icon} {f.label}
              </Chip>
            ))}
          </div>

          {/* 时间轴 */}
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            {filteredEvents.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-body-lg text-muted-foreground mb-3">此类别暂无事件</p>
                <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                  📋 查看全部
                </Button>
              </div>
            ) : (
              filteredEvents.map((event) => <EventCard key={event.id} event={event} />)
            )}
          </div>
        </div>

        {/* 侧栏 */}
        <div className="space-y-6">
          {/* 里程碑 */}
          <Card>
            <CardHeader>
              <CardTitle>🏆 里程碑</CardTitle>
            </CardHeader>
            <div className="px-4 pb-4 space-y-3">
              {allEvents
                .filter((e) => e.isMilestone)
                .slice(0, 5)
                .map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#007fff]/5 to-transparent px-3 py-2.5 border border-[#007fff]/10">
                    <span className="text-xl">{typeConfig[m.type].icon}</span>
                    <div>
                      <p className="text-body-sm font-semibold">{m.milestoneLabel}</p>
                      <p className="text-caption text-muted-foreground">
                        {formatRelative(new Date(m.timestamp))} · {formatDate(m.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          {/* 年度概览 */}
          <Card>
            <CardHeader>
              <CardTitle>📊 2026 年度概览</CardTitle>
            </CardHeader>
            <div className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '总交易', value: `${yearStats.totalTxs} 笔`, icon: '📝' },
                  { label: '活跃月数', value: `${yearStats.activeMonths} 个月`, icon: '📅' },
                  { label: '合约交互', value: `${yearStats.contractCalls} 次`, icon: '🔧' },
                  { label: 'Gas 消耗', value: yearStats.gasConsumed, icon: '⛽' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-surface-cool p-3">
                    <div className="text-lg mb-0.5">{s.icon}</div>
                    <div className="text-caption text-muted-foreground">{s.label}</div>
                    <div className="text-body-md font-bold">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className={`rounded-xl p-3 border ${apiConnected ? 'bg-[#007fff]/[0.04] border-[#007fff]/15' : 'bg-surface-cool'}`}>
                <p className="text-body-sm font-medium text-foreground">
                  💡 链上年龄 {chainDays} 天 · 每一年都值得被记住
                </p>
                <button
                  onClick={() => navigate('/assistant')}
                  className="mt-2 text-caption font-medium text-[#007fff] hover:underline"
                >
                  🤖 让 AI 分析你的链上行为 →
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
