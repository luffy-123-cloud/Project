// src/components/ui/VoiceOrb.tsx — futuristic cinematic voice orb for Sarpanch AI
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Loader2, Volume2, AlertCircle } from 'lucide-react'
import type { VoiceAgentState } from '../../hooks/useVoiceAgent'

interface VoiceOrbProps {
  state: VoiceAgentState
  onPress: () => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  sm: { orb: 'w-16 h-16', icon: 18, bars: 'h-6', ring: '-inset-2' },
  md: { orb: 'w-24 h-24', icon: 28, bars: 'h-10', ring: '-inset-4' },
  lg: { orb: 'w-32 h-32', icon: 36, bars: 'h-14', ring: '-inset-6' },
}

const STATE_GRADIENT: Record<VoiceAgentState, string> = {
  idle:       'from-brand-600 via-brand-500 to-brand-700',
  listening:  'from-brand-700 via-brand-600 to-brand-800',
  processing: 'from-brand-500 via-brand-400 to-brand-600',
  speaking:   'from-brand-400 via-brand-300 to-brand-500',
  error:      'from-danger-500 via-danger-400 to-danger-600',
}

const STATE_LABEL: Record<VoiceAgentState, string> = {
  idle:       'Tap to speak',
  listening:  'Listening...',
  processing: 'Sarpanch AI is thinking...',
  speaking:   'Sarpanch AI is speaking...',
  error:      'Tap to try again',
}

function WaveBars() {
  return (
    <div className="flex items-center gap-[4px]">
      {[0,1,2,3,4,5].map(i => (
        <motion.div
          key={i}
          className="w-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          style={{ height: 32, originY: 0.5 }}
          animate={{ 
            scaleY: [0.3, 1.4, 0.3],
            opacity: [0.6, 1, 0.6]
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-full opacity-40">
      <motion.div 
        className="absolute inset-[-50%] bg-gradient-to-tr from-white/20 via-transparent to-white/20"
        animate={{ 
          rotate: 360,
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity, 
          ease: "linear" 
        }}
      />
    </div>
  )
}

export default function VoiceOrb({ state, onPress, size = 'md', className = '' }: VoiceOrbProps) {
  const s = SIZE[size]
  const isListening = state === 'listening'
  const isProcessing = state === 'processing'
  const isSpeaking = state === 'speaking'

  return (
    <div className={`flex flex-col items-center gap-5 ${className}`}>
      <div className="relative group">
        {/* Cinematic Glow Background */}
        <motion.div 
          className={`absolute inset-[-20%] rounded-full blur-2xl opacity-20 transition-colors duration-500 ${
            state === 'error' ? 'bg-danger-500' : 'bg-brand-500'
          }`}
          animate={{ 
            scale: isListening || isSpeaking ? [1, 1.3, 1] : 1,
            opacity: isListening || isSpeaking ? [0.2, 0.4, 0.2] : 0.2
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Dynamic Pulse Rings */}
        <AnimatePresence>
          {(isListening || isSpeaking) && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-brand-300/30"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border border-brand-200/20"
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 3.2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 0.5, ease: 'easeOut' }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Main AI Orb Container */}
        <motion.button
          onClick={onPress}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          className={`
            relative z-10 ${s.orb} rounded-full
            flex items-center justify-center
            bg-gradient-to-br ${STATE_GRADIENT[state]}
            shadow-[0_8px_32px_rgba(232,101,43,0.3)]
            border border-white/20
            transition-all duration-500
            focus:outline-none focus:ring-4 focus:ring-brand-200/50
            overflow-hidden
          `}
          aria-label={STATE_LABEL[state]}
        >
          <GradientMesh />
          
          <AnimatePresence mode="wait">
            {state === 'idle' && (
              <motion.div 
                key="mic" 
                initial={{ opacity: 0, scale: 0.5 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.5 }}
                className="text-white drop-shadow-md"
              >
                <Mic size={s.icon} strokeWidth={2.5} />
              </motion.div>
            )}
            
            {state === 'listening' && (
              <motion.div 
                key="wave" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
              >
                <WaveBars />
              </motion.div>
            )}
            
            {state === 'processing' && (
              <motion.div 
                key="proc" 
                initial={{ opacity: 0, rotate: -180 }} 
                animate={{ opacity: 1, rotate: 0 }} 
                exit={{ opacity: 0, rotate: 180 }}
                className="text-white"
              >
                <Loader2 size={s.icon} className="animate-spin" strokeWidth={2.5} />
              </motion.div>
            )}
            
            {state === 'speaking' && (
              <motion.div 
                key="speak" 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-white flex items-center gap-1"
              >
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Volume2 size={s.icon} strokeWidth={2.5} />
                </motion.div>
              </motion.div>
            )}
            
            {state === 'error' && (
              <motion.div 
                key="err" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="text-white"
              >
                <AlertCircle size={s.icon} strokeWidth={2.5} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Futuristic Status Label */}
      <div className="text-center space-y-1">
        <motion.p
          key={state}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[13px] font-bold text-brand-700 uppercase tracking-widest select-none"
        >
          {state === 'idle' ? 'Ready' : state}
        </motion.p>
        <p className="text-[11px] text-neutral-400 font-medium">
          {STATE_LABEL[state]}
        </p>
      </div>
    </div>
  )
}
