import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { sessionLifecycle } from '@/auth/sessionLifecycle'
import { MAIN_CONTENT_ID } from '@/components/layout/SkipLink'

export const SIGNED_OUT_MESSAGE = 'Você saiu da conta.'

/** Foco no `<main id="conteudo">`: depois de "Sair" o controle que tinha o foco sumiu. */
export function focusMainContent() {
  document.getElementById(MAIN_CONTENT_ID)?.focus()
}

/**
 * "Sair": encerra a sessão pelo ciclo de vida (logout na API, reset do estado privado, socket
 * anônimo), avisa, volta ao Início e põe o foco no conteúdo principal. Mesmo hook no menu do header e na sidebar da conta.
 */
export function useSignOut() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)

  const signOut = async () => {
    if (pending) return
    setPending(true)
    try {
      await sessionLifecycle.endSession('logout')
      toast.success(SIGNED_OUT_MESSAGE)
      await navigate({ to: '/' })
      // O botão do AccountLayout (ou o menu do header) que tinha o foco sumiu: sem isso ele cai no
      // `<body>`. O menu do header ainda prende o foco até desmontar; ele refaz isto no unmount.
      focusMainContent()
    } finally {
      setPending(false)
    }
  }

  return { signOut, pending }
}
