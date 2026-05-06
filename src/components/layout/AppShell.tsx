import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'
import GlobalHeader from './GlobalHeader'
import OfflineBanner from '../ui/OfflineBanner'
import FAB from '../ui/FAB'
import { useAppStore } from '../../store/useAppStore'

const NO_FAB_PATHS = [
  '/sarpanchgpt',
  '/sarpanch-salah',
  '/login',
  '/splash',
  '/language',
  '/category',
  '/profile',
  '/scanner',
  '/crop-advisory',
  '/farm-rental',
  '/farm-rental/service/',
]

const NO_HEADER_PATHS = ['/splash', '/language', '/category', '/login', '/farm-rental/service/', '/fields/live-market']
const HIDE_NAV_PATHS = ['/farm-rental/service/']

export default function AppShell() {
  const isOnline = useAppStore((state) => state.isOnline)
  const { pathname } = useLocation()

  const showFab = !NO_FAB_PATHS.some((path) => pathname.startsWith(path))
  const showHeader = !NO_HEADER_PATHS.some((path) => pathname.startsWith(path))
  const showBottomNav = !HIDE_NAV_PATHS.some((path) => pathname.startsWith(path))

  return (
    <div className="page-root">
      {!isOnline && <OfflineBanner />}

      {showHeader && <GlobalHeader />}

      <main className="relative flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <Outlet />
        {showBottomNav && <div className="h-8 shrink-0" aria-hidden />}
      </main>

      {showFab && <FAB />}
      {showBottomNav && <BottomNav />}
    </div>
  )
}
