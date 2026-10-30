import { http, HttpResponse } from 'msw'
import type { HealthStatus } from '@/contracts'

export const healthHandlers = [
  http.get('/api/health', () =>
    HttpResponse.json<HealthStatus>({ status: 'ok', mockedAt: new Date().toISOString() }),
  ),
]
