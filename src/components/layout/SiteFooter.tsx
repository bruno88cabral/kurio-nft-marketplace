import { Gem, ShieldCheck, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { OutOfScopeAction } from '@/components/kurio'
import { BrandLogo } from './BrandLogo'

const highlights = [
  { icon: <ShieldCheck aria-hidden />, title: 'Compra segura', text: 'Propriedade verificada em cada NFT.' },
  { icon: <Zap aria-hidden />, title: 'Entrega imediata', text: 'O item chega à sua carteira na hora.' },
  { icon: <Gem aria-hidden />, title: 'Coleções curadas', text: 'Artistas selecionados pela equipe.' },
]

const columns: { title: string; links: string[] }[] = [
  { title: 'Meu perfil', links: ['Minha conta', 'Meus pedidos', 'Lista de interesse'] },
  { title: 'Central de ajuda', links: ['Perguntas frequentes', 'Fale conosco', 'Termos de uso'] },
  { title: 'Coleções', links: ['Em destaque', 'Novidades', 'Mais vendidas'] },
  { title: 'Redes sociais', links: ['Instagram', 'X (Twitter)', 'Discord'] },
]

function FooterLink({ children }: { children: ReactNode }) {
  return (
    <OutOfScopeAction variant="link" size="sm" className="text-muted-foreground h-auto justify-start p-0">
      {children}
    </OutOfScopeAction>
  )
}

export function SiteFooter() {
  return (
    <footer className="border-border bg-card border-t">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <ul className="grid gap-4 md:grid-cols-3">
            {highlights.map((h) => (
              <li key={h.title} className="flex items-start gap-3">
                <span className="text-text-accent mt-0.5 [&_svg]:size-6">{h.icon}</span>
                <div>
                  <p className="text-body font-medium">{h.title}</p>
                  <p className="text-muted-foreground text-caption">{h.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 lg:w-96">
            <p className="text-body font-medium">Antecipe-se ao próximo lançamento</p>
            <div className="flex gap-2">
              <OutOfScopeAction variant="outline" className="h-9 flex-1 justify-start font-normal">
                Seu e-mail
              </OutOfScopeAction>
              <OutOfScopeAction variant="default">Enviar</OutOfScopeAction>
            </div>
          </div>
        </div>

        <div className="border-border flex flex-col gap-2 border-t pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <BrandLogo className="w-fit" />
            <p className="text-muted-foreground text-caption">Propriedade digital para todos.</p>
          </div>
          <p className="text-muted-foreground text-caption">
            contato@kurio.example · +55 (11) 4000-0000
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {columns.map((col) => (
            <section key={col.title} aria-label={col.title} className="flex flex-col gap-2">
              <h2 className="text-body font-medium">{col.title}</h2>
              <ul className="flex flex-col gap-1">
                {col.links.map((l) => (
                  <li key={l}>
                    <FooterLink>{l}</FooterLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="text-muted-foreground text-caption">
          © 2026 Kurio. Propriedade digital para todos.
        </p>
      </div>
    </footer>
  )
}
