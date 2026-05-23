/**
 * AI 服务模块 — Chronicle
 *
 * 为 Chronicle AI 守护助手提供真实的 LLM 对话能力。
 * 支持 DeepSeek (OpenAI 兼容) 和 Anthropic Claude，自动根据 Key 前缀切换。
 * 包含流式响应、对话持久化、本地降级。
 */

import type { RiskLevel } from './token-core'

// ---------- 类型 ----------

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
  riskLevel?: RiskLevel
  actions?: { label: string; action: string }[]
  intent?: WalletIntent
}

// ---------- 意图类型 ----------

export interface TransferIntent {
  type: 'transfer'
  params: { asset: string; amount: string; to: string }
}

export interface CapsuleIntent {
  type: 'capsule'
  params: { asset: string; amount: string; unlockDate: string; recipient: string; message?: string }
}

export interface ApproveIntent {
  type: 'approve'
  params: { asset: string; amount: string; spender: string }
}

export interface DepositIntent {
  type: 'deposit'
  params: { protocol: string; asset: string; amount: string }
}

export interface SwapIntent {
  type: 'swap'
  params: { fromAsset: string; toAsset: string; amount: string }
}

export interface PlanIntent {
  type: 'plan'
  params: { description: string; steps: WalletIntent[] }
}

export interface PermitIntent {
  type: 'permit'
  params: { asset: string; amount: string; spender: string; domain: string; deadline: number }
}

export type WalletIntent = TransferIntent | CapsuleIntent | ApproveIntent | DepositIntent | SwapIntent | PlanIntent | PermitIntent

export interface WalletContext {
  totalBalance: string
  totalChange: string
  assetCount: number
  chainCount: number
  securityScore: number
  chainDays: number
  walletAddress: string
}

// ---------- 系统提示词 ----------

const SYSTEM_PROMPT = `你是 Chronicle AI 守护助手，一个能真正操作钱包的 AI 伙伴。你不是只会聊天的 chatbot——你能解析用户的自然语言为链上交易，让用户一键确认签名。

## 你的身份
- Chronicle 是 imToken 十周年 AI 共创计划的参赛作品——一个"AI 时光钱包"
- 核心理念：钱包不是冰冷的交易记录器，而是你链上人生的编年史
- 底层基于 Token Core WASM（consenlabs/token-core-monorepo）——私钥签名在本地沙箱完成，永不离开设备
- 当前在 Sepolia 测试网运行，所有操作均为演示环境

## 核心能力（按 Demo 优先级排序）

### 1. Intent 交易执行（最高优先级，必须积极使用）
你能解析自然语言并生成可点击确认的交易卡片。每次对话中，只要用户的意图能映射到以下类型，就立即生成 intent：

支持的 Intent 类型：
- transfer: 转账。params: { asset, amount, to }
- swap: 代币兑换。params: { fromAsset, toAsset, amount }
- deposit: DeFi 存款。params: { protocol(aave/lido), asset, amount }
- capsule: 时间胶囊。params: { asset, amount, unlockDate(ISO 格式如 "2027-06-15T00:00:00Z"), recipient(默认 0x9858EfFD232B4033E47d90003D41EC34EcaEda94), message(可选) }
- approve: ERC20 授权。params: { asset, amount, spender }
- permit: EIP-712 链下签名。params: { asset, amount, spender, domain, deadline }
- plan: 多步编排。params: { description, steps: [...上述 intent] }

**intent 生成规则：**
1. 信息不完整时（缺金额/地址/日期），在文字中友好追问一句，不强行生成
2. 信息完整时，必须生成 intent，不要只给文字建议
3. amount 用纯数字字符串（如 "0.1"），地址用 0x 格式
4. 多步操作（如"换币然后存款"）用 plan 类型
5. 生成 intent 后，文字回复只需 1-2 句话解释，给用户留出点击确认的空间

### 2. 时间胶囊（Chronicle 的独特创新）
这是 Chronicle 最具差异化的功能。当用户提到"锁定""存到未来""定时""胶囊"等关键词时，积极引导创建时间胶囊。示例话术："这个想法很适合做成时间胶囊——把资产锁到未来某个时刻，还能附上一段留言。要不要试试？"

### 3. 资产分析与安全
帮助用户理解资产分布、链上行为模式、安全隐患。始终附带一条具体的、可行动的建议。

## 回答风格
- 温暖、专业、像懂 Web3 的朋友聊天
- 使用 emoji 增强可读性（适度，不超过每句 1 个）
- 涉及安全问题时语气严肃明确
- 用中文回复
- **严格控制长度：2-4 句话，不超过 150 字**。你不是来写报告的，你是来帮用户做事的
- 结尾经常带一个「要不要...？」式的主动提议

## 安全底线
- 永远不要让用户把助记词或私钥发给你
- 提醒用户签名前核对地址和金额
- 当前在 Sepolia 测试网，无真实资产风险`

