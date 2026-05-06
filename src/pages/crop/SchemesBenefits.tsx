import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ExternalLink, Landmark, LoaderCircle, Sparkles, XCircle } from 'lucide-react'
import { get, set } from 'idb-keyval'
import Card from '../../components/ui/Card'
import { listYojanas, type YojanaRecord } from '../../services/firebase/firestoreService'
import { generateAiText } from '../../services/gemini/geminiClient'
import { useAuthStore } from '../../store/useAuthStore'
import { useLocationStore } from '../../store/useLocationStore'
import { useLanguageStore } from '../../store/useLanguageStore'

const YOJANA_CACHE_KEY = 'sarkari-yojana-catalog'

// Real Indian government schemes — comprehensive, accurate data
const FALLBACK_YOJANAS: YojanaRecord[] = [
  {
    id: 'pm-kisan',
    title: 'PM-KISAN Samman Nidhi',
    eligibility: 'Small and marginal farmers with cultivable land up to 2 hectares (≈5 acres).',
    benefits: '₹6,000/year income support, transferred in 3 installments of ₹2,000 directly to bank account.',
    state: 'All India',
    category: 'income',
    maxLandAcres: 5,
    maxAnnualIncome: 600000,
  },
  {
    id: 'pmfby',
    title: 'PM Fasal Bima Yojana (PMFBY)',
    eligibility: 'All farmers growing notified crops. Compulsory for loanee farmers, voluntary for others.',
    benefits: 'Comprehensive crop insurance. Premium: Kharif 2%, Rabi 1.5%, commercial 5%. Full compensation for crop loss.',
    state: 'All India',
    category: 'insurance',
    maxLandAcres: 20,
    maxAnnualIncome: 1000000,
  },
  {
    id: 'kcc',
    title: 'Kisan Credit Card (KCC)',
    eligibility: 'All farmers, tenant farmers, oral lessees, and sharecroppers.',
    benefits: 'Short-term credit up to ₹3 lakh at 4% interest rate (with interest subvention). Covers cultivation, post-harvest, and allied activities.',
    state: 'All India',
    category: 'credit',
    maxLandAcres: 30,
    maxAnnualIncome: 2000000,
  },
  {
    id: 'soil-health',
    title: 'Soil Health Card Scheme',
    eligibility: 'Any farmer wanting scientific soil recommendations. Free of cost.',
    benefits: 'Free soil testing, nutrient recommendations, fertilizer guidance. Card valid for 2 years.',
    state: 'All India',
    category: 'soil',
  },
  {
    id: 'pm-kusum',
    title: 'PM-KUSUM Scheme',
    eligibility: 'Farmers with irrigated land. Individual/group farmers, cooperatives, panchayats.',
    benefits: 'Subsidy for solar pumps (60% from govt). Solar power plants on barren/fallow land. Sell excess power to DISCOMS.',
    state: 'All India',
    category: 'irrigation',
    maxLandAcres: 25,
    maxAnnualIncome: 1000000,
  },
  {
    id: 'nabard-mf',
    title: 'NABARD Micro Finance',
    eligibility: 'Small, marginal farmers, rural artisans. SHG members eligible for larger amounts.',
    benefits: 'Microloans at concessional rates through SHGs. No collateral required for loans up to ₹1.6 lakh.',
    state: 'All India',
    category: 'credit',
    maxLandAcres: 5,
    maxAnnualIncome: 300000,
  },
  {
    id: 'rkvy',
    title: 'RKVY — Agri Infrastructure Fund',
    eligibility: 'Farmers, FPOs, cooperatives for agri-infrastructure projects.',
    benefits: '3% interest subvention on loans up to ₹2 crore. Covers cold storage, processing units, warehouses, farm gates.',
    state: 'All India',
    category: 'infrastructure',
    maxLandAcres: 100,
    maxAnnualIncome: 5000000,
  },
  {
    id: 'e-nam',
    title: 'e-NAM (National Agriculture Market)',
    eligibility: 'All farmers with APMC registered produce. Requires e-NAM registration.',
    benefits: 'Online trading across 1,000+ mandis. Better price discovery. Direct payment to bank account.',
    state: 'All India',
    category: 'market',
  },
  {
    id: 'pmgsy-wua',
    title: 'Water User Associations Scheme',
    eligibility: 'Farmer groups in command area of irrigation projects.',
    benefits: 'Participatory irrigation management. Subsidized maintenance of irrigation channels and micro-irrigation.',
    state: 'All India',
    category: 'irrigation',
  },
  {
    id: 'agri-clinic',
    title: 'Agri-Clinic and Agri-Business',
    eligibility: 'Agriculture graduates, diploma holders wanting to start agri ventures.',
    benefits: 'Training + credit-linked subsidy 36-44% for setting up agricultural service clinics.',
    state: 'All India',
    category: 'training',
  },
  {
    id: 'mh-gopinath',
    title: 'Gopinath Munde Farmer Accident Insurance (MH)',
    eligibility: 'Maharashtra farmers aged 10-75 years cultivating their own or leased land.',
    benefits: '₹2 lakh accidental death/disability insurance. ₹1 lakh for partial disability. Free for all registered farmers.',
    state: 'Maharashtra',
    category: 'insurance',
  },
  {
    id: 'mh-mfms',
    title: 'Maharashtra Shetkari Sanman Nidhi',
    eligibility: 'Small farmers owning less than 5 acres in Maharashtra.',
    benefits: '₹6,000 per year supplemental income support on top of PM-KISAN.',
    state: 'Maharashtra',
    category: 'income',
    maxLandAcres: 5,
    maxAnnualIncome: 500000,
  },
  {
    id: 'ka-raitha-siri',
    title: 'Raitha Siri Scheme (Karnataka)',
    eligibility: 'Karnataka farmers with crop failure due to drought or flood.',
    benefits: '₹5,500/year per farmer affected by drought. Additional assistance for irrigation deficit areas.',
    state: 'Karnataka',
    category: 'income',
    maxLandAcres: 10,
    maxAnnualIncome: 600000,
  },
  {
    id: 'ka-bhoomi',
    title: 'Bhoomi Online Land Records (Karnataka)',
    eligibility: 'Any land owner in Karnataka.',
    benefits: 'Free access to RTCs (Pahani), mutation register, sketch maps online. Required for scheme eligibility.',
    state: 'Karnataka',
    category: 'document',
  },
  {
    id: 'pb-atta-daal',
    title: 'Punjab Atta-Dal Scheme',
    eligibility: 'Below Poverty Line (BPL) card holders in Punjab.',
    benefits: 'Subsidized wheat flour (atta) and pulses (dal) at heavily discounted rates.',
    state: 'Punjab',
    category: 'food',
    maxAnnualIncome: 200000,
  },
  {
    id: 'tn-cm-kisan',
    title: 'CM Kisan Fund — Tamil Nadu',
    eligibility: 'All small farmers in Tamil Nadu cultivating food crops.',
    benefits: '₹1,000 per year as cultivation assistance. Additional drought relief during deficit rainfall years.',
    state: 'Tamil Nadu',
    category: 'income',
    maxLandAcres: 5,
    maxAnnualIncome: 500000,
  },
]

