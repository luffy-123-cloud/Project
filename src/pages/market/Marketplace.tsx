import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, MapPin, RefreshCw, ShoppingBag, Tractor } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import { getMandiPrice, type MandiPriceSummary } from '../../services/mandi'
import { saveMandiListing } from '../../services/firebase/firestoreService'
import { useAuthStore } from '../../store/useAuthStore'
import { useLocationStore } from '../../store/useLocationStore'

const CROPS = ['Wheat', 'Rice', 'Maize', 'Tomato', 'Onion', 'Soybean', 'Cotton']

type ListingDraft = {
  crop: string
  quantity: string
  price: string
  location: string
}

type ListingPreview = {
  crop: string
  quantity: number
  price: number
  mandiReferencePrice: number
  location: string
}

const formatMoney = (value: number) => `Rs ${Math.round(value).toLocaleString('en-IN')}/qtl`

export default function Marketplace() {
  const farmer = useAuthStore((state) => state.farmer)
  const locationState = useLocationStore((state) => state.state)
  const locationDistrict = useLocationStore((state) => state.district)
  const locationVillage = useLocationStore((state) => state.village)
  const setLocation = useLocationStore((state) => state.setLocation)
  const location = useMemo(
    () => ({
      state: locationState,
      district: locationDistrict,
      village: locationVillage,
    }),
    [locationDistrict, locationState, locationVillage]
  )

  const [selectedCrop, setSelectedCrop] = useState('Maize')
  const [summary, setSummary] = useState<MandiPriceSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [listing, setListing] = useState<ListingDraft>({
    crop: 'Maize',
    quantity: '',
    price: '',
    location: 'Belagavi, Karnataka',
  })
  const [recentListings, setRecentListings] = useState<ListingPreview[]>([])

  useEffect(() => {
    let cancelled = false

    const loadSummary = async () => {
      setIsLoading(true)
      try {
        const result = await getMandiPrice(selectedCrop, location, refreshNonce > 0)
        if (cancelled) return

        setSummary(result)
        setListing((current) => ({
          crop: selectedCrop,
          quantity: current.quantity,
          price:
            current.crop === selectedCrop && current.price
              ? current.price
              : String(result.avgPrice),
          location: current.location || result.locationLabel,
        }))
      } catch (error) {
        console.error(error)
        if (!cancelled) {
          toast.error('Unable to load mandi prices right now.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadSummary()

    return () => {
      cancelled = true
    }
  }, [location, refreshNonce, selectedCrop])

  const parsedPrice = Number(listing.price)
  const parsedQuantity = Number(listing.quantity)

  const priceWarning = useMemo(() => {
    if (!summary || !Number.isFinite(parsedPrice) || parsedPrice <= 0) return null
    if (parsedPrice < summary.avgPrice) {
      return {
        tone: 'amber' as const,
        text: 'You are selling below market price.',
      }
    }
    if (parsedPrice > summary.maxPrice) {
      return {
        tone: 'red' as const,
        text: 'Price too high, may not sell quickly.',
      }
    }
    return {
      tone: 'green' as const,
      text: 'Price is aligned with the mandi range.',
    }
  }, [parsedPrice, summary])

  const handleCreateListing = async () => {
    if (!summary) {
      toast.error('Load mandi prices first.')
      return
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      toast.error('Enter a valid quantity.')
      return
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Enter a valid price.')
      return
    }

    const preview: ListingPreview = {
      crop: listing.crop,
      quantity: parsedQuantity,
      price: parsedPrice,
      mandiReferencePrice: summary.avgPrice,
      location: listing.location || summary.locationLabel,
    }

    try {
      if (farmer?.uid) {
        await saveMandiListing({
          farmerId: farmer.uid,
          crop: preview.crop,
          quantity: preview.quantity,
          price: preview.price,
          mandiReferencePrice: preview.mandiReferencePrice,
          location: preview.location,
        })
      }

      setRecentListings((current) => [preview, ...current].slice(0, 4))
      toast.success('Mandi listing created with price transparency.')
      setStep(2)
    } catch (error) {
      console.error(error)
      setRecentListings((current) => [preview, ...current].slice(0, 4))
      toast.success('Listing saved locally. Cloud sync can happen later.')
    }
  }

  return (
    <div className="px-4 py-5 max-w-3xl mx-auto w-full space-y-5 pb-24">
      <section className="rounded-[28px] bg-gradient-to-br from-emerald-700 via-emerald-600 to-amber-500 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/75">Mandi Saathi</p>
            <h1 className="mt-2 text-3xl font-black" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
              Sell with price clarity
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/90">
              Check mandi rates first, then create a transparent crop listing with a safer selling price.
            </p>
          </div>
          <div className="rounded-3xl bg-white/15 p-3">
            <Tractor size={28} />
          </div>
        </div>
      </section>

      <Card className="space-y-4 border border-neutral-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Phase 1</p>
            <h2 className="text-lg font-bold text-neutral-900">Select crop and mandi area</h2>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              step === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            Price Check
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CROPS.map((crop) => (
            <button
              key={crop}
              type="button"
              onClick={() => {
                setSelectedCrop(crop)
                setStep(1)
              }}
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
                selectedCrop === crop
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
              }`}
            >
              {crop}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-neutral-700">District</span>
            <input
              value={locationDistrict}
              onChange={(event) => setLocation({ district: event.target.value, source: 'manual' })}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none focus:border-emerald-500"
              placeholder="Enter district"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-neutral-700">State</span>
            <input
              value={locationState}
              onChange={(event) => setLocation({ state: event.target.value, source: 'manual' })}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none focus:border-emerald-500"
              placeholder="Enter state"
            />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">Today's mandi snapshot</p>
            <p className="text-xs text-neutral-500 truncate">
              {summary?.locationLabel || 'Choose crop and location'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshNonce((current) => current + 1)}
            className="rounded-full bg-white p-2 text-neutral-600 shadow-sm"
            aria-label="Refresh mandi prices"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {summary ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border border-amber-100 bg-amber-50 shadow-none">
              <p className="text-xs uppercase tracking-wide text-amber-700">Min</p>
              <p className="mt-1 text-xl font-bold text-amber-950">{formatMoney(summary.minPrice)}</p>
            </Card>
            <Card className="border border-emerald-100 bg-emerald-50 shadow-none">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Avg</p>
              <p className="mt-1 text-xl font-bold text-emerald-950">{formatMoney(summary.avgPrice)}</p>
            </Card>
            <Card className="border border-sky-100 bg-sky-50 shadow-none">
              <p className="text-xs uppercase tracking-wide text-sky-700">Max</p>
              <p className="mt-1 text-xl font-bold text-sky-950">{formatMoney(summary.maxPrice)}</p>
            </Card>
          </div>
        ) : null}

        {summary ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-900">Nearby mandi comparison</p>
              <p className="text-xs text-neutral-500">
                Updated {new Date(summary.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {summary.nearbyMandis.map((mandi) => (
              <div
                key={`${mandi.mandi}-${mandi.state}`}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900">{mandi.mandi}</p>
                    <p className="text-xs text-neutral-500">{mandi.state}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-neutral-900">{formatMoney(mandi.pricePerQuintal)}</p>
                    <p
                      className={`text-xs font-semibold ${
                        mandi.color === 'green'
                          ? 'text-emerald-600'
                          : mandi.color === 'red'
                            ? 'text-red-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {mandi.trend === 'up' ? '+' : mandi.trend === 'down' ? '' : ''}
                      {mandi.trendPercent}% this week
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex gap-3 text-xs text-neutral-500 border-t border-neutral-100 pt-2">
                  <span>Min: <strong className="text-amber-700">{formatMoney(mandi.minPrice)}</strong></span>
                  <span>Avg: <strong className="text-emerald-700">{formatMoney(mandi.pricePerQuintal)}</strong></span>
                  <span>Max: <strong className="text-sky-700">{formatMoney(mandi.maxPrice)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!summary}
          className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          Continue to create listing
        </button>
      </Card>

      <Card className="space-y-4 border border-neutral-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">Phase 2</p>
            <h2 className="text-lg font-bold text-neutral-900">Create listing with mandi intelligence</h2>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              step === 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            Listing
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-neutral-700">Crop</span>
            <input
              value={listing.crop}
              onChange={(event) => setListing((current) => ({ ...current, crop: event.target.value }))}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-neutral-700">Quantity (quintal)</span>
            <input
              type="number"
              min="0"
              value={listing.quantity}
              onChange={(event) => setListing((current) => ({ ...current, quantity: event.target.value }))}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none focus:border-emerald-500"
              placeholder="Eg. 25"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-neutral-700">Price per quintal</span>
            <input
              type="number"
              min="0"
              value={listing.price}
              onChange={(event) => setListing((current) => ({ ...current, price: event.target.value }))}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-neutral-700">Location</span>
            <input
              value={listing.location}
              onChange={(event) => setListing((current) => ({ ...current, location: event.target.value }))}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        {summary ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-900">Auto-suggested mandi price</p>
            <p className="mt-1 text-sm text-emerald-800">
              Average for {selectedCrop} in {summary.locationLabel}: <strong>{formatMoney(summary.avgPrice)}</strong>
            </p>
          </div>
        ) : null}

        {priceWarning ? (
          <div
            className={`flex items-start gap-2 rounded-2xl px-4 py-3 ${
              priceWarning.tone === 'green'
                ? 'bg-emerald-50 text-emerald-800'
                : priceWarning.tone === 'red'
                  ? 'bg-red-50 text-red-800'
                  : 'bg-amber-50 text-amber-800'
            }`}
          >
            {priceWarning.tone === 'green' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <p className="text-sm font-medium">{priceWarning.text}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleCreateListing()}
          className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white"
        >
          Save transparent listing
        </button>
      </Card>

      <Card className="space-y-4 border border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
            <ShoppingBag size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Buyer view with trust layer</h2>
            <p className="text-sm text-neutral-500">Wholesalers can compare your asking price with mandi reference.</p>
          </div>
        </div>

        {(recentListings.length ? recentListings : []).map((item, index) => (
          <div key={`${item.crop}-${item.location}-${index}`} className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-neutral-900">{item.crop}</p>
                <p className="text-sm text-neutral-500">
                  {item.quantity} qtl · {item.location}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
                <MapPin size={13} />
                Transparent
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-neutral-400">Farmer price</p>
                <p className="mt-1 text-lg font-bold text-neutral-900">{formatMoney(item.price)}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-emerald-600">Mandi reference</p>
                <p className="mt-1 text-lg font-bold text-emerald-900">{formatMoney(item.mandiReferencePrice)}</p>
              </div>
            </div>
          </div>
        ))}

        {!recentListings.length ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
            Create your first listing to show the buyer-side price comparison here.
          </div>
        ) : null}
      </Card>
    </div>
  )
}
