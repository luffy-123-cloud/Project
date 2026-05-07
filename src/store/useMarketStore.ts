// src/store/useMarketStore.ts
import { create } from 'zustand'

export interface MarketPrice {
  id: string
  commodity: string
  mandi: string
  state: string
  pricePerQuintal: number
  minPrice?: number
  maxPrice?: number
  trend: 'up' | 'down' | 'stable'
  trendPercent: number
  updatedAt: string
  color: 'green' | 'red' | 'yellow'
}

interface MarketState {
  prices: MarketPrice[]
  lastFetched: number | null
  selectedMandi: string | null
  setPrices: (prices: MarketPrice[]) => void
  setMandi: (mandi: string) => void
  isStale: () => boolean
}

export const useMarketStore = create<MarketState>()((set, get) => ({
  prices: [],
  lastFetched: null,
  selectedMandi: null,

  setPrices: (prices) => set({ prices, lastFetched: Date.now() }),
  setMandi: (selectedMandi) => set({ selectedMandi }),

  isStale: () => {
    const { lastFetched } = get()
    if (!lastFetched) return true
    return Date.now() - lastFetched > 2 * 60 * 60 * 1000 // 2 hours
  },
}))
