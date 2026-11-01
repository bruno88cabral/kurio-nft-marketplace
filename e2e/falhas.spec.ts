import { confirmPurchase, countOrderPosts, expect, prepareCheckout, test } from './fixtures'

test.describe('falhas', () => {
  test('order-timeout: "Tentar de novo" reenvia e gera um único pedido', async ({ page }) => {
    test.setTimeout(60_000)
    const posts = countOrderPosts(page)
    await prepareCheckout(page, 'order-timeout')
    await confirmPurchase(page)

    const main = page.getByRole('main')
    await expect(main.getByText('Não confirmamos o envio.')).toBeVisible({ timeout: 20_000 })
    await main.getByRole('button', { name: 'Tentar de novo' }).click()

    await expect(page).toHaveURL(/\/orders\//, { timeout: 20_000 })
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 15_000 })
    // Duas tentativas com a mesma Idempotency-Key e um único pedido do lado do servidor
    expect(posts()).toBe(2)
    const orders = await page.evaluate(async () => {
      const raw = localStorage.getItem('kurio:session')
      const token = raw ? (JSON.parse(raw) as { token: string }).token : ''
      const res = await fetch('/api/orders', { headers: { authorization: `Bearer ${token}` } })
      return (await res.json()) as unknown
    })
    const list = Array.isArray(orders) ? orders : (orders as { items: unknown[] }).items
    expect(list).toHaveLength(1)
  })

  test('payment-declined mostra "Pagamento recusado"', async ({ page }) => {
    await prepareCheckout(page, 'payment-declined')
    await confirmPurchase(page)

    await expect(page).toHaveURL(/\/orders\//)
    await expect(page.getByText('Pagamento recusado')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: 'Voltar ao pagamento' }).or(page.getByRole('button', { name: 'Voltar ao pagamento' }))).toBeVisible()
  })
})
