"use client";

import Link from "next/link";
import { useMemo } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { Controles, FiguraAnalitica, GraficoBarras, LeituraGuiada } from "@/components/painel";
import { ehDespesa, formata, type MedidaId } from "@/lib/eficiencia/consulta";
import { fraseCapital, listaRotulos } from "@/lib/eficiencia/frases";
import type { CapituloPanorama, ExtremoPanorama, ReferenciaExternaCapitulo, ResumoMedida } from "@/lib/eficiencia/panorama";
import { provenienciaDaFicha, type FonteFicha } from "@/lib/eficiencia/proveniencia";
import type { FichaIndicador } from "@/lib/eficiencia/tipos";
import { hrefTema, type Tema } from "@/lib/eficiencia/visao";
import { Alternancia, Selecao } from "./controles";
import type { ContextoFicha } from "./FichaConteudo";
import { Siglas } from "./Siglas";
import { SobreEsteDado } from "./SobreEsteDado";

/**
 * Panorama editorial da Educação nas capitais, no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). Três capítulos, cada um
 * uma FiguraAnalitica com a pergunta como título: Recursos (três escalas do gasto, escolhidas nos Controles logo antes da figura, com o
 * contexto nacional), Atendimento e Resultados (a mediana das capitais ao lado da referência nacional). Nenhuma capital vem selecionada:
 * escolher uma é opcional e só a destaca nos gráficos. A escala do gasto e a capital vivem na URL (?med= e ?cap=).
 */

type CapitalLista = { id: string; nome: string; uf: string };
type Fichas = Record<string, { ficha: FichaIndicador; ctx: ContextoFicha }>;

const ABAS = ["despesa", "despesa_hab", "despesa_mat"] as const;
const ESQUEMA = {
  cap: campo(tiposUrl.texto({ max: 40 }), ""),
  med: campo(tiposUrl.opcao(ABAS), "despesa_hab" as (typeof ABAS)[number]),
};

const nomeCapital = (c: { nome: string; uf: string }) => `${c.nome} (${c.uf})`;

/** Seletor opcional de capital do panorama; lê e grava ?cap= como o restante da página. */
export function SeletorCapitalPanorama({ capitais }: { capitais: CapitalLista[] }) {
  const ids = useMemo(() => new Set(capitais.map((c) => c.id)), [capitais]);
  const [s, definir] = useEstadoUrl(ESQUEMA);
  const cap = ids.has(s.cap) ? s.cap : "";
  return (
    <div className="max-w-sm">
      <Selecao
        id="panorama-cap"
        rotulo="Destacar capital"
        ajuda="Opcional. Mostra a capital nos gráficos."
        valor={cap}
        opcoes={[{ v: "", t: "Todas as capitais" }, ...capitais.map((c) => ({ v: c.id, t: nomeCapital(c) }))]}
        aoMudar={(v) => definir({ cap: v })}
      />
    </div>
  );
}

/** Casas decimais do gráfico, as mesmas de `formata` em cada medida: o arredondamento não muda. */
const CASAS: Partial<Record<MedidaId, number>> = { despesa: 0, despesa_hab: 0, despesa_mat: 0, atu: 1, ideb: 1 };

/** Unidade do eixo de cada medida do panorama. */
const UNIDADE: Partial<Record<MedidaId, string>> = { despesa: "R$ correntes", despesa_hab: "R$ por habitante", despesa_mat: "R$ por matrícula", atu: "alunos por turma", ideb: "Ideb, escala de 0 a 10" };

export function PanoramaInterativo({ capitulos, capitais, fichas, fontes }: { capitulos: CapituloPanorama[]; capitais: CapitalLista[]; fichas: Fichas; fontes: Record<string, FonteFicha> }) {
  const ids = useMemo(() => new Set(capitais.map((c) => c.id)), [capitais]);
  const [s, definir] = useEstadoUrl(ESQUEMA);
  const cap = ids.has(s.cap) ? s.cap : "";
  const [recursos, ...demais] = capitulos;
  const r = recursos.medidas.find((m) => m.medida === s.med) ?? recursos.medidas[1];
  return (
    <>
      {/* a escala do gasto muda só a figura de Recursos: o controle fica logo antes dela */}
      <Controles rotulo="Escala do gasto" resumo={`Mostrando ${r.rotulo.toLowerCase()}, ${r.contexto}.`} idioma="pt">
        <Alternancia rotulo="Escala do gasto" valor={r.medida as (typeof ABAS)[number]} opcoes={recursos.medidas.map((m) => ({ v: m.medida as (typeof ABAS)[number], t: m.rotulo }))} aoMudar={(m) => definir({ med: m })} />
      </Controles>
      <Capitulo c={recursos} r={r} cap={cap} fichas={fichas} fontes={fontes} />
      {demais.map((c) => (
        <Capitulo key={c.id} c={c} r={c.medidas[0]} cap={cap} fichas={fichas} fontes={fontes} />
      ))}
    </>
  );
}

