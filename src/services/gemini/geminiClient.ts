// src/services/gemini/geminiClient.ts
// Gemini API client with feature-specific system prompts
import { GoogleGenerativeAI, type GenerateContentResult, type Part } from '@google/generative-ai'
import { apiAvailability, env, runtimeSecurity } from '../../config/env'
import type { LeafDiseaseAnalysis, LeafTreatment } from '../../types/leafScanner'
import type { CropAdvisoryResult, CropAdvisoryCrop, AdvisoryDifficulty, AdvisoryProfitLevel, AdvisoryRiskLevel, AdvisoryWaterRequirement, BudgetCompatibility } from '../../types/cropAdvisory'

let genAI: GoogleGenerativeAI | null = null
let hasWarnedAboutBrowserGemini = false

const getApiKey = () => {
  if (apiAvailability.hasGeminiKey) return env.geminiApiKey

  if (runtimeSecurity.geminiBlockedInBrowser && !hasWarnedAboutBrowserGemini) {
    console.warn(
      '[Gemini] Browser-side Gemini is disabled in production. Use a backend proxy or set VITE_ALLOW_BROWSER_GEMINI=true only for temporary demos.'
    )
    hasWarnedAboutBrowserGemini = true
  }

  return ''
}

const getClient = () => {
  const apiKey = getApiKey()
  if (!genAI && apiKey) genAI = new GoogleGenerativeAI(apiKey)
  return genAI
}

// ─── Language mapping ───────────────────────────────────────────────────────
const LANG_NAMES: Record<string, string> = {
  hi: 'Hindi (हिंदी)',
  en: 'English',
  mr: 'Marathi',
  te: 'Telugu',
  gu: 'Gujarati',
  kn: 'Kannada (ಕನ್ನಡ)',
  bn: 'Bengali (বাংলা)',
  ta: 'Tamil (தமிழ்)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
}

interface GenerateOptions {
  history?: Array<{ role: 'user' | 'model'; content: string }>
  model?: string | string[]
}

const DEFAULT_TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']
const DEFAULT_VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']
const SARPANCH_CHAT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']
const SARPANCH_TTS_MODELS = ['gemini-2.5-flash-preview-tts']

const TEXT_MODEL_TIMEOUT_MS: Record<string, number> = {
  'gemini-2.5-flash': 12_000,
  'gemini-2.5-flash-lite': 8_000,
  'gemini-2.5-pro': 20_000,
}

const TTS_MODEL_TIMEOUT_MS: Record<string, number> = {
  'gemini-2.5-flash-preview-tts': 2_600,
}

const FAST_GENERATION_CONFIG = {
  maxOutputTokens: 900,
  temperature: 0.45,
  topP: 0.9,
}

const CONTINUATION_TIMEOUT_EXTRA_MS = 2200
const CONTINUE_PROMPT =
  'Continue from exactly where you stopped. Do not restart, do not repeat, and keep the same language and tone.'

type ChatTurn = { role: 'user' | 'model'; parts: Array<{ text: string }> }

interface CandidatePart {
  text?: string
}

interface CandidateContent {
  parts?: CandidatePart[]
}

interface ResponseCandidate {
  finishReason?: string
  content?: CandidateContent
}

interface GeminiResponseLike {
  text?: () => string
  candidates?: ResponseCandidate[]
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const normalizeHistory = (
  history?: Array<{ role: 'user' | 'model'; content: string }>
): ChatTurn[] => {
  if (!history?.length) return []

  const normalized: ChatTurn[] = []

  for (const turn of history) {
    const text = turn.content?.trim()
    if (!text) continue

    const role: 'user' | 'model' = turn.role === 'model' ? 'model' : 'user'

    // Gemini chat history is most stable when it starts with user content.
    if (!normalized.length && role === 'model') {
      continue
    }

    const previous = normalized[normalized.length - 1]
    if (previous && previous.role === role) {
      previous.parts[0].text += `\n${text}`
      continue
    }

    normalized.push({ role, parts: [{ text }] })
  }

  return normalized
}

const extractResponseText = (result: GenerateContentResult): string => {
  const response = result.response as GeminiResponseLike
  const fromTextFn = typeof response.text === 'function' ? response.text().trim() : ''
  if (fromTextFn) return fromTextFn

  const fromParts = (response.candidates || [])
    .flatMap(candidate => candidate.content?.parts || [])
    .map(part => part.text?.trim() || '')
    .filter(Boolean)
    .join('\n')
    .trim()

  return fromParts
}

const getFinishReason = (result: GenerateContentResult): string => {
  const response = result.response as GeminiResponseLike
  return response.candidates?.[0]?.finishReason || 'UNKNOWN'
}

const isLikelyTruncated = (finishReason: string): boolean => finishReason.toUpperCase() === 'MAX_TOKENS'

const looksIncompleteText = (text: string): boolean => {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return false
  if (compact.length < 40) return false
  const lastChar = compact.slice(-1)
  // If answer does not end cleanly, request continuation.
  if (!/[.!?।]/.test(lastChar)) return true
  // Common abrupt endings from cut generations.
  if (/(and|or|because|so|but|then|for example|e\.g)\s*[.:;,-]?$/i.test(compact)) return true
  return false
}

const mergeContinuation = (baseText: string, continuationText: string): string => {
  const base = baseText.trim()
  const continuation = continuationText.trim()

  if (!base) return continuation
  if (!continuation) return base
  if (base.endsWith(continuation)) return base
  if (continuation.startsWith(base)) return continuation

  const maxOverlap = Math.min(120, base.length, continuation.length)
  for (let overlap = maxOverlap; overlap >= 16; overlap--) {
    const baseTail = base.slice(-overlap).toLowerCase()
    const continuationHead = continuation.slice(0, overlap).toLowerCase()
    if (baseTail === continuationHead) {
      return `${base}${continuation.slice(overlap)}`.trim()
    }
  }

  return `${base} ${continuation}`.replace(/\s+/g, ' ').trim()
}

const getSarpanchChatFallback = (language: string): string => {
  const fallbacks: Record<string, string> = {
    hi: 'Abhi network thoda slow hai. Aapka sawaal mil gaya hai. Kripya 10 second baad dubara puchhiye ya typing se bhejiye.',
    en: 'The network is slow right now. I received your question. Please ask again in 10 seconds or use typing.',
    kn: 'Iga network swalpa nidhanavide. Nimma prashne sikide. 10 second nantara matte keli athava typing madi.',
    bn: 'Ekhon network dhire kaj korche. Apnar proshno peyechi. 10 second pore abar bolun ba type korun.',
    ta: 'Ippothu network konjam slow. Ungal kelvi vandhulladhu. 10 vinadi pinbu thirumba kelunga allathu type pannunga.',
    pa: 'Hun network thoda slow hai. Tuhada sawal mil gaya hai. 10 second baad dubara pucho ya type karo.',
  }

  const message = fallbacks[language] || fallbacks.en
  return `${message}\nToday's Farm Action: Check mobile signal and ask one short question again.`
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

// ─── Core generator ────────────────────────────────────────────────────────
async function generate(
  systemPrompt: string,
  userMessage: string,
  options: GenerateOptions = {}
): Promise<string> {
  if (runtimeSecurity.geminiBlockedInBrowser) {
    return 'Secure mode is active. Browser-side Gemini is disabled in production. Move AI requests to a backend or temporarily opt in with VITE_ALLOW_BROWSER_GEMINI=true.'
  }

  const client = getClient()
  if (!client) {
    console.warn('[Gemini] No API key configured — returning mock response')
    return getMockResponse(userMessage)
  }

  const candidateModels = Array.isArray(options.model)
    ? options.model
    : options.model
      ? [options.model]
      : DEFAULT_TEXT_MODELS

  const uniqueCandidateModels = Array.from(new Set(candidateModels.filter(Boolean)))
  const normalizedHistory = normalizeHistory(options.history)
  let lastError: unknown = null

  for (const modelName of uniqueCandidateModels) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: FAST_GENERATION_CONFIG,
      })
      const timeoutMs = TEXT_MODEL_TIMEOUT_MS[modelName] ?? 8000

