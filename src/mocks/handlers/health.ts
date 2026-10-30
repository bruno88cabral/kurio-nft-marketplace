import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { HealthStatus } from '@/contracts'

export const healthHandlers = [
  http.get(`${API_URL}/health`, () =>
    HttpResponse.json<HealthStatus>({ status: 'ok', checkedAt: new Date().toISOString() }),
  ),
]
