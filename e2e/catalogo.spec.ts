import { expect, openApp, test } from './fixtures'

test.describe('catálogo', () => {
  test('busca e filtro compõem a URL; voltar restaura o estado anterior', async ({ page }) => {
    await openApp(page, '/')
    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    const search = page.getByRole('search', { name: 'Buscar NFTs' }).locator('input')
    await search.fill('solar')
    await search.press('Enter')
    await expect(page).toHaveURL(/[?&]q=solar/)

    await page.getByRole('radio', { name: /^Ethereum \(/ }).first().click()
    await expect(page).toHaveURL(/[?&]network=ethereum/)
    await expect(page).toHaveURL(/[?&]q=solar/)

    await page.goBack()
    await expect(page).not.toHaveURL(/network=/)
    await expect(page).toHaveURL(/[?&]q=solar/)
  })

  test('aba do catálogo entra na URL e voltar restaura @main', async ({ page }) => {
    await openApp(page, '/')
    await page.getByRole('tab', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/[?&]tab=trending/)
    await expect(page.getByRole('tab', { name: 'Em alta' })).toHaveAttribute('aria-selected', 'true')

    await page.goBack()
    await expect(page).not.toHaveURL(/tab=trending/)
    await expect(page.getByRole('tab', { name: 'Todos os NFTs' })).toHaveAttribute('aria-selected', 'true')
  })
})