const ALL_STATES = [
  'All India', 'Andhra Pradesh', 'Bihar', 'Chhattisgarh', 'Gujarat', 'Haryana',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha',
  'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
]

const ALL_CATEGORIES = [
  { value: 'all', label: 'All Schemes' },
  { value: 'income', label: '💰 Income Support' },
  { value: 'insurance', label: '🛡️ Crop Insurance' },
  { value: 'credit', label: '🏦 Credit / Loans' },
  { value: 'irrigation', label: '💧 Irrigation' },
  { value: 'soil', label: '🌱 Soil & Testing' },
  { value: 'market', label: '📊 Market Access' },
  { value: 'infrastructure', label: '🏗️ Infrastructure' },
  { value: 'training', label: '📚 Training' },
  { value: 'document', label: '📄 Documents' },
  { value: 'food', label: '🌾 Food Security' },
]

const landHoldingToAcres = (value?: string) => {
  if (value === '<1') return 0.5
  if (value === '1-5') return 3
  if (value === '5-10') return 7.5
  if (value === '10+') return 12
  return 3
}

const CATEGORY_COLORS: Record<string, string> = {
  income: 'bg-emerald-100 text-emerald-800',
  insurance: 'bg-blue-100 text-blue-800',
  credit: 'bg-purple-100 text-purple-800',
  irrigation: 'bg-sky-100 text-sky-800',
  soil: 'bg-amber-100 text-amber-800',
  market: 'bg-indigo-100 text-indigo-800',
  infrastructure: 'bg-slate-100 text-slate-800',
  training: 'bg-teal-100 text-teal-800',
  document: 'bg-neutral-100 text-neutral-800',
  food: 'bg-orange-100 text-orange-800',
  general: 'bg-neutral-100 text-neutral-700',
}

