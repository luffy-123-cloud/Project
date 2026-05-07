// src/router/index.tsx — v3 with new pages (Fields, Marketplace, Scanner)
import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'

// ─── Eager-loaded (critical path) ─────────────────────────────────────────────
import SplashScreen   from '../pages/splash/SplashScreen'
import LanguageSelect from '../pages/splash/LanguageSelect'
import CategorySelect from '../pages/splash/CategorySelect'
import Login          from '../pages/auth/Login'
import Home           from '../pages/home/Home'

// ─── Lazy-loaded ───────────────────────────────────────────────────────────────
const Profile          = lazy(() => import('../pages/auth/Profile'))
const Settings         = lazy(() => import('../pages/settings/Settings'))

// Crop module
const CropHome         = lazy(() => import('../pages/crop/CropHome'))
const CropAdvisory     = lazy(() => import('../pages/crop/CropAdvisory'))
const WeatherAlerts    = lazy(() => import('../pages/crop/WeatherAlerts'))
const MarketPrices     = lazy(() => import('../pages/crop/MarketPrices'))
const SoilHealth       = lazy(() => import('../pages/crop/SoilHealth'))
const GovernmentSchemesRedirect = lazy(() => import('../pages/crop/GovernmentSchemesRedirect'))
const CommunityIntel   = lazy(() => import('../pages/crop/CommunityIntel'))
const HyperlocalAlerts = lazy(() => import('../pages/crop/HyperlocalAlerts'))
const SupplyChain      = lazy(() => import('../pages/crop/SupplyChain'))

// Livestock
const LivestockHome    = lazy(() => import('../pages/livestock/LivestockHome'))
const AnimalHealthLog  = lazy(() => import('../pages/livestock/AnimalHealthLog'))
const VetConnect       = lazy(() => import('../pages/livestock/VetConnect'))
const FeedCalculator   = lazy(() => import('../pages/livestock/FeedCalculator'))
const MilkYieldTracker = lazy(() => import('../pages/livestock/MilkYieldTracker'))
const InsuranceClaims  = lazy(() => import('../pages/livestock/InsuranceClaims'))
const MandiBhav        = lazy(() => import('../pages/livestock/MandiBhav'))

// Poultry
const PoultryHome      = lazy(() => import('../pages/poultry/PoultryHome'))
const FlockDiary       = lazy(() => import('../pages/poultry/FlockDiary'))
const EggLog           = lazy(() => import('../pages/poultry/EggLog'))
const FeedInventory    = lazy(() => import('../pages/poultry/FeedInventory'))
const PoultryMarket    = lazy(() => import('../pages/poultry/PoultryMarket'))
const DiseaseScanner   = lazy(() => import('../pages/poultry/DiseaseScanner'))

// Fishery
const FisheryHome      = lazy(() => import('../pages/fishery/FisheryHome'))
const PondMonitor      = lazy(() => import('../pages/fishery/PondMonitor'))
const WaterQuality     = lazy(() => import('../pages/fishery/WaterQuality'))
const AquaMarket       = lazy(() => import('../pages/fishery/AquaMarket'))
const SeaWeather       = lazy(() => import('../pages/fishery/SeaWeather'))

// Community
const Forum            = lazy(() => import('../pages/community/Forum'))
const SarpanchGPT      = lazy(() => import('../pages/community/SarpanchGPT'))
const KhetiKharcha     = lazy(() => import('../pages/tools/KhetiKharcha'))
const SaudaSuraksha    = lazy(() => import('../pages/tools/SaudaSuraksha'))

// === NEW PAGES ===
const FieldManagement  = lazy(() => import('../pages/fields/FieldManagement'))
const LiveMarketDashboard = lazy(() => import('../pages/fields/LiveMarketDashboard'))
const MarketComparisonDashboard = lazy(() => import('../pages/fields/MarketComparisonDashboard'))
const PriceTrendsDashboard = lazy(() => import('../pages/fields/PriceTrendsDashboard'))
const MarketLocatorDashboard = lazy(() => import('../pages/fields/MarketLocatorDashboard'))
const AddCrop          = lazy(() => import('../pages/fields/AddCrop'))
const MyTasks          = lazy(() => import('../pages/fields/MyTasks'))
const Marketplace      = lazy(() => import('../pages/market/Marketplace'))
const CropScanner      = lazy(() => import('../pages/scanner/CropScanner'))
const FarmRentalHome   = lazy(() => import('../pages/farm-rental/FarmRentalHome'))
const FarmRentalCategory = lazy(() => import('../pages/farm-rental/FarmRentalCategory'))
const ServiceDetail      = lazy(() => import('../pages/farm-rental/ServiceDetail'))
const InfoPage           = lazy(() => import('../pages/info/InfoPage'))
const DesiNews           = lazy(() => import('../pages/info/DesiNews'))

