import { buyFromDetail, countOrderPosts, emitNftUpdated, expect, login, openApp, prepareCheckout, test } from './fixtures'

test.describe('tempo real', () => {
  test('nft.updated recota o carrinho', async ({ page }) => {
    await openApp(page, '/')
    await login(page, 'ana')
    await buyFromDetail(page)
    const main = page.getByRole('main')
    await expect(main.getByText('0.352 ETH').first()).toBeVisible()

    await emitNftUpdated(page, 'nft-002', { price: '3.33' })
    await expect(main.getByText('3.332 ETH').first()).toBeVisible()
  })

  test('cotação desatualizada no diálogo bloqueia a confirmação até revisar', async ({ page }) => {
    const posts = countOrderPosts(page)
    await prepareCheckout(page)
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('0.352 ETH').first()).toBeVisible()

    await emitNftUpdated(page, 'nft-002', { price: '1.5' })
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(dialog).toBeHidden()
    // O aviso "Cotação desatualizada." pode sumir assim que a recotação chega; o que vale é o total novo sem envio
    await expect(main.getByRole('region', { name: 'Resumo de valores' }).getByText('1.502 ETH').first()).toBeVisible()
    expect(posts()).toBe(0)

    // Revisar de novo: o diálogo reabre já com o total novo e confirmar envia um único pedido
    await main.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('1.502 ETH').first()).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page).toHaveURL(/\/orders\//)
    expect(posts()).toBe(1)
  })
})
