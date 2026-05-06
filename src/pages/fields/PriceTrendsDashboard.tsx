// src/pages/fields/PriceTrendsDashboard.tsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Search, 
  Bell, 
  User, 
  ChevronRight,
  BrainCircuit,
  ArrowUp,
  ArrowDown,
  Minus,
  Info,
  Loader2
} from 'lucide-react'

interface PriceRecord {
  state: string
  district: string
  market: string
  commodity: string
  variety: string
  grade: string
  arrival_date: string
  min_price: string
  max_price: string
  modal_price: string
}

export default function PriceTrendsDashboard() {
  const [records, setRecords] = useState<PriceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001d040eceaf01f49eb5bc553f6d3ec0284&format=json&filters[Commodity]=Jowar&filters[Market]=Belagavi&limit=500"

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await axios.get(API_URL)
        if (response.data && response.data.records && response.data.records.length > 0) {
          // The API returns historical records. Sort by date if needed.
          setRecords(response.data.records)
          setError(null)
        } else {
          useFallbackData()
          setError("Live Jowar trends for Belagavi currently unavailable. Showing historical market averages.")
        }
        setLoading(false)
      } catch (err) {
        console.error("Failed to fetch price trends:", err)
        useFallbackData()
        setError("Unable to connect to market trend server. Showing estimated data.")
        setLoading(false)
      }
    }

    const useFallbackData = () => {
      setRecords([
        { arrival_date: '06/05/2026', modal_price: '2450', min_price: '2300', max_price: '2600', market: 'Belagavi', commodity: 'Jowar', variety: 'Hybrid', grade: 'A', state: 'Karnataka', district: 'Belagavi' },
        { arrival_date: '05/05/2026', modal_price: '2410', min_price: '2280', max_price: '2550', market: 'Belagavi', commodity: 'Jowar', variety: 'Hybrid', grade: 'A', state: 'Karnataka', district: 'Belagavi' },
        { arrival_date: '04/05/2026', modal_price: '2425', min_price: '2310', max_price: '2580', market: 'Belagavi', commodity: 'Jowar', variety: 'Hybrid', grade: 'A', state: 'Karnataka', district: 'Belagavi' },
        { arrival_date: '03/05/2026', modal_price: '2380', min_price: '2250', max_price: '2500', market: 'Belagavi', commodity: 'Jowar', variety: 'Hybrid', grade: 'A', state: 'Karnataka', district: 'Belagavi' },
      ])
    }

    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2e3230] font-sans pb-20">
      <div className="layout-container flex h-full grow flex-col">
        {/* Main Content Area */}
        <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            
            {/* Header */}
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#c4c8bc]/30 bg-[#faf6f0] px-6 py-4 rounded-t-xl">
              <div className="flex items-center gap-4 text-[#2e3230]">
                <div className="size-6 text-[#4a7c59]">
                  <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path d="M36.7273 44C33.9891 44 31.6043 39.8386 30.3636 33.69C29.123 39.8386 26.7382 44 24 44C21.2618 44 18.877 39.8386 17.6364 33.69C16.3957 39.8386 14.0109 44 11.2727 44C7.25611 44 4 35.0457 4 24C4 12.9543 7.25611 4 11.2727 4C14.0109 4 16.3957 8.16144 17.6364 14.31C18.877 8.16144 21.2618 4 24 4C26.7382 4 29.123 8.16144 30.3636 14.31C31.6043 8.16144 33.9891 4 36.7273 4C40.7439 4 44 12.9543 44 24C44 35.0457 40.7439 44 36.7273 44Z" fill="currentColor"></path>
                  </svg>
                </div>
                <h2 className="text-[#2e3230] text-lg font-bold leading-tight" style={{ fontFamily: 'Literata, serif' }}>AgriTrend AI</h2>
              </div>
              <div className="flex flex-1 justify-end gap-4">
                <div className="hidden md:flex items-center bg-[#f0ece4] rounded-xl px-4 py-2 w-64 border border-[#c4c8bc]/30">
                  <Search size={18} className="text-[#4a4e4a]" />
                  <input className="bg-transparent border-none focus:ring-0 text-sm ml-2 w-full" placeholder="Search markets..." />
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center justify-center rounded-xl h-10 w-10 bg-[#f0ece4] text-[#2e3230]">
                    <Bell size={20} />
                  </button>
                  <button className="flex items-center justify-center rounded-xl h-10 w-10 bg-[#f0ece4] text-[#2e3230]">
                    <User size={20} />
                  </button>
                </div>
              </div>
            </header>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 px-6 py-4 text-sm text-[#4a4e4a]">
              <span>Market Analysis</span>
              <ChevronRight size={14} />
              <span className="font-bold text-[#2e3230]">Jowar Trends (Belagavi)</span>
            </div>

            {/* Title & Description */}
            <div className="px-6 mb-8">
              <h1 className="text-4xl font-black text-[#2e3230] mb-2" style={{ fontFamily: 'Literata, serif' }}>Jowar Price Trends</h1>
              <p className="text-[#4a4e4a] text-lg max-w-2xl">Historical data and AI-driven market forecasts for Jowar in Belagavi market.</p>
            </div>

            {/* View Selectors */}
            <div className="px-6 mb-6">
              <div className="flex border-b border-[#c4c8bc]/30 gap-8">
                {['Line Analysis', 'Volume Bar', 'Historical Table'].map((tab, i) => (
                  <button key={tab} className={`pb-4 pt-2 text-sm font-bold border-b-2 transition-colors ${i === 0 ? 'border-[#4a7c59] text-[#2e3230]' : 'border-transparent text-[#4a4e4a]'}`}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-[#4a7c59] animate-spin" />
                <p className="text-[#4a4e4a] font-bold animate-pulse">Analyzing Market Trends...</p>
              </div>
            ) : (
              <>
                {/* Time Period Selectors */}
                <div className="flex gap-3 px-6 mb-8 overflow-x-auto">
                  {['Weekly', 'Monthly', 'Yearly', '5-Year'].map((period, i) => (
                    <button key={period} className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${i === 0 ? 'bg-[#4a7c59] text-white shadow-md shadow-[#4a7c59]/20' : 'bg-[#f0ece4] text-[#2e3230] hover:bg-[#e4e0d8]'}`}>
                      {period}
                    </button>
                  ))}
                </div>

                {/* Main Dashboard Grid */}
                <main className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-6">
                  <div className="lg:col-span-2 flex flex-col gap-8">
                    <section className="bg-white rounded-2xl p-8 shadow-[0_4px_20px_rgba(46,50,48,0.06)] border border-[#c4c8bc]/20">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold text-[#2e3230]" style={{ fontFamily: 'Literata, serif' }}>Belagavi Jowar Price Trend (₹/Quintal)</h3>
                        <div className="flex gap-4">
                          <span className="flex items-center gap-2 text-xs font-bold text-[#4a7c59]">
                            <span className="w-3 h-3 rounded-full bg-[#4a7c59]"></span> Modal Price
                          </span>
                        </div>
                      </div>
                      
                      <div className="relative h-72 w-full rounded-xl overflow-hidden bg-[linear-gradient(to_right,#e4e0d8_1px,transparent_1px),linear-gradient(to_bottom,#e4e0d8_1px,transparent_1px)] bg-[size:40px_40px]">
                        <svg className="absolute inset-0 w-full h-full drop-shadow-sm" viewBox="0 0 800 250">
                          <path d="M0,180 Q100,160 200,190 T400,140 T600,160 T800,100 L800,250 L0,250 Z" fill="url(#grad1)" fillOpacity="0.1"></path>
                          <path d="M0,180 Q100,160 200,190 T400,140 T600,160 T800,100" fill="none" stroke="#4a7c59" strokeLinecap="round" strokeWidth="4"></path>
                          <path d="M800,100 Q850,80 900,90" fill="none" stroke="#705c30" strokeDasharray="8 4" strokeWidth="3"></path>
                          <defs>
                            <linearGradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
                              <stop offset="0%" style={{ stopColor: '#4a7c59', stopOpacity: 1 }}></stop>
                              <stop offset="100%" style={{ stopColor: '#4a7c59', stopOpacity: 0 }}></stop>
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute left-[50%] top-[140px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                          <div className="w-4 h-4 rounded-full bg-white border-4 border-[#4a7c59] shadow-lg"></div>
                          <div className="mt-2 bg-[#2e3230] text-white text-[11px] px-3 py-1.5 rounded-lg font-bold">₹{records[0]?.modal_price}</div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between mt-6 text-xs font-bold text-[#4a4e4a] uppercase tracking-widest">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}
                      </div>
                    </section>

                    <section className="bg-white rounded-2xl p-8 shadow-[0_4px_20px_rgba(46,50,48,0.06)] border border-[#c4c8bc]/20">
                      <h3 className="text-xl font-bold text-[#2e3230] mb-8" style={{ fontFamily: 'Literata, serif' }}>Market Arrivals Volume</h3>
                      <div className="flex items-end justify-between h-40 gap-3">
                        {[40, 65, 55, 85, 45, 70, 90, 60, 30, 75, 50, 40].map((h, i) => (
                          <div key={i} className="bg-[#4a7c59]/20 hover:bg-[#4a7c59] transition-all cursor-pointer w-full rounded-t-lg" style={{ height: `${h}%` }}></div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="flex flex-col gap-8">
                    <section className="bg-[#78a886]/10 border border-[#78a886]/30 rounded-2xl p-8 relative overflow-hidden">
                      <div className="absolute -top-4 -right-4 opacity-5 text-[#4a7c59]">
                        <BrainCircuit size={120} />
                      </div>
                      <h3 className="text-lg font-bold text-[#002110] mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                        Market Guidance
                      </h3>
                      <div className="mt-4 mb-6">
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#4a7c59] text-white font-bold text-xs mb-4 uppercase tracking-widest shadow-md shadow-[#4a7c59]/20">
                          SELL SOON
                        </div>
                        <p className="text-[#2e3230] font-bold text-xl mb-2" style={{ fontFamily: 'Literata, serif' }}>Price Peak Warning</p>
                        <p className="text-[#4a4e4a] text-sm leading-relaxed">
                          Jowar prices in Belagavi have risen by 10% this week. Current trends suggest prices may stabilize or dip slightly as new harvests arrive.
                        </p>
                      </div>
                      <button className="w-full py-4 bg-[#705c30] text-white rounded-xl font-bold text-sm tracking-wide transition-all active:scale-95 hover:shadow-xl hover:-translate-y-0.5">
                        Alert for Price Drop
                      </button>
                    </section>

                    <section className="bg-[#f0ece4] rounded-2xl p-8 border border-[#c4c8bc]/20">
                      <h3 className="text-lg font-bold text-[#2e3230] mb-6" style={{ fontFamily: 'Literata, serif' }}>Belagavi Stats</h3>
                      <div className="space-y-5">
                        <div className="flex justify-between items-center pb-4 border-b border-[#c4c8bc]/20">
                          <span className="text-sm font-semibold text-[#4a4e4a]">24h Change</span>
                          <span className="text-sm font-bold text-[#4a7c59] flex items-center gap-1">
                            <ArrowUp size={14} /> 1.2%
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-[#c4c8bc]/20">
                          <span className="text-sm font-semibold text-[#4a4e4a]">Avg Volatility</span>
                          <span className="text-sm font-bold text-[#2e3230]">Moderate (2.4%)</span>
                        </div>
                        {error && (
                          <div className="flex items-start gap-2 text-[10px] font-bold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100">
                            <Info size={14} className="shrink-0" />
                            <span>{error}</span>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-2xl overflow-hidden shadow-lg relative group h-56">
                      <img 
                        alt="Jowar fields" 
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                        src="/wheat-trends.png" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                        <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-1">Local Harvest</p>
                        <p className="text-white font-bold text-xl leading-tight" style={{ fontFamily: 'Literata, serif' }}>Belagavi Jowar Update</p>
                      </div>
                    </section>
                  </div>
                </main>

                <section className="px-6 py-12">
                  <div className="bg-white rounded-2xl border border-[#c4c8bc]/20 overflow-hidden shadow-sm">
                    <div className="px-8 py-6 border-b border-[#c4c8bc]/20 flex justify-between items-center bg-[#f5f1ea]">
                      <h3 className="font-bold text-lg text-[#2e3230]" style={{ fontFamily: 'Literata, serif' }}>Daily Price History (Belagavi)</h3>
                      <button className="text-[#4a7c59] text-sm font-bold flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-[#c4c8bc]/30 hover:bg-[#faf6f0] transition-colors">
                        <Download size={16} /> Export Trend Report
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#f0ece4]/30 text-[#4a4e4a] text-xs font-bold uppercase tracking-widest">
                            <th className="px-8 py-5">Date</th>
                            <th className="px-8 py-5">Modal Price (₹)</th>
                            <th className="px-8 py-5">Min Price (₹)</th>
                            <th className="px-8 py-5">Max Price (₹)</th>
                            <th className="px-8 py-5 text-right">Trend</th>
                          </tr>
                        </thead>
                        <tbody className="text-[#2e3230] text-sm font-semibold">
                          {records.map((row, i) => (
                            <tr key={i} className="border-b border-[#c4c8bc]/10 hover:bg-[#faf6f0] transition-colors">
                              <td className="px-8 py-5">{row.arrival_date}</td>
                              <td className="px-8 py-5 font-bold">₹{row.modal_price}</td>
                              <td className="px-8 py-5 text-[#4a4e4a]">₹{row.min_price}</td>
                              <td className="px-8 py-5 text-[#4a4e4a]">₹{row.max_price}</td>
                              <td className="px-8 py-5 text-right">
                                {i < records.length - 1 && parseInt(row.modal_price) > parseInt(records[i+1].modal_price) ? 
                                  <TrendingUp size={18} className="text-[#4a7c59] ml-auto" /> : 
                                  parseInt(row.modal_price) < parseInt(records[i+1]?.modal_price) ?
                                  <TrendingDown size={18} className="text-[#b83230] ml-auto" /> :
                                  <Minus size={18} className="text-[#4a4e4a] ml-auto" />
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
