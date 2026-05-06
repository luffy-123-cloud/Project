import { useState, useRef, useCallback, useEffect } from 'react'
import { useLanguageStore } from '../store/useLanguageStore'
import {
  synthesizeSarpanchSpeech,
  type SarpanchSpeechAudio,
} from '../services/gemini/geminiClient'
import { detectSpeechLanguage } from '../utils/speechLanguage'

export type VoiceAgentState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

interface UseVoiceAgentOptions {
  onTranscript?: (text: string) => void
  onResponse?: (text: string) => void
  onStateChange?: (state: VoiceAgentState) => void
  onError?: (message: string) => void
}

const LANG_BCP47: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  pa: 'pa-Guru-IN',
  mr: 'mr-IN',
  te: 'te-IN',
  gu: 'gu-IN',
}

const GEMINI_TTS_SOFT_TIMEOUT_MS = 5500

const decodeBase64Pcm = (base64Data: string): Int16Array => {
  const binary = atob(base64Data)
  const samples = Math.floor(binary.length / 2)
  const pcm = new Int16Array(samples)

  for (let index = 0; index < samples; index++) {
    const low = binary.charCodeAt(index * 2)
    const high = binary.charCodeAt(index * 2 + 1)
    pcm[index] = (high << 8) | low
  }

  return pcm
}

const toFloat32 = (pcm: Int16Array): Float32Array => {
  const floatArray = new Float32Array(pcm.length)
  for (let index = 0; index < pcm.length; index++) {
    floatArray[index] = pcm[index] / 32768
  }
  return floatArray
}

const microphoneErrorMessage = (code: string): string => {
  switch (code) {
    case 'not-allowed':
      return 'Microphone permission is blocked. Please allow microphone access.'
    case 'audio-capture':
      return 'No microphone detected. Please connect a microphone and retry.'
    case 'network':
      return 'Voice recognition network error. Please check your connection.'
    case 'no-speech':
      return 'No speech detected. Please speak a little louder and try again.'
    default:
      return `Microphone error: ${code}`
  }
}

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

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const sanitizeForSpeech = (text: string): string => {
  const compact = text
    // Remove fenced code blocks.
    .replace(/```[\s\S]*?```/g, ' ')
    // Remove inline code markers.
    .replace(/`([^`]+)`/g, '$1')
    // Convert markdown links to readable text.
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Remove markdown bullets, numbering, and formatting symbols.
    .replace(/^\s*(?:[-*#]+|\d+\.)\s+/gm, '')
    .replace(/[~*_#`>|]/g, '')
    // Remove raw URLs and bracket references.
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\[(\d+|source|ref|citation)\]/gi, '')
    // Avoid speaking punctuation around the action label.
    .replace(/^\s*today'?s farm action:\s*/gim, 'Today farm action: ')
    // Keep it sentence-friendly for TTS.
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .trim()

  return compact
}

