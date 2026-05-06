import { get, set } from 'idb-keyval'
import type { MarketPrice } from '../store/useMarketStore'
import { fetchMarketPrices, fetchCommodityComparison } from './marketService'

type MandiLocation = {
  state?: string
  district?: string
  village?: string
}

export interface MandiComparison {
  mandi: string
  state: string
  district?: string
  pricePerQuintal: number
  trend: MarketPrice['trend']
  trendPercent: number
  color: MarketPrice['color']
}

export interface MandiPriceSummary {
  crop: string
  locationLabel: string
  minPrice: number
  maxPrice: number
  avgPrice: number
  updatedAt: string
  nearbyMandis: MandiComparison[]
  isLiveData: boolean
}

const CACHE_PREFIX = 'mandi-price-summary'
const CACHE_TTL_MS = 60 * 60 * 1000

const normalize = (value: string) => value.trim().toLowerCase()

const makeLocationLabel = (location?: MandiLocation) =>
  [location?.district, location?.state].filter(Boolean).join(', ') || 'Nearby mandi'

const buildCacheKey = (crop: string, location?: MandiLocation) =>
  `${CACHE_PREFIX}:${normalize(crop)}:${normalize(location?.district || '')}:${normalize(location?.state || '')}`

const pickCropMatches = (prices: MarketPrice[], crop: string) => {
  const exact = prices.filter((price) => normalize(price.commodity) === normalize(crop))
  if (exact.length) return exact

  const partial = prices.filter((price) => normalize(price.commodity).includes(normalize(crop)))
  if (partial.length) return partial

  return []
}

const buildNoDataSummary = (crop: string, location?: MandiLocation): MandiPriceSummary => ({
  crop,
  locationLabel: makeLocationLabel(location),
  minPrice: 0,
  maxPrice: 0,
  avgPrice: 0,
  updatedAt: new Date().toISOString(),
  nearbyMandis: [],
  isLiveData: false,
})

const summarize = (crop: string, prices: MarketPrice[], location?: MandiLocation): MandiPriceSummary => {
  const matches = pickCropMatches(prices, crop)
  if (!matches.length) return buildNoDataSummary(crop, location)

  const sorted = [...matches].sort((left, right) => right.pricePerQuintal - left.pricePerQuintal)
  const priceValues = sorted.map((item) => item.pricePerQuintal)
  const total = priceValues.reduce((sum, value) => sum + value, 0)
  const latestUpdatedAt = sorted
    .map((item) => item.updatedAt)
    .sort((left, right) => right.localeCompare(left))[0]

  return {
    crop,
    locationLabel: makeLocationLabel(location),
    minPrice: Math.min(...priceValues),
    maxPrice: Math.max(...priceValues),
    avgPrice: Math.round(total / priceValues.length),
    updatedAt: latestUpdatedAt || new Date().toISOString(),
    isLiveData: true,
    nearbyMandis: sorted.slice(0, 5).map((item) => ({
      mandi: item.mandi,
      state: item.state,
      pricePerQuintal: item.pricePerQuintal,
      trend: item.trend,
      trendPercent: item.trendPercent,
      color: item.color,
    })),
  }
}

export async function getMandiPrice(crop: string, location?: MandiLocation, forceRefresh?: boolean): Promise<MandiPriceSummary> {
  const cacheKey = buildCacheKey(crop, location)
  
  if (!forceRefresh) {
    const cached = await get<{ value: MandiPriceSummary; expiresAt: number }>(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }
  }

  // Fetch with state filter for geographically coherent results
  const prices = await fetchMarketPrices({
    commodity: crop,
    state: location?.state,
    district: location?.district,
    limit: 100,
  })

  const summary = summarize(crop, prices, location)

  // If we got no state-filtered results, try broader search
  if (!summary.isLiveData && (location?.state || location?.district)) {
    const broadPrices = await fetchMarketPrices({ commodity: crop, limit: 100 })
    const broadSummary = summarize(crop, broadPrices, location)
    if (broadSummary.isLiveData) {
      await set(cacheKey, { value: broadSummary, expiresAt: Date.now() + CACHE_TTL_MS })
      return broadSummary
    }
  }

  await set(cacheKey, {
    value: summary,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })

  return summary
}

/**
 * Fetch nearby mandi comparison for a commodity.
 * Returns prices from multiple mandis for the same commodity,
 * preferring mandis within the same state for geographic coherence.
 */
export async function getNearbyMandiComparison(
  commodity: string,
  state?: string
): Promise<MandiComparison[]> {
  const cacheKey = `mandi-comparison:${normalize(commodity)}:${normalize(state || '')}`
  const cached = await get<{ value: MandiComparison[]; expiresAt: number }>(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const prices = await fetchCommodityComparison(commodity, state)
  const matches = pickCropMatches(prices, commodity)

  // Deduplicate by mandi name — take the latest entry per mandi
  const mandiMap = new Map<string, MarketPrice>()
  matches.forEach(price => {
    const key = price.mandi.toLowerCase()
    const existing = mandiMap.get(key)
    if (!existing || price.updatedAt > existing.updatedAt) {
      mandiMap.set(key, price)
    }
  })

  const comparisons: MandiComparison[] = Array.from(mandiMap.values())
    .sort((a, b) => b.pricePerQuintal - a.pricePerQuintal)
    .slice(0, 6)
    .map(price => ({
      mandi: price.mandi,
      state: price.state,
      pricePerQuintal: price.pricePerQuintal,
      trend: price.trend,
      trendPercent: price.trendPercent,
      color: price.color,
    }))

  if (comparisons.length) {
    await set(cacheKey, { value: comparisons, expiresAt: Date.now() + CACHE_TTL_MS })
  }

  return comparisons
}
