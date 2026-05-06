import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Calculator,
  CloudRain,
  Droplets,
  Landmark,
  Sparkles,
  ShieldCheck,
  Sprout,
  ThermometerSun,
  TrendingUp,
  Bug,
  Leaf,
  Mic,
  MessageSquareText,
  type LucideIcon,
} from 'lucide-react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import type { WeatherData } from '../../store/useWeatherStore'
import { useWeather } from '../../hooks/useWeather'
import { useHomeInsights } from '../../hooks/useHomeInsights'
import WeatherWidget from '../../components/shared/WeatherWidget'
import BannerCarousel from '../../components/shared/BannerCarousel'
import type { BannerSlide } from '../../components/shared/BannerCarousel'
import marketBanner from '../../assets/market-banner.png'
import weatherBanner from '../../assets/weather-banner.png'
import cropDiseaseBanner from '../../assets/crop-disease-banner.png'
import govtSchemesBanner from '../../assets/govt-schemes-banner.png'
import { formatLocalizedDate, formatLocalizedNumber } from '../../i18n'
import { GOVERNMENT_FARMER_PORTAL_URL, isExternalUrl, openExternalUrl } from '../../utils/externalLinks'

type Insight = {
  id: string
  icon: LucideIcon
  title: string
  description: string
  action: string
  actionRoute: string
  priority: 'high' | 'medium' | 'low'
  colorScheme: 'blue' | 'green' | 'amber' | 'purple'
  timestamp: string
  isLive?: boolean
}

type ToolShortcut = {
  id: string
  title: string
  subtitle: string
  route: string
  icon: LucideIcon
  tint: string
  featured?: boolean
}

const formatRelativeMinutes = (t: TFunction, minutes: number) => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return t('insights.hourAgo', { count: hours })
  }

  return t('insights.minutesAgo', { count: minutes })
}

const buildBannerSlides = (t: TFunction): BannerSlide[] => [
  {
    id: 'b1',
    image: marketBanner,
    alt: t('home.marketBannerAlt'),
    route: '/marketplace',
  },
  {
    id: 'b2',
    image: weatherBanner,
    alt: t('home.weatherBannerAlt'),
    route: '/crop/weather',
  },
  {
    id: 'b3',
    image: cropDiseaseBanner,
    alt: t('home.cropDiseaseBannerAlt'),
    route: '/scanner',
  },
  {
    id: 'b4',
    image: govtSchemesBanner,
    alt: t('home.govtSchemesBannerAlt'),
    route: GOVERNMENT_FARMER_PORTAL_URL,
  },
]

