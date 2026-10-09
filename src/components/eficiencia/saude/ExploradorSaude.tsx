"use client";

import { useMemo } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { inteiro } from "@/lib/eficiencia/formato";
import {
  CABECALHO_CSV_COMPARACAO,
  ROTULO_ESTADO,
  anosDaMedida,
  comparar,
  componenteDe,
  csv,
  IndiceSaude,
  linhasCsvComparacao,
  notasMateriais,
  serie,
  serieDaMediana,
  type Grupo,
  type Ordem,
  type Ponto,
} from "@/lib/eficiencia/saude/consulta";
import type { DadosSaude } from "@/lib/eficiencia/saude/payload";
import { fraseCapital, fraseEvolucao, fraseAmplitude } from "@/lib/eficiencia/saude/frases";
import { MEDIDAS_SAUDE, ROTULO_PERIODO, TEMAS_SAUDE, type MedidaSaudeId, type Moeda, type TemaSaude } from "@/lib/eficiencia/saude/medidas";
import { CAMINHO_COMPARAR } from "@/lib/eficiencia/saude/rotas";
import { hrefSaude } from "@/lib/eficiencia/saude/rotas";
import type { ContextoFicha } from "../FichaConteudo";
import { DistribuicaoCapitais } from "../DistribuicaoCapitais";
import { Siglas } from "../Siglas";
import { SobreDadoSaude as SobreEsteDado } from "./SobreDadoSaude";
import { TabelaSimples } from "../TabelaSimples";
import { Alternancia, Selecao } from "../controles";
import { ForaDaComparacao, NotasMateriais, Ressalva, SemValor } from "../estados";
import { MiniSerie, type Anotacao } from "../graficos";
import { DetalheGastos, DetalheRede, DetalheResultados } from "./DetalhesSaude";
import { ReferenciasExternasSaude, ReferenciasGrupoSaude } from "./ReferenciasSaude";
import Link from "next/link";

/**
 * Exploração de um tema (Gastos, Rede e atenção primária, Atendimento e resultados): uma pergunta e uma visão predominante por vez, com o gráfico
 * de distribuição das capitais já na primeira tela do computador. Medida, ano, capital e base ficam na URL, e o recorte pode ser compartilhado.
 */

type Visao = "grafico" | "tabela" | "evolucao";

