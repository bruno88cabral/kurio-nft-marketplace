import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/CartPage'

export const Route = createFileRoute('/cart')({
  // Figma mobile: o Carrinho desenha a própria moldura ("Voltar" redondo e "Carrinho de NFTs"), sem o header
  // do site nem a tab bar abaixo de `md` (ver `src/components/layout/routeChrome.ts`)
  staticData: { hideMobileChrome: true },
  head: () => ({ meta: [{ title: 'Carrinho · Kurio' }] }),
  component: CartPage,
})
