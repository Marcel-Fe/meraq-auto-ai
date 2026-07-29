import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type {
  ActivityEntry,
  ChatThread,
  DiagnosisEntry,
  MaintenanceItem,
  Vehicle,
  VehicleDocument,
} from '../types'
import { demoActivities, demoDiagnoses, demoVehicle } from '../data/demoVehicle'
import { defaultMaintenance } from '../lib/maintenance'
import { todayIso, uid } from '../lib/format'

export type AiModel = 'claude-sonnet-5' | 'claude-opus-5' | 'claude-haiku-4-5-20251001'

interface Settings {
  apiKey: string
  model: AiModel
  userName: string
  hourlyRateEur: number
  onboardingDone: boolean
}

interface AppState {
  vehicles: Vehicle[]
  activeVehicleId: string | null
  maintenance: MaintenanceItem[]
  activities: ActivityEntry[]
  diagnoses: DiagnosisEntry[]
  documents: VehicleDocument[]
  threads: ChatThread[]
  activeThreadId: string | null
  settings: Settings

  // Fahrzeuge
  addVehicle: (v: Omit<Vehicle, 'id' | 'createdAt' | 'mileageUpdatedAt'>) => string
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void
  removeVehicle: (id: string) => void
  setActiveVehicle: (id: string) => void
  setMileage: (id: string, mileage: number) => void

  // Wartung
  completeMaintenance: (itemId: string) => void
  updateMaintenance: (itemId: string, patch: Partial<MaintenanceItem>) => void

  // Aktivitäten
  addActivity: (a: Omit<ActivityEntry, 'id'>) => void

  // Diagnose
  addDiagnosis: (d: Omit<DiagnosisEntry, 'id'>) => string
  updateDiagnosis: (id: string, patch: Partial<DiagnosisEntry>) => void
  removeDiagnosis: (id: string) => void

  // Dokumente
  addDocument: (d: Omit<VehicleDocument, 'id'>) => string
  updateDocument: (id: string, patch: Partial<VehicleDocument>) => void
  removeDocument: (id: string) => void

  // Chat
  newThread: () => string
  setActiveThread: (id: string) => void
  removeThread: (id: string) => void
  appendMessage: (threadId: string, msg: ChatThread['messages'][number]) => void
  patchMessage: (threadId: string, msgId: string, patch: Partial<ChatThread['messages'][number]>) => void

  // Einstellungen
  updateSettings: (patch: Partial<Settings>) => void
  resetAll: () => void
}

function seedState() {
  return {
    vehicles: [demoVehicle],
    activeVehicleId: demoVehicle.id,
    maintenance: defaultMaintenance(demoVehicle),
    activities: demoActivities(demoVehicle.id),
    diagnoses: demoDiagnoses(demoVehicle.id),
    documents: [] as VehicleDocument[],
    threads: [] as ChatThread[],
    activeThreadId: null,
  }
}

