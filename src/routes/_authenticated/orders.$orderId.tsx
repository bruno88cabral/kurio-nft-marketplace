import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { useState } from 'react'
import { orderQuery } from '@/api/orders'
import { sessionQuery } from '@/auth/useSession'
import { ApiError } from '@/contracts'
import { EmptyState, ErrorState } from '@/components/kurio'
import { buttonVariants } from '@/components/ui/button'
import { OrderStatusView } from '@/features/orders/OrderStatusView'
import { orderRefetchInterval } from '@/features/orders/orderStatus'
import { useSocketConnected } from '@/realtime/useSocketConnected'

export const Route = createFileRoute('/_authenticated/orders/$orderId')({
  // Mesmo padrão do Detalhe: `ensureQueryData` (o Pagamento já deixou o pedido no cache) e 404/403 viram
  // `notFound()`, sem revelar se o pedido existe em outra conta
  loader: async ({ context: { queryClient }, params }) => {
    const { account } = await queryClient.ensureQueryData(sessionQuery())
    try {
      await queryClient.ensureQueryData(orderQuery(account.id, params.orderId))
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'not_found' || error.code === 'forbidden')) throw notFound()
      throw error
    }
    return { accountId: account.id }
  },
  head: () => ({ meta: [{ title: 'Pedido · Kurio' }] }),
  notFoundComponent: OrderNotFound,
  errorComponent: OrderError,
  component: OrderPage,
})

function OrderPage() {
  const { orderId } = Route.useParams()
  const { accountId } = Route.useLoaderData()
  // Polling enquanto `pending` só com o socket fora; conectado, o `order.updated` atualiza o cache (MYK-1091)
  const socketConnected = useSocketConnected()
  const { data: order } = useSuspenseQuery({
    ...orderQuery(accountId, orderId),
    refetchInterval: (query) => orderRefetchInterval(query.state.data, socketConnected),
  })
  return <OrderStatusView accountId={accountId} order={order} />
}

function OrderNotFound() {
  return (
    <>
      <title>Pedido não encontrado · Kurio</title>
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <EmptyState
          icon={<SearchX />}
          title="Pedido não encontrado"
          description="Este pedido não existe ou não pertence à sua conta."
          action={
            <Link to="/" className={buttonVariants({ variant: 'default' })}>
              Voltar ao Início
            </Link>
          }
        />
      </div>
    </>
  )
}

function OrderError() {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <ErrorState
        title="Não foi possível carregar o pedido."
        description="Verifique sua conexão e tente de novo."
        retrying={retrying}
        onRetry={() => {
          setRetrying(true)
          void router.invalidate().finally(() => setRetrying(false))
        }}
      />
    </div>
  )
}
