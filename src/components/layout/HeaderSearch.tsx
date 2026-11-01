import { useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { withFilter } from '@/lib/catalogSearch'
import { cn } from '@/lib/utils'
import { focusCatalogIfLost } from './routeFocus'

export interface HeaderSearchProps {
  className?: string
}

/**
 * Busca do header (MYK-1075): o ícone abre um campo `role="search"` preenchido com o `q` atual.
 * Enter navega para `/` com `withFilter(search, { q })` (volta à página 1, mantém os filtros
 * quando já está no Início), rola até `#catalogo` e põe o foco nele (o campo desmonta ao fechar). Esc fecha e
 * devolve o foco ao ícone; clicar fora ou navegar por outro link fecha sem mexer no foco.
 */
export function HeaderSearch({ className }: HeaderSearchProps) {
  // Fora do Início não há busca do catálogo: começa de uma busca vazia
  const catalog = useSearch({ from: '/', shouldThrow: false })
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const inputId = useId()
  const formId = useId()
  const pathname = useLocation({ select: (l) => l.pathname })

  // Navegou por outro link (header, tab bar): o campo fecha sem roubar o foco
  const [lastPathname, setLastPathname] = useState(pathname)
  if (lastPathname !== pathname) {
    setLastPathname(pathname)
    setOpen(false)
  }

  // Clique ou toque fora do campo e do ícone: fecha sem mexer no foco
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && (formRef.current?.contains(target) || toggleRef.current?.contains(target))) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    toggleRef.current?.focus()
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('q')
    const q = typeof value === 'string' ? value : ''
    setOpen(false)
    // O campo desmonta: o foco vai para o catálogo com o resultado (não para o `<body>`)
    void navigate({ to: '/', search: withFilter(catalog ?? {}, { q }), hash: 'catalogo' }).then(() =>
      requestAnimationFrame(focusCatalogIfLost),
    )
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
        {open ? <X aria-hidden className="size-5" /> : <Search aria-hidden className="size-5" />}
      </Button>
      {open && (
        <form
          ref={formRef}
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
