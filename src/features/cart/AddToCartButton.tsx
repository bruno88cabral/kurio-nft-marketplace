import { useNavigate } from '@tanstack/react-router'
import { LoaderCircle, ShoppingCart } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, type CartItem } from '@/contracts'
import { Button } from '@/components/ui/button'
import { useCart } from './useCart'

export const ADD_TO_CART_FAILURE_MESSAGE = 'Não foi possível adicionar ao carrinho.'

export interface AddToCartButtonProps {
  item: CartItem
  /** Unidades disponíveis da edição (o visitante é limitado aqui; o servidor decide para o logado). */
  available: number
  /**
   * 409 (acima do estoque): recebe o texto da API para mostrar onde o consumidor quiser (`role="alert"`
   * no painel). Sem esta prop, vira toast (barra mobile). `null` = nova tentativa, limpa o aviso.
   */
  onStockError?: (message: string | null) => void
  size?: 'default' | 'lg'
  className?: string
}

/**
 * "Adicionar ao carrinho" do Detalhe (painel e barra mobile). Visitante adiciona local, sem login.
 * Enquanto envia (ou a sessão está sendo confirmada) fica `aria-busy` e ignora cliques (`aria-disabled`, não
 * `disabled`, para o foco não se perder).
 */
export function AddToCartButton({ item, available, onStockError, size, className }: AddToCartButtonProps) {
  const { add, isPending, isAuthenticated } = useCart()
  // Sessão (token guardado) ainda sendo confirmada: adicionar agora cairia no carrinho local de visitante
  const confirmingSession = isPending && !isAuthenticated
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  // Trava síncrona: dois cliques no mesmo tick não passam pelo estado ainda não renderizado
  const inFlight = useRef(false)

  const submit = async () => {
    if (inFlight.current || confirmingSession) return
    inFlight.current = true
    setSending(true)
    onStockError?.(null)
    try {
      await add(item, { available })
      toast.success('Adicionado ao carrinho', {
        action: { label: 'Ver carrinho', onClick: () => void navigate({ to: '/cart' }) },
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        if (onStockError) onStockError(error.message)
        else toast.error(error.message)
      } else {
        toast.error(ADD_TO_CART_FAILURE_MESSAGE)
      }
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  return (
    <Button
      type="button"
      size={size}
      className={className}
      aria-busy={sending || confirmingSession || undefined}
      aria-disabled={sending || confirmingSession || undefined}
      onClick={() => void submit()}
    >
      {sending ? (
        <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
      ) : (
        <ShoppingCart aria-hidden />
      )}
      Adicionar ao carrinho
    </Button>
  )
}