export default function SchemesBenefits() {
  const farmer = useAuthStore((state) => state.farmer)
  const locationState = useLocationStore((state) => state.state) || farmer?.state || 'All India'
  const { language } = useLanguageStore()

  const [schemes, setSchemes] = useState<YojanaRecord[]>(FALLBACK_YOJANAS)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedState, setSelectedState] = useState(locationState || 'All India')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [annualIncome, setAnnualIncome] = useState('250000')
  const [checkedSchemeId, setCheckedSchemeId] = useState('')
  const [aiSchemes, setAiSchemes] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadSchemes = async () => {
      setIsLoading(true)

      try {
        const cached = await get<YojanaRecord[]>(YOJANA_CACHE_KEY)
        if (cached?.length && !cancelled) {
          setSchemes([...FALLBACK_YOJANAS, ...cached.filter(s => !FALLBACK_YOJANAS.find(f => f.id === s.id))])
        }

        const remote = await listYojanas(selectedState)
        if (!cancelled && remote.length) {
          const merged = [
            ...FALLBACK_YOJANAS,
            ...remote.filter(s => !FALLBACK_YOJANAS.find(f => f.id === s.id)),
          ]
          setSchemes(merged)
          await set(YOJANA_CACHE_KEY, remote)
        }
      } catch (error) {
        console.error(error)
        if (!cancelled) setSchemes(FALLBACK_YOJANAS)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadSchemes()

    return () => { cancelled = true }
  }, [selectedState])

  const filteredSchemes = useMemo(() => {
    return schemes.filter((scheme) => {
      const stateMatches = selectedState === 'All India' || scheme.state === 'All India' || scheme.state === selectedState
      const categoryMatches = selectedCategory === 'all' || scheme.category === selectedCategory
      return stateMatches && categoryMatches
    })
  }, [schemes, selectedCategory, selectedState])

  const landAcres = landHoldingToAcres(farmer?.landHolding)
  const incomeValue = Number(annualIncome) || 0

  const handleAiDiscovery = async () => {
    setAiLoading(true)
    setAiSchemes('')
    try {
      const result = await generateAiText({
        systemPrompt: `You are a government scheme advisor for Indian farmers. List 3-5 additional government schemes the farmer below may qualify for that are NOT already in the standard list. Include state-specific schemes if applicable. Be specific about eligibility and benefits. Reply in short bullet points in simple language. Language: ${language}.`,
        userMessage: `Farmer profile:
State: ${selectedState}
Land holding: ${farmer?.landHolding || '1-5 acres'}
Crops: ${farmer?.crops?.join(', ') || 'General crops'}
Annual income: ₹${incomeValue.toLocaleString('en-IN')}
Water source: ${farmer?.waterSource || 'rain-fed'}

List additional applicable schemes not commonly known.`,
        model: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'],
      })
      setAiSchemes(result)
    } catch {
      setAiSchemes('Unable to fetch AI recommendations right now. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="px-4 py-5 max-w-5xl mx-auto w-full space-y-5 pb-24">
      <section className="rounded-[28px] bg-gradient-to-br from-indigo-700 via-indigo-600 to-cyan-500 p-5 lg:p-7 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/75">Sarkari Yojana</p>
            <h1 className="mt-2 text-3xl lg:text-4xl font-black" style={{ fontFamily: 'Baloo 2, sans-serif' }}>
              Find schemes you can use
            </h1>
            <p className="mt-2 text-sm text-white/90">
              {filteredSchemes.length} government schemes available · Filter by state and category to check eligibility.
            </p>
          </div>
          <div className="rounded-3xl bg-white/15 p-3">
            <Landmark size={28} />
          </div>
        </div>
      </section>

      <Card className="space-y-4 border border-neutral-200">
        <h2 className="text-lg font-bold text-neutral-900">Filters</h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-semibold text-neutral-700">State</span>
            <select
              value={selectedState}
              onChange={(event) => setSelectedState(event.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none focus:border-indigo-500 font-medium"
            >
              {ALL_STATES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-neutral-700">Category</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none focus:border-indigo-500 font-medium"
            >
              {ALL_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-semibold text-neutral-700">Annual Income (₹)</span>
            <input
              type="number"
              value={annualIncome}
              onChange={(event) => setAnnualIncome(event.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 outline-none focus:border-indigo-500 font-medium"
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-3 border border-neutral-200">
        <h2 className="text-base font-bold text-neutral-900">Eligibility basis</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900">
            🌾 Land: <strong>{farmer?.landHolding || '1-5 acres'}</strong> (~{landAcres} acres)
          </div>
          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm font-semibold text-indigo-900">
            💰 Annual Income: <strong>₹{incomeValue.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </Card>

      {/* Scheme cards — 2-col grid on larger screens */}
      <div className="grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <Card className="flex items-center gap-2 border border-neutral-200 text-sm text-neutral-500">
            <LoaderCircle size={18} className="animate-spin" />
            Loading yojanas...
          </Card>
        ) : (
          filteredSchemes.map((scheme) => {
            const landEligible = !scheme.maxLandAcres || landAcres < scheme.maxLandAcres
            const incomeEligible = !scheme.maxAnnualIncome || incomeValue < scheme.maxAnnualIncome
            const isEligible = landEligible && incomeEligible
            const isChecked = checkedSchemeId === scheme.id
            const categoryColor = CATEGORY_COLORS[scheme.category || 'general'] || CATEGORY_COLORS.general

            return (
              <Card key={scheme.id} className="space-y-4 border border-neutral-200 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-neutral-900">{scheme.title}</p>
                    <p className="mt-1 text-xs font-semibold text-neutral-500">{scheme.state}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold shrink-0 ${categoryColor}`}>
                    {ALL_CATEGORIES.find(c => c.value === scheme.category)?.label || scheme.category || 'general'}
                  </span>
                </div>

                <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700 flex-1">
                  <p><strong>Eligibility:</strong> {scheme.eligibility}</p>
                  <p className="mt-2"><strong className="text-emerald-700">Benefits:</strong> {scheme.benefits}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setCheckedSchemeId(isChecked ? '' : scheme.id)}
                  className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-3 text-sm font-bold text-white transition-colors"
                >
                  {isChecked ? 'Hide Result' : 'Check Eligibility'}
                </button>

                {isChecked ? (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      isEligible ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-red-50 border border-red-200 text-red-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {isEligible
                        ? <><CheckCircle2 size={16} className="text-emerald-600" /> ✅ Likely Eligible</>
                        : <><XCircle size={16} className="text-red-500" /> ⚠️ May Not Qualify</>
                      }
                    </div>
                    <p className="mt-2 text-xs">
                      {isEligible
                        ? "Your land holding and income fit this scheme's threshold. Visit your nearest Krishi Vigyan Kendra (KVK) or CSC to apply."
                        : 'Either land holding or income may exceed the scheme threshold. Verify official conditions before applying at your local block office.'}
                    </p>
                  </div>
                ) : null}
              </Card>
            )
          })
        )}
      </div>

      {/* AI-Powered Scheme Discovery */}
      <Card className="space-y-4 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-cyan-50">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-100 p-3">
            <Sparkles size={20} className="text-indigo-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-900">AI Scheme Discovery</h2>
            <p className="text-xs text-neutral-500">Find lesser-known schemes for your specific profile.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleAiDiscovery()}
          disabled={aiLoading}
          className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-3 text-sm font-bold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {aiLoading ? (
            <><LoaderCircle size={16} className="animate-spin" /> Finding schemes for you...</>
          ) : (
            <><Sparkles size={16} /> Find More Schemes via AI</>
          )}
        </button>

        {aiSchemes && (
          <div className="rounded-2xl bg-white border border-indigo-100 px-4 py-4 text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed">
            <p className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
              <ExternalLink size={14} /> AI Recommendations — {selectedState}
            </p>
            {aiSchemes}
          </div>
        )}
      </Card>
    </div>
  )
}
