"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { Controles, FaixaNumeros, FiguraAnalitica, LeituraGuiada, NumeroIndicador, type NumeroProps } from "@/components/painel";
import {
  CABECALHO_CSV_COMPARACAO,
  CABECALHO_CSV_SERIE,
  linhasCsvSerie,
  dicionarioExportacoes,
  Indice,
  MEDIDA,
  ROTULO_STATUS,
  anosDaMedida,
  comparar,
  componente,
  csv,
  ehDespesa,
  notasMateriais,
  perimetroIntra,
  referenciaExternaDoGrafico,
  regioesDoPainel,
  serieDaMediana,
  textoPerimetroIntra,
  etapaDaMedida,
  formata,
  formataEixo,
  internacionaisDa,
  linhasCsvComparacao,
  nacionalCalculada,
  nomeEtapa,
  referenciasExternas,
  rotuloPeriodoMedida,
  serie,
  unidade,
  type DadosPainel,
  type Disciplina,
  type Grupo,
  type MedidaId,
  type Moeda,
  type Ordem,
  type Ponto,
} from "@/lib/eficiencia/consulta";
import { fraseAmplitude, fraseCapital, fraseCobertura, fraseEvolucao } from "@/lib/eficiencia/frases";
import { inteiro } from "@/lib/eficiencia/formato";
import { provenienciaDaFicha, type FonteFicha } from "@/lib/eficiencia/proveniencia";
import type { EtapaId, IndicadorId } from "@/lib/eficiencia/tipos";
import { avisoDoGrupo, href, CAMINHO_COMPARAR, NAO_MOSTRA, DEFINICAO_CURTA, DEFINICAO_TEMA, SEM_NACIONAL, universoDaMedida, anoValido, etapaEfetiva, temEtapa, type Tema } from "@/lib/eficiencia/visao";
import { ComposicaoDespesa, MatriculasPorEtapa, PonteDaRazao } from "./DetalhesMedida";
import { DistribuicaoCapitais } from "./DistribuicaoCapitais";
import type { ContextoFicha } from "./FichaConteudo";
import { ContextoInternacionalBloco, ReferenciaNacionalCalculadaBloco, ReferenciasDoGrupo, ReferenciasNacionais, SemReferencia } from "./ReferenciasPainel";
import { Siglas } from "./Siglas";
import { SobreEsteDado } from "./SobreEsteDado";
import { Alternancia, Selecao } from "./controles";
import { ForaDaComparacao, NotasMateriais, ForaDoEscopo, Ressalva, SemValor } from "./estados";
import { MiniSerie, type Anotacao } from "./graficos";
import { Recolhido } from "@/components/observatorios/Recolhido";

/**
 * Exploração de um tema (gastos, atendimento ou resultados) no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). A página
 * do tema (PaginaTemaEducacao) monta a abertura no servidor; aqui ficam as ilhas de cliente que seguem o recorte da URL (capital, medida,
 * ano, etapa, valores, disciplina, grupo, ordem e escala): a capital na abertura, a família de medidas na faixa de números, o caminho para
 * comparar, os controles logo antes das figuras, a distribuição das capitais, a evolução, o detalhe da medida e as referências. As ilhas
 * leem o mesmo recorte (useEstadoUrl avisa as outras a cada mudança) e a base vem uma vez só, pelo ProvedorEducacao.
 *
 * Antes, uma alternância "Forma de ver" mostrava gráfico, tabela, evolução ou detalhe, um por vez; no molde, as quatro leituras ficam na
 * página ao mesmo tempo: a tabela é a equivalente da distribuição, e a evolução e o detalhe são figuras próprias. O parâmetro ?vis= dos
 * links antigos continua aceito e é ignorado.
 */

const ETAPAS: EtapaId[] = ["total", "creche", "pre_escola", "anos_iniciais", "anos_finais", "ensino_medio", "eja", "profissional"];
const PANDEMIA_IDEB: Anotacao = { ano: 2021, texto: "edição afetada pela pandemia de covid-19 (nota informativa do INEP sobre o Ideb 2021)." };
const PANDEMIA_APROVACAO: Anotacao = { ano: 2021, texto: "ano letivo afetado pela pandemia de covid-19, com regras excepcionais de avaliação em muitas redes." };

