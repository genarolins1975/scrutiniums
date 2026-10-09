"use client";

import { useEffect, useMemo } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { inteiro } from "@/lib/eficiencia/formato";
import {
  CABECALHO_CSV_COMPARACAO,
  CABECALHO_CSV_SERIE,
  ROTULO_ESTADO,
  anosDaMedida,
  avisoDoPeriodo,
  comparar,
  componenteDe,
  csv,
  denominadoresIcsapIguais,
  IndiceSaude,
  linhasCsvComparacao,
  linhasCsvSerie,
  notasMateriais,
  serie,
  serieDaMediana,
  type Grupo,
  type Ordem,
  type Ponto,
} from "@/lib/eficiencia/saude/consulta";
import type { DadosSaude } from "@/lib/eficiencia/saude/payload";
import { fraseCapital, fraseEvolucao, fraseAmplitude, resumoDoRecorte } from "@/lib/eficiencia/saude/frases";
import { MEDIDAS_SAUDE, ROTULO_PERIODO, TEMAS_SAUDE, type MedidaSaudeId, type Moeda, type TemaSaude } from "@/lib/eficiencia/saude/medidas";
import { CAMINHO_COMPARAR, CAMINHO_METODOS, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import type { ContextoFicha } from "../FichaConteudo";
import { DistribuicaoCapitais } from "../DistribuicaoCapitais";
import { Siglas } from "../Siglas";
import { SobreDadoSaude as SobreEsteDado } from "./SobreDadoSaude";
import { TabelaSimples } from "../TabelaSimples";
import { Alternancia, Selecao } from "../controles";
import { NotasMateriais, Ressalva, SemValor } from "../estados";
import { AjudaDenominador, AjudaMoeda, AvisoDoPeriodo, EtiquetaDePerimetro, ForaDaComparacaoSaude, GlossarioDaPagina, RecorteRecolhivel } from "./AvisosSaude";
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

const ANOTACOES_COBERTURA: Anotacao[] = [
  { ano: 2021, texto: "dezembro de 2021 segue regra anterior de equipes e cadastro e não reproduz a fórmula da Nota Técnica nº 2/2025." },
  { ano: 2022, texto: "a população de referência de dezembro de 2022 é anterior ao Censo 2022; a de dezembro de 2023 é a do Censo." },
  { ano: 2025, texto: "a população de referência de dezembro de 2025 é a estimativa de 2024, posterior ao Censo; dezembro de 2023 e de 2024 usam a mesma população do Censo 2022." },
];
const ANOTACOES_POPULACAO: Anotacao[] = [
  { ano: 2021, texto: "população de 2021: estimativa anterior ao Censo 2022." },
  { ano: 2024, texto: "a partir de 2024 a população é estimativa posterior ao Censo 2022; 2022 e 2023 usam a mesma população do Censo." },
];
const POR_POPULACAO = ["despesa_hab", "ubs_10mil", "esf_10mil", "eap_10mil"];
const ORDENS: { v: Ordem; t: string }[] = [
  { v: "alfabetica", t: "Alfabética" },
  { v: "valor_desc", t: "Maior ao menor" },
  { v: "valor", t: "Menor ao maior" },
];
const LEGENDA_PERIODO = { exercicio: "Exercício", dezembro: "Competência", processamento: "Ano de processamento" } as const;

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
  // um ano que a medida não tem (link antigo, ICSAP em 2025) é corrigido na própria URL, para a página e o link dizerem a mesma coisa
  useEffect(() => {
    if (s.ano && !anos.includes(s.ano)) definir({ ano: 0 });
  }, [s.ano, anos, definir]);
  const grupo: Grupo = cap && s.grp === "regiao" ? "regiao" : "todas";
  const nomeGrupo = grupo === "regiao" && cap ? `capitais da região ${dados.regioes[cap.regiao]}` : "capitais na comparação";
  const c = comparar(ix, m, ano, o, grupo, cap, s.ord);
  const pt = cap ? ix.ponto(m.indicador, cap.cod, ano, comp) : null;
  const incluidaCap = cap ? c.incluidas.find((i) => i.cap.id === cap.id) : undefined;
  const ficha = dados.fichas.find((f) => f.id === m.indicador)!;
  const periodo = ROTULO_PERIODO[m.periodo](ano);
  const aviso = avisoDoPeriodo(m, ano, o, dados);

  const regiao = grupo === "regiao" && cap ? cap.regiao : null;
  const itensFrase = c.incluidas.map((i) => ({ nome: i.cap.nome, uf: i.cap.uf, valor: i.valor }));
  const titulo = fraseAmplitude(itensFrase, m, ano, c.ref?.mediana ?? null);
  const fraseCap = cap ? fraseCapital(cap.nome, cap.uf, pt?.valor ?? null, c.ref?.mediana ?? null, c.ref?.n ?? 0, m, !!pt && pt.valor !== null && !incluidaCap) : null;
  const unidadeNoTitulo = /por 10 mil|por 100 mil/.test(m.rotulo) ? null : m.unidade(s.moeda); // o rótulo das taxas já traz a unidade
  const subtitulo = [m.rotulo, unidadeNoTitulo, periodo, `capitais estaduais${grupo === "regiao" && cap ? `, região ${dados.regioes[cap.regiao]}` : ""}`, m.universo].filter(Boolean).join(" · ");

  // referências externas válidas para o gráfico: a primeira de comparabilidade direta (nacional, ou o mínimo normativo)
  const externas = ix.externas(m.indicador, comp, ano);
  const externaGrafico = externas.find((e) => e.comparabilidade === "direta") ?? null;
  const externaNaDistribuicao = externaGrafico ? { rotulo: externaGrafico.tipo === "normativa" ? "Mínimo legal" : externaGrafico.rotulo.split(" (")[0], valor: externaGrafico.valor, nota: externaGrafico.tipo === "normativa" ? "referência normativa, não meta" : externaGrafico.origem === "calculado_obee" ? "calculado pelo OBEE" : "oficial" } : null;

  const pontosSerie = cap
    ? serie(ix, m, cap.cod, o)
    : serieDaMediana(ix, m, o, regiao).map((x) => ({ ano: x.ano, valor: x.valor, status: (x.valor === null ? "NAO_COMPARAVEL" : "OBSERVADO") as Ponto["status"], nota: x.valor === null ? "Nenhuma capital entra na comparação neste período: os valores oficiais existem e ficam fora da mediana." : null, notaMaterial: false, participacao: null, elegivel: x.valor !== null, situacao: null, motivo: null, quebraSerie: x.quebraSerie }));
  const medianaPorAno = serieDaMediana(ix, m, o, regiao);
  const referenciaSerie = cap ? medianaPorAno.map((x) => ({ ano: x.ano, valor: x.valor, n: x.n, quebraSerie: x.quebraSerie })) : undefined;
  const anotacoes: Anotacao[] = m.id === "cobertura_aps" ? ANOTACOES_COBERTURA : POR_POPULACAO.includes(m.id) || (m.id === "icsap_taxa" && s.den === "obee") ? ANOTACOES_POPULACAO : [];
  const motivoQuebra =
    m.id === "cobertura_aps"
      ? "a população de referência do Ministério mudou de base"
      : POR_POPULACAO.includes(m.id) || (m.id === "icsap_taxa" && s.den === "obee")
        ? "a base da população do denominador mudou entre os anos"
        : "o perímetro do valor oficial é diferente entre os anos";
  const fraseSerie = fraseEvolucao(
    pontosSerie.map((p) => ({ ano: p.ano, valor: p.valor, elegivel: p.elegivel, quebraSerie: p.quebraSerie })),
    m,
    cap ? `${cap.nome} (${cap.uf})` : "Na mediana das capitais",
    motivoQuebra,
  );
  const comValorSerie = medianaPorAno.filter((x) => x.valor !== null);
  const conjuntoVaria = !cap && comValorSerie.length > 1 && new Set(comValorSerie.map((x) => x.n)).size > 1;

  const zeros = c.incluidas.filter((i) => i.valor === 0).map((i) => `${i.cap.nome} (${i.cap.uf})`);
  const notaZero = zeros.length ? `Valor zero observado em ${zeros.length === 1 ? "1 capital" : `${zeros.length} capitais`}: ${zeros.join(", ")}. A fonte informa zero, e não ausência de dado.` : null;

  const exportar = () => {
    if (s.vis === "evolucao") {
      const linhas = linhasCsvSerie(ix, m, o, cap, regiao, (a) => ROTULO_PERIODO[m.periodo](a));
      baixar(`saude_${m.id}_serie_${cap ? cap.id : regiao ? `mediana_${regiao}` : "mediana"}.csv`, csv(CABECALHO_CSV_SERIE, linhas));
    } else {
      baixar(`saude_${m.id}_${ano}.csv`, csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(ix, m, ano, o, c, periodo)));
    }
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
  const tituloMetodos = hrefSaude(CAMINHO_METODOS) + "#perimetros";

  return (
    <div>
      <section aria-labelledby="titulo-tema" className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <p className="rotulo text-mineral">Saúde nas capitais</p>
          <h1 id="titulo-tema" className="mt-2 font-serif text-[2.1rem] leading-[1.08] tracking-tight text-obee-tinta md:text-[2.6rem]">
            {TITULO_TEMA[tema].titulo}
          </h1>
          <p className="mt-3 text-[1.0625rem] leading-snug text-obee-tinta">{TITULO_TEMA[tema].pergunta}</p>
          <EtiquetaDePerimetro tema={tema} href={tituloMetodos} />
          <RecorteRecolhivel id="recorte" resumo={resumoDoRecorte({ medida: m.id, periodo: m.periodo === "dezembro" ? `dez. ${ano}` : String(ano), real: m.moeda && s.moeda === "real", denominadorIbge: m.denominador && s.den === "obee", capital: cap ? `${cap.nome} (${cap.uf})` : null, regiao: grupo === "regiao" && cap ? dados.regioes[cap.regiao] : null, ordem: s.vis !== "evolucao" && s.ord !== "alfabetica" ? (s.ord === "valor_desc" ? "do maior ao menor" : "do menor ao maior") : null })}>
            <Selecao
              id="med"
              rotulo="Medida"
              ajuda="O gráfico, a tabela e a evolução mostram a medida escolhida."
              ajudaNoCelular={false}
              valor={s.med}
              opcoes={medidasOpcoes}
              aoMudar={(v) => {
                const nova = MEDIDAS_SAUDE[v as MedidaSaudeId];
                // o exercício escolhido é mantido quando a nova medida também o tem
                definir({ med: v as MedidaSaudeId, ano: anosDaMedida(ix, nova, o).includes(ano) ? ano : 0 });
              }}
            />
            <div className="grid grid-cols-2 gap-4">
              <Selecao id="ano" rotulo={LEGENDA_PERIODO[m.periodo]} ajuda="Período do dado." ajudaNoCelular={false} valor={String(ano)} opcoes={anos.map((a) => ({ v: String(a), t: m.periodo === "dezembro" ? `dez. ${a}` : String(a) }))} aoMudar={(v) => definir({ ano: Number(v) })} />
              <Selecao id="cap" rotulo="Capital" ajuda="Opcional: destaca uma capital." ajudaNoCelular={false} valor={s.cap} opcoes={[{ v: "", t: "Nenhuma" }, ...dados.capitais.map((x) => ({ v: x.id, t: `${x.nome} (${x.uf})` }))]} aoMudar={(v) => definir({ cap: v, grp: "todas" })} />
            </div>
            {m.moeda && (
              <div>
                <Alternancia rotulo="Valores" valor={s.moeda} opcoes={[{ v: "nominal", t: "Nominais" }, { v: "real", t: "Reais de 2025" }]} aoMudar={(v) => definir({ moeda: v })} />
                <AjudaMoeda />
              </div>
            )}
            {m.denominador && (
              <div>
                <Alternancia rotulo="População do denominador" valor={s.den} opcoes={[{ v: "ripsa", t: "Ministério da Saúde" }, { v: "obee", t: "IBGE do exercício" }]} aoMudar={(v) => definir({ den: v })} />
                <AjudaDenominador iguais={m.id === "icsap_taxa" ? denominadoresIcsapIguais(ix, ano).iguais : 0} total={m.id === "icsap_taxa" ? denominadoresIcsapIguais(ix, ano).total : 0} ano={ano} />
              </div>
            )}
            {cap && <Alternancia rotulo="Grupo de comparação" valor={grupo} opcoes={[{ v: "todas", t: "Todas as capitais" }, { v: "regiao", t: `Região ${dados.regioes[cap.regiao]}` }]} aoMudar={(v) => definir({ grp: v })} />}
            {s.vis !== "evolucao" && c.incluidas.length > 0 && (
              <div>
                <Alternancia<Ordem> rotulo="Ordem das capitais" valor={s.ord} opcoes={ORDENS} aoMudar={(v) => definir({ ord: v })} />
                <p className="mt-1 text-xs text-carvao-muted">Ordenar por valor é recurso de leitura, não classificação.</p>
              </div>
            )}
          </RecorteRecolhivel>
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Alternancia<Visao> rotulo="Visão" valor={s.vis} opcoes={[{ v: "grafico", t: "Distribuição" }, { v: "tabela", t: "Tabela" }, { v: "evolucao", t: "Evolução" }]} aoMudar={(v) => definir({ vis: v })} rotuloVisivel={false} />
            <button type="button" onClick={exportar} className="rotulo hidden min-h-[44px] items-center border border-linha bg-superficie px-3 text-obee-dark hover:border-obee lg:inline-flex">
              {s.vis === "evolucao" ? "Baixar CSV da série" : "Baixar CSV do recorte"}
            </button>
          </div>
          <h2 className="mt-4 font-serif text-[1.1rem] leading-snug text-obee-tinta sm:text-[1.3rem] md:text-[1.45rem]">{s.vis === "evolucao" ? fraseSerie : titulo}</h2>
          <p className="mt-1.5 text-[0.8125rem] leading-snug text-carvao-muted">{s.vis === "evolucao" ? `${[m.rotulo, unidadeNoTitulo].filter(Boolean).join(" · ")} · série de ${anos[0]} a ${anos[anos.length - 1]} · ${cap ? `${cap.nome} (${cap.uf})` : "mediana das capitais"}` : subtitulo}</p>
          <div className="flex flex-col">
          {aviso && (
            <p className="order-1 mt-2 text-sm leading-snug text-obee-tinta lg:hidden">
              Este período tem ressalva de base: <a href="#aviso-do-periodo" className="inline-block py-1 text-obee-dark underline underline-offset-4">ver o aviso abaixo do gráfico</a>.
            </p>
          )}
          <div className="order-3 lg:order-none"><AvisoDoPeriodo texto={aviso} /></div>
          {s.vis !== "evolucao" && notaZero && <p className="mt-2 max-w-prose2 text-sm leading-snug text-obee-tinta">{notaZero}</p>}
          {s.vis !== "evolucao" && c.excluidas.length > 0 && (
            <p className="mt-2 max-w-prose2 text-sm leading-snug text-obee-tinta">
              {c.excluidas.length <= 4 ? `Fora da comparação neste recorte: ${c.excluidas.map((x) => `${x.cap.nome} (${x.cap.uf})`).join(", ")}.` : `${c.excluidas.length} capitais fora da comparação neste recorte.`}{" "}
              <a href="#fora-da-comparacao" className="inline-block py-1 text-obee-dark underline underline-offset-4">Motivo e detalhe abaixo</a>.
            </p>
          )}
          {fraseCap && s.vis !== "evolucao" && <p className="mt-2 text-sm leading-snug text-obee-tinta">{fraseCap}</p>}

          <div className="order-2 mt-4 lg:order-none">
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
                <p className="max-w-prose2 border border-dashed border-mineral bg-papel px-4 py-3 text-sm leading-snug text-obee-tinta" role="note">
                  Nenhuma capital entra na comparação deste período.{" "}
                  {aviso ?? "Os motivos estão abaixo, agrupados."}
                </p>
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
          </div>
          <button type="button" onClick={exportar} className="rotulo mt-3 inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-obee-dark hover:border-obee lg:hidden">
            {s.vis === "evolucao" ? "Baixar CSV da série" : "Baixar CSV do recorte"}
          </button>
          {pt && cap && <Ressalva ponto={pt} />}
          {pt && pt.valor === null && cap && <SemValor ponto={pt} />}
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <div className="border-l-2 border-obee pl-3 text-sm leading-snug text-obee-tinta">
            <p><Siglas texto={m.definicao} /></p>
            <p className="mt-2 text-carvao-muted"><Siglas texto={m.naoE} /></p>
            <div className="mt-1"><SobreEsteDado f={ficha} ctx={contextos[ficha.id]} /></div>
          </div>
          {tema === "resultados" && (
            <p className="mt-3 border-l-2 border-linha pl-3 text-sm leading-snug text-obee-tinta">
              <span className="font-semibold">Atendimento:</span> nenhuma série de produção da atenção primária é publicada, porque a fonte oficial não oferece série municipal extraível e verificável. O que existe aqui é resultado por residência e contexto. Motivo e lacunas em{" "}
              <a href="#res-fora" className="inline-block py-1 text-obee-dark underline underline-offset-4">Atendimento: o que não está nesta página</a>.
            </p>
          )}
          <GlossarioDaPagina tema={tema} />
          <p className="mt-4 text-sm">
            <Link href={hrefSaude(CAMINHO_COMPARAR, { med: m.id, ano, ...(cap ? { cap: cap.id } : {}) })} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
              Comparar capitais nesta medida <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      <div className="mt-10 grid gap-10 border-t border-linha pt-8 lg:grid-cols-2">
        <div className="space-y-6">
          {(() => {
            const notas = notasMateriais(c);
            return notas.length ? <NotasMateriais notas={notas} n={c.incluidas.length} /> : null;
          })()}
          <ForaDaComparacaoSaude itens={c.excluidas.map((x) => ({ nome: x.cap.nome, uf: x.cap.uf, status: x.comValor ? "Fora da comparação" : ROTULO_ESTADO[x.status], motivo: x.motivo }))} />
        </div>
        <div className="space-y-8">
          {c.ref && <ReferenciasGrupoSaude r={c.ref} m={m} nomeGrupo={nomeGrupo} textoRazao={textoRazao} />}
          <ReferenciasExternasSaude itens={externas} m={m} valorCapital={pt?.valor ?? null} />
          {m.id === "asps_pct" && cap && pt?.valor !== null && pt?.valor !== undefined && (
            <p className="max-w-prose2 text-sm text-obee-tinta">
              Distância do mínimo de {inteiro(15)}%: {pt.valor >= 15 ? "+" : "−"}{String(Math.abs(pt.valor - 15).toFixed(2)).replace(".", ",")} {Math.abs(Math.abs(pt.valor - 15) - 1) < 0.005 ? "ponto percentual" : "pontos percentuais"} (referência normativa, não meta; a lei orgânica do município pode fixar mínimo maior, informado no demonstrativo).
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
