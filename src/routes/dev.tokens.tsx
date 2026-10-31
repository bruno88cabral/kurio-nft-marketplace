import { createFileRoute, notFound } from '@tanstack/react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

// Página de conferência contra o Figma: só existe em dev (em produção responde 404)
export const Route = createFileRoute('/dev/tokens')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  head: () => ({ meta: [{ title: 'Tokens · Kurio' }] }),
  component: TokensPage,
})

const colors = [
  ['ink', '#140D0A', 'bg-background'],
  ['surface-card', '#241612', 'bg-card'],
  ['surface-dark', '#38220F', 'bg-popover'],
  ['primary', '#D28A4C', 'bg-primary'],
  ['text-accent', '#E89B55', 'bg-text-accent'],
  ['secondary', '#B39463', 'bg-secondary'],
  ['text-primary', '#F7F3EC', 'bg-foreground'],
  ['text-secondary', '#CFB28C', 'bg-muted-foreground'],
  ['border', '#3F2319', 'bg-border'],
  ['border-soft', '#55321F', 'bg-border-soft'],
  ['elevated', '#FBFBFB', 'bg-elevated'],
] as const

const typeScale = [
  ['text-display', 'display 43/70/700', 'text-display'],
  ['text-heading', 'heading 24/700', 'text-heading'],
  ['text-body-lg', 'body-lg 16', 'text-body-lg'],
  ['text-body', 'body 14', 'text-body'],
  ['text-caption', 'caption 12', 'text-caption'],
  ['text-tiny', 'tiny 10', 'text-tiny'],
] as const

function TokensPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 p-6">
      <h1 className="text-heading">Design tokens</h1>

      <section className="flex flex-col gap-4" aria-labelledby="cores">
        <h2 id="cores" className="text-body-lg font-medium">
          Cores
        </h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {colors.map(([name, hex, cls]) => (
            <li key={name} className="flex flex-col gap-2">
              <div className={`${cls} border-border-soft h-16 rounded-md border`} />
              <span className="text-caption">{name}</span>
              <span className="text-caption text-muted-foreground">{hex}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="tipografia">
        <h2 id="tipografia" className="text-body-lg font-medium">
          Tipografia (Roboto Mono)
        </h2>
        {typeScale.map(([name, label, cls]) => (
          <div key={name} className="flex flex-col">
            <span className="text-caption text-muted-foreground">{name}</span>
            <p className={cls}>{label}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-6" aria-labelledby="componentes">
        <h2 id="componentes" className="text-body-lg font-medium">
          Componentes
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Badge>Badge</Badge>
          <Avatar>
            <AvatarFallback>KU</AvatarFallback>
          </Avatar>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" placeholder="Seu nome" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="obs">Observação</Label>
            <Textarea id="obs" placeholder="Observação" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox id="chk" defaultChecked />
            <Label htmlFor="chk">Checkbox</Label>
          </div>
          <RadioGroup defaultValue="a" className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem id="ra" value="a" />
              <Label htmlFor="ra">A</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="rb" value="b" />
              <Label htmlFor="rb">B</Label>
            </div>
          </RadioGroup>
          <Slider defaultValue={[40]} className="w-48" aria-label="Faixa de preço" />
        </div>
        <ToggleGroup type="single" defaultValue="1" variant="outline">
          <ToggleGroupItem value="1">Edição 1</ToggleGroupItem>
          <ToggleGroupItem value="2">Edição 2</ToggleGroupItem>
        </ToggleGroup>
        <Tabs defaultValue="todos">
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="novos">Novos</TabsTrigger>
            <TabsTrigger value="alta">Em alta</TabsTrigger>
          </TabsList>
        </Tabs>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Início</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Mercado</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Card>
          <CardHeader>
            <CardTitle>Card</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
