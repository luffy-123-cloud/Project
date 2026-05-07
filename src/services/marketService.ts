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

// ---------------------------------------------------------------------------
// Belgaum-area Karnataka mandis: Belagavi APMC, Bailhongal, Gadag, Hubli, Dharwad
// Each entry carries distinct minPrice / maxPrice so the snapshot shows a
// realistic spread rather than the same value for min / avg / max.
// ---------------------------------------------------------------------------
export const getMockMarketPrices = (): MarketPrice[] => [
  // ── Wheat ──────────────────────────────────────────────────────────────────
  { id: 'w-blg', commodity: 'Wheat', mandi: 'Belagavi APMC', state: 'Karnataka', pricePerQuintal: 2320, trend: 'up',     trendPercent: 3,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 2180, maxPrice: 2480 },
  { id: 'w-bhl', commodity: 'Wheat', mandi: 'Bailhongal',    state: 'Karnataka', pricePerQuintal: 2260, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 2120, maxPrice: 2400 },
  { id: 'w-gag', commodity: 'Wheat', mandi: 'Gadag',         state: 'Karnataka', pricePerQuintal: 2190, trend: 'down',   trendPercent: -2, updatedAt: new Date().toISOString(), color: 'red',    minPrice: 2050, maxPrice: 2350 },
  { id: 'w-hub', commodity: 'Wheat', mandi: 'Hubli',         state: 'Karnataka', pricePerQuintal: 2290, trend: 'up',     trendPercent: 1,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 2150, maxPrice: 2430 },
  { id: 'w-dhr', commodity: 'Wheat', mandi: 'Dharwad',       state: 'Karnataka', pricePerQuintal: 2240, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 2100, maxPrice: 2380 },

  // ── Rice ───────────────────────────────────────────────────────────────────
  { id: 'r-blg', commodity: 'Rice', mandi: 'Belagavi APMC', state: 'Karnataka', pricePerQuintal: 2850, trend: 'up',     trendPercent: 4,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 2650, maxPrice: 3050 },
  { id: 'r-bhl', commodity: 'Rice', mandi: 'Bailhongal',    state: 'Karnataka', pricePerQuintal: 2780, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 2580, maxPrice: 2980 },
  { id: 'r-gag', commodity: 'Rice', mandi: 'Gadag',         state: 'Karnataka', pricePerQuintal: 2720, trend: 'down',   trendPercent: -3, updatedAt: new Date().toISOString(), color: 'red',    minPrice: 2520, maxPrice: 2920 },
  { id: 'r-hub', commodity: 'Rice', mandi: 'Hubli',         state: 'Karnataka', pricePerQuintal: 2810, trend: 'up',     trendPercent: 2,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 2610, maxPrice: 3010 },
  { id: 'r-dhr', commodity: 'Rice', mandi: 'Dharwad',       state: 'Karnataka', pricePerQuintal: 2760, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 2560, maxPrice: 2960 },

  // ── Maize ──────────────────────────────────────────────────────────────────
  { id: 'm-blg', commodity: 'Maize', mandi: 'Belagavi APMC', state: 'Karnataka', pricePerQuintal: 1680, trend: 'up',     trendPercent: 5,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 1540, maxPrice: 1820 },
  { id: 'm-bhl', commodity: 'Maize', mandi: 'Bailhongal',    state: 'Karnataka', pricePerQuintal: 1620, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 1480, maxPrice: 1760 },
  { id: 'm-gag', commodity: 'Maize', mandi: 'Gadag',         state: 'Karnataka', pricePerQuintal: 1570, trend: 'down',   trendPercent: -4, updatedAt: new Date().toISOString(), color: 'red',    minPrice: 1430, maxPrice: 1710 },
  { id: 'm-hub', commodity: 'Maize', mandi: 'Hubli',         state: 'Karnataka', pricePerQuintal: 1650, trend: 'up',     trendPercent: 2,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 1510, maxPrice: 1790 },
  { id: 'm-dhr', commodity: 'Maize', mandi: 'Dharwad',       state: 'Karnataka', pricePerQuintal: 1600, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 1460, maxPrice: 1740 },

  // ── Tomato ─────────────────────────────────────────────────────────────────
  { id: 't-blg', commodity: 'Tomato', mandi: 'Belagavi APMC', state: 'Karnataka', pricePerQuintal: 1420, trend: 'up',     trendPercent: 7,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 1200, maxPrice: 1640 },
  { id: 't-bhl', commodity: 'Tomato', mandi: 'Bailhongal',    state: 'Karnataka', pricePerQuintal: 1360, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 1140, maxPrice: 1580 },
  { id: 't-gag', commodity: 'Tomato', mandi: 'Gadag',         state: 'Karnataka', pricePerQuintal: 1290, trend: 'down',   trendPercent: -6, updatedAt: new Date().toISOString(), color: 'red',    minPrice: 1070, maxPrice: 1510 },
  { id: 't-hub', commodity: 'Tomato', mandi: 'Hubli',         state: 'Karnataka', pricePerQuintal: 1390, trend: 'up',     trendPercent: 3,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 1170, maxPrice: 1610 },
  { id: 't-dhr', commodity: 'Tomato', mandi: 'Dharwad',       state: 'Karnataka', pricePerQuintal: 1330, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 1110, maxPrice: 1550 },

  // ── Onion ──────────────────────────────────────────────────────────────────
  { id: 'o-blg', commodity: 'Onion', mandi: 'Belagavi APMC', state: 'Karnataka', pricePerQuintal: 1150, trend: 'up',     trendPercent: 6,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 950,  maxPrice: 1350 },
  { id: 'o-bhl', commodity: 'Onion', mandi: 'Bailhongal',    state: 'Karnataka', pricePerQuintal: 1080, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 880,  maxPrice: 1280 },
  { id: 'o-gag', commodity: 'Onion', mandi: 'Gadag',         state: 'Karnataka', pricePerQuintal: 1020, trend: 'down',   trendPercent: -5, updatedAt: new Date().toISOString(), color: 'red',    minPrice: 820,  maxPrice: 1220 },
  { id: 'o-hub', commodity: 'Onion', mandi: 'Hubli',         state: 'Karnataka', pricePerQuintal: 1110, trend: 'up',     trendPercent: 2,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 910,  maxPrice: 1310 },
  { id: 'o-dhr', commodity: 'Onion', mandi: 'Dharwad',       state: 'Karnataka', pricePerQuintal: 1060, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 860,  maxPrice: 1260 },

  // ── Soybean ────────────────────────────────────────────────────────────────
  { id: 's-blg', commodity: 'Soybean', mandi: 'Belagavi APMC', state: 'Karnataka', pricePerQuintal: 4480, trend: 'up',     trendPercent: 3,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 4200, maxPrice: 4760 },
  { id: 's-bhl', commodity: 'Soybean', mandi: 'Bailhongal',    state: 'Karnataka', pricePerQuintal: 4390, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 4110, maxPrice: 4670 },
  { id: 's-gag', commodity: 'Soybean', mandi: 'Gadag',         state: 'Karnataka', pricePerQuintal: 4310, trend: 'down',   trendPercent: -2, updatedAt: new Date().toISOString(), color: 'red',    minPrice: 4030, maxPrice: 4590 },
  { id: 's-hub', commodity: 'Soybean', mandi: 'Hubli',         state: 'Karnataka', pricePerQuintal: 4450, trend: 'up',     trendPercent: 1,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 4170, maxPrice: 4730 },
  { id: 's-dhr', commodity: 'Soybean', mandi: 'Dharwad',       state: 'Karnataka', pricePerQuintal: 4360, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 4080, maxPrice: 4640 },

  // ── Cotton ─────────────────────────────────────────────────────────────────
  { id: 'c-blg', commodity: 'Cotton', mandi: 'Belagavi APMC', state: 'Karnataka', pricePerQuintal: 7100, trend: 'up',     trendPercent: 4,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 6700, maxPrice: 7500 },
  { id: 'c-bhl', commodity: 'Cotton', mandi: 'Bailhongal',    state: 'Karnataka', pricePerQuintal: 6980, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 6580, maxPrice: 7380 },
  { id: 'c-gag', commodity: 'Cotton', mandi: 'Gadag',         state: 'Karnataka', pricePerQuintal: 6850, trend: 'down',   trendPercent: -3, updatedAt: new Date().toISOString(), color: 'red',    minPrice: 6450, maxPrice: 7250 },
  { id: 'c-hub', commodity: 'Cotton', mandi: 'Hubli',         state: 'Karnataka', pricePerQuintal: 7050, trend: 'up',     trendPercent: 2,  updatedAt: new Date().toISOString(), color: 'green',  minPrice: 6650, maxPrice: 7450 },
  { id: 'c-dhr', commodity: 'Cotton', mandi: 'Dharwad',       state: 'Karnataka', pricePerQuintal: 6920, trend: 'stable', trendPercent: 0,  updatedAt: new Date().toISOString(), color: 'yellow', minPrice: 6520, maxPrice: 7320 },
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
