// src/pages/fields/MarketComparisonDashboard.tsx
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import jsPDF from 'jspdf'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import 'leaflet-routing-machine'
import { 
  Bell as LucideBell, 
  User as LucideUser, 
  Filter as LucideFilter, 
  Map as LucideMap, 
  MapPin, 
  Store, 
  Truck, 
  Info,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Loader2,
  Navigation
} from 'lucide-react'

// Fix Leaflet marker icon issue
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

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
  distance?: number
  lat?: number
  lng?: number
}

const MANDI_LOCATIONS = [
  { name: 'Belagavi Mandi', lat: 15.8497, lng: 74.4977, city: 'Belgaum' },
  { name: 'Gokak APMC', lat: 16.1706, lng: 74.8322, city: 'Gokak' },
  { name: 'Hukkeri APMC', lat: 16.2239, lng: 74.5937, city: 'Hukkeri' },
  { name: 'Athani APMC', lat: 16.7324, lng: 75.0592, city: 'Athani' },
  { name: 'Bailhongal APMC', lat: 15.8203, lng: 74.8624, city: 'Bailhongal' },
  { name: 'Nipani APMC', lat: 16.3989, lng: 74.3855, city: 'Nipani' },
  { name: 'Chikkodi APMC', lat: 16.4357, lng: 74.5954, city: 'Chikkodi' },
  { name: 'Ramdurg APMC', lat: 15.9452, lng: 75.2952, city: 'Ramdurg' },
]

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371 // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in km
}

// Routing Machine Component
function RoutingMachine({ userLoc, destLoc }: { userLoc: [number, number], destLoc: [number, number] }) {
  const map = useMap()
  const routingControlRef = useRef<any>(null)

  useEffect(() => {
    if (!map || !userLoc || !destLoc) return

    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current)
    }

    routingControlRef.current = (L as any).Routing.control({
      waypoints: [
        L.latLng(userLoc[0], userLoc[1]),
        L.latLng(destLoc[0], destLoc[1])
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false, // Hide the text directions panel to look like Google Maps overlay
      lineOptions: {
        styles: [{ color: '#4a7c59', weight: 6, opacity: 0.8 }]
      },
      createMarker: () => null // We'll use our own markers
    }).addTo(map)

    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current)
      }
    }
  }, [map, userLoc, destLoc])

  return null
}

