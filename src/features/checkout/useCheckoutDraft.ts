import { useSyncExternalStore } from 'react'
import type { Id } from '@/contracts'
import { checkoutDraftStore, type CheckoutDraft, type ObservableDraftStore } from './checkoutDraft'

/** Rascunho do checkout da conta (`kurio:checkout:<accountId>`), reativo. */
export function useCheckoutDraft(accountId: Id): { draft: CheckoutDraft; store: ObservableDraftStore } {
  const store = checkoutDraftStore(accountId)
  const draft = useSyncExternalStore(store.subscribe, store.get, store.get)
  return { draft, store }
}