function esquema(ids: string[], tema: TemaSaude) {
  const def = TEMAS_SAUDE[tema];
  return {
    cap: campo(tiposUrl.opcao(["", ...ids]), ""),
    med: campo(tiposUrl.opcao(def.medidas), def.medidaInicial),
    ano: campo(tiposUrl.inteiro({ min: 0, max: 2100 }), 0),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    den: campo(tiposUrl.opcao(["ripsa", "obee"] as const), "ripsa" as "ripsa" | "obee"),
    vis: campo(tiposUrl.opcao(["grafico", "tabela", "evolucao"] as const), "grafico" as Visao),
    ord: campo(tiposUrl.opcao(["alfabetica", "valor", "valor_desc"] as const), "alfabetica" as Ordem),
    grp: campo(tiposUrl.opcao(["todas", "regiao"] as const), "todas" as Grupo),
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

const TITULO_TEMA: Record<TemaSaude, { titulo: string; pergunta: string }> = {
  gastos: { titulo: "Gastos", pergunta: "Quanto a prefeitura executa em Saúde, por habitante e em quais componentes?" },
  rede: { titulo: "Rede e atenção primária", pergunta: "Que estabelecimentos, equipes e cobertura estão registrados?" },
  resultados: { titulo: "Atendimento e resultados", pergunta: "Que resultados são observados entre os moradores, e que parte do atendimento a fonte não permite mostrar?" },
};

const ANOTACAO_ICSAP: Anotacao[] = [];

export function ExploradorSaude({ tema, dados, contextos }: { tema: TemaSaude; dados: DadosSaude; contextos: Record<string, ContextoFicha> }) {
  const def = TEMAS_SAUDE[tema];
  const ix = useMemo(() => new IndiceSaude(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const esq = useMemo(() => esquema(ids, tema), [ids, tema]);
  const [s, definir] = useEstadoUrl(esq);
  const cap = dados.capitais.find((c) => c.id === s.cap) ?? null;
  const m = MEDIDAS_SAUDE[s.med];
  const o = { moeda: s.moeda, denominador: s.den };
  const comp = componenteDe(m, o);
  const anos = anosDaMedida(ix, m, o);
  const ano = s.ano && anos.includes(s.ano) ? s.ano : anos[anos.length - 1];
  const grupo: Grupo = cap && s.grp === "regiao" ? "regiao" : "todas";
  const nomeGrupo = grupo === "regiao" && cap ? `capitais da região ${dados.regioes[cap.regiao]}` : "capitais na comparação";
  const c = comparar(ix, m, ano, o, grupo, cap, s.ord);
  const pt = cap ? ix.ponto(m.indicador, cap.cod, ano, comp) : null;
  const incluidaCap = cap ? c.incluidas.find((i) => i.cap.id === cap.id) : undefined;
  const ficha = dados.fichas.find((f) => f.id === m.indicador)!;
  const periodo = ROTULO_PERIODO[m.periodo](ano);
  const fonteTexto = `${ficha.nome_curto}. ${ficha.fontes.join("; ")}.`;

  const regiao = grupo === "regiao" && cap ? cap.regiao : null;
  const itensFrase = c.incluidas.map((i) => ({ nome: i.cap.nome, uf: i.cap.uf, valor: i.valor }));
  const titulo = fraseAmplitude(itensFrase, m, ano, c.ref?.mediana ?? null);
  const fraseCap = cap ? fraseCapital(cap.nome, cap.uf, pt?.valor ?? null, c.ref?.mediana ?? null, c.ref?.n ?? 0, m, !!pt && pt.valor !== null && !incluidaCap) : null;
  const subtitulo = [m.rotulo, m.unidade(s.moeda), periodo, `capitais estaduais${grupo === "regiao" && cap ? `, região ${dados.regioes[cap.regiao]}` : ""}`, m.universo].join(" · ");

  // referências externas válidas para o gráfico: a primeira de comparabilidade direta (nacional, ou o mínimo normativo)
  const externas = ix.externas(m.indicador, comp, ano);
  const externaGrafico = externas.find((e) => e.comparabilidade === "direta") ?? null;
  const externaNaDistribuicao = externaGrafico ? { rotulo: externaGrafico.tipo === "normativa" ? "Mínimo legal" : externaGrafico.rotulo.split(" (")[0], valor: externaGrafico.valor, nota: externaGrafico.tipo === "normativa" ? "referência normativa, não meta" : externaGrafico.origem === "calculado_obee" ? "calculado pelo OBEE" : "oficial" } : null;

  const pontosSerie = cap
    ? serie(ix, m, cap.cod, o)
    : serieDaMediana(ix, m, o, regiao).map((x) => ({ ano: x.ano, valor: x.valor, status: (x.valor === null ? "AUSENTE_NA_COLETA" : "OBSERVADO") as Ponto["status"], nota: null, notaMaterial: false, participacao: null, elegivel: x.valor !== null, situacao: null, motivo: null, quebraSerie: x.quebraSerie }));
  const medianaPorAno = serieDaMediana(ix, m, o, regiao);
  const referenciaSerie = cap ? medianaPorAno.map((x) => ({ ano: x.ano, valor: x.valor, n: x.n })) : undefined;
  const anotacoes: Anotacao[] = m.id === "cobertura_aps" ? [{ ano: 2021, texto: "dezembro de 2021 segue regra anterior de equipes e cadastro e não reproduz a fórmula da Nota Técnica nº 2/2025." }] : ANOTACAO_ICSAP;
  const fraseSerie = fraseEvolucao(
    pontosSerie.map((p) => ({ ano: p.ano, valor: p.valor, elegivel: p.elegivel, quebraSerie: p.quebraSerie })),
    m,
    cap ? `${cap.nome} (${cap.uf})` : "Na mediana das capitais",
    "a base populacional ou o método mudou entre os dois anos",
  );
  const comValorSerie = medianaPorAno.filter((x) => x.valor !== null);
  const conjuntoVaria = !cap && comValorSerie.length > 1 && new Set(comValorSerie.map((x) => x.n)).size > 1;

  const exportar = () => {
    const linhas = linhasCsvComparacao(ix, m, ano, o, c, periodo, fonteTexto);
    baixar(`saude_${m.id}_${ano}.csv`, csv(CABECALHO_CSV_COMPARACAO, linhas));
  };

  const temRazao = m.razaoAgregada && ficha.numerador && ficha.denominador;
  const textoRazao = c.ref && c.ref.razaoAgregada !== null && temRazao ? (
    <>
      <span className="font-semibold">Razão agregada {m.formata(c.ref.razaoAgregada)}:</span> soma do numerador de {c.ref.n} capitais ÷ soma do denominador das mesmas {c.ref.n}
      {c.ref.somaDenominador !== null ? ` (${inteiro(Math.round(c.ref.somaDenominador))})` : ""}. Pesa cada capital pelo seu denominador; é outra conta que a média simples, que dá o mesmo peso a cada capital.
    </>
  ) : undefined;

  const medidasOpcoes = def.medidas.map((id) => ({ v: id, t: MEDIDAS_SAUDE[id].rotulo }));
  const tabelaLinhas = [
    ...c.incluidas.map((i) => [`${i.cap.nome} (${i.cap.uf})`, m.formata(i.valor), i.ponto.numerador !== null && i.ponto.denominador !== null ? `${inteiro(Math.round(i.ponto.numerador))} ÷ ${inteiro(Math.round(i.ponto.denominador))}` : "", "Na comparação"]),
    ...c.excluidas.map((x) => [`${x.cap.nome} (${x.cap.uf})`, x.comValor && x.ponto.valor !== null ? m.formata(x.ponto.valor) : "sem valor", "", x.comValor ? "Valor oficial, fora da comparação" : ROTULO_ESTADO[x.status]]),
  ];

  return (
    <div>
      <section aria-labelledby="titulo-tema" className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
          <p className="rotulo text-mineral">Saúde nas capitais</p>
          <h1 id="titulo-tema" className="mt-2 font-serif text-[2.1rem] leading-[1.08] tracking-tight text-obee-tinta md:text-[2.6rem]">
            {TITULO_TEMA[tema].titulo}
          </h1>
          <p className="mt-3 text-[1.0625rem] leading-snug text-obee-tinta">{TITULO_TEMA[tema].pergunta}</p>
          <div className="mt-6 space-y-4">
            <Selecao id="med" rotulo="Medida" ajuda="O gráfico, a tabela e a evolução mostram a medida escolhida." valor={s.med} opcoes={medidasOpcoes} aoMudar={(v) => definir({ med: v as MedidaSaudeId, ano: 0 })} />
            <div className="grid grid-cols-2 gap-4">
              <Selecao id="ano" rotulo={m.periodo === "dezembro" ? "Competência" : m.periodo === "processamento" ? "Ano de processamento" : "Exercício"} ajuda="Período do dado." valor={String(ano)} opcoes={anos.map((a) => ({ v: String(a), t: m.periodo === "dezembro" ? `dez. ${a}` : String(a) }))} aoMudar={(v) => definir({ ano: Number(v) })} />
              <Selecao id="cap" rotulo="Capital" ajuda="Opcional: destaca uma capital." valor={s.cap} opcoes={[{ v: "", t: "Nenhuma" }, ...dados.capitais.map((x) => ({ v: x.id, t: `${x.nome} (${x.uf})` }))]} aoMudar={(v) => definir({ cap: v, grp: "todas" })} />
            </div>
            {m.moeda && <Alternancia rotulo="Valores" valor={s.moeda} opcoes={[{ v: "nominal", t: "Nominais" }, { v: "real", t: "Reais de 2025" }]} aoMudar={(v) => definir({ moeda: v })} />}
            {m.denominador && <Alternancia rotulo="População do denominador" valor={s.den} opcoes={[{ v: "ripsa", t: "Ministério da Saúde" }, { v: "obee", t: "IBGE do exercício" }]} aoMudar={(v) => definir({ den: v })} />}
            {cap && <Alternancia rotulo="Grupo de comparação" valor={grupo} opcoes={[{ v: "todas", t: "Todas as capitais" }, { v: "regiao", t: `Região ${dados.regioes[cap.regiao]}` }]} aoMudar={(v) => definir({ grp: v })} />}
          </div>
          <div className="mt-6 border-l-2 border-obee pl-3 text-sm leading-snug text-obee-tinta">
            <p><Siglas texto={m.definicao} /></p>
            <p className="mt-2 text-carvao-muted"><Siglas texto={m.naoE} /></p>
            <div className="mt-1"><SobreEsteDado f={ficha} ctx={contextos[ficha.id]} /></div>
          </div>
          <p className="mt-4 text-sm">
            <Link href={hrefSaude(CAMINHO_COMPARAR, { med: m.id, ano, ...(cap ? { cap: cap.id } : {}) })} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
              Comparar capitais nesta medida <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Alternancia<Visao> rotulo="Visão" valor={s.vis} opcoes={[{ v: "grafico", t: "Distribuição" }, { v: "tabela", t: "Tabela" }, { v: "evolucao", t: "Evolução" }]} aoMudar={(v) => definir({ vis: v })} rotuloVisivel={false} />
            <button type="button" onClick={exportar} className="rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-obee-dark hover:border-obee">
              Baixar CSV
            </button>
          </div>
          <h2 className="mt-4 font-serif text-[1.3rem] leading-snug text-obee-tinta md:text-[1.45rem]">{s.vis === "evolucao" ? fraseSerie : titulo}</h2>
          <p className="mt-1.5 text-[0.8125rem] leading-snug text-carvao-muted">{s.vis === "evolucao" ? `${m.rotulo} · ${m.unidade(s.moeda)} · série de ${anos[0]} a ${anos[anos.length - 1]} · ${cap ? `${cap.nome} (${cap.uf})` : "mediana das capitais"}` : subtitulo}</p>
          {fraseCap && s.vis !== "evolucao" && <p className="mt-2 text-sm leading-snug text-obee-tinta">{fraseCap}</p>}

          <div className="mt-4">
            {s.vis === "grafico" && (
              c.incluidas.length > 0 ? (
                <DistribuicaoCapitais
                  linhas={c.incluidas.map((i) => ({ chave: i.cap.id, rotulo: `${i.cap.nome} (${i.cap.uf})`, valor: i.valor, destacada: i.cap.id === cap?.id }))}
                  referencias={{ mediana: c.ref?.mediana ?? null, media: c.ref?.media ?? null, faixa: c.ref && c.ref.quartisExibicao && c.ref.q1 !== null && c.ref.q3 !== null ? { q1: c.ref.q1, q3: c.ref.q3 } : null, externa: externaNaDistribuicao }}
                  formata={(v) => m.formata(v, true)}
                  formataEixo={m.formataEixo}
                  zero={m.zero}
                  titulo={`${m.rotulo}, ${periodo}`}
                  rotuloGrupo={nomeGrupo}
                  alturaLinha={24}
                  fora={c.excluidas.map((x) => ({ chave: x.cap.id, rotulo: `${x.cap.nome} (${x.cap.uf})`, valor: x.comValor ? x.ponto.valor : null, texto: x.comValor ? "fora da comparação (motivo abaixo)" : `${ROTULO_ESTADO[x.status].toLowerCase()} (motivo abaixo)`, destacada: x.cap.id === cap?.id }))}
                />
              ) : (
                <SemValor ponto={pt ?? { valor: null, status: "AUSENTE_NA_COLETA", nota: null, notaMaterial: false, participacao: null, elegivel: false, situacao: null, motivo: null, quebraSerie: false }} contexto="Nenhuma capital tem valor comparável para este recorte." />
              )
            )}
            {s.vis === "tabela" && (
              <TabelaSimples legenda={`${m.rotulo}, ${periodo}`} cabecalho={["Capital", "Valor", "Numerador ÷ denominador", "Situação"]} linhas={tabelaLinhas} />
            )}
            {s.vis === "evolucao" && (
              <div>
                <MiniSerie titulo={`${m.rotulo}: ${cap ? `${cap.nome} (${cap.uf})` : "mediana das capitais"}`} pontos={pontosSerie} formata={(v) => m.formata(v, true)} formataEixo={m.formataEixo} zero={m.zero} anotacoes={anotacoes} referencia={referenciaSerie} altura={260} />
                {conjuntoVaria && <p className="mt-3 max-w-prose2 text-sm text-carvao-muted">Cada mediana usa as capitais com valor comparável no ano ({comValorSerie.map((x) => `${x.n} em ${x.ano}`).join(", ")}): o conjunto muda, então a variação não é a de um grupo constante.</p>}
              </div>
            )}
          </div>
          {pt && cap && <Ressalva ponto={pt} />}
          {pt && pt.valor === null && cap && <SemValor ponto={pt} />}
        </div>
      </section>

      <div className="mt-10 grid gap-10 border-t border-linha pt-8 lg:grid-cols-2">
        <div className="space-y-6">
          {(() => {
            const notas = notasMateriais(c);
            return notas.length ? <NotasMateriais notas={notas} n={c.incluidas.length} /> : null;
          })()}
          <ForaDaComparacao itens={c.excluidas.map((x) => ({ nome: x.cap.nome, uf: x.cap.uf, status: x.comValor ? "Fora da comparação" : ROTULO_ESTADO[x.status], motivo: x.motivo }))} />
        </div>
        <div className="space-y-8">
          {c.ref && <ReferenciasGrupoSaude r={c.ref} m={m} nomeGrupo={nomeGrupo} textoRazao={textoRazao} />}
          <ReferenciasExternasSaude itens={externas} m={m} valorCapital={pt?.valor ?? null} />
          {m.id === "asps_pct" && cap && pt?.valor !== null && pt?.valor !== undefined && (
            <p className="max-w-prose2 text-sm text-obee-tinta">
              Distância do mínimo de {inteiro(15)}%: {pt.valor >= 15 ? "+" : "−"}{String(Math.abs(pt.valor - 15).toFixed(2)).replace(".", ",")} ponto percentual (referência normativa, não meta; a lei orgânica do município pode fixar mínimo maior, informado no demonstrativo).
            </p>
          )}
        </div>
      </div>

      <div className="mt-12">
        {tema === "gastos" && <DetalheGastos ix={ix} cap={cap} ano={m.periodo === "exercicio" ? ano : anosDaMedida(ix, MEDIDAS_SAUDE.despesa, o).slice(-1)[0]} contextos={contextos} />}
        {tema === "rede" && <DetalheRede ix={ix} cap={cap} ano={ano} contextos={contextos} />}
        {tema === "resultados" && <DetalheResultados ix={ix} cap={cap} ano={m.periodo === "processamento" ? ano : anos[anos.length - 1]} contextos={contextos} />}
      </div>
    </div>
  );
}
