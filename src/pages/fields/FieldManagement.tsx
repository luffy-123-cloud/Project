// src/pages/fields/FieldManagement.tsx
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, BarChart3, MapPin, BadgeDollarSign, ChevronRight, Store } from 'lucide-react'

export default function FieldManagement() {
  const navigate = useNavigate()
  const sections = [
    {
      id: 'live-price',
      title: 'Live Market Price',
      subtitle: 'Real-time Mandi rates for your crops',
      icon: <BadgeDollarSign className="text-emerald-600" size={24} />,
      gradient: 'from-emerald-50 to-teal-50',
      borderColor: 'border-emerald-100',
      path: '/fields/live-market',
    },
    {
      id: 'comparison',
      title: 'Market Comparison',
      subtitle: 'Compare prices across different Mandis',
      icon: <BarChart3 className="text-blue-600" size={24} />,
      gradient: 'from-blue-50 to-indigo-50',
      borderColor: 'border-blue-100',
      path: '/fields/comparison',
    },
    {
      id: 'trends',
      title: 'Crop-wise Price Trends',
      subtitle: 'Analyze historical price movements',
      icon: <TrendingUp className="text-purple-600" size={24} />,
      gradient: 'from-purple-50 to-pink-50',
      borderColor: 'border-purple-100',
      path: '/fields/trends',
    },
    {
      id: 'locator',
      title: 'Nearby Market Locator',
      subtitle: 'Find Mandis and collection centers near you',
      icon: <MapPin className="text-orange-600" size={24} />,
      gradient: 'from-orange-50 to-amber-50',
      borderColor: 'border-orange-100',
      path: '/fields/locator',
    },
  ]

  return (
    <div className="min-h-screen bg-neutral-50/50 pb-20">
      <div className="px-5 py-8 space-y-6 max-w-2xl mx-auto w-full">
        {/* Header Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-brand-600 mb-1">
            <Store size={20} />
            <span className="text-xs font-bold tracking-widest uppercase">Mandi Insights</span>
          </div>
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
            Market Dashboard
          </h1>
          <p className="text-neutral-500 text-sm leading-relaxed">
            Get the best value for your harvest with real-time market data and intelligence.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 gap-4">
          {sections.map((section, idx) => (
            <motion.div
              key={section.id}
              onClick={() => section.path && navigate(section.path)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className={`group relative overflow-hidden rounded-3xl border ${section.borderColor} bg-white p-1 cursor-pointer hover:shadow-xl hover:shadow-neutral-200/50 transition-all duration-300`}
            >
              <div className={`rounded-[22px] bg-gradient-to-br ${section.gradient} p-5 flex items-center justify-between`}>
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-white group-hover:scale-110 transition-transform duration-300">
                    {section.icon}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-neutral-900 group-hover:text-brand-700 transition-colors">
                      {section.title}
                    </h3>
                    <p className="text-xs text-neutral-500 font-medium leading-tight max-w-[180px]">
                      {section.subtitle}
                    </p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                  <ChevronRight size={20} className="text-neutral-400 group-hover:text-brand-600 transition-colors" />
                </div>
              </div>

              {/* Subtle background decoration */}
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
            </motion.div>
          ))}
        </div>

        {/* Footer/Helper Section */}
        <div className="pt-4 px-2">
          <div className="p-4 rounded-2xl bg-brand-50 border border-brand-100 flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-brand-700" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-brand-900 uppercase tracking-wider">Pro Tip</p>
              <p className="text-sm text-brand-800 leading-relaxed">
                Prices are typically updated at 11:00 AM daily across major Mandis. Enable notifications for instant alerts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

