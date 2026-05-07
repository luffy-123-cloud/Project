import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Mountain, Info, ScanLine, Tractor } from 'lucide-react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

const NAV_ITEMS = [
  { key: 'nav.home', icon: Home, path: '/', exact: true },
  { key: 'nav.fields', icon: Mountain, path: '/fields', exact: false },
  { key: 'nav.info', icon: Info, path: '/info', exact: false },
  { key: 'nav.rental', icon: Tractor, path: '/farm-rental', exact: false },
] as const

export default function BottomNav() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <nav className="bottom-nav" style={{ overflow: 'visible' }}>
      <div className="bottom-nav-inner">
        {NAV_ITEMS.slice(0, 2).map(({ key, icon: Icon, path, exact }) => (
          <NavLink
            key={key}
            to={path}
            end={exact}
            className={({ isActive }) =>
              clsx(
                'relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150',
                isActive ? 'text-brand-600' : 'text-neutral-400 hover:text-neutral-600'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  className="transition-all duration-150"
                />
                <span
                  className={clsx(
                    'text-[10px] font-bold transition-all duration-150',
                    isActive ? 'text-brand-600' : 'text-neutral-400'
                  )}
                >
                  {t(key)}
                </span>
                {isActive && (
                  <span className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 rounded-full bg-brand-600" />
                )}
              </>
            )}
          </NavLink>
        ))}

        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => navigate('/scanner')}
            className="bottom-nav-center"
            aria-label={t('nav.scanCropDisease')}
          >
            <ScanLine size={24} strokeWidth={2} />
          </button>
        </div>

        {NAV_ITEMS.slice(2).map(({ key, icon: Icon, path, exact }) => (
          <NavLink
            key={key}
            to={path}
            end={exact}
            className={({ isActive }) =>
              clsx(
                'relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150',
                isActive ? 'text-brand-600' : 'text-neutral-400 hover:text-neutral-600'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  className="transition-all duration-150"
                />
                <span
                  className={clsx(
                    'text-[10px] font-bold transition-all duration-150',
                    isActive ? 'text-brand-600' : 'text-neutral-400'
                  )}
                >
                  {t(key)}
                </span>
                {isActive && (
                  <span className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 rounded-full bg-brand-600" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
