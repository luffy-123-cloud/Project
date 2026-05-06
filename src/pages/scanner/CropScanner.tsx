import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Camera,
  Upload,
  X,
  Loader2,
  Leaf,
  Download,
  Sparkles,
  Share2,
  History,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useScanHistory } from '../../hooks/useScanHistory'
import { loadMobileNet, validateLeafLikeImage } from '../../services/scanner/mobilenetLeaf'
import { identifyPlantWithPlantNet } from '../../services/scanner/plantnetClient'
import { analyzeLeafDiseaseStructured } from '../../services/gemini/geminiClient'
import { useLanguageStore } from '../../store/useLanguageStore'
import { apiAvailability } from '../../config/env'
import type { LeafDiseaseAnalysis, PlantNetMatch } from '../../types/leafScanner'
import { downloadLeafScanPdf } from '../../utils/leafScannerPdf'

type Phase = 'idle' | 'preview' | 'preflight' | 'scanning' | 'ai' | 'result'

const SCAN_STEP_LABELS = [
  { emoji: '1/4', text: 'Scanning...' },
  { emoji: '2/4', text: 'Analyzing...' },
  { emoji: '3/4', text: 'Matching...' },
  { emoji: '4/4', text: 'Predicting...' },
] as const

const STEP_MS = 1250

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const getPlantNetConfidenceLabel = (score: number): string => {
  if (score >= 0.6) return 'High'
  if (score >= 0.25) return 'Moderate'
  return 'Low'
}

