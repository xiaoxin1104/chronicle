/**
 * AI 服务模块 — Chronicle
 *
 * 为 Chronicle AI 守护助手提供真实的 LLM 对话能力。
 * 支持 Anthropic API（Claude），包含流式响应、对话持久化、本地降级。
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

export type WalletIntent = TransferIntent | CapsuleIntent | ApproveIntent | DepositIntent | SwapIntent | PlanIntent

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

const SYSTEM_PROMPT = `你是 Chronicle AI 守护助手，一个专注于 Web3 钱包安全和链上资产管理的智能伙伴。

## 你的身份
- 你服务于 Chronicle——一个"链上时光钱包"，核心理念是"不只是管钱的地方，更是你链上人生的编年史"
- 底层基于 Token Core（consenlabs/token-core-monorepo）提供企业级钱包安全能力
- 你的任务是用自然语言帮助用户管理资产、创建时间胶囊、分析风险、理解链上活动

## 核心功能

### 1. 时间胶囊
用户可以用自然语言描述想锁定的资产、解锁时间和接收人。例如：
- "帮我把 0.5 ETH 存到 2027-06-15，作为女儿的生日礼物"
- "锁定 1000 USDC 到明年元旦，写一段话给未来的自己"
引导用户去「时间胶囊」页面通过引导式对话创建。

### 2. 交易风险分析
对用户的交易进行风险评估，关注：
- 无限授权（unlimited approve）→ 极度危险
- 未知合约交互 → 高风险
- 大额转账 → 中等风险
- 钓鱼地址特征 → 阻断级别
给出明确的风险等级和具体建议。

### 3. 资产与组合分析
帮助用户理解他们的资产分布、链上活动模式，给出合理的建议。

### 4. 安全提醒
在每次对话中适当提醒：
- 助记词和私钥绝不输入到 AI 或云端
- 交易签名前仔细核对地址和金额
- 当前使用测试网，无真实资产风险

## 意图识别与交易构建（重要）

当用户表达可执行的交易意图时，你必须在回复末尾附加一个 JSON 意图块。格式：

<intent>
{"type":"transfer","params":{"asset":"ETH","amount":"0.1","to":"0x..."}}
</intent>

支持的类型：
- transfer: 转账。params: { asset, amount, to }
- approve: 授权。params: { asset, amount, spender }
- capsule: 创建时间胶囊。params: { asset, amount, unlockDate(ISO), recipient, message(可选) }
- deposit: DeFi 存款到协议。params: { protocol(aave/lido/uniswap), asset, amount }
- swap: 代币兑换。params: { fromAsset, toAsset, amount }
- plan: 多步编排。params: { description, steps: [...上面的任意 intent 类型] }

规则：
1. 先给友好的文字回复解释你在做什么，再附加 intent 块
2. 信息不完整时（缺金额/地址/日期），在文字中询问，不要输出 intent
3. amount 用纯数字字符串（如 "0.1"），to/spender/recipient 用 0x 格式
4. unlockDate 用 ISO 格式（如 "2027-06-15T00:00:00Z"）
5. 当用户需要多步操作时（如"换币然后存款"），使用 plan 类型，steps 按顺序排列
6. protocol 字段用小写：aave、lido、uniswap

## 回答风格
- 简洁、友好、专业
- 使用 emoji 增强可读性（适度）
- 涉及安全问题时语气严肃明确
- 用中文回复
- 回复控制在 300 字以内，除非用户明确要求详细分析`

// ---------- API 配置 ----------

const ANTHROPIC_API_URL = import.meta.env.DEV
  ? '/api/anthropic/v1/messages'
  : 'https://api.anthropic.com/v1/messages'

const STORAGE_KEY_KEY = 'chronicle_anthropic_key'
const STORAGE_KEY_CONV = 'chronicle_conversation'

let apiKey: string | null = null

// 启动时从 localStorage 恢复
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
  apiKey = null
  try { localStorage.removeItem(STORAGE_KEY_KEY) } catch { /* ignore */ }
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

// ---------- LLM 调用（流式）----------

export async function sendMessageStream(
  userMessage: string,
  onChunk: (chunk: string) => void,
): Promise<AIResponse> {
  conversationState.messages.push({ role: 'user', content: userMessage })
  saveConversation()

  if (!apiKey) {
    const fallback = fallbackResponse(userMessage)
    // 模拟流式输出
    for (const char of fallback.content) {
      onChunk(char)
      await new Promise((r) => setTimeout(r, 15))
    }
    return fallback
  }

  try {
    const systemPrompt = buildSystemPrompt()
    const messages = conversationState.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const isDevProxy = ANTHROPIC_API_URL.startsWith('/api/')
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey!,
        'anthropic-version': '2023-06-01',
        ...(isDevProxy ? {} : { 'anthropic-dangerous-direct-browser-access': 'true' }),
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`API 错误 ${response.status}: ${errText}`)
    }

    // 解析 SSE 流
    let fullContent = ''
    const reader = response.body?.getReader()
    if (!reader) throw new Error('无法读取响应流')

    const decoder = new TextDecoder()
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
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullContent += parsed.delta.text
            onChunk(parsed.delta.text)
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }

    // 处理 buffer 剩余
    for (const line of buffer.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          fullContent += parsed.delta.text
          onChunk(parsed.delta.text)
        }
      } catch { /* ignore */ }
    }

    if (!fullContent) fullContent = '抱歉，我暂时无法回复，请稍后再试。'

    // 解析意图并清理内容
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

  // 匹配授权
  const approveRe = /(?:授权|approve)\s*([\d.]+|无限)\s*(ETH|USDC|IMT|BTC)?\s*(?:给|到|至|to)?\s*(0x[a-fA-F0-9]{40})?/i
  const aMatch = msg.match(approveRe)
  if (aMatch) {
    return {
      type: 'approve',
      params: {
        amount: aMatch[1] === '无限' ? 'unlimited' : (aMatch[1] || '0'),
        asset: aMatch[2] || 'ETH',
        spender: aMatch[3] || '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
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
