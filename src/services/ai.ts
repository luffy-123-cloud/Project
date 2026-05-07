import type { FarmerProfile } from '../store/useAuthStore'
import { generateAiText } from './gemini/geminiClient'
import { detectSpeechLanguage } from '../utils/speechLanguage'
import { getMandiPrice } from './mandi'
import { fetchCurrentWeather, fetchForecast } from './weatherService'

type ChatTurn = { role: 'user' | 'model'; content: string }

type FarmerAIContext = Pick<
  FarmerProfile,
  'name' | 'district' | 'state' | 'village' | 'landHolding' | 'crops' | 'waterSource'
>

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  kn: 'Kannada',
  mr: 'Marathi',
  te: 'Telugu',
  bn: 'Bengali',
  ta: 'Tamil',
  pa: 'Punjabi',
  gu: 'Gujarati',
}

const getLanguageLabel = (language: string) => LANGUAGE_LABELS[language] || 'Hindi'

const buildFarmerContext = (farmer?: Partial<FarmerAIContext> | null) => {
  if (!farmer) return 'Farmer profile unavailable. Assume a small Indian farmer in Belgaum, Karnataka.'

  return [
    `Name: ${farmer.name || 'Farmer'}`,
    `State: ${farmer.state || 'Karnataka'}`,
    `District: ${farmer.district || 'Belagavi'}`,
    `Village: ${farmer.village || 'Unknown'}`,
    `Land holding: ${farmer.landHolding || 'Unknown'}`,
    `Main crops: ${farmer.crops?.join(', ') || 'Not specified'}`,
    `Water source: ${farmer.waterSource || 'Unknown'}`,
  ].join('\n')
}

const getSarpanchFallback = (language: string) => {
  const replies: Record<string, string> = {
    hi: '1. Network slow hai.\n2. Sawal chhota karke dobara bhejiye.\n3. Aaj kheti ka ek kaam chun kar uspar dhyan dijiye.',
    kn: '1. Network swalpa slow ide.\n2. Prashne short aagi matte kalisi.\n3. Ivattu ondu mukhya kelasa modalu madi.',
  }

  return replies[language] || '1. The network is slow.\n2. Send one short question again.\n3. Focus on one farm action for today.'
}

const getLanguageMatchedFallback = (language: string, isMixed: boolean) => {
  if (isMixed) {
    return '1. Network slow hai, please ek short sawaal dobara bhejiye.\n2. Main same mixed language me jawab dunga.\n3. Aaj ka kaam: signal check karke question repeat kijiye.'
  }

  return getSarpanchFallback(language)
}

export async function askSarpanchSalah(params: {
  question: string
  language: string
  farmer?: Partial<FarmerAIContext> | null
  history?: ChatTurn[]
  coords?: { lat: number; lon: number }
}) {
  const languageProfile = detectSpeechLanguage(params.question, params.language)
  
  // Dynamic Data Integration
  let additionalContext = ''
  
  try {
    const questionLower = params.question.toLowerCase()
    const isMarketQuery = /price|mandi|rate|sell|bhav|market|kimat|daam|bazaar/i.test(params.question)
    const isWeatherQuery = /rain|weather|temperature|forecast|barish|mosam|hava|pani|vataru/i.test(params.question)
    
    if (isMarketQuery) {
      // Find all crops to query: those mentioned in question OR all from profile if generic market query
      const profileCrops = params.farmer?.crops || []
      const mentionedCrops = profileCrops.filter(crop => questionLower.includes(crop.toLowerCase()))
      
      // If a specific crop like "Tomato" is asked but not in profile, add it to search
      const commonCrops = ['Tomato', 'Onion', 'Potato', 'Wheat', 'Rice', 'Cotton', 'Maize', 'Soybean', 'Chilli']
      commonCrops.forEach(c => {
        if (questionLower.includes(c.toLowerCase()) && !mentionedCrops.includes(c)) {
          mentionedCrops.push(c)
        }
      })

      const targetCrops = mentionedCrops.length > 0 ? mentionedCrops : (profileCrops.length > 0 ? profileCrops : ['Wheat'])
      
      additionalContext += '\n--- MANDI INTELLIGENCE ---'
      for (const crop of targetCrops.slice(0, 5)) { // Limit to 5 crops to cover more listed items
        const mandiData = await getMandiPrice(crop, {
          state: params.farmer?.state,
          district: params.farmer?.district
        })
        
        if (mandiData.isLiveData) {
          additionalContext += `\nCrop: ${crop}. Max: ₹${mandiData.maxPrice}, Avg: ₹${mandiData.avgPrice} (Quintal).`
          if (mandiData.nearbyMandis?.length) {
            const specificMandis = mandiData.nearbyMandis.slice(0, 4).map(m => `${m.mandi} (₹${m.pricePerQuintal})`).join(', ')
            additionalContext += ` Specific Mandis: ${specificMandis}.`
          }
        } else {
          additionalContext += `\nCrop: ${crop}. Live market data currently unavailable for your specific district, using state averages.`
        }
      }
    }
    
    if (isWeatherQuery && params.coords) {
      const weather = await fetchCurrentWeather(params.coords.lat, params.coords.lon, params.language)
      additionalContext += `\n--- WEATHER DATA ---\nTemperature: ${weather.temp}°C, Condition: ${weather.description}. Humidity: ${weather.humidity}%.`
    }
  } catch (e) {
    console.warn('Context fetching failed', e)
  }

  const systemPrompt = `You are Sarpanch AI, a high-fidelity agricultural operating system copilot.
Your goal is to provide elite agricultural intelligence.

INTERNAL CONFIG (DO NOT ECHO IN RESPONSE):
- Target Language: ${languageProfile.label}
- Target Script: ${languageProfile.isMixed || !languageProfile.instruction.includes('native') ? 'Latin/Latin' : 'Native/Native'}
- Style Guide: ${languageProfile.instruction}

CRITICAL RULES:
1. MIRROR THE FARMER: You MUST reply in the EXACT language and script detected above.
2. STAY ON TOPIC: You are strictly an agricultural assistant. If the user asks anything off-topic (non-farming, movies, politics, general chat, etc.), you MUST politely decline in the detected native language and script (e.g., if asked in Hindi, reply "मैं इस कार्य के लिए नियुक्त नहीं हूँ..." etc.). Your decline message should convey: "I am not assigned for that task. Please ask me about crops, mandis, or weather."
3. NO ECHO: Never include internal metadata in your response.
3. NO MARKDOWN: Use plain text only. Use 1., 2. for lists.
4. CONCISE: Keep response under 90 words.
5. MANDI: Always mention specific Mandi names and prices if asked.

Today's Farmer Context:
${buildFarmerContext(params.farmer)}
${additionalContext}

Rules for ending:
- For off-topic declines, just provide the decline message.
- For all valid farming advice, always end with exactly one line: "Today's Farm Action: <one clear actionable step>"`

  const userMessage = `Farmer question: ${params.question}`

  try {
    return await generateAiText({
      systemPrompt,
      userMessage,
      history: params.history,
      model: ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    })
  } catch (error) {
    console.warn('[AI] Sarpanch Salah fallback', error)
    return getLanguageMatchedFallback(languageProfile.language, languageProfile.isMixed)
  }
}

