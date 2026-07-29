import { Suspense, lazy, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BottomNav } from './AppShell'
import { useAppStore } from '../store/useAppStore'
import { Skeleton } from '../components/ui'

import Dashboard from '../features/dashboard/DashboardScreen'
import Onboarding from '../features/onboarding/OnboardingScreen'
import Assistant from '../features/assistant/AssistantScreen'

// Selten geöffnete Bereiche werden erst bei Bedarf geladen – das hält den Start schnell
const Vehicle = lazy(() => import('../features/vehicle/VehicleScreen'))
const VehicleForm = lazy(() => import('../features/vehicle/VehicleFormScreen'))
const Diagnosis = lazy(() => import('../features/diagnosis/DiagnosisScreen'))
const Maintenance = lazy(() => import('../features/maintenance/MaintenanceScreen'))
const Manual = lazy(() => import('../features/manual/ManualScreen'))
const Guides = lazy(() => import('../features/guides/GuidesScreen'))
const GuideDetail = lazy(() => import('../features/guides/GuideDetailScreen'))
const Value = lazy(() => import('../features/value/ValueScreen'))
const Parts = lazy(() => import('../features/parts/PartsScreen'))
const RepairCosts = lazy(() => import('../features/repair/RepairCostScreen'))
const Documents = lazy(() => import('../features/documents/DocumentsScreen'))
const Workshops = lazy(() => import('../features/workshops/WorkshopsScreen'))
const More = lazy(() => import('../features/more/MoreScreen'))
const Settings = lazy(() => import('../features/settings/SettingsScreen'))
const PartFinder = lazy(() => import('../features/partfinder/PartFinderScreen'))
const Lookup = lazy(() => import('../features/lookup/LookupScreen'))
const Costs = lazy(() => import('../features/costs/CostsScreen'))
const QuoteBuilder = lazy(() => import('../features/quote/QuoteScreen'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function LoadingPage() {
  return (
    <div className="mx-auto w-full max-w-[520px] space-y-3 px-4 pt-20">
      <Skeleton className="h-11 w-2/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const done = useAppStore((s) => s.settings.onboardingDone)
  if (!done) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Suspense fallback={<LoadingPage />}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="*"
            element={
              <RequireOnboarding>
                <>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/vehicle" element={<Vehicle />} />
                    <Route path="/vehicle/new" element={<VehicleForm />} />
                    <Route path="/vehicle/:id/edit" element={<VehicleForm />} />
                    <Route path="/diagnosis" element={<Diagnosis />} />
                    <Route path="/maintenance" element={<Maintenance />} />
                    <Route path="/manual" element={<Manual />} />
                    <Route path="/part-finder" element={<PartFinder />} />
                    <Route path="/lookup" element={<Lookup />} />
                    <Route path="/costs" element={<Costs />} />
                    <Route path="/quote" element={<QuoteBuilder />} />
                    <Route path="/guides" element={<Guides />} />
                    <Route path="/guides/:id" element={<GuideDetail />} />
                    <Route path="/value" element={<Value />} />
                    <Route path="/parts" element={<Parts />} />
                    <Route path="/repair-costs" element={<RepairCosts />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/workshops" element={<Workshops />} />
                    <Route path="/more" element={<More />} />
                    <Route path="/assistant" element={<Assistant />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                  <BottomNav />
                </>
              </RequireOnboarding>
            }
          />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
