export const MAIN_CONTENT_ID = 'conteudo'

/** Primeiro foco da página: leva o foco ao `<main id="conteudo">` (visível só quando focado). */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      onClick={(e) => {
        // Hash puro não move o foco de forma confiável com o router; foca o main direto.
        const main = document.getElementById(MAIN_CONTENT_ID)
        if (main) {
          e.preventDefault()
          main.focus()
          main.scrollIntoView()
        }
      }}
      className="bg-primary text-primary-foreground focus-visible:ring-ring text-body sr-only z-50 rounded-md px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-3"
    >
      Pular para o conteúdo
    </a>
  )
}
