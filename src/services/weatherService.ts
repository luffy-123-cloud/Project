import { addDays, format } from 'date-fns'
import { apiClient } from './api'
import type { ForecastDay, WeatherData } from '../store/useWeatherStore'
import { env } from '../config/env'
import { normalizeSupportedLanguage, type SupportedLanguage } from '../i18n'

const API_KEY = env.openWeatherApiKey
const WEATHER_BASE = 'https://api.openweathermap.org/data/2.5'
const GEO_BASE = 'https://api.openweathermap.org/geo/1.0'

export const DEFAULT_LOCATION_COORDS = { lat: 15.8497, lon: 74.4977 }

type OpenWeatherMain = {
  temp: number
  feels_like: number
  humidity: number
  temp_min?: number
  temp_max?: number
}

type OpenWeatherWeather = {
  main: string
  description: string
  icon: string
}

type OpenWeatherCurrentResponse = {
  name?: string
  main: OpenWeatherMain
  weather: OpenWeatherWeather[]
  wind?: { speed?: number }
  rain?: { '1h'?: number }
  clouds?: { all?: number }
}

type ForecastListEntry = {
  dt: number
  dt_txt: string
  main: OpenWeatherMain
  weather: OpenWeatherWeather[]
  wind?: { speed?: number }
  pop?: number
  rain?: { '3h'?: number }
}

type ForecastResponse = {
  list: ForecastListEntry[]
  city?: { name?: string }
}

type ReverseGeoEntry = {
  name?: string
  state?: string
  country?: string
}

export interface ReverseGeocodeResult {
  label: string
  village: string
  district: string
  state: string
}

const getWeatherPrimary = (weather?: OpenWeatherWeather[]) => weather?.[0]

const getActionColorFromCondition = (condition: string, rainChance = 0, windSpeed = 0) => {
  const normalized = condition.toLowerCase()
  if (
    normalized.includes('thunderstorm') ||
    normalized.includes('storm') ||
    rainChance >= 0.75 ||
    windSpeed >= 12
  ) {
    return 'red' as const
  }
  if (
    normalized.includes('rain') ||
    normalized.includes('drizzle') ||
    normalized.includes('mist') ||
    rainChance >= 0.35
  ) {
    return 'yellow' as const
  }
  return 'green' as const
}

const getLocalizedWeatherDescription = (icon: string, language: SupportedLanguage) => {
  const dictionary: Record<SupportedLanguage, Record<string, string>> = {
    en: { Clear: 'Clear sky', Clouds: 'Cloudy', Rain: 'Rain', Drizzle: 'Drizzle', Thunderstorm: 'Storm', Snow: 'Snow', Mist: 'Mist' },
    hi: { Clear: 'साफ आसमान', Clouds: 'बादल', Rain: 'बारिश', Drizzle: 'फुहार', Thunderstorm: 'आंधी', Snow: 'बर्फ', Mist: 'धुंध' },
    kn: { Clear: 'Clear sky', Clouds: 'Cloudy', Rain: 'Rain', Drizzle: 'Drizzle', Thunderstorm: 'Storm', Snow: 'Snow', Mist: 'Mist' },
    mr: { Clear: 'Clear sky', Clouds: 'Cloudy', Rain: 'Rain', Drizzle: 'Drizzle', Thunderstorm: 'Storm', Snow: 'Snow', Mist: 'Mist' },
    te: { Clear: 'Clear sky', Clouds: 'Cloudy', Rain: 'Rain', Drizzle: 'Drizzle', Thunderstorm: 'Storm', Snow: 'Snow', Mist: 'Mist' },
    ta: { Clear: 'Clear sky', Clouds: 'Cloudy', Rain: 'Rain', Drizzle: 'Drizzle', Thunderstorm: 'Storm', Snow: 'Snow', Mist: 'Mist' },
    pa: { Clear: 'Clear sky', Clouds: 'Cloudy', Rain: 'Rain', Drizzle: 'Drizzle', Thunderstorm: 'Storm', Snow: 'Snow', Mist: 'Mist' },
    bn: { Clear: 'Clear sky', Clouds: 'Cloudy', Rain: 'Rain', Drizzle: 'Drizzle', Thunderstorm: 'Storm', Snow: 'Snow', Mist: 'Mist' },
    gu: { Clear: 'Clear sky', Clouds: 'Cloudy', Rain: 'Rain', Drizzle: 'Drizzle', Thunderstorm: 'Storm', Snow: 'Snow', Mist: 'Mist' },
  }

  return dictionary[language][icon] || dictionary[language].Clear
}

