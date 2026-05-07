import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type Coordinates = { lat: number; lon: number } | null

interface LocationState {
  state: string
  district: string
  village: string
  coords: Coordinates
  source: 'profile' | 'device' | 'manual'
  setLocation: (location: {
    state?: string
    district?: string
    village?: string
    coords?: Coordinates
    source?: LocationState['source']
  }) => void
  hydrateFromProfile: (location: {
    state?: string
    district?: string
    village?: string
    coords?: Coordinates
  }) => void
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      state: 'Karnataka',
      district: 'Belagavi',
      village: '',
      coords: null,
      source: 'manual',
      setLocation: (location) =>
        set((current) => ({
          state: location.state ?? current.state,
          district: location.district ?? current.district,
          village: location.village ?? current.village,
          coords: location.coords ?? current.coords,
          source: location.source ?? current.source,
        })),
      hydrateFromProfile: (location) =>
        set((current) => ({
          state: location.state || current.state,
          district: location.district || current.district,
          village: location.village || current.village,
          coords: location.coords ?? current.coords,
          source: 'profile',
        })),
    }),
    {
      name: 'sarpanch-location',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        state: state.state,
        district: state.district,
        village: state.village,
        coords: state.coords,
        source: state.source,
      }),
    }
  )
)
