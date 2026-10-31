import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { Quote } from '@/contracts'
import { buildQuote } from '../db/quote'
import { scenario, store } from '../runtime'
import { domainGuard } from './domain'
import { requireSession } from './session'
import { withScenario } from './withScenario'

export const quoteHandlers = [
  http.post(
    `${API_URL}/quotes`,
    withScenario('POST', '/quotes', ({ request }) => {
      const { accountId } = requireSession(request)
      const quote = domainGuard(() =>
        store.mutate((db, touch) => buildQuote(db, touch, accountId, scenario.rules, new Date())),
      )
      return HttpResponse.json<Quote>(quote, { status: 201 })
    }),
  ),
]
