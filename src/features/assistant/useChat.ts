import { useCallback, useRef, useState } from 'react'
import type Anthropic from '@anthropic-ai/sdk'
import { askAi, describeAiError, userMessage } from '../../lib/ai/client'
import { SYSTEM_ASSISTANT, SYSTEM_VISION, vehicleContext } from '../../lib/ai/prompts'
import { useAppStore, useActiveVehicle, useVehicleDiagnoses } from '../../store/useAppStore'
import { todayIso, uid } from '../../lib/format'

/** Wie viele vorherige Nachrichten mitgeschickt werden – hält die Kosten im Rahmen */
const HISTORY_LIMIT = 12

export function useChat() {
  const vehicle = useActiveVehicle()
  const diagnoses = useVehicleDiagnoses()
  const { threads, activeThreadId, newThread, appendMessage, patchMessage } = useAppStore()
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const thread = threads.find((t) => t.id === activeThreadId) ?? null

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
  }, [])

  const send = useCallback(
    async (text: string, image?: string) => {
      const trimmed = text.trim()
      if ((!trimmed && !image) || busy) return

      const threadId = activeThreadId ?? newThread()
      const controller = new AbortController()
      abortRef.current = controller
      setBusy(true)

      appendMessage(threadId, {
        id: uid(),
        role: 'user',
        content: trimmed,
        image,
        createdAt: todayIso(),
      })

      const assistantId = uid()
      appendMessage(threadId, {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: todayIso(),
        pending: true,
      })

      // Verlauf aus dem Store lesen – enthält bereits die neue Nutzernachricht
      const current = useAppStore.getState().threads.find((t) => t.id === threadId)
      const history = (current?.messages ?? [])
        .filter((m) => m.id !== assistantId && !m.error)
        .slice(-HISTORY_LIMIT)

      const messages: Anthropic.MessageParam[] = history.map((m) =>
        m.role === 'user'
          ? userMessage(m.content, m.image)
          : { role: 'assistant' as const, content: m.content || '…' },
      )

      let acc = ''
      try {
        await askAi({
          system: image ? SYSTEM_VISION : SYSTEM_ASSISTANT,
          context: vehicleContext(vehicle, diagnoses),
          messages,
          signal: controller.signal,
          onText: (delta) => {
            acc += delta
            patchMessage(threadId, assistantId, { content: acc })
          },
        })
        patchMessage(threadId, assistantId, { content: acc, pending: false })
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === 'AbortError'
        patchMessage(threadId, assistantId, {
          content: acc,
          pending: false,
          error: aborted ? undefined : describeAiError(err),
        })
      } finally {
        abortRef.current = null
        setBusy(false)
      }
    },
    [activeThreadId, appendMessage, busy, diagnoses, newThread, patchMessage, vehicle],
  )

  return { thread, messages: thread?.messages ?? [], send, stop, busy, vehicle }
}
