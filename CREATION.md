# Chronicle — 创作思路与 Prompt 迭代记录

## 一、灵感起点

### 一句话起源
> "钱包不应该只是一个管钱的地方，更应该是你链上人生的编年史。"

在使用自托管钱包的过程中，我发现一个普遍问题：**交易记录枯燥、冰冷、难以回忆**。0x 开头的哈希值无法唤起任何情感记忆，时间戳无法讲述故事。

于是我给自己提了一个问题：**如果钱包能像日记一样，帮你记住每一个重要的链上时刻呢？**

### 核心创意三个支柱

| 支柱 | 说明 |
| --- | --- |
| **链上编年史** | 将交易列表转化为时间轴叙事，标注里程碑事件，让链上行为成为可回顾的故事 |
| **时间胶囊** | 用自然语言创建"定时交易"——锁定资产到未来，附带留言。这是对"时间"这一区块链原生能力的直接产品化 |
| **AI 守护助手** | 不是关键词匹配的 FAQ 机器人，而是能分析风险、推荐策略、帮用户用自然语言操作钱包的智能体 |

---

## 二、Prompt 设计与迭代过程

### 阶段 1：项目骨架搭建（Prompt 1-3）

**Prompt 1：**
> 基于 token-ui 的 UI Kit 和 Token Core 的接口文档，帮我创建一个"时光钱包"React 原型。核心页面：仪表盘、时间轴、时间胶囊、AI 助手。

**AI 输出：** 生成了初始的项目骨架，包含 React Router 路由、4 个页面组件、mock 数据。

**我的判断与迭代：**
- UI Kit 用得不错，但 Token Core 接口只是 mock —— 第 1 版假设了 `hd_store_create`/`hd_store_import` 等不存在的方法名
- **Prompt 2** 要求 AI 重新阅读 Token Core API 文档，修正接口契约

### 阶段 2：Token Core 接口对齐（Prompt 4-6）

**Prompt 4（关键转折）：**
> 请仔细阅读 `token-core/tcx-docs/API.zh.md`，将 token-core.ts 的接口从 Mock 替换为与 Token Core Protobuf API —— 对应的真实接口调用。重点是 create_keystore、derive_accounts、sign_tx、cache_keystore 四个核心方法。

**迭代过程：**
1. AI 首次搜索 `@consenlabs/tcx-wasm` 的 npm 包，确认其存在和版本
2. 从 GitHub README 提取完整 API 文档（14 个方法、参数格式、返回值结构）
3. 发现 Mock 版的方法名全部不匹配：
   - `hd_store_create` → `create_keystore`（JSON 字符串参数，不是对象）
   - `hd_store_import` → 合并到 `create_keystore`（传 mnemonic 字段即为导入）
   - `sign_tx` 的参数结构完全不同（嵌套 input 对象，value 用 wei 字符串）
4. **Prompt 5** 要求 AI 按真实 API 重写整个 token-core.ts
5. **Prompt 6** 修复了 wasm-pack 生成的 init() 异步加载问题（添加 ensureWasm 和 lazy init）

**关键收获：** Token Core 的 API 采用"JSON 字符串入/JSON 字符串出"模式（因为跨越 WASM 边界），TypeScript 封装层需要处理序列化/反序列化。

### 阶段 3：AI 助手——从关键词匹配到真实 LLM（Prompt 7-9）

**Prompt 7：**
> AI 助手目前是 `content.includes('风险')` 这种硬编码匹配，太假了。帮我接入真实的 LLM API。

**第一版问题：**
- AI 直接把 Anthropic API key 写在代码里 → 我要求改为运行时配置
- 没有降级方案 → 添加了本地规则引擎 fallback
- 系统提示词太通用 → **Prompt 8** 要求针对 Chronicle 的人设重写

**Prompt 8（系统提示词迭代）：**
> 系统提示词需要体现 Chronicle "时光钱包"的定位，不只是通用的 Web3 助手。它要：
> 1. 理解时间胶囊的创建流程（解析自然语言 → 提取资产/时间/接收人）
> 2. 在回答中融入链上编年史的故事感
> 3. 始终携带安全提醒（但不要太啰嗦）
> 4. 用中文、友好但专业

**Prompt 9（用户体验打磨）：**
> 如果没有 API Key，用户想体验 AI 助手怎么办？

→ 添加了 API Key 设置面板（带跳过选项）+ 本地降级模式 + 状态指示器（"Claude 已连接"/"本地模式"）

### 阶段 4：类型安全与构建修复（Prompt 10-12）

**Prompt 10：**
> TypeScript 报了很多类型错误，Badge 不支持 'warning' variant，Button 不支持 'primary' variant。帮我修。

**迭代过程：**
- 查阅了 token-ui 的 cva 定义，确认实际支持的 variant 值
- Badge: `warning` → `destructive`（语义最接近的替代）
- Button: `primary` → `default`（default 样式实际是 primary 配色）
- 添加了 `vite-env.d.ts` 解决 `import.meta.env` 类型问题

**Prompt 11：**
> vite build 报错，WASM 模块加载失败。

