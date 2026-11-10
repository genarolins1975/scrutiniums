import type { Metadata } from "next";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import Link from "next/link";
import type { ReactNode } from "react";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { FaixaNumeros, FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, NumeroIndicador, PaginaPainel, TabelaDados } from "@/components/painel";
import type { Natureza } from "@/components/painel";
import { CompararCredores } from "@/components/familias/desenrola/CompararCredores";
import { LinhasComSeletor } from "@/components/familias/desenrola/LinhasComSeletor";
import { MapaPorUf } from "@/components/familias/desenrola/MapaPorUf";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { dataBr, mesAno } from "@/lib/perguntas/leitura";
import { DESCRICAO_DESENROLA, PERGUNTA_DESENROLA, ROTA_DESENROLA, dadosDesenrola, provDesenrola, textoGold as t } from "@/lib/familias/desenrola";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao(PERGUNTA_DESENROLA, ROTA_DESENROLA),
  description: DESCRICAO_DESENROLA,
  alternates: { canonical: ROTA_DESENROLA },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";
const n = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
/** Valor em reais na escala de leitura: bilhões, milhões ou reais inteiros. */
const moeda = (v: number, casasBi = 2) => (v >= 1e9 ? `R$ ${n(v / 1e9, casasBi)} bi` : v >= 1e6 ? `R$ ${n(v / 1e6, 1)} mi` : `R$ ${n(v)}`);
/** Data e hora da coleta no horário de Brasília (a gold guarda o instante em UTC). */
const dataHoraBrasilia = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** O vocabulário da gold na taxonomia da plataforma: "reportado" é o que a fonte oficial divulga diretamente, a definição de observado. */
const NATUREZA_DO_SELO: Record<string, Natureza> = { reportado: "OBSERVADO", calculado: "CALCULADO", estimado: "ESTIMADO" };
/**
 * Natureza de um número oficial do programa, item a item (auditoria de 10/11/2026, achado 3). A gold marca todos como "reportado", mas
 * a nota de um deles diz que o número é estimativa da própria fonte: esse sai como Estimado, nunca como Observado. Os demais são valores
 * que a fonte declara no documento citado; o kit não tem natureza "declarado", então ficam como Observado (valor publicado pela fonte
 * oficial) e a nota junto do número diz que são declaração do documento.
 */
const naturezaDoOficial = (o: { selo: string; nota: string }): Natureza => (/estimativa|estimad/i.test(o.nota) ? "ESTIMADO" : (NATUREZA_DO_SELO[o.selo] ?? "OBSERVADO"));
const NOME_DO_SELO: Record<string, string> = { reportado: "Reportado", calculado: "Calculado", estimado: "Estimado", causal: "Resultado causal", associacao: "Associação" };
const NOME_DA_SITUACAO: Record<string, string> = { viavel: "Viável", parcial: "Parcial", indisponivel: "Indisponível" };

const SECOES: readonly (readonly [string, string])[] = [
  ["alcance", "Alcance"],
  ["valores", "Valores"],
  ["onde", "Onde"],
  ["credores", "Credores"],
  ["contexto", "Efeitos"],
  ["viabilidade", "O que dá para medir"],
  ["arquitetura", "Arquitetura"],
  ["linha-do-tempo", "Linha do tempo"],
  ["depois", "Depois"],
  ["fiscal", "Fiscal"],
];

function Nota({ titulo, children }: Readonly<{ titulo?: string; children: ReactNode }>) {
  return (
    <p className="t-meta max-w-prose2 border-l border-carvao pl-4 text-carvao" data-nota-material="">
      {titulo && <span className="font-medium">{titulo} </span>}
      {children}
    </p>
  );
}