function esquema(ids: string[], tema: Tema) {
  const def = DEFINICAO_TEMA[tema];
  return {
    cap: campo(tiposUrl.opcao(["", ...ids]), ""),
    med: campo(tiposUrl.opcao(def.medidas), def.medidaInicial),
    ano: campo(tiposUrl.inteiro({ min: 0, max: 2100 }), 0),
    etapa: campo(tiposUrl.opcao(ETAPAS), def.etapaInicial),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    disc: campo(tiposUrl.opcao(["matematica", "portugues"] as const), "matematica" as Disciplina),
    // links antigos com ?vis= continuam válidos: a forma de ver não muda mais nada, porque as leituras ficam todas na página
    vis: campo(tiposUrl.opcao(["grafico", "tabela", "evolucao", "detalhe"] as const), "grafico" as "grafico" | "tabela" | "evolucao" | "detalhe"),
    ord: campo(tiposUrl.opcao(["alfabetica", "valor", "valor_desc"] as const), "alfabetica" as Ordem),
    eixo: campo(tiposUrl.opcao(["linear", "log"] as const), "linear" as "linear" | "log"),
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

const pontoVazio = (): Ponto => ({ valor: null, status: "AUSENTE_NA_COLETA", nota: null, notaMaterial: false, participacao: null, elegivel: false, situacao: null, motivo: null, quebraSerie: false });

const NOME_DETALHE: Partial<Record<MedidaId, string>> = { despesa: "Composição", despesa_mat: "Do total ao numerador", matriculas: "Por etapa" };

/**
 * A base do tema vai ao navegador uma vez só: a capital da abertura, a faixa, o caminho para comparar e o explorador são ilhas de cliente que
 * leem o mesmo recorte, e cada uma recebendo a base por prop a serializava de novo no HTML (lição do PR 1 do molde).
 */
const ContextoEducacao = createContext<DadosPainel | null>(null);

export function ProvedorEducacao({ dados, children }: { dados: DadosPainel; children: ReactNode }) {
  return <ContextoEducacao.Provider value={dados}>{children}</ContextoEducacao.Provider>;
}

export function useBaseEducacao(dados?: DadosPainel): DadosPainel {
  const doContexto = useContext(ContextoEducacao);
  const base = dados ?? doContexto;
  if (!base) throw new Error("Base da Educação ausente: passe `dados` ou use ProvedorEducacao.");
  return base;
}

/** O recorte em vigor e o que dele se calcula: a mesma regra para a capital, a faixa, os gráficos, as tabelas e os CSV. */
function useRecorteTema(tema: Tema, dados: DadosPainel) {
  const def = DEFINICAO_TEMA[tema];
  const ix = useMemo(() => new Indice(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const esq = useMemo(() => esquema(ids, tema), [ids, tema]);
  const [s, definir] = useEstadoUrl(esq);
  const cap = dados.capitais.find((c) => c.id === s.cap) ?? null;
  const medida = s.med;
  const etapa = etapaEfetiva(medida, s.etapa, def.etapaInicial);
  const anos = anosDaMedida(dados, medida);
  const ano = s.ano ? anoValido(dados, medida, s.ano) : anos[anos.length - 1];
  // o grupo regional é o da capital escolhida; sem capital, o grupo é sempre o das capitais estaduais
  const grupo: Grupo = cap && s.grp === "regiao" ? "regiao" : "todas";
  const grupoRef = grupo === "regiao" && cap ? cap.regiao : "todas";
  const nomeGrupo = grupo === "regiao" && cap ? `capitais da região ${dados.regioes[cap.regiao]}` : "capitais na comparação";
  return { def, ix, s, definir, cap, medida, etapa, anos, ano, grupo, grupoRef, nomeGrupo };
}

/** A capital opcional, na abertura: mostra o valor dela na faixa e a destaca nos gráficos (?cap=). */
export function SeletorCapitalTema({ tema, dados: dadosProp }: { tema: Tema; dados?: DadosPainel }) {
  const dados = useBaseEducacao(dadosProp);
  const { cap, definir } = useRecorteTema(tema, dados);
  return (
    <div className="max-w-sm">
      <Selecao
        id="cap"
        rotulo="Capital"
        ajuda="Opcional. Mostra o valor da capital ao lado do conjunto e a destaca nos gráficos."
        valor={cap?.id ?? ""}
        opcoes={[{ v: "", t: "Nenhuma: ver o conjunto" }, ...dados.capitais.map((c) => ({ v: c.id, t: `${c.nome} (${c.uf})` }))]}
        aoMudar={(v) => definir({ cap: v })}
      />
    </div>
  );
}

/**
 * A família de medidas do tema na faixa de números (antes, cartões que também escolhiam a medida): a mediana das capitais em cada medida,
 * ou o valor da capital escolhida com a mediana ao lado, no ano mais próximo do pedido. A escolha da medida passou para os controles.
 */
export function FaixaTemaEducacao({ tema, dados: dadosProp }: { tema: Tema; dados?: DadosPainel }) {
  const dados = useBaseEducacao(dadosProp);
  const { def, ix, s, cap, grupoRef } = useRecorteTema(tema, dados);
  const nomeCap = cap ? `${cap.nome} (${cap.uf})` : "";
  const numeros: NumeroProps[] = def.medidas.map((m) => {
    const mm = MEDIDA[m];
    const et = etapaEfetiva(m, s.etapa, def.etapaInicial);
    const an = s.ano ? anoValido(dados, m, s.ano) : (() => { const a = anosDaMedida(dados, m); return a[a.length - 1]; })();
    const kk = componente(m, s.moeda, s.disc);
    const ee = etapaDaMedida(m, et);
    const r = ix.referencia(mm.indicador, kk, ee, an, grupoRef);
    const p = cap ? ix.ponto(mm.indicador, cap.cod, an, ee, kk) : null;
    const ficha = dados.fichas.find((f) => f.id === mm.indicador);
    const fonte = ficha ? (dados.fontes[ficha.fontes[0]]?.instituicao ?? ficha.fontes[0]) : "OBEE";
    const formato = ehDespesa(m) ? ("reais" as const) : m === "aprovacao" ? ("percentual" as const) : ("decimal" as const);
    const base = { unidade: unidade(m, s.moeda), periodo: mm.anos === "ideb" ? `edição ${an}` : String(an), recorte: mm.etapas ? nomeEtapa(dados, et) : undefined, fonte, formato };
    const mediana = r?.mediana ?? null;
    if (cap) {
      const rotulo = `${DEFINICAO_CURTA[m].titulo} · ${nomeCap}`;
      const nota = (
        <>
          {p && p.valor !== null && !p.elegivel ? "Fora da comparação. " : ""}Mediana das capitais: {mediana !== null ? formata(m, mediana) : "sem valor"}. {DEFINICAO_CURTA[m].texto}
        </>
      );
      return p && p.valor !== null
        ? { ...base, rotulo, valor: p.valor, valorTexto: formata(m, p.valor), natureza: ficha?.natureza ?? "OBSERVADO", nota }
        : { ...base, rotulo, valor: null, motivoAusencia: `${ROTULO_STATUS[(p ?? pontoVazio()).status]}. ${p?.nota ?? "Sem valor para este recorte."}`, natureza: ficha?.natureza ?? "OBSERVADO", nota };
    }
    const rotulo = `${DEFINICAO_CURTA[m].titulo}: mediana das capitais`;
    const nota = (
      <>
        {r && r.minimo !== null && r.maximo !== null ? `Mediana de ${r.n} capitais · de ${formata(m, r.minimo)} a ${formata(m, r.maximo)}. ` : ""}
        {DEFINICAO_CURTA[m].texto}
      </>
    );
    return mediana !== null
      ? { ...base, rotulo, valor: mediana, valorTexto: formata(m, mediana), natureza: "CALCULADO" as const, nota }
      : { ...base, rotulo, valor: null, motivoAusencia: "Nenhuma capital com dado comparável nesta medida e neste período.", natureza: "CALCULADO" as const, nota };
  });
  return (
    <FaixaNumeros
      rotulo={tema === "gastos" ? "Três escalas do gasto" : tema === "atendimento" ? "Três medidas do atendimento" : "Três medidas de resultado"}
      nota="Os números seguem o recorte escolhido: capital, ano, etapa, valores e disciplina. A medida mostrada nos gráficos se escolhe logo abaixo."
      idioma="pt"
    >
      {numeros.map((n, i) => (
        <NumeroIndicador key={`${n.rotulo}-${i}`} {...n} tamanho={def.medidas[i] === s.med ? "g" : "m"} idioma="pt" />
      ))}
    </FaixaNumeros>
  );
}

/** O caminho para comparar as capitais na mesma medida, com o recorte da página. */
export function CaminhoCompararEducacao({ tema, dados: dadosProp }: { tema: Tema; dados?: DadosPainel }) {
  const dados = useBaseEducacao(dadosProp);
  const { medida, ano, etapa, s, cap } = useRecorteTema(tema, dados);
  return (
    <p className="mt-6">
      <Link
        href={href(CAMINHO_COMPARAR, { med: medida, ano, etapa: MEDIDA[medida].etapas ? etapa : undefined, moeda: s.moeda !== "nominal" ? s.moeda : undefined, disc: medida === "saeb" ? s.disc : undefined, cap: cap?.id })}
        className="inline-flex min-h-[44px] items-center text-[0.9375rem] text-obee-dark underline underline-offset-4"
      >
        Comparar capitais nesta medida <span aria-hidden="true" className="ml-1">→</span>
      </Link>
    </p>
  );
}

const botao = "rotulo inline-flex min-h-[44px] items-center text-obee-dark underline decoration-linha underline-offset-4 hover:text-obee-tinta";

export function ExploradorTema({ tema, dados: dadosProp, contextos }: { tema: Tema; dados?: DadosPainel; contextos: Record<string, ContextoFicha> }) {
  const dados = useBaseEducacao(dadosProp);
  const { def, ix, s, definir, cap, medida, etapa, anos, ano, grupo, nomeGrupo } = useRecorteTema(tema, dados);
  const [aviso, setAviso] = useState("");
  const ficha = (id: IndicadorId) => dados.fichas.find((f) => f.id === id)!;
  const fontes: Record<string, FonteFicha> = useMemo(
    () => Object.fromEntries(Object.entries(dados.fontes).map(([id, f]) => [id, { nome: `${f.instituicao}, ${f.conjunto}`, orgao: f.instituicao, conjunto: f.conjunto, url: f.pagina, capturado_em: f.capturado_em }])),
    [dados],
  );

  const md = MEDIDA[medida];
  const comp = comparar(ix, medida, ano, etapa, s.moeda, s.disc, grupo, cap ?? dados.capitais[0], s.ord);
  const itensFora = comp.excluidas.map((x) => ({ nome: x.cap.nome, uf: x.cap.uf, status: x.comValor ? "Fora da comparação" : ROTULO_STATUS[x.status], motivo: x.motivo }));
  const linhasForaDoGrafico = comp.excluidas.map((x) => ({
    chave: x.cap.id,
    rotulo: `${x.cap.nome} (${x.cap.uf})`,
    valor: x.comValor ? x.ponto.valor : null,
    texto: x.comValor ? "fora da comparação (motivo abaixo)" : `${ROTULO_STATUS[x.status].toLowerCase()} (motivo abaixo)`,
    destacada: x.cap.id === cap?.id,
  }));
  const k = componente(medida, s.moeda, s.disc);
  const e = etapaDaMedida(medida, etapa);
  const ptCap = cap ? ix.ponto(md.indicador, cap.cod, ano, e, k) : null;
  const incluidaCap = cap ? comp.incluidas.find((i) => i.cap.id === cap.id) : undefined;
  const fmt = (v: number) => formata(medida, v);
  const fmtEixo = (v: number) => formataEixo(medida, v);
  const nomeCap = cap ? `${cap.nome} (${cap.uf})` : "";
  const nomeDetalhe = NOME_DETALHE[medida] ?? null;

  // título comunicativo e subtítulo técnico, do recorte e só dos dados elegíveis
  const itensFrase = comp.incluidas.map((i) => ({ nome: i.cap.nome, uf: i.cap.uf, valor: i.valor }));
  const periodo = rotuloPeriodoMedida(medida, ano);
  const partesSubtitulo = (serieInteira: boolean) =>
    [
      md.rotulo,
      unidade(medida, s.moeda),
      md.etapas ? nomeEtapa(dados, etapa) : null,
      medida === "saeb" ? (s.disc === "matematica" ? "Matemática" : "Língua Portuguesa") : null,
      serieInteira ? `série de ${anos[0]} a ${anos[anos.length - 1]}` : periodo,
      `capitais estaduais${grupo === "regiao" && cap ? `, região ${dados.regioes[cap.regiao]}` : ""}, ${universoDaMedida(medida)}`,
    ]
      .filter(Boolean)
      .join(" · ");
  const titulo = fraseAmplitude(itensFrase, { medida, ano, etapa, disciplina: s.disc === "matematica" ? "Matemática" : "Língua Portuguesa" });
  const fraseCap = cap ? fraseCapital(cap.nome, cap.uf, ptCap?.valor ?? null, comp.ref?.mediana ?? null, comp.ref?.n ?? 0, medida, !!ptCap && ptCap.valor !== null && !incluidaCap) : null;

  // referências externas válidas
  const extComp = referenciasExternas(dados, medida, ano, etapa, k);
  const nacCalc = nacionalCalculada(dados, medida, ano);
  const intl = internacionaisDa(dados, medida, etapa);
  const externaGrafico = referenciaExternaDoGrafico(dados, medida, ano, etapa, k);
  const notas = notasMateriais(comp);

  const textoRazao = (() => {
    const r = comp.ref;
    if (!r || r.razaoAgregada === null || (medida !== "despesa_hab" && medida !== "despesa_mat")) return undefined;
    const den = medida === "despesa_hab" ? "dos habitantes" : "das matrículas";
    return (
      <>
        <span className="font-semibold">Razão agregada {formata(medida, r.razaoAgregada)}:</span> soma da despesa de {r.n} capitais ÷ soma {den} das mesmas {r.n} ({inteiro(r.somaDenominador ?? 0)}). Pesa cada capital pelo seu denominador; é outra conta
        que a média simples, que dá o mesmo peso a cada capital.
      </>
    );
  })();

  // evolução: a capital, quando escolhida; senão a mediana das capitais, ano a ano
  const medianaPorAno = serieDaMediana(ix, medida, etapa, s.moeda, s.disc, grupo === "regiao" && cap ? cap.regiao : null);
  const pontosSerie = cap
    ? serie(ix, medida, cap.cod, etapa, s.moeda, s.disc)
    : medianaPorAno.map((m) => ({ ano: m.ano, ...(m.valor === null ? pontoVazio() : { ...pontoVazio(), valor: m.valor, status: "OBSERVADO" as const, elegivel: true, quebraSerie: m.quebraSerie }) }));
  const anotacoes = medida === "aprovacao" ? [PANDEMIA_APROVACAO] : medida === "ideb" || medida === "saeb" ? [PANDEMIA_IDEB] : [];
  const fraseSerieBase = fraseEvolucao(
    pontosSerie.map((p) => ({ ano: p.ano, valor: p.valor, elegivel: p.elegivel, quebraSerie: p.quebraSerie })),
    medida,
    medida === "despesa_hab" ? "a população de referência muda de base (estimativa, Censo ou relação do DOU)" : "a base do dado mudou",
    cap ? `Em ${nomeCap}` : "Na mediana das capitais",
    anotacoes,
  );
  // mediana sem capital: o conjunto de capitais com valor muda de um ano para outro, e a frase precisa dizer isso
  const comValorNaSerie = medianaPorAno.filter((m) => m.valor !== null);
  const conjuntoVaria = !cap && comValorNaSerie.length > 1 && new Set(comValorNaSerie.map((m) => m.n)).size > 1;
  const fraseSerie =
    conjuntoVaria && !fraseSerieBase.startsWith("Entre ")
      ? `${fraseSerieBase} Cada mediana usa as capitais com valor comparável no ano (${comValorNaSerie.map((m) => `${m.n} em ${m.ano}`).join(", ")}): o conjunto muda, então a variação não é a de um grupo constante.`
      : fraseSerieBase;

  const linhasTabela = [
    ...comp.incluidas.map((i) => [`${i.cap.nome} (${i.cap.uf})`, fmt(i.valor), i.ponto.nota ? "Incluída, com nota" : "Incluída"]),
    ...comp.excluidas.map((x) => [`${x.cap.nome} (${x.cap.uf})`, x.comValor && x.ponto.valor !== null ? fmt(x.ponto.valor) : null, x.comValor ? "Fora da comparação" : ROTULO_STATUS[x.status]]),
  ];

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAviso("Link deste recorte copiado.");
    } catch {
      setAviso("Não foi possível copiar automaticamente. O endereço na barra do navegador reproduz este recorte.");
    }
  };
  const baixarCsvSerie = () =>
    baixar(`obee_${tema}_${medida}_serie_${cap ? cap.id : "mediana"}${md.etapas ? `_${etapa}` : ""}${ehDespesa(medida) ? `_${s.moeda}` : ""}${medida === "saeb" ? `_${s.disc}` : ""}.csv`, csv(CABECALHO_CSV_SERIE, linhasCsvSerie(dados, medida, etapa, s.moeda, s.disc, cap ?? null, pontosSerie, medianaPorAno)));
  const baixarCsv = () =>
    baixar(`obee_${tema}_${medida}_${ano}${md.etapas ? `_${etapa}` : ""}${ehDespesa(medida) ? `_${s.moeda}` : ""}${medida === "saeb" ? `_${s.disc}` : ""}${grupo === "regiao" && cap ? `_regiao_${cap.regiao}` : ""}.csv`, csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(dados, comp, medida, ano, etapa, s.moeda, s.disc)));
  const baixarDicionario = () => baixar("obee_dicionario_das_colunas.csv", csv(["arquivo", "coluna", "descricao"], dicionarioExportacoes()));

  const prov = provenienciaDaFicha(ficha(md.indicador), fontes, { inicio: String(anos[0]), fim: String(ano) });
  const zero = ehDespesa(medida) || medida === "matriculas" || medida === "conveniadas" || medida === "atu";
  const padrao = !s.cap && s.med === def.medidaInicial && !s.ano && s.etapa === def.etapaInicial && s.moeda === "nominal" && s.disc === "matematica" && s.ord === "alfabetica" && s.eixo === "linear" && s.grp === "todas";
  const resumo = [
    DEFINICAO_CURTA[medida].titulo,
    md.etapas ? nomeEtapa(dados, etapa) : null,
    medida === "saeb" ? (s.disc === "matematica" ? "Matemática" : "Língua Portuguesa") : null,
    periodo,
    ehDespesa(medida) ? (s.moeda === "real" ? "reais de 2025" : "valores nominais") : null,
    cap ? nomeCap : null,
    grupo === "regiao" && cap ? `região ${dados.regioes[cap.regiao]}` : null,
    s.ord !== "alfabetica" ? (s.ord === "valor" ? "ordem crescente" : "ordem decrescente") : null,
    medida === "despesa" && s.eixo === "log" ? "escala logarítmica" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const acoes = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      <SobreEsteDado f={ficha(md.indicador)} ctx={contextos[md.indicador]} />
      <button type="button" onClick={copiar} className={botao}>
        Copiar link deste recorte
      </button>
      <button type="button" onClick={() => baixarDicionario()} className={botao}>
        Dicionário das colunas (CSV)
      </button>
    </div>
  );

  return (
    <>
      {/* controles locais, logo antes das figuras que eles afetam */}
      <Controles rotulo="Recorte da exploração" resumo={`Mostrando: ${resumo}.`} limpar={padrao ? undefined : { href: href(`/${tema}`) }} idioma="pt">
        <div className="w-full min-w-0">
          <Alternancia rotulo="Medida" valor={medida} opcoes={def.medidas.map((m) => ({ v: m, t: DEFINICAO_CURTA[m].titulo }))} aoMudar={(v) => definir({ med: v })} />
        </div>
        <div className="w-full min-w-0 sm:w-44">
          <Selecao
            id="f-ano"
            rotulo={md.anos === "ideb" ? "Edição" : "Ano"}
            ajuda={md.anos === "financeiros" ? "Exercício financeiro." : md.anos === "ideb" ? "Edição bienal." : medida === "aprovacao" ? "Ano letivo." : "Ano do Censo Escolar."}
            valor={String(ano)}
            opcoes={[...anos].reverse().map((a) => ({ v: String(a), t: String(a) }))}
            aoMudar={(v) => definir({ ano: Number(v) })}
          />
        </div>
        <div className="w-full min-w-0 sm:w-72">
          <Selecao
            id="f-grupo"
            rotulo="Grupo de comparação"
            ajuda="Define a mediana, a média e os extremos do recorte."
            valor={grupo}
            opcoes={[
              { v: "todas", t: `Todas as capitais estaduais (${dados.capitais.length})` },
              {
                v: "regiao",
                t: cap ? `Capitais da região ${dados.regioes[cap.regiao]} (${regioesDoPainel(dados).find((r) => r.id === cap.regiao)?.n ?? 0})` : "Região da capital escolhida (escolha uma capital)",
                desab: !cap,
              },
            ]}
            aoMudar={(v) => definir({ grp: v as Grupo })}
          />
        </div>
        {temEtapa(medida) && (
          <div className="w-full min-w-0 sm:w-72">
            <Selecao
              id="f-etapa"
              rotulo="Etapa de ensino"
              ajuda="Só as etapas em que esta medida existe."
              valor={etapa}
              opcoes={dados.etapas.filter((x) => md.etapas?.includes(x.id)).map((x) => ({ v: x.id, t: x.nome }))}
              aoMudar={(v) => definir({ etapa: v as EtapaId })}
            />
          </div>
        )}
        {ehDespesa(medida) && (
          <Alternancia
            rotulo="Valores"
            valor={s.moeda}
            opcoes={[
              { v: "nominal", t: "Nominais" },
              { v: "real", t: "Reais de 2025 (IPCA)" },
            ]}
            aoMudar={(v) => definir({ moeda: v })}
          />
        )}
        {medida === "saeb" && (
          <Alternancia
            rotulo="Disciplina"
            valor={s.disc}
            opcoes={[
              { v: "matematica", t: "Matemática" },
              { v: "portugues", t: "Língua Portuguesa" },
            ]}
            aoMudar={(v) => definir({ disc: v })}
          />
        )}
        <div>
          <Alternancia
            rotulo="Ordem das capitais"
            valor={s.ord}
            opcoes={[
              { v: "alfabetica", t: "Alfabética" },
              { v: "valor", t: "Crescente" },
              { v: "valor_desc", t: "Decrescente" },
            ]}
            aoMudar={(v) => definir({ ord: v })}
          />
          {s.ord !== "alfabetica" && <p className="mt-1 max-w-xs text-xs leading-snug text-carvao-muted">A ordem por valor organiza a leitura; não classifica as capitais.</p>}
        </div>
        {medida === "despesa" && (
          <Alternancia
            rotulo="Escala do eixo"
            valor={s.eixo}
            opcoes={[
              { v: "linear", t: "Escala linear" },
              { v: "log", t: "Escala logarítmica" },
            ]}
            aoMudar={(v) => definir({ eixo: v })}
          />
        )}
      </Controles>

      <FiguraAnalitica
        id="visao"
        idioma="pt"
        pergunta={titulo}
        subtitulo={`${partesSubtitulo(false)}. ${fraseCobertura(comp.incluidas.length, comp.universo.length)}`}
        natureza={ficha(md.indicador).natureza}
        proveniencia={prov}
        leitura={fraseCap ? <LeituraGuiada>{fraseCap}</LeituraGuiada> : undefined}
        ressalva={ehDespesa(medida) ? <Siglas texto={`${textoPerimetroIntra(perimetroIntra(dados, ano), ano, medida)} A parcela de cada capital está na tabela completa de Comparar capitais e no CSV.`} /> : undefined}
        tabela={{ colunas: ["Capital", unidade(medida, s.moeda), "Situação"], linhas: linhasTabela, titulo: `${md.rotulo}, ${periodo}: valor de cada capital e situação na comparação`, limite: linhasTabela.length }}
        comoInterpretar={
          <>
            <Siglas texto={DEFINICAO_CURTA[medida].texto} />
            {medida === "despesa" && s.eixo === "log" ? " Escala logarítmica: distâncias iguais no eixo são multiplicações iguais, não somas." : ""}
          </>
        }
        naoConcluir={avisoDoGrupo(medida)}
        complemento={
          <>
            {comp.excluidas.length > 0 && <ForaDaComparacao itens={itensFora} />}
            {comp.incluidas.length > 0 && notas.length > 0 && <NotasMateriais notas={notas} n={comp.incluidas.length} />}
            {ptCap && ptCap.valor !== null && <Ressalva ponto={ptCap} />}
            {cap && ptCap && ptCap.valor === null && <SemValor ponto={ptCap} />}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              {acoes}
              <button type="button" onClick={baixarCsv} className={botao}>
                Baixar estes valores (CSV)
              </button>
            </div>
            <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm text-obee-dark">
              {aviso}
            </p>
          </>
        }
        depois={
          <section aria-labelledby="refs-titulo">
            <h3 id="refs-titulo" className="t-h3 text-carvao">
              Referências para ler o número
            </h3>
            <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">{avisoDoGrupo(medida)}</p>
            <div className="mt-6">
              {comp.ref ? <ReferenciasDoGrupo r={comp.ref} m={medida} textoRazao={textoRazao} /> : <SemReferencia medida={medida} motivo="Escolha uma etapa e um ano em que a medida exista para ver as referências do grupo." />}
            </div>
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div className="min-w-0">
                <h4 className="font-semibold text-obee-tinta">Referência nacional</h4>
                <div className="mt-3 space-y-4">
                  {extComp.length > 0 && <ReferenciasNacionais externas={extComp} valor={incluidaCap?.valor ?? null} m={medida} nomeCapital={nomeCap || "A capital"} />}
                  {nacCalc && <ReferenciaNacionalCalculadaBloco referencia={nacCalc} valor={incluidaCap?.valor ?? null} elegivel={!!incluidaCap} nomeCapital={nomeCap || "A capital"} completo />}
                  {extComp.length === 0 && !nacCalc && <SemReferencia medida={medida} motivo={SEM_NACIONAL[medida]} />}
                </div>
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-obee-tinta">Contexto internacional (outro universo, sem comparação direta)</h4>
                <div className="mt-3">
                  {intl.length ? (
                    <ContextoInternacionalBloco grupos={intl} anoPainel={ano} />
                  ) : (
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">Não há contexto internacional comparável para esta medida: país e município são escalas diferentes e os conceitos não coincidem.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-10 max-w-prose2 border-t border-linha pt-5" role="note">
              <h4 className="font-semibold text-obee-tinta">O que este painel não mostra</h4>
              <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{NAO_MOSTRA[tema]}</p>
            </div>
          </section>
        }
      >
        {comp.incluidas.length === 0 ? (
          <div data-grafico="sem-comparacao">
            <ForaDoEscopo texto={`Nenhuma capital tem dado comparável para ${md.rotulo.toLowerCase()} neste recorte. O motivo de cada capital está abaixo.`} />
          </div>
        ) : (
          // a distribuição das capitais tem mediana, média, faixa central, referência externa e escala logarítmica, formas que o kit não tem:
          // fica a de domínio, marcada como figura legada
          <div data-figura-legado="distribuicao-capitais">
            <DistribuicaoCapitais
              titulo={`${md.rotulo}, ${periodo}`}
              linhas={comp.incluidas.map((i) => ({ chave: i.cap.id, rotulo: `${i.cap.nome} (${i.cap.uf})`, valor: i.valor, destacada: i.cap.id === cap?.id }))}
              referencias={{
                mediana: comp.ref?.mediana ?? null,
                media: comp.ref?.media ?? null,
                faixa: comp.ref && comp.ref.quartisExibicao && comp.ref.q1 !== null && comp.ref.q3 !== null ? { q1: comp.ref.q1, q3: comp.ref.q3 } : null,
                externa: externaGrafico,
              }}
              formata={fmt}
              formataEixo={fmtEixo}
              zero={zero}
              escala={medida === "despesa" ? s.eixo : "linear"}
              rotuloGrupo={nomeGrupo}
              fora={linhasForaDoGrafico}
            />
          </div>
        )}
      </FiguraAnalitica>

      <FiguraAnalitica
        id="evolucao"
        idioma="pt"
        pergunta={fraseSerie}
        subtitulo={`${partesSubtitulo(true)}${cap ? ` · ${nomeCap}` : " · mediana das capitais"}`}
        natureza={cap ? ficha(md.indicador).natureza : "CALCULADO"}
        proveniencia={prov}
        tabela={{
          colunas: ["Ano", "Valor", "Estado do dado"],
          linhas: pontosSerie.map((p) => [String(p.ano), p.valor !== null ? fmt(p.valor) : null, ROTULO_STATUS[p.status]]),
          titulo: `${md.rotulo}${cap ? `, ${nomeCap}` : ", mediana das capitais"}`,
          limite: pontosSerie.length,
        }}
        comoInterpretar={
          <>
            {!cap && "Sem capital escolhida, a linha é a mediana das capitais em cada ano; o número de capitais na comparação pode mudar de um ano para outro. "}
            {ehDespesa(medida) && s.moeda === "nominal" && "Valores em reais correntes: cada ano a preços do próprio ano, o que inclui o efeito da inflação. Para ler a mudança em termos reais, escolha “Reais de 2025 (IPCA)” em Valores."}
          </>
        }
        naoConcluir="A variação entre anos descreve o valor registrado: quando a base do dado muda, a linha se interrompe e a variação não mede mudança do serviço; nenhuma variação identifica a causa."
        complemento={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <button type="button" onClick={baixarCsvSerie} className={botao}>
              Baixar esta série (CSV)
            </button>
          </div>
        }
      >
        {/* a série interrompe a linha na quebra de base e isola o valor fora das comparações, formas que a linha do kit não tem */}
        <div data-figura-legado="serie" className="max-w-3xl">
          <MiniSerie
            titulo={`${md.rotulo}${cap ? `, ${nomeCap}` : ", mediana das capitais"}`}
            pontos={pontosSerie}
            formata={fmt}
            formataEixo={fmtEixo}
            zero={zero}
            anotacoes={anotacoes}
            referencia={cap ? medianaPorAno : undefined}
            rotuloReferencia="Mediana das capitais"
            altura={260}
          />
        </div>
      </FiguraAnalitica>

      {nomeDetalhe &&
        (!cap ? (
          <Recolhido id="detalhe" aberto nivelTitulo={2} titulo={`${DEFINICAO_CURTA[medida].titulo}: ${nomeDetalhe.toLowerCase()}`} resumo="O detalhe é de uma capital por vez.">
            <p className="t-corpo max-w-prose2 text-carvao">Escolha uma capital no campo “Capital”, no alto da página, para ver este detalhe.</p>
          </Recolhido>
        ) : medida === "despesa" ? (
          <ComposicaoDespesa ix={ix} cap={cap} ano={ano} ficha={ficha("edu.despesa.subfuncao")} ctx={contextos["edu.despesa.subfuncao"]} fontes={fontes} />
        ) : medida === "despesa_mat" ? (
          <PonteDaRazao ix={ix} cap={cap} ano={ano} razao={ptCap ?? pontoVazio()} ficha={ficha("edu.despesa.ponte_matricula")} ctx={contextos["edu.despesa.ponte_matricula"]} fontes={fontes} />
        ) : (
          <MatriculasPorEtapa ix={ix} cap={cap} ano={ano} ficha={ficha("edu.matriculas.rede_municipal")} ctx={contextos["edu.matriculas.rede_municipal"]} fontes={fontes} />
        ))}
    </>
  );
}
