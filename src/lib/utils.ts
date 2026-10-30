import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Registra a escala tipográfica do projeto (src/index.css) no grupo font-size,
// para que twMerge não confunda text-caption com uma cor de texto
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'heading', 'body-lg', 'body', 'caption', 'tiny'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
