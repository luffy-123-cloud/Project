import { useState, useEffect, useCallback } from 'react'
import type { LeafDiseaseAnalysis, PlantNetMatch } from '../types/leafScanner'

export interface ScanHistoryItem {
  id: string
  timestamp: number
  imageDataUrl: string
  analysis: LeafDiseaseAnalysis
  plantMatch: PlantNetMatch
}

const STORAGE_KEY = 'sarpanch_scan_history'
const MAX_HISTORY = 10

export function useScanHistory() {
  const [history, setHistory] = useState<ScanHistoryItem[]>([])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setHistory(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load scan history', e)
      }
    }
  }, [])

  const saveScan = useCallback((item: Omit<ScanHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: ScanHistoryItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }

    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setHistory([])
  }, [])

  const deleteScan = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  return { history, saveScan, clearHistory, deleteScan }
}
