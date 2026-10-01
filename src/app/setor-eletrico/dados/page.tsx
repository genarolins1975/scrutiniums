import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { CatalogoFiltro } from "@/components/energia/CatalogoFiltro";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { carimbo } from "@/lib/energia/formato";
import { DATASETS_INTEGRADOS, urlDoConjunto } from "@/lib/energia/datasets";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Dados do setor elétrico: catálogo, integração e downloads",
  description:
    "Catálogo dos dados abertos do setor elétrico (CCEE, ONS, ANEEL e outros) com o estado de integração de cada conjunto, séries para download em CSV e metadados oficiais.",
  alternates: { canonical: "/setor-eletrico/dados" },
};

/** Nome da página em que cada arquivo de dados processados é usado. */
const PAGINA_DA_GOLD: Record<string, string> = {
  "pld.json": "PLD",
  "cmo.json": "PLD (CMO)",
  "hidrologia.json": "Água e clima",
  "carga.json": "Carga",
  "geracao.json": "Geração",
  "rede.json": "Rede",
  "sintese.json": "Visão geral",
  "previsoes.json": "Previsões",
  "modelos.json": "Modelos",
};

/** "2 mudanças metodológicas declaradas pela fonte", separando o que a plataforma identificou no dado. */
function textoQuebras(q: { origem?: "FONTE" | "PLATAFORMA" }[]): string {
  const fonte = q.filter((x) => x.origem !== "PLATAFORMA").length;
  const plataforma = q.length - fonte;
  const mud = (n: number) => `${n} ${n === 1 ? "mudança metodológica" : "mudanças metodológicas"}`;
  if (!plataforma) return `${mud(fonte)} ${fonte === 1 ? "declarada" : "declaradas"} pela fonte`;
  if (!fonte) return `${mud(plataforma)} ${plataforma === 1 ? "identificada" : "identificadas"} pela Scrutiniums no dado`;
  return `${mud(q.length)}: ${fonte} ${fonte === 1 ? "declarada" : "declaradas"} pela fonte e ${plataforma} ${plataforma === 1 ? "identificada" : "identificadas"} pela Scrutiniums no dado`;
}

export default function DadosEnergiaPage() {
  const cat = gold.catalogo();
  if (!cat) {
    return (
      <>
        <CabecalhoEnergia atual="dados" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Catálogo indisponível" motivo="O catálogo não foi gerado nesta publicação." />
        </main>
      </>
    );
  }
  // compatibilidade com o catálogo de cinco estados (a página nova vem na fase de interface)
  const integrados = cat.entradas.filter((e) => ["INTEGRADO", "VALIDADO", "PUBLICADO"].includes(e.estado as string) && e.slug);
  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo rotulo="Dados e metodologia" titulo="Tudo o que é público sobre o setor elétrico, e o que já está integrado">
          Catalogar é registrar que um conjunto existe, com seus metadados oficiais. Integrar é coletá-lo automaticamente, guardar a cópia original com impressão digital (sha256),
          validação e proveniência. Só conjuntos integrados alimentam números no portal.{" "}
          <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">Metodologia</Link>
        </CabecalhoModulo>

        <section aria-labelledby="estados-h" className="grid gap-px border border-linha bg-linha sm:grid-cols-3 lg:grid-cols-6">
          <h2 id="estados-h" className="sr-only">Conjuntos por estado</h2>
          {cat.estados.map((s, i) => (
            <div key={s} className="bg-superficie p-4">
              <p className="rotulo !text-[0.62rem] text-mineral">{s}</p>
              {/* contagem cumulativa: conjuntos neste estado ou em qualquer estado posterior */}
              <p className="mt-1 font-serif text-2xl tabular-nums text-carvao">
                {cat.estados.slice(i).reduce((t, e) => t + (cat.contagem[e] ?? 0), 0).toLocaleString("pt-BR")}
              </p>
              <p className="text-[0.7rem] text-mineral">neste estado ou além; exatamente neste: {(cat.contagem[s] ?? 0).toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-xs leading-snug text-carvao-muted">{cat.definicoes_estado[s]}</p>
            </div>
          ))}
        </section>
        <p className="mt-3 text-xs text-mineral">
          Estados cumulativos: um conjunto utilizado em indicador passou por todos os anteriores. Metadados colhidos das APIs oficiais:{" "}
          {Object.entries(cat.portais)
            .map(([o, p]) => `${o}, ${p.conjuntos} ${p.conjuntos === 1 ? "conjunto" : "conjuntos"}, ${p.colhido_em ? `colhidos em ${carimbo(p.colhido_em)}` : "sem coleta"}`)
            .join("; ")}
          .
        </p>
        {cat.portais.CCEE?.erro && <p className="mt-1 text-xs text-aviso">CCEE: {cat.portais.CCEE.erro}</p>}

        <section aria-labelledby="integrados-h" className="mt-10">
          <h2 id="integrados-h" className="font-serif text-2xl text-carvao">Integrados à plataforma</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {integrados.map((e) => (
              <li key={e.id}>
                <Link href={`/setor-eletrico/dados/${e.slug}`} className="flex h-full flex-col border border-linha bg-superficie p-5 hover:border-energia">
                  <span className="rotulo text-mineral">{e.orgao} · {e.estado}</span>
                  <span className="mt-2 font-serif text-lg text-carvao">{e.titulo}</span>
                  <span className="mt-1 text-sm text-carvao-muted">
                    Usado em: {(DATASETS_INTEGRADOS.find((d) => d.catalogoId === e.id)?.paginas.map((p) => p.rotulo) ?? Array.from(new Set(e.usado_em.map((u) => PAGINA_DA_GOLD[u] ?? u)))).join(", ")}
                    {(e.modelos ?? []).length ? ` · modelos ${(e.modelos ?? []).join(", ")}` : ""}
                  </span>
                  {(e.quebras ?? []).length > 0 && <span className="mt-1 text-xs text-aviso">{textoQuebras(e.quebras)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="catalogo-h" className="mt-12">
          <h2 id="catalogo-h" className="font-serif text-2xl text-carvao">Catálogo completo</h2>
          <p className="mt-1 mb-4 text-sm text-carvao-muted">{cat.total} conjuntos. Filtre por órgão, tema e estado.</p>
          <CatalogoFiltro
            itens={cat.entradas.map((e) => ({
              id: e.id,
              slug: e.slug,
              orgao: e.orgao,
              titulo: e.titulo,
              url: urlDoConjunto(e) ?? "",
              tema: e.tema,
              estado: e.estado,
              formatos: e.formatos ?? [],
              modificado: e.modificado_na_fonte ?? null,
              verificado: e.metadados_verificados,
              descontinuado: e.descontinuado ?? false,
            }))}
          />
        </section>
      </main>
    </>
  );
}
