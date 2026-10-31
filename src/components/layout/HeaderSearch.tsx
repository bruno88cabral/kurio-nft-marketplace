import { useNavigate, useSearch } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { withFilter } from '@/lib/catalogSearch'
import { cn } from '@/lib/utils'

export interface HeaderSearchProps {
  className?: string
}

/**
 * Busca do header (MYK-1075): o ícone abre um campo `role="search"` preenchido com o `q` atual.
 * Enter navega para `/` com `withFilter(search, { q })` (volta à página 1, mantém os filtros
 * quando já está no Início) e rola até `#catalogo`. Esc fecha e devolve o foco ao ícone.
 */
export function HeaderSearch({ className }: HeaderSearchProps) {
  // Fora do Início não há busca do catálogo: começa de uma busca vazia
  const catalog = useSearch({ from: '/', shouldThrow: false })
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const inputId = useId()
  const formId = useId()

  const close = () => {
    setOpen(false)
    toggleRef.current?.focus()
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('q')
    const q = typeof value === 'string' ? value : ''
    void navigate({ to: '/', search: withFilter(catalog ?? {}, { q }), hash: 'catalogo' })
    setOpen(false)
  }

  return (
    <>
      <Button
        ref={toggleRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={open ? 'Fechar busca' : 'Buscar NFTs'}
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? <X aria-hidden /> : <Search aria-hidden />}
      </Button>
      {open && (
        <form
          id={formId}
          role="search"
          aria-label="Buscar NFTs"
          onSubmit={onSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              close()
            }
          }}
          className={cn(
            'border-border bg-background absolute inset-x-0 top-full border-b px-4 py-3 md:px-6',
            className,
          )}
        >
          <div className="mx-auto flex w-full max-w-7xl items-center gap-2">
            <label htmlFor={inputId} className="sr-only">
              Buscar NFTs
            </label>
            <Input
              id={inputId}
              name="q"
              type="search"
              autoFocus
              autoComplete="off"
              defaultValue={catalog?.q ?? ''}
              placeholder="Nome, coleção ou artista"
              className="min-w-0 flex-1"
            />
            <Button type="submit">Buscar</Button>
          </div>
        </form>
      )}
    </>
  )
}
