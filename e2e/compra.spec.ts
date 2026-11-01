import { confirmPurchase, expect, prepareCheckout, test } from './fixtures'

test.describe('compra', () => {
  test('do Detalhe até a Confirmação @main', async ({ page }) => {
    await prepareCheckout(page)
    await confirmPurchase(page)

    await expect(page).toHaveURL(/\/orders\//)
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Transação confirmada na Ethereum.')).toBeVisible()
  })
})