/** Capitais de um extremo: todas as empatadas, até o limite da frase factual ("e mais N"). */
const nomesDoExtremo = (e: ExtremoPanorama) => listaRotulos(e.capitais.map(nomeCapital));

function NotaCapital({ r, cap }: { r: ResumoMedida; cap: string }) {
  if (!cap) return null;
  const sel = r.pontos.find((p) => p.id === cap);
  if (sel) return <p className="t-corpo max-w-prose2 text-carvao">{fraseCapital(sel.nome, sel.uf, sel.valor, r.referencia?.mediana ?? null, r.referencia?.n ?? 0, r.medida)}</p>;
  return <p className="t-corpo max-w-prose2 text-carvao">A capital escolhida não tem dado comparável nesta medida e neste período; a tabela mostra o motivo.</p>;
}

function Elo({ href: destino, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={destino} className="inline-flex min-h-[44px] items-center gap-1.5 text-[0.9375rem] text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta">
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

function EloAprofunda({ r, cap }: { r: ResumoMedida; cap: string }) {
  const tema = r.aprofunda.caminho.slice(1) as Tema;
  return <Elo href={hrefTema(tema, { ...r.aprofunda.params, cap: cap || undefined })}>{r.aprofunda.rotulo}</Elo>;
}

/** O contexto nacional do capítulo de Recursos: a referência de outro universo, dita como tal. */
function ContextoNacional({ r }: { r: ResumoMedida }) {
  const e = r.externas.find((x) => x.classe === "calculada") ?? r.externas[0];
  if (!e)
    return (
      <p className="t-meta max-w-prose2 text-carvao-muted">
        <span className="font-medium text-carvao">Contexto nacional: sem referência nacional comparável.</span> {r.semNacional}
      </p>
    );
  return (
    <p className="t-meta max-w-prose2 text-carvao-muted" aria-label="Contexto nacional">
      <span className="font-medium text-carvao">
        Contexto nacional: {e.valorTexto}, {e.descricao}.
      </span>{" "}
      {e.classe === "calculada" ? "Municípios de todos os portes. Universo diferente das capitais." : e.escopo} Esse valor não é diretamente comparável aos das capitais. {e.origem}
    </p>
  );
}

/**
 * Um capítulo do panorama como figura do kit: no capítulo de Recursos, menor valor, mediana e maior valor das capitais (e a capital
 * destacada); em Atendimento e Resultados, a mediana das capitais ao lado do agregado nacional da rede municipal (e a capital). A tabela
 * equivalente traz o valor de cada capital, como a visão "Tabela" de antes; as frases e os números são os mesmos.
 */
function Capitulo({ c, r, cap, fichas, fontes }: { c: CapituloPanorama; r: ResumoMedida; cap: string; fichas: Fichas; fontes: Record<string, FonteFicha> }) {
  const fmt = (v: number) => formata(r.medida, v);
  const ficha = fichas[r.indicador];
  const sel = r.pontos.find((p) => p.id === cap);
  const ref = r.referencia;
  const vazio = !r.menor || !r.maior || ref?.mediana == null;
  const ehRecursos = c.id === "gastos";
  const oficial: ReferenciaExternaCapitulo | null = ehRecursos ? null : (r.externas.find((e) => e.classe === "oficial") ?? null);
  const pontos = vazio
    ? []
    : ehRecursos
      ? [
          { x: "menor", rotulo: `Menor valor · ${nomesDoExtremo(r.menor!)}`, y: r.menor!.valor },
          { x: "mediana", rotulo: "Mediana das capitais", y: ref!.mediana! },
          { x: "maior", rotulo: `Maior valor · ${nomesDoExtremo(r.maior!)}`, y: r.maior!.valor },
          ...(sel ? [{ x: "capital", rotulo: nomeCapital(sel), y: sel.valor }] : []),
        ]
      : [
          { x: "capitais", rotulo: "Capitais · mediana", y: ref!.mediana! },
          ...(oficial ? [{ x: "brasil", rotulo: "Brasil · agregado", y: oficial.valor }] : []),
          ...(sel ? [{ x: "capital", rotulo: nomeCapital(sel), y: sel.valor }] : []),
        ];
  const coluna = r.medida === "despesa" ? "Despesa total" : r.medida === "despesa_hab" ? "R$ por habitante" : r.medida === "despesa_mat" ? "R$ por matrícula" : r.medida === "atu" ? "Alunos por turma" : "Ideb";
  const linhas = [...r.pontos.map((p) => [nomeCapital(p), fmt(p.valor)]), ...r.semDado.map((x) => [nomeCapital(x), "Sem dado comparável"])];
  const quartis = ref && ref.quartisExibicao && ref.q1 !== null && ref.q3 !== null ? { q1: ref.q1, q3: ref.q3 } : null;
  const resumo = vazio ? null : (
    <ul className="t-meta flex flex-wrap gap-x-4 gap-y-1 text-carvao-muted">
      {quartis && (
        <li>
          Faixa central de 50%: {fmt(quartis.q1)} a {fmt(quartis.q3)}
        </li>
      )}
      <li>Mediana das capitais: {fmt(ref!.mediana!)}</li>
      {ref?.media != null && <li>Média simples: {fmt(ref.media)}</li>}
      {!ehRecursos && (
        <li>
          Menor: {fmt(r.menor!.valor)} · {nomesDoExtremo(r.menor!)}
        </li>
      )}
      {!ehRecursos && (
        <li>
          Maior: {fmt(r.maior!.valor)} · {nomesDoExtremo(r.maior!)}
        </li>
      )}
      <li>
        {r.pontos.length} {r.pontos.length === 1 ? "capital comparável" : "capitais comparáveis"}
        {r.semDado.length > 0 ? ` de ${r.universo}` : ""}
      </li>
    </ul>
  );
  const anoFim = String(r.ano);
  return (
    <FiguraAnalitica
      id={`capitulo-${c.id}`}
      idioma="pt"
      pergunta={r.pergunta}
      subtitulo={`${c.etiqueta} · ${r.contexto} · ${r.subtitulo}`}
      natureza={ficha.ficha.natureza}
      proveniencia={provenienciaDaFicha(ficha.ficha, fontes, { inicio: anoFim, fim: anoFim })}
      leitura={vazio ? undefined : <LeituraGuiada>{r.titulo}</LeituraGuiada>}
      tabela={{ colunas: ["Capital", coluna], linhas, titulo: `${r.titulo} Valores de cada capital` }}
      comoInterpretar={
        <>
          <Siglas texto={r.definicao} />
          {ehDespesa(r.medida) && " Valores em reais correntes: preços do próprio ano, sem correção pela inflação. A evolução em reais constantes está no painel Gastos."}
          {oficial && ` ${oficial.rotulo}: agregado nacional, não é média das capitais.`}
        </>
      }
      ressalva={r.perimetro ? <Siglas texto={r.perimetro} /> : undefined}
      naoConcluir="Gasto e resultados têm universos e períodos próprios. A leitura conjunta não demonstra causalidade, e a posição de uma capital não mede a eficiência da prefeitura."
      complemento={
        <>
          {resumo}
          <NotaCapital r={r} cap={cap} />
          {ehRecursos && <ContextoNacional r={r} />}
          {!ehRecursos && !oficial && r.semNacional && <p className="t-meta max-w-prose2 text-carvao-muted">{r.semNacional}</p>}
          <div className="flex flex-wrap items-center gap-x-6">
            <EloAprofunda r={r} cap={cap} />
            <SobreEsteDado f={ficha.ficha} ctx={ficha.ctx} rotulo="Fonte e critérios" />
          </div>
        </>
      }
    >
      {vazio ? (
        <p data-grafico="sem-comparacao" className="t-meta border border-dashed border-mineral px-4 py-3 text-carvao" role="note">
          Nenhuma capital tem dado comparável para esta medida neste período.
        </p>
      ) : (
        <GraficoBarras
          titulo={r.titulo}
          series={[{ id: "valor", nome: r.rotulo, pontos }]}
          eixoY={{ unidade: UNIDADE[r.medida] ?? r.eixo, zero: true, casas: CASAS[r.medida] ?? 1 }}
          orientacao="horizontal"
          rotulosValor
          rotulosSaoNomes
          selecionado={sel ? "capital" : null}
        />
      )}
    </FiguraAnalitica>
  );
}