export function useVoiceAgent(
  aiResponseFn: (text: string) => Promise<string>,
  options: UseVoiceAgentOptions = {}
) {
  const { language } = useLanguageStore()

  const [state, setStateRaw] = useState<VoiceAgentState>('idle')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState<string | null>(null)

  const transcriptRef = useRef('')
  const optionsRef = useRef(options)
  const abortRef = useRef(false)
  const sessionIdRef = useRef(0)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const setState = useCallback((nextState: VoiceAgentState) => {
    setStateRaw(nextState)
    optionsRef.current.onStateChange?.(nextState)
  }, [])

  const stopGeminiAudio = useCallback(() => {
    const source = audioSourceRef.current
    if (!source) return
    try {
      source.stop()
    } catch {
      // no-op: source may already be stopped.
    }
    audioSourceRef.current = null
  }, [])

  const stopAll = useCallback(() => {
    sessionIdRef.current += 1
    abortRef.current = true
    recognitionRef.current?.stop()
    recognitionRef.current = null

    stopGeminiAudio()

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null

    setState('idle')
  }, [setState, stopGeminiAudio])

  const playGeminiAudio = useCallback(
    async (audio: SarpanchSpeechAudio): Promise<void> => {
      const pcm = decodeBase64Pcm(audio.audioBase64)
      if (!pcm.length) throw new Error('Empty audio buffer from Gemini TTS')

      const floatBuffer = toFloat32(pcm)
      let audioContext = audioContextRef.current
      if (!audioContext) {
        audioContext = new AudioContext()
        audioContextRef.current = audioContext
      }

      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const buffer = audioContext.createBuffer(1, floatBuffer.length, audio.sampleRateHz)
      buffer.getChannelData(0).set(floatBuffer)

      await new Promise<void>((resolve, reject) => {
        if (abortRef.current) {
          resolve()
          return
        }

        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(audioContext.destination)
        audioSourceRef.current = source

        source.onended = () => {
          if (audioSourceRef.current === source) {
            audioSourceRef.current = null
          }
          resolve()
        }

        try {
          source.start(0)
        } catch (playError) {
          reject(playError)
        }
      })
    },
    []
  )

  const speakWithBrowser = useCallback(
    (text: string, speechLanguage: string): Promise<void> => {
      if (!window.speechSynthesis) {
        return Promise.reject(new Error('SpeechSynthesis is unavailable'))
      }

      window.speechSynthesis.cancel()

      return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = LANG_BCP47[speechLanguage] || LANG_BCP47[language] || 'en-IN'
        utterance.rate = speechLanguage === 'en' ? 0.9 : 0.86
        utterance.pitch = 1

        const voices = window.speechSynthesis.getVoices()
        const preferred =
          voices.find(voice => voice.lang === utterance.lang) ||
          voices.find(voice => voice.lang.startsWith(utterance.lang.slice(0, 2)))
        if (preferred) utterance.voice = preferred

        utterance.onend = () => resolve()
        utterance.onerror = () => reject(new Error('Browser TTS failed'))

        utteranceRef.current = utterance
        window.speechSynthesis.speak(utterance)
      })
    },
    [language]
  )

  const speak = useCallback(
    async (text: string) => {
      const clean = sanitizeForSpeech(text)
      if (!clean) {
        setState('idle')
        return
      }
      if (abortRef.current) return

      stopGeminiAudio()
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }

      setState('speaking')
      setError(null)
      const speechProfile = detectSpeechLanguage(clean, language)

      try {
        const geminiAudio = await withTimeout(
          synthesizeSarpanchSpeech({ text: clean, language: speechProfile.language }),
          GEMINI_TTS_SOFT_TIMEOUT_MS
        ).catch(() => null)
        if (abortRef.current) return

        if (!geminiAudio) {
          throw new Error('Gemini TTS unavailable')
        }

        await playGeminiAudio(geminiAudio)
        if (!abortRef.current) setState('idle')
      } catch {
        if (abortRef.current) return

        try {
          await speakWithBrowser(clean, speechProfile.language)
          if (!abortRef.current) setState('idle')
        } catch {
          const errorMessage = 'Unable to play voice response. Please tap and try again.'
          setError(errorMessage)
          optionsRef.current.onError?.(errorMessage)
          setState('error')
        }
      }
    },
    [language, playGeminiAudio, setState, speakWithBrowser, stopGeminiAudio]
  )

  const startListening = useCallback(() => {
    if (state !== 'idle') {
      stopAll()
      return
    }

    const sessionId = sessionIdRef.current + 1
    sessionIdRef.current = sessionId
    abortRef.current = false

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) {
      const message = 'Voice input is not supported in this browser. Please use Chrome.'
      setError(message)
      optionsRef.current.onError?.(message)
      setState('error')
      return
    }

    const recognition = new SpeechRec()
    recognition.lang = LANG_BCP47[language] || 'hi-IN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      if (sessionId !== sessionIdRef.current) return
      transcriptRef.current = ''
      setTranscript('')
      setError(null)
      setState('listening')
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (sessionId !== sessionIdRef.current) return
      if (event.error === 'aborted') return
      const message = microphoneErrorMessage(event.error)
      setError(message)
      optionsRef.current.onError?.(message)
      setState('error')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (sessionId !== sessionIdRef.current) return
      const text = Array.from(event.results)
        .map(result => result[0].transcript)
        .join(' ')
        .trim()

      transcriptRef.current = text
      setTranscript(text)
      optionsRef.current.onTranscript?.(text)
    }

    recognition.onend = async () => {
      if (abortRef.current || sessionId !== sessionIdRef.current) return

      const finalText = transcriptRef.current.trim()
      if (!finalText) {
        setState('idle')
        return
      }

      setState('processing')
      try {
        let aiText = await aiResponseFn(finalText)
        if (abortRef.current || sessionId !== sessionIdRef.current) return
        aiText = aiText?.trim()
        if (!aiText) {
          aiText = 'Network is unstable right now. Please ask once again in a short sentence. Today farm action: Retry your question after checking signal.'
        }
        setResponse(aiText)
        optionsRef.current.onResponse?.(aiText)
        await speak(aiText)
      } catch (error) {
        if (abortRef.current || sessionId !== sessionIdRef.current) return
        const message = `Unable to get AI response: ${getErrorMessage(error)}`
        setError(message)
        optionsRef.current.onError?.(message)
        setState('error')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [aiResponseFn, language, setState, speak, state, stopAll])

  useEffect(
    () => () => {
      stopAll()
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined)
      }
    },
    [stopAll]
  )

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  return {
    state,
    transcript,
    response,
    error,
    isSupported,
    isListening: state === 'listening',
    isProcessing: state === 'processing',
    isSpeaking: state === 'speaking',
    startListening,
    stopAll,
    speak,
  }
}
