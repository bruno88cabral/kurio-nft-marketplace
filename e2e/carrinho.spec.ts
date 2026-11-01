import { buyFromDetail, expect, login, openApp, test } from './fixtures'

test.describe('carrinho', () => {
  test('adicionar, alterar quantidade, cupom KURIO10 e persistência após refresh @main', async ({ page }) => {
    await openApp(page, '/')
    await login(page, 'ana')
    await buyFromDetail(page)

    const main = page.getByRole('main')
    await expect(main.getByText('Solar Veil').first()).toBeVisible()
    await expect(main.getByText('0.352 ETH').first()).toBeVisible()

    await main.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await expect(main.getByLabel(/^Quantidade/)).toHaveValue('2')
    await expect(main.getByText('0.702 ETH').first()).toBeVisible()
    await main.getByRole('button', { name: 'Diminuir quantidade' }).click()
    await expect(main.getByLabel(/^Quantidade/)).toHaveValue('1')
    await expect(main.getByText('0.352 ETH').first()).toBeVisible()

    await main.getByLabel('Código promocional').fill('kurio10')
    await main.getByRole('button', { name: 'Aplicar' }).click()
    await expect(main.getByText(/Cupom KURIO10 aplicado/)).toBeVisible()
    await expect(main.getByText('0.317 ETH').first()).toBeVisible()

    await page.reload()
    await expect(main.getByText('Solar Veil').first()).toBeVisible()
    await expect(main.getByText('0.317 ETH').first()).toBeVisible()
  })
})
