import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  Calculator,
  Check,
  ChevronRight,
  Globe,
  Landmark,
  LogOut,
  Menu,
  MessageSquareText,
  Mic,
  Leaf,
  Search,
  Settings2,
  ShieldCheck,
  Sprout,
  UserRound,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { signOut as firebaseSignOut } from '../../services/firebase/authService'
import { useAuthStore } from '../../store/useAuthStore'
import { LANGUAGE_META, SUPPORTED_LANGUAGES, useLanguageStore } from '../../store/useLanguageStore'
import { GOVERNMENT_FARMER_PORTAL_URL, isExternalUrl, openExternalUrl } from '../../utils/externalLinks'

const FEATURE_MENU_ITEMS = [
  {
    id: 'mandi-saathi',
    titleKey: 'tools.mandiSaathi.title',
    descriptionKey: 'tools.mandiSaathi.desc',
    route: '/marketplace',
    icon: Search,
  },
  {
    id: 'crop-advisory',
    titleKey: 'tools.fasalSalah.title',
    descriptionKey: 'tools.fasalSalah.desc',
    route: '/crop-advisory',
    icon: Leaf,
  },
  {
    id: 'mitti-sehat',
    titleKey: 'tools.mittiSehat.title',
    descriptionKey: 'tools.mittiSehat.desc',
    route: '/mitti-sehat',
    icon: Sprout,
  },
  {
    id: 'kheti-kharcha',
    titleKey: 'tools.khetiKharcha.title',
    descriptionKey: 'tools.khetiKharcha.desc',
    route: '/kheti-kharcha',
    icon: Calculator,
  },
  {
    id: 'sauda-suraksha',
    titleKey: 'tools.saudaSuraksha.title',
    descriptionKey: 'tools.saudaSuraksha.desc',
    route: '/sauda-suraksha',
    icon: ShieldCheck,
  },
  {
    id: 'sarkari-yojana',
    titleKey: 'tools.sarkariYojana.title',
    descriptionKey: 'tools.sarkariYojana.desc',
    route: GOVERNMENT_FARMER_PORTAL_URL,
    icon: Landmark,
  },
  {
    id: 'kisan-kaksha',
    titleKey: 'tools.kisanKaksha.title',
    descriptionKey: 'tools.kisanKaksha.desc',
    route: '/kisan-kaksha',
    icon: MessageSquareText,
  },
  {
    id: 'sarpanch-salah',
    titleKey: 'tools.sarpanchSalah.title',
    descriptionKey: 'tools.sarpanchSalah.desc',
    route: '/sarpanch-salah',
    icon: Mic,
  },
] as const

