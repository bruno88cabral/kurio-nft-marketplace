import { OutOfScopeAction, SocialIcon, type SocialName } from '@/components/kurio'
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

/** Redes do footer, na ordem do Figma (os traços estão em `SocialIcon`). */
const SOCIAL_NAMES: SocialName[] = ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube']

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
                {SOCIAL_NAMES.map((s) => (
                  <li key={s}>
                    <OutOfScopeAction
                      variant="ghost"
                      size="icon"
                      label={s}
                      className="border-primary text-text-accent size-8 rounded-sm border opacity-100"
                    >
                      <SocialIcon name={s} className="size-5" />
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
