import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { CatalogoFiltro } from "@/components/energia/CatalogoFiltro";
import { LinhagemDados } from "@/components/energia/LinhagemDados";
import { PipelineEstados } from "@/components/energia/PipelineEstados";
import { IconeSetor } from "@/components/energia/IconeSetor";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { gold } from "@/lib/energia/gold";
import { carimbo } from "@/lib/energia/formato";
import { DATASETS_INTEGRADOS } from "@/lib/energia/datasets";
import { etapasLinhagem } from "@/lib/energia/linhagem";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Dados: de onde vêm os números do setor elétrico",
  description:
    "Mapa de linhagem dos dados (fontes, captura com sha256, histórico de versões, processamento, páginas e modelos), catálogo dos dados abertos do setor elétrico (CCEE, ONS, ANEEL) com o estado de integração de cada conjunto e séries para download em CSV.",
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
  const integrados = cat.entradas.filter((e) => e.estado !== "CATALOGADO");
  return (
    <>
      <CabecalhoEnergia atual="dados" />
      <MarcaVisita secao="energia:dados" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 pb-16">
        <CabecalhoModulo rotulo="Dados e metodologia" titulo="De onde vêm os números?">
          O que é público sobre o setor elétrico, e o que já está integrado. Catalogar é registrar que um conjunto existe, com seus metadados oficiais. Integrar é coletá-lo automaticamente, guardar a cópia original com impressão digital (sha256),
          validação e proveniência. Só conjuntos integrados alimentam números no portal.{" "}
          <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">Metodologia</Link>
        </CabecalhoModulo>

        {/* hero: linhagem */}
        <section id="linhagem" aria-labelledby="linhagem-h" className="scroll-mt-24">
          <p className="rotulo flex items-center gap-2 text-mineral">
            <IconeSetor tipo="dados" tamanho={15} /> Mapa de linhagem
          </p>
          <h2 id="linhagem-h" className="mt-2 font-serif text-2xl leading-snug text-carvao md:text-3xl">
            Da fonte ao portal, etapa a etapa
          </h2>
          <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">Toque em cada etapa para ver o que ela guarda, o que se confere nela e o caminho para a evidência. As contagens são do próprio processamento.</p>
          <div className="mt-5 border border-linha bg-superficie p-4 md:p-6">
            <LinhagemDados etapas={etapasLinhagem()} />
          </div>
        </section>

        <section aria-labelledby="estados-h" className="mt-12">
          <h2 id="estados-h" className="font-serif text-2xl text-carvao">
            A esteira de integração
          </h2>
          <p className="mt-1 mb-4 max-w-prose2 text-sm text-carvao-muted">
            Estados cumulativos: um conjunto utilizado em indicador passou por todos os anteriores. Metadados colhidos das APIs oficiais:{" "}
            {Object.entries(cat.portais)
              .map(([o, p]) => `${o}, ${p.conjuntos} ${p.conjuntos === 1 ? "conjunto" : "conjuntos"}, ${p.colhido_em ? `colhidos em ${carimbo(p.colhido_em)}` : "sem coleta"}`)
              .join("; ")}
            .
          </p>
          <PipelineEstados cat={cat} />
          {cat.portais.CCEE?.erro && <p className="mt-2 text-xs text-aviso">CCEE: {cat.portais.CCEE.erro}</p>}
        </section>

        <section aria-labelledby="integrados-h" className="mt-12">
          <h2 id="integrados-h" className="font-serif text-2xl text-carvao">Integrados à plataforma</h2>
          <p className="mt-1 mb-4 max-w-prose2 text-sm text-carvao-muted">Cada ficha lista as capturas com sha256, as transformações, os downloads em CSV e a forma de citação.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {integrados.map((e) => (
              <li key={e.id}>
                <Link href={`/setor-eletrico/dados/${e.slug}`} className="flex h-full flex-col border border-linha bg-superficie p-5 hover:border-energia">
                  <span className="rotulo text-mineral">{e.orgao} · {e.estado}</span>
                  <span className="mt-2 font-serif text-lg text-carvao">{e.titulo}</span>
                  <span className="mt-1 text-sm text-carvao-muted">
                    Usado em: {(DATASETS_INTEGRADOS.find((d) => d.catalogoId === e.id)?.paginas.map((p) => p.rotulo) ?? Array.from(new Set(e.usado_em.map((u) => PAGINA_DA_GOLD[u] ?? u)))).join(", ")}
                    {e.modelos.length ? ` · modelos ${e.modelos.join(", ")}` : ""}
                  </span>
                  {e.quebras.length > 0 && <span className="mt-1 text-xs text-aviso">{textoQuebras(e.quebras)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="explorer" aria-labelledby="catalogo-h" className="mt-12 scroll-mt-24">
          <h2 id="catalogo-h" className="font-serif text-2xl text-carvao">Explorador do catálogo</h2>
          <p className="mt-1 mb-4 max-w-prose2 text-sm text-carvao-muted">{cat.total} conjuntos. Busque, filtre por órgão, tema e estado, e veja em que degrau da esteira cada um está.</p>
          <CatalogoFiltro
            estados={cat.estados}
            itens={cat.entradas.map((e) => ({
              id: e.id,
              slug: e.slug,
              orgao: e.orgao,
              titulo: e.titulo,
              url: e.url,
              tema: e.tema,
              estado: e.estado,
              formatos: e.formatos,
              modificado: e.modificado_na_fonte,
              verificado: e.metadados_verificados,
              descontinuado: e.descontinuado,
              descricao: e.descricao.slice(0, 300),
            }))}
          />
        </section>
      </main>
    </>
  );
}