const defaultSettings: Settings = {
  apiKey: '',
  model: 'claude-sonnet-5',
  userName: '',
  hourlyRateEur: 110,
  onboardingDone: false,
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seedState(),
      settings: defaultSettings,

      addVehicle: (v) => {
        const vehicle: Vehicle = {
          ...v,
          id: uid(),
          createdAt: todayIso(),
          mileageUpdatedAt: todayIso(),
        }
        set((s) => ({
          vehicles: [...s.vehicles, vehicle],
          activeVehicleId: vehicle.id,
          maintenance: [...s.maintenance, ...defaultMaintenance(vehicle)],
        }))
        return vehicle.id
      },

      updateVehicle: (id, patch) =>
        set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),

      removeVehicle: (id) =>
        set((s) => {
          const vehicles = s.vehicles.filter((v) => v.id !== id)
          return {
            vehicles,
            activeVehicleId: s.activeVehicleId === id ? (vehicles[0]?.id ?? null) : s.activeVehicleId,
            maintenance: s.maintenance.filter((m) => m.vehicleId !== id),
            activities: s.activities.filter((a) => a.vehicleId !== id),
            diagnoses: s.diagnoses.filter((d) => d.vehicleId !== id),
            documents: s.documents.filter((d) => d.vehicleId !== id),
          }
        }),

      setActiveVehicle: (id) => set({ activeVehicleId: id }),

      setMileage: (id, mileage) => {
        const vehicle = get().vehicles.find((v) => v.id === id)
        if (!vehicle || mileage === vehicle.mileage) return
        set((s) => ({
          vehicles: s.vehicles.map((v) =>
            v.id === id ? { ...v, mileage, mileageUpdatedAt: todayIso() } : v,
          ),
          activities: [
            {
              id: uid(),
              vehicleId: id,
              date: todayIso(),
              title: 'Kilometerstand aktualisiert',
              detail: `${mileage.toLocaleString('de-DE')} km`,
              icon: 'mileage' as const,
              mileage,
            },
            ...s.activities,
          ],
        }))
      },

      completeMaintenance: (itemId) => {
        const { maintenance, vehicles, activeVehicleId } = get()
        const item = maintenance.find((m) => m.id === itemId)
        const vehicle = vehicles.find((v) => v.id === (item?.vehicleId ?? activeVehicleId))
        if (!item || !vehicle) return
        set((s) => ({
          maintenance: s.maintenance.map((m) =>
            m.id === itemId ? { ...m, lastDoneKm: vehicle.mileage, lastDoneAt: todayIso() } : m,
          ),
          activities: [
            {
              id: uid(),
              vehicleId: vehicle.id,
              date: todayIso(),
              title: `${item.label} erledigt`,
              detail: `bei ${vehicle.mileage.toLocaleString('de-DE')} km`,
              icon: item.kind === 'oil' ? ('oil' as const) : ('repair' as const),
              mileage: vehicle.mileage,
            },
            ...s.activities,
          ],
        }))
      },

      updateMaintenance: (itemId, patch) =>
        set((s) => ({ maintenance: s.maintenance.map((m) => (m.id === itemId ? { ...m, ...patch } : m)) })),

      addActivity: (a) => set((s) => ({ activities: [{ ...a, id: uid() }, ...s.activities] })),

      addDiagnosis: (d) => {
        const entry: DiagnosisEntry = { ...d, id: uid() }
        set((s) => ({
          diagnoses: [entry, ...s.diagnoses],
          activities: [
            {
              id: uid(),
              vehicleId: d.vehicleId,
              date: d.date,
              title: `Fehlercode ${d.code} erfasst`,
              detail: d.title,
              icon: 'diagnosis' as const,
            },
            ...s.activities,
          ],
        }))
        return entry.id
      },

      updateDiagnosis: (id, patch) =>
        set((s) => ({ diagnoses: s.diagnoses.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

      removeDiagnosis: (id) => set((s) => ({ diagnoses: s.diagnoses.filter((d) => d.id !== id) })),

      addDocument: (d) => {
        const doc: VehicleDocument = { ...d, id: uid() }
        set((s) => ({
          documents: [doc, ...s.documents],
          activities: [
            {
              id: uid(),
              vehicleId: d.vehicleId,
              date: todayIso(),
              title: 'Dokument hinzugefügt',
              detail: d.title,
              icon: 'document' as const,
            },
            ...s.activities,
          ],
        }))
        return doc.id
      },

      updateDocument: (id, patch) =>
        set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

      removeDocument: (id) => set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

      newThread: () => {
        const thread: ChatThread = {
          id: uid(),
          title: 'Neue Unterhaltung',
          createdAt: todayIso(),
          updatedAt: todayIso(),
          messages: [],
        }
        set((s) => ({ threads: [thread, ...s.threads], activeThreadId: thread.id }))
        return thread.id
      },

      setActiveThread: (id) => set({ activeThreadId: id }),

      removeThread: (id) =>
        set((s) => {
          const threads = s.threads.filter((t) => t.id !== id)
          return { threads, activeThreadId: s.activeThreadId === id ? (threads[0]?.id ?? null) : s.activeThreadId }
        }),

      appendMessage: (threadId, msg) =>
        set((s) => ({
          threads: s.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: [...t.messages, msg],
                  updatedAt: todayIso(),
                  // Der erste Nutzersatz wird zum Titel der Unterhaltung
                  title:
                    t.messages.length === 0 && msg.role === 'user'
                      ? msg.content.slice(0, 48) || 'Neue Unterhaltung'
                      : t.title,
                }
              : t,
          ),
        })),

      patchMessage: (threadId, msgId, patch) =>
        set((s) => ({
          threads: s.threads.map((t) =>
            t.id === threadId
              ? { ...t, messages: t.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }
              : t,
          ),
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      resetAll: () => set({ ...seedState(), settings: { ...defaultSettings, onboardingDone: true } }),
    }),
    {
      name: 'meraq-auto-ai',
      version: 1,
      // Streamende Nachrichten nicht als "pending" speichern – sonst hängen sie nach Reload
      partialize: (s) => ({
        ...s,
        threads: s.threads.map((t) => ({
          ...t,
          messages: t.messages.map(({ pending: _pending, ...m }) => m),
        })),
      }),
    },
  ),
)

// ---- Selektoren ----
//
// Die Listen-Selektoren filtern und sortieren und liefern damit bei jedem Aufruf
// ein neues Array. Ohne `useShallow` würde React das als Änderung werten und in
// eine Render-Schleife laufen (React-Fehler #185). useShallow vergleicht die
// Elemente einzeln – die stammen unverändert aus dem Store.

const byDateDesc = <T extends { date: string }>(a: T, b: T) => +new Date(b.date) - +new Date(a.date)

export const useActiveVehicle = () =>
  useAppStore((s) => s.vehicles.find((v) => v.id === s.activeVehicleId) ?? s.vehicles[0] ?? null)

export const useVehicleMaintenance = () =>
  useAppStore(useShallow((s) => s.maintenance.filter((m) => m.vehicleId === s.activeVehicleId)))

export const useVehicleActivities = () =>
  useAppStore(
    useShallow((s) => s.activities.filter((a) => a.vehicleId === s.activeVehicleId).sort(byDateDesc)),
  )

export const useVehicleDiagnoses = () =>
  useAppStore(
    useShallow((s) => s.diagnoses.filter((d) => d.vehicleId === s.activeVehicleId).sort(byDateDesc)),
  )

export const useVehicleDocuments = () =>
  useAppStore(
    useShallow((s) => s.documents.filter((d) => d.vehicleId === s.activeVehicleId).sort(byDateDesc)),
  )
