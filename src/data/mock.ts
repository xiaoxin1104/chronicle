// ---------- Wallet assets ----------

export interface Asset {
  symbol: string
  name: string
  amount: string
  value: string
  change: string
  chain: 'Ethereum' | 'Arbitrum' | 'Optimism' | 'Base' | 'Polygon'
  icon: string
}

export const walletAssets: Asset[] = [
  { symbol: 'ETH', name: 'Ethereum', amount: '2.48', value: '$7,440.00', change: '+3.2%', chain: 'Ethereum', icon: '⟠' },
  { symbol: 'USDC', name: 'USD Coin', amount: '5,200', value: '$5,200.00', change: '0.0%', chain: 'Arbitrum', icon: '💲' },
  { symbol: 'IMT', name: 'imToken', amount: '1,250', value: '$1,000.00', change: '+8.1%', chain: 'Ethereum', icon: '🔷' },
  { symbol: 'BTC', name: 'Bitcoin', amount: '0.15', value: '$9,750.00', change: '-1.2%', chain: 'Ethereum', icon: '₿' },
  { symbol: 'ARB', name: 'Arbitrum', amount: '3,800', value: '$3,040.00', change: '+5.7%', chain: 'Arbitrum', icon: '🔵' },
  { symbol: 'OP', name: 'Optimism', amount: '1,600', value: '$2,880.00', change: '-0.8%', chain: 'Optimism', icon: '🔴' },
]

export const totalBalance = '$29,310.00'
export const totalChange = '+4.2%'

// ---------- Chronicle events ----------

export type EventType = 'transfer' | 'defi' | 'nft' | 'staking' | 'contract'

export interface ChronicleEvent {
  id: string
  type: EventType
  title: string
  description: string
  timestamp: string
  value: string
  address: string
  chain: string
  isMilestone: boolean
  milestoneLabel?: string
  txHash: string
  status: 'confirmed' | 'pending' | 'failed'
}

// 演示用的有效以太坊地址（Sepolia 测试网）
const ADDR = {
  self: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  alice: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
  bob: '0x28c6dc0626Cd9A7C8eD3d5E97BEfC0c6Fe2e56eF',
  mike: '0x3f81Cdd92E5F5A2a3b84Cc9B759eF0bE1a2d3f81',
  uniswap: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  lido: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
  aave: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  nftMarket: '0xbd3531dA2f306Dc0e2F8D8eD3A7a2fBAb1c7F2a2',
  chronicleNft: '0xCc4eA2a1B2a252b5b4814aDd6845594F94dc1db0',
  oneinch: '0x1111111254EEB25477B68fb85Ed929f73A960582',
}

export const chronicleEvents: ChronicleEvent[] = [
  // ====== 2026 ======
  {
    id: 'evt-25', type: 'defi', title: 'Aave 存款利息', description: '已自动赚取 Aave USDC 存款利息 3.2 USDC', timestamp: '2026-05-20T06:00:00Z', value: '3.2 USDC', address: ADDR.aave, chain: 'Arbitrum', isMilestone: false, txHash: '0x9b4c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5c6d7e8f9a0b1c2d3e4f5a6b7c8d9', status: 'confirmed',
  },
  {
    id: 'evt-18', type: 'nft', title: 'Pudgy Penguin #8849', description: '以 0.89 ETH 购入第一个蓝筹 NFT，开启数字收藏之旅', timestamp: '2026-05-18T14:22:00Z', value: '0.89 ETH', address: ADDR.nftMarket, chain: 'Ethereum', isMilestone: true, milestoneLabel: '首次 NFT 收藏', txHash: '0x8a3f1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0e2', status: 'confirmed',
  },
  {
    id: 'evt-17', type: 'defi', title: 'Uniswap V3 做市', description: 'ETH/USDC 流动性池存入 0.5 ETH + 1500 USDC，被动赚取交易费', timestamp: '2026-05-16T09:15:00Z', value: '$3,000', address: ADDR.uniswap, chain: 'Ethereum', isMilestone: true, milestoneLabel: '首次 LP 做市', txHash: '0x7b2e3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a4c', status: 'confirmed',
  },
  {
    id: 'evt-16', type: 'staking', title: 'Lido 质押 1.2 ETH', description: '质押 ETH 获取 stETH 流动性质押凭证，APY 3.1%', timestamp: '2026-05-10T16:45:00Z', value: '1.2 ETH', address: ADDR.lido, chain: 'Ethereum', isMilestone: true, milestoneLabel: '首次流动性质押', txHash: '0x6a1d2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f3b', status: 'confirmed',
  },
  {
    id: 'evt-15', type: 'transfer', title: '转入 5,200 USDC', description: '从交易所转入稳定币到主钱包，准备 DeFi 操作', timestamp: '2026-05-05T11:30:00Z', value: '5,200 USDC', address: ADDR.bob, chain: 'Arbitrum', isMilestone: false, txHash: '0x59cf0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e7a', status: 'confirmed',
  },
  {
    id: 'evt-14', type: 'defi', title: 'Aave V3 存款 500 USDC', description: '首次接触借贷协议，存入 USDC 开始赚取利息', timestamp: '2026-04-28T08:00:00Z', value: '500 USDC', address: ADDR.aave, chain: 'Arbitrum', isMilestone: true, milestoneLabel: '首次 DeFi 借贷', txHash: '0x48be1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e9', status: 'confirmed',
  },
  {
    id: 'evt-13', type: 'transfer', title: '发送 0.1 ETH 给 Alice', description: '转账给好友 alice.eth，体验链上支付', timestamp: '2026-04-20T15:10:00Z', value: '0.1 ETH', address: ADDR.alice, chain: 'Ethereum', isMilestone: false, txHash: '0x37ad2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0f8', status: 'confirmed',
  },
  {
    id: 'evt-12', type: 'contract', title: '铸造 Chronicle 纪念 NFT', description: '铸造链上身份凭证——这是你的 Web3 身份证', timestamp: '2026-04-15T12:00:00Z', value: '0.005 ETH', address: ADDR.chronicleNft, chain: 'Optimism', isMilestone: true, milestoneLabel: '链上身份注册', txHash: '0x269c3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1f7', status: 'confirmed',
  },
  {
    id: 'evt-11', type: 'defi', title: '1inch DEX 兑换', description: '通过聚合器以最优价格用 0.5 ETH 兑换 USDC', timestamp: '2026-04-10T17:25:00Z', value: '0.5 ETH → 1,200 USDC', address: ADDR.oneinch, chain: 'Ethereum', isMilestone: false, txHash: '0x158b4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2f6', status: 'confirmed',
  },
  {
    id: 'evt-10', type: 'transfer', title: '收到 0.3 ETH', description: '从朋友 0xMike.eth 收到第一笔链上转账', timestamp: '2026-04-01T09:45:00Z', value: '0.3 ETH', address: ADDR.mike, chain: 'Ethereum', isMilestone: false, txHash: '0x047a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f5', status: 'confirmed',
  },
  // ====== 2025 ======
  {
    id: 'evt-09', type: 'defi', title: 'Uniswap 首次 swap', description: '第一次在 DEX 上兑换代币：0.2 ETH → USDC', timestamp: '2025-11-20T14:00:00Z', value: '0.2 ETH', address: ADDR.uniswap, chain: 'Ethereum', isMilestone: true, milestoneLabel: '首次 DEX 交易', txHash: '0x036a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9f0a1b2c3d4e5f6a7b8c9d0e3f4', status: 'confirmed',
  },
  {
    id: 'evt-08', type: 'nft', title: 'ENS 域名注册', description: '注册 chronicle.eth，拥有自己的链上身份标识', timestamp: '2025-08-15T10:30:00Z', value: '0.03 ETH', address: ADDR.self, chain: 'Ethereum', isMilestone: true, milestoneLabel: 'ENS 域名注册', txHash: '0x025b4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0f1a2b3c4d5e6f7a8b9c0d2f5', status: 'confirmed',
  },
  {
    id: 'evt-07', type: 'transfer', title: '交易所提现 ETH', description: '从 CEX 提取 2 ETH 到链上钱包，开启自托管之旅', timestamp: '2025-06-01T08:00:00Z', value: '2 ETH', address: ADDR.self, chain: 'Ethereum', isMilestone: true, milestoneLabel: '首次自托管', txHash: '0x014a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0f1a2b3c4d5e6f7a8b9c0d1e3f6', status: 'confirmed',
  },
]

