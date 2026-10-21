"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ehDespesa, formata, formataEixo, type MedidaId } from "@/lib/eficiencia/consulta";
import { fraseCapital, listaRotulos } from "@/lib/eficiencia/frases";
import type { CapituloPanorama, ExtremoPanorama, ReferenciaExternaCapitulo, ResumoMedida } from "@/lib/eficiencia/panorama";
import type { FichaIndicador } from "@/lib/eficiencia/tipos";
import { CAMINHO_COMPARAR, CAMINHO_METODOS, hrefTema, href, type Tema } from "@/lib/eficiencia/visao";
import { Alternancia, Selecao } from "./controles";
import type { ContextoFicha } from "./FichaConteudo";
import { ComparacaoReferencia, FaixaResumo, type LinhaReferencia } from "./PanoramaGraficos";
import { Siglas } from "./Siglas";
import { SobreEsteDado } from "./SobreEsteDado";
import { TabelaSimples } from "./TabelaSimples";

/**
 * Panorama editorial. Três capítulos, cada um com a pergunta como título e os números antes do desenho:
 * 01 Recursos (três escalas do gasto em abas, com o contexto nacional), 02 Atendimento e 03 Resultados (a mediana das
 * capitais ao lado da referência nacional). Nenhuma capital vem selecionada: escolher uma é opcional e só a destaca nos
 * gráficos. A aba, a capital e o resto do recorte vivem na URL.
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
    <Selecao
      id="panorama-cap"
      rotulo="Destacar capital"
      ajuda="Opcional. Mostra a capital nos gráficos."
      valor={cap}
      opcoes={[{ v: "", t: "Todas as capitais" }, ...capitais.map((c) => ({ v: c.id, t: nomeCapital(c) }))]}
      aoMudar={(v) => definir({ cap: v })}
    />
  );
}

export function PanoramaInterativo({
  capitulos,
  capitais,
  fichas,
  baixar,
}: {
  capitulos: CapituloPanorama[];
  capitais: CapitalLista[];
  fichas: Fichas;
  baixar: { href: string; detalhe: string };
}) {
  const ids = useMemo(() => new Set(capitais.map((c) => c.id)), [capitais]);
  const [s, definir] = useEstadoUrl(ESQUEMA);
  const cap = ids.has(s.cap) ? s.cap : "";
  const [recursos, ...demais] = capitulos;
  return (
    <div>
      <CapituloRecursos c={recursos} cap={cap} aba={s.med} aoMudarAba={(m) => definir({ med: m })} fichas={fichas} />
      <div className="mt-14 grid gap-x-14 gap-y-14 border-t border-linha pt-12 lg:grid-cols-2 lg:[&>section+section]:border-l lg:[&>section+section]:border-linha lg:[&>section+section]:pl-14">
        {demais.map((c) => (
          <CapituloReferencia key={c.id} c={c} cap={cap} fichas={fichas} />
        ))}
      </div>
      <FaixaConferir baixar={baixar} />
    </div>
  );
}

/* ------------------------------------------------------------------ peças comuns */

function Etiqueta({ numero, texto }: { numero: string; texto: string }) {
  return (
    <p className="rotulo text-obee-dark">
      {numero} <span aria-hidden="true">/</span> {texto}
    </p>
  );
}

/** Capitais de um extremo: todas as empatadas, até o limite da frase factual ("e mais N"). */
const nomesDoExtremo = (e: ExtremoPanorama) => listaRotulos(e.capitais.map(nomeCapital));

function Numero({ valor, legenda, destaque = false }: { valor: string; legenda: string; destaque?: boolean }) {
  // no celular, a legenda vem antes do valor e ambos alinham à esquerda (valores longos como "R$ 23,58 bilhões" não cabem ao lado da legenda)
  return (
    <div className="flex flex-col sm:text-center">
      <dt className="text-sm leading-snug text-carvao-muted sm:order-2 sm:mt-2 sm:text-[0.9375rem]">{legenda}</dt>
      <dd className={`font-serif text-[1.65rem] leading-tight sm:order-1 sm:text-[2.1rem] sm:leading-none ${destaque ? "text-obee-dark" : "text-obee-tinta"}`}>{valor}</dd>
    </div>
  );
}

