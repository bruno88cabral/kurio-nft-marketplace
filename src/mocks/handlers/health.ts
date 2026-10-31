import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { HealthStatus } from '@/contracts'
import { withScenario } from './withScenario'

// Passa pelo cenário como qualquer endpoint: em `offline`/`server-error` o health também falha,
// o que mantém o painel de debug coerente com o que o resto da API faz
export const healthHandlers = [
  http.get(
    `${API_URL}/health`,
    withScenario('GET', '/health', () =>
      HttpResponse.json<HealthStatus>({ status: 'ok', checkedAt: new Date().toISOString() }),
    ),
  ),
]
