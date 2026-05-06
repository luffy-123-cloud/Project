import { env } from '../../config/env'
import type { PlantNetMatch } from '../../types/leafScanner'

const PLANTNET_MIN_SCORE = 0.25

const getPlantNetBaseUrl = (): string =>
  import.meta.env.DEV ? '/plantnet-api' : 'https://my-api.plantnet.org'

export async function identifyPlantWithPlantNet(file: File): Promise<PlantNetMatch> {
  const apiKey = env.plantnetApiKey
  if (!apiKey) {
    throw new Error('PlantNet API key is not configured. Add VITE_PLANTNET_API_KEY to your environment.')
  }

  const project = env.plantnetProject || 'all'
  const url = `${getPlantNetBaseUrl()}/v2/identify/${encodeURIComponent(project)}?api-key=${encodeURIComponent(apiKey)}`

  const body = new FormData()
  body.append('images', file)
  body.append('organs', 'leaf')

  const maskedUrl = url.replace(apiKey, 'REDACTED')
  console.log(`[PlantNet] Identifying with URL: ${maskedUrl}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

  const response = await fetch(url, {
    method: 'POST',
    body,
    signal: controller.signal,
  }).catch(err => {
    clearTimeout(timeoutId)
    console.error(`[PlantNet] Fetch error: ${err.message}`)
    if (err.name === 'AbortError') {
      throw new Error('PlantNet API request timed out. Please check your internet connection.')
    }
    throw new Error(`Failed to connect to PlantNet API: ${err.message}`)
  })
  clearTimeout(timeoutId)

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    const status = response.status
    console.error(`[PlantNet] Error ${status}: ${text}`)
    let msg = `PlantNet API error (${status})`
    
    if (status === 502) {
      msg = 'PlantNet service is currently unavailable through the local proxy. Please check your internet connection or try again later.'
    } else if (status === 401 || status === 403) {
      msg = 'PlantNet API key is invalid or unauthorized.'
    } else if (text) {
      msg += `: ${text.slice(0, 150)}`
    }
    
    throw new Error(msg)
  }

  const data = (await response.json()) as {
    results?: Array<{
      score: number
      species?: {
        scientificNameWithoutAuthor?: string
        commonNames?: string[]
      }
    }>
  }

  const best = data.results?.[0]
  const score = typeof best?.score === 'number' ? best.score : 0
  const scientific = best?.species?.scientificNameWithoutAuthor?.trim() || ''
  const common = best?.species?.commonNames?.[0]?.trim() || scientific

  if (!scientific || score < PLANTNET_MIN_SCORE) {
    throw new Error('Plant match confidence is too low. Retake a clearer photo of a single leaf and try again.')
  }

  return {
    scientificName: scientific,
    commonName: common || scientific,
    score,
  }
}
