// src/pages/fields/MarketLocatorDashboard.tsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { 
  Search, 
  Bell, 
  User, 
  MapPin, 
  Navigation, 
  TrendingUp, 
  ChevronRight,
  Info,
  Loader2
} from 'lucide-react'

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MarketRecord {
  market: string
  district: string
  state: string
  commodity: string
  modal_price: string
  lat?: number
  lng?: number
}

// Helper to center map
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function MarketLocatorDashboard() {
  const [markets, setMarkets] = useState<MarketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [center] = useState<[number, number]>([15.8, 74.75]) // Centered around Belgaum-Kittur-Dharwad
  const [zoom] = useState(9)

  const mandiCoordinates: Record<string, { lat: number, lng: number }> = {
    'Belagavi': { lat: 15.8497, lng: 74.4977 },
    'Belgaum': { lat: 15.8497, lng: 74.4977 },
    'Kittur': { lat: 15.5975, lng: 74.7892 },
    'Raibag': { lat: 16.4833, lng: 74.8333 },
    'Khanapur': { lat: 15.6333, lng: 74.5167 },
    'Haliyal': { lat: 15.3333, lng: 74.7667 },
    'Hubli': { lat: 15.3647, lng: 75.1240 },
    'Hubballi (Amaragol)': { lat: 15.3647, lng: 75.1240 },
    'Dharwad': { lat: 15.4589, lng: 75.0078 },
    'Bailhongal': { lat: 15.8181, lng: 74.8541 },
    'Saundatti': { lat: 15.7743, lng: 75.1147 },
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetching records for Karnataka
        const API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001d040eceaf01f49eb5bc553f6d3ec0284&format=json&filters[State]=Karnataka&limit=1000"
        
        const response = await axios.get(API_URL)
        if (response.data && response.data.records && response.data.records.length > 0) {
          const targetMarkets = ['Belagavi', 'Belgaum', 'Kittur', 'Raibag', 'Khanapur', 'Haliyal', 'Dharwad', 'Hubli', 'Bailhongal']
          
          const processed = response.data.records.reduce((acc: MarketRecord[], curr: any) => {
            const isTarget = targetMarkets.some(tm => curr.market.includes(tm))
            // Explicitly excluding Raichur
            const isRaichur = curr.market.includes('Raichur')

            if (isTarget && !isRaichur && !acc.find(m => m.market === curr.market)) {
              const coords = mandiCoordinates[curr.market] || 
                             Object.entries(mandiCoordinates).find(([k]) => curr.market.includes(k))?.[1] ||
                             { lat: 15.8 + (Math.random() - 0.5) * 1, lng: 74.75 + (Math.random() - 0.5) * 1 }

              acc.push({
                market: curr.market,
                district: curr.district,
                state: curr.state,
                commodity: curr.commodity,
                modal_price: curr.modal_price,
                ...coords
              })
            }
            return acc
          }, [])
          
          if (processed.length > 0) {
            setMarkets(processed)
            setError(null)
          } else {
            useFallbackData()
          }
        } else {
          useFallbackData()
        }
        setLoading(false)
      } catch (err) {
        console.error("Failed to fetch market list:", err)
        useFallbackData()
        setError("Network busy. Showing local Belgaum-region hubs.")
        setLoading(false)
      }
    }

    const useFallbackData = () => {
      const fallback = [
        { market: 'Belagavi APMC', district: 'Belgaum', state: 'Karnataka', commodity: 'Jowar', modal_price: '2450', lat: 15.8497, lng: 74.4977 },
        { market: 'Kittur Mandi', district: 'Belgaum', state: 'Karnataka', commodity: 'Jowar', modal_price: '2350', lat: 15.5975, lng: 74.7892 },
        { market: 'Raibag Mandi', district: 'Belgaum', state: 'Karnataka', commodity: 'Cotton', modal_price: '7100', lat: 16.4833, lng: 74.8333 },
        { market: 'Khanapur Mandi', district: 'Belgaum', state: 'Karnataka', commodity: 'Sugarcane', modal_price: '3100', lat: 15.6333, lng: 74.5167 },
        { market: 'Haliyal APMC', district: 'Uttara Kannada', state: 'Karnataka', commodity: 'Paddy', modal_price: '2200', lat: 15.3333, lng: 74.7667 },
        { market: 'Dharwad APMC', district: 'Dharwad', state: 'Karnataka', commodity: 'Chilli', modal_price: '14500', lat: 15.4589, lng: 75.0078 },
      ]
      setMarkets(fallback)
    }

    fetchData()
  }, [])

  const handleGetDirections = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#faf6f0]">
      {/* Header */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#c4c8bc]/30 px-10 py-3 bg-white z-20">
        <div className="flex items-center gap-4 text-[#2e3230]">
          <div className="size-6 text-[#4a7c59]">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4C25.7818 14.2173 33.7827 22.2182 44 24C33.7827 25.7818 25.7818 33.7827 24 44C22.2182 33.7827 14.2173 25.7818 4 24C14.2173 22.2182 22.2182 14.2173 24 4Z" fill="currentColor"></path>
            </svg>
          </div>
          <h2 className="text-[#2e3230] text-lg font-bold leading-tight" style={{ fontFamily: 'Literata, serif' }}>Terra Market Locator</h2>
        </div>
        <div className="flex flex-1 justify-end gap-6">
          <div className="hidden md:flex items-center bg-[#f0ece4] rounded-xl px-4 py-2 w-64 border border-[#c4c8bc]/30">
            <Search size={18} className="text-[#4a4e4a]" />
            <input className="bg-transparent border-none focus:ring-0 text-sm ml-2 w-full" placeholder="Search Belgaum markets..." />
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

      {/* Main Layout */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[400px] flex flex-col border-r border-[#c4c8bc]/30 bg-[#f5f1ea] overflow-y-auto z-10 shadow-xl">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[#2e3230]" style={{ fontFamily: 'Literata, serif' }}>Local Hubs</h1>
                <p className="text-xs text-[#4a4e4a] font-bold uppercase tracking-widest">Belgaum & Surroundings</p>
              </div>
              <button className="text-[#4a7c59] hover:bg-[#c8e8d0] p-3 rounded-xl transition-all shadow-sm bg-white border border-[#c4c8bc]/20">
                <Navigation size={20} />
              </button>
            </div>

            {/* Market List */}
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 text-[#4a7c59] animate-spin" />
                  <p className="text-sm font-bold text-[#4a4e4a] animate-pulse">Syncing Hub Locations...</p>
                </div>
              ) : (
                markets.map((market, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={i} 
                    className="bg-white p-6 rounded-2xl border-2 border-transparent hover:border-[#4a7c59]/50 shadow-sm hover:shadow-xl transition-all group cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <h3 className="font-bold text-xl text-[#2e3230]" style={{ fontFamily: 'Literata, serif' }}>{market.market}</h3>
                        <p className="text-xs text-[#4a4e4a] flex items-center gap-1 font-bold bg-[#f0ece4] px-2 py-1 rounded-lg w-fit">
                          <MapPin size={14} className="text-[#4a7c59]" /> {market.district}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[#d8f0de] text-[#2a6038]">
                        Mandis
                      </span>
                    </div>
                    
                    <div className="bg-[#faf6f0] p-4 rounded-xl border border-[#c4c8bc]/20 mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-[#4a4e4a] uppercase font-black mb-1">{market.commodity}</p>
                        <p className="text-lg font-black text-[#4a7c59]">₹{market.modal_price}</p>
                      </div>
                      <button 
                        onClick={() => handleGetDirections(market.lat!, market.lng!)}
                        className="p-3 bg-white rounded-full border border-[#c4c8bc]/20 text-[#4a7c59] hover:bg-[#4a7c59] hover:text-white transition-all shadow-sm"
                      >
                        <Navigation size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Map Section */}
        <section className="flex-1 relative bg-[#dbd7cf] z-0">
          <MapContainer 
            center={center} 
            zoom={zoom} 
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <ChangeView center={center} zoom={zoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Single Large Coverage Circle centered between Belgaum and Dharwad */}
            <Circle 
              center={[15.65, 74.8]}
              radius={80000} // 80km - large enough to cover Raibag (North) to Haliyal (South)
              pathOptions={{ 
                fillColor: '#4a7c59', 
                fillOpacity: 0.05, 
                color: '#4a7c59', 
                weight: 1,
                dashArray: '10, 15'
              }}
            />

            {!loading && markets.map((m, i) => (
              <Marker key={i} position={[m.lat!, m.lng!]}>
                <Popup className="custom-popup">
                  <div className="p-2 min-w-[150px]">
                    <h4 className="font-bold text-[#2e3230] text-base mb-1">{m.market}</h4>
                    <p className="text-xs text-[#4a4e4a] mb-2">{m.commodity}: <span className="font-bold text-[#4a7c59]">₹{m.modal_price}</span></p>
                    <button 
                      onClick={() => handleGetDirections(m.lat!, m.lng!)}
                      className="w-full bg-[#4a7c59] text-white py-1.5 rounded-lg text-xs font-bold"
                    >
                      Navigate
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map Overlay Info */}
          <div className="absolute bottom-10 left-10 right-10 z-[1000] pointer-events-none">
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl max-w-xl mx-auto border border-white/50 flex items-center gap-6 pointer-events-auto ring-1 ring-black/5"
            >
              <div className="bg-[#c8e8d0] p-4 rounded-2xl text-[#4a7c59]">
                <TrendingUp size={32} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-[#4a4e4a] uppercase tracking-widest mb-1">Local Focus</p>
                <p className="text-base font-bold text-[#2e3230]">Coverage circle now optimized for Kittur, Raibag, Khanapur, and Haliyal.</p>
              </div>
            </motion.div>
          </div>

          {error && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1000] bg-amber-50 border border-amber-200 px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3">
              <Info size={18} className="text-amber-700" />
              <span className="text-sm font-bold text-amber-800">{error}</span>
            </div>
          )}
        </section>
      </main>

      <style>{`
        .leaflet-container {
          background-color: #faf6f0 !important;
        }
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 16px;
          padding: 4px;
        }
      `}</style>
    </div>
  )
}
