import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { sessionLifecycle } from '@/auth/sessionLifecycle'

export const SIGNED_OUT_MESSAGE = 'Você saiu da conta.'

/**
 * "Sair": encerra a sessão pelo ciclo de vida (logout na API, reset do estado privado, socket
 * anônimo), avisa e volta ao Início. Mesmo hook no menu do header e na sidebar da conta.
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
    } finally {
      setPending(false)
    }
  }

  return { signOut, pending }
}
