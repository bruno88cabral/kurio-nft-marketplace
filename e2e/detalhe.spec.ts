import { expect, openApp, test } from './fixtures'

test.describe('detalhe', () => {
  test('acesso direto mostra o NFT', async ({ page }) => {
    await openApp(page, '/nfts/nft-002')
    await expect(page.getByRole('heading', { level: 1, name: /Solar Veil/ })).toBeVisible()
  })

  test('NFT inexistente mostra "não encontrado"', async ({ page }) => {
    await openApp(page, '/nfts/nao-existe')
    await expect(page.getByText('NFT não encontrado').first()).toBeVisible()
    await expect(page).toHaveTitle('NFT não encontrado · Kurio')
  })
})
