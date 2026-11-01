// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './skeleton'

describe('Skeleton', () => {
  it('usa o shimmer (não o pulse) e o data-slot que a regra global de movimento reduzido mira', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.dataset.slot).toBe('skeleton')
    expect(el.className).toContain('animate-shimmer')
    expect(el.className).not.toContain('animate-pulse')
  })

  it('deixa o chamador sobrescrever o raio e o tamanho', () => {
    const { container } = render(<Skeleton className="size-20 rounded-full" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('rounded-full')
    expect(el.className).not.toContain('rounded-md')
  })
})
