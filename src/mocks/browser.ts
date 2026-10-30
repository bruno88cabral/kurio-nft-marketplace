import { setupWorker } from 'msw/browser'
import { healthHandlers } from './handlers/health'
import { socketHandlers } from './socket'

const restHandlers = [...healthHandlers]

export const worker = setupWorker(...restHandlers, ...socketHandlers)
