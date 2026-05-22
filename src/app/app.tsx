import { Toaster } from '@repo/ui/components/sonner'
import { useState, useEffect } from 'react'
import {
  createBrowserRouter,
  Link,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router'
import { navItems } from '../data/mock'
import DashboardPage from '../features/dashboard/dashboard-page'
import ChroniclePage from '../features/chronicle/chronicle-page'
import CapsulePage from '../features/time-capsule/capsule-page'
import AssistantPage from '../features/ai-assistant/assistant-page'
import { isDemoWalletReady } from '../lib/token-core'

// ---------- 品牌常量 ----------

const BRAND_GRADIENT = 'bg-gradient-to-r from-[#007fff] via-[#2168db] to-[#0cc5ff]'
const BRAND_GLOW = 'shadow-[0_8px_32px_rgba(0,127,255,0.25)]'

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation()

  return (
    <aside
      className="fixed left-0 top-0 z-30 flex h-full flex-col border-r border-border bg-sidebar transition-all duration-300"
      style={{ width: collapsed ? 68 : 252 }}
    >
      {/* Logo area with brand gradient */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${BRAND_GRADIENT} text-sm font-bold text-white ${BRAND_GLOW}`}>
          C
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-body-md font-bold text-sidebar-foreground tracking-tight">
              Chronicle
            </span>
            <p className="text-2xs text-muted-foreground/60 leading-none mt-0.5">
              AI 时光钱包
            </p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5">
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm font-medium transition-all duration-200 ${
                isActive
                  ? `${BRAND_GRADIENT} text-white ${BRAND_GLOW}`
                  : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
              }`}
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto size-1.5 rounded-full bg-white/60" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom area */}
      <div className="border-t border-sidebar-border p-2.5 space-y-1.5">
        {/* 十周年 badge */}
        <div className={`rounded-xl px-3 py-2 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`${collapsed ? 'size-5 rounded-md' : 'rounded-lg px-2.5 py-1.5'} bg-gradient-to-br from-[#2168db]/10 to-[#0cc5ff]/10 border border-[#2168db]/20`}>
            {collapsed ? (
              <span className="text-xs">10</span>
            ) : (
              <div>
                <p className="text-2xs font-semibold text-[#2168db] leading-tight">
                  imToken 十周年
                </p>
                <p className="text-2xs text-muted-foreground/60 leading-tight mt-0.5">
                  AI 共创计划
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
        >
          <span className="text-base shrink-0">{collapsed ? '☰' : '◀'}</span>
          {!collapsed && <span>收起菜单</span>}
        </button>
      </div>
    </aside>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <button
      onClick={() => setDark(!dark)}
      className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-base transition-colors hover:bg-secondary"
      aria-label={dark ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}

function AppLayout() {
  const [walletStatus, setWalletStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // WASM 按需加载：只在首次访问需要签名的页面时触发
  // 仪表盘和编年史不需要 WASM，可立即渲染
  useEffect(() => {
    let cancelled = false
    // 延迟 500ms 再加载 WASM，优先渲染 UI
    const timer = setTimeout(async () => {
      const { initDemoWallet } = await import('../lib/token-core')
      if (cancelled) return
      initDemoWallet().then((r) => {
        if (!cancelled) setWalletStatus(r.success ? 'ready' : 'error')
      })
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [])

  return (
    <div className="min-h-screen bg-surface-page text-foreground">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div
        className="transition-all duration-300"
        style={{ paddingLeft: sidebarCollapsed ? 68 : 252 }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-surface-page/80 px-8 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${walletStatus === 'ready' ? 'bg-success animate-pulse' : walletStatus === 'loading' ? 'bg-warning animate-pulse' : 'bg-destructive'}`} />
              <span className="text-caption text-muted-foreground">
                Sepolia Testnet · Token Core WASM
                {walletStatus === 'loading' && ' · 初始化中...'}
                {walletStatus === 'ready' && ' · 已就绪'}
                {walletStatus === 'error' && ' · 离线模式'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-caption font-medium text-[#2168db] bg-[#2168db]/5 px-3 py-1 rounded-full border border-[#2168db]/15">
              imToken 10 周年
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="p-8">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: '/chronicle', element: <ChroniclePage /> },
      { path: '/capsules', element: <CapsulePage /> },
      { path: '/assistant', element: <AssistantPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
