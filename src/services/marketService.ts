import type { MarketPrice } from '../store/useMarketStore'
import { apiAvailability, env } from '../config/env'
import { apiClient } from './api'

type AgmarknetRecord = Record<string, string | number | null | undefined>

type AgmarknetResponse = {
  records?: AgmarknetRecord[]
  total?: number
  count?: number
}

type NormalizedMandiRecord = {
  commodity: string
  mandi: string
  district: string
  state: string
  pricePerQuintal: number
  minPrice: number
  maxPrice: number
  updatedAt: string
}

const readField = (record: AgmarknetRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

const parseNumeric = (value: string): number => {
  const parsed = Number(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Agmarknet returns dates as DD/MM/YYYY (Indian format).
 * new Date() parses this as MM/DD/YYYY which is WRONG for day > 12.
 * We must explicitly parse DD/MM/YYYY.
 */
const parseDateIso = (value: string): string => {
  if (!value) return new Date().toISOString()

  // Handle DD/MM/YYYY format from Agmarknet
  const ddmmyyyy = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }

  // Handle ISO format or other standard formats
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()

  return new Date().toISOString()
}

const normalizeRecord = (record: AgmarknetRecord): NormalizedMandiRecord | null => {
  const commodity = readField(record, ['commodity', 'Commodity', 'crop_name', 'Crop'])
  const mandi = readField(record, ['market', 'Market', 'market_name', 'mandi'])
  const district = readField(record, ['district', 'District']) || ''
  const state = readField(record, ['state', 'State', 'state_name']) || 'Unknown'
  const modalPrice = parseNumeric(
    readField(record, ['modal_price', 'Modal_Price', 'modalPrice', 'Modal_x0020_Price', 'price', 'Price'])
  )
  const minPrice = parseNumeric(
    readField(record, ['min_price', 'Min_Price', 'Min_x0020_Price', 'minPrice'])
  )
  const maxPrice = parseNumeric(
    readField(record, ['max_price', 'Max_Price', 'Max_x0020_Price', 'maxPrice'])
  )
  const updatedAt = parseDateIso(
    readField(record, ['arrival_date', 'Arrival_Date', 'date', 'updated_at', 'updatedAt'])
  )

  // Use modal_price as primary, fall back to average of min/max
  const effectivePrice = modalPrice > 0 ? modalPrice : (minPrice + maxPrice) / 2

  if (!commodity || !mandi || effectivePrice <= 0) return null

  return {
    commodity,
    mandi,
    district,
    state,
    pricePerQuintal: effectivePrice,
    minPrice: minPrice > 0 ? minPrice : effectivePrice,
    maxPrice: maxPrice > 0 ? maxPrice : effectivePrice,
    updatedAt,
  }
}

const getTrendFromPrices = (latest: number, previous?: number) => {
  if (!previous || previous <= 0) {
    return { trend: 'stable' as const, trendPercent: 0, color: 'yellow' as const }
  }

  const rawPercent = ((latest - previous) / previous) * 100
  const trendPercent = Math.round(rawPercent * 10) / 10

  if (trendPercent > 1) return { trend: 'up' as const, trendPercent, color: 'green' as const }
  if (trendPercent < -1) return { trend: 'down' as const, trendPercent, color: 'red' as const }
  return { trend: 'stable' as const, trendPercent, color: 'yellow' as const }
}

const buildPrices = (records: AgmarknetRecord[], commodityFilter?: string, mandiFilter?: string): MarketPrice[] => {
  const normalized = records
    .map(normalizeRecord)
    .filter((entry): entry is NormalizedMandiRecord => Boolean(entry))
    .filter(entry => {
      if (commodityFilter && !entry.commodity.toLowerCase().includes(commodityFilter.toLowerCase())) return false
      if (mandiFilter && !entry.mandi.toLowerCase().includes(mandiFilter.toLowerCase())) return false
      return true
    })

  const grouped = new Map<string, NormalizedMandiRecord[]>()

  normalized.forEach(entry => {
    const key = `${entry.commodity}__${entry.mandi}__${entry.state}`
    const bucket = grouped.get(key) ?? []
    bucket.push(entry)
    grouped.set(key, bucket)
  })

  const prices = Array.from(grouped.values())
    .map(group => group.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    .map(group => {
      const latest = group[0]
      const previous = group[1]
      const trendData = getTrendFromPrices(latest.pricePerQuintal, previous?.pricePerQuintal)

      return {
        id: `${latest.commodity}-${latest.mandi}-${latest.state}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-'),
        commodity: latest.commodity,
        mandi: latest.mandi,
        state: latest.state,
        pricePerQuintal: latest.pricePerQuintal,
        trend: trendData.trend,
        trendPercent: trendData.trendPercent,
        updatedAt: latest.updatedAt,
        color: trendData.color,
      } satisfies MarketPrice
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return prices
}

export const hasLiveMarketApi = () => apiAvailability.hasAgmarknetKey

export const getMockMarketPrices = (): MarketPrice[] => [
  { id: '1', commodity: 'Tomato', mandi: 'Belagavi Mandi', state: 'Karnataka', pricePerQuintal: 1200, trend: 'up', trendPercent: 8, updatedAt: new Date().toISOString(), color: 'green' },
  { id: '1-1', commodity: 'Tomato', mandi: 'Gokak APMC', state: 'Karnataka', pricePerQuintal: 1130, trend: 'down', trendPercent: -5, updatedAt: new Date().toISOString(), color: 'red' },
  { id: '1-2', commodity: 'Tomato', mandi: 'Hukkeri APMC', state: 'Karnataka', pricePerQuintal: 1060, trend: 'stable', trendPercent: 0, updatedAt: new Date().toISOString(), color: 'yellow' },
  { id: '2', commodity: 'Wheat', mandi: 'Belagavi Mandi', state: 'Karnataka', pricePerQuintal: 2400, trend: 'up', trendPercent: 2, updatedAt: new Date().toISOString(), color: 'green' },
  { id: '2-1', commodity: 'Wheat', mandi: 'Gokak APMC', state: 'Karnataka', pricePerQuintal: 2330, trend: 'down', trendPercent: -1, updatedAt: new Date().toISOString(), color: 'red' },
  { id: '3', commodity: 'Rice', mandi: 'Belagavi Mandi', state: 'Karnataka', pricePerQuintal: 4500, trend: 'stable', trendPercent: 0, updatedAt: new Date().toISOString(), color: 'yellow' },
  { id: '4', commodity: 'Onion', mandi: 'Lasalgaon', state: 'Maharashtra', pricePerQuintal: 890, trend: 'down', trendPercent: -5, updatedAt: new Date().toISOString(), color: 'red' },
  { id: '5', commodity: 'Soybean', mandi: 'Indore', state: 'Madhya Pradesh', pricePerQuintal: 4200, trend: 'down', trendPercent: -2, updatedAt: new Date().toISOString(), color: 'red' },
  { id: '6', commodity: 'Cotton', mandi: 'Nagpur', state: 'Maharashtra', pricePerQuintal: 6800, trend: 'up', trendPercent: 5, updatedAt: new Date().toISOString(), color: 'green' },
]

export interface FetchMarketOptions {
  commodity?: string
  mandi?: string
  state?: string
  district?: string
  limit?: number
}

export const fetchMarketPrices = async (mandiOrOptions?: string | FetchMarketOptions): Promise<MarketPrice[]> => {
  // Backward compatible: accept string (mandi name) or options object
  const opts: FetchMarketOptions = typeof mandiOrOptions === 'string'
    ? { mandi: mandiOrOptions }
    : mandiOrOptions ?? {}

  if (!hasLiveMarketApi()) {
    console.info('[Market] No Agmarknet API key — using demo data.')
    return getMockMarketPrices()
  }

  const endpoint = `${env.agmarknetBaseUrl.replace(/\/$/, '')}/${env.agmarknetResourceId}`

  try {
    const params: Record<string, string | number> = {
      'api-key': env.agmarknetApiKey,
      format: 'json',
      limit: opts.limit ?? env.agmarknetLimit,
    }

    // Agmarknet uses filters[Field_Name] syntax for filtering (Case Sensitive)
    if (opts.commodity) params['filters[Commodity]'] = opts.commodity
    if (opts.state) params['filters[State]'] = opts.state
    if (opts.district) params['filters[District]'] = opts.district
    if (opts.mandi) params['filters[Market]'] = opts.mandi

    const { data } = await apiClient.get<AgmarknetResponse>(endpoint, { params })

    const prices = buildPrices(data.records ?? [], opts.commodity, opts.mandi)

    if (!prices.length) {
      console.warn(`[Market] Agmarknet returned ${data.records?.length ?? 0} records but 0 parsed to valid prices.`)
      return getMockMarketPrices()
    }

    return prices
  } catch (error) {
    console.warn('[Market] Live Agmarknet fetch failed, using fallback data.', error)
    return getMockMarketPrices()
  }
}

/**
 * Fetch price comparison for a specific commodity across mandis in a state.
 * Returns prices from different mandis for the same commodity — used for
 * the "nearby mandi comparison" feature.
 */
export const fetchCommodityComparison = async (
  commodity: string,
  state?: string
): Promise<MarketPrice[]> => {
  if (!hasLiveMarketApi()) return getMockMarketPrices().filter(p => p.commodity.toLowerCase().includes(commodity.toLowerCase()))

  return fetchMarketPrices({
    commodity,
    state,
    limit: 100,
  })
}