const getFallbackFarmAction = (
  condition: string,
  rainChance = 0,
  humidity = 0,
  language: SupportedLanguage = 'en'
) => {
  const normalized = condition.toLowerCase()
  if (language === 'hi') {
    if (normalized.includes('thunderstorm')) return 'औजार सुरक्षित रखें और खुले खेत में स्प्रे न करें।'
    if (normalized.includes('rain') || rainChance >= 0.6) return 'आज सिंचाई रोकें और निकासी नालियों की जांच करें।'
    if (humidity >= 85) return 'शाम से पहले फफूंद के जोखिम के लिए फसल देखें।'
    if (normalized.includes('clear')) return 'सूखे मौसम की इस खिड़की का उपयोग सिंचाई और स्प्रे के लिए करें।'
    return 'खेत की नमी जांचें और तय किया हुआ काम सावधानी से जारी रखें।'
  }

  if (normalized.includes('thunderstorm')) return 'Secure tools and avoid spraying in open fields.'
  if (normalized.includes('rain') || rainChance >= 0.6) return 'Pause irrigation and inspect drainage channels today.'
  if (humidity >= 85) return 'Scout crops for fungal pressure before sunset.'
  if (normalized.includes('clear')) return 'Use the dry window for irrigation and field spraying.'
  return 'Check field moisture and continue planned farm work carefully.'
}

const buildMockForecast = (language: SupportedLanguage = 'en'): ForecastDay[] =>
  Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(), index)
    return {
      date: format(date, 'yyyy-MM-dd'),
      tempMax: 33 - (index % 3),
      tempMin: 24 - (index % 2),
      description: index % 3 === 1 ? (language === 'hi' ? 'हल्की बारिश' : 'Light rain') : (language === 'hi' ? 'आंशिक बादल' : 'Partly cloudy'),
      icon: index % 3 === 1 ? 'Rain' : 'Clouds',
      humidity: index % 3 === 1 ? 86 : 70,
      windSpeed: index % 2 === 0 ? 4.2 : 5.5,
      precipitationChance: index % 3 === 1 ? 0.7 : 0.2,
      rainfallMm: index % 3 === 1 ? 9 : 0,
      farmAction: index % 3 === 1
        ? (language === 'hi' ? 'सिंचाई टालें और खेत में पानी जमा होने पर नजर रखें।' : 'Delay irrigation and watch for standing water.')
        : (language === 'hi' ? 'सामान्य खेत कार्यों के लिए अच्छा समय है।' : 'Good window for routine field operations.'),
      actionColor: index % 3 === 1 ? 'yellow' : 'green',
    }
  })

const hasApiKey = () => API_KEY.trim().length > 0

export const getMockWeather = (language: SupportedLanguage = 'en'): WeatherData => ({
  temp: 32,
  feelsLike: 35,
  humidity: 72,
  description: language === 'hi' ? 'आंशिक बादल' : 'Partly cloudy',
  icon: 'Clouds',
  windSpeed: 4.8,
  location: language === 'hi' ? 'बेलागवी' : 'Belgaum',
  precipitationChance: 0.2,
  rainfallMm: 0,
})

export const getMockForecast = (language: SupportedLanguage = 'en'): ForecastDay[] => buildMockForecast(language)

