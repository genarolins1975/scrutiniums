"use client";

import { useMemo } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { inteiro } from "@/lib/eficiencia/formato";
import { CABECALHO_CSV_COMPARACAO, IndiceSaude, ROTULO_ESTADO, anosDaMedida, comparar, componenteDe, csv, linhasCsvComparacao, serie, type Ponto } from "@/lib/eficiencia/saude/consulta";
import type { DadosSaude } from "@/lib/eficiencia/saude/payload";
import { MEDIDAS_ORDEM, MEDIDAS_SAUDE, ROTULO_PERIODO, TEMAS_SAUDE, type MedidaSaudeId, type Moeda } from "@/lib/eficiencia/saude/medidas";
import type { ContextoFicha } from "../FichaConteudo";
import { DistribuicaoCapitais } from "../DistribuicaoCapitais";
import { SobreDadoSaude as SobreEsteDado } from "./SobreDadoSaude";
import { Alternancia, Selecao } from "../controles";
import { ForaDaComparacao, Ressalva, SemValor } from "../estados";
import { MiniSerie } from "../graficos";

/**
 * Comparar capitais: a mesma medida e o mesmo período para duas capitais lado a lado, a distribuição das 26 e a tabela completa com todas as medidas do
 * mesmo ano. Nada muda de competência entre uma capital e outra; a diferença é descritiva, sem classificação.
 */

type Colunas = MedidaSaudeId | "alfabetica";

function esquema(ids: string[]) {
  return {
    cap: campo(tiposUrl.opcao(["", ...ids]), ""),
    vs: campo(tiposUrl.opcao(["", ...ids]), ""),
    med: campo(tiposUrl.opcao(MEDIDAS_ORDEM), "despesa_hab" as MedidaSaudeId),
    ano: campo(tiposUrl.inteiro({ min: 0, max: 2100 }), 0),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    den: campo(tiposUrl.opcao(["ripsa", "obee"] as const), "ripsa" as "ripsa" | "obee"),
    ord: campo(tiposUrl.opcao(["alfabetica", ...MEDIDAS_ORDEM] as const), "alfabetica" as Colunas),
    dir: campo(tiposUrl.opcao(["cres", "desc"] as const), "cres" as "cres" | "desc"),
  };
}

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const GRUPO_MEDIDA: Record<string, string> = { gastos: "Gastos", rede: "Rede e atenção primária", resultados: "Atendimento e resultados" };

