import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { MapaConceitual, type DominioConceitual, type PreviaConceito } from "@/components/energia/MapaConceitual";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { CONCEITOS, GRUPOS } from "@/lib/energia/conteudo/conceitos";
import { exemploDe } from "@/lib/energia/conteudo/exemplos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Aprenda: entenda o sistema elétrico brasileiro visualmente",
  description:
    "Mapa conceitual do sistema elétrico (natureza, geração, sistema, mercado, preço, consumidor) com microaulas de PLD, CMO, EAR, ENA, submercado, carga, intercâmbio, NEWAVE, DECOMP e DESSEM, cada uma com fonte oficial, número de hoje e limitações.",
  alternates: { canonical: "/setor-eletrico/aprenda" },
};

const DOMINIOS: { id: string; rotulo: string; icone: TipoIcone; descricao: string; slugs: string[] }[] = [
  { id: "natureza", rotulo: "Natureza", icone: "clima", descricao: "A água que chega e a água guardada, medidas em energia pelo ONS.", slugs: ["ena", "ear", "mlt", "armazenamento", "ree"] },
  { id: "geracao", rotulo: "Geração", icone: "geracao", descricao: "As usinas que produzem, verificadas hora a hora no balanço do ONS.", slugs: ["geracao-centralizada", "geracao-distribuida", "cvu", "constrained-off"] },
  { id: "sistema", rotulo: "Sistema", icone: "rede", descricao: "O sistema interligado: regiões, carga e o fluxo entre elas.", slugs: ["sin", "submercado", "carga", "intercambio"] },
  { id: "mercado", rotulo: "Mercado", icone: "mercado", descricao: "Onde a energia é contratada e onde as diferenças são acertadas.", slugs: ["mcp", "acl", "acr", "mre", "gsf", "ess", "garantia-fisica"] },
  { id: "preco", rotulo: "Preço", icone: "preco", descricao: "Do custo marginal calculado pelos modelos ao preço aplicado pela CCEE.", slugs: ["cmo", "newave", "decomp", "dessem", "pld"] },
  { id: "consumidor", rotulo: "Consumidor", icone: "carga", descricao: "Quem consome, o que entra na carga e a geração conectada nas unidades consumidoras.", slugs: ["carga", "geracao-distribuida"] },
];

function previa(slug: string): PreviaConceito | null {
  const c = CONCEITOS.find((x) => x.slug === slug);
  if (!c) return null;
  const ex = c.estado === "CONFERIDO" ? exemploDe(c.slug) : null;
  return { slug: c.slug, sigla: c.sigla, nome: c.nome, estado: c.estado, frase: c.emUmaFrase ?? null, hoje: ex ? ex.partes.map((p) => p.texto).join("") : null };
}

export default function AprendaPage() {
  const conferidos = CONCEITOS.filter((c) => c.estado === "CONFERIDO").length;
  const dominios: DominioConceitual[] = DOMINIOS.map((d) => ({ id: d.id, rotulo: d.rotulo, icone: d.icone, descricao: d.descricao, conceitos: d.slugs.map(previa).filter((x): x is PreviaConceito => !!x) }));
  return (
    <>
      <CabecalhoEnergia atual="aprenda" />
      <MarcaVisita secao="energia:aprenda" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo rotulo="Aprenda" titulo="Entenda o sistema elétrico brasileiro visualmente">
          Como funciona o sistema elétrico brasileiro, conceito a conceito. Cada microaula cabe em uma tela: o que é em uma frase, o número de hoje, por que importa,
          o que se relaciona e onde aprofundar, sempre com a fonte oficial. {conferidos} de {CONCEITOS.length} verbetes estão conferidos na fonte primária; os demais aparecem como em
          preparação, sem definição, até a conferência.
        </CabecalhoModulo>

        <section aria-labelledby="mapa-conceitual-h">
          <h2 id="mapa-conceitual-h" className="sr-only">
            Mapa conceitual
          </h2>
          <div className="border border-linha bg-superficie p-4 md:p-6">
            <MapaConceitual dominios={dominios} />
          </div>
        </section>

        <section aria-labelledby="mestre-h" className="mt-10 grid gap-6 border border-energia bg-energia-fundo p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8">
          <div>
            <p className="rotulo flex items-center gap-2 text-carvao-muted">
              <IconeSetor tipo="sistema" tamanho={15} /> Infográfico explorável
            </p>
            <h2 id="mestre-h" className="mt-2 font-serif text-2xl leading-snug text-carvao md:text-3xl">
              Como funciona o sistema elétrico brasileiro?
            </h2>
            <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Da chuva ao consumidor, e em paralelo da operação ao PLD: cada etapa com a definição conferida, o número de hoje e o caminho para o módulo.
            </p>
          </div>
          <Link href="/setor-eletrico/aprenda/como-funciona" className="rotulo inline-flex min-h-[44px] items-center bg-carvao px-6 text-marfim hover:bg-carvao-soft">
            Explorar <span aria-hidden="true" className="ml-2">→</span>
          </Link>
        </section>

        {GRUPOS.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`} className="border-t border-linha py-8">
            <h2 id={`g-${g}`} className="rotulo text-mineral">
              {g}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CONCEITOS.filter((c) => c.grupo === g).map((c) => {
                const p = previa(c.slug);
                return (
                  <li key={c.slug}>
                    <Link href={`/setor-eletrico/aprenda/${c.slug}`} className="group flex h-full flex-col border border-linha bg-superficie p-5 transition-colors hover:border-energia">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-serif text-lg text-carvao">{c.sigla ?? c.nome}</span>
                        {c.estado === "PENDENTE" && <span className="rotulo !text-[0.62rem] text-aviso">em preparação</span>}
                      </span>
                      {c.sigla && <span className="text-sm text-mineral">{c.nome}</span>}
                      <span className="mt-2 text-sm leading-relaxed text-carvao-muted">{c.estado === "CONFERIDO" ? c.emUmaFrase : `Fonte primária a conferir: ${c.fontePlanejada}`}</span>
                      {p?.hoje && <span className="mt-3 border-t border-linha pt-2 text-xs leading-relaxed text-carvao"><span className="rotulo mr-1 text-mineral">Hoje</span>{p.hoje}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}
