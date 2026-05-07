import { useNavigate } from 'react-router-dom'

import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import { useWeather } from '../../hooks/useWeather'
import { useHomeInsights } from '../../hooks/useHomeInsights'
import { GOVERNMENT_FARMER_PORTAL_URL, isExternalUrl, openExternalUrl } from '../../utils/externalLinks'
import BannerCarousel from '../../components/shared/BannerCarousel'

// Import assets for the carousel
import govtBanner from '../../assets/govt-schemes-banner.png'
import marketBanner from '../../assets/market-banner.png'
import diseaseBanner from '../../assets/crop-disease-banner.png'
import weatherBanner from '../../assets/weather-banner.png'

export default function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  
  const farmer = useAuthStore((state) => state.farmer)
  const { current } = useWeather()
  const { marketInsight, aiTasks } = useHomeInsights()

  // Location logic
  const farmerLocation = [farmer?.village, farmer?.district, farmer?.state].filter(Boolean).join(', ')
  const displayLocation = farmerLocation || current?.location || 'Detecting location...'

  // Weather variables
  const temp = current ? Math.round(current.temp) : 32
  const desc = current?.description || 'Clear Sky'
  const humidity = current?.humidity ?? 65
  const windSpeed = current?.windSpeed ?? 12
  const weatherIconMap: Record<string, string> = {
    Clear: 'wb_sunny',
    Clouds: 'partly_cloudy_day',
    Rain: 'rainy',
    Thunderstorm: 'thunderstorm',
    Drizzle: 'rainy',
    Snow: 'ac_unit',
  }
  const mainIcon = current ? weatherIconMap[current.icon] || 'wb_sunny' : 'partly_cloudy_day'

  // Dynamic Insights adapted for new UI
  const generateInsights = () => {
    const insights = []
    
    // Weather insight
    if (current && ['Rain', 'Thunderstorm', 'Drizzle'].includes(current.icon)) {
      insights.push({
        id: 'w1',
        icon: 'water_drop',
        title: t('insights.weatherRainTitle', 'Irrigation Alert'),
        description: t('insights.weatherRainDescription', 'Rain expected. Hold off on irrigation today.'),
        timestamp: '10 MINS AGO',
        colorClass: 'bg-[#f0ece4] border-[#2a6038]',
        iconColor: 'text-[#2a6038]'
      })
    } else if (current && current.temp > 35) {
      insights.push({
        id: 'w1',
        icon: 'wb_sunny',
        title: 'Heatwave Warning',
        description: `Temperature is ${temp}°C. Ensure proper hydration for your crops.`,
        timestamp: '15 MINS AGO',
        colorClass: 'bg-[#ffdad8]/20 border-[#b83230]',
        iconColor: 'text-[#b83230]'
      })
    } else {
      insights.push({
        id: 'w1',
        icon: 'water_drop',
        title: 'Irrigation Suggestion',
        description: `Next 48 hours are dry. Recommended irrigation based on ${humidity}% humidity.`,
        timestamp: '2 HOURS AGO',
        colorClass: 'bg-[#f0ece4] border-[#2a6038]',
        iconColor: 'text-[#2a6038]'
      })
    }

    // Market insight
    if (marketInsight) {
      const isUp = marketInsight.trend === 'up'
      const isDown = marketInsight.trend === 'down'
      insights.push({
        id: 'm1',
        icon: 'sell',
        title: isUp ? 'Price Surge Alert' : isDown ? 'Price Drop Alert' : 'Market Update',
        description: `${marketInsight.commodity} is at ₹${marketInsight.price}/qtl. ${isUp ? 'Good time to sell!' : ''}`,
        timestamp: marketInsight.isLive ? 'LIVE' : 'RECENT',
        colorClass: isUp ? 'bg-[#ffdad8]/20 border-[#b83230]' : 'bg-[#f0ece4] border-[#2a6038]',
        iconColor: isUp ? 'text-[#b83230]' : 'text-[#2a6038]'
      })
    }

    // Pest insight
    insights.push({
      id: 'c1',
      icon: 'bug_report',
      title: 'Pest Warning',
      description: 'Local reports of Yellow Rust in nearby farms. Inspect your crop today.',
      timestamp: '5 HOURS AGO',
      colorClass: 'bg-[#ffdad8]/20 border-[#b83230]',
      iconColor: 'text-[#b83230]'
    })

    return insights
  }

  const insights = generateInsights()

  const handleToolClick = (route: string) => {
    if (isExternalUrl(route)) {
      openExternalUrl(route)
    } else {
      navigate(route)
    }
  }

  const slides = [
    { id: '1', image: govtBanner, alt: 'Government Schemes', route: GOVERNMENT_FARMER_PORTAL_URL },
    { id: '2', image: marketBanner, alt: 'Market Prices', route: '/market' },
    { id: '3', image: diseaseBanner, alt: 'Crop Care', route: '/crop/care' },
    { id: '4', image: weatherBanner, alt: 'Weather Forecast', route: '/crop/weather' },
  ]

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-8 bg-[#faf6f0] text-[#2e3230] min-h-screen">
      {/* Hero Carousel Section */}
      <section className="@container">
        <BannerCarousel slides={slides} interval={5000} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Main Dashboard */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Weather Dashboard */}
          <section className="bg-[#faf6f0] p-6 rounded-xl border-2 border-[#c4c8bc]/50 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/crop/weather')}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#2a6038] text-3xl">{mainIcon}</span>
                <div>
                  <h3 className="font-headline text-xl font-bold">{displayLocation}</h3>
                  <p className="text-sm text-[#4a4e4a]">Last updated: Just now</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-4xl font-bold text-[#2a6038]">{temp}°C</span>
                <p className="text-sm font-medium text-[#4a4e4a] capitalize">{desc}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg flex flex-col items-center border border-outline-variant/20">
                <span className="material-symbols-outlined text-secondary mb-2">humidity_percentage</span>
                <span className="text-xs text-[#4a4e4a] uppercase font-bold">{t('weather.humidity')}</span>
                <span className="text-lg font-bold">{humidity}%</span>
              </div>
              <div className="bg-white p-4 rounded-lg flex flex-col items-center border border-outline-variant/20">
                <span className="material-symbols-outlined text-secondary mb-2">air</span>
                <span className="text-xs text-[#4a4e4a] uppercase font-bold">{t('weather.wind')}</span>
                <span className="text-lg font-bold">{windSpeed} km/h</span>
              </div>
              <div className="bg-white p-4 rounded-lg flex flex-col items-center border border-outline-variant/20">
                <span className="material-symbols-outlined text-secondary mb-2">rainy</span>
                <span className="text-xs text-[#4a4e4a] uppercase font-bold">{t('weather.precip')}</span>
                <span className="text-lg font-bold">0%</span>
              </div>
              <div className="bg-white p-4 rounded-lg flex flex-col items-center border border-outline-variant/20">
                <span className="material-symbols-outlined text-secondary mb-2">wb_sunny</span>
                <span className="text-xs text-[#4a4e4a] uppercase font-bold">UV Index</span>
                <span className="text-lg font-bold">8/10</span>
              </div>
            </div>
          </section>

          {/* Decision Tools Grid */}
          <section className="bg-[#f5f1ea] p-8 rounded-[28px] border border-[#dcd8cf]">
            <h3 className="font-headline text-2xl font-bold mb-8 flex items-center gap-2.5 text-[#2a6038]">
              <span className="material-symbols-outlined text-[#2a6038] text-3xl">grid_view</span>
              {t('tools.title')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {[
                { icon: 'psychology', title: t('tools.fasalSalah.title'), desc: t('tools.fasalSalah.desc'), route: '/crop-advisory', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                { icon: 'trending_up', title: t('tools.mandiSaathi.title'), desc: t('tools.mandiSaathi.desc'), route: '/marketplace', color: 'bg-orange-50 text-orange-700 border-orange-100' },
                { icon: 'grass', title: t('tools.mittiSehat.title'), desc: t('tools.mittiSehat.desc'), route: '/mitti-sehat', color: 'bg-lime-50 text-lime-700 border-lime-100' },
                { icon: 'account_balance_wallet', title: t('tools.khetiKharcha.title'), desc: t('tools.khetiKharcha.desc'), route: '/kheti-kharcha', color: 'bg-amber-50 text-amber-700 border-amber-100' },
                { icon: 'verified_user', title: t('tools.saudaSuraksha.title'), desc: t('tools.saudaSuraksha.desc'), route: '/sauda-suraksha', color: 'bg-sky-50 text-sky-700 border-sky-100' },
                { icon: 'school', title: t('tools.kisanKaksha.title'), desc: t('tools.kisanKaksha.desc'), route: '/kisan-kaksha', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
                { icon: 'groups', title: t('tools.sarpanchSalah.title'), desc: t('tools.sarpanchSalah.desc'), route: '/sarpanch-salah', color: 'bg-rose-50 text-rose-700 border-rose-100' },
                { icon: 'description', title: t('tools.sarkariYojana.title'), desc: t('tools.sarkariYojana.desc'), route: GOVERNMENT_FARMER_PORTAL_URL, color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
              ].map((tool, idx) => (
                <div key={idx} onClick={() => handleToolClick(tool.route)} className="bg-white p-6 rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-neutral-200/50 group shadow-sm flex flex-col items-center text-center">
                  <div className={`mb-4 w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${tool.color}`}>
                    <span className="material-symbols-outlined text-3xl">{tool.icon}</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2 text-[#2a6038] leading-tight">{tool.title}</h4>
                  <p className="text-xs text-[#4a4e4a] leading-relaxed opacity-90">{tool.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: AI Insights & Tasks */}
        <aside className="lg:col-span-4 space-y-8">
          
          {/* AI Insights Feed */}
          <section className="bg-white p-6 rounded-xl shadow-sm border border-outline-variant/30">
            <h3 className="font-headline text-xl font-bold mb-4 flex items-center gap-2 text-[#2a6038]">
              <span className="material-symbols-outlined text-[#2a6038]">auto_awesome</span>
              AI Insights
            </h3>
            <div className="space-y-4">
              {insights.map((insight) => (
                <div key={insight.id} className={`flex gap-4 p-3 rounded-lg border-l-4 ${insight.colorClass}`}>
                  <div className="flex-shrink-0 mt-1">
                    <span className={`material-symbols-outlined ${insight.iconColor}`}>{insight.icon}</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-sm">{insight.title}</h5>
                    <p className="text-xs text-[#4a4e4a]">{insight.description}</p>
                    <span className="text-[10px] text-outline font-bold mt-1 block">{insight.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/crop-advisory')} className="w-full mt-4 text-center text-[#4a7c59] text-sm font-bold py-2 hover:underline">View All Alerts</button>
          </section>

          {/* Today's Tasks List */}
          <section className="bg-[#f0e8db] p-6 rounded-xl shadow-sm border border-[#f0e8db]/30">
            <h3 className="font-headline text-xl font-bold mb-4 flex items-center gap-2 text-[#2a6038]">
              <span className="material-symbols-outlined text-[#2a6038]">fact_check</span>
              Today's Tasks
            </h3>
            <div className="space-y-3">
              {(aiTasks.length > 0 ? aiTasks.slice(0, 4) : [
                { action: 'Check soil moisture in Block A' },
                { action: 'Inspect for Yellow Rust symptoms' },
                { action: 'Apply Urea (1st dose) for Mustard' },
                { action: 'Weed cleaning in Wheat rows' },
              ]).map((task, idx) => (
                <label key={idx} className="flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer hover:shadow-md transition-shadow group">
                  <input className="w-5 h-5 rounded border-outline text-[#4a7c59] focus:ring-primary" type="checkbox" />
                  <span className="text-sm font-medium group-hover:text-[#4a7c59] transition-colors">{task.action}</span>
                </label>
              ))}
            </div>
            <button onClick={() => navigate('/fields/tasks')} className="w-full mt-4 bg-[#2a6038] text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 border-2 border-[#2a6038] hover:bg-[#2a6038]/90 transition-colors">
              <span className="material-symbols-outlined">add_task</span>
              Add New Task
            </button>
          </section>

          {/* Market Summary Mini */}
          <section className="bg-white p-6 rounded-xl border border-outline-variant/30">
            <h3 className="font-headline text-lg font-bold mb-4">{t('market.spotlight')}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-outline-variant/20">
                <span className="font-bold text-sm">{t('market.wheat')}</span>
                <div className="text-right">
                  <span className="block font-bold">₹2,250</span>
                  <span className="text-[10px] text-[#4a7c59] font-bold">▲ ₹15.00</span>
                </div>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-outline-variant/20">
                <span className="font-bold text-sm">{t('market.rice')}</span>
                <div className="text-right">
                  <span className="block font-bold">₹3,400</span>
                  <span className="text-[10px] text-[#b83230] font-bold">▼ ₹20.00</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">{t('market.mustard')}</span>
                <div className="text-right">
                  <span className="block font-bold">₹5,650</span>
                  <span className="text-[10px] text-outline font-bold">-- 0.00</span>
                </div>
              </div>
            </div>
          </section>

        </aside>
      </div>
      {/* Spacer for global AppShell BottomNav */}
      <div className="h-24 md:h-0" />
    </main>
  )
}