const generateInsights = (
  weather: WeatherData | null,
  t: TFunction,
  language: string,
  marketInsight?: { commodity: string; price: number; trendPercent: number; trend: string; isLive: boolean } | null
): Insight[] => {
  const isRainy = weather ? ['Rain', 'Thunderstorm', 'Drizzle'].includes(weather.icon) : false
  const isHot = weather ? weather.temp > 35 : false
  const isCloudy = weather?.icon === 'Clouds'
  const humidity = weather?.humidity ?? 72
  const temperature = Math.round(weather?.temp ?? 32)
  const humidityLabel = `${formatLocalizedNumber(humidity, { maximumFractionDigits: 0 }, language)}%`
  const temperatureLabel = `${formatLocalizedNumber(temperature, { maximumFractionDigits: 0 }, language)}°C`

  const insights: Insight[] = []

  if (isRainy) {
    insights.push({
      id: 'w1',
      icon: CloudRain,
      title: t('insights.weatherRainTitle'),
      description: t('insights.weatherRainDescription'),
      action: t('insights.viewForecast'),
      actionRoute: '/crop/weather',
      priority: 'high',
      colorScheme: 'blue',
      timestamp: formatRelativeMinutes(t, 2),
    })
  } else if (isCloudy) {
    insights.push({
      id: 'w1',
      icon: CloudRain,
      title: t('insights.weatherCloudTitle'),
      description: t('insights.weatherCloudDescription', {
        humidity: humidityLabel,
      }),
      action: t('insights.viewForecast'),
      actionRoute: '/crop/weather',
      priority: 'medium',
      colorScheme: 'blue',
      timestamp: formatRelativeMinutes(t, 5),
    })
  } else if (isHot) {
    insights.push({
      id: 'w1',
      icon: ThermometerSun,
      title: t('insights.weatherHotTitle'),
      description: t('insights.weatherHotDescription', {
        temp: temperatureLabel,
      }),
      action: t('insights.setReminder'),
      actionRoute: '/fields/tasks',
      priority: 'high',
      colorScheme: 'blue',
      timestamp: formatRelativeMinutes(t, 1),
    })
  } else {
    insights.push({
      id: 'w1',
      icon: Droplets,
      title: t('insights.weatherClearTitle'),
      description: t('insights.weatherClearDescription', {
        temp: temperatureLabel,
      }),
      action: t('insights.viewSchedule'),
      actionRoute: '/fields/tasks',
      priority: 'medium',
      colorScheme: 'blue',
      timestamp: formatRelativeMinutes(t, 3),
    })
  }

  // REAL MARKET INSIGHT — from API, not hardcoded
  if (marketInsight) {
    const trendLabel = marketInsight.trend === 'up'
      ? `▲ +${formatLocalizedNumber(Math.abs(marketInsight.trendPercent), { maximumFractionDigits: 1 }, language)}%`
      : marketInsight.trend === 'down'
        ? `▼ -${formatLocalizedNumber(Math.abs(marketInsight.trendPercent), { maximumFractionDigits: 1 }, language)}%`
        : t('insights.stable', { defaultValue: 'Stable' })

    insights.push({
      id: 'm1',
      icon: TrendingUp,
      title: `${marketInsight.commodity} — ₹${formatLocalizedNumber(marketInsight.price, { maximumFractionDigits: 0 }, language)}/qtl`,
      description: `${trendLabel} this week. ${marketInsight.trend === 'up' ? 'Good time to consider selling.' : marketInsight.trend === 'down' ? 'Prices falling — hold if possible.' : 'Market is stable.'}`,
      action: t('insights.viewMarket'),
      actionRoute: '/marketplace',
      priority: marketInsight.trend === 'up' ? 'high' : 'medium',
      colorScheme: 'green',
      timestamp: marketInsight.isLive ? 'Live' : 'Demo',
      isLive: marketInsight.isLive,
    })
  } else {
    insights.push({
      id: 'm1',
      icon: TrendingUp,
      title: t('insights.marketTitle'),
      description: 'Loading market prices...',
      action: t('insights.viewMarket'),
      actionRoute: '/marketplace',
      priority: 'medium',
      colorScheme: 'green',
      timestamp: '...',
    })
  }

  insights.push({
    id: 'c1',
    icon: Bug,
    title: t('insights.cropTitle'),
    description: t('insights.cropDescription', {
      humidity: humidityLabel,
    }),
    action: t('insights.viewAdvisory'),
      actionRoute: '/crop-advisory',
    priority: 'medium',
    colorScheme: 'amber',
    timestamp: formatRelativeMinutes(t, 30),
  })

  insights.push({
    id: 's1',
    icon: Leaf,
    title: t('insights.seasonalTitle'),
    description: t('insights.seasonalDescription'),
    action: t('insights.learnMore'),
      actionRoute: '/crop-advisory',
    priority: 'low',
    colorScheme: 'purple',
    timestamp: formatRelativeMinutes(t, 60),
  })

  return insights
}

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.08 } } },
  item: {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  },
}

const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    actionColor: 'text-blue-600 hover:text-blue-700',
    accentBar: 'bg-blue-500',
    priorityBg: 'bg-blue-100 text-blue-700',
  },
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    actionColor: 'text-emerald-600 hover:text-emerald-700',
    accentBar: 'bg-emerald-500',
    priorityBg: 'bg-emerald-100 text-emerald-700',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    actionColor: 'text-amber-600 hover:text-amber-700',
    accentBar: 'bg-amber-500',
    priorityBg: 'bg-amber-100 text-amber-700',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    actionColor: 'text-purple-600 hover:text-purple-700',
    accentBar: 'bg-purple-500',
    priorityBg: 'bg-purple-100 text-purple-700',
  },
}