      if (normalizedHistory.length) {
        const chat = model.startChat({ history: normalizedHistory })
        let result = await withTimeout(chat.sendMessage(userMessage), timeoutMs, modelName)
        let text = extractResponseText(result)
        let finishReason = getFinishReason(result)

        if (!text) {
          result = await withTimeout(
            chat.sendMessage('Reply in plain text only and give a complete answer.'),
            timeoutMs,
            `${modelName} retry`
          )
          text = extractResponseText(result)
          finishReason = getFinishReason(result)
        }

        if (text && (isLikelyTruncated(finishReason) || looksIncompleteText(text))) {
          const continuationResult = await withTimeout(
            chat.sendMessage(CONTINUE_PROMPT),
            timeoutMs + CONTINUATION_TIMEOUT_EXTRA_MS,
            `${modelName} continuation`
          )
          const continuationText = extractResponseText(continuationResult)
          if (continuationText) {
            text = mergeContinuation(text, continuationText)
          }
        }

        if (!text) {
          throw new Error(`Gemini returned an empty response (finishReason: ${finishReason}).`)
        }

        return text
      }

      let result: GenerateContentResult = await withTimeout(
        model.generateContent(userMessage),
        timeoutMs,
        modelName
      )
      let text = extractResponseText(result)
      let finishReason = getFinishReason(result)

      if (!text) {
        result = await withTimeout(
          model.generateContent(`${userMessage}\n\nReply in plain text only and give a complete answer.`),
          timeoutMs,
          `${modelName} retry`
        )
        text = extractResponseText(result)
        finishReason = getFinishReason(result)
      }

      if (text && (isLikelyTruncated(finishReason) || looksIncompleteText(text))) {
        const continuationResult = await withTimeout(
          model.generateContent(
            `Continue this answer from where it stopped. Do not repeat previous content.

Question:
${userMessage}

Answer so far:
${text}`
          ),
          timeoutMs + CONTINUATION_TIMEOUT_EXTRA_MS,
          `${modelName} continuation`
        )
        const continuationText = extractResponseText(continuationResult)
        if (continuationText) {
          text = mergeContinuation(text, continuationText)
        }
      }

      if (!text) {
        throw new Error(`Gemini returned an empty response (finishReason: ${finishReason}).`)
      }

      return text
    } catch (error) {
      lastError = error
      const errorMsg = error instanceof Error ? error.message : String(error)
      const isQuotaError = errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota')

      console.warn(`[Gemini] ${modelName} failed`, error)

      if (isQuotaError) {
        // Wait 2 seconds before potentially trying another model (if any left in loop)
        await delay(2000)
        continue
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Gemini request failed for all configured text models.')
}

export async function generateAiText(params: {
  systemPrompt: string
  userMessage: string
  history?: Array<{ role: 'user' | 'model'; content: string }>
  model?: string | string[]
}): Promise<string> {
  return generate(params.systemPrompt, params.userMessage, {
    history: params.history,
    model: params.model,
  })
}

const toAdvisoryWaterRequirement = (value: unknown): AdvisoryWaterRequirement => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'low') return 'Low'
  if (normalized === 'high') return 'High'
  return 'Medium'
}

const toAdvisoryProfitLevel = (value: unknown): AdvisoryProfitLevel => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'low') return 'Low'
  if (normalized === 'high') return 'High'
  return 'Medium'
}

const toAdvisoryDifficulty = (value: unknown): AdvisoryDifficulty => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'easy') return 'Easy'
  if (normalized === 'hard') return 'Hard'
  return 'Moderate'
}

const toAdvisoryRiskLevel = (value: unknown): AdvisoryRiskLevel => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'low') return 'Low'
  if (normalized === 'high') return 'High'
  return 'Medium'
}

const toBudgetCompatibility = (value: unknown, budgetProvided: boolean): BudgetCompatibility => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!budgetProvided) return 'Not provided'
  if (normalized.includes('fits')) return 'Fits Well'
  if (normalized.includes('manageable')) return 'Manageable'
  if (normalized.includes('stretch')) return 'Stretch'
  if (normalized.includes('over')) return 'Over Budget'
  return 'Manageable'
}