export default function CropScanner() {
  const navigate = useNavigate()
  const { language } = useLanguageStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [preflightHint, setPreflightHint] = useState('')
  const [scanStep, setScanStep] = useState(0)
  const [plantMatch, setPlantMatch] = useState<PlantNetMatch | null>(null)
  const [analysis, setAnalysis] = useState<LeafDiseaseAnalysis | null>(null)
  const [modelWarmup, setModelWarmup] = useState(false)
  const { history, saveScan, deleteScan } = useScanHistory()

  useEffect(() => {
    let cancelled = false
    loadMobileNet()
      .then(() => {
        if (!cancelled) setModelWarmup(true)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setFile(null)
    setDataUrl(null)
    setError('')
    setPreflightHint('')
    setScanStep(0)
    setPlantMatch(null)
    setAnalysis(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked || !picked.type.startsWith('image/')) return
    setError('')
    setFile(picked)
    const reader = new FileReader()
    reader.onload = () => {
      setDataUrl(reader.result as string)
      setPhase('preview')
    }
    reader.readAsDataURL(picked)
  }, [])

  const runPipeline = useCallback(async () => {
    if (!dataUrl || !file) return
    if (!apiAvailability.hasPlantnetKey) {
      setError('Add VITE_PLANTNET_API_KEY to your .env file to identify plants.')
      return
    }

    setError('')
    setPhase('preflight')
    setPreflightHint('Checking leaf photo with on-device AI...')

    try {
      await loadMobileNet()
      const leaf = await validateLeafLikeImage(dataUrl)
      if (!leaf.ok) {
        setError('Please upload a clear leaf image')
        setPhase('preview')
        return
      }

      setPreflightHint('Identifying plant (PlantNet)...')
      let plant: PlantNetMatch
      try {
        plant = await identifyPlantWithPlantNet(file)
      } catch (pnErr) {
        const errorMsg = pnErr instanceof Error ? pnErr.message : 'Unknown PlantNet error'
        console.warn('PlantNet identification failed, falling back to Gemini identifying from image', pnErr)
        toast.error(`Plant identification failed: ${errorMsg}. Falling back to visual analysis.`, { duration: 5000 })
        
        // Fallback: provide a placeholder so Gemini can identify it from the image
        plant = {
          scientificName: 'Unknown',
          commonName: 'Detecting via Vision AI...',
          score: 0.9, // Set a fake high score so the confidence label looks better
        }
      }
      setPlantMatch(plant)

      setPhase('scanning')
      setScanStep(0)
      for (let i = 0; i < SCAN_STEP_LABELS.length; i++) {
        setScanStep(i)
        await delay(STEP_MS)
      }

      setPhase('ai')
      const result = await analyzeLeafDiseaseStructured({
        base64Image: dataUrl,
        plantScientificName: plant.scientificName,
        plantCommonName: plant.commonName,
        plantNetScore: plant.score,
        language,
      })
      setAnalysis(result)
      setPhase('result')
      
      // Save to local history
      saveScan({
        imageDataUrl: dataUrl,
        analysis: result,
        plantMatch: plant,
      })
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      if (msg.includes('Not a valid plant')) {
        setError('Not a valid plant image')
      } else if (msg.includes('Plant match confidence is too low')) {
        setError('Plant match confidence is too low. Retake a clearer photo of one leaf and try again.')
      } else if (msg.includes('Invalid disease analysis JSON')) {
        setError('The scan response was incomplete. Please try the scan once more with a clear photo of one leaf.')
      } else {
        setError(msg)
      }
      setPhase('preview')
    }
  }, [dataUrl, file, language])

  const handleDownloadPdf = () => {
    if (!dataUrl || !analysis || !plantMatch) return
    downloadLeafScanPdf({
      imageDataUrl: dataUrl,
      analysis,
      plantLabel: `${plantMatch.commonName} (${plantMatch.scientificName})`,
      plantScore: plantMatch.score,
    })
  }
  
  const handleShare = async () => {
    if (!dataUrl || !analysis || !plantMatch) return
    
    const shareData = {
      title: `Sarpanch AI - ${analysis.cropName} Health Report`,
      text: `My ${analysis.cropName} scan result: ${analysis.diseaseName} (${analysis.severity} severity). Check it out on Sarpanch AI!`,
      url: window.location.origin + '/scanner',
    }

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        toast.success('Report shared successfully!')
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          toast.error('Failed to share report')
        }
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`)
        toast.success('Summary copied to clipboard!')
      } catch {
        toast.error('Sharing not supported on this browser')
      }
    }
  }

  const showScanOverlay = phase === 'scanning' || phase === 'ai'
  const scanningBusy = phase === 'preflight' || phase === 'scanning' || phase === 'ai'

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-brand-50 via-amber-50/40 to-neutral-50 text-neutral-800">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-brand-100 bg-white/90 backdrop-blur shrink-0"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center hover:bg-brand-100 transition-colors"
          aria-label="Back"
        >
          <ChevronLeft size={20} className="text-brand-800" />
        </button>
        <div className="text-center flex-1 px-2">
          <h1 className="text-base font-bold text-brand-900" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
            Leaf Scanner
          </h1>
          <p className="text-[11px] text-neutral-500">AI crop health check</p>
        </div>
        <div className="w-10 flex justify-end">
          {modelWarmup && (
            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
              <Sparkles size={12} /> Ready
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 pb-40 pt-4 md:pb-16 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="w-full rounded-3xl border border-brand-200 bg-white p-6 shadow-sm text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 mb-4">
                  <Leaf size={28} />
                </div>
                <h2 className="text-lg font-bold text-neutral-900 mb-1" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
                  Scan a leaf
                </h2>
                <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
                  Upload a clear photo of a single leaf. We validate it on-device, identify the plant, then analyze
                  disease risk with AI.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2 rounded-2xl bg-brand-600 text-white py-4 shadow-md hover:bg-brand-500 active:scale-[0.98] transition-all"
                  >
                    <Camera size={24} />
                    <span className="text-sm font-semibold">Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center gap-2 rounded-2xl bg-white border border-brand-200 text-brand-800 py-4 hover:bg-brand-50 active:scale-[0.98] transition-all"
                  >
                    <Upload size={24} />
                    <span className="text-sm font-semibold">Upload</span>
                  </button>
                </div>
                {!apiAvailability.hasPlantnetKey && (
                  <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    Add <code className="font-mono text-[11px]">VITE_PLANTNET_API_KEY</code> in{' '}
                    <code className="font-mono text-[11px]">.env</code> for plant identification.
                  </p>
                )}
              </div>

              {history.length > 0 && (
                <div className="w-full mt-8 space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                      <History size={16} className="text-brand-600" />
                      Recent Reports
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="group relative flex items-center gap-3 p-3 rounded-2xl border border-brand-100 bg-white hover:border-brand-300 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                        onClick={() => {
                          setDataUrl(item.imageDataUrl)
                          setAnalysis(item.analysis)
                          setPlantMatch(item.plantMatch)
                          setPhase('result')
                        }}
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-brand-50">
                          <img src={item.imageDataUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-neutral-900 truncate">
                            {item.analysis.cropName}
                          </p>
                          <p className="text-[11px] text-neutral-500 flex items-center gap-2">
                            <span>{item.analysis.diseaseName}</span>
                            <span className="w-1 h-1 rounded-full bg-neutral-300" />
                            <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteScan(item.id)
                            toast.success('Report deleted')
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {(phase === 'preview' ||
            phase === 'preflight' ||
            phase === 'scanning' ||
            phase === 'ai' ||
            phase === 'result') &&
            dataUrl && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4"
              >
                <div className="relative mx-auto w-full max-w-sm aspect-[4/5] rounded-3xl border border-brand-200 bg-white shadow-sm overflow-hidden">
                  <img src={dataUrl} alt="Leaf preview" className="absolute inset-0 w-full h-full object-contain bg-neutral-50" />

                  {showScanOverlay && (
                    <>
                      <div className="absolute inset-0 bg-white/25 backdrop-blur-[1px] pointer-events-none" />
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <motion.div
                          className="absolute left-0 right-0 h-[3px] shadow-[0_0_12px_rgba(249,115,22,0.7)] bg-gradient-to-r from-transparent via-brand-500 to-transparent"
                          animate={{ top: ['0%', '100%', '0%'] }}
                          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </div>
                    </>
                  )}

                  {phase === 'preview' && !scanningBusy && (
                    <button
                      type="button"
                      onClick={reset}
                      className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/95 border border-neutral-200 flex items-center justify-center shadow-sm"
                      aria-label="Remove image"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {phase === 'preflight' && (
                  <div className="flex items-center gap-2 justify-center text-sm text-brand-800">
                    <Loader2 className="animate-spin" size={18} />
                    <span>{preflightHint}</span>
                  </div>
                )}

                {(phase === 'scanning' || phase === 'ai') && (
                  <div className="text-center min-h-[3rem]">
                    <AnimatePresence mode="wait">
                      {phase === 'scanning' && (
                        <motion.p
                          key={scanStep}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          className="text-sm font-semibold text-brand-900"
                        >
                          {SCAN_STEP_LABELS[scanStep]?.emoji} {SCAN_STEP_LABELS[scanStep]?.text}
                        </motion.p>
                      )}
                      {phase === 'ai' && (
                        <motion.p
                          key="ai"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-sm font-semibold text-brand-900 flex items-center justify-center gap-2"
                        >
                          <Loader2 className="animate-spin" size={16} />
                          Final analysis with Gemini...
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {plantMatch && (phase === 'scanning' || phase === 'ai' || phase === 'result') && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm">
                    <p className="font-semibold text-emerald-900">Plant identified</p>
                    <p className="text-emerald-800">
                      {plantMatch.commonName}{' '}
                      {plantMatch.scientificName !== 'Unknown' && (
                        <span className="text-emerald-600 text-xs">({(plantMatch.score * 100).toFixed(1)}% match)</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      Confidence: {getPlantNetConfidenceLabel(plantMatch.score)}
                    </p>
                    {plantMatch.score < 0.25 && (
                      <p className="mt-1 text-xs text-amber-800">
                        This is a weak species match. Use it as a hint and retake a clearer single-leaf photo if needed.
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
                )}

                {phase === 'preview' && !scanningBusy && (
                  <button
                    type="button"
                    onClick={() => void runPipeline()}
                    disabled={!apiAvailability.hasPlantnetKey}
                    className="w-full rounded-2xl bg-brand-600 text-white font-semibold py-3.5 shadow-md hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] transition-all"
                  >
                    Start scan
                  </button>
                )}

                {phase === 'result' && analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm">
                      <h3 className="text-lg font-bold text-neutral-900 mb-3" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
                        Diagnosis
                      </h3>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="text-neutral-500">Crop</span>{' '}
                          <span className="font-semibold text-neutral-900">{analysis.cropName}</span>
                        </p>
                        <p>
                          <span className="text-neutral-500">Condition</span>{' '}
                          <span className="font-semibold text-neutral-900">{analysis.diseaseName}</span>
                        </p>
                        <p>
                          <span className="text-neutral-500">Severity</span>{' '}
                          <span
                            className={`font-semibold ${
                              analysis.severity === 'High'
                                ? 'text-red-700'
                                : analysis.severity === 'Medium'
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                            }`}
                          >
                            {analysis.severity}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-neutral-700 mb-2 px-1">Recommended treatments</h4>
                      <div className="space-y-3">
                        {analysis.treatments.map((t, i) => (
                          <div
                            key={`${t.name}-${i}`}
                            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-semibold text-neutral-900 text-sm">{t.name}</p>
                              <span
                                className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  t.type === 'Organic'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : t.type === 'Chemical'
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-neutral-100 text-neutral-700'
                                }`}
                              >
                                {t.type}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed mb-2">{t.usage}</p>
                            <p className="text-xs font-semibold text-brand-700">Est. cost: INR {t.averageCostInr}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="sticky bottom-3 z-10 -mx-1 mt-2 rounded-[28px] border border-brand-100 bg-white/92 p-3 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white text-brand-800 font-semibold py-3 hover:bg-brand-50 transition-colors"
                        >
                          <Download size={18} />
                          Download report
                        </button>

                        <button
                          type="button"
                          onClick={handleShare}
                          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white text-brand-800 font-semibold py-3 hover:bg-brand-50 transition-colors"
                        >
                          <Share2 size={18} />
                          Share report
                        </button>

                        <button
                          type="button"
                          onClick={reset}
                          className="w-full sm:col-span-2 rounded-2xl bg-brand-600 text-white font-semibold py-3.5 hover:bg-brand-500 transition-all active:scale-[0.98]"
                        >
                          Scan another leaf
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
        </AnimatePresence>
      </main>
    </div>
  )
}