const getSoilFallback = (language: string, crop: string) => {
  if (language === 'hi') {
    return [
      `1. ${crop} ke liye nitrogen ko santulit rakhein.`,
      '2. Gobar khaad ya compost 1-2 trolley per acre dein.',
      '3. NPK kam ho to split dose me fertilizer dein.',
      '4. Agli sinchai se pehle mitti nam rakhein, pani jama na hone dein.',
      '5. Behtar suitability ke liye pH aur organic carbon test bhi karvaen.',
    ].join('\n')
  }

  return [
    `1. Keep nitrogen balanced for ${crop}.`,
    '2. Add compost or farmyard manure before the next irrigation.',
    '3. Apply missing NPK in split doses, not all at once.',
    '4. Avoid waterlogging and keep the soil evenly moist.',
    '5. Test pH and organic carbon for a better recommendation.',
  ].join('\n')
}

export async function analyzeSoilHealth(params: {
  soilType: string
  crop: string
  npk?: { n?: string; p?: string; k?: string }
  language: string
}) {
  const systemPrompt = `You are a soil health advisor for Indian farmers.
Reply in simple ${getLanguageLabel(params.language)}.
Return at most 5 short bullet-style lines.
Include:
- fertilizer suggestion
- crop suitability
- one practical next step
Keep it low-literacy friendly.`

  const userMessage = `Soil type: ${params.soilType}
Crop: ${params.crop}
N: ${params.npk?.n || 'Not provided'}
P: ${params.npk?.p || 'Not provided'}
K: ${params.npk?.k || 'Not provided'}`

  try {
    return await generateAiText({
      systemPrompt,
      userMessage,
      model: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    })
  } catch (error) {
    console.warn('[AI] Soil analysis fallback', error)
    return getSoilFallback(params.language, params.crop)
  }
}

const getContractFallback = (language: string) => {
  if (language === 'hi') {
    return 'RISKY\n1. Bhugtan ki tareekh saaf likhi honi chahiye.\n2. Quality reject rule dhyan se padhiye.\n3. Der se payment par penalty clause maangiye.\n4. Vivaad ki sthiti me likhit record rakhiye.'
  }

  return 'RISKY\n1. Confirm the payment date in writing.\n2. Check quality rejection clauses carefully.\n3. Ask for a late-payment penalty.\n4. Keep a written dispute trail.'
}

export async function analyzeContractRisk(params: {
  contractText: string
  language: string
}) {
  const systemPrompt = `You analyze farm sale contracts for Indian farmers.
Reply in simple ${getLanguageLabel(params.language)}.
Format:
SAFE or RISKY
Then up to 4 short lines.
You must:
- highlight risky clauses
- simplify them
- keep language actionable`

  try {
    return await generateAiText({
      systemPrompt,
      userMessage: params.contractText,
      model: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    })
  } catch (error) {
    console.warn('[AI] Contract analysis fallback', error)
    return getContractFallback(params.language)
  }
}