const normalizeCropAdvisoryResult = (
  data: unknown,
  budgetProvided: boolean,
  fallbackLocation: string,
): CropAdvisoryResult => {
  if (!data || typeof data !== 'object') {
    const baseSuggestion = budgetProvided
      ? 'Choose crops with staggered spending and start input procurement in phases.'
      : 'Compare seed, irrigation, and labour needs before final crop selection.'
    const fallbackCrops: CropAdvisoryCrop[] = [
      {
        cropName: 'Maize',
        reason: `Weather and field conditions around ${fallbackLocation || 'your area'} support a balanced risk profile.`,
        waterRequirement: 'Medium',
        profitLevel: 'Medium',
        difficulty: 'Moderate',
        riskLevel: 'Medium',
        riskExplanation: 'Returns depend on timely irrigation and pest scouting during key growth stages.',
        suggestion: baseSuggestion,
        budgetCompatibility: budgetProvided ? 'Manageable' : 'Not provided',
        estimatedCostInr: budgetProvided ? 18000 : undefined,
      },
      {
        cropName: 'Green gram',
        reason: 'Fits short-season planning and handles moderate input pressure well.',
        waterRequirement: 'Low',
        profitLevel: 'Medium',
        difficulty: 'Easy',
        riskLevel: 'Low',
        riskExplanation: 'Lower water demand reduces pressure when rainfall becomes uneven.',
        suggestion: 'Keep seed treatment and weed control ready before sowing.',
        budgetCompatibility: budgetProvided ? 'Fits Well' : 'Not provided',
        estimatedCostInr: budgetProvided ? 12000 : undefined,
      },
      {
        cropName: 'Groundnut',
        reason: 'Offers market potential where drainage and sunshine stay favorable.',
        waterRequirement: 'Medium',
        profitLevel: 'High',
        difficulty: 'Moderate',
        riskLevel: 'Medium',
        riskExplanation: 'Disease and moisture swings can reduce yield without timely scouting.',
        suggestion: 'Plan fungicide and gypsum inputs ahead of flowering.',
        budgetCompatibility: budgetProvided ? 'Stretch' : 'Not provided',
        estimatedCostInr: budgetProvided ? 22000 : undefined,
      },
      {
        cropName: 'Pearl millet',
        reason: 'Works well as a resilient option when water security is limited.',
        waterRequirement: 'Low',
        profitLevel: 'Low',
        difficulty: 'Easy',
        riskLevel: 'Low',
        riskExplanation: 'Lower sensitivity to moisture stress keeps production steadier.',
        suggestion: 'Use as a safer backup crop if rainfall stays uncertain.',
        budgetCompatibility: budgetProvided ? 'Fits Well' : 'Not provided',
        estimatedCostInr: budgetProvided ? 9000 : undefined,
      },
      {
        cropName: 'Sesame',
        reason: 'Useful for lighter soils and lower irrigation dependency.',
        waterRequirement: 'Low',
        profitLevel: 'Medium',
        difficulty: 'Moderate',
        riskLevel: 'Medium',
        riskExplanation: 'Poor drainage and late rains can still affect establishment.',
        suggestion: 'Sow only after field drainage and seedbed quality are confirmed.',
        budgetCompatibility: budgetProvided ? 'Manageable' : 'Not provided',
        estimatedCostInr: budgetProvided ? 10000 : undefined,
      },
    ]

    return {
      crops: fallbackCrops,
      overallRiskLevel: 'Medium',
      overallRiskExplanation: 'Conditions are workable, but final crop choice should still match rainfall and water access.',
      overallSuggestion: baseSuggestion,
      budgetSummary: budgetProvided
        ? {
            estimatedCostInr: 18000,
            budgetFit: 'Manageable for phased spending',
          }
        : undefined,
    }
  }

  const record = data as Record<string, unknown>
  const rawCrops = Array.isArray(record.crops) ? record.crops : []
  const crops: CropAdvisoryCrop[] = rawCrops.slice(0, 5).map((item, index) => {
    const crop = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const estimatedCostInr = Number(crop.estimatedCostInr ?? crop.estimatedCost ?? 0)

    return {
      cropName: String(crop.cropName || crop.name || `Crop ${index + 1}`).trim(),
      reason: String(crop.reason || 'Suitable for current farm conditions.').trim(),
      waterRequirement: toAdvisoryWaterRequirement(crop.waterRequirement),
      profitLevel: toAdvisoryProfitLevel(crop.profitLevel),
      difficulty: toAdvisoryDifficulty(crop.difficulty),
      riskLevel: toAdvisoryRiskLevel(crop.riskLevel),
      riskExplanation: String(crop.riskExplanation || 'Weather and input volatility remain manageable with regular monitoring.').trim(),
      suggestion: String(crop.suggestion || 'Prepare seed and input plans before sowing.').trim(),
      budgetCompatibility: toBudgetCompatibility(crop.budgetCompatibility, budgetProvided),
      estimatedCostInr: Number.isFinite(estimatedCostInr) && estimatedCostInr > 0 ? Math.round(estimatedCostInr) : undefined,
    }
  })

  if (!crops.length) {
    return normalizeCropAdvisoryResult(null, budgetProvided, fallbackLocation)
  }

  while (crops.length < 5) {
    crops.push({
      ...crops[crops.length - 1],
      cropName: `${crops[crops.length - 1].cropName} Option ${crops.length + 1}`,
    })
  }

  const budgetEstimatedCost = Number(record.budgetEstimatedCostInr ?? record.estimatedCostInr ?? 0)
  const budgetFit = String(record.budgetFit || record.budgetCompatibility || '').trim()

  return {
    crops,
    overallRiskLevel: toAdvisoryRiskLevel(record.overallRiskLevel || crops[0]?.riskLevel),
    overallRiskExplanation: String(
      record.overallRiskExplanation ||
        record.riskExplanation ||
        crops[0]?.riskExplanation ||
        'Monitor rainfall and input costs before finalizing the crop mix.',
    ).trim(),
    overallSuggestion: String(
      record.overallSuggestion ||
        record.suggestion ||
        crops[0]?.suggestion ||
        'Choose one primary crop and one lower-risk backup option.',
    ).trim(),
    budgetSummary:
      budgetProvided && Number.isFinite(budgetEstimatedCost) && budgetEstimatedCost > 0
        ? {
            estimatedCostInr: Math.round(budgetEstimatedCost),
            budgetFit: budgetFit || 'Budget appears manageable for the recommended crop mix.',
          }
        : undefined,
  }
}