export const fetchCurrentWeather = async (
  lat: number,
  lon: number,
  languageInput: string = 'en'
): Promise<WeatherData> => {
  const language = normalizeSupportedLanguage(languageInput)
  if (!hasApiKey()) return getMockWeather(language)

  const { data } = await apiClient.get<OpenWeatherCurrentResponse>(`${WEATHER_BASE}/weather`, {
    params: { lat, lon, appid: API_KEY, units: 'metric', lang: language },
  })

  const weather = getWeatherPrimary(data.weather)

  return {
    temp: data.main.temp,
    feelsLike: data.main.feels_like,
    humidity: data.main.humidity,
    description: weather?.description || getLocalizedWeatherDescription(weather?.main || 'Clear', language),
    icon: weather?.main || 'Clear',
    windSpeed: data.wind?.speed ?? 0,
    location: data.name || (language === 'hi' ? 'आपका खेत' : 'Your farm'),
    precipitationChance: (data.clouds?.all ?? 0) / 100,
    rainfallMm: data.rain?.['1h'] ?? 0,
  }
}

const mapThreeHourForecast = (
  entries: ForecastListEntry[],
  language: SupportedLanguage
): ForecastDay[] => {
  const grouped = new Map<string, ForecastListEntry[]>()

  entries.forEach(entry => {
    const date = entry.dt_txt.slice(0, 10)
    const bucket = grouped.get(date) ?? []
    bucket.push(entry)
    grouped.set(date, bucket)
  })

  return Array.from(grouped.entries())
    .slice(0, 7)
    .map(([date, dayEntries]) => {
      const temps = dayEntries.map(item => item.main.temp)
      const humidities = dayEntries.map(item => item.main.humidity)
      const windSpeeds = dayEntries.map(item => item.wind?.speed ?? 0)
      const rainChances = dayEntries.map(item => item.pop ?? 0)
      const rainTotals = dayEntries.reduce((sum, item) => sum + (item.rain?.['3h'] ?? 0), 0)
      const representative =
        dayEntries.find(item => item.dt_txt.includes('12:00:00')) ??
        dayEntries[Math.floor(dayEntries.length / 2)] ??
        dayEntries[0]
      const weather = getWeatherPrimary(representative.weather)
      const humidity = humidities.reduce((sum, value) => sum + value, 0) / humidities.length
      const windSpeed = Math.max(...windSpeeds)
      const precipitationChance = Math.max(...rainChances)
      const condition = weather?.description || weather?.main || 'Clear'

      return {
        date,
        tempMax: Math.max(...temps),
        tempMin: Math.min(...temps),
        description: condition,
        icon: weather?.main || 'Clear',
        humidity,
        windSpeed,
        precipitationChance,
        rainfallMm: rainTotals,
        farmAction: getFallbackFarmAction(condition, precipitationChance, humidity, language),
        actionColor: getActionColorFromCondition(condition, precipitationChance, windSpeed),
      }
    })
}

export const fetchForecast = async (
  lat: number,
  lon: number,
  languageInput: string = 'en'
): Promise<ForecastDay[]> => {
  const language = normalizeSupportedLanguage(languageInput)
  if (!hasApiKey()) return buildMockForecast(language)

  const { data } = await apiClient.get<ForecastResponse>(`${WEATHER_BASE}/forecast`, {
    params: { lat, lon, appid: API_KEY, units: 'metric', lang: language },
  })

  return mapThreeHourForecast(data.list, language)
}

export const reverseGeocodeLocation = async (lat: number, lon: number): Promise<ReverseGeocodeResult> => {
  if (!hasApiKey()) {
    return {
      label: 'Selected farm location',
      village: '',
      district: '',
      state: '',
    }
  }

  const { data } = await apiClient.get<ReverseGeoEntry[]>(`${GEO_BASE}/reverse`, {
    params: { lat, lon, appid: API_KEY, limit: 1 },
  })

  const match = data[0]
  const village = match?.name || ''
  const state = match?.state || ''
  const district = match?.name || ''
  const labelParts = [village, state || match?.country].filter(Boolean)

  return {
    label: labelParts.join(', ') || 'Selected farm location',
    village,
    district,
    state,
  }
}
