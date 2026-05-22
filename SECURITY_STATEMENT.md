# Chronicle 安全说明

> 提交作品：Chronicle — AI 时光钱包
> 活动：imToken 十周年 AI 共创计划
> 日期：2026-05-22

---

## 1. 基本信息

| 项目 | 说明 |
|------|------|
| 使用网络 | Sepolia 测试网（Ethereum Sepolia Testnet，Chain ID: 11155111） |
| 是否涉及真实资产 | 否。所有演示使用测试网 ETH，无真实价值 |
| 演示钱包地址 | `0x9858EfFD232B4033E47d90003D41EC34EcaEda94`（Sepolia 测试网） |
| 演示助记词 | 标准测试助记词 `abandon abandon ... abandon about`（12 词，BIP39 标准测试向量） |

---

## 2. 密钥安全

### 2.1 助记词与私钥存储

- **存储位置**：仅存在于浏览器 WASM 沙箱内存中（Token Core `cache_keystore`），不持久化到 localStorage / IndexedDB / 服务器
- **生命周期**：页面刷新后 Keystore 即失效，需重新初始化
- **演示环境隔离**：使用公开的标准测试向量助记词（BIP39 `abandon x12`），与个人资产完全隔离，不涉及任何真实助记词

### 2.2 交易签名流程

1. 用户在 AI 助手输入自然语言交易意图
2. AI 解析意图 → 构建交易参数
3. 前端展示交易确认卡片（完整地址、金额、Gas 预估、风险等级）
4. 用户点击「确认发送」
5. Token Core WASM 在浏览器本地沙箱完成 `sign_tx`
6. 返回签名后的交易哈希

**整个签名过程私钥不出 WASM 沙箱，不经过任何网络传输。**

### 2.3 密码安全

- 演示密码 `chronicle-demo` 仅存在于 JavaScript 闭包内存中
- 不持久化到任何存储
- 仅用于演示钱包的 Keystore 解密和交易签名

---

## 3. AI 服务安全

### 3.1 API Key 管理

- Anthropic API Key 存储在浏览器 `localStorage`
- 通过 Vite 开发代理（`/api/anthropic` → `api.anthropic.com`）转发，生产环境走直接 HTTPS
- 支持本地降级模式（无需 API Key 亦可使用基础功能）

### 3.2 数据传输

- AI 对话内容包含钱包上下文（资产余额、链上天数、安全评分），但不包含私钥、助记词、Keystore JSON 等密钥材料
- 系统提示词中明确禁止用户向 AI 透露助记词或私钥
- 当检测到用户输入包含私钥/助记词特征时，AI 会拒绝处理并给出安全警告

---

## 4. 风险控制

### 4.1 风险等级体系

采用四级风险体系，与 Token Core Security Skill 保持一致：

| 等级 | 触发条件 | UI 处理 |
|------|---------|--------|
| **Info** | 标准转账、Gas 预估、网络费 | 信息提示，内联展示 |
| **Warning** | 大额转账（>10 ETH）、未验证合约、首次交互 | 黄色横幅，需确认 |
| **Danger** | 无限额度授权（`uint256 max`）、模拟失败 | 红色弹窗 + 强烈建议取消 |
| **Block** | 已确认恶意地址、Policy 违规 | 硬拦截，不可绕过 |

### 4.2 交易前检查

- 解码 calldata 展示函数名和参数（无限授权检测 `0xffff...ffff` 模式）
- 零地址转账警告
- 大额交易提醒
- Gas 预估展示

### 4.3 安全规则常量

```typescript
SAFETY_RULES = {
  TESTNET_ONLY: '使用 Sepolia 测试网演示',
  NO_REAL_MNEMONIC: '切勿向 AI 工具输入真实助记词',
  ASSET_ISOLATION: '演示钱包与个人资产完全隔离',
  KEY_LOCAL_ONLY: '私钥绝不传输到任何服务器',
  PASSWORD_STORAGE: '密码仅在内存中持有',
}
```

---

## 5. 依赖与供应链

| 依赖 | 版本 | 用途 | 安全审计 |
|------|------|------|---------|
| `@consenlabs/tcx-wasm` | ^0.9.1 | 钱包核心（WASM） | 官方发布，由 imToken 团队维护 |
| `@anthropic-ai/sdk` | ^0.97.1 | AI 对话 | Anthropic 官方 SDK |
| `react` / `react-dom` | 19.2.5 | UI 框架 | React 官方 |
| `@radix-ui/*` | 多个 | UI 组件（token-ui 依赖） | Radix UI 官方 |
| `tailwindcss` | ^4.0.0 | 样式框架 | Tailwind CSS 官方 |

---

## 6. 已知限制

1. **时间胶囊**：当前为 UI 概念演示，时间锁定通过倒计时 + 手动签名实现。生产级实现需部署链上 Timelock 合约（如 OpenZeppelin TimelockController）
2. **数据源**：资产和交易数据默认使用模拟数据，可选接入 Etherscan Sepolia API 获取真实测试网数据
3. **单链**：当前仅支持以太坊 Sepolia 测试网，多链（Arbitrum Sepolia、Base Sepolia）UI 已预留
4. **Keystore 持久化**：页面刷新后 Keystore 失效，需重新初始化演示钱包
5. **非托管**：本作品不提供任何托管服务，用户始终掌控自己的密钥

---

## 7. 声明

本作品所有演示均在 Sepolia 测试网完成，不涉及任何真实资产交易。私钥签名在 Token Core WASM 本地沙箱中完成，绝不出设备。AI 对话数据仅通过 HTTPS 加密传输至 Anthropic API，不包含任何密钥材料。

我理解活动规则中关于安全边界的要求，并确认本作品符合以下要求：

- [x] 使用测试网完成所有演示
- [x] 不输入真实助记词
- [x] 演示钱包与个人资产隔离
- [x] 密钥数据留存本地，不传输至任何服务器
- [x] 提交完整安全说明
