import type { ReactNode } from 'react'
import { OutOfScopeAction } from '@/components/kurio'
import { cn } from '@/lib/utils'

/** Benefícios do Figma: círculo laranja com a letra, título branco e texto marrom. */
const highlights = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

const columns: { title: string; links: string[] }[] = [
  {
    title: 'Meu perfil',
    links: ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'],
  },
  {
    title: 'Central de ajuda',
    links: ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'],
  },
  { title: 'Coleções', links: ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'] },
]

/**
 * Ícones das redes (traço de 24 px no estilo do lucide). O lucide 1.x não tem mais ícones de
 * marca, então os traços ficam aqui.
 */
const socials: { name: string; icon: ReactNode }[] = [
  { name: 'Facebook', icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /> },
  {
    name: 'Instagram',
    icon: (
      <>
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </>
    ),
  },
  {
    name: 'Twitter',
    icon: (
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    ),
  },
  {
    name: 'LinkedIn',
    icon: (
      <>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect width="4" height="12" x="2" y="9" />
        <circle cx="4" cy="4" r="2" />
      </>
    ),
  },
  {
    name: 'YouTube',
    icon: (
      <>
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
        <path d="m10 15 5-3-5-3z" />
      </>
    ),
  },
]

/** Os links do footer são "Em breve" (sem fluxo no desafio), em branco como no Figma. */
const outOfScopeText = 'text-foreground h-auto justify-start p-0 font-normal opacity-100'

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-7xl px-4 pt-10 md:px-6">
      <div className="bg-card">
        <div className="grid gap-8 px-6 py-8 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0 lg:px-12">
          {highlights.map((h, i) => (
            <div
              key={h.title}
              className={cn(
                'flex flex-col gap-3 lg:pr-4 lg:pl-6 lg:first:pl-0',
                i > 0 && 'border-primary md:border-l md:pl-6',
              )}
            >
              <span
                aria-hidden
                className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full text-xl font-bold lg:size-[4.5rem] lg:text-2xl"
              >
                {h.letter}
              </span>
              <h2 className="text-body-lg font-bold">{h.title}</h2>
              <p className="text-muted-foreground text-body leading-relaxed">{h.text}</p>
            </div>
          ))}
          <section
            aria-labelledby="footer-newsletter"
            className="border-primary flex flex-col gap-3 md:col-span-3 lg:col-span-1 lg:border-l lg:pl-6"
          >
            <h2 id="footer-newsletter" className="text-lg leading-tight font-bold">
              Antecipe-se ao próximo lançamento
            </h2>
            {/* Campo e botão colados (Figma). O campo é um OutOfScopeAction com cara de input, para
                nada aparentar funcionar (ver "Desvios do Figma") */}
            <div className="flex">
              <OutOfScopeAction
                variant="ghost"
                className="bg-muted/60 text-muted-foreground text-body h-10 min-w-0 flex-1 justify-start rounded-r-none px-3 font-normal opacity-100"
              >
                digite seu e-mail...
              </OutOfScopeAction>
              <OutOfScopeAction
                variant="default"
                className="text-body-lg h-10 rounded-l-none px-4 font-bold opacity-100"
              >
                Enviar
              </OutOfScopeAction>
            </div>
            <p className="text-muted-foreground text-body leading-relaxed">
              Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
            </p>
          </section>
        </div>

        <div className="bg-muted grid items-center sm:grid-cols-2 gap-x-6 gap-y-3 px-6 py-6 lg:grid-cols-4 lg:px-8">
          <p className="text-body font-bold tracking-wider">KURIO</p>
          <p className="text-body">Feito para colecionadores, criadores e cultura</p>
          <p className="text-body break-all">contato@email.com</p>
          <p className="text-body">+55 11 4002 8922</p>
        </div>

        <div className="grid grid-cols-1 gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {columns.map((col) => (
            <section key={col.title} aria-label={col.title} className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">{col.title}</h2>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <OutOfScopeAction variant="link" className={cn(outOfScopeText, 'text-body')}>
                      {l}
                    </OutOfScopeAction>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="flex flex-col gap-6">
            <section aria-label="Redes sociais" className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">Redes sociais</h2>
              <ul className="flex flex-wrap gap-2">
                {socials.map((s) => (
                  <li key={s.name}>
                    <OutOfScopeAction
                      variant="ghost"
                      size="icon"
                      label={s.name}
                      className="border-primary text-text-accent size-8 rounded-sm border opacity-100"
                    >
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-5"
                      >
                        {s.icon}
                      </svg>
                    </OutOfScopeAction>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Carteiras compatíveis" className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">Carteiras compatíveis</h2>
              <p className="border-border-soft bg-muted/60 text-text-accent text-tiny w-fit rounded-md border px-2.5 py-1.5 font-bold tracking-wide">
                METAMASK · WALLETCONNECT · COINBASE
              </p>
            </section>
          </div>
        </div>
      </div>

      <p className="text-body py-6 text-center">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