function NotaCapital({ r, cap }: { r: ResumoMedida; cap: string }) {
  if (!cap) return null;
  const sel = r.pontos.find((p) => p.id === cap);
  if (sel) {
    return <p className="mt-4 max-w-prose2 text-[0.95rem] leading-relaxed text-obee-tinta">{fraseCapital(sel.nome, sel.uf, sel.valor, r.referencia?.mediana ?? null, r.referencia?.n ?? 0, r.medida)}</p>;
  }
  return <p className="mt-4 max-w-prose2 text-[0.95rem] leading-relaxed text-obee-tinta">A capital escolhida não tem dado comparável nesta medida e neste período; a tabela mostra o motivo.</p>;
}

const linhasTabela = (r: ResumoMedida) => [
  ...r.pontos.map((p) => [nomeCapital(p), formata(r.medida, p.valor)]),
  ...r.semDado.map((x) => [nomeCapital(x), "Sem dado comparável"]),
];

function Elo({ href: destino, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={destino} className={`inline-flex min-h-[44px] items-center gap-1.5 text-[0.9375rem] text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta ${className}`}>
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ 01 recursos */

function CapituloRecursos({
  c,
  cap,
  aba,
  aoMudarAba,
  fichas,
}: {
  c: CapituloPanorama;
  cap: string;
  aba: (typeof ABAS)[number];
  aoMudarAba: (m: (typeof ABAS)[number]) => void;
  fichas: Fichas;
}) {
  const r = c.medidas.find((m) => m.medida === aba) ?? c.medidas[1];
  const [visao, setVisao] = useState<"grafico" | "tabela">("grafico");
  const base = useId();
  const idTitulo = `${base}-titulo`;
  const idPainel = `${base}-painel`;
  const fmt = (v: number) => formata(r.medida, v);
  const ficha = fichas[r.indicador];
  const sel = r.pontos.find((p) => p.id === cap);
  const ref = r.referencia;
  const vazio = !r.menor || !r.maior || ref?.mediana == null;
  return (
    <section aria-labelledby={idTitulo} id={`capitulo-${c.id}`} className="min-w-0 scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <Etiqueta numero={c.numero} texto={c.etiqueta.toUpperCase()} />
          <h2 id={idTitulo} className="mt-2 font-serif text-[1.9rem] leading-[1.15] text-obee-tinta md:text-[2.35rem]">
            {r.pergunta}
          </h2>
        </div>
        <p className="text-sm text-carvao-muted">{r.contexto}</p>
      </div>
      <Abas
        rotulo="Escala do gasto"
        idBase={base}
        idPainel={idPainel}
        abas={c.medidas.map((m) => ({ id: m.medida, rotulo: m.rotulo }))}
        valor={r.medida}
        aoMudar={(m) => aoMudarAba(m as (typeof ABAS)[number])}
      />
      <div id={idPainel} role="tabpanel" aria-labelledby={`${base}-aba-${r.medida}`} className="mt-6">
        {vazio ? (
          <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">
            Nenhuma capital tem dado comparável para esta medida neste período.
          </p>
        ) : (
          <>
            <dl className="grid gap-y-4 sm:grid-cols-3 sm:gap-x-6">
              <Numero valor={fmt(r.menor!.valor)} legenda={`Menor valor · ${nomesDoExtremo(r.menor!)}`} />
              <Numero valor={fmt(ref!.mediana!)} legenda="Mediana das capitais" destaque />
              <Numero valor={fmt(r.maior!.valor)} legenda={`Maior valor · ${nomesDoExtremo(r.maior!)}`} />
            </dl>
            <p className="mt-4 text-center text-[0.8125rem] leading-snug text-carvao-muted"><Siglas texto={r.definicao} /></p>
            {ehDespesa(r.medida) && (
              <p className="mx-auto mt-1.5 max-w-[46rem] text-center text-[0.8125rem] leading-snug text-carvao-muted">
                Valores em reais correntes: preços do próprio ano, sem correção pela inflação. A evolução em reais constantes está no painel Gastos.
                {r.escala === "log" && " O gráfico usa escala logarítmica porque as capitais diferem em ordens de grandeza: distâncias iguais representam razões iguais, não diferenças iguais."}
              </p>
            )}
            {r.perimetro && (
              <p className="mx-auto mt-1.5 max-w-[46rem] text-center text-[0.8125rem] leading-snug text-obee-tinta" role="note">
                <span className="font-semibold">Perímetro.</span> <Siglas texto={r.perimetro} />
              </p>
            )}
            <NotaCapital r={r} cap={cap} />
            <div className="mt-6">
              {visao === "grafico" ? (
                <FaixaResumo
                  menor={r.menor!.valor}
                  mediana={ref!.mediana!}
                  maior={r.maior!.valor}
                  faixa={ref && ref.quartisExibicao && ref.q1 !== null && ref.q3 !== null ? { q1: ref.q1, q3: ref.q3 } : null}
                  destaque={sel ? { rotulo: nomeCapital(sel), valor: sel.valor } : null}
                  formata={fmt}
                  formataCurto={(v) => formata(r.medida, v, true)}
                  formataEixo={(v) => formataEixo(r.medida as MedidaId, v)}
                  escala={r.escala}
                  zero={r.zero}
                  tituloEixo={r.eixo}
                  descricao={`${r.titulo} Mediana ${fmt(ref!.mediana!)}.`}
                />
              ) : (
                <TabelaSimples legenda={`${r.titulo} Valores de cada capital`} cabecalho={["Capital", r.medida === "despesa" ? "Despesa total" : "R$ por " + (r.medida === "despesa_hab" ? "habitante" : "matrícula")]} linhas={linhasTabela(r)} />
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem] leading-snug text-carvao-muted">
                {ref && ref.quartisExibicao && ref.q1 !== null && ref.q3 !== null && (
                  <li className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block h-3 w-5 border border-dashed border-obee bg-obee-fundo" />
                    Faixa central de 50%: {fmt(ref.q1)} a {fmt(ref.q3)}
                  </li>
                )}
                <li className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-obee" />
                  Mediana das capitais: {fmt(ref!.mediana!)}
                </li>
                {ref?.media != null && <li>Média simples: {fmt(ref.media)}</li>}
                <li>
                  {r.pontos.length} {r.pontos.length === 1 ? "capital comparável" : "capitais comparáveis"}
                  {r.semDado.length > 0 ? ` de ${r.universo}` : ""}
                </li>
                {sel && (
                  <li className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full border-2 border-obee-tinta bg-superficie" />
                    Capital destacada
                  </li>
                )}
              </ul>
              <Alternancia
                rotulo={`Forma de ver: ${r.pergunta}`}
                rotuloVisivel={false}
                valor={visao}
                opcoes={[
                  { v: "grafico", t: "Gráfico" },
                  { v: "tabela", t: "Tabela" },
                ]}
                aoMudar={setVisao}
              />
            </div>
          </>
        )}
        <ContextoNacional r={r} cap={cap} ficha={ficha} />
      </div>
    </section>
  );
}

function ContextoNacional({ r, cap, ficha }: { r: ResumoMedida; cap: string; ficha: Fichas[string] }) {
  const e = r.externas.find((x) => x.classe === "calculada") ?? r.externas[0];
  return (
    <aside aria-label="Contexto nacional" className="mt-8 grid gap-x-8 gap-y-4 bg-obee-fundo px-5 py-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] md:items-center md:px-7">
      {e ? (
        <>
          <div>
            <p className="rotulo text-carvao-muted">Contexto nacional</p>
            <p className="mt-1 font-serif text-[2rem] leading-none text-obee-tinta">{e.valorTexto}</p>
            <p className="mt-1.5 text-[0.9375rem] leading-snug text-carvao-muted">{e.descricao}</p>
          </div>
          <div className="text-sm leading-relaxed text-obee-tinta md:border-l md:border-obee-neutro/40 md:pl-8">
            <p className="font-semibold">{e.classe === "calculada" ? "Municípios de todos os portes. Universo diferente das capitais." : e.escopo}</p>
            <p>Esse valor não é diretamente comparável aos das capitais.</p>
            <p className="mt-1.5 text-[0.8125rem] text-carvao-muted">{e.origem}</p>
          </div>
        </>
      ) : (
        <>
          <div>
            <p className="rotulo text-carvao-muted">Contexto nacional</p>
            <p className="mt-1 text-[0.9375rem] font-semibold text-obee-tinta">Sem referência nacional comparável</p>
          </div>
          <p className="text-sm leading-relaxed text-obee-tinta md:border-l md:border-obee-neutro/40 md:pl-8">{r.semNacional}</p>
        </>
      )}
      <div className="flex flex-col items-start">
        <EloAprofunda r={r} cap={cap} />
        <SobreEsteDado f={ficha.ficha} ctx={ficha.ctx} rotulo="Fonte e critérios" />
      </div>
    </aside>
  );
}

function EloAprofunda({ r, cap }: { r: ResumoMedida; cap: string }) {
  const tema = r.aprofunda.caminho.slice(1) as Tema;
  return <Elo href={hrefTema(tema, { ...r.aprofunda.params, cap: cap || undefined })}>{r.aprofunda.rotulo}</Elo>;
}

/** Abas de uma medida: teclado por setas, início e fim; o painel que a aba controla é identificado por aria-controls. */
function Abas({
  rotulo,
  idBase,
  idPainel,
  abas,
  valor,
  aoMudar,
}: {
  rotulo: string;
  idBase: string;
  idPainel: string;
  abas: { id: string; rotulo: string }[];
  valor: string;
  aoMudar: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const teclado = (e: KeyboardEvent, i: number) => {
    const n = abas.length;
    const alvo = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (alvo === null) return;
    e.preventDefault();
    aoMudar(abas[alvo].id);
    refs.current[alvo]?.focus();
  };
  return (
    <div role="tablist" aria-label={rotulo} className="mt-5 flex max-w-full flex-wrap gap-x-2 border-b border-linha">
      {abas.map((a, i) => {
        const ativa = a.id === valor;
        return (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-aba-${a.id}`}
            aria-selected={ativa}
            aria-controls={idPainel}
            tabIndex={ativa ? 0 : -1}
            onClick={() => aoMudar(a.id)}
            onKeyDown={(e) => teclado(e, i)}
            className={`-mb-px inline-flex min-h-[44px] min-w-[44px] items-center justify-center border-b-2 px-4 text-[0.9375rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-obee ${
              ativa ? "border-obee font-semibold text-obee-tinta" : "border-transparent text-carvao-muted hover:text-obee-tinta"
            }`}
          >
            {a.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ 02 atendimento e 03 resultados */

function CapituloReferencia({ c, cap, fichas }: { c: CapituloPanorama; cap: string; fichas: Fichas }) {
  const r = c.medidas[0];
  const idTitulo = `cap-${c.id}-titulo`;
  const fmt = (v: number) => formata(r.medida, v);
  const ficha = fichas[r.indicador];
  const sel = r.pontos.find((p) => p.id === cap);
  const ref = r.referencia;
  const oficial = r.externas.find((e) => e.classe === "oficial") ?? null;
  const vazio = !r.menor || !r.maior || ref?.mediana == null;
  return (
    <section aria-labelledby={idTitulo} id={`capitulo-${c.id}`} className="min-w-0 scroll-mt-24">
      <Etiqueta numero={c.numero} texto={c.etiqueta.toUpperCase()} />
      <h2 id={idTitulo} className="mt-2 font-serif text-[1.9rem] leading-[1.15] text-obee-tinta md:text-[2.35rem]">
        {r.pergunta}
      </h2>
      <p className="mt-1.5 text-[0.9375rem] text-carvao-muted">{r.contexto}</p>
      <p className="mt-1.5 max-w-prose2 text-[0.8125rem] leading-snug text-carvao-muted"><Siglas texto={r.definicao} /></p>
      {vazio ? (
        <p className="mt-6 border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">
          Nenhuma capital tem dado comparável para esta medida neste período.
        </p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-x-6">
            <NumeroEsquerda valor={fmt(ref!.mediana!)} legenda="Mediana das capitais" destaque />
            {oficial ? <NumeroEsquerda valor={oficial.valorTexto} legenda="Brasil · rede municipal" /> : <NumeroEsquerda valor="Sem referência" legenda="Brasil · rede municipal" pequeno />}
          </dl>
          <NotaCapital r={r} cap={cap} />
          <div className="mt-5">
            <ComparacaoReferencia
              linhas={linhasComparacao(r, ref!.mediana!, oficial, sel ? { rotulo: nomeCapital(sel), valor: sel.valor } : null)}
              formata={fmt}
              formataEixo={(v) => formataEixo(r.medida as MedidaId, v)}
              dominioFixo={r.dominioFixo}
              extremos={[r.menor!.valor, r.maior!.valor]}
              descricao={`${r.titulo} Mediana ${fmt(ref!.mediana!)}${oficial ? `; ${oficial.rotulo}: ${oficial.valorTexto}` : ""}.`}
            />
          </div>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-obee-tinta">
            <span>
              Menor: <strong className="font-semibold">{fmt(r.menor!.valor)}</strong> · {nomesDoExtremo(r.menor!)}
            </span>
            <span aria-hidden="true" className="mx-2 text-linha">
              |
            </span>
            <span>
              Maior: <strong className="font-semibold">{fmt(r.maior!.valor)}</strong> · {nomesDoExtremo(r.maior!)}
            </span>
            <br />
            <span>
              Média das capitais: <strong className="font-semibold">{ref?.media != null ? fmt(ref.media) : "sem dado"}</strong> · {r.pontos.length} {r.pontos.length === 1 ? "capital" : "capitais"}
              {r.semDado.length > 0 ? ` de ${r.universo}` : ""}
            </span>
          </p>
          <details className="mt-1">
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[0.9375rem] text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta">
              Ver os valores de cada capital
            </summary>
            <div className="mt-2">
              <TabelaSimples legenda={`${r.titulo} Valores de cada capital`} cabecalho={["Capital", r.medida === "atu" ? "Alunos por turma" : "Ideb"]} linhas={linhasTabela(r)} />
            </div>
          </details>
        </>
      )}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <p className="max-w-[24rem] pt-2.5 text-[0.8125rem] leading-snug text-carvao-muted">
          {oficial ? `${oficial.rotulo}: agregado nacional, não é média das capitais.` : (r.semNacional ?? "")}
        </p>
        <div className="flex flex-col items-start">
          <EloAprofunda r={r} cap={cap} />
          <SobreEsteDado f={ficha.ficha} ctx={ficha.ctx} rotulo="Fonte e critérios" />
        </div>
      </div>
    </section>
  );
}

function NumeroEsquerda({ valor, legenda, destaque = false, pequeno = false }: { valor: string; legenda: string; destaque?: boolean; pequeno?: boolean }) {
  return (
    <div>
      <dd className={`font-serif leading-none ${pequeno ? "text-[1.25rem]" : "text-[2.1rem]"} ${destaque ? "text-obee-dark" : "text-obee-tinta"}`}>{valor}</dd>
      <dt className="mt-2 text-[0.9375rem] leading-snug text-carvao-muted">{legenda}</dt>
    </div>
  );
}

/** Linhas do gráfico de referência: a mediana das capitais, a referência nacional (se válida) e, se houver, a capital destacada. */
function linhasComparacao(r: ResumoMedida, mediana: number, oficial: ReferenciaExternaCapitulo | null, destaque: { rotulo: string; valor: number } | null): LinhaReferencia[] {
  const linhas: LinhaReferencia[] = [{ chave: "capitais", rotulo: "Capitais · mediana", rotuloEstreito: ["Capitais", "mediana"], valor: mediana, tom: "capitais" }];
  if (oficial) linhas.push({ chave: "brasil", rotulo: "Brasil · agregado", rotuloEstreito: ["Brasil", "agregado"], valor: oficial.valor, tom: "referencia" });
  if (destaque) linhas.push({ chave: "destaque", rotulo: destaque.rotulo, rotuloEstreito: [destaque.rotulo, ""], valor: destaque.valor, tom: "destaque" });
  return linhas;
}

/* ------------------------------------------------------------------ conferência */

function FaixaConferir({ baixar }: { baixar: { href: string; detalhe: string } }) {
  const botao = "inline-flex min-h-[44px] items-center justify-center gap-2 border px-5 text-[0.9375rem]";
  return (
    <section aria-labelledby="conferir-titulo" className="mt-14 bg-obee-fundo px-5 py-6 md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
        <div className="max-w-[34rem]">
          <h2 id="conferir-titulo" className="font-serif text-[1.5rem] leading-snug text-obee-tinta">
            Entenda e confira os números
          </h2>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-carvao-muted">Gasto e resultados têm universos e períodos próprios. A leitura conjunta não demonstra causalidade.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={href(CAMINHO_COMPARAR)} className={`${botao} border-obee-dark bg-obee-dark text-superficie hover:bg-obee-tinta`}>
            Comparar capitais <span aria-hidden="true">→</span>
          </Link>
          <a href={baixar.href} download className={`${botao} border-obee-tinta bg-superficie text-obee-tinta hover:bg-obee-tinta hover:text-superficie`}>
            Baixar dados <span aria-hidden="true">↓</span>
            <span className="sr-only"> ({baixar.detalhe})</span>
          </a>
          <Link href={href(CAMINHO_METODOS)} className={`${botao} border-obee-tinta bg-superficie text-obee-tinta hover:bg-obee-tinta hover:text-superficie`}>
            Fontes e metodologia <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
