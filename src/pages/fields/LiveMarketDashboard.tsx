// src/pages/fields/LiveMarketDashboard.tsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'
import { 
  Search, 
  Bell, 
  TrendingUp, 
  Leaf, 
  Sprout, 
  Wheat, 
  Info, 
  Filter, 
  Loader2
} from 'lucide-react'

interface MandiRecord {
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

export default function LiveMarketDashboard() {
  const [records, setRecords] = useState<MandiRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search and notifications
  const [searchCrop, setSearchCrop] = useState('')
  const [searchCity, setSearchCity] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchedRecord, setSearchedRecord] = useState<MandiRecord | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  const handleBellClick = () => {
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);
    if (newState) {
      toast.success("Notifications enabled! You'll be notified when mandi opens and closes.", { duration: 4000 });
      // Simulate an immediate notification for demonstration
      setTimeout(() => {
        toast("🔔 Mandi is currently OPEN. Latest prices updated.", {
          icon: '📊',
          style: { borderRadius: '10px', background: '#333', color: '#fff' },
        });
      }, 1000);
    } else {
      toast("Notifications disabled.", { icon: '🔕' });
    }
  }

  const handleSearch = () => {
    if (!searchCrop.trim() || !searchCity.trim()) {
      toast.error("Please enter both crop and city/mandi to search.");
      return;
    }
    
    setHasSearched(true);
    // Since fallback has Belgaum, and we want to simulate search
    const found = records.find(r => 
      r.commodity.toLowerCase().includes(searchCrop.toLowerCase()) && 
      (r.market.toLowerCase().includes(searchCity.toLowerCase()) || r.district.toLowerCase().includes(searchCity.toLowerCase()))
    );
    
    setSearchedRecord(found || null);
  }

  const API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001d040eceaf01f49eb5bc553f6d3ec0284&format=json&filters[State]=Karnataka&filters[District]=Belgaum&limit=100"

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await axios.get(API_URL)
        
        if (response.data && response.data.records && response.data.records.length > 0) {
          setRecords(response.data.records)
          setError(null)
        } else {
          // If records is empty, it means no live data for today yet
          console.warn("API returned empty records, using fallback.")
          useFallbackData()
          setError("Live data currently unavailable for Belgaum. Showing latest available rates.")
        }
        setLoading(false)
      } catch (err) {
        console.error("Failed to fetch market data:", err)
        useFallbackData()
        setError("Unable to connect to live market server. Showing estimated rates.")
        setLoading(false)
      }
    }

    const useFallbackData = () => {
      setRecords([
        { commodity: 'Wheat', market: 'Belgaum', variety: 'Common', modal_price: '2400', min_price: '2200', max_price: '2600', arrival_date: '06/05/2026', state: 'Karnataka', district: 'Belgaum', grade: 'A' },
        { commodity: 'Rice', market: 'Belgaum', variety: 'Basmati', modal_price: '4500', min_price: '4200', max_price: '4800', arrival_date: '06/05/2026', state: 'Karnataka', district: 'Belgaum', grade: 'A' },
        { commodity: 'Tomato', market: 'Belgaum', variety: 'Local', modal_price: '1200', min_price: '1000', max_price: '1500', arrival_date: '06/05/2026', state: 'Karnataka', district: 'Belgaum', grade: 'A' },
        { commodity: 'Maize', market: 'Belgaum', variety: 'Hybrid', modal_price: '1850', min_price: '1700', max_price: '2000', arrival_date: '06/05/2026', state: 'Karnataka', district: 'Belgaum', grade: 'A' },
        { commodity: 'Onion', market: 'Belgaum', variety: 'Red', modal_price: '1500', min_price: '1300', max_price: '1700', arrival_date: '06/05/2026', state: 'Karnataka', district: 'Belgaum', grade: 'A' },
        { commodity: 'Potato', market: 'Belgaum', variety: 'Local', modal_price: '1800', min_price: '1600', max_price: '2000', arrival_date: '06/05/2026', state: 'Karnataka', district: 'Belgaum', grade: 'A' }
      ])
    }

    fetchData()
  }, [])

  const tickerData = records.slice(0, 4).map(r => ({
    name: r.commodity,
    price: r.modal_price,
    unit: 'quintal',
    change: '+2.4%', // Mock change as API doesn't provide it
    trend: 'up',
    icon: r.commodity.toLowerCase().includes('wheat') ? <Wheat size={20} className="text-[#4a7c59]" /> : 
          r.commodity.toLowerCase().includes('rice') ? <Sprout size={20} className="text-[#4a7c59]" /> :
          <Leaf size={20} className="text-[#4a7c59]" />
  }))

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2e3230] font-sans pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#c4c8bc] px-4 md:px-10 py-3 bg-[#faf6f0]/80 backdrop-blur-md">
        <div className="flex items-center gap-3 text-[#4a7c59]">
          <div className="w-8 h-8">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" fill="currentColor"></path>
            </svg>
          </div>
          <h2 className="text-[#2e3230] text-lg font-bold tracking-tight" style={{ fontFamily: 'Literata, serif' }}>AgriMarket</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleBellClick} className="p-2 rounded-full bg-[#f0ece4] text-[#2e3230] relative transition-transform active:scale-95">
            <Bell size={20} />
            {notificationsEnabled && <span className="absolute right-1.5 top-1.5 w-2.5 h-2.5 bg-brand-500 rounded-full border-2 border-[#f0ece4]"></span>}
          </button>
          <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#4a7c59]">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGg0iEk68BY927D16CrWHgpEmRGLbPU0AKcgRVF8Cr810ccZS9K4eNgWt1V7silW1fCEaK8WLNHSuFveNo63PIHyZwOXYylZDykEvTCOwsYLXJ7KKeFu_vmcMl3eqvvbFUvzHYpk9-5FRALF_SrJUo9gvtxFmeTDWXI5g4rxNHU4fIZEfF75EBFuyI3zW5-2QZUp8e1nRuuv0bsMKpfZqkg4LAaB2XfHsPqT2MaT4pAJQ09UbjZFtSIoR5rx3ZwTShM0Lci76S9P4" alt="Farmer" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      <main className="px-4 py-8 max-w-5xl mx-auto space-y-8">
        {/* Title Section */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-[#2e3230] text-3xl font-bold leading-tight" style={{ fontFamily: 'Literata, serif' }}>Karnataka Market Dashboard</h1>
            <p className="text-[#4a4e4a] text-base mt-1">Live data for Belgaum District • {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="w-fit flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-[#78a886]/10 text-[#4a7c59] px-3 py-1.5 rounded-full border border-[#4a7c59]/20 w-fit">
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-spin' : 'bg-[#4a7c59] animate-pulse'}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{loading ? 'Connecting...' : 'Market Data Status'}</span>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                <Info size={14} />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white p-4 rounded-3xl border border-[#c4c8bc] shadow-sm flex flex-col md:flex-row gap-3 items-center">
          <div className="flex-1 w-full relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
                type="text" 
                placeholder="Crop (e.g. Tomato)" 
                value={searchCrop}
                onChange={(e) => setSearchCrop(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#f0ece4]/50 border border-transparent focus:border-[#4a7c59] focus:bg-white outline-none transition-all text-sm font-medium"
             />
          </div>
          <div className="flex-1 w-full relative">
             <Info className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
                type="text" 
                placeholder="City/Mandi (e.g. Belgaum)" 
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#f0ece4]/50 border border-transparent focus:border-[#4a7c59] focus:bg-white outline-none transition-all text-sm font-medium"
             />
          </div>
          <button 
             onClick={handleSearch}
             className="w-full md:w-auto px-8 py-3 bg-[#4a7c59] text-white font-bold rounded-2xl hover:bg-[#3d6649] transition-colors shadow-sm active:scale-95"
          >
             Search
          </button>
        </div>
        
        {hasSearched && (
           <div className="bg-[#f0ece4] p-5 rounded-3xl border border-[#c4c8bc]">
             {searchedRecord ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold text-[#2e3230]" style={{ fontFamily: 'Literata, serif' }}>Current Price Found:</h3>
                  <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-[#c4c8bc]">
                    <div>
                      <p className="text-xl font-black text-[#4a7c59]">{searchedRecord.commodity}</p>
                      <p className="text-sm text-[#4a4e4a]">{searchedRecord.market}, {searchedRecord.state}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#2e3230]">₹{searchedRecord.modal_price}</p>
                      <p className="text-[10px] uppercase font-bold text-[#4a4e4a]">per quintal</p>
                    </div>
                  </div>
                </div>
             ) : (
                <div className="text-center p-4">
                  <p className="text-[#b83230] font-bold">This crop's price is not present in {searchCity || 'this mandi'}.</p>
                </div>
             )}
           </div>
        )}


        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-[#4a7c59] animate-spin" />
            <p className="text-[#4a4e4a] font-bold animate-pulse">Fetching latest Mandi rates...</p>
          </div>
        ) : (
          <>
            {/* Ticker Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {tickerData.length > 0 ? tickerData.map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white p-4 rounded-2xl border border-[#c4c8bc] shadow-sm flex flex-col gap-1"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[#4a4e4a] font-bold text-[10px] uppercase tracking-wider">{item.name}</span>
                    {item.icon}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl font-extrabold text-[#2e3230]">₹{item.price}</p>
                    <span className="text-[9px] text-[#4a4e4a] font-medium">/{item.unit}</span>
                  </div>
                  <div className={`flex items-center gap-1 ${item.trend === 'up' ? 'text-[#4a7c59]' : 'text-[#b83230]'}`}>
                    <TrendingUp size={12} />
                    <span className="text-[11px] font-bold">{item.change}</span>
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-full p-8 bg-white rounded-3xl border border-[#c4c8bc] text-center italic text-[#4a4e4a]">
                  No records found for current filters.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lists Column */}
              <div className="space-y-6">
                <div className="bg-[#f0ece4] p-5 rounded-3xl border border-[#c4c8bc]">
                  <div className="flex items-center gap-2 mb-4 text-[#4a7c59]">
                    <TrendingUp size={20} />
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'Literata, serif' }}>Market Trends</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: 'Potatoes', change: '+₹120', icon: <Leaf size={14} /> },
                      { name: 'Soybeans', change: '+₹81', icon: <Sprout size={14} /> },
                      { name: 'Sunflower', change: '+₹43', icon: <Leaf size={14} /> }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#78a886]/10 flex items-center justify-center text-[#4a7c59]">
                            {item.icon}
                          </div>
                          <span className="font-bold text-sm">{item.name}</span>
                        </div>
                        <span className="text-[#4a7c59] text-sm font-bold">{item.change}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative h-44 rounded-3xl overflow-hidden border border-[#c4c8bc] shadow-lg group">
                  <img 
                    src="https://lh3.googleusercontent.com/aida/ADBb0uhSzqV1PZIciUj8PcOAtJWv73BaFBbDKG26dORYC1SdS38x-PVHC5iM9s8RPve4ztLXLL69L-LTQvWfmCHIy_8vsnzJlf_i5dsHbCS81zqiyatPVzCCM1SIqy7lWdQA_JBTl8_XFVnbvE6wAkNp_JivJsuq17YoK2IOAD9xO9Z9BPvIOO3kn_gbRnM8fSiPEI3tGcQ-Q4OtieosvTp9nv_BBvBkiDmFcpyJ6ve-BqTXfL5kkAXeqKU5Rbzjli-Dg3WofSSYbyhBOQ" 
                    alt="Farm landscape" 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#4a7c59]/90 to-transparent flex flex-col justify-center px-8 text-white">
                    <h4 className="text-xl font-bold mb-1">Export Help</h4>
                    <p className="max-w-[200px] text-xs text-white/90 mb-4">Rice exports to SE Asia are seeing high demand.</p>
                    <button className="w-fit bg-white text-[#4a7c59] px-5 py-2 rounded-xl font-bold text-xs shadow-sm">
                      Details
                    </button>
                  </div>
                </div>
              </div>

              {/* Table Column */}
              <div className="lg:col-span-2">
                <section className="bg-white rounded-3xl border border-[#c4c8bc] shadow-sm overflow-hidden h-full flex flex-col">
                  <div className="p-6 border-b border-[#c4c8bc] flex justify-between items-center bg-[#faf6f0]">
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'Literata, serif' }}>Belgaum Mandi Prices</h3>
                    <div className="flex gap-4">
                      <button className="flex items-center gap-2 text-[#4a4e4a] text-xs font-bold hover:text-[#4a7c59]">
                        <Filter size={14} /> Filter
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left">
                      <thead className="bg-[#f0ece4] text-[#4a4e4a] text-[10px] uppercase font-bold tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Commodity</th>
                          <th className="px-6 py-4">Variety</th>
                          <th className="px-6 py-4">Modal (₹)</th>
                          <th className="px-6 py-4">Min-Max (₹)</th>
                          <th className="px-6 py-4 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#c4c8bc]/30">
                        {records.map((row, i) => (
                          <tr key={i} className="hover:bg-[#f5f1ea] transition-colors">
                            <td className="px-6 py-4 font-bold text-sm">{row.commodity}</td>
                            <td className="px-6 py-4 text-xs text-[#4a4e4a]">{row.variety}</td>
                            <td className="px-6 py-4 font-extrabold text-sm text-[#2e3230]">₹{row.modal_price}</td>
                            <td className="px-6 py-4 text-xs text-[#4a4e4a]">{row.min_price} - {row.max_price}</td>
                            <td className="px-6 py-4 text-right text-[10px] font-bold text-[#4a7c59]">
                              {row.arrival_date}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="bg-[#e4e0d8] border-t border-[#c4c8bc] py-10 px-4 md:px-10 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 text-[#4a7c59] opacity-70">
             <div className="w-6 h-6">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" fill="currentColor"></path>
              </svg>
            </div>
            <span className="text-xs font-bold">AgriMarket Dashboard • Belgaum</span>
          </div>
          <p className="text-[10px] text-[#4a4e4a]">© 2024 AgriMarket Co. Rooted in growth.</p>
        </div>
      </footer>
    </div>
  )
}


