import { Badge } from '@repo/ui/components/badge'
import { Button } from '@repo/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card'
import { Progress } from '@repo/ui/components/progress'
import { toast } from '@repo/ui/components/toast'
import { timeCapsules, type TimeCapsule } from '../../data/mock'
import { countdownTo, formatDate, cn } from '../../lib/utils'
import { tokenCore, isDemoWalletReady, getDemoPassword } from '../../lib/token-core'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'

// ---------- 品牌 ----------

const BRAND_GRADIENT = 'bg-gradient-to-r from-[#007fff] via-[#2168db] to-[#0cc5ff]'
const BRAND_TEXT_GRADIENT = 'bg-gradient-to-r from-[#007fff] to-[#0cc5ff] bg-clip-text text-transparent'

// ---------- 工具 ----------

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const STORAGE_KEY = 'chronicle_capsules'

interface ParsedPrompt {
  asset: string; amount: string; unlockDate: string; recipient: string; message: string
}

function parsePrompt(prompt: string): ParsedPrompt | null {
  const result: ParsedPrompt = {
    asset: 'ETH', amount: '0.5', unlockDate: '',
    recipient: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94', message: '',
  }

  const ethMatch = prompt.match(/([\d.]+)\s*ETH/i)
  const usdcMatch = prompt.match(/([\d,]+)\s*USDC/i)
  if (ethMatch) { result.asset = 'ETH'; result.amount = ethMatch[1] }
  else if (usdcMatch) { result.asset = 'USDC'; result.amount = usdcMatch[1].replace(',', '') }

  const dateMatch = prompt.match(/(\d{4})[年-](\d{1,2})[月-](\d{1,2})/)
  if (dateMatch) {
    const [, y, m, d] = dateMatch
    result.unlockDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`
  } else if (/明年|元旦|新年/.test(prompt)) {
    result.unlockDate = '2027-01-01T00:00:00Z'
  } else if (/暑假/.test(prompt)) {
    result.unlockDate = '2026-08-20T00:00:00Z'
  } else if (/生日/.test(prompt)) {
    result.unlockDate = '2027-06-15T00:00:00Z'
  }

  if (!result.unlockDate) return null

  const msgMatch = prompt.match(/写.*?[：:]\s*(.+?)(?:$|，|。)/)
  if (msgMatch) result.message = msgMatch[1]
  else {
    const trailing = prompt.split(/[，。]/).pop()?.trim()
    if (trailing && trailing.length > 2 && trailing.length < 50) result.message = trailing
  }

  return result
}

// ---------- 胶囊卡片 ----------

function CapsuleCard({
  capsule,
  onUnlock,
  nonce,
}: {
  capsule: TimeCapsule
  onUnlock: (id: string) => void
  nonce: number
}) {
  const target = new Date(capsule.unlockDate)
  const [countdown, setCountdown] = useState(() => countdownTo(target))
  const [isOpening, setIsOpening] = useState(false)
  const [unlocked, setUnlocked] = useState(capsule.status === 'unlocked')

  useEffect(() => {
    if (unlocked) return
    const timer = setInterval(() => setCountdown(countdownTo(target)), 1000)
    return () => clearInterval(timer)
  }, [target, unlocked])

  const handleOpen = async () => {
    if (!isDemoWalletReady()) {
      toast.error('钱包未就绪', { description: '请等待演示钱包初始化完成' })
      return
    }
    setIsOpening(true)
    try {
      const ethToWei = (eth: string) => {
        const val = parseFloat(eth)
        if (isNaN(val)) return '0'
        return String(Math.floor(val * 1e18))
      }
      const result = await tokenCore.signTransaction({
        password: getDemoPassword(),
        chain: 'ETHEREUM',
        derivationPath: "m/44'/60'/0'/0/0",
        input: {
          nonce: String(nonce),
          gasPrice: '20000000000',
          gasLimit: '21000',
          to: capsule.recipient,
          value: ethToWei(capsule.amount),
          chainId: '11155111',
        },
      })
      if (result.success) {
        setUnlocked(true)
        onUnlock(capsule.id)
        toast.success('🎉 胶囊已解锁！', {
          description: `${capsule.amount} ${capsule.asset} 已释放 (tx: ${result.data?.txHash?.slice(0, 14)}...)`,
        })
      } else {
        toast.error('签名失败', { description: result.error })
      }
    } catch (err) {
      toast.error('解锁失败', { description: String(err) })
    }
    setIsOpening(false)
  }

  const currentStatus: 'locked' | 'unlocking' | 'unlocked' = unlocked ? 'unlocked' : capsule.status

  const displayConfig = {
    locked: { label: '🔒 锁定中', variant: 'primary' as const },
    unlocking: { label: '🔓 即将解锁', variant: 'success' as const },
    unlocked: { label: '✅ 已解锁', variant: 'success' as const },
  }
  const dc = displayConfig[currentStatus]

  const isUnlockable =
    !unlocked &&
    (capsule.status === 'unlocking' || (capsule.status === 'locked' && countdown.total <= 0))

  const progressValue = unlocked ? 100 : capsule.progress

  return (
    <Card className={cn(
      'group transition-all duration-300 hover:shadow-[var(--shadow-card)]',
      capsule.status === 'unlocking' && 'ring-1 ring-success/30',
      unlocked && 'opacity-80',
    )}>
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h4 className="text-body-lg font-semibold">{capsule.title}</h4>
            <p className="mt-0.5 text-caption text-muted-foreground">创建于 {formatDate(capsule.createdAt)}</p>
          </div>
          <Badge variant={dc.variant} size="md">{dc.label}</Badge>
        </div>

        {/* 资产 + 接收 */}
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-br from-[#007fff]/[0.04] to-[#0cc5ff]/[0.04] border border-[#007fff]/10 px-4 py-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg ${BRAND_GRADIENT} text-white`}>
            {capsule.asset === 'ETH' ? '⟠' : capsule.asset === 'USDC' ? '$' : '🔷'}
          </div>
          <div>
            <div className="text-body-md font-bold">{capsule.amount} {capsule.asset}</div>
            <div className="text-caption text-muted-foreground" title={capsule.recipient}>
              接收: {truncateAddress(capsule.recipient)}
            </div>
          </div>
        </div>

        {/* 留言 */}
        {capsule.message && (
          <div className="mb-4 rounded-xl bg-surface-blue px-4 py-2.5 italic text-body-sm text-muted-foreground border border-[#007fff]/8">
            💌 "{capsule.message.slice(0, 80)}{capsule.message.length > 80 ? '...' : ''}"
          </div>
        )}

        {/* 倒计时 */}
        {unlocked ? (
          <div className="mb-4 rounded-xl bg-success-surface border border-success/20 p-3 text-center">
            <p className="text-body-sm font-semibold text-success-text">🎉 胶囊已于 {formatDate(capsule.unlockDate)} 解锁</p>
            <p className="mt-1 text-caption text-muted-foreground">
              {capsule.amount} {capsule.asset} 已释放至 {truncateAddress(capsule.recipient)}
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-body-sm">
              <span className="text-muted-foreground">解锁倒计时</span>
              <span className="font-semibold">{formatDate(capsule.unlockDate)}</span>
            </div>
            <Progress value={progressValue} size="sm" variant="primary" />
            <div className="mt-3 flex gap-2 text-center">
              {[
                { value: countdown.days, label: '天' },
                { value: countdown.hours, label: '时' },
                { value: countdown.minutes, label: '分' },
                { value: countdown.seconds, label: '秒' },
              ].map((unit) => (
                <div key={unit.label} className="flex-1 rounded-lg bg-surface-cool py-2">
                  <div className="text-body-sm font-bold tabular-nums">{String(Math.max(0, unit.value)).padStart(2, '0')}</div>
                  <div className="text-2xs text-muted-foreground">{unit.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          variant={unlocked ? 'secondary' : isUnlockable ? 'default' : 'secondary'}
          size="sm"
          className="w-full"
          disabled={unlocked || !isUnlockable || isOpening}
          onClick={handleOpen}
        >
          {unlocked
            ? '✅ 已解锁'
            : isOpening
              ? '⏳ 解锁中...'
              : isUnlockable
                ? '🔓 解锁胶囊'
                : countdown.total > 0
                  ? `还需等待 ${countdown.days} 天`
                  : '已过期'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------- 创建胶囊对话框 ----------

function CreateCapsuleDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (capsule: TimeCapsule) => void }) {
  const [step, setStep] = useState(1)
  const [prompt, setPrompt] = useState('')
  const [parsed, setParsed] = useState<ParsedPrompt | null>(null)
  const [generating, setGenerating] = useState(false)
  const [parseError, setParseError] = useState('')

  const suggestedPrompts = [
    '帮我把 0.5 ETH 存到 2027-06-15，作为女儿的生日礼物',
    '锁定 1000 USDC 到 2027-01-01，写一段话给未来的自己：你会感谢现在努力的你',
    '创建一个旅行基金胶囊，0.3 ETH 在 2026-08-20 解锁',
  ]

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('请先描述你想创建的时间胶囊')
      return
    }
    setParseError('')
    setGenerating(true)
    await new Promise((r) => setTimeout(r, 800))

    const result = parsePrompt(prompt)
    setGenerating(false)

    if (!result) {
      setParseError('未能识别日期，请包含具体日期（如 2027-06-15 或"明年元旦"）')
      return
    }
    setParsed(result)
    setStep(2)
  }

  const handleConfirm = () => {
    if (!parsed) return
    const newCapsule: TimeCapsule = {
      id: `cap-${Date.now()}`,
      title: parsed.message ? parsed.message.slice(0, 20) : `${parsed.amount} ${parsed.asset} 胶囊`,
      asset: parsed.asset,
      amount: parsed.amount,
      unlockDate: parsed.unlockDate,
      recipient: parsed.recipient,
      message: parsed.message || '',
      status: 'locked',
      createdAt: new Date().toISOString(),
      progress: 0,
    }
    onCreated(newCapsule)
    toast.success('🎉 时间胶囊已创建！', {
      description: '可在下方列表中查看和管理所有胶囊。',
    })
    onClose()
  }

  if (step === 2 && parsed) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="rounded-2xl border border-success-border bg-success-surface p-4">
          <p className="text-body-sm font-semibold text-success-text">✅ 已解析你的意图</p>
          <div className="mt-3 space-y-2.5 text-body-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">资产</span>
              <span className="font-medium">{parsed.amount} {parsed.asset}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">解锁日期</span>
              <span className="font-medium">{parsed.unlockDate.slice(0, 10)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">接收地址</span>
              <span className="font-mono text-xs">{truncateAddress(parsed.recipient)}</span>
            </div>
            {parsed.message && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">附带留言</span>
                <span className="font-medium italic">"{parsed.message.slice(0, 24)}"</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gas 预估</span>
              <span className="font-medium">~$2.40 (Sepolia)</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => { setStep(1); setParsed(null) }}>
            重新编辑
          </Button>
          <Button variant="default" size="sm" className="flex-1" onClick={handleConfirm}>
            确认创建胶囊
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className={`rounded-xl p-3 border border-[#007fff]/20 ${BRAND_GRADIENT.replace('bg-gradient-to-r', 'bg-gradient-to-br')} text-white`}>
        <p className="text-body-sm font-semibold">🤖 AI 对话式创建</p>
        <p className="mt-1 text-caption text-white/80">
          用自然语言描述你想创建的时间胶囊，AI 会帮你解析并生成交易预览。请包含：资产类型和金额 + 解锁日期。
        </p>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => { setPrompt(e.target.value); setParseError('') }}
        placeholder="例如：帮我把 0.5 ETH 存到 2027-06-15，作为女儿的生日礼物..."
        className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-body-md outline-none transition-colors focus:border-[#007fff] focus:ring-2 focus:ring-[#007fff]/20"
        rows={3}
      />

      {parseError && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-body-sm text-destructive">⚠️ {parseError}</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-caption text-muted-foreground">或者试试这些：</p>
        {suggestedPrompts.map((p) => (
          <button
            key={p}
            className="block w-full rounded-xl border border-border bg-card px-4 py-2.5 text-left text-body-sm transition-colors hover:border-[#007fff]/30 hover:bg-[#007fff]/[0.02]"
            onClick={() => { setPrompt(p); setParseError('') }}
          >
            💡 {p}
          </button>
        ))}
      </div>

      <Button
        variant="default"
        size="lg"
        className="w-full"
        disabled={generating || !prompt.trim()}
        onClick={handleGenerate}
      >
        {generating ? '⏳ 智能解析中...' : '🤖 生成时间胶囊'}
      </Button>
    </div>
  )
}

// ---------- 主页面 ----------

function loadCapsules(): TimeCapsule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return timeCapsules
}

function saveCapsules(capsules: TimeCapsule[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(capsules)) } catch { /* ignore */ }
}

export default function CapsulePage() {
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [capsules, setCapsules] = useState<TimeCapsule[]>(loadCapsules)
  const nonceCounter = useRef(0)

  const handleUnlock = useCallback((id: string) => {
    setCapsules((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, status: 'unlocked' as const, progress: 100 } : c))
      saveCapsules(next)
      return next
    })
  }, [])

  const handleCreated = useCallback((capsule: TimeCapsule) => {
    setCapsules((prev) => {
      const next = [capsule, ...prev]
      saveCapsules(next)
      return next
    })
    nonceCounter.current += 1
  }, [])

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      {/* 标题行 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-title-lg font-bold tracking-tight">时间胶囊</h2>
          <p className="mt-1 text-body-md text-muted-foreground">
            AI 对话式创建链上定时交易——让资产穿越时间
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={() => navigate('/assistant')}>
            🤖 用 AI 创建
          </Button>
          <Button variant="default" size="lg" onClick={() => setShowCreate(true)} className={BRAND_GRADIENT}>
            ⏳ 创建时间胶囊
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
        {/* 胶囊网格 */}
        <div className="grid gap-4 sm:grid-cols-2">
          {capsules.map((capsule, idx) => (
            <CapsuleCard
              key={capsule.id}
              capsule={capsule}
              onUnlock={handleUnlock}
              nonce={nonceCounter.current + idx}
            />
          ))}
          {capsules.length === 0 && (
            <div className="col-span-2 py-20 text-center">
              <div className={`inline-flex size-20 items-center justify-center rounded-full text-3xl ${BRAND_GRADIENT} text-white shadow-[var(--shadow-cta)]`}>
                ⏳
              </div>
              <p className="mt-4 text-body-lg text-muted-foreground">还没有时间胶囊</p>
              <p className="mt-1 text-body-sm text-muted-foreground">用 AI 创建你的第一个链上时间胶囊</p>
              <Button variant="default" size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
                开始创建
              </Button>
            </div>
          )}
        </div>

        {/* 信息面板 */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>⏳ 什么是时间胶囊？</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-body-sm text-muted-foreground leading-relaxed">
              时间胶囊是 Chronicle 的核心创新功能。用自然语言创建一笔「定时交易」——锁定资产到未来某个时刻，届时释放给指定接收者。
            </p>
            <div className="space-y-3">
              {[
                { icon: '🤖', title: 'AI 对话式创建', desc: '无需填写复杂表单，自然语言描述即可' },
                { icon: '🔒', title: '时间锁定', desc: '资产在指定日期前无法提取，真正的时间为锁' },
                { icon: '💌', title: '附带加密留言', desc: '为未来解锁者留下一段会被记住的话' },
                { icon: '🛡️', title: 'Token Core 签名', desc: '底层使用 WASM 沙箱完成交易签名' },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-xl bg-surface-cool p-3">
                  <span className="text-xl shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-body-sm font-semibold">{item.title}</p>
                    <p className="text-caption text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-gradient-to-br from-[#007fff]/[0.04] to-[#0cc5ff]/[0.04] border border-[#007fff]/10 p-4">
              <p className="text-body-sm font-semibold text-[#007fff] mb-2">💡 试试跟 AI 说</p>
              <div className="space-y-1.5">
                {[
                  '"帮我把 0.5 ETH 锁到 2027 年，给女儿生日"',
                  '"存 1000 USDC 作为明年旅行基金"',
                  '"创建一个胶囊，留言给未来的自己"',
                ].map((t, i) => (
                  <p key={i} className="text-caption text-muted-foreground italic">{t}</p>
                ))}
              </div>
              <Button variant="default" size="sm" className="mt-3 w-full" onClick={() => navigate('/assistant')}>
                🤖 去 AI 助手试试
              </Button>
            </div>

            <div className="rounded-xl bg-warning-surface/50 border border-warning/20 p-3">
              <p className="text-body-sm text-warning-text">
                ⚠️ 演示使用 Sepolia 测试网，时间锁定为 UI 概念展示。生产级实现需部署链上 Timelock 合约。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 创建弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-surface/50 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="mx-4 w-full max-w-md animate-soft-bloom rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-dialog)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-title-sm font-bold">创建时间胶囊</h3>
              <button onClick={() => setShowCreate(false)} className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary transition-colors">✕</button>
            </div>
            <CreateCapsuleDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />
          </div>
        </div>
      )}
    </div>
  )
}
