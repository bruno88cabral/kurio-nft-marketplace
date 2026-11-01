import type { QueryClient } from '@tanstack/react-query'
import { cartKeys } from '@/api/cart'
import type { AuthResponse, Cart, CartItem, MergeCartRequest } from '@/contracts'

export const MERGE_FAILED_MESSAGE = 'Não foi possível juntar o carrinho de visitante.'

export interface MergeOnLoginDeps {
  queryClient: QueryClient
  /** Linhas do carrinho do visitante. */
  read: () => CartItem[]
  clear: () => void
  /** `POST /cart/merge`. */
  merge: (body: MergeCartRequest) => Promise<Cart>
  notifyError: (message: string) => void
  /** `captureSession()` tirada ANTES do `await`: o login seguinte (outra conta) invalida o resultado. */
  sameSession: () => boolean
}

/**
 * Hook pós-login (`onSessionEstablished`): junta o carrinho do visitante ao da conta.
 * Sucesso: cancela o `GET /cart` em voo, grava o `Cart` em `['cart', accountId]` e limpa o storage (o servidor já
 * tem as linhas, mesmo que a sessão tenha trocado no meio do caminho; nesse caso só o cache não é tocado).
 * Falha: o storage fica como estava (nada se perde, a próxima entrada tenta de novo), loga o erro, avisa por
 * toast e NÃO relança: o login não pode ser desfeito por isso (o lifecycle só logaria o erro).
 */
export async function mergeAnonymousCartOnLogin({ account }: AuthResponse, deps: MergeOnLoginDeps): Promise<void> {
  const items = deps.read()
  if (items.length === 0) return
  try {
    const cart = await deps.merge({ items })
    deps.clear()
    if (!deps.sameSession()) return
    // Um `GET /cart` que saiu antes do merge (ou durante) pode responder depois e sobrescrever o carrinho mesclado
    // com o antigo: cancela o que estiver em voo na chave antes de gravar. Só a chave do carrinho, não as cotações
    const key = cartKeys.detail(account.id)
    await deps.queryClient.cancelQueries({ queryKey: key, exact: true })
    if (deps.sameSession()) deps.queryClient.setQueryData(key, cart)
  } catch (e) {
    console.error('[cart] merge do carrinho de visitante falhou', e)
    if (deps.sameSession()) deps.notifyError(MERGE_FAILED_MESSAGE)
  }
}
