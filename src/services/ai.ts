import type { FarmerProfile } from '../store/useAuthStore'
import { generateAiText } from './gemini/geminiClient'
import { detectSpeechLanguage } from '../utils/speechLanguage'

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
  if (!farmer) return 'Farmer profile unavailable. Assume a small Indian farmer.'

  return [
    `Name: ${farmer.name || 'Farmer'}`,
    `State: ${farmer.state || 'Unknown'}`,
    `District: ${farmer.district || 'Unknown'}`,
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
}) {
  const languageProfile = detectSpeechLanguage(params.question, params.language)
  const systemPrompt = `You are Sarpanch Salah, a trusted farming expert for Indian farmers.
The app language is ${getLanguageLabel(params.language)}, but the farmer's latest message decides the reply language.
Detected latest message language: ${languageProfile.label}${languageProfile.isMixed ? ' mixed with English' : ''}.
Language rule: ${languageProfile.instruction}
Rules:
- Keep every answer under 5 short lines.
- Be practical and step-based when useful.
- Prefer cost-aware, low-risk advice.
- If information is missing, ask only one short question.
- Match the farmer's script and style. Hindi voice should get Hindi, English should get English, Kannada should get Kannada, and mixed input should get the same natural mix.
- Use clear speakable sentences. Avoid symbols, markdown, tables, long lists, and heavy punctuation because the answer will be read aloud.
- Plain text only. No markdown. No long explanations.`

  const userMessage = `Farmer context:
${buildFarmerContext(params.farmer)}

Farmer question:
${params.question}`

  try {
    return await generateAiText({
      systemPrompt,
      userMessage,
      history: params.history,
      model: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
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