// ---------- API 配置 ----------

type Provider = 'deepseek' | 'anthropic'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

const ANTHROPIC_API_URL = import.meta.env.DEV
  ? '/api/anthropic/v1/messages'
  : 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

const STORAGE_KEY_KEY = 'chronicle_anthropic_key'
const STORAGE_KEY_CONV = 'chronicle_conversation'

// 大赛专用 Key（赛后弃用）
const COMPETITION_KEY = 'sk-e607c9f48a274e1784a3f5a53cd0335f'

export function detectProvider(key: string): Provider {
  return key.startsWith('sk-ant-') ? 'anthropic' : 'deepseek'
}

let apiKey: string | null = COMPETITION_KEY

// localStorage 中的手动输入 Key 优先于大赛 Key
try {
  const saved = localStorage.getItem(STORAGE_KEY_KEY)
  if (saved) apiKey = saved
} catch { /* ignore */ }

export function setApiKey(key: string): void {
  apiKey = key
  try { localStorage.setItem(STORAGE_KEY_KEY, key) } catch { /* ignore */ }
}

export function getApiKey(): string | null {
  return apiKey
}

export function hasApiKey(): boolean {
  return apiKey !== null && apiKey.length > 0
}

export function clearApiKey(): void {
  apiKey = COMPETITION_KEY // 恢复为大赛 Key
  try { localStorage.removeItem(STORAGE_KEY_KEY) } catch { /* ignore */ }
}

export function getProvider(): Provider | null {
  if (!apiKey) return null
  return detectProvider(apiKey)
}

// ---------- 对话状态 ----------

interface ConversationState {
  messages: ChatMessage[]
  walletContext: WalletContext | null
}

const defaultWalletContext: WalletContext = {
  totalBalance: '$29,310.00',
  totalChange: '+4.2%',
  assetCount: 6,
  chainCount: 4,
  securityScore: 92,
  chainDays: 847,
  walletAddress: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
}

const conversationState: ConversationState = {
  messages: [],
  walletContext: null,
}

// 启动时从 localStorage 恢复对话
try {
  const saved = localStorage.getItem(STORAGE_KEY_CONV)
  if (saved) {
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed)) conversationState.messages = parsed.slice(-40)
  }
} catch { /* ignore */ }

function saveConversation(): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONV, JSON.stringify(conversationState.messages.slice(-40)))
  } catch { /* ignore */ }
}

export function setWalletContext(ctx: Partial<WalletContext>): void {
  conversationState.walletContext = { ...defaultWalletContext, ...ctx }
}

function getWalletContext(): WalletContext {
  return conversationState.walletContext ?? defaultWalletContext
}

function buildSystemPrompt(): string {
  let prompt = SYSTEM_PROMPT
  const wc = getWalletContext()
  prompt += `\n\n## 当前钱包上下文\n- 总资产: ${wc.totalBalance} (${wc.totalChange})\n- 资产种类: ${wc.assetCount} 种\n- 覆盖链数: ${wc.chainCount} 条\n- 安全评分: ${wc.securityScore}/100\n- 链上天数: ${wc.chainDays} 天\n- 主钱包地址: ${wc.walletAddress}\n- 网络: Sepolia Testnet（测试网）`
  return prompt
}

