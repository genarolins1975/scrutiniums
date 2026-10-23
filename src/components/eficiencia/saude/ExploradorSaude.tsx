"use client";

import { useEffect, useMemo } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ExportacaoComConta } from "@/components/acesso/ExportacaoComConta";
import { Controles, FaixaNumeros, FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, NumeroIndicador, type NumeroProps } from "@/components/painel";
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
import { CAMINHO_COMPARAR, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import { provenienciaDaFicha } from "@/lib/eficiencia/proveniencia";
import { CASAS } from "@/lib/eficiencia/saude/molde";
import type { ContextoFicha } from "../FichaConteudo";
import { Siglas } from "../Siglas";
import { SobreDadoSaude as SobreEsteDado } from "./SobreDadoSaude";
import { Alternancia, Selecao } from "../controles";
import { NotasMateriais, Ressalva, SemValor } from "../estados";
import { AjudaDenominador, AjudaMoeda, AvisoDoPeriodo, ForaDaComparacaoSaude } from "./AvisosSaude";
import { DetalheGastos, DetalheRede, DetalheResultados } from "./DetalhesSaude";
import { ReferenciasExternasSaude, ReferenciasGrupoSaude } from "./ReferenciasSaude";
import Link from "next/link";

/**
 * Exploração de um tema (Gastos, Rede e atenção primária, Atendimento e resultados), no molde de painel (Iniciativa 1 do parecer de UX de
 * 23/10/2026). A página do tema monta a abertura no servidor; aqui ficam as peças que seguem o recorte da URL (medida, ano, capital,
 * base, grupo e ordem): a faixa de números, os controles logo antes das figuras, a distribuição das capitais, a evolução da medida e os
 * blocos de detalhe do tema. As peças são ilhas separadas que leem o mesmo recorte (useEstadoUrl avisa as outras a cada mudança).
 */

function esquema(ids: string[], tema: TemaSaude) {
  const def = TEMAS_SAUDE[tema];
  return {
    cap: campo(tiposUrl.opcao(["", ...ids]), ""),
    med: campo(tiposUrl.opcao(def.medidas), def.medidaInicial),
    ano: campo(tiposUrl.inteiro({ min: 0, max: 2100 }), 0),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    den: campo(tiposUrl.opcao(["ripsa", "obee"] as const), "ripsa" as "ripsa" | "obee"),
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

const ANOTACOES_COBERTURA = [
  { ano: 2021, texto: "dezembro de 2021 segue regra anterior de equipes e cadastro e não reproduz a fórmula da Nota Técnica nº 2/2025." },
  { ano: 2022, texto: "a população de referência de dezembro de 2022 é anterior ao Censo 2022; a de dezembro de 2023 é a do Censo." },
  { ano: 2025, texto: "a população de referência de dezembro de 2025 é a estimativa de 2024, posterior ao Censo; dezembro de 2023 e de 2024 usam a mesma população do Censo 2022." },
];
const ANOTACOES_POPULACAO = [
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

/** O recorte em vigor e tudo o que dele se calcula: a mesma regra para faixa, gráficos, tabelas e CSV. */
function useRecorteSaude(tema: TemaSaude, dados: DadosSaude) {
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
  const ficha = dados.fichas.find((f) => f.id === m.indicador)!;
  const periodo = ROTULO_PERIODO[m.periodo](ano);
  const externas = ix.externas(m.indicador, comp, ano);
  const externaGrafico = externas.find((e) => e.comparabilidade === "direta") ?? null;
  return { ix, s, definir, cap, m, o, comp, anos, ano, grupo, nomeGrupo, c, pt, ficha, periodo, externas, externaGrafico, regiao: grupo === "regiao" && cap ? cap.regiao : null };
}

const formatoDe = (unidade: string): "reais" | "percentual" | "decimal" => (unidade.startsWith("R$") ? "reais" : unidade.startsWith("%") ? "percentual" : "decimal");

/** A faixa de números do tema: a mediana do grupo, a capital escolhida (ou quantas capitais entram) e a referência externa direta. */
export function FaixaTemaSaude({ tema, dados }: { tema: TemaSaude; dados: DadosSaude }) {
  const { cap, m, s, c, pt, ficha, periodo, nomeGrupo, externaGrafico, ano } = useRecorteSaude(tema, dados);
  const unidade = m.unidade(s.moeda);
  const formato = formatoDe(unidade);
  const fonte = dados.fontes[ficha.fontes[0]]?.nome ?? ficha.fontes[0];
  const numeros: NumeroProps[] = [
    c.ref && c.ref.mediana !== null
      ? { rotulo: `${m.rotulo}: mediana`, valor: c.ref.mediana, valorTexto: m.formata(c.ref.mediana), formato, unidade, periodo, recorte: nomeGrupo, fonte, natureza: "CALCULADO", nota: `${c.ref.n} de ${c.noGrupo} capitais na comparação.` }
      : { rotulo: `${m.rotulo}: mediana`, valor: null, motivoAusencia: "Nenhuma capital entra na comparação deste período.", unidade, periodo, recorte: nomeGrupo, fonte, natureza: "CALCULADO" },
    cap
      ? pt && pt.valor !== null
        ? { rotulo: `${cap.nome} (${cap.uf})`, valor: pt.valor, valorTexto: m.formata(pt.valor), formato, unidade, periodo, fonte, natureza: ficha.natureza, nota: pt.elegivel ? undefined : "Valor oficial fora da comparação entre capitais; o motivo está abaixo do gráfico." }
        : { rotulo: `${cap.nome} (${cap.uf})`, valor: null, motivoAusencia: pt?.nota ?? "Sem valor para este recorte.", unidade, periodo, fonte, natureza: ficha.natureza }
      : { rotulo: "Capitais na comparação", valor: c.incluidas.length, formato: "inteiro", unidade: `de ${c.noGrupo} capitais`, periodo, fonte, natureza: "CALCULADO", nota: c.excluidas.length ? `${c.excluidas.length} fora da comparação neste recorte.` : undefined },
    ...(externaGrafico
      ? [
          {
            rotulo: externaGrafico.tipo === "normativa" ? "Mínimo legal" : externaGrafico.rotulo,
            valor: externaGrafico.valor,
            valorTexto: externaGrafico.tipo === "normativa" ? `${inteiro(externaGrafico.valor)}%` : m.formata(externaGrafico.valor),
            formato,
            unidade,
            periodo: externaGrafico.ano ? String(externaGrafico.ano) : String(ano),
            fonte: externaGrafico.fonte,
            natureza: externaGrafico.origem === "calculado_obee" ? ("CALCULADO" as const) : ("OBSERVADO" as const),
            nota: externaGrafico.tipo === "normativa" ? "Referência normativa, não meta." : externaGrafico.classe,
          } satisfies NumeroProps,
        ]
      : []),
  ];
  return (
    <FaixaNumeros nota="Os números seguem o recorte escolhido logo abaixo: medida, período, capital e grupo de comparação." idioma="pt">
      {numeros.map((n, i) => (
        <NumeroIndicador key={`${n.rotulo}-${i}`} {...n} tamanho={i === 0 ? "g" : "m"} idioma="pt" />
      ))}
    </FaixaNumeros>
  );
}

/** O caminho para comparar capitais na mesma medida, com o recorte da página. */
export function CaminhoCompararSaude({ tema, dados }: { tema: TemaSaude; dados: DadosSaude }) {
  const { m, ano, cap } = useRecorteSaude(tema, dados);
  return (
    <p className="mt-6">
      <Link href={hrefSaude(CAMINHO_COMPARAR, { med: m.id, ano, ...(cap ? { cap: cap.id } : {}) })} className="inline-flex min-h-[44px] items-center text-[0.9375rem] text-obee-dark underline underline-offset-4">
        Comparar capitais nesta medida <span aria-hidden="true" className="ml-1">→</span>
      </Link>
    </p>
  );
}

export function ExploradorSaude({ tema, dados, contextos }: { tema: TemaSaude; dados: DadosSaude; contextos: Record<string, ContextoFicha> }) {
  const def = TEMAS_SAUDE[tema];
  const r = useRecorteSaude(tema, dados);
  const { ix, s, definir, cap, m, o, anos, ano, grupo, nomeGrupo, c, pt, ficha, periodo, externas, externaGrafico, regiao } = r;
  // um ano que a medida não tem (link antigo, ICSAP em 2025) é corrigido na própria URL, para a página e o link dizerem a mesma coisa
  useEffect(() => {
    if (s.ano && !anos.includes(s.ano)) definir({ ano: 0 });
  }, [s.ano, anos, definir]);
  const incluidaCap = cap ? c.incluidas.find((i) => i.cap.id === cap.id) : undefined;
  const aviso = avisoDoPeriodo(m, ano, o, dados);

  const itensFrase = c.incluidas.map((i) => ({ nome: i.cap.nome, uf: i.cap.uf, valor: i.valor }));
  const titulo = fraseAmplitude(itensFrase, m, ano, c.ref?.mediana ?? null);
  const fraseCap = cap ? fraseCapital(cap.nome, cap.uf, pt?.valor ?? null, c.ref?.mediana ?? null, c.ref?.n ?? 0, m, !!pt && pt.valor !== null && !incluidaCap) : null;
  const unidadeNoTitulo = /por 10 mil|por 100 mil/.test(m.rotulo) ? null : m.unidade(s.moeda); // o rótulo das taxas já traz a unidade
  const subtitulo = [m.rotulo, unidadeNoTitulo, periodo, `capitais estaduais${grupo === "regiao" && cap ? `, região ${dados.regioes[cap.regiao]}` : ""}`, m.universo].filter(Boolean).join(" · ");
  const externaNaDistribuicao = externaGrafico ? { rotulo: `${externaGrafico.tipo === "normativa" ? "Mínimo legal" : externaGrafico.rotulo.split(" (")[0]} (${externaGrafico.tipo === "normativa" ? "referência normativa, não meta" : externaGrafico.origem === "calculado_obee" ? "calculado pelo OBEE" : "oficial"})`, valor: externaGrafico.valor } : null;

  const pontosSerie = cap
    ? serie(ix, m, cap.cod, o)
    : serieDaMediana(ix, m, o, regiao).map((x) => ({ ano: x.ano, valor: x.valor, status: (x.valor === null ? "NAO_COMPARAVEL" : "OBSERVADO") as Ponto["status"], nota: x.valor === null ? "Nenhuma capital entra na comparação neste período: os valores oficiais existem e ficam fora da mediana." : null, notaMaterial: false, participacao: null, elegivel: x.valor !== null, situacao: null, motivo: null, quebraSerie: x.quebraSerie }));
  const medianaPorAno = serieDaMediana(ix, m, o, regiao);
  const anotacoes = m.id === "cobertura_aps" ? ANOTACOES_COBERTURA : POR_POPULACAO.includes(m.id) || (m.id === "icsap_taxa" && s.den === "obee") ? ANOTACOES_POPULACAO : [];
  const motivoQuebra =
    m.id === "cobertura_aps"
      ? "a população de referência do Ministério mudou de base"
      : POR_POPULACAO.includes(m.id) || (m.id === "icsap_taxa" && s.den === "obee")
        ? "a base da população do denominador mudou entre os anos"
        : "o perímetro do valor oficial é diferente entre os anos";
  const nomeSerie = cap ? `${cap.nome} (${cap.uf})` : "Mediana das capitais";
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

  const exportarComparacao = () => baixar(`saude_${m.id}_${ano}.csv`, csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(ix, m, ano, o, c, periodo)));
  const exportarSerie = () => {
    const linhas = linhasCsvSerie(ix, m, o, cap, regiao, (a) => ROTULO_PERIODO[m.periodo](a));
    baixar(`saude_${m.id}_serie_${cap ? cap.id : regiao ? `mediana_${regiao}` : "mediana"}.csv`, csv(CABECALHO_CSV_SERIE, linhas));
  };

  const temRazao = m.razaoAgregada && ficha.numerador && ficha.denominador;
  const textoRazao =
    c.ref && c.ref.razaoAgregada !== null && temRazao ? (
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
  const proveniencia = provenienciaDaFicha(ficha, dados.fontes, { inicio: String(anos[0]), fim: String(ano) });
  const casas = CASAS[m.id] ?? 1;
  const unidade = m.unidade(s.moeda);
  const botao = "rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-obee-dark hover:border-obee";
  const resumo = resumoDoRecorte({
    medida: m.id,
    periodo: m.periodo === "dezembro" ? `dez. ${ano}` : String(ano),
    real: m.moeda && s.moeda === "real",
    denominadorIbge: m.denominador && s.den === "obee",
    capital: cap ? `${cap.nome} (${cap.uf})` : null,
    regiao: grupo === "regiao" && cap ? dados.regioes[cap.regiao] : null,
    ordem: s.ord !== "alfabetica" ? (s.ord === "valor_desc" ? "do maior ao menor" : "do menor ao maior") : null,
  });
  const padrao = !s.cap && s.med === def.medidaInicial && !s.ano && s.moeda === "nominal" && s.den === "ripsa" && s.ord === "alfabetica" && s.grp === "todas";

  return (
    <>
      <Controles rotulo="Recorte da comparação" resumo={resumo} limpar={padrao ? undefined : { href: hrefSaude(`/${tema === "gastos" ? "gastos" : tema === "rede" ? "rede-e-atencao-primaria" : "atendimento-e-resultados"}`) }} idioma="pt">
        <div className="min-w-[16rem] flex-1">
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
        </div>
        <div className="grid min-w-[16rem] flex-1 grid-cols-2 gap-4">
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
        {c.incluidas.length > 0 && (
          <div>
            <Alternancia<Ordem> rotulo="Ordem das capitais" valor={s.ord} opcoes={ORDENS} aoMudar={(v) => definir({ ord: v })} />
            <p className="mt-1 text-xs text-carvao-muted">Ordenar por valor é recurso de leitura, não classificação.</p>
          </div>
        )}
      </Controles>

      <FiguraAnalitica
        id="distribuicao"
        idioma="pt"
        pergunta={m.pergunta}
        subtitulo={subtitulo}
        natureza={ficha.natureza}
        proveniencia={proveniencia}
        leitura={c.incluidas.length > 0 ? <LeituraGuiada>{titulo}</LeituraGuiada> : undefined}
        tabela={{ colunas: ["Capital", "Valor", "Numerador ÷ denominador", "Situação"], linhas: tabelaLinhas, titulo: `${m.rotulo}, ${periodo}` }}
        comoInterpretar={<Siglas texto={m.definicao} />}
        naoConcluir={<Siglas texto={m.naoE} />}
        complemento={
          <>
            <AvisoDoPeriodo texto={aviso} />
            {notaZero && <p className="t-meta max-w-prose2 text-carvao">{notaZero}</p>}
            {c.excluidas.length > 0 && (
              <p className="t-meta max-w-prose2 text-carvao">
                {c.excluidas.length <= 4 ? `Fora da comparação neste recorte: ${c.excluidas.map((x) => `${x.cap.nome} (${x.cap.uf})`).join(", ")}.` : `${c.excluidas.length} capitais fora da comparação neste recorte.`}{" "}
                <a href="#fora-da-comparacao" className="inline-block py-1 text-obee-dark underline underline-offset-4">
                  Motivo e detalhe abaixo
                </a>
                .
              </p>
            )}
            {fraseCap && <p className="t-corpo max-w-prose2 text-carvao">{fraseCap}</p>}
            {pt && cap && <Ressalva ponto={pt} />}
            {pt && pt.valor === null && cap && <SemValor ponto={pt} />}
            {tema === "resultados" && (
              <p className="t-meta max-w-prose2 text-carvao">
                <span className="font-semibold">Atendimento:</span> nenhuma série de produção da atenção primária é publicada, porque a fonte oficial não oferece série municipal extraível e verificável. O que existe aqui é resultado por residência e contexto. Motivo e lacunas em{" "}
                <a href="#res-fora" className="inline-block py-1 text-obee-dark underline underline-offset-4">
                  Atendimento: o que não está nesta página
                </a>
                .
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-5">
              <SobreEsteDado f={ficha} ctx={contextos[ficha.id]} rotulo="Ficha do indicador" />
              <ExportacaoComConta rotulo="Baixar CSV do recorte">
                <button type="button" onClick={exportarComparacao} className={botao}>
                  Baixar CSV do recorte
                </button>
              </ExportacaoComConta>
            </div>
          </>
        }
        depois={
          <div className="grid gap-10 lg:grid-cols-2">
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
                  Distância do mínimo de {inteiro(15)}%: {pt.valor >= 15 ? "+" : "−"}
                  {String(Math.abs(pt.valor - 15).toFixed(2)).replace(".", ",")} {Math.abs(Math.abs(pt.valor - 15) - 1) < 0.005 ? "ponto percentual" : "pontos percentuais"} (referência normativa, não meta; a lei orgânica do município pode fixar mínimo maior, informado no demonstrativo).
                </p>
              )}
            </div>
          </div>
        }
      >
        {c.incluidas.length > 0 ? (
          <GraficoBarras
            titulo={`${m.rotulo}, ${periodo}`}
            series={[{ id: "valor", nome: m.rotuloCurto, pontos: c.incluidas.map((i) => ({ x: i.cap.id, rotulo: `${i.cap.nome} (${i.cap.uf})`, y: i.valor })) }]}
            eixoY={{ unidade, zero: true, casas }}
            orientacao="horizontal"
            alturaCategoria={32}
            rotulosValor
            rotulosSaoNomes
            selecionado={cap?.id ?? null}
            referencias={[...(c.ref?.mediana != null ? [{ valor: c.ref.mediana, rotulo: `Mediana das ${nomeGrupo}` }] : []), ...(externaNaDistribuicao ? [externaNaDistribuicao] : [])]}
          />
        ) : (
          <p data-grafico="sem-comparacao" className="t-meta max-w-prose2 border border-dashed border-mineral px-4 py-3 text-carvao" role="note">
            Nenhuma capital entra na comparação deste período. {aviso ?? "Os motivos estão abaixo, agrupados."}
          </p>
        )}
      </FiguraAnalitica>

      <FiguraAnalitica
        id="evolucao"
        idioma="pt"
        pergunta={`Como ${cap ? `${cap.nome} (${cap.uf})` : "a mediana das capitais"} evoluiu nesta medida?`}
        subtitulo={`${[m.rotulo, unidadeNoTitulo].filter(Boolean).join(" · ")} · série de ${anos[0]} a ${anos[anos.length - 1]} · ${cap ? `${cap.nome} (${cap.uf})` : "mediana das capitais"}`}
        natureza={cap ? ficha.natureza : "CALCULADO"}
        proveniencia={proveniencia}
        leitura={<LeituraGuiada>{fraseSerie}</LeituraGuiada>}
        tabela={{
          colunas: ["Período", nomeSerie, ...(cap ? ["Mediana das capitais"] : []), "Capitais na mediana"],
          linhas: pontosSerie.map((p) => {
            const med = medianaPorAno.find((x) => x.ano === p.ano);
            return [ROTULO_PERIODO[m.periodo](p.ano), p.valor === null ? null : m.formata(p.valor), ...(cap ? [med?.valor == null ? null : m.formata(med.valor)] : []), med ? med.n : null];
          }),
          titulo: `${m.rotulo}: ${nomeSerie}, série`,
        }}
        comoInterpretar={
          <>
            Cada ponto é o valor do período, sem ponte entre anos sem valor.
            {anotacoes.length > 0 && ` Mudança de base marcada no gráfico: ${anotacoes.map((a) => `${a.ano}, ${a.texto}`).join(" ")}`}
            {conjuntoVaria && ` Cada mediana usa as capitais com valor comparável no ano (${comValorSerie.map((x) => `${x.n} em ${x.ano}`).join(", ")}): o conjunto muda, então a variação não é a de um grupo constante.`}
          </>
        }
        naoConcluir={`A variação entre anos descreve o valor registrado; quando ${motivoQuebra}, ela não mede mudança do serviço, e nenhuma variação identifica a causa.`}
        complemento={
          <ExportacaoComConta rotulo="Baixar CSV da série">
            <button type="button" onClick={exportarSerie} className={botao}>
              Baixar CSV da série
            </button>
          </ExportacaoComConta>
        }
      >
        <GraficoLinhas
          titulo={`${m.rotulo}: ${nomeSerie}`}
          series={[
            { id: "valor", nome: nomeSerie, pontos: pontosSerie.map((p) => ({ x: String(p.ano), y: p.valor })) },
            ...(cap ? [{ id: "mediana", nome: "Mediana das capitais", pontos: medianaPorAno.map((x) => ({ x: String(x.ano), y: x.valor })) }] : []),
          ]}
          eixoY={{ unidade, zero: m.zero, casas }}
          formatoX="texto"
          marcos={anotacoes.filter((a) => anos.includes(a.ano)).map((a) => ({ x: String(a.ano), rotulo: "mudança de base" }))}
          altura={260}
        />
      </FiguraAnalitica>

      {tema === "gastos" && <DetalheGastos ix={ix} cap={cap} ano={m.periodo === "exercicio" ? ano : anosDaMedida(ix, MEDIDAS_SAUDE.despesa, o).slice(-1)[0]} contextos={contextos} />}
      {tema === "rede" && <DetalheRede ix={ix} cap={cap} ano={ano} contextos={contextos} />}
      {tema === "resultados" && <DetalheResultados ix={ix} cap={cap} ano={m.periodo === "processamento" ? ano : anos[anos.length - 1]} contextos={contextos} />}
    </>
  );
}
