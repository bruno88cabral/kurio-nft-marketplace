import type { RouterEvents } from '@tanstack/react-router'
import { MAIN_CONTENT_ID } from './SkipLink'

/** Âncora do catálogo no Início: "Mercado", trilhas, buscas, paginação e o EXPLORAR do hero apontam para ela. */
export const CATALOG_ANCHOR_ID = 'catalogo'

/** Foca o elemento sem rolar: a rolagem é do router (topo da página ou o `hash`). */
function focusById(id: string): boolean {
  const target = document.getElementById(id)
  if (!target) return false
  target.focus({ preventScroll: true })
  return document.activeElement === target
}

/** Foco no `<main id="conteudo">` (`tabIndex=-1`): o controle que tinha o foco sumiu ou ficou para trás. */
export function focusMainContent() {
  focusById(MAIN_CONTENT_ID)
}

/** Foco na seção `#catalogo` (`tabIndex=-1`); fora do Início, no `<main>`. */
export function focusCatalog() {
  if (!focusById(CATALOG_ANCHOR_ID)) focusMainContent()
}

/** Diálogos e drawers do Radix (`Dialog`, `Sheet`, `AlertDialog`); o app não tem diálogo não modal. */
const MODAL_SELECTOR = '[role="dialog"], [role="alertdialog"]'

/** Havia um diálogo modal aberto quando a navegação começou (login e cadastro são rotas com modal). */
let leavingModal = false
/** O controle focado quando uma navegação abriu o modal de rota (ex.: o "Entrar" do header). */
let modalOpener: HTMLElement | null = null

/**
 * `onBeforeNavigate`: anota se a navegação sai de um modal (fechar o login com Esc, X, "Voltar" ou depois de entrar)
 * e, fora de um modal, o controle focado, que é o gatilho caso a rota nova seja um modal.
 */
export function noteNavigationStart() {
  leavingModal = document.querySelector(MODAL_SELECTOR) !== null
  if (!leavingModal) modalOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null
}

/**
 * A nova tela já pôs o foco onde queria: num diálogo modal (login, cadastro) ou num elemento do `<main>`
 * (o `h1` da Confirmação, um `autoFocus`, ou a navegação da conta, que continua montada entre Perfil e Carteiras).
 */
function focusAlreadyPlaced(): boolean {
  if (document.querySelector(MODAL_SELECTOR)) return true
  const active = document.activeElement
  const main = document.getElementById(MAIN_CONTENT_ID)
  return active !== null && active !== main && main !== null && main.contains(active)
}

/**
 * Fechou o modal de rota: o Radix não tem gatilho para devolver o foco (o modal abriu por navegação, sem
 * `DialogTrigger`), então ele volta ao controle que abriu o modal, se ainda existe (o "Entrar" do header depois
 * do Esc). Depois de entrar na conta o "Entrar" sumiu, e o foco segue a regra geral.
 */
function returnToModalOpener(): boolean {
  if (!leavingModal || !modalOpener?.isConnected || modalOpener === document.body) return false
  modalOpener.focus({ preventScroll: true })
  return document.activeElement === modalOpener
}

type ResolvedEvent = Pick<RouterEvents['onResolved'], 'fromLocation' | 'toLocation' | 'pathChanged'>

/**
 * Foco depois de uma navegação (§8, MYK-1080): o link clicado desmonta (ou fica no header) e o foco cairia no
 * `<body>`. Só quando o **caminho** muda: filtros, abas e paginação mudam só a `search` e o foco fica no controle
 * que o usuário mexeu. A primeira carga (`fromLocation` ausente) não rouba o foco: o primeiro Tab continua no
 * skip link. Com `#catalogo` o foco vai para a seção do catálogo; senão, para o `<main>`.
 */
export function focusAfterNavigation(event: ResolvedEvent) {
  const modalOpen = document.querySelector(MODAL_SELECTOR) !== null
  if (event.fromLocation && event.pathChanged && !focusAlreadyPlaced() && !returnToModalOpener()) {
    if (event.toLocation.hash === CATALOG_ANCHOR_ID) focusCatalog()
    else focusMainContent()
  }
  // O gatilho só vale enquanto o modal que ele abriu está na tela
  if (!modalOpen) modalOpener = null
}
