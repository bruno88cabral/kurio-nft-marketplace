import { expect, login, openApp, test, USERS } from './fixtures'

test.describe('conta', () => {
  test('rota protegida leva ao login e o redirect volta a ela', async ({ page }) => {
    await openApp(page, '/')
    await page.goto('/wallets')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fwallets/)
    await page.getByLabel('E-mail').fill(USERS.ana.email)
    await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/wallets$/)
  })

  test('logout e troca Ana → Bruno sem dados da Ana', async ({ page }) => {
    await openApp(page, '/')
    await login(page, 'ana', '/wallets')
    await expect(page).toHaveURL(/\/wallets$/)
    const main = page.getByRole('main')
    const walletCards = main.getByRole('button', { name: /^Ações da carteira/ })
    await expect(walletCards).toHaveCount(1)

    await page.getByRole('button', { name: USERS.ana.name }).click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await expect(page.getByText('Você saiu da conta.')).toBeVisible()

    await login(page, 'bruno', '/wallets')
    await expect(page.getByRole('button', { name: USERS.bruno.name })).toBeVisible()
    await expect(walletCards).toHaveCount(2)
    await expect(page.getByText(USERS.ana.name)).toHaveCount(0)
  })
})