→ 在 vite.config.ts 添加了 `optimizeDeps.exclude: ['@consenlabs/tcx-wasm']` 和 `build.target: 'esnext'`

**Prompt 12：**
> 开发环境调用 Anthropic API 会有跨域问题。

→ 配置了 Vite 代理（`/api/anthropic` → `https://api.anthropic.com`），dev 模式自动通过代理转发，prod 模式走直接 URL。

---

## 三、技术架构与设计决策

### 技术栈
| 层 | 技术 | 选择理由 |
| --- | --- | --- |
| 钱包核心 | `@consenlabs/tcx-wasm` (WebAssembly) | Token Core 的浏览器端 WASM 构建，私钥签名在本地沙箱完成 |
| 前端框架 | React 19 + TypeScript 5.9 | 类型安全 + Token UI 组件库的 React 绑定 |
| UI 组件 | Token UI（基于 Radix + Tailwind） | imToken 设计语言，直接可用，无需从零造轮子 |
| AI 对话 | Anthropic Claude (Haiku 4.5) | 快、便宜、中文好，适合嵌入式助手 |
| 构建工具 | Vite 6 | WASM 支持好、HMR 快、代理配置简单 |

### 关键设计决策

**1. 为什么 Token Core 封装层要保留 typed wrapper？**
Token Core 原生 API 是 JSON 字符串入/出（WASM 边界限制）。如果每个调用方都手动 `JSON.stringify`/`JSON.parse`，代码会很难维护。所以 `token-core.ts` 作为类型安全的薄封装层，对外暴露 TypeScript 类型，对内处理序列化。

**2. 为什么 AI 助手要双模式（真实 LLM + 本地降级）？**
评审现场网络不一定稳定，API Key 也不一定有。双模式确保：
- 有 Key → Claude 驱动，展示完整 AI 能力
- 无 Key → 本地规则引擎，能演示基本对话流程
- 两种模式切换自然，不破坏体验

**3. 为什么不直接改 token-ui 组件而是修复 variant 调用？**
token-ui 是独立的 UI Kit 包，修改它会波及 token-ui-main 项目。遵循"外科手术式修改"原则，只在自己的调用方修正 variant 值来匹配 UI Kit 的约束。

### 安全设计
- `SAFETY_RULES` 常量定义了 5 条硬性安全规则
- 所有演示页面顶部注明"Sepolia Testnet"
- AI 助手的系统提示词中包含安全提醒规则
- 风险分析引擎检测无限授权、零地址转账、大额交易等危险模式
- Keystore 密码仅存在于内存中，不持久化

---

## 四、Token Core 集成对照表

| 功能 | Mock 版（旧） | 真实 tcx-wasm（新） |
| --- | --- | --- |
| 创建钱包 | `createWallet()` → 固定助记词 | `create_keystore()` → 随机助记词生成 |
| 导入助记词 | `importMnemonic()` | `create_keystore({mnemonic})` 同一入口 |
| 地址派生 | `deriveAddress()` → 假地址 | `derive_accounts()` → 真实 BIP44 派生 |
| 交易签名 | `signTransaction()` → 假签名 | `sign_tx()` → WASM 沙箱签名 |
| 风险分析 | `analyzeTransaction()` → 写死的分支 | `scanTransactionRisk()` + AI 增强 |
| Keystore 缓存 | 无 | `cache_keystore()` → WASM 内存缓存 |

---

## 五、与 AI 的协作感悟

### AI 擅长的事
- **快速搭建 UI 骨架**：4 个页面 + 路由 + 组件，半小时内成型
- **API 文档搜索与翻译**：从 GitHub README 提取完整的 14 个 API 方法说明
- **类型错误定位与修复**：TypeScript 编译错误能精准定位到行

### AI 不擅长的事
- **创新概念定义**："时光钱包"的核心创意（编年史叙事 + 时间胶囊）需要人类来定义
- **安全判断**：AI 最初建议把 API Key 硬编码在代码里，需要人类纠正
- **架构决策**：什么时候该抽象、什么时候该简单——AI 倾向于过度工程化

### 人机分工模式
```
人类定义：产品理念 + 安全边界 + 设计方向
AI  执行：UI 实现 + API 对接 + 类型修复 + 文档生成
共同迭代：Prompt 精炼 → AI 输出 → 人类审视 → 修正 Prompt → 循环
```

---

## 六、已知限制与后续方向

### 当前限制
1. 时间胶囊未接入真正的链上时间锁合约（TimelockController 或自定义 vesting 合约）
2. Keystore 未持久化到 localStorage（刷新页面后需重新导入）
3. 多链支持仅 EVM 系列（ETH/Arbitrum/Optimism），BTC/Cosmos 等未在 UI 中开放
4. AI 助手在无 Key 模式下的回答多样性不足

### 后续方向
1. 部署一个真正的 TimeLock 合约到 Sepolia，让时间胶囊从 UI 概念变为链上事实
2. 接入 Passkey（WebAuthn PRF）作为 Keystore 的解锁方式——Token Core 已支持此能力
3. 支持 Nostr 加密消息（Token Core 已支持 NIP-44/NIP-59）
4. 多语言支持（英文/日文），利用 AI 的翻译能力