// ─── Loading fallback ──────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-neutral-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-[3px] border-neutral-200 border-t-brand-600 rounded-full animate-spin" />
      <p className="text-neutral-500 text-sm">Loading...</p>
    </div>
  </div>
)

const S = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
)

const router = createBrowserRouter([
  // ── Standalone routes (no AppShell) ─────────────────────────────────────────
  { path: '/splash',       element: <SplashScreen /> },
  { path: '/language',     element: <LanguageSelect /> },
  { path: '/category',     element: <CategorySelect /> },
  { path: '/login',        element: <Login /> },
  { path: '/profile',      element: <S><Profile /></S> },
  { path: '/sarpanchgpt',  element: <S><SarpanchGPT /></S> },
  { path: '/sarpanch-salah', element: <S><SarpanchGPT /></S> },
  { path: '/scanner',      element: <S><CropScanner /></S> },

  // ── Standalone new pages ──────────────────────────────────────────────────
  { path: '/fields/add-crop', element: <S><AddCrop /></S> },
  { path: '/fields/tasks',    element: <S><MyTasks /></S> },

  // ── Main app (with AppShell: BottomNav) ───────────────────────────────────
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },

      // Settings / Profile
      { path: 'settings', element: <S><Settings /></S> },

      // Fields
      { path: 'fields', element: <S><FieldManagement /></S> },
      { path: 'fields/live-market', element: <S><LiveMarketDashboard /></S> },
      { path: 'fields/comparison', element: <S><MarketComparisonDashboard /></S> },
      { path: 'fields/trends', element: <S><PriceTrendsDashboard /></S> },
      { path: 'fields/locator', element: <S><MarketLocatorDashboard /></S> },

      // Marketplace
      { path: 'marketplace',     element: <S><Marketplace /></S> },
      { path: 'info',            element: <S><InfoPage /></S> },
      { path: 'info/desi-news',  element: <S><DesiNews /></S> },
      { path: 'crop-advisory',   element: <S><CropAdvisory /></S> },
      { path: 'mitti-sehat',     element: <S><SoilHealth /></S> },
      { path: 'kheti-kharcha',   element: <S><KhetiKharcha /></S> },
      { path: 'sauda-suraksha',  element: <S><SaudaSuraksha /></S> },
      { path: 'sarkari-yojana',  element: <S><GovernmentSchemesRedirect /></S> },
      { path: 'farm-rental',     element: <S><FarmRentalHome /></S> },
      { path: 'farm-rental/service/:id', element: <S><ServiceDetail /></S> },
      { path: 'farm-rental/:categoryId', element: <S><FarmRentalCategory /></S> },

      // Crop farming
      { path: 'crop',           element: <S><CropHome /></S> },
      { path: 'crop/advisory',  element: <S><CropAdvisory /></S> },
      { path: 'crop/weather',   element: <S><WeatherAlerts /></S> },
      { path: 'crop/market',    element: <S><MarketPrices /></S> },
      { path: 'crop/soil',      element: <S><SoilHealth /></S> },
      { path: 'crop/schemes',   element: <S><GovernmentSchemesRedirect /></S> },
      { path: 'crop/community', element: <S><CommunityIntel /></S> },
      { path: 'crop/alerts',    element: <S><HyperlocalAlerts /></S> },
      { path: 'crop/chain',     element: <S><SupplyChain /></S> },

      // Livestock
      { path: 'livestock',           element: <S><LivestockHome /></S> },
      { path: 'livestock/health',    element: <S><AnimalHealthLog /></S> },
      { path: 'livestock/vet',       element: <S><VetConnect /></S> },
      { path: 'livestock/feed',      element: <S><FeedCalculator /></S> },
      { path: 'livestock/milk',      element: <S><MilkYieldTracker /></S> },
      { path: 'livestock/insurance', element: <S><InsuranceClaims /></S> },
      { path: 'livestock/mandi',     element: <S><MandiBhav /></S> },

      // Poultry
      { path: 'poultry',         element: <S><PoultryHome /></S> },
      { path: 'poultry/flock',   element: <S><FlockDiary /></S> },
      { path: 'poultry/egg',     element: <S><EggLog /></S> },
      { path: 'poultry/feed',    element: <S><FeedInventory /></S> },
      { path: 'poultry/market',  element: <S><PoultryMarket /></S> },
      { path: 'poultry/disease', element: <S><DiseaseScanner /></S> },

      // Fishery
      { path: 'fishery',          element: <S><FisheryHome /></S> },
      { path: 'fishery/pond',     element: <S><PondMonitor /></S> },
      { path: 'fishery/water',    element: <S><WaterQuality /></S> },
      { path: 'fishery/market',   element: <S><AquaMarket /></S> },
      { path: 'fishery/weather',  element: <S><SeaWeather /></S> },

      // Community
      { path: 'forum', element: <S><Forum /></S> },
      { path: 'kisan-kaksha', element: <S><Forum /></S> },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/splash" replace /> },
])

export default function Router() {
  return <RouterProvider router={router} />
}
