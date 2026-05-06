import { normalizeSupportedLanguage, type SupportedLanguage } from '../i18n'

type LanguageProfile = {
  language: SupportedLanguage
  isMixed: boolean
  label: string
  locale: string
  instruction: string
}

const LOCALE_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  mr: 'mr-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  pa: 'pa-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
}

const SCRIPT_PATTERNS: Array<{ language: SupportedLanguage; pattern: RegExp; label: string }> = [
  { language: 'hi', pattern: /[\u0900-\u097F]/, label: 'Hindi' },
  { language: 'kn', pattern: /[\u0C80-\u0CFF]/, label: 'Kannada' },
  { language: 'te', pattern: /[\u0C00-\u0C7F]/, label: 'Telugu' },
  { language: 'ta', pattern: /[\u0B80-\u0BFF]/, label: 'Tamil' },
  { language: 'pa', pattern: /[\u0A00-\u0A7F]/, label: 'Punjabi' },
  { language: 'bn', pattern: /[\u0980-\u09FF]/, label: 'Bengali' },
  { language: 'gu', pattern: /[\u0A80-\u0AFF]/, label: 'Gujarati' },
]

const ROMAN_KEYWORDS: Record<SupportedLanguage, RegExp[]> = {
  en: [
    /\b(what|when|where|how|why|should|spray|crop|soil|weather|market|price|disease|leaves|water|fertilizer)\b/i,
  ],
  hi: [
    /\b(kya|kaise|kab|kahan|kyu|hai|hain|nahi|mat|karo|karu|karna|fasal|kheti|pani|mitti|patte|peele|bimari|dawai|mandi|yojana|barish|gehu|makka)\b/i,
  ],
  kn: [
    /\b(enu|hege|yavaga|elli|ide|illa|madi|madbeku|bele|hola|neeru|mannu|soppu|haladi|roga|oushadhi|male|mandi)\b/i,
  ],
  mr: [
    /\b(kay|kase|kuthe|aahe|nahi|kara|karu|shet|pik|pani|mati|pane|pivale|rog|aushadh|paus|mandi)\b/i,
  ],
  te: [
    /\b(emi|ela|ekkada|undi|ledu|cheyyali|panta|neellu|mannu|aakulu|pasupu|vyadhi|mandi|varsham)\b/i,
  ],
  ta: [
    /\b(enna|eppadi|enge|irukku|illai|seiyanum|payir|thanni|mann|ilai|manjal|noi|mandi|mazhai)\b/i,
  ],
  pa: [
    /\b(ki|kive|kithe|hai|nahi|karo|fasal|kheti|pani|mitti|patte|peele|bimari|dawai|mandi|meeh)\b/i,
  ],
  bn: [
    /\b(ki|kibhabe|kothay|ache|nei|korte|fasal|chash|pani|mati|pata|holud|rog|oshudh|mandi|brishti)\b/i,
  ],
  gu: [
    /\b(shu|kem|kya|che|nathi|karvu|pak|kheti|pani|mati|pan|peela|rog|dava|mandi|varsad)\b/i,
  ],
}

const countMatches = (text: string, patterns: RegExp[]) =>
  patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0)

export const detectSpeechLanguage = (
  text: string,
  fallbackLanguage: string,
): LanguageProfile => {
  const fallback = normalizeSupportedLanguage(fallbackLanguage)
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return {
      language: fallback,
      isMixed: false,
      label: fallback === 'en' ? 'English' : fallback,
      locale: LOCALE_BY_LANGUAGE[fallback],
      instruction: `Reply in ${fallback === 'en' ? 'English' : fallback}.`,
    }
  }

  const scriptMatch = SCRIPT_PATTERNS.find(item => item.pattern.test(compact))
  const englishScore = countMatches(compact, ROMAN_KEYWORDS.en)
  const romanScores = Object.entries(ROMAN_KEYWORDS)
    .filter(([language]) => language !== 'en')
    .map(([language, patterns]) => ({
      language: language as SupportedLanguage,
      score: countMatches(compact, patterns),
    }))
    .sort((left, right) => right.score - left.score)

  const topRoman = romanScores[0]
  const hasLatin = /[A-Za-z]/.test(compact)
  const isMixed = Boolean(
    scriptMatch && hasLatin ||
    topRoman?.score > 0 && englishScore > 0
  )
  const language =
    scriptMatch?.language ||
    (topRoman?.score > 0 ? topRoman.language : englishScore > 0 ? 'en' : fallback)
  const label = scriptMatch?.label || (
    language === 'hi' ? 'Hindi' :
    language === 'kn' ? 'Kannada' :
    language === 'en' ? 'English' :
    language
  )

  const instruction = isMixed
    ? `Reply in the same mixed style as the farmer: keep the ${label} words and English words naturally mixed. Do not force pure ${label} or pure English.`
    : `Reply in ${label}. If the farmer used Roman letters for ${label}, reply in simple Romanized ${label}; if they used native script, reply in that script.`

  return {
    language,
    isMixed,
    label,
    locale: LOCALE_BY_LANGUAGE[language],
    instruction,
  }
}

export const getSpeechLocale = (text: string, fallbackLanguage: string): string =>
  detectSpeechLanguage(text, fallbackLanguage).locale
