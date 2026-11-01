// Avatar do perfil: o mock aceita um data URL png/jpeg/webp/gif de até 200.000 caracteres
// (`src/mocks/handlers/profile.ts`). O base64 cresce 4/3, então o arquivo precisa ter até ~146 KB;
// o limite do cliente é 140 KB para sobrar margem para o prefixo. Sem redimensionar no cliente.

export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export const MAX_AVATAR_BYTES = 140 * 1024
/** Valor do `accept` do input de arquivo (o picker filtra, mas a validação não depende dele). */
export const AVATAR_ACCEPT = AVATAR_TYPES.join(',')

export const AVATAR_MESSAGES = {
  invalidType: 'Envie uma imagem PNG, JPEG, WebP ou GIF.',
  tooLarge: 'A imagem deve ter até 140 KB.',
  readFailed: 'Não foi possível ler a imagem. Tente outro arquivo.',
} as const

/** Erro do arquivo escolhido, ou `undefined` se pode ser enviado. Nada é enviado com erro. */
export function checkAvatarFile({ type, size }: { type: string; size: number }): string | undefined {
  if (!(AVATAR_TYPES as readonly string[]).includes(type)) return AVATAR_MESSAGES.invalidType
  if (size > MAX_AVATAR_BYTES) return AVATAR_MESSAGES.tooLarge
  return undefined
}

/** Iniciais do fallback: primeira letra das duas primeiras palavras, em maiúsculas. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toLocaleUpperCase('pt-BR')
}

/** Lê o arquivo como data URL (`data:image/...;base64,...`), o formato do contrato. */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error(AVATAR_MESSAGES.readFailed))
    reader.onerror = () => reject(reader.error ?? new Error(AVATAR_MESSAGES.readFailed))
    reader.readAsDataURL(file)
  })
}
