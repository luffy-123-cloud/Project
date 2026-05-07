import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ChevronLeft, Keyboard, MicOff, Languages, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { askSarpanchSalah } from '../../services/ai'
import { useLanguageStore, LANGUAGE_META, type SupportedLanguage } from '../../store/useLanguageStore'
import { useAuthStore } from '../../store/useAuthStore'
import { useLocationStore } from '../../store/useLocationStore'
import { useVoiceAgent } from '../../hooks/useVoiceAgent'
import VoiceOrb from '../../components/ui/VoiceOrb'

interface Message {
  role: 'user' | 'model'
  content: string
  timestamp: Date
}

const HISTORY_WINDOW = 6
const HISTORY_CHAR_LIMIT = 220
const RESPONSE_CACHE_TTL_MS = 4 * 60 * 1000
const RESPONSE_CACHE_MAX_ITEMS = 40

const QUICK_QUESTIONS: Record<SupportedLanguage, string[]> = {
  en: [
    'What should I do for yellow leaves in wheat?',
    'Will rain in next 3 days affect spraying?',
    'Best mandi nearby to sell maize this week?',
    'Any scheme for drip irrigation subsidy?',
  ],
  hi: [
    'gehu me peele patte ka turant upay?',
    'agle 3 din ki barish me spray kare ya nahi?',
    'is hafte makka bechne ke liye best mandi?',
    'drip sinchai subsidy ke liye kaunsi yojana hai?',
  ],
  kn: [
    'wheat nalli yellow agidre takshana enu madodu?',
    'mundina 3 dina male idre spray madbekaa?',
    'ee vara maize yelli marata madodu better?',
    'drip irrigation subsidy ge yava yojane ide?',
  ],
  mr: [
    'gahuche paan pivali zali tar turt kay karu?',
    'pudhil 3 divsat paus asel tar spray karu ka?',
    'ya athavdyat makka viknyasathi changli mandi konti?',
    'drip irrigation subsidy sathi konti yojana aahe?',
  ],
  te: [
    'wheat lo aakulu pasupu ayite ventane em cheyyali?',
    'mudu rojullo varsham unte spray cheyyala?',
    'ee vaaram maize ammadaniki manchi mandi edi?',
    'drip irrigation subsidy kosam e pathakam undi?',
  ],
  bn: [
    'gom e holud pata hole ekhon ki korbo?',
    'agami 3 diner brishtite spray kora thik hobe?',
    'ei soptaho bhutta bikrir jonno bhalo mandi konta?',
    'drip irrigation subsidy pabar upay ki?',
  ],
  ta: [
    'wheat il manjal ilai varumbodhu enna seiyanum?',
    'adutha 3 naal mazhai irundha spray seiyalama?',
    'indha vaaram maize vikkanum na best mandi edhu?',
    'drip irrigation subsidy kidaikka enna seiyanum?',
  ],
  pa: [
    'gehu de peele patte da turant ilaaj ki hai?',
    'agle 3 din me barish hoye ta spray kariye?',
    'is hafte makki bechan layi vadiya mandi kehri?',
    'drip irrigation subsidy layi kehri scheme hai?',
  ],
  gu: [
    'ghau ma peela pan aave to turant shu karvu?',
    'aagal na 3 divas varsad hoy to spray karvu?',
    'aa athvadiye makai vechva sauthi sari mandi kai?',
    'drip irrigation subsidy mate kai yojana che?',
  ],
}

const TIME_LOCALE: Record<SupportedLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  mr: 'mr-IN',
  te: 'te-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  pa: 'pa-IN',
  gu: 'gu-IN',
}

const compactHistoryContent = (text: string): string => {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > HISTORY_CHAR_LIMIT ? `${compact.slice(0, HISTORY_CHAR_LIMIT)}...` : compact
}

const toHistory = (messages: Message[]) =>
  messages
    .filter(
      (message, index) =>
        !(
          index === 0 &&
          message.role === 'model' &&
          message.content.includes('I am Sarpanch Salah')
        )
    )
    .slice(-HISTORY_WINDOW)
    .map(message => ({
      role: message.role,
      content: compactHistoryContent(message.content),
    }))
    .filter(message => Boolean(message.content))

const getErrorMessage = (error: unknown): string => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error'

  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'Unknown error'
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned
}

