import { useNavigate } from '@tanstack/react-router'
import { LoaderCircle, ShoppingCart } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, type CartItem } from '@/contracts'
import { Button } from '@/components/ui/button'
import { guestPartialAddMessage, guestStockLimitMessage } from './cartView'
import { useCart } from './useCart'

export const ADD_TO_CART_FAILURE_MESSAGE = 'Não foi possível adicionar ao carrinho.'

export interface AddToCartButtonProps {
  item: CartItem
  /** Unidades disponíveis da edição (o visitante é limitado aqui; o servidor decide para o logado). */
  available: number
  /**
   * 409 (acima do estoque): recebe o texto da API para mostrar onde o consumidor quiser (`role="alert"`
   * no painel). O visitante já no limite recebe o mesmo tratamento (`guestStockLimitMessage`). Sem esta prop,
   * vira toast (barra mobile). O visitante em que só parte coube também (`guestPartialAddMessage`).
   * `null` = nova tentativa, limpa o aviso.
   */
  onStockError?: (message: string | null) => void
  /**
   * `add` (padrão): adiciona e mostra o toast "Adicionado ao carrinho" com "Ver carrinho".
   * `buy`: o "Comprar" do Figma; adiciona e leva ao carrinho (de onde se segue para o pagamento).
   * Os avisos de estoque e de falha são os mesmos nos dois.
   */
  intent?: 'add' | 'buy'
  /** Texto visível (padrão: "Adicionar ao carrinho" ou "Comprar", conforme o `intent`). */
  label?: string
  /** Só o ícone, com o `label` como nome acessível (botão redondo do Detalhe mobile). */
  iconOnly?: boolean
  size?: 'default' | 'lg'
  className?: string
}

/**
 * "Adicionar ao carrinho" e "Comprar" do Detalhe (painel e barra mobile). Visitante adiciona local, sem login.
 * Enquanto envia (ou a sessão está sendo confirmada) fica `aria-busy` e ignora cliques (`aria-disabled`, não
 * `disabled`, para o foco não se perder).
 */
export function AddToCartButton({
  item,
  available,
  onStockError,
  intent = 'add',
  label = intent === 'buy' ? 'Comprar' : 'Adicionar ao carrinho',
  iconOnly = false,
  size,
  className,
}: AddToCartButtonProps) {
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
      const result = await add(item, { available })
      // Visitante sem lugar para a quantidade inteira: o aviso vai pelo caminho do 409 do logado, sem "Adicionado"
      if (result !== 'added') {
        const message = result === 'partial' ? guestPartialAddMessage(available) : guestStockLimitMessage(available)
        if (onStockError) onStockError(message)
        else toast.error(message)
        return
      }
      if (intent === 'buy') {
        void navigate({ to: '/cart' })
        return
      }
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
      aria-label={iconOnly ? label : undefined}
      aria-busy={sending || confirmingSession || undefined}
      aria-disabled={sending || confirmingSession || undefined}
      onClick={() => void submit()}
    >
      {sending ? (
        <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
      ) : (
        (iconOnly || intent === 'add') && <ShoppingCart aria-hidden />
      )}
      {!iconOnly && label}
    </Button>
  )
}