// ---------- Time capsules ----------

export type CapsuleStatus = 'locked' | 'unlocking' | 'unlocked'

export interface TimeCapsule {
  id: string
  title: string
  asset: string
  amount: string
  unlockDate: string
  recipient: string
  message: string
  status: CapsuleStatus
  createdAt: string
  progress: number
}

export const timeCapsules: TimeCapsule[] = [
  {
    id: 'cap-001', title: '给女儿的生日礼物', asset: 'ETH', amount: '0.5', unlockDate: '2027-06-15T00:00:00Z', recipient: ADDR.alice, message: '亲爱的女儿，这是给你的 18 岁生日礼物。愿你自由、勇敢、善良。', status: 'locked', createdAt: '2026-05-18T10:00:00Z', progress: 12,
  },
  {
    id: 'cap-002', title: '明年今日的自己', asset: 'USDC', amount: '1,000', unlockDate: '2027-01-01T00:00:00Z', recipient: ADDR.self, message: '看看一年前的你留下的这笔钱，希望你已经成为了更好的人。', status: 'locked', createdAt: '2026-05-15T14:30:00Z', progress: 25,
  },
  {
    id: 'cap-003', title: '旅行基金', asset: 'ETH', amount: '0.3', unlockDate: '2026-08-20T00:00:00Z', recipient: ADDR.self, message: '解锁的时候该去旅行了！这是一笔专门留给探索世界的基金。', status: 'locked', createdAt: '2026-05-10T08:00:00Z', progress: 62,
  },
  {
    id: 'cap-004', title: '新年礼物', asset: 'IMT', amount: '100', unlockDate: '2026-05-25T00:00:00Z', recipient: ADDR.bob, message: '老友，这是给你的十周年礼物。感谢一路相伴。', status: 'unlocking', createdAt: '2026-02-14T12:00:00Z', progress: 88,
  },
]

// ---------- AI quick prompts ----------

export const quickPrompts = [
  '转 0.05 ETH 给 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
  '帮我创建一个时间胶囊，锁定 0.5 ETH 到 2027 年',
  '锁定 100 USDC 给未来的自己，留言「辛苦了」',
  '我的资产分布怎么样？',
  '推荐一个安全的 DeFi 策略',
  '检查我的钱包安全状态',
]

// ---------- Nav items ----------

export interface NavItem {
  label: string
  path: string
  icon: string
}

export const navItems: NavItem[] = [
  { label: '资产仪表盘', path: '/', icon: '📊' },
  { label: '链上编年史', path: '/chronicle', icon: '📜' },
  { label: '时间胶囊', path: '/capsules', icon: '⏳' },
  { label: 'AI 守护助手', path: '/assistant', icon: '🤖' },
]