export default function SarpanchGPT() {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const farmer = useAuthStore(state => state.farmer)

  const firstName = farmer?.name?.split(' ')?.[0] || ''

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: `Namaste${firstName ? `, ${firstName}` : ''}. I am Sarpanch Salah.

Ask in Hindi, Kannada, or your mixed local language.
I will keep answers short, practical, and easy to act on.`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'text' | 'voice'>('voice')
  const [voiceError, setVoiceError] = useState<string | null>(null)

  const messagesRef = useRef(messages)
  const transcriptRef = useRef('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const responseCacheRef = useRef<Map<string, { value: string; expiresAt: number }>>(new Map())

  const quickQuestions = useMemo(
    () => QUICK_QUESTIONS[language as SupportedLanguage] || QUICK_QUESTIONS.en,
    [language]
  )

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const coords = useLocationStore(state => state.coords)

  const askAI = useCallback(
    async (question: string, messageSnapshot?: Message[]): Promise<string> => {
      const normalizedQuestion = question.replace(/\s+/g, ' ').trim()
      if (!normalizedQuestion) return ''

      const cacheKey = `${language}|${farmer?.district || 'unknown'}|${farmer?.state || 'unknown'}|${normalizedQuestion.toLowerCase()}`
      const now = Date.now()
      const cached = responseCacheRef.current.get(cacheKey)
      if (cached && cached.expiresAt > now) {
        return cached.value
      }
      if (cached) responseCacheRef.current.delete(cacheKey)

      const response = await askSarpanchSalah({
        question: normalizedQuestion,
        language,
        farmer,
        history: toHistory(messageSnapshot || messagesRef.current),
        coords: coords,
      })

      responseCacheRef.current.set(cacheKey, { value: response, expiresAt: now + RESPONSE_CACHE_TTL_MS })
      if (responseCacheRef.current.size > RESPONSE_CACHE_MAX_ITEMS) {
        const oldestKey = responseCacheRef.current.keys().next().value as string | undefined
        if (oldestKey) responseCacheRef.current.delete(oldestKey)
      }

      return response
    },
    [farmer, language]
  )

  const voiceAgent = useVoiceAgent(
    async (question: string) => askAI(question, messagesRef.current),
    {
      onTranscript: transcript => {
        transcriptRef.current = transcript
        setInput(transcript)
        setVoiceError(null)
      },
      onResponse: text => {
        setMessages(previous => [...previous, { role: 'model', content: text, timestamp: new Date() }])
        transcriptRef.current = ''
      },
      onStateChange: nextState => {
        if (nextState !== 'processing') return
        const spokenQuestion = transcriptRef.current.trim()
        if (!spokenQuestion) return

        setMessages(previous => {
          const lastMessage = previous[previous.length - 1]
          if (lastMessage?.role === 'user' && lastMessage.content === spokenQuestion) {
            return previous
          }
          return [...previous, { role: 'user', content: spokenQuestion, timestamp: new Date() }]
        })
        setInput('')
      },
      onError: message => setVoiceError(message),
    }
  )

  const sendMessage = useCallback(
    async (rawText?: string) => {
      const question = (rawText || input).trim()
      if (!question || loading) return

      const historySnapshot = messagesRef.current
      setInput('')
      setVoiceError(null)
      setMessages(previous => [...previous, { role: 'user', content: question, timestamp: new Date() }])
      setLoading(true)

      try {
        const response = await askAI(question, historySnapshot)
        setMessages(previous => [...previous, { role: 'model', content: response, timestamp: new Date() }])
        if (mode === 'voice') {
          void voiceAgent.speak(response)
        }
      } catch (error) {
        const reason = getErrorMessage(error)
        const fallback = `Connection issue while talking to Sarpanch Salah: ${reason}`
        setMessages(previous => [...previous, { role: 'model', content: fallback, timestamp: new Date() }])
        setVoiceError(`Network issue detected: ${reason}`)
      } finally {
        setLoading(false)
      }
    },
    [askAI, input, loading, mode, voiceAgent]
  )

  const statusText = voiceAgent.isListening
    ? 'Listening'
    : voiceAgent.isProcessing
      ? 'Thinking'
      : voiceAgent.isSpeaking
        ? 'Speaking'
        : 'Online'

  const statusColor = voiceAgent.isListening
    ? 'bg-brand-300 animate-pulse'
    : voiceAgent.isProcessing
      ? 'bg-brand-400 animate-pulse'
      : voiceAgent.isSpeaking
        ? 'bg-brand-500 animate-pulse'
        : 'bg-brand-300'
  const isVoiceBusy = voiceAgent.isListening || voiceAgent.isProcessing || voiceAgent.isSpeaking

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(TIME_LOCALE[language as SupportedLanguage] || 'en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-gradient-to-b from-brand-50 via-amber-50/40 to-neutral-100 overflow-hidden relative">
      <div className="bg-brand-700 text-white flex-shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 h-14 max-w-3xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
              Sarpanch Salah
            </p>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
              <p className="text-brand-100 text-xs">{statusText} - Voice Farm Advisor</p>
            </div>
          </div>
          <button
            onClick={() => {
              setMode(current => (current === 'voice' ? 'text' : 'voice'))
              voiceAgent.stopAll()
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            title={mode === 'voice' ? 'Switch to typing mode' : 'Switch to voice mode'}
            aria-label={mode === 'voice' ? 'Switch to typing mode' : 'Switch to voice mode'}
          >
            {mode === 'voice' ? <Keyboard size={18} /> : <MicOff size={18} />}
          </button>
        </div>
      </div>

      <div className="w-full max-w-3xl mx-auto px-4 pt-3">
        <div className="bg-white border border-brand-200 rounded-xl px-3 py-2 shadow-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-600 min-w-0">
            <Languages size={14} className="text-brand-700 shrink-0" />
            <span className="truncate">
              Language: {LANGUAGE_META[language as SupportedLanguage]?.nativeName || 'Auto'}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 truncate">
            Ask by voice, type, or mixed local + English words
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-3xl mx-auto w-full">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={`${message.timestamp.getTime()}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
            >
              {message.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-brand-700 text-white flex items-center justify-center text-[11px] font-semibold shrink-0 mt-1">
                  SJ
                </div>
              )}
              <div className="max-w-[85%]">
                <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-white text-neutral-800 border border-neutral-200 shadow-card rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 px-1">{formatTime(message.timestamp)}</p>
              </div>
            </motion.div>
          ))}

          {(loading || voiceAgent.isProcessing) && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start gap-2"
            >
              <div className="w-8 h-8 rounded-full bg-brand-700 text-white flex items-center justify-center text-[11px] font-semibold shrink-0 mt-1">
                SJ
              </div>
              <div className="bg-white border border-brand-100 shadow-card rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-5">
                  {[0, 1, 2].map(dot => (
                    <motion.div
                      key={dot}
                      className="w-2 h-2 bg-neutral-300 rounded-full"
                      animate={{ opacity: [0.4, 1, 0.4], y: [0, -3, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.18 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {mode === 'voice' && (
        <div
          className="flex-shrink-0 bg-white/95 backdrop-blur border-t border-neutral-200"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}
        >
          {messages.length <= 1 && (
            <div className="px-4 pt-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
              {quickQuestions.map(question => (
                <button
                  key={question}
                  onClick={() => {
                    void sendMessage(question)
                  }}
                  className="bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-3 py-2 text-xs font-medium shrink-0 hover:bg-brand-100 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          {voiceAgent.transcript && (
            <div className="mx-4 mt-3 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-sm text-brand-800 italic">
              "{voiceAgent.transcript}"
            </div>
          )}

          {(voiceError || voiceAgent.error) && (
            <div className="mx-4 mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p>{voiceError || voiceAgent.error}</p>
            </div>
          )}

          {!voiceAgent.isSupported && (
            <div className="mx-4 mt-3 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              Voice input is not supported in this browser. You can still use typing mode.
            </div>
          )}

          <div className="flex justify-center py-5">
            <VoiceOrb state={voiceAgent.state} onPress={voiceAgent.startListening} size="lg" />
          </div>

          {isVoiceBusy && (
            <div className="flex justify-center -mt-1 pb-3">
              <button
                onClick={voiceAgent.stopAll}
                className="rounded-full bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 text-sm font-semibold shadow-card active:scale-95 transition-all"
                aria-label="Stop voice assistant"
              >
                Stop
              </button>
            </div>
          )}

          <p className="text-center text-xs text-neutral-500 pb-2">
            Prefer typing?{' '}
            <button
              onClick={() => {
                setMode('text')
                inputRef.current?.focus()
              }}
              className="text-brand-700 font-medium underline underline-offset-2"
            >
              Open keyboard
            </button>
          </p>
        </div>
      )}

      {mode === 'text' && (
        <div
          className="flex-shrink-0 bg-white border-t border-neutral-200 px-4 py-3 max-w-3xl mx-auto w-full"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
        >
          {messages.length <= 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2">
              {quickQuestions.map(question => (
                <button
                  key={question}
                  onClick={() => {
                    void sendMessage(question)
                  }}
                  className="bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-3 py-1.5 text-xs font-medium shrink-0 hover:bg-brand-100 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <input
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !loading) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder="Ask Sarpanch Salah about crop, mandi, soil, or schemes..."
              className="flex-1 bg-neutral-50 border border-brand-200 rounded-xl px-4 py-3 text-sm text-neutral-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
            />
            <button
              onClick={() => {
                void sendMessage()
              }}
              disabled={loading || !input.trim()}
              className="w-11 h-11 bg-brand-600 text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 hover:bg-brand-500 transition-all"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