export default function GlobalHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const farmer = useAuthStore((state) => state.farmer)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const clearStore = useAuthStore((state) => state.signOut)
  const language = useLanguageStore((state) => state.language)
  const isChangingLanguage = useLanguageStore((state) => state.isChangingLanguage)
  const setLanguage = useLanguageStore((state) => state.setLanguage)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [isLangExpanded, setIsLangExpanded] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'brand',
      icon: Bell,
      title: `Hey ${farmer?.name?.split(' ')[0] || 'User'}!`,
      message: 'A new equipment (Tractor) has been added near your location.',
      time: 'Just now',
      colorClass: 'brand'
    },
    {
      id: 2,
      type: 'warning',
      icon: Check,
      title: 'Tasks Pending',
      message: "Today's tasks are not complete. Please complete them to maintain your streak.",
      time: '2 hours ago',
      colorClass: 'orange'
    },
    {
      id: 3,
      type: 'success',
      icon: Landmark,
      title: 'Govt Scheme Update',
      message: 'New PM-Kisan scheme guidelines have been released. Check your eligibility now.',
      time: '5 hours ago',
      colorClass: 'green'
    },
    {
      id: 4,
      type: 'success',
      icon: Landmark,
      title: 'Govt Scheme Deadline',
      message: 'Fasal Bima Yojana application closes in 2 days. Apply soon.',
      time: '1 day ago',
      colorClass: 'green'
    }
  ])

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1)
      
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
      
      oscillator.start()
      oscillator.stop(audioCtx.currentTime + 0.1)
    } catch (e) {
      console.error("Audio play failed", e)
    }
  }

  const handleReadNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleIgnoreNotification = (_id: number) => {
    toast.success("Notification kept for later")
  }

  const toggleNotifications = () => {
    const newState = !isNotificationsOpen
    setIsNotificationsOpen(newState)
    if (newState && notifications.length > 0) {
      playNotificationSound()
    }
  }

  const initials = farmer?.name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  useEffect(() => {
    setIsMenuOpen(false)
    setIsLanguageMenuOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    try {
      await firebaseSignOut()
    } catch {
      // Ignore Firebase errors in guest/local mode.
    } finally {
      clearStore()
      toast(t('toast.signedOut'))
      navigate('/splash', { replace: true })
    }
  }

  const handleLanguageChange = async (nextLanguage: (typeof SUPPORTED_LANGUAGES)[number]) => {
    try {
      await setLanguage(nextLanguage)
      toast.success(
        isAuthenticated
          ? t('toast.languageSaved')
          : t('toast.languageSavedLocal')
      )
      setIsLanguageMenuOpen(false)
    } catch (error) {
      console.error('[i18n] Failed to persist language.', error)
      toast.error(t('toast.languageUpdateError'))
    }
  }

  const quickActions = [
    {
      id: 'profile',
      label: t('menu.openProfile'),
      description: t('menu.openProfileDescription'),
      icon: UserRound,
      onClick: () => navigate('/profile'),
    },
    {
      id: 'settings',
      label: t('menu.openSettings'),
      description: t('menu.openSettingsDescription'),
      icon: Settings2,
      onClick: () => navigate('/settings'),
    },
    {
      id: 'language',
      label: t('menu.language'),
      description: t('menu.languageDescription'),
      icon: Globe,
      onClick: () => setIsLanguageMenuOpen(true),
      value: LANGUAGE_META[language].nativeName,
    },
    isAuthenticated
      ? {
          id: 'signout',
          label: t('menu.signOut'),
          description: t('menu.signOutDescription'),
          icon: LogOut,
          onClick: () => void handleSignOut(),
          accent: 'text-danger-700 bg-danger-50 border-danger-100',
        }
      : {
          id: 'signin',
          label: t('menu.signIn'),
          description: t('menu.signInDescription'),
          icon: UserRound,
          onClick: () => navigate('/login'),
          accent: 'text-brand-700 bg-brand-50 border-brand-100',
        },
  ] as const

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-sm"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-16 items-center justify-between px-4 sm:px-5">
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.24em] text-neutral-300">
              AgroSathi
            </p>
            <h1
              className="text-xl font-black leading-none text-neutral-900"
              style={{ fontFamily: 'Baloo 2, sans-serif' }}
            >
              {farmer?.name?.split(' ')[0] || t('common.fallbackFarmer')}
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Dropdown Language Selector */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setIsLangExpanded(!isLangExpanded)}
                className={`flex h-10 items-center justify-center gap-2 rounded-full px-4 transition-all active:scale-95 shadow-sm border ${
                  isLangExpanded 
                    ? 'bg-[#2a6038] text-white border-[#2a6038]' 
                    : 'bg-[#f0ece4] text-[#2a6038] border-[#c4c8bc]/30'
                }`}
              >
                <Globe size={18} />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {LANGUAGE_META[language].nativeName}
                </span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${isLangExpanded ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {isLangExpanded && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden z-50"
                  >
                    <div className="max-h-[300px] overflow-y-auto py-2">
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            void setLanguage(lang)
                            setIsLangExpanded(false)
                          }}
                          disabled={isChangingLanguage}
                          className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                            language === lang 
                              ? 'bg-brand-50 text-brand-700 font-bold' 
                              : 'text-neutral-700 hover:bg-neutral-50'
                          } ${isChangingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span>{LANGUAGE_META[lang].nativeName}</span>
                          <span className="text-xs text-neutral-400">{LANGUAGE_META[lang].englishName}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-800 transition-all hover:bg-neutral-100 active:scale-95"
              onClick={toggleNotifications}
            >
              <Bell size={19} strokeWidth={2} />
              {notifications.length > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-brand-500" />
              )}
            </button>

            <button
              type="button"
              aria-label={t('menu.title')}
              onClick={() => setIsMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-sm transition-all hover:bg-neutral-100 active:scale-95"
            >
              <Menu size={19} strokeWidth={2.1} />
            </button>

            <button
              type="button"
              aria-label={t('common.profile')}
              onClick={() => navigate('/settings')}
              className="ml-1 h-10 w-10 overflow-hidden rounded-full border-2 border-neutral-50 shadow-sm transition-all active:scale-95"
            >
              {farmer?.photoURL ? (
                <img src={farmer.photoURL} alt={t('common.profile')} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-100 text-xs font-bold text-brand-700">
                  {initials || 'FR'}
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label={t('common.close')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsLanguageMenuOpen(false)
                setIsMenuOpen(false)
              }}
              className="fixed inset-0 z-[70] bg-neutral-950/35 backdrop-blur-[2px]"
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-sm flex-col border-l border-neutral-200 bg-white shadow-2xl"
            >
              <div
                className="border-b border-neutral-200 px-5 pb-5 pt-5"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-300">
                      {t('menu.label')}
                    </p>
                    <h2
                      className="mt-1 text-2xl font-black text-neutral-900"
                      style={{ fontFamily: 'Baloo 2, sans-serif' }}
                    >
                      {t('menu.title')}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      {t('menu.subtitle')}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={t('common.close')}
                    onClick={() => {
                      setIsLanguageMenuOpen(false)
                      setIsMenuOpen(false)
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 rounded-[28px] bg-gradient-to-br from-brand-600 via-brand-500 to-orange-500 p-5 text-white shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/15 ring-2 ring-white/15">
                      {farmer?.photoURL ? (
                        <img src={farmer.photoURL} alt={t('common.profile')} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold">{initials || 'FR'}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-bold" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
                        {farmer?.name || t('common.guestFarmer')}
                      </p>
                      <p className="truncate text-sm text-white/80">
                        {farmer?.email || (farmer?.phone ? `+91 ${farmer.phone}` : t('menu.accountHint'))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative flex-1 overflow-y-auto px-5 py-5">
                <section className="space-y-3">
                  <p className="section-label mb-0">{t('menu.account')}</p>
                  <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-card">
                    {quickActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={action.onClick}
                        className={`flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-neutral-50 ${
                          'accent' in action ? action.accent : ''
                        }`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                          <action.icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-neutral-900">{action.label}</p>
                            {'value' in action && action.value ? (
                              <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                                {action.value}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-neutral-500">{action.description}</p>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-neutral-300" />
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="section-label mb-0">{t('menu.futureFeatures')}</p>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      {t('menu.featureSlots', { count: FEATURE_MENU_ITEMS.length })}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {FEATURE_MENU_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => (isExternalUrl(item.route) ? openExternalUrl(item.route) : navigate(item.route))}
                        className="rounded-[26px] border border-neutral-200 bg-neutral-50 p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm">
                            <item.icon size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-bold text-neutral-900">{t(item.titleKey)}</p>
                              <span className="rounded-full bg-brand-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                                Open
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-neutral-500">{t(item.descriptionKey)}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <AnimatePresence>
                  {isLanguageMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      className="absolute inset-0 z-10 bg-white px-1 pb-4 pt-1"
                    >
                      <div className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-card">
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-300">
                              {t('common.language')}
                            </p>
                            <h3 className="mt-1 text-xl font-black text-neutral-900" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
                              {t('menu.languageSelectorTitle')}
                            </h3>
                            <p className="mt-1 text-sm text-neutral-500">
                              {t('menu.languageSelectorSubtitle')}
                            </p>
                          </div>

                          <button
                            type="button"
                            aria-label={t('common.close')}
                            onClick={() => setIsLanguageMenuOpen(false)}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        <div className="mb-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
                          <p className="font-semibold">{t('language.modalCurrent')}</p>
                          <p className="mt-1 text-brand-700">
                            {LANGUAGE_META[language].nativeName} · {LANGUAGE_META[language].englishName}
                          </p>
                          <p className="mt-2 text-xs text-brand-700/80">{t('language.savedToAccount')}</p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                            {t('language.modalAllLanguages')}
                          </p>

                          {SUPPORTED_LANGUAGES.map((option) => {
                            const meta = LANGUAGE_META[option]
                            const isActive = option === language

                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => void handleLanguageChange(option)}
                                disabled={isChangingLanguage}
                                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                                  isActive
                                    ? 'border-brand-500 bg-brand-50'
                                    : 'border-neutral-200 bg-white hover:bg-neutral-50'
                                } ${isChangingLanguage ? 'opacity-70' : ''}`}
                              >
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100 text-sm font-bold text-neutral-700">
                                  {option.toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-neutral-900">{meta.nativeName}</p>
                                  <p className="text-xs text-neutral-500">{meta.englishName}</p>
                                </div>
                                {isActive ? (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white">
                                    <Check size={16} />
                                  </div>
                                ) : (
                                  <ChevronRight size={16} className="text-neutral-300" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Notifications Panel */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationsOpen(false)}
              className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-100 px-6">
                <h2 className="text-lg font-bold text-neutral-900" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
                  Notifications ({notifications.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                    <Bell className="mb-2 opacity-50" size={32} />
                    <p className="text-sm">No new notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const Icon = notification.icon;
                    const colorMap = {
                      'brand': 'bg-brand-50 border-brand-100 text-brand-900 icon-text-brand-600 desc-text-brand-700',
                      'orange': 'bg-orange-50 border-orange-100 text-orange-900 icon-text-orange-600 desc-text-orange-700',
                      'green': 'bg-[#f0ece4] border-[#c4c8bc] text-[#2a6038] icon-text-[#2a6038] desc-text-[#2a6038]/80'
                    } as Record<string, string>;
                    
                    const colors = colorMap[notification.colorClass] || colorMap['brand'];
                    const [bg, border, titleColor, iconColor, descColor] = colors.split(' ');

                    return (
                      <div key={notification.id} className={`p-4 rounded-2xl border flex flex-col gap-3 ${bg} ${border}`}>
                        <div className="flex gap-3">
                          <div className={`mt-0.5 ${iconColor.replace('icon-text-', 'text-')}`}>
                            <Icon size={20} />
                          </div>
                          <div>
                            <h4 className={`font-bold text-sm ${titleColor}`}>{notification.title}</h4>
                            <p className={`text-sm mt-1 ${descColor.replace('desc-text-', 'text-')}`}>{notification.message}</p>
                            <p className="text-xs opacity-70 mt-2">{notification.time}</p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            onClick={() => handleIgnoreNotification(notification.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-full bg-white/50 border border-black/5 hover:bg-white/80 transition-colors"
                          >
                            Ignore
                          </button>
                          <button
                            onClick={() => handleReadNotification(notification.id)}
                            className="px-3 py-1.5 text-xs font-bold rounded-full bg-white shadow-sm border border-black/10 hover:shadow transition-all text-brand-700"
                          >
                            Read
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