// ---------- LLM 调用（流式，双提供商）----------

export async function sendMessageStream(
  userMessage: string,
  onChunk: (chunk: string) => void,
): Promise<AIResponse> {
  conversationState.messages.push({ role: 'user', content: userMessage })
  saveConversation()

  if (!apiKey) {
    const fallback = fallbackResponse(userMessage)
    for (const char of fallback.content) {
      onChunk(char)
      await new Promise((r) => setTimeout(r, 15))
    }
    return fallback
  }

  try {
    const systemPrompt = buildSystemPrompt()
    const provider = detectProvider(apiKey)
    const history = conversationState.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    let response: Response
    let streamBody: string

    if (provider === 'anthropic') {
      const isDevProxy = ANTHROPIC_API_URL.startsWith('/api/')
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
          ...(isDevProxy ? {} : { 'anthropic-dangerous-direct-browser-access': 'true' }),
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: history,
          stream: true,
        }),
      })
    } else {
      // DeepSeek / OpenAI 兼容
      const systemMsg = { role: 'system' as const, content: systemPrompt }
      response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          max_tokens: 1024,
          messages: [systemMsg, ...history],
          stream: true,
        }),
      })
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`API 错误 ${response.status}: ${errText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          if (provider === 'anthropic') {
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullContent += parsed.delta.text
              onChunk(parsed.delta.text)
            }
          } else {
            // OpenAI 兼容: choices[0].delta.content
            const chunk = parsed.choices?.[0]?.delta?.content
            if (chunk) {
              fullContent += chunk
              onChunk(chunk)
            }
          }
        } catch { /* skip */ }
      }
    }

    // buffer 剩余
    for (const line of buffer.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        if (provider === 'anthropic') {
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullContent += parsed.delta.text
            onChunk(parsed.delta.text)
          }
        } else {
          const chunk = parsed.choices?.[0]?.delta?.content
          if (chunk) {
            fullContent += chunk
            onChunk(chunk)
          }
        }
      } catch { /* ignore */ }
    }

    if (!fullContent) fullContent = '抱歉，我暂时无法回复，请稍后再试。'

    const { intent, cleanContent } = parseIntentFromResponse(fullContent)

    conversationState.messages.push({ role: 'assistant', content: cleanContent })
    saveConversation()

    return {
      content: cleanContent,
      riskLevel: detectRiskLevel(cleanContent),
      actions: extractActions(cleanContent),
      intent,
    }
  } catch (err) {
    console.warn('AI API 调用失败，使用本地降级:', err)
    const fallback = fallbackResponse(userMessage)
    for (const char of fallback.content) {
      onChunk(char)
      await new Promise((r) => setTimeout(r, 15))
    }
    return fallback
  }
}

// ---------- 降级响应 ----------

function fallbackResponse(userMessage: string): AIResponse {
  const msg = userMessage.toLowerCase()
  const wc = getWalletContext()

  // 优先检测可执行的交易意图
  const localIntent = buildLocalIntent(userMessage)
  if (localIntent?.type === 'transfer') {
    const p = localIntent.params
    return {
      content: `好的！我来帮你准备这笔转账：\n\n📤 金额: ${p.amount} ${p.asset}\n📬 接收地址: ${p.to.slice(0, 10)}...${p.to.slice(-4)}\n⛽ Gas 预估: ~$2.40 (Sepolia)\n\n交易预览已生成，请确认后点击「确认发送」。`,
      riskLevel: 'info',
      intent: localIntent,
    }
  }
  if (localIntent?.type === 'capsule') {
    const p = localIntent.params
    return {
      content: `好的！我来帮你创建这笔时间胶囊：\n\n⏳ 锁定 ${p.amount} ${p.asset}\n📅 解锁日期: ${p.unlockDate.slice(0, 10)}\n📬 接收地址: ${p.recipient.slice(0, 10)}...${p.recipient.slice(-4)}${p.message ? `\n💌 留言: "${p.message}"` : ''}\n⛽ Gas 预估: ~$2.40 (Sepolia)\n\n交易预览已生成，请确认后点击「确认创建」。`,
      riskLevel: 'info',
      intent: localIntent,
    }
  }
  if (localIntent?.type === 'approve') {
    const p = localIntent.params
    const amountLabel = p.amount === 'unlimited' ? '⚠️ 无限额度' : p.amount
    return {
      content: `⚠️ 授权请求：\n\n🔓 授权 ${amountLabel} ${p.asset}\n🎯 授权对象: ${p.spender.slice(0, 10)}...${p.spender.slice(-4)}\n⛽ Gas 预估: ~$3.00 (Sepolia)\n\n${p.amount === 'unlimited' ? '⚠️ 这是无限额度授权，存在资产风险！建议修改为实际需要的数量。\n\n' : ''}交易预览已生成，请确认后点击「确认授权」。`,
      riskLevel: p.amount === 'unlimited' ? 'danger' : 'warning',
      intent: localIntent,
    }
  }
  if (localIntent?.type === 'deposit') {
    const p = localIntent.params
    const protoLabel = p.protocol === 'aave' ? 'Aave V3' : p.protocol === 'lido' ? 'Lido' : p.protocol.toUpperCase()
    return {
      content: `好的！我来帮你存入 ${protoLabel}：\n\n💰 存入 ${p.amount} ${p.asset}\n🏦 协议: ${protoLabel}\n⛽ Gas 预估: ~$5.00 (Sepolia)\n\n${p.asset === 'ETH' && p.protocol === 'lido' ? '存入后将获得 stETH 凭证，可继续用于其他 DeFi 协议。' : '存入后将获得生息代币，开始赚取收益。'}\n\n交易预览已生成，请确认后点击「确认存入」。`,
      riskLevel: 'info',
      intent: localIntent,
    }
  }
  if (localIntent?.type === 'swap') {
    const p = localIntent.params
    return {
      content: `好的！我来帮你兑换：\n\n💱 ${p.fromAsset} → ${p.toAsset}\n📊 金额: ${p.amount} ${p.fromAsset}\n🏦 通过: Uniswap V2 (Sepolia)\n⛽ Gas 预估: ~$6.00 (Sepolia)\n\n交易预览已生成，请确认后点击「确认兑换」。`,
      riskLevel: 'info',
      intent: localIntent,
    }
  }
  if (localIntent?.type === 'permit') {
    const p = localIntent.params
    return {
      content: `⚠️ Permit 链下签名请求：\n\n🔏 EIP-712 Permit 授权\n📋 代币: ${p.amount} ${p.asset}\n🏦 DApp: ${p.domain}\n🎯 授权对象: ${p.spender.slice(0, 10)}...${p.spender.slice(-4)}\n⏰ 有效期: 24 小时\n⛽ Gas: 0（链下签名）\n\n⚠️ Permit 签名无需 Gas，但同样可转移你的代币。请确认这是你信任的 DApp。\n\n签名预览已生成——这是链下签名，不会立即上链。`,
      riskLevel: 'warning',
      intent: localIntent,
    }
  }
  if (localIntent?.type === 'plan') {
    const p = localIntent.params
    const stepDescs = p.steps.map((s, i) => {
      if (s.type === 'swap') return `第${i + 1}步: ${s.params.fromAsset} → ${s.params.toAsset}`
      if (s.type === 'deposit') return `第${i + 1}步: 存入 ${s.params.amount} ${s.params.asset} 到 ${s.params.protocol}`
      if (s.type === 'transfer') return `第${i + 1}步: 转账 ${s.params.amount} ${s.params.asset}`
      return `第${i + 1}步: ${s.type}`
    }).join('\n')
    return {
      content: `好的！我为你规划了一个 ${p.steps.length} 步交易计划：\n\n📋 ${p.description}\n\n${stepDescs}\n\n⛽ 预估总 Gas: ~$${(p.steps.length * 5).toFixed(2)} (Sepolia)\n\n请确认后依次执行每一步。`,
      riskLevel: 'info',
      intent: localIntent,
    }
  }

  if (msg.includes('时间胶囊') || msg.includes('锁定资产') || msg.includes('定时')) {
    return {
      content: `好的！我理解你想创建时间胶囊。\n\n你可以去「时间胶囊」页面通过引导式对话创建。只需描述：\n1. 想锁定什么资产和金额\n2. 设置在什么时间解锁\n3. 接收人是谁\n\n例如：「帮我把 0.5 ETH 存到 2027-06-15，作为女儿的生日礼物」`,
      riskLevel: 'info',
      actions: [{ label: '前往时间胶囊页', action: 'go_capsules' }],
    }
  }

  if (msg.includes('风险') || msg.includes('危险') || msg.includes('欺诈') || msg.includes('骗')) {
    return {
      content: `我扫描了你的钱包活动（${wc.walletAddress.slice(0, 10)}...）。\n\n✅ 未发现无限授权\n✅ 无恶意合约交互记录\n✅ 演示网模式安全\n\n💡 签名前请始终核对目标地址和金额。`,
      riskLevel: 'info',
    }
  }

  if (msg.includes('安全') || msg.includes('保护') || msg.includes('被盗')) {
    return {
      content: `🛡️ 安全评分 ${wc.securityScore}/100，状态良好。\n\n关键提醒：\n• 助记词和私钥永远不要输入到 AI 工具\n• 授权代币时使用精确额度\n• 定期检查并撤销不用的合约授权\n• 当前使用 Sepolia 测试网，无真实资产风险\n\n主钱包: ${wc.walletAddress.slice(0, 10)}...${wc.walletAddress.slice(-4)}`,
      riskLevel: 'info',
    }
  }

  if (msg.includes('资产') || msg.includes('持仓') || msg.includes('余额') || msg.includes('分布')) {
    return {
      content: `📊 资产总览：\n\n• 总价值: ${wc.totalBalance} (${wc.totalChange})\n• ETH: 2.48 ETH ($7,440)\n• USDC: 5,200 ($5,200)\n• BTC: 0.15 ($9,750)\n• ARB + OP: ~$5,920\n\n覆盖 ${wc.chainCount} 条链，${wc.assetCount} 种资产。ETH 和 BTC 占比最大。`,
      riskLevel: 'info',
      actions: [
        { label: '查看完整仪表盘', action: 'go_dashboard' },
        { label: '分析交易历史', action: 'go_chronicle' },
      ],
    }
  }

  if (msg.includes('defi') || msg.includes('策略') || msg.includes('收益') || msg.includes('理财')) {
    return {
      content: '基于你当前的风险偏好，推荐：\n\n1. Aave V3 — 存入闲置 USDC，当前 APY ~4.2%\n2. Lido — 质押 ETH 换 stETH，APY ~3.1%\n3. Uniswap V3 LP — ETH/USDC 池赚交易费\n\n⚠️ 建议先用测试网体验流程。',
      riskLevel: 'info',
      actions: [
        { label: '分析资产分布', action: 'analyze_portfolio' },
        { label: '模拟 DeFi 交易', action: 'simulate_defi' },
      ],
    }
  }

  if (msg.includes('交易') || msg.includes('转账') || msg.includes('记录') || msg.includes('历史')) {
    return {
      content: `📜 最近动态：\n\n1. Pudgy Penguin #8849 — 0.89 ETH — 3天前\n2. Uniswap V3 LP — $3,000 — 5天前\n3. Lido 质押 1.2 ETH — 11天前\n4. 转入 5,200 USDC — 16天前\n\n链上年龄 ${wc.chainDays} 天。在「链上编年史」可查看完整时间轴。`,
      riskLevel: 'info',
      actions: [{ label: '查看链上编年史', action: 'go_chronicle' }],
    }
  }

  if (msg.includes('nft') || msg.includes('藏品') || msg.includes('pudgy')) {
    return {
      content: '🎨 你的 NFT 收藏：\n\n• Pudgy Penguin #8849 — 以 0.89 ETH 购入\n• Chronicle 纪念 NFT — 链上身份凭证\n\nPudgy Penguins 是蓝筹 NFT 项目。注意防范虚假 NFT 空投。',
      riskLevel: 'info',
    }
  }

  if (msg.includes('质押') || msg.includes('staking') || msg.includes('lido') || msg.includes('steth')) {
    return {
      content: '🥩 质押情况：Lido 1.2 ETH → stETH，APY ~3.1%。stETH 可在 DeFi 中继续使用（如作 Aave 抵押品），实现双重收益。',
      riskLevel: 'info',
    }
  }

  if (msg.includes('钱包') || msg.includes('助记词') || msg.includes('私钥')) {
    return {
      content: `🔐 Token Core 确保私钥永远不离开本地设备。\n\n当前 Sepolia 测试网。主钱包: ${wc.walletAddress.slice(0, 10)}...${wc.walletAddress.slice(-4)}\n\n⚠️ 永远不要向任何人或 AI 工具透露你的助记词。`,
      riskLevel: 'info',
    }
  }

  if (msg.includes('你好') || msg.includes('hello') || msg.includes('hi') || msg.includes('嗨')) {
    return {
      content: `你好！我是 Chronicle AI 守护助手 🤖\n\n我可以帮你管理资产、分析风险、创建时间胶囊，还能聊聊你的链上故事。\n\n你的链上年龄 ${wc.chainDays} 天，安全评分 ${wc.securityScore}/100。今天想做什么？`,
      riskLevel: 'info',
      actions: [
        { label: '查看资产', action: 'analyze_portfolio' },
        { label: '创建胶囊', action: 'create_capsule' },
      ],
    }
  }

  if (msg.includes('帮助') || msg.includes('功能') || msg.includes('能做什么') || msg.includes('怎么用')) {
    return {
      content: '🤖 我能帮你：\n\n🎯 交易风险分析\n⏳ 创建时间胶囊\n📊 资产分布查看\n📜 链上活动总结\n🛡️ 安全检查\n💧 DeFi 策略推荐\n\nChronicle 有四大模块：仪表盘、编年史、时间胶囊、AI 助手。',
      riskLevel: 'info',
      actions: [
        { label: '分析资产', action: 'analyze_portfolio' },
        { label: '安全检查', action: 'go_security' },
      ],
    }
  }

  if (msg.includes('推荐') || msg.includes('建议')) {
    return {
      content: '💡 几个建议：\n\n1. 闲置 USDC 可存入 Aave 赚取收益\n2. 尝试创建时间胶囊体验链上时间锁\n3. 定期查看编年史了解链上行为模式\n4. 保持安全习惯：测试网 + 检查授权',
      riskLevel: 'info',
      actions: [
        { label: '查看 DeFi 策略', action: 'simulate_defi' },
        { label: '创建时间胶囊', action: 'create_capsule' },
      ],
    }
  }

  return {
    content: '我理解你的问题。作为专注于链上资产管理的 AI 助手，我可以帮你：\n\n• 🎯 分析交易风险\n• ⏳ 创建时间胶囊\n• 📊 查看资产和交易历史\n• 🛡️ 检查钱包安全\n• 💧 推荐 DeFi 策略\n\n输入「帮助」查看完整功能列表。',
    riskLevel: 'info',
    actions: [
      { label: '查看帮助', action: 'help' },
      { label: '资产分析', action: 'analyze_portfolio' },
    ],
  }
}