function Texto({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="t-corpo max-w-prose2 text-carvao-muted">{children}</p>;
}

type Lacuna = { falta: string; porque: string; precisaria?: string };

/** Bloco de lacuna da vista antiga: o que falta, por que falta e o que seria preciso para ter. Ausência declarada, nunca estimada. */
function Lacunas({ id, titulo, itens, lead, nota }: Readonly<{ id: string; titulo: string; itens: readonly Lacuna[]; lead?: ReactNode; nota?: ReactNode }>) {
  return (
    <TabelaDados
      recolhida={false}
      id={id}
      tituloVisivel={titulo}
      titulo={titulo}
      lead={lead}
      colunas={["O que falta", "Por que falta", "O que seria preciso"]}
      linhas={itens.map((i) => [i.falta, i.porque, i.precisaria ?? null])}
      ausencia={{ "O que seria preciso": "não indicado" }}
      nota={nota}
    />
  );
}

/**
 * Painel "Desenrola Brasil" (Observatório das Famílias, coleção Dívida e crédito das famílias), com conta. Reescrita no molde de painel
 * da vista `desenrola` da aplicação do Crédito (public/obs/app.js, renderDesenrola; decisão do dono de 10/11/2026): a mesma gold
 * (public/obs/data/gold/desenrola.json), os mesmos valores e as mesmas ressalvas. A página carrega tantos blocos de lacuna quanto de
 * gráfico, porque três separações nunca podem se confundir: o SCR não é o programa inteiro, as faixas de pessoa física não se somam com
 * o Desenrola Pequenos Negócios e baixa de registro negativo não é pagamento.
 */
export default function DesenrolaPage() {
  const { g, meses, concentracao, marcosRegulacao, contexto, programa } = dadosDesenrola();
  const S = g.totais_scr, R = g.reconciliacao, K = g.concentracao, A = g.avaliacao, PN = g.pequenos_negocios;
  const periodoScr = `${mesAno(g.data_base_min)} a ${mesAno(g.data_base)}`;
  const periodoPrograma = `${mesAno(programa.inicio)} a ${mesAno(programa.fim)}`;
  const oficial = (id: string) => (g.oficiais as { id: string; rotulo: string; valor: number; unidade: string; selo: string; fonte: string; nota: string }[]).find((o) => o.id === id)!;
  const fonteCurta = (x: string) =>
    x.replace("Considerações da SRE/Ministério da Fazenda no Relatório de Avaliação", "SRE/Ministério da Fazenda, no Relatório de Avaliação").replace("Relatório de Avaliação MPO/BID/BCB, introdução", "Relatório de Avaliação MPO/BID/BCB");
  const numeroOficial = (id: string) => {
    const o = oficial(id);
    const emReais = o.unidade.startsWith("R$");
    const ressalva = o.unidade.match(/\((.+)\)/)?.[1];
    return {
      rotulo: o.rotulo,
      valorTexto: emReais ? moeda(o.valor, 0) : `${n(o.valor / 1e6)} milhões`,
      formato: "texto" as const,
      unidade: `${emReais ? "" : "de pessoas"}${ressalva ? ` (${ressalva})` : ""}`.trim(),
      periodo: periodoPrograma,
      recorte: "programa inteiro",
      fonte: fonteCurta(o.fonte),
      natureza: naturezaDoOficial(o),
      nota: naturezaDoOficial(o) === "ESTIMADO" ? t(o.nota) : `Valor declarado pela fonte no documento citado. ${t(o.nota)}`,
    };
  };
  const elegiveis = oficial("elegiveis"), renegociaram = oficial("renegociaram"), leilaoAntes = oficial("leilao_antes"), leilaoDepois = oficial("leilao_depois");

  const faixas = (g.componentes as { id: string; nome: string; no_scr: boolean; contexto?: boolean; operacoes: number; volume: number; ticket_medio: number; conglomerados: number }[]).filter((c) => c.no_scr && !c.contexto);
  const componentesPf = (g.componentes as Record<string, string | number | boolean | undefined>[]).filter((c) => !c.contexto);
  const ATRIBUTOS: readonly (readonly [string, string])[] = [["Quem podia", "publico"], ["Que dívida", "divida"], ["Quando", "periodo"], ["Por onde", "canal"], ["Garantia pública", "garantia"], ["Dado disponível", "dados"]];
  const semDadoPublico = "sem dado desagregado público";

  const marcosSerie = [{ x: "2023-10", rotulo: "abre a Faixa 1" }, { x: "2024-05", rotulo: "encerramento" }, ...marcosRegulacao];
  const seriesFaixa = [
    { id: "soma", rotulo: "Faixas 1 e 2", sigla: "1 e 2", cor: "var(--serie-1)" },
    { id: "f1", rotulo: "Faixa 1", sigla: "F1", cor: "var(--cor-energia)" },
    { id: "f2", rotulo: "Faixa 2", sigla: "F2", cor: "var(--serie-2)" },
  ];
  const provBcb = (indicador: string, natureza: Natureza, unidade: string, limitacoes: string[], formula?: string) =>
    provDesenrola(g, "bcb", { indicador, natureza, unidade, inicio: g.data_base_min, fim: g.data_base, limitacoes: limitacoes.map(t), formula });

  const ufs = g.mapa as { uf: string; nome: string; cod: string; operacoes: number; volume: number; part_op: number; ticket_medio: number; op_por_mil_hab: number | null }[];
  const insts = g.instituicoes as {
    cod: string; nome: string; operacoes: number; volume: number; part_op: number; part_vol: number; ticket_medio: number; ufs: number;
    por_faixa: { faixa1?: { operacoes: number }; faixa2?: { operacoes: number } };
    consolidado?: { nota: string; componentes: { cod: string; nome: string; operacoes: number; volume: number }[] };
  }[];
  const consolidados = insts.filter((i) => i.consolidado);
  const nomeCredor = (i: (typeof insts)[number]) => (i.consolidado ? `${i.nome} (consolidado)` : i.nome);

  const matriz = g.matriz_viabilidade as { area: string; indicador: string; status: "viavel" | "parcial" | "indisponivel"; base: string | null; falta: string | null }[];
  const areas = [...new Set(matriz.map((m) => m.area))];
  const contar = (area: string | null, status: string) => matriz.filter((m) => (area === null || m.area === area) && m.status === status).length;

  const mesesContexto = contexto.length ? contexto.reduce((maior, s) => (s.pontos.length > maior.pontos.length ? s : maior)).pontos.map((p) => p.mes) : [];
  const razaoAdesao = (100 * renegociaram.valor) / elegiveis.valor;
  // quantos credores participaram do leilão da Faixa 1, como a gold registra na nota do número oficial
  const credoresLeilao = leilaoAntes.nota.match(/(\d[\d.]*) credores/)?.[1];
  const vezesPequenosNegocios = Math.round(PN.ticket_medio / S.ticket_medio);

  return (
    <>
      <MarcaVisita secao="familias:desenrola" />
      <header>
        <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_DESENROLA} fontes={["credito"]} />
        <NavegacaoColecao colecao="divida" />
      </header>
      <PaginaPainel
        rota={ROTA_DESENROLA}
        abertura={{
          grupo: "Dívida e crédito das famílias",
          acento: "bronze",
          titulo: PERGUNTA_DESENROLA,
          lead: "O que o programa de renegociação de dívidas fez, quanto dele aparece na base pública do Banco Central e até onde os dados permitem avaliar seus efeitos. O que falta fica declarado.",
          recorte: {
            periodo: `Programa de ${periodoPrograma}; base de ${periodoScr}`,
            universo: `Brasil, faixas 1 e 2, 27 unidades da federação e ${n(K.n_conglomerados)} grupos credores`,
            fonte: "Banco Central, Desenrola Brasil (dados agregados do SCR), e Relatório de Avaliação MPO/BID/BCB",
          },
          limite:
            "qual foi o efeito do programa sobre inadimplência, acesso a crédito ou bem-estar. Operação não é pessoa, valor após desconto não é dívida original, e baixa de registro negativo não é pagamento.",
          fontesDatasSiglas: (
            <>
              <p>
                Banco Central do Brasil, Desenrola Brasil (dados agregados do SCR), {n(g.meses)} datas-base de {periodoScr}, coletado em {dataHoraBrasilia(g.coletado_em)} (horário de Brasília). Relatório de Avaliação do Desenrola Brasil, de MPO, BID e Banco Central, publicado em {dataBr(A.publicado)}. População: {t(g.geo?.populacao_fonte ?? "IBGE SIDRA 6579")}. Banco Central, Sistema Gerenciador de Séries Temporais (SGS), para as séries de contexto. Leitura da Scrutiniums em {dataBr(g.gerado_em)}.
              </p>
              <p>
                SCR: Sistema de Informações de Crédito do Banco Central. BCB: Banco Central do Brasil. MPO: Ministério do Planejamento e Orçamento. BID: Banco Interamericano de Desenvolvimento. SRE: Secretaria de Reformas Econômicas do Ministério da Fazenda. FGO: Fundo Garantidor de Operações. CadÚnico: Cadastro Único para Programas Sociais. MP: medida provisória. HHI: índice de concentração de Herfindahl e Hirschman. UF: unidade da federação. SFN: Sistema Financeiro Nacional.
              </p>
            </>
          ),
        }}
        rotuloNumeros="O que o programa fez, em números oficiais"
        numeros={[numeroOficial("elegiveis"), numeroOficial("renegociaram"), numeroOficial("regularizado"), numeroOficial("beneficiados")]}
        notaNumeros="Números do programa inteiro, citados de documentos oficiais. A base do Banco Central usada nos gráficos abaixo cobre só uma parte dele: os dois conjuntos medem coisas diferentes e não se somam."
        navegacaoLocal={
          <nav aria-label="Seções desta página" className="mt-6 border-y border-linha py-1">
            <ul className="flex flex-wrap gap-x-5">
              {SECOES.filter(([id]) => id !== "contexto" || contexto.length > 0).map(([id, rotulo]) => (
                <li key={id}>
                  <a href={`#${id}`} className={`inline-flex min-h-[44px] items-center text-sm text-carvao ${link}`}>
                    {rotulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        }
        figuras={
          <>
            <FiguraAnalitica
              id="alcance"
              pergunta="Quantas renegociações aparecem na base do Banco Central?"
              subtitulo={`Renegociações do Desenrola informadas ao SCR, por mês · operações ou R$ milhões após desconto · Brasil, faixas 1 e 2, ${periodoScr}`}
              natureza="OBSERVADO"
              proveniencia={provBcb("Operações renegociadas e volume após desconto, por mês e faixa", "OBSERVADO", "operações e R$", [g.aviso_cobertura, g.aviso_setembro, "Valores nominais, sem deflação: meses distantes não são diretamente comparáveis em poder de compra."])}
              leitura={
                <LeituraGuiada>
                  De {periodoScr}, as faixas 1 e 2 somam {n(S.operacoes)} operações e {moeda(S.volume)} de volume após desconto. A legenda mostra e esconde cada faixa.
                </LeituraGuiada>
              }
              ressalva={t(g.aviso_setembro)}
              porQueImporta="Foi a maior política de renegociação de dívidas de pessoas físicas já feita no país, e boa parte do que se diz sobre ela não é verificável nos dados abertos."
              comoInterpretar="Separe sempre o que a base do Banco Central mede, operações de crédito no SCR, do que o programa fez no total. Os números oficiais e os do SCR não se contradizem: medem coisas diferentes. As marcas no gráfico indicam datas do programa e de normas, para permitir a inspeção da série."
              naoConcluir="quantas pessoas renegociaram nem quanto foi pago. A base conta operações de crédito novas, pelo valor depois do desconto, e deixa de fora o que foi quitado à vista e as dívidas com credores que não informam ao SCR."
              tabela={{
                titulo: "Renegociações do Desenrola informadas ao SCR, por mês e faixa",
                colunas: ["Mês", "Operações, Faixa 1", "Operações, Faixa 2", "Operações, faixas 1 e 2", "Volume, Faixa 1 (R$ milhões)", "Volume, Faixa 2 (R$ milhões)", "Volume, faixas 1 e 2 (R$ milhões)"],
                linhas: meses.map((m) => [m.acumulado ? `${mesAno(m.mes)} (acumulado)` : mesAno(m.mes), m.op1, m.op2, m.opSoma, m.vol1 === null ? null : m.vol1 / 1e6, m.vol2 === null ? null : m.vol2 / 1e6, m.volSoma === null ? null : m.volSoma / 1e6]),
                casas: [null, 0, 0, 0, 2, 2, 2],
                limite: meses.length,
              }}
              complemento={
                <>
                  <TabelaDados
                    recolhida={false}
                    id="concentracao-no-tempo"
                    tituloVisivel="Concentração no tempo"
                    titulo="Operações durante o programa e depois do encerramento, por faixa"
                    colunas={["Período", "Faixas 1 e 2 (operações)", "Faixas 1 e 2 (%)", "Faixa 1 (operações)", "Faixa 1 (%)", "Faixa 2 (operações)", "Faixa 2 (%)"]}
                    linhas={[
                      [`Durante o programa (${mesAno("2023-09")} a ${mesAno("2024-05")})`, ...concentracao.flatMap((c) => [c.durante, c.total ? (100 * c.durante) / c.total : null])],
                      ["Depois do encerramento", ...concentracao.flatMap((c) => [c.depois, c.total ? (100 * c.depois) / c.total : null])],
                    ]}
                    casas={[null, 0, 1, 0, 1, 0, 1]}
                    nota="Calculado sobre as operações da série acima. Continuam entrando registros depois de maio de 2024. A fonte não explica o motivo; retificações de informações já prestadas e operações contratadas no prazo mas informadas depois são as hipóteses compatíveis com o que o Banco Central documenta. Não é adesão nova ao programa encerrado."
                  />
                  <TabelaDados
                    recolhida={false}
                    id="participacao-das-faixas"
                    tituloVisivel="Participação de cada faixa"
                    titulo={`Participação de cada faixa nas operações informadas ao SCR, ${periodoScr}`}
                    colunas={["Faixa", "Operações", "% das operações", "Volume após desconto (R$ milhões)", "Valor médio por operação (R$)"]}
                    linhas={faixas.map((c) => [c.nome, c.operacoes, (100 * c.operacoes) / S.operacoes, c.volume / 1e6, c.ticket_medio])}
                    casas={[null, 0, 1, 1, 0]}
                    nota="Reportado pela fonte, com participação e valor médio calculados. A Faixa 1 responde pela maior parte das operações e a Faixa 2 tem valor por operação maior, o que é coerente com os tetos de dívida de cada uma."
                  />
                  <Lacunas
                    id="lacunas-funil"
                    titulo="O funil do programa não pode ser construído com dado público"
                    itens={[
                      { falta: "Público elegível por período e região", porque: `só existe o número agregado de ${n(elegiveis.valor / 1e6)} milhões, citado para a Faixa 1 inteira`, precisaria: "tabulação de elegíveis por UF publicada pelo Banco Central ou pelo Ministério da Fazenda" },
                      { falta: "Ofertas realizadas na plataforma", porque: "a plataforma do programa não publicou base aberta de ofertas", precisaria: "dados do operador da plataforma" },
                      { falta: "Acordos pagos e acordos em curso", porque: "a base informa a contratação, não o cumprimento", precisaria: "acompanhamento longitudinal das operações" },
                      { falta: "Número médio de dívidas por beneficiário", porque: "a base conta operações e não permite identificar pessoas repetidas", precisaria: "contagem de CPFs distintos, que é sigilosa" },
                    ]}
                  />
                  <Nota titulo="Uma razão citada, e por que ela não é uma taxa de adesão.">
                    Estimado. Menos de {n(renegociaram.valor / 1e6)} milhões de pessoas renegociaram, num público estimado em {n(elegiveis.valor / 1e6)} milhões de elegíveis: cerca de {n(razaoAdesao)}%. Os dois números vêm do mesmo relatório oficial, mas de conceitos e momentos diferentes: um é a procura observada pelo programa, o outro é uma estimativa de elegibilidade da Faixa 1. A divisão dá ordem de grandeza, não taxa medida sobre um cadastro.
                  </Nota>
                </>
              }
            >
              <FaixaNumeros rotulo={`O que aparece na base do Banco Central, faixas 1 e 2, ${periodoScr}`}>
                <NumeroIndicador rotulo="Operações no SCR" valor={S.operacoes} formato="inteiro" unidade="operações" periodo={periodoScr} recorte="faixas 1 e 2" fonte="Banco Central, Desenrola Brasil (SCR)" natureza="OBSERVADO" nota="Operações, não pessoas." tamanho="m" />
                <NumeroIndicador
                  rotulo="Volume, após desconto"
                  valorTexto={moeda(S.volume)}
                  formato="texto"
                  unidade="nominais"
                  periodo={periodoScr}
                  recorte="faixas 1 e 2"
                  fonte="Banco Central, Desenrola Brasil (SCR)"
                  natureza="OBSERVADO"
                  nota={`${n(R.razao, 1)} vezes menor que o total oficial de dívidas regularizadas, pelo motivo explicado abaixo.`}
                  tamanho="m"
                />
                <NumeroIndicador rotulo="Valor médio por operação" valor={S.ticket_medio} formato="reais" casas={0} unidade="por operação" periodo={periodoScr} recorte="faixas 1 e 2" fonte="Banco Central, Desenrola Brasil (SCR)" natureza="CALCULADO" nota="Volume dividido por operações. A fonte não publica mediana." tamanho="m" />
                <NumeroIndicador
                  rotulo="Grupos credores"
                  valor={S.conglomerados}
                  formato="inteiro"
                  unidade="conglomerados"
                  periodo={periodoScr}
                  recorte="faixas 1 e 2"
                  fonte="Banco Central, Desenrola Brasil (SCR)"
                  natureza="OBSERVADO"
                  nota={`Só quem informa ao SCR.${credoresLeilao ? ` O leilão da Faixa 1 teve ${credoresLeilao} credores.` : ""}`}
                  tamanho="m"
                />
              </FaixaNumeros>
              <div className="my-6 space-y-3">
                <Nota titulo="Esta base não cobre o programa inteiro.">{t(g.aviso_cobertura)}</Nota>
                {g.fora_do_recorte?.linhas > 0 && (
                  <p className="t-meta max-w-prose2 border-l border-carvao pl-4 text-carvao" data-desenrola-fora-recorte="">
                    {t(g.fora_do_recorte.ressalva)}. As linhas permanecem na captura original; os totais desta página usam somente os tipos documentados.
                  </p>
                )}
                <Nota titulo="Por isso os dois números convivem.">{t(R.explicacao)}</Nota>
              </div>
              <LinhasComSeletor
                rotulo="Medida da série"
                titulo="Renegociações informadas ao SCR, por mês"
                inicial="operacoes"
                zero
                marcos={marcosSerie}
                opcoes={[
                  {
                    id: "operacoes",
                    nome: "Operações renegociadas",
                    unidade: "operações",
                    casas: 0,
                    dados: meses.map((m) => ({ mes: m.mes, soma: m.opSoma, f1: m.op1, f2: m.op2 })),
                    series: seriesFaixa,
                    ocultas: ["f1", "f2"],
                    frase: `Operações de crédito criadas pela renegociação e informadas ao SCR em cada mês: ${n(S.operacoes)} no período, nas faixas 1 e 2.`,
                  },
                  {
                    id: "volume",
                    nome: "Volume após desconto (R$ milhões)",
                    unidade: "R$ milhões",
                    casas: 1,
                    dados: meses.map((m) => ({ mes: m.mes, soma: m.volSoma === null ? null : m.volSoma / 1e6, f1: m.vol1 === null ? null : m.vol1 / 1e6, f2: m.vol2 === null ? null : m.vol2 / 1e6 })),
                    series: seriesFaixa,
                    ocultas: ["f1", "f2"],
                    frase: `Soma dos valores das operações depois do desconto, em valores nominais: ${moeda(S.volume)} no período, nas faixas 1 e 2. Não é a dívida original nem o valor pago.`,
                  },
                ]}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="valores"
              pergunta="Qual é o valor médio de uma operação renegociada?"
              subtitulo={`Valor médio por operação, depois do desconto, por mês · R$ por operação · Brasil, faixas 1 e 2, ${periodoScr}`}
              natureza="CALCULADO"
              proveniencia={provBcb("Valor médio por operação renegociada, por mês", "CALCULADO", "R$ por operação", ["Média de agregados mensais, não de microdados: não há mediana nem distribuição.", "É o valor depois do desconto; a base não publica o valor original da dívida."], "volume do mês dividido pelas operações do mês, arredondado ao real")}
              leitura={
                <LeituraGuiada>
                  No período inteiro, o valor médio é de R$ {n(S.ticket_medio)} por operação nas faixas 1 e 2: R$ {n(faixas[0].ticket_medio)} na {faixas[0].nome} e R$ {n(faixas[1].ticket_medio)} na {faixas[1].nome}.
                </LeituraGuiada>
              }
              ressalva="valor depois do desconto, em reais nominais. É a média de agregados mensais: a fonte não publica distribuição, mediana nem o valor original."
              naoConcluir="quanto cada pessoa devia, qual foi o desconto ou quanto foi pago. Sem o valor original da dívida, o desconto de cada operação é indeterminável."
              tabela={{
                titulo: "Valor médio por operação renegociada, por mês e faixa (R$)",
                colunas: ["Mês", "Faixa 1 (R$)", "Faixa 2 (R$)", "Faixas 1 e 2 (R$)"],
                linhas: meses.map((m) => [m.acumulado ? `${mesAno(m.mes)} (acumulado)` : mesAno(m.mes), m.vm1, m.vm2, m.vmSoma]),
                casas: [null, 0, 0, 0],
                limite: meses.length,
              }}
              complemento={
                <>
                  <Lacunas
                    id="lacunas-valores"
                    titulo="Quase tudo o que se esperaria desta seção não existe na fonte"
                    itens={[
                      { falta: "Valor original da dívida", porque: "a base publica somente o valor depois do desconto", precisaria: "coluna de valor antes do desconto na divulgação do Banco Central" },
                      { falta: "Desconto médio e mediano por operação", porque: `sem valor original, o desconto é indeterminável; o que existe é o desconto médio ofertado no leilão da Faixa 1, que é agregado e de outra fonte (${t(leilaoDepois.nota)})` },
                      { falta: "Entrada, parcelas, valor da parcela, taxa de juros e prazo", porque: "não há essas colunas" },
                      { falta: "Histogramas, percentis e faixas de valor", porque: "a divulgação é agregada por célula, sem microdado nem distribuição publicada" },
                    ]}
                  />
                  <TabelaDados
                    recolhida={false}
                    id="conceitos"
                    tituloVisivel="Os conceitos que não se confundem"
                    titulo="Conceitos de valor em uma renegociação e o que está na base"
                    colunas={["Conceito", "O que é", "Está nesta base?"]}
                    linhas={[
                      ["Valor original", "Quanto a pessoa devia antes de qualquer abatimento.", "Não"],
                      ["Valor após desconto", "O que virou a nova operação de crédito.", "Sim: é o que esta base publica"],
                      ["Valor efetivamente pago", "Quanto entrou no caixa do credor ao longo do acordo.", "Não"],
                      ["Desconto nominal", "A diferença entre original e renegociado: o abatimento concedido pelo credor.", "Não"],
                      ["Perda econômica do credor", "Quanto o credor deixou de receber em relação ao que esperava receber, que normalmente é menor que o desconto nominal, porque dívida negativada antiga vale pouco.", "Não"],
                      ["Custo fiscal", "Dinheiro público efetivamente gasto. Desconto de credor privado não é gasto público e não deve ser somado a ele.", "Não"],
                    ]}
                  />
                </>
              }
            >
              <GraficoLinhas
                semTabela
                titulo="Valor médio por operação renegociada, por mês"
                dados={meses.map((m) => ({ mes: m.mes, soma: m.vmSoma, f1: m.vm1, f2: m.vm2 }))}
                chaveX="mes"
                formatoX="mes"
                series={seriesFaixa}
                unidade="R$ por operação"
                casas={0}
                zeroNoEixo
                zoom
                legendaInterativa
                ocultasIniciais={["f1", "f2"]}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="onde"
              pergunta="Onde as renegociações aconteceram?"
              subtitulo={`Renegociações por unidade da federação do tomador · quatro medidas · 27 UFs, faixas 1 e 2, ${periodoScr}`}
              natureza="OBSERVADO"
              proveniencia={provBcb("Operações, volume após desconto e valor médio por unidade da federação", "OBSERVADO", "operações, R$ e operações por mil habitantes", ["UF é a menor granularidade geográfica publicada.", g.aviso_cobertura])}
              complementares={[
                {
                  rotulo: "Sobre a população",
                  p: provDesenrola(g, "ibge", {
                    indicador: "Operações por mil habitantes",
                    natureza: "CALCULADO",
                    unidade: "operações por mil habitantes",
                    inicio: g.data_base_min,
                    fim: g.data_base,
                    formula: "1000 × operações ÷ população",
                    limitacoes: ["O denominador é a população total, não o público elegível, que não é publicado por UF. Serve para comparar intensidade relativa, não para medir adesão."],
                  }),
                },
              ]}
              leitura={
                <LeituraGuiada>
                  {ufs[0].nome} concentra {n(ufs[0].part_op, 1)}% das operações do país ({n(ufs[0].operacoes)}). Por mil habitantes, a mesma UF tem {ufs[0].op_por_mil_hab === null ? "valor não publicado" : n(ufs[0].op_por_mil_hab, 1)} operações.
                </LeituraGuiada>
              }
              comoInterpretar="As classes do mapa são quantis das 27 UFs: a concentração em São Paulo apagaria as demais numa escala linear. As barras seguem a ordem do número de operações em todas as medidas."
              naoConcluir="onde a adesão foi maior. O denominador de operações por mil habitantes é a população total, não o público elegível, que não é publicado por UF; a medida compara intensidade relativa, não taxa de adesão."
              tabela={{
                titulo: `Renegociações do Desenrola por unidade da federação, faixas 1 e 2, ${periodoScr}`,
                colunas: ["UF", "Operações", "% das operações do país", "Volume após desconto (R$ milhões)", "Valor médio (R$)", "Operações por mil habitantes"],
                linhas: ufs.map((u) => [`${u.nome} (${u.uf})`, u.operacoes, u.part_op, u.volume / 1e6, u.ticket_medio, u.op_por_mil_hab]),
                casas: [null, 0, 2, 1, 0, 1],
                limite: ufs.length,
              }}
              complemento={
                <Lacunas
                  id="lacunas-perfil"
                  titulo="Perfil dos beneficiários: a fonte não traz nenhuma variável demográfica"
                  itens={[
                    { falta: "Sexo, idade, faixa de renda e inscrição no CadÚnico", porque: "a base tem sete colunas e nenhuma é demográfica", precisaria: "tabulação demográfica agregada publicada pelo Banco Central, com supressão de células pequenas" },
                    { falta: "Município", porque: "UF é a menor granularidade geográfica publicada" },
                    { falta: "Produto de crédito da dívida renegociada", porque: "não há coluna de modalidade" },
                    { falta: "Antiguidade da dívida e quantidade anterior de dívidas", porque: "a base descreve a operação nova, não o histórico do devedor" },
                  ]}
                />
              }
            >
              <MapaPorUf
                ufs={ufs.map((u) => ({ cod: u.cod, uf: u.uf, nome: u.nome, operacoes: u.operacoes, porMil: u.op_por_mil_hab, valorMedio: u.ticket_medio, volume: u.volume / 1e6 }))}
                periodo={periodoScr}
                nota="Classes por quantis das 27 UFs. O denominador de operações por mil habitantes é a população total, não o público elegível."
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="credores"
              pergunta="Quais credores informam renegociações ao SCR?"
              subtitulo={`Participação de cada grupo credor nas operações · % das operações · ${n(K.n_conglomerados)} grupos credores, faixas 1 e 2, ${periodoScr}`}
              natureza="CALCULADO"
              proveniencia={provBcb("Participação de cada conglomerado nas operações e concentração entre credores", "CALCULADO", "% das operações e índice HHI", [K.nota_consolidacao, "Mede concentração entre os credores que informam ao SCR. Credores não financeiros participaram do programa e não estão neste denominador."], "operações do grupo divididas pelas operações das faixas 1 e 2; HHI é a soma dos quadrados das participações em %")}
              leitura={
                <LeituraGuiada>
                  {nomeCredor(insts[0])} tem {n(insts[0].part_op, 1)}% das operações. Os cinco maiores grupos somam {n(K.top5_operacoes, 1)}% entre os {n(K.n_conglomerados)} que informam ao SCR.
                </LeituraGuiada>
              }
              ressalva={`isto não é um ranking de melhores e piores. Conglomerados têm carteiras, públicos e composições de produto diferentes: quem tinha muitos clientes de baixa renda com dívida pequena aparece com muitas operações e valor médio baixo, e isso descreve a carteira, não a qualidade da atuação. Além disso, os credores não financeiros do programa (varejo, serviços, telecomunicações) não informam ao SCR e não estão em nenhuma linha${credoresLeilao ? `: o leilão da Faixa 1 teve ${credoresLeilao} credores, e aqui aparecem ${n(K.n_conglomerados)}` : ""}.`}
              comoInterpretar={t(K.nota_consolidacao)}
              naoConcluir="qual credor concedeu mais desconto, nem a concentração do programa como um todo. A participação mede o peso entre os credores que informam ao SCR; os não financeiros ficam fora do denominador."
              tabela={{
                titulo: `Grupos credores do Desenrola no SCR, faixas 1 e 2, ${periodoScr}`,
                colunas: ["Grupo credor", "Operações", "% das operações", "Volume após desconto (R$ milhões)", "% do volume", "Valor médio (R$)", "Operações na Faixa 1", "Operações na Faixa 2", "UFs"],
                linhas: insts.map((i) => [nomeCredor(i), i.operacoes, i.part_op, i.volume / 1e6, i.part_vol, i.ticket_medio, i.por_faixa.faixa1?.operacoes ?? null, i.por_faixa.faixa2?.operacoes ?? null, i.ufs]),
                casas: [null, 0, 2, 2, 2, 0, 0, 0, 0],
                limite: insts.length,
              }}
              complemento={
                <>
                  <FaixaNumeros rotulo="Concentração entre os credores que informam ao SCR">
                    <NumeroIndicador rotulo="Operações nos cinco maiores grupos" valor={K.top5_operacoes} formato="percentual" casas={1} unidade="das operações" periodo={periodoScr} recorte="faixas 1 e 2" fonte="Banco Central, Desenrola Brasil (SCR)" natureza="CALCULADO" tamanho="m" />
                    <NumeroIndicador
                      rotulo="Índice de concentração (HHI)"
                      valor={K.hhi_operacoes}
                      casas={0}
                      unidade="de 0 a 10.000"
                      periodo={periodoScr}
                      recorte={`${n(K.n_conglomerados)} grupos`}
                      fonte="Banco Central, Desenrola Brasil (SCR)"
                      natureza="CALCULADO"
                      nota="Acima de 1.800 costuma ser lido como concentração alta em análise antitruste, referência que aqui serve só de régua."
                      tamanho="m"
                    />
                  </FaixaNumeros>
                  <Texto>
                    A concentração mede o peso entre os credores que informam ao SCR. Como os não financeiros ficam fora do denominador, ela não descreve a concentração do programa como um todo.
                  </Texto>
                  <CompararCredores
                    periodo={periodoScr}
                    credores={insts.slice(0, 20).map((i) => ({
                      cod: i.cod,
                      nome: i.nome,
                      consolidado: Boolean(i.consolidado),
                      operacoes: i.operacoes,
                      partOp: i.part_op,
                      volume: i.volume / 1e6,
                      partVol: i.part_vol,
                      valorMedio: i.ticket_medio,
                      faixa1: i.por_faixa.faixa1?.operacoes ?? null,
                      faixa2: i.por_faixa.faixa2?.operacoes ?? null,
                      ufs: i.ufs,
                    }))}
                  />
                  {consolidados.length > 0 && (
                    <TabelaDados
                      titulo={`Componentes das ${n(consolidados.length)} linhas consolidadas`}
                      colunas={["Grupo credor", "Componente informado ao SCR", "Operações", "Volume após desconto (R$ milhões)"]}
                      linhas={consolidados.flatMap((i) => i.consolidado!.componentes.map((c) => [i.nome, c.nome, c.operacoes, c.volume / 1e6]))}
                      casas={[null, null, 0, 2]}
                      limite={consolidados.length * 4}
                      nota={t(consolidados[0].consolidado!.nota)}
                    />
                  )}
                  <Lacunas
                    id="lacunas-credores"
                    titulo="O que não dá para comparar entre instituições"
                    itens={[
                      { falta: "Desconto médio concedido por cada credor", porque: "exigiria o valor original, que a base não publica" },
                      { falta: "Regularidade e inadimplência posteriores dos acordos", porque: "a base registra a contratação e não acompanha a operação depois" },
                      { falta: "Renegociação como proporção da carteira", porque: "o conglomerado do Desenrola é o financeiro e a carteira do IF.data é do prudencial: os perímetros não coincidem", precisaria: "chave de correspondência entre os dois perímetros publicada pelo Banco Central" },
                    ]}
                  />
                </>
              }
            >
              <GraficoBarras
                semTabela
                titulo="Participação de cada grupo credor nas operações do Desenrola informadas ao SCR"
                dados={insts.map((i) => ({ cod: i.cod, nome: nomeCredor(i), part: i.part_op }))}
                chaveCategoria="cod"
                chaveRotulo="nome"
                series={[{ id: "part", rotulo: "Participação nas operações", cor: "var(--cor-energia)" }]}
                unidade="% das operações"
                casas={1}
                orientacao="horizontal"
                alturaCategoria={32}
                limiteInicial={12}
                rotulosValor
                rotulosSaoNomes
              />
            </FiguraAnalitica>

            {contexto.length > 0 && (
              <FiguraAnalitica
                id="contexto"
                pergunta="O que aconteceu com o crédito das famílias no período?"
                subtitulo={`Cinco séries do crédito a pessoas físicas, com as datas do programa marcadas · unidade de cada série · Brasil, ${mesAno(contexto[0].inicio)} a ${mesAno(contexto[0].fim)}`}
                natureza="OBSERVADO"
                proveniencia={provDesenrola(g, "sgs", {
                  indicador: "Séries de contexto do crédito a pessoas físicas",
                  natureza: "OBSERVADO",
                  unidade: "varia conforme a série",
                  inicio: contexto[0].inicio,
                  fim: contexto.reduce((f, s) => (s.fim > f ? s.fim : f), contexto[0].fim),
                  recurso: `Séries ${contexto.map((s) => s.codigo).filter(Boolean).join(", ")}`,
                  limitacoes: ["Séries agregadas do país: não identificam quem participou do programa.", "As séries têm datas finais diferentes; cada uma vai até o último mês publicado."],
                })}
                leitura={
                  <LeituraGuiada>
                    O programa ocorreu de {periodoPrograma}. As marcas indicam o anúncio, a abertura da Faixa 1 e o fim do prazo; a página mostra as séries e marca as datas, e nada além disso é afirmado.
                  </LeituraGuiada>
                }
                comoInterpretar="Três níveis de evidência, nunca misturados: o que se observa nas séries, o que é movimento simultâneo e o que vem de avaliação com desenho experimental. Movimentos simultâneos ao programa têm muitas causas concorrentes no mesmo período: ciclo da Selic, massa salarial, safra de crédito consignado e mudanças regulatórias do cartão."
                naoConcluir="que o Desenrola causou a variação de qualquer uma destas séries. Coincidência temporal não é efeito: nenhuma variação agregada observada nessa janela pode ser atribuída ao programa sem um grupo de comparação."
                tabela={{
                  titulo: "Séries de contexto do crédito a pessoas físicas, por mês",
                  colunas: ["Mês", ...contexto.map((s) => `${s.rotulo} (${s.unidade})`)],
                  linhas: mesesContexto.map((mes) => [mesAno(mes), ...contexto.map((s) => s.pontos.find((p) => p.mes === mes)?.v ?? null)]),
                  casas: [null, ...contexto.map((s) => s.casas)],
                  limite: 24,
                }}
                complemento={
                  <>
                    <Texto>
                      <span className="font-medium text-carvao">Evidências descritivas (reportado).</span> O que se observa nas séries: o programa ocorreu entre julho de 2023 e maio de 2024, e as séries de inadimplência, endividamento e comprometimento de renda seguem seus próprios caminhos nesse intervalo.
                    </Texto>
                    <Texto>
                      <span className="font-medium text-carvao">Associações.</span> {t(g.selos.associacao)} Nenhuma variação agregada observada nessa janela pode ser atribuída ao Desenrola sem um grupo de comparação.
                    </Texto>
                    <TabelaDados
                      recolhida={false}
                      id="avaliacao"
                      tituloVisivel="Evidência causal disponível"
                      titulo={`Achados do ${t(A.titulo)}`}
                      lead={
                        <>
                          <span className="block">
                            <span className="font-medium text-carvao">{t(A.titulo)}</span>, de {t(A.autores)}, publicado em {dataBr(A.publicado)}.
                          </span>
                          <span className="mt-2 block border-l border-carvao pl-4 text-carvao">
                            <span className="font-medium">Atenção ao objeto.</span> {t(A.objeto)}
                          </span>
                          <span className="mt-2 block">
                            <span className="font-medium text-carvao">Desenho:</span> {t(A.desenho)}
                          </span>
                        </>
                      }
                      colunas={["Achado", "Tipo de evidência", "Força da inferência"]}
                      linhas={(A.resultados as { achado: string; selo: string; forca: string }[]).map((r) => [t(r.achado), NOME_DO_SELO[r.selo] ?? r.selo, t(r.forca)])}
                      nota={
                        <>
                          <span className="font-medium text-carvao">Conclusão dos autores:</span> {t(A.conclusao_dos_autores)} <span className="font-medium text-carvao">O que continua sem resposta.</span> {t(A.limite)}{" "}
                          <a href={A.url} className={link} rel="noopener noreferrer">
                            Relatório completo (PDF, Ministério do Planejamento e Orçamento)
                          </a>
                          .
                        </>
                      }
                    />
                  </>
                }
              >
                <LinhasComSeletor
                  rotulo="Série de contexto"
                  titulo="Série de contexto, com os marcos do programa"
                  inicial={contexto[0].chave}
                  marcos={[{ x: "2023-07", rotulo: "anúncio" }, { x: "2023-10", rotulo: "Faixa 1" }, { x: "2024-05", rotulo: "fim" }]}
                  opcoes={contexto.map((s) => {
                    const ultimo = [...s.pontos].reverse().find((p) => p.v !== null);
                    return {
                      id: s.chave,
                      nome: s.rotulo,
                      unidade: s.unidade,
                      casas: s.casas,
                      dados: s.pontos.map((p) => ({ mes: p.mes, v: p.v })),
                      series: [{ id: "v", rotulo: s.rotulo, cor: "var(--serie-1)" }],
                      frase: `${s.rotulo}: ${ultimo ? `${n(ultimo.v as number, s.casas)}${s.unidade.startsWith("%") ? "" : " "}${s.unidade} em ${mesAno(ultimo.mes)}` : "sem valor publicado"}${s.codigo ? ` (Banco Central, SGS, série ${s.codigo})` : ""}. Os marcos indicam quando o programa aconteceu; coincidência temporal não é efeito.`,
                    };
                  })}
                />
              </FiguraAnalitica>
            )}

            <FiguraAnalitica
              id="viabilidade"
              pergunta="O que os dados públicos permitem medir do programa?"
              subtitulo={`Indicadores esperados de um painel do Desenrola, por situação · número de indicadores · ${n(matriz.length)} indicadores em ${n(areas.length)} áreas`}
              natureza="CALCULADO"
              proveniencia={provBcb("Matriz de viabilidade dos indicadores do Desenrola", "CALCULADO", "indicadores", ["A classificação de cada indicador é da Scrutiniums, a partir da documentação das fontes públicas; não é dado publicado por elas."], "contagem de indicadores por área e situação")}
              leitura={
                <LeituraGuiada>
                  Dos {n(matriz.length)} indicadores que se esperaria de um painel do Desenrola, {n(contar(null, "viavel"))} são viáveis com a fonte pública, {n(contar(null, "parcial"))} são parciais e {n(contar(null, "indisponivel"))} estão indisponíveis.
                </LeituraGuiada>
              }
              comoInterpretar="Viável é o indicador que a fonte pública permite calcular; parcial é o que existe com ressalva de conceito ou de perímetro; indisponível é o que nenhuma base aberta permite. A lista completa, com a base ou o motivo de cada um, está logo abaixo."
              naoConcluir="que o programa não teve resultado onde o indicador falta. Indisponível descreve a base pública, não o programa: a ausência do dado não é evidência de ausência de efeito."
              tabela={{
                titulo: "Indicadores por área e situação",
                colunas: ["Área", "Viáveis", "Parciais", "Indisponíveis"],
                linhas: areas.map((a) => [a, contar(a, "viavel"), contar(a, "parcial"), contar(a, "indisponivel")]),
                casas: [null, 0, 0, 0],
              }}
              complemento={
                <TabelaDados
                  titulo={`Os ${n(matriz.length)} indicadores, um a um`}
                  colunas={["Área", "Indicador", "Situação", "Base ou motivo"]}
                  linhas={matriz.map((m) => [m.area, t(m.indicador), NOME_DA_SITUACAO[m.status], t([m.base, m.falta].filter(Boolean).join(". "))])}
                  limite={matriz.length}
                />
              }
            >
              <GraficoBarras
                semTabela
                titulo="Indicadores do Desenrola por área e situação"
                dados={areas.map((a) => ({ area: a, viavel: contar(a, "viavel"), parcial: contar(a, "parcial"), indisponivel: contar(a, "indisponivel") }))}
                chaveCategoria="area"
                series={[
                  { id: "viavel", rotulo: "Viáveis", cor: "var(--cor-energia)" },
                  { id: "parcial", rotulo: "Parciais", cor: "var(--serie-2)" },
                  { id: "indisponivel", rotulo: "Indisponíveis", cor: "var(--serie-4)" },
                ]}
                unidade="indicadores"
                casas={0}
                orientacao="horizontal"
                empilhado
                rotulosValor
              />
            </FiguraAnalitica>
          </>
        }
        tabelas={
          <>
            <TabelaDados
              recolhida={false}
              id="arquitetura"
              tituloVisivel="Arquitetura do programa"
              titulo="Componentes do Desenrola Brasil para pessoas físicas, lado a lado"
              lead={`O Desenrola Brasil foi criado em 2023 para quem tinha dívidas pequenas e atrasadas e, por causa da negativação, ficava fora do crédito, do aluguel e às vezes do emprego. O Estado entrou com garantia e com um leilão em que os credores disputavam oferecer o maior desconto. Os componentes têm coberturas diferentes e nunca são somados.`}
              colunas={["Atributo", ...componentesPf.map((c) => String(c.nome))]}
              linhas={[
                ...ATRIBUTOS.map(([rotulo, campo]) => [rotulo, ...componentesPf.map((c) => t(c[campo]))]),
                ["Operações no SCR", ...componentesPf.map((c) => (c.no_scr ? n(Number(c.operacoes)) : semDadoPublico))],
                ["Volume após desconto", ...componentesPf.map((c) => (c.no_scr ? moeda(Number(c.volume)) : semDadoPublico))],
                ["Valor médio por operação", ...componentesPf.map((c) => (c.no_scr ? `R$ ${n(Number(c.ticket_medio))}` : semDadoPublico))],
              ]}
              fixarPrimeiraColuna
              nota={
                <>
                  Operações, volume e valor médio são do SCR, de {periodoScr}.{" "}
                  {componentesPf.filter((c) => c.alerta).map((c) => (
                    <span key={String(c.id)}>
                      <span className="font-medium text-carvao">{String(c.nome)}:</span> {t(c.alerta)}{" "}
                    </span>
                  ))}
                </>
              }
            />
            {PN && (
              <TabelaDados
                recolhida={false}
                id="pequenos-negocios"
                tituloVisivel={`Quadro de contexto: ${PN.nome}`}
                titulo={`${PN.nome} na base do Banco Central`}
                lead={
                  <>
                    <span className="font-medium text-carvao">Programa diferente.</span> {t(g.aviso_tipo3)}
                  </>
                }
                colunas={["Programa", "Público", "Período na base", "Operações", "Volume (R$ milhões)", "Valor médio (R$)", "Grupos credores"]}
                linhas={[[PN.nome, t(PN.publico), t(PN.periodo_scr), PN.operacoes, PN.volume / 1e6, PN.ticket_medio, PN.conglomerados]]}
                casas={[null, null, null, 0, 1, 0, 0]}
                nota={`O valor médio por operação é cerca de ${n(vezesPequenosNegocios)} vezes o das faixas de pessoa física, o que mostra que são universos distintos. Estes números não entram em nenhum total desta página.`}
              />
            )}
            <TabelaDados
              recolhida={false}
              id="linha-do-tempo"
              tituloVisivel="Linha do tempo"
              titulo="Linha do tempo do Desenrola Brasil"
              lead="Cada marco com a fonte que o sustenta."
              colunas={["Data", "Marco", "O que aconteceu", "Fonte"]}
              linhas={(g.linha_do_tempo as { data: string; rotulo: string; detalhe: string; fonte: string }[]).map((e) => [dataBr(e.data), t(e.rotulo), t(e.detalhe), t(e.fonte)])}
              limite={g.linha_do_tempo.length}
            />
            <Lacunas
              id="depois"
              titulo="O que aconteceu depois da renegociação"
              lead={
                <>
                  <span className="block">
                    Esta seria a seção central de um painel de avaliação: quantos acordos continuaram regulares, quantos voltaram a atrasar, quanto foi liquidado, quem voltou a tomar crédito. A base do Banco Central informa a renegociação no mês em que ela ocorreu e não acompanha a operação depois. Não há coorte, não há curva de sobrevivência e não há reincidência, não porque o cálculo seja difícil, mas porque o dado longitudinal por operação é sigiloso.
                  </span>
                  <span className="mt-2 block">
                    Construir esta seção com o que existe exigiria comparar coortes por aproximação agregada, o que produziria uma curva plausível e sem sustentação. O Observatório não faz isso: a ausência fica declarada. Abaixo, o que seria preciso para responder.
                  </span>
                </>
              }
              itens={[
                { falta: "Permanência do acordo em situação regular após 3, 6, 12, 18 e 24 meses", porque: "não há painel por operação", precisaria: "série de estoque e situação das operações do programa por safra de contratação" },
                { falta: "Atraso acima de 15, 30 e 90 dias e entrada em prejuízo", porque: "a base não traz situação da operação", precisaria: "as mesmas variáveis que o SCR.data já publica por modalidade, recortadas para o programa" },
                { falta: "Novo crédito obtido, exposição total e número de relacionamentos", porque: "exigiria ligar o beneficiário a operações posteriores", precisaria: "microdado individual, que é sigiloso por lei" },
              ]}
              nota={
                <>
                  <span className="font-medium text-carvao">Uma advertência de leitura, para quando o dado existir.</span> Nova concessão de crédito a quem renegociou não significa, por si, melhora de bem-estar: pode ser recomposição de dívida. E aumento do endividamento não é automaticamente deterioração: pode ser retorno ao crédito formal, mais barato que a alternativa informal. Qualquer leitura desses números precisa dizer qual das duas histórias está contando e por quê.
                </>
              }
            />
            <Lacunas
              id="fiscal"
              titulo="Garantias e dimensão fiscal"
              lead={
                <>
                  <span className="block">
                    A Faixa 1 teve garantia do Fundo Garantidor de Operações (FGO): o Estado assumiu parte do risco para que os credores aceitassem descontos grandes em dívidas antigas. Quanto disso virou desembolso efetivo é uma pergunta legítima e sem resposta em base pública desagregada.
                  </span>
                  <span className="mt-2 block border-l border-carvao pl-4 text-carvao">
                    <span className="font-medium">Não há número aqui porque não há dado, e estimar seria pior.</span> Preencher esta seção com aproximações a partir do volume renegociado produziria um custo fiscal que ninguém mediu.
                  </span>
                </>
              }
              itens={[
                { falta: "Valor garantido e operações cobertas pelo FGO no âmbito do programa", porque: "não publicado de forma desagregada", precisaria: "relatórios do fundo garantidor com identificação do Desenrola" },
                { falta: "Garantias acionadas, recuperações e perdas realizadas", porque: "não publicado", precisaria: "demonstrações do FGO segregadas por programa" },
                { falta: "Custo fiscal bruto, líquido e por beneficiário", porque: "depende dos itens acima", precisaria: "execução orçamentária do subsídio com identificação do programa" },
                { falta: "Alavancagem entre recurso público e dívida renegociada", porque: "o numerador é justamente o que falta" },
              ]}
              nota={
                <>
                  <span className="font-medium text-carvao">Desconto de credor não é gasto público.</span> Os {moeda(leilaoAntes.valor, 0)} que caíram para cerca de {moeda(leilaoDepois.valor, 0)} no leilão da Faixa 1 ({t(leilaoAntes.fonte)}) são abatimento concedido por credores privados sobre dívidas em boa parte já provisionadas. Chamar essa diferença de custo do programa confundiria renúncia privada com desembolso do Tesouro.
                </>
              }
            />
          </>
        }
        notas={{
          id: "como-ler",
          titulo: "Como ler estes números",
          itens: (g.como_ler as [string, string][]).map(([termo, definicao]) => ({ termo: t(termo), definicao: t(definicao) })),
        }}
        metodo={
          <>
            <p>
              Fonte principal: {t(g.fonte)} (
              <a href={g.url_dataset} className={link} rel="noopener noreferrer">
                página do conjunto de dados
              </a>
              ), licença {t(g.licenca)}. Números do programa inteiro: Relatório de Avaliação MPO/BID/BCB e Exposição de Motivos 1199/2023. População: {t(g.geo?.populacao_fonte ?? "IBGE SIDRA 6579")}. Leitura da Scrutiniums em {dataBr(g.gerado_em)}.
            </p>
            <div data-procedencia="">
              <p className="font-medium text-carvao">Procedência e tratamento</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  Coleta em {dataHoraBrasilia(g.coletado_em)} (horário de Brasília). O arquivo bruto fica preservado com endereço e data; o identificador de integridade (sha256) começa por <code>{String(g.bronze_sha ?? "").slice(0, 16)}</code>.
                </li>
                <li>
                  Cobertura: {n(g.meses)} datas-base de {periodoScr}, sem meses ausentes, com {n(g.linhas_base)} células na base.
                </li>
                <li>Chave: data-base, faixa, UF e conglomerado, verificada como única na origem.</li>
                <li>Revisões: a fonte republica a série inteira a cada mês e o Banco Central reflete retificações das entidades remetentes. Por isso a absorção substitui a série completa em vez de acumular, e o identificador do arquivo distingue cada versão.</li>
                <li>Quebra declarada: {t(g.aviso_setembro)}</li>
                <li>Valores nominais, sem deflação: meses distantes não são diretamente comparáveis em poder de compra.</li>
                <li>Sigilo: a divulgação já vem agregada pelo Banco Central; o Observatório não recebe nem produz dado individual.</li>
              </ul>
            </div>
            <div data-selos="">
              <p className="font-medium text-carvao">O que os selos significam</p>
              <dl className="mt-2 space-y-1.5">
                {Object.entries(g.selos as Record<string, string>).map(([k, v]) => (
                  <div key={k}>
                    <dt className="inline font-medium text-carvao">{NOME_DO_SELO[k] ?? k}: </dt>
                    <dd className="inline">{t(v)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2">Nos números e figuras desta página, o que a base chama de reportado aparece com o selo Observado da plataforma, que tem a mesma definição: valor divulgado diretamente pela fonte oficial. A exceção é o número oficial que a própria fonte apresenta como estimativa, que aparece com o selo Estimado. Os números oficiais de abertura são declarações dos documentos citados, não contagens da base do Banco Central.</p>
            </div>
            <div data-dicionario="">
              <p className="font-medium text-carvao">Dicionário dos indicadores</p>
              <ul className="mt-2 space-y-3">
                {(g.catalogo as Record<string, string>[]).map((c) => (
                  <li key={c.id}>
                    <span className="font-medium text-carvao">{t(c.nome)}</span> ({NOME_DO_SELO[c.selo] ?? c.selo}). {t(c.definicao)} Fórmula: <code>{c.formula}</code>. Unidade: {t(c.unidade)}. Análise por {t(c.unidade_analise)}. Periodicidade: {t(c.periodicidade)}. Cobertura: {t(c.cobertura)}. Fonte: {t(c.fonte)}. Limitações: {t(c.limitacoes)}
                  </li>
                ))}
              </ul>
            </div>
            <p>
              O painel{" "}
              <Link href="/divida-das-familias" prefetch={false} className={link}>
                Dívida das famílias
              </Link>{" "}
              traz o peso das dívidas na renda e os juros médios. Método do crédito em{" "}
              <Link href="/observatorio-do-credito/metodologia" prefetch={false} className={link}>
                Metodologia e fontes do Crédito
              </Link>
              .
            </p>
          </>
        }
      />
    </>
  );
}
