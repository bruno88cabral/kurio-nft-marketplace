import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>

/**
 * Campo de senha com "Mostrar senha": o nome do botão é fixo e o estado vai em `aria-pressed`
 * (padrão de toggle), ícone olho / olho cortado só decorativo.
 */
export function PasswordInput({ className, id, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} id={id} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Mostrar senha"
        aria-pressed={visible}
        aria-controls={id}
        disabled={props.disabled}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1 -translate-y-1/2"
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
    </div>
  )
}