const AI_TASK_COLOR_MAP = {
  red: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', text: 'text-red-900', label: '🔴 Do Now' },
  yellow: { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', text: 'text-amber-900', label: '🟡 Today' },
  green: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-900', label: '🟢 This Week' },
}

export default function Home() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const farmer = useAuthStore((state) => state.farmer)
  const firstName = farmer?.name?.split(' ')[0] || t('common.fallbackFarmer')
  const { current } = useWeather()
  const { marketInsight, aiTasks, isMarketLoading, isTasksLoading } = useHomeInsights()
  const language = i18n.resolvedLanguage || i18n.language
  const bannerSlides = buildBannerSlides(t)
  const insights = generateInsights(current, t, language, marketInsight)
  const priorityLabels: Record<Insight['priority'], string> = {
    high: t('common.urgent'),
    medium: t('common.suggested'),
    low: t('common.tip'),
  }
  const todayLabel = formatLocalizedDate(
    new Date(),
    { weekday: 'long', day: 'numeric', month: 'long' },
    language
  )
  const toolShortcuts: ToolShortcut[] = [
    {
      id: 'crop-advisory',
      title: '🌾 Fasal Salah',
      subtitle: 'Get crop recommendations based on your land & weather',
      route: '/crop-advisory',
      icon: Leaf,
      tint: 'bg-brand-50 text-brand-700 border-brand-100',
      featured: true,
    },
    {
      id: 'mandi',
      title: 'Mandi Saathi',
      subtitle: 'Check rates and list crop',
      route: '/marketplace',
      icon: TrendingUp,
      tint: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    {
      id: 'mitti',
      title: 'Mitti Sehat',
      subtitle: 'Soil and fertilizer tips',
      route: '/mitti-sehat',
      icon: Sprout,
      tint: 'bg-amber-50 text-amber-700 border-amber-100',
    },
    {
      id: 'kharcha',
      title: 'Kheti Kharcha',
      subtitle: 'Estimate profit quickly',
      route: '/kheti-kharcha',
      icon: Calculator,
      tint: 'bg-sky-50 text-sky-700 border-sky-100',
    },
    {
      id: 'sauda',
      title: 'Sauda Suraksha',
      subtitle: 'Check risky contract clauses',
      route: '/sauda-suraksha',
      icon: ShieldCheck,
      tint: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      id: 'yojana',
      title: 'Sarkari Yojana',
      subtitle: 'Find eligible schemes',
      route: GOVERNMENT_FARMER_PORTAL_URL,
      icon: Landmark,
      tint: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    },
    {
      id: 'kisan-kaksha',
      title: 'Kisan Kaksha',
      subtitle: 'Farmer community, useful resources, and video learning',
      route: '/kisan-kaksha',
      icon: MessageSquareText,
      tint: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    {
      id: 'scanner',
      title: 'Fasal Doctor',
      subtitle: 'Identify pests and diseases from a photo',
      route: '/scanner',
      icon: Bug,
      tint: 'bg-red-50 text-red-700 border-red-100',
      featured: true,
    },
    {
      id: 'salah',
      title: 'Sarpanch Salah',
      subtitle: 'Voice-first farm help',
      route: '/sarpanch-salah',
      icon: Mic,
      tint: 'bg-brand-50 text-brand-700 border-brand-100',
    },
  ]

  return (
    <div className="px-4 py-5 space-y-5 max-w-5xl mx-auto w-full">
      <motion.div {...stagger.item} className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          {farmer?.photoURL ? (
            <img
              src={farmer.photoURL}
              alt=""
              className="w-12 h-12 rounded-full object-cover ring-2 ring-neutral-200"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-xl select-none ring-2 ring-brand-200">
              {'\u{1F468}\u200D\u{1F33E}'}
            </div>
          )}
          <div>
            <p className="text-sm text-neutral-500 flex items-center gap-1">
              {t('home.hello')} <span aria-hidden="true">{'\u{1F44B}'}</span>
            </p>
            <h1
              className="text-xl lg:text-2xl font-bold text-neutral-900"
              style={{ fontFamily: 'Baloo 2, sans-serif' }}
            >
              {firstName}
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              {t('home.todayLabel', { date: todayLabel })}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div {...stagger.item}>
        <BannerCarousel slides={bannerSlides} interval={4000} />
      </motion.div>

      <WeatherWidget />

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="section-title mb-0">Decision Tools</h2>
            <p className="text-xs text-neutral-400 mt-1">Simple farmer tools built around price, risk, and guidance.</p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {toolShortcuts.map((tool) => {
            const Icon = tool.icon
            return (
              <button
                key={tool.id}
                onClick={() => (isExternalUrl(tool.route) ? openExternalUrl(tool.route) : navigate(tool.route))}
                className={`rounded-2xl border p-4 text-left shadow-card hover:shadow-card-md transition-all active:scale-[0.99] ${
                  tool.featured ? 'ring-1 ring-brand-200/70' : ''
                } ${tool.tint}`}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white/80 p-3">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-neutral-900">{tool.title}</p>
                      {tool.featured && (
                        <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                          AI
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-600">{tool.subtitle}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-sm">
              <Sparkles size={14} className="text-white" />
            </div>
            <h2 className="section-title mb-0">{t('home.aiInsights')}</h2>
          </div>
          <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-1 rounded-full">
            {isMarketLoading ? '⏳ Loading...' : marketInsight?.isLive ? '● Live data' : '◌ Demo data'}
          </span>
        </div>

        <motion.div
          variants={stagger.container}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {insights.map((insight) => {
            const colors = COLOR_MAP[insight.colorScheme]
            const Icon = insight.icon

            return (
              <motion.div key={insight.id} variants={stagger.item}>
                <button
                  onClick={() => navigate(insight.actionRoute)}
                  className={`
                    w-full text-left rounded-2xl border overflow-hidden
                    ${colors.bg} ${colors.border}
                    shadow-card hover:shadow-card-md transition-all duration-200
                    active:scale-[0.99] relative
                  `}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.accentBar} rounded-l-2xl`} />

                  <div className="pl-4 pr-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl ${colors.iconBg} flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        <Icon size={18} className={colors.iconColor} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-bold text-neutral-900 leading-tight">
                            {insight.title}
                          </p>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${colors.priorityBg}`}
                          >
                            {priorityLabels[insight.priority]}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed">
                          {insight.description}
                        </p>

                        <div className="flex items-center justify-between mt-2.5">
                          <span className={`text-xs font-semibold flex items-center gap-1 ${colors.actionColor}`}>
                            {insight.action} <ChevronRight size={12} />
                          </span>
                          <span className={`text-[10px] font-semibold ${insight.isLive ? 'text-emerald-600' : 'text-neutral-400'}`}>
                            {insight.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            )
          })}
        </motion.div>
      </section>

      {/* AI-Powered Today's Tasks — real data from Gemini */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="section-title mb-0">{t('home.todayTasks')}</h2>
            <p className="text-xs text-neutral-400 mt-1">
              {isTasksLoading ? 'AI is preparing your tasks...' : aiTasks.length > 0 ? 'AI-generated based on weather & market' : 'Weather-based farming actions'}
            </p>
          </div>
          <button
            onClick={() => navigate('/fields/tasks')}
            className="text-xs font-semibold text-brand-600 flex items-center gap-0.5 hover:text-brand-700"
          >
            {t('home.viewAll')} <ChevronRight size={13} />
          </button>
        </div>

        <div className="space-y-2">
          {isTasksLoading ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-3 shadow-card animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-neutral-100 rounded w-3/4" />
                <div className="h-2 bg-neutral-100 rounded w-1/2" />
              </div>
            </div>
          ) : aiTasks.length > 0 ? (
            aiTasks.map((task, index) => {
              const taskColors = AI_TASK_COLOR_MAP[task.color] || AI_TASK_COLOR_MAP.green

              return (
                <div
                  key={`ai-task-${index}`}
                  className={`${taskColors.bg} border ${taskColors.border} rounded-xl p-4 flex items-start gap-3 shadow-card`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/80`}>
                    <span className="text-lg">{task.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-bold ${taskColors.text}`}>{task.action}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${taskColors.bg} ${taskColors.text} border ${taskColors.border}`}>
                        {taskColors.label}
                      </span>
                    </div>
                    <p className={`text-xs ${taskColors.text} opacity-75 mt-1`}>{task.reason}</p>
                  </div>
                </div>
              )
            })
          ) : (
            // Fallback static tasks when AI isn't available
            [
              { title: t('insights.irrigation'), field: t('insights.northFields'), icon: Droplets, priority: 'high' as const },
              { title: t('insights.ureaFertilizer'), field: t('insights.southFields'), icon: Sprout, priority: 'medium' as const },
            ].map((task) => {
              const TaskIcon = task.icon
              return (
                <button
                  key={task.title}
                  onClick={() => navigate('/fields/tasks')}
                  className="w-full bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-3 shadow-card hover:shadow-card-md transition-all active:scale-[0.99]"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      task.priority === 'high' ? 'bg-brand-50' : 'bg-info-50'
                    }`}
                  >
                    <TaskIcon
                      size={18}
                      className={task.priority === 'high' ? 'text-brand-600' : 'text-info-600'}
                    />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{task.title}</p>
                    <p className="text-xs text-neutral-500">{task.field}</p>
                  </div>
                  <ChevronRight size={16} className="text-neutral-300 shrink-0" />
                </button>
              )
            })
          )}
        </div>
      </section>

      <div className="h-4" />
    </div>
  )
}
