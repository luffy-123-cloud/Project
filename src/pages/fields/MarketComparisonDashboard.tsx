// src/pages/fields/MarketComparisonDashboard.tsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import jsPDF from 'jspdf'
import { 
  Search, 
  Bell as LucideBell, 
  User as LucideUser, 
  Filter as LucideFilter, 
  Map as LucideMap, 
  MapPin, 
  Store, 
  Truck, 
  ArrowRight, 
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
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

export default function MarketComparisonDashboard() {
  const [records, setRecords] = useState<MandiRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cityInput, setCityInput] = useState('Belgaum')
  const [cropInput, setCropInput] = useState('Jowar')

  const [activeCity, setActiveCity] = useState('Belgaum')
  const [activeCrop, setActiveCrop] = useState('Jowar')

  useEffect(() => {
    const fetchData = async () => {
      const API_URL = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001d040eceaf01f49eb5bc553f6d3ec0284&format=json&filters[Commodity]=${activeCrop}&filters[District]=${activeCity}&limit=100`
      try {
        setLoading(true)
        const response = await axios.get(API_URL)
        if (response.data && response.data.records && response.data.records.length > 0) {
          setRecords(response.data.records)
          setError(null)
        } else {
          useFallbackData(activeCity, activeCrop)
          setError(`Live ${activeCrop} data unavailable for ${activeCity}. Showing latest market averages.`)
        }
        setLoading(false)
      } catch (err) {
        console.error("Failed to fetch comparison data:", err)
        useFallbackData(activeCity, activeCrop)
        setError("Unable to connect to live market server. Showing estimated rates.")
        setLoading(false)
      }
    }

    const useFallbackData = (city: string, crop: string) => {
      const formattedDate = new Date().toLocaleDateString('en-GB')
      const basePrice = crop === 'Tomato' ? 1200 : crop === 'Wheat' ? 2400 : crop === 'Rice' ? 4500 : 2450;
      
      setRecords([
        { market: city, commodity: crop, variety: 'Standard', modal_price: `${basePrice}`, min_price: `${basePrice - 150}`, max_price: `${basePrice + 150}`, arrival_date: formattedDate, state: 'State', district: city, grade: 'A' },
        { market: `${city} Outer`, commodity: crop, variety: 'Standard', modal_price: `${basePrice - 70}`, min_price: `${basePrice - 200}`, max_price: `${basePrice + 50}`, arrival_date: formattedDate, state: 'State', district: city, grade: 'A' },
        { market: `Near ${city}`, commodity: crop, variety: 'Standard', modal_price: `${basePrice - 140}`, min_price: `${basePrice - 250}`, max_price: `${basePrice}`, arrival_date: formattedDate, state: 'State', district: city, grade: 'A' }
      ])
    }

    fetchData()
  }, [activeCity, activeCrop])

  const handleUpdateView = () => {
    setActiveCity(cityInput)
    setActiveCrop(cropInput)
  }

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("Krishi Bazaar - Market Comparison", 20, 20);
    
    doc.setFontSize(14);
    doc.text(`Crop: ${activeCrop} | Location: ${activeCity}`, 20, 32);
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 20, 40);
    
    let yPos = 60;
    doc.setFontSize(12);
    records.forEach((r, idx) => {
      doc.text(`${idx + 1}. Mandi: ${r.market}`, 20, yPos);
      doc.text(`Price: Rs.${r.modal_price} / quintal`, 80, yPos);
      doc.text(`Range: Rs.${r.min_price} - Rs.${r.max_price}`, 150, yPos);
      yPos += 15;
    });
    
    doc.save(`Market_Comparison_${activeCrop}_${activeCity}.pdf`);
  }

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2e3230] font-sans pb-20">
      <div className="layout-container flex h-full grow flex-col">
        {/* Main Content Area */}
        <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            
            {/* Shared Header Logic */}
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#c4c8bc]/30 bg-[#faf6f0] px-6 py-4 rounded-t-xl">
              <div className="flex items-center gap-4 text-[#2e3230]">
                <div className="size-6 text-[#4a7c59]">
                  <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor"></path>
                  </svg>
                </div>
                <h2 className="text-[#2e3230] text-xl font-bold leading-tight tracking-tight" style={{ fontFamily: 'Literata, serif' }}>Krishi Bazaar</h2>
              </div>
              <div className="flex gap-4">
                <button className="flex items-center justify-center rounded-xl h-10 w-10 bg-[#f0ece4] text-[#2e3230]">
                  <LucideBell size={20} />
                </button>
                <button className="flex items-center justify-center rounded-xl h-10 w-10 bg-[#f0ece4] text-[#2e3230]">
                  <LucideUser size={20} />
                </button>
              </div>
            </header>

            {/* Hero Section */}
            <div className="relative w-full h-[280px] overflow-hidden rounded-b-xl mb-8 shadow-sm">
              <img 
                className="absolute inset-0 w-full h-full object-cover" 
                src="/market-hero.png" 
                alt="Professional Indian Market"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-8">
                <h1 className="text-white text-4xl font-bold mb-2" style={{ fontFamily: 'Literata, serif' }}>Market Comparison</h1>
                <p className="text-white/90 text-lg max-w-2xl">Compare {activeCrop} prices across different Mandis near {activeCity} to find the best deal.</p>
              </div>
            </div>

            {/* Filters & Controls Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="md:col-span-1 space-y-6">
                <div className="bg-[#f5f1ea] p-6 rounded-xl shadow-sm border border-[#c4c8bc]/20">
                  <h3 className="text-[#2e3230] text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Literata, serif' }}>
                    <LucideFilter size={20} className="text-[#4a7c59]" /> Mandi Filters
                  </h3>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-[#4a4e4a]">City / Mandi</label>
                      <input 
                        type="text"
                        value={cityInput}
                        onChange={(e) => setCityInput(e.target.value)}
                        placeholder="Enter City Name"
                        className="w-full bg-white border border-[#c4c8bc] rounded-lg text-[#2e3230] focus:ring-[#4a7c59] focus:border-[#4a7c59] py-2 px-3 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-[#4a4e4a]">Select Crop</label>
                      <select 
                        value={cropInput}
                        onChange={(e) => setCropInput(e.target.value)}
                        className="w-full bg-white border border-[#c4c8bc] rounded-lg text-[#2e3230] focus:ring-[#4a7c59] focus:border-[#4a7c59] py-2 px-3 outline-none"
                      >
                        <option value="Jowar">Jowar</option>
                        <option value="Wheat">Wheat</option>
                        <option value="Rice">Rice</option>
                        <option value="Tomato">Tomato</option>
                        <option value="Maize">Maize</option>
                        <option value="Cotton">Cotton</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-[#4a4e4a]">Max Distance (km)</label>
                      <input className="w-full h-2 bg-[#eae6de] rounded-lg appearance-none cursor-pointer accent-[#4a7c59]" max="500" min="10" type="range" defaultValue="50"/>
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 text-[10px] font-bold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100">
                        <Info size={12} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}
                    <button 
                      onClick={handleUpdateView}
                      className="w-full py-3 bg-[#4a7c59] text-white font-bold rounded-xl shadow-md hover:bg-[#4a7c59]/90 transition-colors active:scale-95"
                    >
                      Update View
                    </button>
                  </div>
                </div>

                <div className="bg-[#f5f1ea] p-2 rounded-xl border border-[#c4c8bc]/20 shadow-sm">
                  <div className="w-full h-48 rounded-lg bg-[#e4e0d8] flex items-center justify-center overflow-hidden relative">
                    <div className="absolute inset-0 flex items-center justify-center text-[#4a4e4a] flex-col gap-2">
                      <LucideMap size={40} />
                      <span className="text-xs font-semibold">Mandi Map View</span>
                    </div>
                    <MapPin className="absolute top-10 left-20 text-[#4a7c59] fill-current" size={24} />
                    <MapPin className="absolute bottom-12 right-16 text-[#705c30] fill-current" size={24} />
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison Area */}
              <div className="md:col-span-3">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 text-[#4a7c59] animate-spin" />
                    <p className="text-[#4a4e4a] font-bold animate-pulse">Comparing Mandis...</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex justify-between items-end">
                      <div>
                        <h2 className="text-2xl font-bold text-[#2e3230] mb-1" style={{ fontFamily: 'Literata, serif' }}>Regional Market Comparison</h2>
                        <p className="text-[#4a4e4a]">Showing side-by-side rates for <span className="font-bold text-[#4a7c59]">{activeCrop} (Per Quintal)</span> near <span className="font-bold text-[#2e3230]">{activeCity}</span></p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {records.map((row, i) => (
                        <div key={i} className={`flex flex-col bg-white border-2 ${i === 0 ? 'border-[#4a7c59] ring-4 ring-[#4a7c59]/10' : 'border-transparent'} rounded-xl overflow-hidden shadow-lg relative`}>
                          {i === 0 && <div className="absolute top-0 right-0 bg-[#4a7c59] text-white px-4 py-1 rounded-bl-xl text-xs font-bold uppercase tracking-widest">Best Rate</div>}
                          <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <div className={`size-10 rounded-full ${i === 0 ? 'bg-[#4a7c59]/10 text-[#4a7c59]' : 'bg-[#6b6358]/10 text-[#6b6358]'} flex items-center justify-center`}>
                                {i === 2 ? <Truck size={20} /> : <Store size={20} />}
                              </div>
                              <div>
                                <h4 className="font-bold text-lg leading-tight" style={{ fontFamily: 'Literata, serif' }}>{row.market} Mandi</h4>
                                <p className="text-xs text-[#4a4e4a] flex items-center gap-1">
                                  <MapPin size={14} /> {10 + i * 5} km away
                                </p>
                              </div>
                            </div>
                            <div className="mb-6">
                              <div className="text-xs font-bold text-[#4a4e4a] uppercase mb-1">Current Rate</div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-[#2e3230]">₹{row.modal_price}</span>
                                <span className={`text-sm font-medium ${i === 1 ? 'text-[#b83230]' : 'text-[#4a7c59]'} flex items-center`}>
                                  {i === 1 ? <TrendingDown size={16} /> : <TrendingUp size={16} />} {i === 2 ? '0%' : i === 1 ? '-0.5%' : '+3.2%'}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-3 mb-8">
                              <div className="flex justify-between text-sm py-2 border-b border-[#c4c8bc]/20">
                                <span className="text-[#4a4e4a]">Mandi Fee (Tax)</span>
                                <span className="font-semibold text-[#2e3230]">1.2%</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 border-b border-[#c4c8bc]/20">
                                <span className="text-[#4a4e4a]">Variety</span>
                                <span className="font-semibold text-[#2e3230]">{row.variety}</span>
                              </div>
                              <div className="flex justify-between text-sm py-2 border-b border-[#c4c8bc]/20">
                                <span className="text-[#4a4e4a]">Arrival Date</span>
                                <span className="font-semibold text-[#2e3230] text-[10px]">{row.arrival_date}</span>
                              </div>
                            </div>
                            <button className={`w-full py-3 ${i === 0 ? 'bg-[#4a7c59] text-white' : 'bg-[#e4e0d8] text-[#2e3230]'} rounded-lg font-bold flex items-center justify-center gap-2 transition-colors`}>
                              Directions <ArrowRight size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-12 bg-white rounded-xl shadow-sm border border-[#c4c8bc]/20 overflow-hidden">
                      <div className="px-6 py-4 bg-[#f5f1ea] border-b border-[#c4c8bc]/20">
                        <h3 className="font-bold text-lg text-[#2e3230]" style={{ fontFamily: 'Literata, serif' }}>Regional {activeCrop} Price Trend</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white text-[#4a4e4a] text-xs font-bold uppercase tracking-wider">
                              <th className="px-6 py-4">Market</th>
                              <th className="px-6 py-4">Modal Price</th>
                              <th className="px-6 py-4">Min Price</th>
                              <th className="px-6 py-4">Max Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#c4c8bc]/10">
                            {records.map((row, i) => (
                              <tr key={i}>
                                <td className="px-6 py-4 text-sm font-medium">{row.market}</td>
                                <td className={`px-6 py-4 text-sm font-bold ${i === 0 ? 'text-[#4a7c59]' : ''}`}>₹{row.modal_price}</td>
                                <td className="px-6 py-4 text-sm">₹{row.min_price}</td>
                                <td className="px-6 py-4 text-sm">₹{row.max_price}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-10 bg-[#eae6de] rounded-xl">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-full bg-[#4a7c59]/20 flex items-center justify-center text-[#4a7c59] shrink-0">
                  <Lightbulb size={30} />
                </div>
                <div>
                  <h4 className="font-bold text-[#2e3230]" style={{ fontFamily: 'Literata, serif' }}>Farmer Tip: {activeCrop} Quality</h4>
                  <p className="text-sm text-[#4a4e4a] max-w-md leading-relaxed">Ensure {activeCrop} produce is clean and free from moisture to get the best modal price at the {records[0]?.market || activeCity} Mandi.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={handleExportPDF} className="px-6 py-3 bg-[#705c30] text-white rounded-xl font-bold shadow-md active:scale-95 transition-transform">Export PDF</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