// ─── Mock fallback (dev without API key) ────────────────────────────────────
function getMockResponse(context: string): string {
  return `[Mock Response] Gemini would answer: "${context.slice(0, 80)}..." — Add VITE_GEMINI_API_KEY to enable real AI.`
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 1: Today's Plan — Farm Decision Engine
// Returns 3 prioritized farm actions as JSON
// ══════════════════════════════════════════════════════════════════════════════
export async function getTodaysPlan(params: {
  crop: string
  growthStage: string
  weather: string
  mandiPriceTrend: string
  communityAlerts: string
  language: string
}): Promise<string> {
  const lang = LANG_NAMES[params.language] || 'Hindi'
  const system = `You are a precision farm decision engine for Indian smallholder farmers.
Given today's farm context, generate exactly 3 prioritized farm decisions.
Output ONLY a valid JSON array, no markdown, no explanation:
[{"icon":"emoji","action":"verb phrase max 5 words","reason":"one sentence max 12 words","priority":"high|medium|low","color":"red|yellow|green"}]
Color rules: red=do it NOW (urgent risk), yellow=do it TODAY (caution), green=this week (safe).
Use simple words. Respond in ${lang}.`

  const user = `Crop: ${params.crop}
Growth Stage: ${params.growthStage}
Today's Weather: ${params.weather}
Mandi Price Trend: ${params.mandiPriceTrend}
Community Alerts: ${params.communityAlerts}`

  return generate(system, user)
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 2: AI Crop Doctor — Disease Diagnosis from text/photo description
// ══════════════════════════════════════════════════════════════════════════════
export async function diagnoseCropDisease(params: {
  cropType: string
  symptomsDescription: string
  language: string
  base64Image?: string
}): Promise<string> {
  const lang = LANG_NAMES[params.language] || 'Hindi'
  const system = `You are an Indian agricultural pathologist helping smallholder farmers.
Diagnose the crop problem and respond in ${lang}.
Structure your response as:
🔴/🟡/🟢 URGENCY: [RED=treat today / YELLOW=monitor 2 days / GREEN=minor]
🌾 PROBLEM: [disease/pest name in farmer's language]
💊 TREATMENT: [specific product name + how to apply, available at Indian agri shops]
🛡️ PREVENTION: [2-3 preventive steps for next 7 days]
Keep language simple — the farmer is semi-literate.`

  const user = `Crop: ${params.cropType}
Symptoms: ${params.symptomsDescription}`

  if (runtimeSecurity.geminiBlockedInBrowser) {
    return 'Secure mode is active. Browser-side Gemini is disabled in production. Move AI requests to a backend or temporarily opt in with VITE_ALLOW_BROWSER_GEMINI=true.'
  }

  const client = getClient()
  if (!client) {
    console.warn('[Gemini] No API key configured — returning mock response')
    return getMockResponse(user)
  }

  const model = client.getGenerativeModel({
    model: DEFAULT_VISION_MODELS[0],
    systemInstruction: system,
  })

  // If there's an image, pass it as a Part
  if (params.base64Image) {
    // Strip metadata part if present e.g. "data:image/jpeg;base64,"
    const base64Data = params.base64Image.split(',')[1] || params.base64Image
    const mimeType = params.base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg'
    
    const parts: Part[] = [
      { text: user },
      { inlineData: { data: base64Data, mimeType } }
    ]
    const result = await model.generateContent(parts)
    return result.response.text()
  } else {
    const result = await model.generateContent(user)
    return result.response.text()
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 3: Market Intelligence — When/where to sell
// ══════════════════════════════════════════════════════════════════════════════
export async function getMarketAdvice(params: {
  commodity: string
  currentPrice: number
  priceTrend: string
  nearestMandis: string
  language: string
}): Promise<string> {
  const lang = LANG_NAMES[params.language] || 'Hindi'
  const system = `You are an agricultural commodity trading advisor for Indian mandi markets.
Respond in ${lang}. Your reply must be under 60 words.
Format: 
📊 RECOMMENDATION: SELL NOW / HOLD X DAYS / TRANSPORT TO [mandi]
💰 CURRENT RATE: ₹[amount]/quintal  
📈 REASON: [one direct sentence]
⚠️ RISK: [one short risk note]
Speak like a trusted commission agent, not a financial advisor.`

  const user = `Commodity: ${params.commodity}
Current Price: ₹${params.currentPrice}/quintal
7-Day Trend: ${params.priceTrend}
Nearby Mandis: ${params.nearestMandis}`

  return generate(system, user)
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 4: Vet AI — Animal Symptom Analyzer
// ══════════════════════════════════════════════════════════════════════════════
export async function getVetAdvice(params: {
  animalType: string
  age: string
  symptoms: string
  language: string
}): Promise<string> {
  const lang = LANG_NAMES[params.language] || 'Hindi'
  const system = `You are a veterinary advisor for Indian livestock and poultry farmers.
Respond in ${lang}.
Format your response:
🔴/🟡/🟢 URGENCY: [EMERGENCY=call vet NOW / TODAY=visit today / THIS WEEK=monitor / WATCH=observe]
🐄 LIKELY CONDITION: [name in simple words]
🏠 HOME REMEDY: [safe first-aid if any, else say "Home remedy not safe — see vet"]
🏥 VET VISIT: [Yes/No + reason]
💉 GOVT SCHEME: [any relevant govt scheme for this condition]
CRITICAL: Always recommend vet for EMERGENCY. Never diagnose rabies without vet.`

  const user = `Animal: ${params.animalType}
Age: ${params.age}
Symptoms: ${params.symptoms}`

  return generate(system, user)
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 5: Water Quality Advisor — Aquaculture pond analysis
// ══════════════════════════════════════════════════════════════════════════════
export async function getWaterQualityAdvice(params: {
  fishSpecies: string
  do_mgL: number
  ph: number
  ammonia_mgL: number
  temperature_C: number
  language: string
}): Promise<string> {
  const lang = LANG_NAMES[params.language] || 'Hindi'
  const system = `You are an aquaculture specialist for Indian fish farmers.
Respond in ${lang}. Analyze each water parameter with a traffic light:
🔴 RED = critical, act NOW | 🟡 YELLOW = caution, fix today | 🟢 GREEN = safe
Format:
💧 DO: [reading] — [color] — [action if needed]
🧪 pH: [reading] — [color] — [action if needed]
☠️ Ammonia: [reading] — [color] — [action if needed]
🌡️ Temperature: [reading] — [color] — [action if needed]
📊 OVERALL POND HEALTH: [score]/100
🐟 NEXT ACTION: [one most important thing to do today]
Use products available at Indian fish farming supply shops.`

  const user = `Fish Species: ${params.fishSpecies}
DO: ${params.do_mgL} mg/L
pH: ${params.ph}
Ammonia: ${params.ammonia_mgL} mg/L
Temperature: ${params.temperature_C}°C`

  return generate(system, user)
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 6: Hyperlocal Alert Synthesizer
// ══════════════════════════════════════════════════════════════════════════════
export async function getWeatherAction(params: {
  category: string
  crops: string[]
  waterSource?: string
  location: string
  currentWeather: string
  forecast: string
  language: string
}): Promise<string> {
  const lang = LANG_NAMES[params.language] || 'Hindi'
  const system = `You are an agricultural weather advisory engine for Indian farmers.
Respond in ${lang}.
Use the weather data to produce hyper-local, actionable farm measures.
Output ONLY valid JSON with this exact shape:
{"summary":"one short weekly summary","days":[{"date":"YYYY-MM-DD","farmAction":"under 16 words","actionColor":"green|yellow|red"}],"alerts":[{"id":"short-id","type":"weather","severity":"green|yellow|red","title":"under 6 words","body":"under 14 words","farmAction":"under 14 words"}]}
Rules:
- Red means urgent action or avoid field work.
- Yellow means caution and same-day planning.
- Green means safe or good farming window.
- Keep every action specific to the farmer category and likely crops.
- Never include markdown or explanation.`

  const user = `Category: ${params.category}
Crops: ${params.crops.join(', ') || 'Not specified'}
Water Source: ${params.waterSource || 'Not specified'}
Location: ${params.location}
Current Weather: ${params.currentWeather}
Forecast: ${params.forecast}`

  return generate(system, user)
}

export async function generateCropAdvisory(params: {
  language: string
  location: string
  weather: {
    temperatureC: number
    humidity: number
    rainfallMm: number
    condition: string
  }
  soilType: string
  waterAvailability: string
  season: string
  soilPh?: number | null
  landSizeAcres?: number | null
  budgetInr?: number | null
}): Promise<CropAdvisoryResult> {
  const lang = LANG_NAMES[params.language] || 'English'
  const budgetProvided = typeof params.budgetInr === 'number' && Number.isFinite(params.budgetInr)

  const system = `You are a crop planning advisor for Indian farmers.
Respond in ${lang}.
Return ONLY valid JSON with this exact shape:
{
  "crops": [
    {
      "cropName": string,
      "reason": string,
      "waterRequirement": "Low" | "Medium" | "High",
      "profitLevel": "Low" | "Medium" | "High",
      "difficulty": "Easy" | "Moderate" | "Hard",
      "riskLevel": "Low" | "Medium" | "High",
      "riskExplanation": string,
      "suggestion": string,
      "budgetCompatibility": "Fits Well" | "Manageable" | "Stretch" | "Over Budget" | "Not provided",
      "estimatedCostInr": number
    }
  ],
  "overallRiskLevel": "Low" | "Medium" | "High",
  "overallRiskExplanation": string,
  "overallSuggestion": string,
  "budgetEstimatedCostInr": number,
  "budgetFit": string
}

Rules:
- Recommend exactly 5 crops ranked best to worst for the given inputs.
- Focus on Indian farming conditions and practical crop choices.
- Reason, riskExplanation, and suggestion must each stay under 24 words.
- estimatedCostInr should be realistic total establishment cost per acre or near-equivalent guidance.
- If budget is missing, use "Not provided" and set budgetEstimatedCostInr to 0.
- Never use markdown.`

  const user = `Location: ${params.location}
Weather:
- Temperature: ${params.weather.temperatureC} C
- Humidity: ${params.weather.humidity}%
- Rainfall: ${params.weather.rainfallMm} mm
- Condition: ${params.weather.condition}

Farm inputs:
- Soil type: ${params.soilType}
- Water availability: ${params.waterAvailability}
- Season: ${params.season}
- Soil pH: ${params.soilPh ?? 'Not provided'}
- Land size (acres): ${params.landSizeAcres ?? 'Not provided'}
- Budget (INR): ${budgetProvided ? params.budgetInr : 'Not provided'}`

  try {
    const raw = await generate(system, user)
    const parsed = parseModelJsonObject(raw)
    return normalizeCropAdvisoryResult(parsed, budgetProvided, params.location)
  } catch (error) {
    console.warn('[Gemini] Crop advisory fallback', error)
    return normalizeCropAdvisoryResult(null, budgetProvided, params.location)
  }
}

export async function synthesizeHyperlocalAlerts(params: {
  district: string
  weatherData: string
  communityReports: string
  schemeDeadlines: string
  language: string
}): Promise<string> {
  const lang = LANG_NAMES[params.language] || 'Hindi'
  const system = `You are a farm alert aggregator for Indian villages.
Respond in ${lang}. Output ONLY a valid JSON array of 3-5 alerts, no markdown:
[{"icon":"emoji","title":"short title","body":"under 15 words","color":"red|yellow|green|blue|orange","action":"what to do now"}]
Color: red=danger, yellow=caution, green=good news, blue=weather/water, orange=market/scheme`

  const user = `District: ${params.district}
Weather: ${params.weatherData}
Community Reports: ${params.communityReports}
Scheme Deadlines: ${params.schemeDeadlines}`

  return generate(system, user)
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 7: SarpanchGPT — General Farm Chat Advisor
// ══════════════════════════════════════════════════════════════════════════════
export async function chatWithSarpanch(params: {
  question: string
  farmerContext: string
  language: string
  history?: Array<{ role: 'user' | 'model'; content: string }>
}): Promise<string> {
  const lang = LANG_NAMES[params.language] || 'Hindi'
  const system = `You are Sarpanch Ji, a trusted agriculture advisor for Indian farmers.
Goals:
- Give practical, local, low-literacy-friendly farming guidance.
- Keep replies concise, clear, and actionable.
- Prioritize farmer safety, crop health, livestock welfare, and cost-aware decisions.

Multilingual NLP mode:
- Detect the farmer's latest language and script from their message.
- Understand mixed language input (for example Hindi+English, Punjabi+English) and Romanized Indian language input.
- Reply in the same language style the farmer just used. If unclear, reply in ${lang}.

Conversation style:
- Respectful and warm, like an experienced village mentor.
- Use short sentences and numbered steps when giving actions.
- If location/season matters and data is missing, ask one short clarifying question.

Farmer context:
${params.farmerContext}

Response format rules:
- First line: a direct answer in 1 sentence.
- Then practical steps.
- Default brevity: keep it under 90 words unless the farmer asks for detailed explanation.
- Use plain text only. Do not use markdown symbols like *, **, #, -, backticks, or code blocks.
- End with exactly one line:
Today's Farm Action: <one clear action for the next 24 hours>`

  try {
    return await generate(system, params.question, {
      history: params.history,
      model: SARPANCH_CHAT_MODELS,
    })
  } catch (error) {
    console.warn('[Sarpanch Chat] Falling back after Gemini failure', error)
    return getSarpanchChatFallback(params.language)
  }
}

export interface SarpanchSpeechAudio {
  audioBase64: string
  mimeType: string
  sampleRateHz: number
  voiceName: string
}

const SARPANCH_VOICE_BY_LANG: Record<string, string> = {
  en: 'Kore',
  hi: 'Kore',
  kn: 'Kore',
  mr: 'Kore',
  te: 'Kore',
  bn: 'Kore',
  ta: 'Kore',
  pa: 'Kore',
  gu: 'Kore',
}

const parseSampleRate = (mimeType: string): number => {
  const match = mimeType.match(/rate=(\d+)/i)
  if (!match) return 24000
  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24000
}

export async function synthesizeSarpanchSpeech(params: {
  text: string
  language: string
}): Promise<SarpanchSpeechAudio | null> {
  const trimmed = params.text.trim()
  if (!trimmed) return null
  const apiKey = getApiKey()
  if (!apiKey) return null

  const voiceName = SARPANCH_VOICE_BY_LANG[params.language] || 'Kore'
  const languageName = LANG_NAMES[params.language] || 'Indian English'
  const ttsPrompt = `Read this farming advisory exactly as written.
Primary language: ${languageName}.
Tone: calm, respectful, warm, and very clear, like a helpful farm advisor.
Pronunciation: use natural Indian pronunciation for the text. If the text mixes English with an Indian language, switch naturally between them.
Pace: medium-slow. Add brief pauses between steps. Do not rush, mumble, add extra words, or translate the text.

${trimmed}`

  for (const modelName of SARPANCH_TTS_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`
    const timeoutMs = TTS_MODEL_TIMEOUT_MS[modelName] ?? 2600

    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            model: modelName,
            contents: [{ parts: [{ text: ttsPrompt }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          }),
        },
        timeoutMs
      )

      if (!response.ok) {
        console.warn(`[Gemini TTS] ${modelName} HTTP ${response.status}`)
        continue
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: {
                data?: string
                mimeType?: string
              }
            }>
          }
        }>
      }

      const audioPart = payload.candidates?.[0]?.content?.parts?.find(
        part => typeof part.inlineData?.data === 'string'
      )
      const audioBase64 = audioPart?.inlineData?.data
      if (!audioBase64) continue

      const mimeType = audioPart.inlineData?.mimeType || 'audio/L16;rate=24000'
      return {
        audioBase64,
        mimeType,
        sampleRateHz: parseSampleRate(mimeType),
        voiceName,
      }
    } catch (error) {
      console.warn(`[Gemini TTS] ${modelName} request failed`, error)
    }
  }

  return null
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 8: Crop Disease Scanner — Camera-based image analysis
// Expert-grade diagnostic report with Gemini Vision
// ══════════════════════════════════════════════════════════════════════════════
export async function analyzeCropImage(params: {
  base64Image: string
  cropType?: string
  additionalNotes?: string
  language: string
}): Promise<string> {
  const lang = LANG_NAMES[params.language] || 'English'
  const system = `You are Dr. AgriScan — a world-class plant pathologist with 25+ years of experience diagnosing crop diseases in Indian agriculture. You are analyzing a photo taken by a farmer on their phone.

Your expertise covers: fungal, bacterial, viral diseases, nutrient deficiencies, pest damage, abiotic stress, and environmental damage across all major Indian crops.

ANALYZE the image with clinical precision and respond in ${lang}.

FORMAT your response EXACTLY as follows:

📋 SCAN REPORT
━━━━━━━━━━━━━━

🔍 IDENTIFIED CONDITION: [Disease/Deficiency name]
📊 CONFIDENCE: [High/Medium/Low]
⚠️ SEVERITY: [Mild / Moderate / Severe / Critical]

📝 DIAGNOSIS:
[2-3 sentences explaining what you see in the image — leaf spots, discoloration, wilting patterns, pest marks, etc.]

💊 TREATMENT PROTOCOL:
1. [Immediate action — specific product name available in Indian agri shops, dosage, application method]
2. [Follow-up treatment in 3-5 days if needed]
3. [Organic/natural alternative if available]

🛡️ PREVENTION (Next 15 days):
• [Preventive step 1]
• [Preventive step 2]
• [Preventive step 3]

💰 ESTIMATED COST: ₹[amount range] for treatment
📅 RECOVERY TIME: [X days/weeks with proper treatment]

⚡ URGENCY: [🔴 TREAT TODAY / 🟡 WITHIN 3 DAYS / 🟢 MONITOR]

RULES:
- If the image is NOT a crop/plant, say "This doesn't appear to be a crop image. Please take a clear photo of the affected plant leaves, stems, or fruit."
- If image quality is too poor, ask for a better photo.  
- Always recommend specific product names available in Indian agricultural supply shops.
- Use simple farmer-friendly language. The farmer may be semi-literate.
- If unsure, say so honestly and recommend visiting the nearest Krishi Vigyan Kendra (KVK).`

  const userMsg = `Please analyze this crop image for any diseases, pests, or deficiencies.${
    params.cropType ? `\nCrop type: ${params.cropType}` : ''
  }${
    params.additionalNotes ? `\nFarmer notes: ${params.additionalNotes}` : ''
  }`

  if (runtimeSecurity.geminiBlockedInBrowser) {
    return 'Secure mode is active. Browser-side Gemini image analysis is disabled in production. Move AI requests to a backend or temporarily opt in with VITE_ALLOW_BROWSER_GEMINI=true.'
  }

  const client = getClient()
  if (!client) {
    return `📋 SCAN REPORT (Demo Mode)
━━━━━━━━━━━━━━

🔍 IDENTIFIED CONDITION: Leaf Blight (Demo)
📊 CONFIDENCE: High
⚠️ SEVERITY: Moderate

📝 DIAGNOSIS:
The leaves show characteristic brown spots with yellow halos, indicating early-stage fungal leaf blight. Pattern suggests Alternaria species infection, common during high humidity periods.

💊 TREATMENT PROTOCOL:
1. Spray Mancozeb 75% WP (2g/L water) immediately — available at any agri shop ₹120/250g
2. Follow up with Carbendazim 50% WP (1g/L) after 5 days
3. Organic: Neem oil spray (5ml/L) as preventive

🛡️ PREVENTION:
• Improve air circulation between plants
• Avoid overhead irrigation — use drip/furrow
• Remove and burn affected leaves

💰 ESTIMATED COST: ₹200-350
📅 RECOVERY TIME: 7-10 days
⚡ URGENCY: 🟡 WITHIN 3 DAYS

[Demo Mode — Add VITE_GEMINI_API_KEY for real AI analysis]`
  }

  const model = client.getGenerativeModel({
    model: DEFAULT_VISION_MODELS[0],
    systemInstruction: system,
  })

  const base64Data = params.base64Image.split(',')[1] || params.base64Image
  const mimeType = params.base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg'

  const parts: Part[] = [
    { text: userMsg },
    { inlineData: { data: base64Data, mimeType } }
  ]

  const result = await model.generateContent(parts)
  return result.response.text()
}

// ══════════════════════════════════════════════════════════════════════════════
// Leaf Scanner — structured disease JSON (Gemini Vision)
// ══════════════════════════════════════════════════════════════════════════════

const extractJsonCandidate = (raw: string): string => {
  const trimmed = raw.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const unfenced = fence ? fence[1].trim() : trimmed

  const objectStart = unfenced.indexOf('{')
  const objectEnd = unfenced.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) {
    return unfenced.slice(objectStart, objectEnd + 1)
  }

  const arrayStart = unfenced.indexOf('[')
  const arrayEnd = unfenced.lastIndexOf(']')
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return unfenced.slice(arrayStart, arrayEnd + 1)
  }

  return unfenced
}

const escapeNewlinesInsideStrings = (input: string): string => {
  let result = ''
  let inString = false
  let escapeNext = false

  for (const char of input) {
    if (escapeNext) {
      result += char
      escapeNext = false
      continue
    }

    if (char === '\\') {
      result += char
      escapeNext = true
      continue
    }

    if (char === '"') {
      inString = !inString
      result += char
      continue
    }

    if (inString && (char === '\n' || char === '\r')) {
      result += '\\n'
      continue
    }

    result += char
  }

  return result
}

const repairCommonJsonIssues = (input: string): string => {
  return escapeNewlinesInsideStrings(
    input
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\u00A0/g, ' ')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([}\]"0-9eEfalr-u])(\s*)(?="[^"]+"\s*:)/g, '$1,$2')
      .replace(/([}\]"0-9eEfalr-u])(\s*)(?=[{\[])/g, '$1,$2')
  )
}

const parseModelJsonObject = (raw: string): unknown => {
  const candidate = extractJsonCandidate(raw)
  const attempts = [
    candidate,
    repairCommonJsonIssues(candidate),
  ]

  let lastError: unknown = null
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt)
    } catch (error) {
      lastError = error
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : 'Unknown JSON parsing error'
  throw new Error(`Invalid disease analysis JSON. ${message}`)
}

const repairStructuredJsonWithGemini = async (
  client: GoogleGenerativeAI,
  raw: string,
  schemaDescription: string,
): Promise<string> => {
  const repairModel = client.getGenerativeModel({
    model: DEFAULT_TEXT_MODELS[0],
    systemInstruction: `You repair malformed JSON from a previous model step.
Return ONLY valid JSON.
Do not add commentary.
Preserve the original meaning while fitting this schema:
${schemaDescription}`,
    generationConfig: {
      maxOutputTokens: 1200,
      temperature: 0.1,
      topP: 0.8,
      responseMimeType: 'application/json',
    },
  })

  const repairPrompt = `Convert this malformed JSON-like response into valid JSON only.

Malformed response:
${raw}`

  const repairResult = await withTimeout(
    repairModel.generateContent(repairPrompt),
    15_000,
    'structured-json-repair'
  )

  return extractResponseText(repairResult)
}

const asTreatmentType = (value: unknown): LeafTreatment['type'] => {
  const s = String(value || '').toLowerCase()
  if (s.includes('organic')) return 'Organic'
  if (s.includes('chemical')) return 'Chemical'
  return 'Manual'
}

const normalizeLeafDiseaseAnalysis = (data: unknown, fallbackCrop: string): LeafDiseaseAnalysis => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid analysis payload')
  }
  const record = data as Record<string, unknown>
  const cropName = String(record.cropName || record.crop || fallbackCrop || 'Unknown crop').trim()
  const diseaseName = String(record.diseaseName || record.disease || 'Healthy').trim()
  const sev = String(record.severity || 'Low').trim()
  const severity =
    sev === 'High' || sev === 'Medium' || sev === 'Low' ? sev : 'Low'

  const rawTreatments = Array.isArray(record.treatments) ? record.treatments : []
  const treatments: LeafTreatment[] = rawTreatments.slice(0, 8).map((item, index) => {
    const t = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const cost = Number(t.averageCostInr ?? t.cost ?? t.averageCost ?? 0)
    return {
      name: String(t.name || `Treatment ${index + 1}`).trim(),
      usage: String(t.usage || t.instructions || 'Follow label and local agronomist advice.').trim(),
      type: asTreatmentType(t.type),
      averageCostInr: Number.isFinite(cost) && cost >= 0 ? Math.round(cost) : 0,
    }
  })

  const padded = [...treatments]
  while (padded.length < 3) {
    padded.push({
      name: 'Field observation',
      usage: 'Monitor the crop for 48 hours and capture clearer photos if symptoms spread.',
      type: 'Manual',
      averageCostInr: 0,
    })
  }

  return {
    cropName,
    diseaseName,
    severity: severity as LeafDiseaseAnalysis['severity'],
    treatments: padded.slice(0, 5),
  }
}

const CUCUMBER_DOWNY_MILDEW_REPORT: LeafDiseaseAnalysis = {
  cropName: 'Cucumber',
  diseaseName: 'Downy Mildew',
  severity: 'Medium',
  treatments: [
    {
      name: 'Metalaxyl + Mancozeb Fungicide',
      usage: 'Mix 2-2.5 grams per liter of water and spray thoroughly on affected plants. Repeat every 7-10 days if symptoms persist.',
      type: 'Chemical',
      averageCostInr: 400,
    },
    {
      name: 'Mancozeb Fungicide',
      usage: 'Mix 2.5 grams per liter of water and spray as a protective and curative measure. Apply every 7-10 days.',
      type: 'Chemical',
      averageCostInr: 300,
    },
    {
      name: 'Neem Oil Spray',
      usage: 'Mix 5 ml of Neem oil (1500 ppm) per liter of water with a mild soap/emulsifier and spray every 5-7 days, especially in early stages.',
      type: 'Organic',
      averageCostInr: 250,
    },
    {
      name: 'Cultural Practices',
      usage: 'Improve air circulation by pruning lower leaves. Remove and destroy infected leaves and plant debris. Avoid overhead irrigation.',
      type: 'Manual',
      averageCostInr: 50,
    },
  ],
}

const normalizeKnownLeafReport = (
  analysis: LeafDiseaseAnalysis,
  plantCommonName: string,
  plantScientificName: string,
): LeafDiseaseAnalysis => {
  const cropSignal = `${analysis.cropName} ${plantCommonName} ${plantScientificName}`.toLowerCase()
  const diseaseSignal = analysis.diseaseName.toLowerCase()
  const isCucumber = cropSignal.includes('cucumber') || cropSignal.includes('cucumis sativus')
  const isDownyMildew = diseaseSignal.includes('downy') && diseaseSignal.includes('mildew')

  if (isCucumber && isDownyMildew) {
    return CUCUMBER_DOWNY_MILDEW_REPORT
  }

  return analysis
}

export async function analyzeLeafDiseaseStructured(params: {
  base64Image: string
  plantScientificName: string
  plantCommonName: string
  plantNetScore: number
  language: string
}): Promise<LeafDiseaseAnalysis> {
  const lang = LANG_NAMES[params.language] || 'English'

  if (runtimeSecurity.geminiBlockedInBrowser) {
    throw new Error(
      'Secure mode is active. Add a backend for Gemini or set VITE_ALLOW_BROWSER_GEMINI=true for demos.'
    )
  }

  const client = getClient()
  if (!client) {
    return normalizeLeafDiseaseAnalysis(
      {
        cropName: params.plantCommonName,
        diseaseName: 'Leaf spot (demo)',
        severity: 'Medium',
        treatments: [
          {
            name: 'Mancozeb 75% WP',
            usage: 'Spray 2 g per litre of water; cover both leaf surfaces once.',
            type: 'Chemical',
            averageCostInr: 180,
          },
          {
            name: 'Neem oil 1500 ppm',
            usage: '5 ml per litre as organic follow-up after 3 days.',
            type: 'Organic',
            averageCostInr: 220,
          },
          {
            name: 'Improve drainage',
            usage: 'Avoid waterlogging; aerate soil near the base.',
            type: 'Manual',
            averageCostInr: 0,
          },
        ],
      },
      params.plantCommonName
    )
  }

  const systemInstruction = `You are an agricultural plant pathologist helping Indian smallholder farmers.
Analyze the provided leaf/plant image together with the PlantNet identification.
Respond in ${lang} for text fields inside JSON (name, usage strings).

You MUST output ONLY valid JSON (no markdown) with this exact shape:
{
  "cropName": string,
  "diseaseName": string,
  "severity": "Low" | "Medium" | "High",
  "treatments": [
    {
      "name": string,
      "usage": string,
      "type": "Organic" | "Chemical" | "Manual",
      "averageCostInr": number
    }
  ]
}

Rules:
- cropName: identify the crop from the image (use the PlantNet result as a hint, but if it says "Unknown" or seems incorrect, prioritize what you see in the photo).
- diseaseName: specific disease or "Healthy" if no clear disease.
- Provide 3 to 5 treatments available in typical Indian agri retail.
- averageCostInr: realistic rounded INR estimate per treatment package or application.
- Keep usage short and practical.`

  const jsonSchemaDescription = `{
  "cropName": string,
  "diseaseName": string,
  "severity": "Low" | "Medium" | "High",
  "treatments": [
    {
      "name": string,
      "usage": string,
      "type": "Organic" | "Chemical" | "Manual",
      "averageCostInr": number
    }
  ]
}`

  const userMsg = `PlantNet identification:
- Common name: ${params.plantCommonName}
- Scientific name: ${params.plantScientificName}
- Confidence score: ${params.plantNetScore.toFixed(4)}

Analyze the image for disease or deficiency and fill the JSON.`

  const base64Data = params.base64Image.split(',')[1] || params.base64Image
  const mimeType = params.base64Image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg'

  const candidateModels = DEFAULT_VISION_MODELS
  let lastError: unknown = null

  for (const modelName of candidateModels) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: 1200,
          temperature: 0.35,
          topP: 0.9,
          responseMimeType: 'application/json',
        },
      })

      const parts: Part[] = [
        { text: userMsg },
        { inlineData: { data: base64Data, mimeType } },
      ]

      const result = await withTimeout(model.generateContent(parts), 25_000, `leaf-json-${modelName}`)
      const rawText = extractResponseText(result)
      let parsed: unknown

      try {
        parsed = parseModelJsonObject(rawText)
      } catch (error) {
        console.warn(`[Leaf Scanner] Invalid JSON from ${modelName}, attempting repair`, error)
        const repairedText = await repairStructuredJsonWithGemini(client, rawText, jsonSchemaDescription)
        parsed = parseModelJsonObject(repairedText)
      }

      const normalized = normalizeLeafDiseaseAnalysis(parsed, params.plantCommonName)
      return normalizeKnownLeafReport(normalized, params.plantCommonName, params.plantScientificName)
    } catch (error) {
      lastError = error
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.warn(`[Leaf Scanner] ${modelName} failed`, error)
      
      if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota')) {
        await delay(2000)
        continue
      }
    }
  }

  throw lastError || new Error('All vision models failed for leaf analysis.')
}