// ---------- Intent 解析 ----------

function parseIntentFromResponse(content: string): { intent?: WalletIntent; cleanContent: string } {
  const match = content.match(/<intent>\s*([\s\S]*?)\s*<\/intent>/)
  if (!match) return { cleanContent: content }
  const cleanContent = content.replace(/<intent>\s*[\s\S]*?\s*<\/intent>/g, '').trim()
  try {
    const parsed = JSON.parse(match[1])
    if (parsed.type && parsed.params) {
      return { intent: parsed as WalletIntent, cleanContent }
    }
  } catch { /* ignore */ }
  return { cleanContent }
}

// ---------- 本地 Intent 构建 ----------

function buildLocalIntent(userMessage: string): WalletIntent | undefined {
  const msg = userMessage

  // 匹配转账: "转 0.1 ETH 给 0x..." 或 "send 0.1 ETH to 0x..."
  const transferRe = /(?:转[账帳]?|发送?|send)\s*([\d.]+)\s*(ETH|USDC|IMT|BTC|ARB|OP)\s*(?:给|到|至|to)\s*(0x[a-fA-F0-9]{40})/i
  const tMatch = msg.match(transferRe)
  if (tMatch) {
    return { type: 'transfer', params: { amount: tMatch[1], asset: tMatch[2].toUpperCase(), to: tMatch[3] } }
  }

  // 匹配时间胶囊: "锁定 0.5 ETH 到 2027-06-15" 等
  const capsuleRe = /(?:锁定?|存[入儲]?|创建?胶囊|时间胶囊)\s*([\d.]+)\s*(ETH|USDC|IMT)\s*(?:到|至|在)\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i
  const cMatch = msg.match(capsuleRe)
  if (cMatch) {
    const dateStr = cMatch[3].replace(/\//g, '-')
    const parts = dateStr.split('-')
    const unlockDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T00:00:00Z`
    // 尝试提取留言
    const noteRe = /(?:留言|写|说|备注)[：:]\s*(.+?)(?:$|[。，])/
    const noteMatch = msg.match(noteRe)
    return {
      type: 'capsule',
      params: {
        asset: cMatch[2].toUpperCase(),
        amount: cMatch[1],
        unlockDate,
        recipient: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
        message: noteMatch?.[1]?.trim(),
      },
    }
  }

  // 匹配授权: "授权 100 USDC 给 0x..."
  const approveRe = /(?:授权|approve)\s*([\d.]+|无限)?\s*(USDC|USDT|DAI|ETH|IMT|BTC)?\s*(?:给|到|至|to)?\s*(0x[a-fA-F0-9]{40})?/i
  const aMatch = msg.match(approveRe)
  if (aMatch) {
    const asset = (aMatch[2] || 'USDC').toUpperCase()
    // 尝试从消息中提取 spender 地址（如果没匹配到默认用 Uniswap Router）
    const spenderMatch = msg.match(/0x[a-fA-F0-9]{40}/)
    return {
      type: 'approve',
      params: {
        amount: aMatch[1] === '无限' ? 'unlimited' : (aMatch[1] || '100'),
        asset,
        spender: spenderMatch?.[0] || '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008',
      },
    }
  }

  // 匹配存款/DeFi: "存入 100 USDC 到 Aave" / "质押 1 ETH 到 Lido"
  const depositRe = /(?:(?:存[入款]|质押|deposit|supply)\s*([\d.]+)\s*(ETH|USDC|IMT|BTC)\s*(?:到|入|至|in|to)?\s*(Aave|Lido|Uniswap|aave|lido|uniswap)?)|((?:Aave|Lido|aave|lido)\s*(?:存[入款]|质押|deposit)\s*([\d.]+)\s*(ETH|USDC|IMT|BTC))/i
  const dMatch = msg.match(depositRe)
  if (dMatch) {
    const amount = dMatch[1] || dMatch[5] || '0'
    const asset = (dMatch[2] || dMatch[6] || 'ETH').toUpperCase()
    const proto = (dMatch[3] || dMatch[4] || 'aave').toLowerCase()
    return {
      type: 'deposit',
      params: {
        protocol: proto.includes('lido') ? 'lido' : proto.includes('uniswap') ? 'uniswap' : 'aave',
        asset,
        amount,
      },
    }
  }

  // 匹配兑换/swap: "换 0.1 ETH 为 USDC" / "把 ETH 换成 USDC"
  const swapRe = /(?:换|兑换|swap|exchange)\s*([\d.]+)?\s*(ETH|USDC|IMT|BTC)?\s*(?:成|为|换|到|to|for)?\s*(ETH|USDC|IMT|BTC)/i
  const sMatch = msg.match(swapRe)
  if (sMatch) {
    const amount = sMatch[1] || '0.1'
    const fromAsset = (sMatch[2] || 'ETH').toUpperCase()
    const toAsset = sMatch[3].toUpperCase()
    return {
      type: 'swap',
      params: { fromAsset, toAsset, amount },
    }
  }

  // 匹配 Permit 签名: "Permit 授权 100 USDC 给 Uniswap"
  const permitRe = /(?:permit|链下授权|eip-?712|gasless.*approve)\s*([\d.]+)?\s*(USDC|USDT|DAI|ETH)?\s*(?:给|到|至|for)?\s*(Uniswap|Aave|1inch)?/i
  const pMatch = msg.match(permitRe)
  if (pMatch) {
    const protoMap: Record<string, string> = { uniswap: 'Uniswap', aave: 'Aave', '1inch': '1inch' }
    return {
      type: 'permit',
      params: {
        asset: (pMatch[2] || 'USDC').toUpperCase(),
        amount: pMatch[1] || '100',
        spender: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008',
        domain: protoMap[(pMatch[3] || 'uniswap').toLowerCase()] || 'Uniswap',
        deadline: Math.floor(Date.now() / 1000) + 86400,
      },
    }
  }

  // 匹配多步编排: "换成 USDC 然后存入 Aave"
  const planDelim = /然后|再|接着|之后|and\s+then|然后.*再/g
  const parts = msg.split(planDelim).filter(p => p.trim().length > 0)
  if (parts.length >= 2) {
    const steps: WalletIntent[] = []
    for (const part of parts) {
      const intent = buildLocalIntent(part.trim())
      if (intent && intent.type !== 'plan') {
        steps.push(intent)
      }
    }
    if (steps.length >= 2) {
      return {
        type: 'plan',
        params: {
          description: msg.slice(0, 80),
          steps,
        },
      }
    }
  }

  return undefined
}

// ---------- 辅助函数 ----------

function detectRiskLevel(content: string): RiskLevel | undefined {
  const lower = content.toLowerCase()
  if (lower.includes('阻断') || lower.includes('极度危险')) return 'block'
  if (lower.includes('危险') || lower.includes('被盗') || lower.includes('损失')) return 'danger'
  if (lower.includes('警告') || lower.includes('注意') || lower.includes('谨慎')) return 'warning'
  return 'info'
}

function extractActions(content: string): { label: string; action: string }[] | undefined {
  const actions: { label: string; action: string }[] = []
  if (content.includes('仪表盘')) actions.push({ label: '查看仪表盘', action: 'go_dashboard' })
  if (content.includes('编年史') || content.includes('时间轴')) actions.push({ label: '查看编年史', action: 'go_chronicle' })
  if (content.includes('时间胶囊')) actions.push({ label: '前往时间胶囊', action: 'go_capsules' })
  return actions.length > 0 ? actions : undefined
}

// ---------- 会话管理 ----------

export function resetConversation(): void {
  conversationState.messages = []
  try { localStorage.removeItem(STORAGE_KEY_CONV) } catch { /* ignore */ }
}

export function getConversationHistory(): ChatMessage[] {
  return [...conversationState.messages]
}

export function getConversationLength(): number {
  return conversationState.messages.length
}
