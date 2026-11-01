import { useState } from 'react'
import { toast } from 'sonner'
import type { UseCart } from './useCart'

export const COUPON_FAILURE_MESSAGE = 'Não foi possível atualizar o cupom.'

/**
 * Aplicar e remover o cupom (Carrinho e Pagamento): `submitting` alimenta o `couponStatus`, e a falha vira um
 * toast. O resultado (`applied`/`invalid`/`expired`) vem da cotação seguinte, não daqui.
 */
export function useCouponActions(cart: Pick<UseCart, 'applyCoupon' | 'removeCoupon'>) {
  const [submitting, setSubmitting] = useState(false)
  const run = async (action: () => Promise<unknown>) => {
    setSubmitting(true)
    try {
      await action()
    } catch {
      toast.error(COUPON_FAILURE_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }
  return {
    submitting,
    apply: (code: string) => void run(() => cart.applyCoupon(code)),
    remove: () => void run(() => cart.removeCoupon()),
  }
}
