/** Inteiro em `[min, max]` (fração é truncada; `max < min` vira `min`). */
export function clampInt(value: number, min: number, max: number): number {
  const upper = Math.max(min, max)
  return Math.min(upper, Math.max(min, Math.trunc(value)))
}

/**
 * Converte o texto digitado no `QuantityStepper` numa quantidade em `[min, max]`.
 * Texto vazio ou que não seja um inteiro sem sinal volta para `fallback` (também limitado).
 */
export function clampQuantity(raw: string, min: number, max: number, fallback: number): number {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return clampInt(fallback, min, max)
  return clampInt(Number.parseInt(trimmed, 10), min, max)
}