export default function MarketComparisonDashboard() {
  const [records, setRecords] = useState<MandiRecord[]>([
    { market: 'Belagavi Mandi', commodity: 'Tomato', variety: 'Standard', modal_price: '1200', min_price: '1050', max_price: '1350', arrival_date: new Date().toLocaleDateString('en-GB'), state: 'Karnataka', district: 'Belgaum', grade: 'A', distance: 10, lat: 15.8497, lng: 74.4977 },
    { market: 'Gokak APMC', commodity: 'Tomato', variety: 'Standard', modal_price: '1130', min_price: '1000', max_price: '1250', arrival_date: new Date().toLocaleDateString('en-GB'), state: 'Karnataka', district: 'Belgaum', grade: 'A', distance: 60, lat: 16.1706, lng: 74.8322 },
    { market: 'Hukkeri APMC', commodity: 'Tomato', variety: 'Standard', modal_price: '1060', min_price: '950', max_price: '1200', arrival_date: new Date().toLocaleDateString('en-GB'), state: 'Karnataka', district: 'Belgaum', grade: 'A', distance: 55, lat: 16.2239, lng: 74.5937 }
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [selectedDestination, setSelectedDestination] = useState<[number, number] | null>(null)

  const [cropInput, setCropInput] = useState('Tomato')

  const [activeCity] = useState('Belgaum')
  const [activeCrop, setActiveCrop] = useState('Tomato')

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        () => {
          console.warn("Location permission denied. Using default.")
          setUserLocation({ lat: 15.8497, lng: 74.4977 }) 
        },
        { enableHighAccuracy: true }
      )
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      // Create an AbortController for a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

      const API_URL = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=579b464db66ec23bdd000001d040eceaf01f49eb5bc553f6d3ec0284&format=json&filters[Commodity]=${activeCrop}&filters[District]=${activeCity}&limit=100`
      
      try {
        setLoading(true)
        const response = await axios.get(API_URL, { signal: controller.signal })
        clearTimeout(timeoutId)
        
        if (response.data && response.data.records && response.data.records.length > 0) {
          const fetchedRecords = response.data.records.map((r: any) => {
            const mandi = MANDI_LOCATIONS.find(m => m.name.toLowerCase().includes(r.market.toLowerCase()))
            let distance = 10
            let lat = mandi?.lat || 15.8497
            let lng = mandi?.lng || 74.4977

            if (userLocation && mandi) {
              const realDist = calculateDistance(userLocation.lat, userLocation.lng, mandi.lat, mandi.lng)
              // Fixed logic: If user is "too far" (simulation), use baseline. Else use truth.
              distance = realDist > 300 ? (mandi.name.includes('Gokak') ? 60 : mandi.name.includes('Hukkeri') ? 55 : 10) : realDist
            }
            return { ...r, distance: Math.round(distance), lat, lng }
          })
          setRecords(fetchedRecords)
          setError(null)
        } else {
          useFallbackData(activeCity, activeCrop)
        }
      } catch (err) {
        useFallbackData(activeCity, activeCrop)
        if (axios.isCancel(err)) {
          setError("Live server timed out. Showing estimated rates.")
        } else {
          setError("Live data unavailable. Showing estimated rates.")
        }
      } finally {
        setLoading(false)
      }
    }

    const useFallbackData = (city: string, crop: string) => {
      const formattedDate = new Date().toLocaleDateString('en-GB')
      const basePrice = crop === 'Tomato' ? 1200 : crop === 'Wheat' ? 2400 : crop === 'Rice' ? 4500 : 2450;
      
      const mandiData = [
        { name: `Belagavi Mandi`, lat: 15.8497, lng: 74.4977, priceDiff: 0, baseDist: 10 },
        { name: `Gokak APMC`, lat: 16.1706, lng: 74.8322, priceDiff: -70, baseDist: 60 },
        { name: `Hukkeri APMC`, lat: 16.2239, lng: 74.5937, priceDiff: -140, baseDist: 55 }
      ]

      const fallbackRecords = mandiData.map((m) => {
        let distance = m.baseDist
        if (userLocation) {
          const realDist = calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng)
          distance = realDist > 300 ? m.baseDist : realDist
        }
        return {
          market: m.name,
          commodity: crop,
          variety: 'Standard',
          modal_price: `${basePrice + m.priceDiff}`,
          min_price: `${basePrice + m.priceDiff - 150}`,
          max_price: `${basePrice + m.priceDiff + 150}`,
          arrival_date: formattedDate,
          state: 'Karnataka',
          district: city,
          grade: 'A',
          distance: Math.round(distance),
          lat: m.lat,
          lng: m.lng
        }
      })
      
      setRecords(fallbackRecords)
    }

    fetchData()
  }, [activeCity, activeCrop, userLocation])

  const handleUpdateView = () => {
    setActiveCrop(cropInput)
    setSelectedDestination(null)
  }

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("Sarpanch AI - Market Comparison", 20, 20);
    
    doc.setFontSize(14);
    doc.text(`Crop: ${activeCrop} | Location: ${activeCity}`, 20, 32);
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 20, 40);
    
    let yPos = 60;
    doc.setFontSize(12);
    records.forEach((r, idx) => {
      doc.text(`${idx + 1}. Mandi: ${r.market}`, 20, yPos);
      doc.text(`Price: Rs.${r.modal_price} / quintal`, 80, yPos);
      doc.text(`Distance: ${r.distance} km`, 150, yPos);
      yPos += 15;
    });
    
    doc.save(`Market_Comparison_${activeCrop}_${activeCity}.pdf`);
  }

  return (
    <div className="min-h-screen bg-[#faf6f0] text-[#2e3230] font-sans pb-20">
      <div className="layout-container flex h-full grow flex-col">
        <div className="flex flex-1 justify-center py-5 px-4 md:px-10 lg:px-20">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="md:col-span-1 space-y-6">
                <div className="bg-[#f5f1ea] p-6 rounded-xl shadow-sm border border-[#c4c8bc]/20">
                  <h3 className="text-[#2e3230] text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Literata, serif' }}>
                    <LucideFilter size={20} className="text-[#4a7c59]" /> Mandi Filters
                  </h3>
                  <div className="space-y-4">
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
                  <div className="w-full h-[400px] rounded-lg bg-[#e4e0d8] overflow-hidden relative border border-[#c4c8bc]/30">
                    <MapContainer 
                      center={[15.8497, 74.4977]} 
                      zoom={9} 
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={false}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      {userLocation && (
                        <Marker position={[userLocation.lat, userLocation.lng]}>
                          <Popup>Your Location</Popup>
                        </Marker>
                      )}
                      {MANDI_LOCATIONS.map((m, i) => (
                        <Marker key={i} position={[m.lat, m.lng]}>
                          <Popup>
                            <div className="p-1">
                              <h4 className="font-bold text-brand-700">{m.name}</h4>
                              <p className="text-xs">Providing quality service to farmers.</p>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                      {userLocation && selectedDestination && (
                        <RoutingMachine 
                          userLoc={
                            calculateDistance(userLocation.lat, userLocation.lng, 15.8497, 74.4977) > 300 
                            ? [15.8497, 74.4977] // Force source to Belagavi if user is too far away
                            : [userLocation.lat, userLocation.lng]
                          } 
                          destLoc={selectedDestination} 
                        />
                      )}
                    </MapContainer>
                  </div>
                  <div className="p-3 text-center">
                    <span className="text-[10px] font-bold text-[#4a4e4a] uppercase tracking-wider flex items-center justify-center gap-1">
                      <LucideMap size={12} /> Interactive Regional Map
                    </span>
                  </div>
                </div>
              </div>

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
                                <h4 className="font-bold text-lg leading-tight" style={{ fontFamily: 'Literata, serif' }}>{row.market}</h4>
                                <p className="text-xs text-[#4a4e4a] flex items-center gap-1">
                                  <MapPin size={14} /> {row.distance} km away
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

                            <button 
                              onClick={() => row.lat && row.lng && setSelectedDestination([row.lat, row.lng])}
                              className={`w-full py-3 ${selectedDestination && selectedDestination[0] === row.lat && selectedDestination[1] === row.lng ? 'bg-brand-700 text-white' : i === 0 ? 'bg-[#4a7c59] text-white' : 'bg-[#e4e0d8] text-[#2e3230]'} rounded-lg font-bold flex items-center justify-center gap-2 transition-colors`}
                            >
                              <Navigation size={18} /> Directions
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
                              <th className="px-6 py-4">Distance</th>
                              <th className="px-6 py-4">Max Price</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#c4c8bc]/10">
                            {records.map((row, i) => (
                              <tr key={i}>
                                <td className="px-6 py-4 text-sm font-medium">{row.market}</td>
                                <td className={`px-6 py-4 text-sm font-bold ${i === 0 ? 'text-[#4a7c59]' : ''}`}>₹{row.modal_price}</td>
                                <td className="px-6 py-4 text-sm font-semibold">{row.distance} km</td>
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