export function ComparadorSaude({ dados, contextos }: { dados: DadosSaude; contextos: Record<string, ContextoFicha> }) {
  const ix = useMemo(() => new IndiceSaude(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const esq = useMemo(() => esquema(ids), [ids]);
  const [s, definir] = useEstadoUrl(esq);
  const m = MEDIDAS_SAUDE[s.med];
  const o = { moeda: s.moeda, denominador: s.den };
  const comp = componenteDe(m, o);
  const anos = anosDaMedida(ix, m, o);
  const ano = s.ano && anos.includes(s.ano) ? s.ano : anos[anos.length - 1];
  const A = dados.capitais.find((c) => c.id === s.cap) ?? null;
  const B = dados.capitais.find((c) => c.id === s.vs) ?? null;
  const c = comparar(ix, m, ano, o, "todas", A, "alfabetica");
  const periodo = ROTULO_PERIODO[m.periodo](ano);
  const ficha = dados.fichas.find((f) => f.id === m.indicador)!;
  const pa = A ? ix.ponto(m.indicador, A.cod, ano, comp) : null;
  const pb = B ? ix.ponto(m.indicador, B.cod, ano, comp) : null;
  const naComparacao = (p: Ponto | null) => !!p && p.status === "OBSERVADO" && p.valor !== null && p.elegivel;
  const mediana = c.ref?.mediana ?? null;

  const cartao = (cap: typeof A, p: Ponto | null) => {
    if (!cap || !p) return null;
    const dentro = naComparacao(p);
    return (
      <div className="min-w-0 border-t-2 border-obee pt-3">
        <p className="rotulo text-mineral">{cap.nome} ({cap.uf})</p>
        <p className="mt-1 font-serif text-[2rem] leading-none text-obee-tinta">{p.valor === null ? "sem valor" : m.formata(p.valor)}</p>
        <p className="mt-1.5 text-[0.8125rem] leading-snug text-carvao-muted">
          {periodo} · {dentro && mediana !== null && p.valor !== null ? (p.valor === mediana ? "igual à mediana das capitais" : `${inteiro(Math.round(Math.abs(p.valor / mediana - 1) * 100))}% ${p.valor > mediana ? "acima" : "abaixo"} da mediana das capitais (${m.formata(mediana)})`) : p.valor !== null ? "valor oficial fora da comparação" : ROTULO_ESTADO[p.status].toLowerCase()}
        </p>
        {p.valor === null ? <SemValor ponto={p} /> : <Ressalva ponto={p} />}
      </div>
    );
  };
  const diferenca = A && B && naComparacao(pa) && naComparacao(pb) && pa!.valor !== null && pb!.valor !== null ? (() => {
    const d = pa!.valor! - pb!.valor!;
    const rel = pb!.valor ? Math.abs(pa!.valor! / pb!.valor! - 1) * 100 : null;
    return `${A.nome} tem ${m.formata(Math.abs(d))} ${d >= 0 ? "a mais" : "a menos"} que ${B.nome} em ${periodo.toLowerCase()}${rel !== null && Number.isFinite(rel) ? ` (${inteiro(Math.round(rel))}% ${d >= 0 ? "maior" : "menor"}, em valor)` : ""}. É diferença descritiva: não indica qual capital está melhor nem explica a causa.`;
  })() : A && B ? "Pelo menos uma das duas capitais tem o valor fora da comparação ou sem valor neste recorte; os motivos estão em cada cartão." : null;

  // tabela completa: todas as medidas no mesmo ano
  const cols = MEDIDAS_ORDEM.map((id) => MEDIDAS_SAUDE[id]);
  const celula = (cod: number, mm: (typeof cols)[number]) => {
    const oo = { moeda: s.moeda, denominador: s.den };
    const p = ix.ponto(mm.indicador, cod, ano, mm.componente(oo.moeda, oo.denominador));
    const cobre = anosDaMedida(ix, mm, oo).includes(ano);
    return { p, cobre };
  };
  const linhasTab = dados.capitais.map((cap) => ({ cap, cel: cols.map((mm) => celula(cap.cod, mm)) }));
  const ordenadas = [...linhasTab].sort((a, b) => {
    if (s.ord === "alfabetica") return s.dir === "desc" ? b.cap.nome.localeCompare(a.cap.nome, "pt-BR") : a.cap.nome.localeCompare(b.cap.nome, "pt-BR");
    const i = MEDIDAS_ORDEM.indexOf(s.ord as MedidaSaudeId);
    const va = a.cel[i].p.valor;
    const vb = b.cel[i].p.valor;
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return s.dir === "desc" ? vb - va : va - vb;
  });
  const cabecalhoOrd = (col: Colunas) => (s.ord === col ? (s.dir === "desc" ? "descending" : "ascending") : "none");
  const alternar = (col: Colunas) => definir({ ord: col, dir: s.ord === col && s.dir === "cres" ? "desc" : "cres" });
  const exportarTabela = () => {
    const cab = ["Capital", "UF", ...cols.map((mm) => `${mm.rotulo} (${mm.unidade(s.moeda)})`), "Observações"];
    const linhas = ordenadas.map(({ cap, cel }) => [cap.nome, cap.uf, ...cel.map(({ p, cobre }) => (p.valor === null ? "" : String(p.valor))), cel.map(({ p, cobre }, i) => (!cobre ? `${cols[i].rotuloCurto}: ${periodo} não coberto` : p.valor === null ? `${cols[i].rotuloCurto}: ${ROTULO_ESTADO[p.status]}` : !p.elegivel ? `${cols[i].rotuloCurto}: fora da comparação` : "")).filter(Boolean).join("; ")]);
    baixar(`saude_comparacao_${ano}.csv`, csv(cab, linhas));
  };
  const exportarMedida = () => baixar(`saude_${m.id}_${ano}.csv`, csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(ix, m, ano, o, c, periodo, `${ficha.nome_curto}. ${ficha.fontes.join("; ")}.`)));

  const opcoesMedida = TEMAS_ORDEM.flatMap((t) => TEMAS_SAUDE[t].medidas.map((id) => ({ v: id, t: MEDIDAS_SAUDE[id].rotulo, grupo: GRUPO_MEDIDA[t] })));
  const opcoesCapital = (vazio: string) => [{ v: "", t: vazio }, ...dados.capitais.map((x) => ({ v: x.id, t: `${x.nome} (${x.uf})` }))];

  return (
    <div>
      <section aria-labelledby="titulo-comparar" className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
          <p className="rotulo text-mineral">Saúde nas capitais</p>
          <h1 id="titulo-comparar" className="mt-2 font-serif text-[2.1rem] leading-[1.08] tracking-tight text-obee-tinta md:text-[2.6rem]">Comparar capitais</h1>
          <p className="mt-3 text-[1.0625rem] leading-snug text-obee-tinta">Como cada capital se situa na mesma medida e no mesmo período?</p>
          <div className="mt-6 space-y-4">
            <Selecao id="cmp-med" rotulo="Medida" ajuda="Vale para as duas capitais e para a distribuição." valor={s.med} opcoes={opcoesMedida} aoMudar={(v) => definir({ med: v as MedidaSaudeId, ano: 0 })} />
            <Selecao id="cmp-ano" rotulo={m.periodo === "dezembro" ? "Competência" : m.periodo === "processamento" ? "Ano de processamento" : "Exercício"} ajuda="O mesmo período para as duas capitais." valor={String(ano)} opcoes={anos.map((a) => ({ v: String(a), t: m.periodo === "dezembro" ? `dez. ${a}` : String(a) }))} aoMudar={(v) => definir({ ano: Number(v) })} />
            <div className="grid grid-cols-2 gap-4">
              <Selecao id="cmp-a" rotulo="Capital A" ajuda="Primeira capital." valor={s.cap} opcoes={opcoesCapital("Nenhuma")} aoMudar={(v) => definir({ cap: v })} />
              <Selecao id="cmp-b" rotulo="Capital B" ajuda="Segunda capital." valor={s.vs} opcoes={opcoesCapital("Nenhuma")} aoMudar={(v) => definir({ vs: v })} />
            </div>
            {m.moeda && <Alternancia rotulo="Valores" valor={s.moeda} opcoes={[{ v: "nominal", t: "Nominais" }, { v: "real", t: "Reais de 2025" }]} aoMudar={(v) => definir({ moeda: v })} />}
            {m.denominador && <Alternancia rotulo="População do denominador" valor={s.den} opcoes={[{ v: "ripsa", t: "Ministério da Saúde" }, { v: "obee", t: "IBGE do exercício" }]} aoMudar={(v) => definir({ den: v })} />}
          </div>
          <div className="mt-6 border-l-2 border-obee pl-3 text-sm leading-snug text-obee-tinta">
            <p>{m.definicao}</p>
            <p className="mt-2 text-carvao-muted">{m.naoE}</p>
            <div className="mt-1"><SobreEsteDado f={ficha} ctx={contextos[ficha.id]} /></div>
          </div>
        </div>

        <div className="min-w-0">
          {(A || B) && (
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {cartao(A, pa)}
              {cartao(B, pb)}
            </div>
          )}
          {diferenca && <p className="mt-4 max-w-prose2 text-sm leading-snug text-obee-tinta">{diferenca}</p>}
          {!A && !B && <p className="max-w-prose2 text-sm leading-snug text-carvao-muted">Escolha a capital A, e se quiser a capital B, para ver os valores lado a lado. A distribuição das capitais aparece de qualquer modo.</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-[1.3rem] leading-snug text-obee-tinta">{m.rotulo}, {periodo.toLowerCase()}</h2>
            <button type="button" onClick={exportarMedida} className="rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-obee-dark hover:border-obee">Baixar CSV da medida</button>
          </div>
          <p className="mt-1 text-[0.8125rem] leading-snug text-carvao-muted">{m.unidade(s.moeda)} · {c.ref ? `${c.ref.n} de ${c.noGrupo} capitais na comparação` : "sem capital na comparação"} · {m.universo}</p>
          <div className="mt-3">
            {c.incluidas.length > 0 ? (
              <DistribuicaoCapitais
                linhas={c.incluidas.map((i) => ({ chave: i.cap.id, rotulo: `${i.cap.nome} (${i.cap.uf})`, valor: i.valor, destacada: i.cap.id === A?.id || i.cap.id === B?.id }))}
                referencias={{ mediana: c.ref?.mediana ?? null, media: c.ref?.media ?? null, faixa: c.ref && c.ref.quartisExibicao && c.ref.q1 !== null && c.ref.q3 !== null ? { q1: c.ref.q1, q3: c.ref.q3 } : null }}
                formata={(v) => m.formata(v, true)}
                formataEixo={m.formataEixo}
                zero={m.zero}
                titulo={`${m.rotulo}, ${periodo}`}
                alturaLinha={24}
                fora={c.excluidas.map((x) => ({ chave: x.cap.id, rotulo: `${x.cap.nome} (${x.cap.uf})`, valor: x.comValor ? x.ponto.valor : null, texto: x.comValor ? "fora da comparação (motivo abaixo)" : `${ROTULO_ESTADO[x.status].toLowerCase()} (motivo abaixo)`, destacada: x.cap.id === A?.id || x.cap.id === B?.id }))}
              />
            ) : (
              <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">Nenhuma capital tem valor comparável para este recorte.</p>
            )}
          </div>
          <div className="mt-5"><ForaDaComparacao itens={c.excluidas.map((x) => ({ nome: x.cap.nome, uf: x.cap.uf, status: x.comValor ? "Fora da comparação" : ROTULO_ESTADO[x.status], motivo: x.motivo }))} /></div>
        </div>
      </section>

      {(A || B) && (
        <section aria-labelledby="cmp-evolucao" className="mt-12 border-t border-linha pt-8">
          <h2 id="cmp-evolucao" className="font-serif text-[1.45rem] leading-snug text-obee-tinta">Evolução da medida nas capitais escolhidas</h2>
          <p className="mt-1 max-w-prose2 text-sm leading-snug text-carvao-muted">Cada gráfico tem a escala do próprio conjunto de valores; para comparar a diferença entre as capitais, use os valores do mesmo ano acima.</p>
          <div className="mt-5 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {[A, B].filter((x): x is NonNullable<typeof A> => !!x).map((cap) => (
              <div key={cap.id}>
                <h3 className="rotulo text-mineral">{cap.nome} ({cap.uf})</h3>
                <MiniSerie titulo={`${m.rotulo}: ${cap.nome}`} pontos={serie(ix, m, cap.cod, o)} formata={(v) => m.formata(v, true)} formataEixo={m.formataEixo} zero={m.zero} altura={200} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="cmp-tabela" className="mt-12 border-t border-linha pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="cmp-tabela" className="font-serif text-[1.45rem] leading-snug text-obee-tinta">As 26 capitais, todas as medidas, em {ano}</h2>
          <button type="button" onClick={exportarTabela} className="rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-obee-dark hover:border-obee">Baixar CSV da tabela</button>
        </div>
        <p className="mt-1 max-w-prose2 text-sm leading-snug text-carvao-muted">Cada coluna tem a sua unidade e o seu universo; as medidas não se somam. Ordenar por uma coluna é recurso de leitura, não classificação. Valor em itálico: valor oficial fora da comparação. {s.moeda === "real" ? "Valores em reais de 2025." : "Valores em reais correntes."}</p>
        <div className="tabela-scroll mt-4 min-w-0 max-w-full border border-linha" tabIndex={0} role="region" aria-label="Tabela das 26 capitais em todas as medidas (role na horizontal se necessário)">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <caption className="sr-only">Capitais e medidas de Saúde em {ano}</caption>
            <thead>
              <tr>
                <th scope="col" aria-sort={cabecalhoOrd("alfabetica")} className="sticky left-0 z-10 border-b border-carvao-muted bg-superficie px-2 py-2 text-left font-semibold">
                  <button type="button" onClick={() => alternar("alfabetica")} className="inline-flex min-h-[44px] items-center gap-1">Capital {s.ord === "alfabetica" ? (s.dir === "desc" ? "↓" : "↑") : ""}</button>
                </th>
                {cols.map((mm) => (
                  <th key={mm.id} scope="col" aria-sort={cabecalhoOrd(mm.id)} className="border-b border-carvao-muted px-2 py-2 text-right align-bottom font-semibold">
                    <button type="button" onClick={() => alternar(mm.id)} className="inline-flex min-h-[44px] items-end gap-1 text-right">
                      <span>{mm.rotuloCurto}<span className="block text-[0.7rem] font-normal text-carvao-muted">{mm.unidade(s.moeda)}</span></span>
                      {s.ord === mm.id ? <span aria-hidden="true">{s.dir === "desc" ? "↓" : "↑"}</span> : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map(({ cap, cel }) => (
                <tr key={cap.id} className={`border-b border-linha ${cap.id === A?.id || cap.id === B?.id ? "bg-obee-fundo" : ""}`}>
                  <th scope="row" className="sticky left-0 z-10 bg-inherit px-2 py-2 text-left font-normal text-obee-tinta">{cap.nome} ({cap.uf})</th>
                  {cel.map(({ p, cobre }, i) => (
                    <td key={cols[i].id} className="px-2 py-2 text-right tabular-nums text-obee-tinta">
                      {!cobre ? <span className="text-carvao-muted">não coberto</span> : p.valor === null ? <span className="text-carvao-muted">sem valor</span> : <span className={p.elegivel ? "" : "italic"}>{cols[i].formata(p.valor, true)}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const TEMAS_ORDEM = ["gastos", "rede", "resultados"] as const;
