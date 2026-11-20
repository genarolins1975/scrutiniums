import type { Metadata } from "next";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import Link from "next/link";
import type { ReactNode } from "react";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { FaixaNumeros, FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, NumeroIndicador, PaginaPainel, TabelaDados } from "@/components/painel";
import { DispersaoEstados } from "@/components/familias/consignado/DispersaoEstados";
import { ExploradorMunicipios } from "@/components/familias/consignado/ExploradorMunicipios";
import { COLUNAS_SENSIBILIDADE, ROTULO_CONFIABILIDADE, ROTULO_SATURACAO, linhaSensibilidade, moeda, n } from "@/components/familias/consignado/camadas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { dataBr, mesAno } from "@/lib/perguntas/leitura";
import { DicaRolagem } from "@/components/familias/DicaRolagem";
import { DESCRICAO_CONSIGNADO, PERGUNTA_CONSIGNADO, ROTA_CONSIGNADO, dadosConsignado, marcosNoGrafico, provConsignado } from "@/lib/familias/consignado";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: tituloNaColecao(PERGUNTA_CONSIGNADO, ROTA_CONSIGNADO),
  description: DESCRICAO_CONSIGNADO,
  alternates: { canonical: ROTA_CONSIGNADO },
};

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";
const TIPO_NORMA: Record<string, string> = { margem: "margem", teto: "teto de juros", prazo: "prazo", fraude: "antifraude", sancao: "sanção" };
const SGS = (codigo: number) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json`;

/** Texto que vem da gold, na forma da plataforma: sem travessão, sinal de menos tipográfico nos negativos e mês como "set/2026". */
const t = (s: string) =>
  String(s)
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/(^|[\s(])-(\d)/g, "$1−$2")
    .replace(/\b(\d{4})-(\d{2})\b(?!-\d)/g, (_, ano: string, mes: string) => mesAno(`${ano}-${mes}`));
/** Saldo em R$ bilhões a partir do valor em R$ milhões da gold do SGS. */
const biDeMilhoes = (v: number) => `R$ ${n(v / 1000, 1)} bi`;

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

/**
 * Painel "Consignado e aposentados" (Observatório das Famílias, coleção Dívida e crédito das famílias), com conta. Reescrita no molde
 * de painel da vista `consignado` da aplicação do Crédito (public/obs/app.js, renderConsignado; decisão do dono de 10/11/2026): a mesma
 * gold (public/obs/data/gold/consignado.json), os mesmos valores e as mesmas ressalvas, organizados por pergunta. O recorte municipal
 * (consignado_mun.json) fica fora do HTML: o servidor publica o resumo do recorte padrão e o explorador o carrega sob demanda.
 */
export default function ConsignadoPage() {
  const { g, resumo, marcosRegulacao } = dadosConsignado();
  const B = g.brasil, G = g.sgs, a = G.atual, S = g.scr, C = g.circularidade, I = g.instituicoes, R = g.reclamacoes, T = g.totais;
  const mesSgs = mesAno(G.data_base), mesScr = mesAno(S.data_base), dez = `dez/${g.ano}`;
  const saldo = G.series.saldo as { d: string; inss: number; publico: number; privado: number }[];
  const marcosDaSerie = [
    ...(g.linha_do_tempo as { d: string; t: string; tipo: string }[]).filter((e) => e.d >= saldo[0].d && e.tipo === "margem").map((e) => ({ x: e.d.slice(0, 7), rotulo: e.t })),
    ...marcosRegulacao,
  ];
  // no gráfico, só os marcos que cabem sem um rótulo cobrir o outro, cada um com o número de ordem; o texto vai na lista abaixo do gráfico
  const marcos = marcosNoGrafico(marcosDaSerie, saldo[0].d, saldo[saldo.length - 1].d);
  const estados = (g.estados as { uf: string; nome: string; outras_censo: number | null; cons_por_60: number | null; a60: number }[]).filter((e) => e.outras_censo != null && e.cons_por_60 != null);
  const ref = (C.especificacoes as { referencia: boolean; r: number }[]).find((e) => e.referencia);
  const classes = ["baixa_penetracao", "penetracao_elevada", "possivel_saturacao"] as const;
  const semClasse = T.municipios - classes.reduce((s, k) => s + T.saturacao[k], 0);
  const cr = g.saturacao_criterios;
  const ranking = I.ranking as { cnpj8: string; nome: string; taxa_am: number; taxa_aa: number; posicao: number; vs_mediana: number }[];
  const janela = `${dataBr(I.janela.inicio)} a ${dataBr(I.janela.fim)}`;
  const periodoRec = `${mesAno(R.de)} a ${mesAno(R.ate)}`;
  // Auditoria de 10/11/2026, achado 8: o intervalo esconde mês sem publicação. Os meses publicados e os ausentes saem da lista de
  // competências da gold; mês ausente não é mês com zero reclamação.
  const competencias = R.competencias as string[];
  const mesesDoIntervalo: string[] = [];
  for (let [ano, mes] = [Number(String(R.de).slice(0, 4)), Number(String(R.de).slice(5, 7))]; `${ano}-${String(mes).padStart(2, "0")}` <= String(R.ate).slice(0, 7); mes === 12 ? ((ano += 1), (mes = 1)) : (mes += 1))
    mesesDoIntervalo.push(`${ano}-${String(mes).padStart(2, "0")}`);
  const mesesAusentes = mesesDoIntervalo.filter((m) => !competencias.includes(m));
  const lista = (itens: string[]) => (itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`);
  const coberturaRec =
    mesesAusentes.length === 0
      ? `Os ${competencias.length} meses do período estão publicados.`
      : `${competencias.length} dos ${mesesDoIntervalo.length} meses do período estão publicados; ${lista(mesesAusentes.map(mesAno))} não ${mesesAusentes.length === 1 ? "está" : "estão"} na base. Mês ausente não é mês sem reclamação.`;
  const periodoRecNumero = mesesAusentes.length === 0 ? periodoRec : `${periodoRec}, sem ${lista(mesesAusentes.map(mesAno))}`;
  // Auditoria de 10/11/2026, achado 12: a última faixa do gráfico (recorte sem confiabilidade baixa) e o total nacional da gold contam
  // universos diferentes; a página diz os dois lado a lado. A última faixa de FAIXAS_DEPENDENCIA é a de 50% ou mais.
  const acima50NoGrafico = resumo.faixas.at(-1) ?? null;
  const tempo = [...(g.linha_do_tempo as { d: string; t: string; tipo: string; norma: string; o: string }[])].reverse();
  const censo = (indicador: string, natureza: "OBSERVADO" | "CALCULADO", unidade: string, limitacoes: string[]) => provConsignado(g, "censo", { indicador, natureza, unidade, inicio: "2022", fim: "2022", limitacoes });

  return (
    <>
      <MarcaVisita secao="familias:consignado" />
      <header>
        <CabecalhoPlataforma observatorio="familias" destinoConta={ROTA_CONSIGNADO} fontes={["credito"]} />
        <NavegacaoColecao colecao="divida" />
      </header>
      <PaginaPainel
        rota={ROTA_CONSIGNADO}
        abertura={{
          grupo: "Dívida e crédito das famílias",
          acento: "bronze",
          titulo: PERGUNTA_CONSIGNADO,
          lead: "O que se mede do crédito consignado, dos benefícios da Previdência e do envelhecimento, no país, por estado e por município. Dado observado e estimativa aparecem sempre identificados.",
          recorte: {
            periodo: `Censo 2022, Previdência em ${dez}, crédito em ${mesSgs}`,
            universo: `Brasil, 27 unidades da federação e ${n(T.municipios)} municípios`,
            fonte: "Banco Central, IBGE, Ministério da Previdência Social e consumidor.gov.br",
          },
          limite: "que municípios com mais aposentados têm mais consignado. Não existe carteira municipal pública de consignado: por município há demografia e benefício pago; o consignado é observado por unidade da federação, e a versão municipal é estimativa.",
          fontesDatasSiglas: (
            <>
              <p>
                IBGE, Censo Demográfico 2022 (população por idade e rendimento domiciliar). Ministério da Previdência Social (MPS), Estatísticas Municipais, benefícios emitidos em dezembro de {g.ano}. Banco Central, Sistema Gerenciador de Séries Temporais (SGS), referência {mesSgs}; Sistema de Informações de Crédito (SCR), referência {mesScr}; taxas por instituição, janela de {janela}. consumidor.gov.br, {periodoRec}. Leitura da Scrutiniums em {dataBr(g.gerado_em)}.
              </p>
              <p>INSS: Instituto Nacional do Seguro Social. ICC: Indicador de Custo do Crédito, o custo da carteira existente. UF: unidade da federação. IPCA: índice oficial de preços ao consumidor.</p>
            </>
          ),
        }}
        rotuloNumeros={`Consignado no país, ${mesSgs}`}
        numeros={[
          { rotulo: "Inadimplência do consignado do INSS", valor: a.inss.inad, formato: "percentual", casas: 2, unidade: "da carteira", periodo: mesSgs, recorte: "Brasil", fonte: "Banco Central, SGS", natureza: "OBSERVADO" },
          {
            rotulo: "Inadimplência do consignado do setor privado", valor: a.privado.inad, formato: "percentual", casas: 2, unidade: "da carteira", periodo: mesSgs, recorte: "Brasil", fonte: "Banco Central, SGS", natureza: "OBSERVADO",
            nota: `${n(a.privado.inad / a.inss.inad, 1)} vezes a do INSS, no mesmo conceito do SGS.`,
          },
          {
            rotulo: "Reclamações de beneficiários do INSS sobre consignado", valor: R.total, formato: "inteiro", unidade: "reclamações", periodo: periodoRecNumero, recorte: `${n(R.municipios)} municípios`, fonte: "consumidor.gov.br", natureza: "CALCULADO",
            nota: `${coberturaRec} Mede propensão a reclamar, não incidência de problema.`,
          },
          {
            rotulo: "Carteira total do consignado", valorTexto: moeda(a.total.saldo * 1e6), formato: "texto", unidade: "de saldo", periodo: mesSgs, recorte: "Brasil", fonte: "Banco Central, SGS", natureza: "CALCULADO",
            nota: "Soma de beneficiários do INSS, trabalhadores do setor privado e servidores públicos.",
          },
        ]}
        notaNumeros="Inadimplência é a parte do saldo com atraso, não a parte das pessoas. Os quatro números têm bases e períodos próprios e não se somam."
        figuras={
          <>
            <FiguraAnalitica
              id="saldo"
              pergunta="Quanto há de consignado, e com quem?"
              subtitulo={`Saldo do crédito consignado por vínculo do tomador · R$ bilhões · Brasil, ${mesAno(saldo[0].d)} a ${mesSgs}`}
              natureza="OBSERVADO"
              proveniencia={provConsignado(g, "sgs", { indicador: "Saldo do crédito consignado por vínculo do tomador", natureza: "OBSERVADO", unidade: "R$ milhões", inicio: saldo[0].d, fim: G.data_base.slice(0, 7), limitacoes: [t(G.aviso_proxy)] })}
              leitura={
                <LeituraGuiada>
                  Em {mesSgs}, o saldo era de {biDeMilhoes(a.inss.saldo)} com beneficiários do INSS, {biDeMilhoes(a.publico.saldo)} com servidores públicos e {biDeMilhoes(a.privado.saldo)} com trabalhadores do setor privado.
                </LeituraGuiada>
              }
              comoInterpretar={`As linhas tracejadas numeradas indicam ${marcos.length} dos ${marcosDaSerie.length} marcos de margem consignável e de normas do período, os que cabem no gráfico sem que um rótulo cubra o outro; a lista abaixo do gráfico diz o que é cada número. Todos os ${tempo.length} eventos, com norma e data, estão em "Evolução regulatória", no método desta página. As marcas servem para a inspeção da série.`}
              naoConcluir="que uma norma causou a variação do saldo. Coincidência no tempo não é efeito, e a página não atribui a variação da série a nenhuma das normas marcadas."
              tabela={{
                titulo: "Saldo do consignado por vínculo do tomador (R$ bilhões)",
                colunas: ["Mês", "Beneficiários do INSS", "Servidores públicos", "Setor privado"],
                linhas: saldo.map((p) => [mesAno(p.d), p.inss / 1000, p.publico / 1000, p.privado / 1000]),
                casas: [null, 1, 1, 1],
                limite: 24,
              }}
              complemento={
                <>
                  <Texto>
                    O consignado do INSS tem medida nacional direta e observada. O que não existe é carteira municipal, nem no Banco Central, nem no INSS, nem na Dataprev. O que a página faz adiante é uma estimativa declarada, e a seção sobre a relação entre estados mostra por que ela não serve para afirmar relação entre dependência previdenciária e crédito.
                  </Texto>
                  <TabelaDados
                    recolhida={false}
                    id="vinculo"
                    tituloVisivel={`Consignado por vínculo do tomador, ${mesSgs}`}
                    lead={<DicaRolagem />}
                    titulo={`Consignado por vínculo do tomador, ${mesSgs}`}
                    colunas={["Vínculo do tomador", "Saldo (R$ bilhões)", "Inadimplência (% da carteira)", "Juros de novas operações (% ao ano)", "Prazo da concessão (meses)"]}
                    linhas={[
                      ["Beneficiários do INSS", a.inss.saldo / 1000, a.inss.inad, a.inss.taxa, a.inss.prazo_conc],
                      ["Servidores públicos", a.publico.saldo / 1000, a.publico.inad, null, null],
                      ["Trabalhadores do setor privado", a.privado.saldo / 1000, a.privado.inad, null, null],
                      ["Total", a.total.saldo / 1000, a.total.inad, a.total.taxa, null],
                    ]}
                    casas={[null, 1, 2, 2, 1]}
                    ausencia={{ "Juros de novas operações (% ao ano)": "não está nesta base", "Prazo da concessão (meses)": "não está nesta base" }}
                    destaqueUltimaLinha
                    nota={
                      <>
                        Observado. Em {mesSgs}, os juros médios das novas operações de consignado do INSS são de {n(a.inss.taxa, 2)}% ao ano (<a href={SGS(20746)} className={link} rel="noopener noreferrer">Banco Central, SGS série 20746</a>). O Indicador de Custo do Crédito (ICC), referente à carteira existente, é de {n(a.inss.icc, 2)}% ao ano (<a href={SGS(27677)} className={link} rel="noopener noreferrer">SGS série 27677</a>), no mesmo mês. São recortes distintos: contratações do mês e operações em carteira. A inadimplência do consignado do INSS é de {n(a.inss.inad, 2)}%, contra {n(a.privado.inad, 2)}% no consignado privado; o prazo médio de concessão é de {n(a.inss.prazo_conc, 1)} meses.
                      </>
                    }
                  />
                  <FaixaNumeros rotulo="Consignado de aposentados e pensionistas no SCR">
                    <NumeroIndicador
                      rotulo="Consignado de aposentados e pensionistas"
                      valorTexto={moeda(S.aposentados_nacional)}
                      formato="texto"
                      unidade="de saldo"
                      periodo={mesScr}
                      recorte="Brasil"
                      fonte="Banco Central, SCR"
                      natureza="OBSERVADO"
                      nota={`${n(S.part_aposentados, 1)}% do consignado de pessoa física. ${t(S.aviso_grupo)}`}
                    />
                  </FaixaNumeros>
                  <Nota titulo="Duas medidas distintas do mesmo público, e o motivo de não se somarem.">
                    A série do Banco Central acima registra {biDeMilhoes(a.inss.saldo)} de consignado averbado em benefício do INSS. O grupo de aposentados e pensionistas do SCR, usado adiante para o único recorte por unidade da federação que existe, soma {moeda(S.aposentados_nacional)}, {n((100 * S.aposentados_nacional) / (a.inss.saldo * 1e6), 0)}% daquele valor. Classificar pela ocupação declarada do tomador não é o mesmo que identificar a averbação em benefício.
                  </Nota>
                </>
              }
            >
              <GraficoLinhas
                semTabela
                titulo="Saldo do consignado por vínculo do tomador"
                dados={saldo.map((p) => ({ mes: p.d, inss: p.inss / 1000, publico: p.publico / 1000, privado: p.privado / 1000 }))}
                chaveX="mes"
                formatoX="mes"
                series={[
                  { id: "inss", rotulo: "Beneficiários do INSS", sigla: "INSS", cor: "var(--serie-1)" },
                  // o rótulo direto abrevia pelo começo do nome da legenda ("Servidores públicos" não cabe na margem do gráfico)
                  { id: "publico", rotulo: "Servidores públicos", sigla: "Servidores", cor: "var(--serie-2)" },
                  { id: "privado", rotulo: "Setor privado", sigla: "Privado", cor: "var(--serie-4)" },
                ]}
                unidade="R$ bilhões"
                casas={0}
                zeroNoEixo
                zoom
                marcos={marcos.map((m, i) => ({ x: m.x, rotulo: String(i + 1) }))}
              />
              <ol className="t-meta mt-3 max-w-prose2 space-y-1 text-carvao-muted" data-marcos-do-grafico="" aria-label="Marcos numerados no gráfico">
                {marcos.map((m, i) => (
                  <li key={m.x}>
                    <span className="tabular-nums text-carvao">{i + 1}.</span> {mesAno(m.x)}: {t(m.rotulo)}
                  </li>
                ))}
              </ol>
            </FiguraAnalitica>

            <FiguraAnalitica
              id="idade"
              pergunta="Quantas pessoas têm 60 anos ou mais?"
              subtitulo="População por grupo de idade, com os grupos de 60 anos ou mais em série própria · milhões de pessoas · Brasil, Censo 2022"
              natureza="OBSERVADO"
              proveniencia={censo("População por grupo quinquenal de idade", "OBSERVADO", "pessoas", ["A idade mediana é interpolada dentro do grupo quinquenal; não é a mediana do microdado."])}
              leitura={
                <LeituraGuiada>
                  {n(B.a60 / 1e6, 2)} milhões de pessoas tinham 60 anos ou mais em 2022, {n(B.p60, 1)}% do país. Os {B.piramide.length} grupos somam {n(B.populacao)} habitantes, o total do Censo.
                </LeituraGuiada>
              }
              naoConcluir="que envelhecimento é risco de crédito. A pirâmide descreve a população em 2022; não diz quem tomou empréstimo nem em que condições."
              tabela={{
                titulo: "População por grupo de idade, Brasil, Censo 2022 (pessoas)",
                colunas: ["Grupo de idade, em anos", "Pessoas"],
                linhas: (B.piramide as { g: string; pop: number }[]).map((p) => [p.g, p.pop]),
                casas: [null, 0],
                limite: B.piramide.length,
              }}
              complemento={
                <TabelaDados
                  recolhida={false}
                  id="indicadores-nacionais"
                  tituloVisivel="Indicadores nacionais de envelhecimento"
                  lead={<DicaRolagem />}
                  titulo="Indicadores nacionais de envelhecimento, Censo 2022"
                  colunas={["Indicador", "Valor", "O que mede"]}
                  linhas={[
                    ["Participação de 60 anos ou mais", `${n(B.p60, 2)}%`, "Parte da população com 60 anos ou mais"],
                    ["Participação de 65 anos ou mais", `${n(B.p65, 2)}%`, "Parte da população com 65 anos ou mais"],
                    ["Participação de 80 anos ou mais", `${n(B.p80, 2)}%`, "Parte da população com 80 anos ou mais"],
                    ["Índice de envelhecimento", n(B.envelhecimento, 1), "Pessoas de 60 anos ou mais para cada 100 de 0 a 14"],
                    ["Razão de dependência idosa", n(B.dep_idosa, 1), "Pessoas de 65 anos ou mais para cada 100 de 15 a 64"],
                    ["Idade mediana", `${n(B.idade_mediana, 1)} anos`, "Interpolada dentro do grupo quinquenal; não é a mediana do microdado"],
                  ]}
                  nota="Fonte: IBGE, Censo Demográfico 2022. Participações observadas; índice, razão e idade mediana calculados."
                />
              }
            >
              <GraficoBarras
                semTabela
                titulo="População por grupo de idade"
                dados={[...(B.piramide as { g: string; pop: number }[])].reverse().map((p) => {
                  // o realce da vista antiga: grupos a partir de 60 anos em série própria; cada grupo tem valor numa série só (séries opcionais:
                  // o nulo da outra não é lacuna)
                  const idoso = parseInt(p.g, 10) >= 60;
                  return { grupo: `${p.g} anos`, ate59: idoso ? null : p.pop / 1e6, de60: idoso ? p.pop / 1e6 : null };
                })}
                chaveCategoria="grupo"
                empilhado
                series={[
                  { id: "ate59", rotulo: "Até 59 anos", cor: "var(--cor-mineral)", opcional: true },
                  { id: "de60", rotulo: "60 anos ou mais", cor: "var(--cor-energia)", opcional: true },
                ]}
                unidade="milhões de pessoas"
                casas={2}
                orientacao="horizontal"
                alturaCategoria={26}
                alturaMaxima={640}
                rotulosValor
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="previdencia"
              pergunta="Quanto os benefícios pesam na renda dos municípios?"
              subtitulo={`Municípios por faixa do peso dos benefícios líquidos na renda domiciliar · número de municípios · ${n(resumo.base)} municípios sem confiabilidade baixa, ${dez}`}
              natureza="CALCULADO"
              proveniencia={provConsignado(g, "mps", {
                indicador: "Peso dos benefícios líquidos na renda domiciliar", natureza: "CALCULADO", unidade: "% da renda domiciliar", inicio: `${g.ano}-12`, fim: `${g.ano}-12`,
                formula: `valor líquido de benefícios de dezembro de ${g.ano}, a preços de julho de 2022 (IPCA, fator ${n(g.fator_ipca, 4)}), dividido pela renda domiciliar do Censo 2022`,
                limitacoes: ["O município do benefício é o do órgão pagador, não o de residência.", "O valor é líquido de descontos: o consignado já saiu dele.", "A contagem é de créditos emitidos, não de pessoas."],
              })}
              complementares={[{ rotulo: "Sobre a renda domiciliar", p: censo("Rendimento domiciliar", "OBSERVADO", "R$ de julho de 2022", ["O Censo não separa aposentadoria e pensão das demais rendas."]) }]}
              leitura={
                <LeituraGuiada>
                  Em {n(T.dependencia_acima_50)} dos {n(T.municipios)} municípios do país, os benefícios líquidos passam de 50% da renda domiciliar; no Brasil, o peso é de {n(B.peso, 1)}%. O gráfico conta só os {n(resumo.base)} municípios sem confiabilidade baixa
                  {acima50NoGrafico ? <>, e nele a faixa acima de 50% tem {n(acima50NoGrafico.n)}: os demais dos {n(T.dependencia_acima_50)} têm confiabilidade baixa e ficam fora das barras</> : null}.
                </LeituraGuiada>
              }
              comoInterpretar={`A massa de benefícios é comparada com a renda domiciliar do Censo, que é de julho de 2022. Por isso o valor de dezembro de ${g.ano} é trazido a preços de 2022 pelo IPCA, com fator de ${n(g.fator_ipca, 4)}. Sem essa correção, o peso apareceria inflado em toda a base.`}
              ressalva="três coisas que este dado não é. O município registrado é o do órgão pagador, não o de residência do beneficiário: a agência de um polo regional paga quem mora nas cidades vizinhas. O valor é líquido de descontos, e o empréstimo consignado já foi subtraído dele. E a contagem é de créditos emitidos, não de pessoas: um benefício pode gerar mais de um crédito, e 11,1% dos beneficiários acumulam mais de um benefício, segundo o Anuário Estatístico da Previdência. Não existe contagem de beneficiários por município em nenhuma fonte pública."
              naoConcluir="quanto do orçamento de cada família vem da Previdência. É uma razão entre bases agregadas: o numerador cobre quem é pago por aquela agência e o denominador, quem mora no município."
              tabela={{
                titulo: `Municípios por faixa do peso dos benefícios na renda domiciliar, ${n(resumo.base)} municípios sem confiabilidade baixa`,
                colunas: ["Faixa do peso na renda domiciliar", "Municípios"],
                linhas: resumo.faixas.map((f) => [f.rotulo, f.n]),
                casas: [null, 0],
              }}
              complemento={
                <>
                  <FaixaNumeros rotulo={`Benefícios da Previdência, ${dez}`}>
                    <NumeroIndicador rotulo="Benefícios emitidos" valorTexto={`${n(B.beneficios / 1e6, 2)} mi`} formato="texto" unidade="de créditos" periodo={dez} recorte="Brasil" fonte="MPS, Estatísticas Municipais" natureza="OBSERVADO" />
                    <NumeroIndicador rotulo="Valor líquido mensal dos benefícios" valorTexto={moeda(B.valor_dez)} formato="texto" unidade="no mês" periodo={dez} recorte="Brasil" fonte="MPS, Estatísticas Municipais" natureza="OBSERVADO" nota="Já descontado o consignado." />
                    <NumeroIndicador rotulo="Benefício médio" valor={B.valor_medio} formato="reais" casas={0} unidade="por crédito" periodo={dez} recorte="Brasil" fonte="MPS, Estatísticas Municipais" natureza="CALCULADO" nota="Valor líquido dividido pela quantidade de créditos." />
                    <NumeroIndicador rotulo="Benefícios por 100 pessoas com 60 anos ou mais" valor={B.ben100_60} casas={1} unidade="benefícios" periodo={`${dez} e Censo 2022`} recorte="Brasil" fonte="MPS e IBGE" natureza="CALCULADO" nota="Acima de 100 porque há benefício pago antes dos 60 anos e pensão a menores." />
                  </FaixaNumeros>
                  <Texto>
                    Teste de coerência contra um teto independente. O Censo mede, separadamente, quanto da renda domiciliar não vem do trabalho. Benefícios previdenciários são parte disso, junto com aluguel, aplicações e transferências; então o peso calculado não pode ultrapassar essa participação. Quando ultrapassa, a causa conhecida é o município do órgão pagador.
                  </Texto>
                  <FaixaNumeros rotulo="Peso na renda e teste de coerência">
                    <NumeroIndicador rotulo="Peso dos benefícios na renda domiciliar" valor={B.peso} formato="percentual" casas={1} unidade="da renda domiciliar" periodo={`${dez}, a preços de 2022`} recorte="Brasil" fonte="MPS e IBGE" natureza="CALCULADO" nota="Valor líquido deflacionado sobre a renda domiciliar do Censo." />
                    <NumeroIndicador rotulo="Municípios de alta dependência" valor={T.dependencia_acima_50} formato="inteiro" unidade="municípios" periodo={dez} recorte={`de ${n(T.municipios)}`} fonte="MPS e IBGE" natureza="CALCULADO" nota={`Benefícios acima de 50% da renda domiciliar, em todos os municípios, inclusive os de confiabilidade baixa${acima50NoGrafico ? `. No gráfico, que os exclui, a faixa tem ${n(acima50NoGrafico.n)}` : ""}.`} />
                    <NumeroIndicador rotulo="Municípios reprovados no teste de coerência" valor={T.incoerentes} formato="inteiro" unidade="municípios" periodo={dez} recorte={`de ${n(T.municipios)} testados`} fonte="MPS e IBGE" natureza="CALCULADO" nota={`${n((100 * T.incoerentes) / T.municipios, 1)}%: peso acima do teto, rebaixados a confiabilidade baixa.`} />
                    <NumeroIndicador rotulo="Municípios com confiabilidade alta" valor={T.selos.alta} formato="inteiro" unidade="municípios" periodo={dez} recorte={`de ${n(T.municipios)} testados`} fonte="MPS e IBGE" natureza="CALCULADO" nota="Passam no teste e têm benefícios por idoso próximos da mediana." />
                  </FaixaNumeros>
                </>
              }
            >
              <GraficoBarras
                semTabela
                titulo="Municípios por faixa do peso dos benefícios na renda domiciliar"
                dados={resumo.faixas.map((f) => ({ faixa: f.rotulo, municipios: f.n }))}
                chaveCategoria="faixa"
                series={[{ id: "municipios", rotulo: "Municípios", cor: "var(--cor-energia)" }]}
                unidade="municípios"
                casas={0}
                rotulosValor
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="municipios"
              pergunta="Onde o envelhecimento e os benefícios pesam mais?"
              subtitulo={`Nove medidas por município, do Censo 2022, da Previdência em ${dez} e de estimativas · ${n(T.municipios)} municípios`}
              natureza="CALCULADO"
              proveniencia={provConsignado(g, "mps", {
                indicador: "Envelhecimento, benefícios e exposição estimada ao consignado por município", natureza: "CALCULADO", unidade: "varia conforme a medida", inicio: "2022", fim: `${g.ano}-12`,
                limitacoes: ["Não existe carteira municipal pública de consignado: toda exposição municipal é estimativa por alocação do total estadual.", "O município do benefício é o do órgão pagador, não o de residência."],
              })}
              complementares={[
                { rotulo: "Sobre a população por idade", p: censo("População com 60 anos ou mais por município", "OBSERVADO", "% da população", []) },
                { rotulo: "Sobre a exposição estimada", p: provConsignado(g, "scr", { indicador: "Exposição municipal estimada ao consignado", natureza: "ESTIMADO", unidade: "R$", inicio: S.data_base, fim: S.data_base, formula: "saldo estadual de aposentados e pensionistas repartido por aposentadorias e pensões de cada município", limitacoes: ["Estimativa por alocação; não é carteira municipal observada."] }) },
              ]}
              naoConcluir="onde há mais consignado. Não existe carteira municipal pública: a exposição por benefício e o índice de sensibilidade são estimativas por alocação do saldo estadual, e o município do benefício é o do órgão pagador."
              tabela={{
                titulo: "Os 25 municípios com maior parcela de pessoas com 60 anos ou mais, sem confiabilidade baixa (Censo 2022)",
                colunas: ["Município", "UF", "População com 60 anos ou mais (%)", "Confiabilidade"],
                linhas: resumo.maiores60.map((m) => [m.n, m.uf, m.p60, ROTULO_CONFIABILIDADE[m.sel]]),
                casas: [null, null, 1, null],
                limite: 25,
              }}
            >
              <ExploradorMunicipios ano={g.ano} scr={mesScr} total={T.municipios} faixasPadrao={resumo.faixas} basePadrao={resumo.base} />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="relacao"
              pergunta="Estados mais dependentes de benefícios têm mais consignado?"
              subtitulo={`Rendimento que não vem do trabalho (%) e consignado de aposentados por pessoa de 60 anos ou mais (R$); a área do círculo é a população de 60 anos ou mais · ${estados.length} unidades da federação · Censo 2022 e SCR de ${mesScr}`}
              natureza="OBSERVADO"
              proveniencia={provConsignado(g, "scr", { indicador: "Consignado de aposentados e pensionistas por pessoa de 60 anos ou mais, por UF", natureza: "OBSERVADO", unidade: "R$ por pessoa de 60 anos ou mais", inicio: S.data_base, fim: S.data_base, limitacoes: [t(S.aviso_grupo)] })}
              complementares={[{ rotulo: "Sobre o rendimento no Censo", p: censo("Participação do rendimento que não vem do trabalho", "OBSERVADO", "% do rendimento domiciliar", ["O Censo não separa aposentadoria e pensão das demais rendas: a participação de outras fontes é um teto, não a renda previdenciária."]) }]}
              leitura={
                <LeituraGuiada>
                  Especificação de referência: correlação de {t(n(ref ? ref.r : C.referencia, 3).replace("-", "−"))} entre {C.n_uf} unidades da federação. Os dois eixos vêm de fontes distintas e nenhum termo é compartilhado entre eles.
                </LeituraGuiada>
              }
              comoInterpretar={t(C.leitura)}
              naoConcluir={`que a dependência de benefícios leva a mais ou a menos consignado. ${t(C.conclusao_regra)} Associação observada, resultado mecânico da metodologia, hipótese e estimativa são coisas diferentes, e nenhuma delas é evidência causal.`}
              tabela={{
                titulo: "Dependência previdenciária e consignado, por unidade da federação",
                colunas: ["Estado", "Rendimento de outras fontes (%)", "Consignado por pessoa de 60 anos ou mais (R$)", "População de 60 anos ou mais (pessoas)"],
                linhas: estados.map((e) => [`${e.nome} (${e.uf})`, e.outras_censo, e.cons_por_60, e.a60]),
                casas: [null, 1, 0, 0],
                limite: estados.length,
              }}
              complemento={
                <>
                  <Texto>
                    A pergunta natural do painel é se municípios mais dependentes de benefícios têm mais consignado. Ela não pode ser respondida com o indicador municipal: como o consignado municipal é o estadual repartido por uma chave previdenciária, a correlação entre os dois foi construída pela fórmula. A resposta só pode vir do nível estadual e, mesmo lá, depende de como cada lado é montado.
                  </Texto>
                  <Nota titulo="Uma correção desta página.">
                    A primeira versão publicava uma correlação só, de −0,72, entre o peso dos benefícios na renda e o consignado por benefício elegível. Essa especificação compartilha um termo entre os dois lados: a quantidade de benefícios aparece no numerador da dependência (valor = quantidade × benefício médio) e no denominador do consignado por benefício. Isso produz correlação negativa por aritmética, independentemente do mundo. A tabela abaixo mostra as quatro montagens possíveis, e a referência passou a ser a que não compartilha termo nenhum.
                  </Nota>
                  <TabelaDados
                    recolhida={false}
                    id="especificacoes"
                    tituloVisivel="Quatro especificações da mesma pergunta"
                    lead={<DicaRolagem />}
                    titulo="Especificações da correlação entre dependência previdenciária e consignado"
                    colunas={["Especificação", "Correlação", "Por que difere"]}
                    linhas={[
                      ...(C.especificacoes as { rotulo: string; r: number; referencia: boolean; obs: string }[]).map((e) => [`${e.rotulo}${e.referencia ? " (referência)" : ""}`, e.r, t(e.obs)]),
                      ["A mesma correlação no nível municipal (hipótese)", C.correlacao_mecanica, "Mede a fórmula de alocação, não o mundo. Nenhuma afirmação da página se apoia nela."],
                    ]}
                    casas={[null, 3, null]}
                    linhasDestacadas={[(C.especificacoes as { referencia: boolean }[]).findIndex((e) => e.referencia)]}
                    nota={`Observado. Correlação de Pearson entre ${C.n_uf} unidades da federação; a linha em destaque é a referência. ${t(C.explicacao)}`}
                  />
                  <TabelaDados
                    recolhida={false}
                    id="controles"
                    tituloVisivel="Correlação parcial, controlando por terceiras variáveis"
                    lead={<DicaRolagem />}
                    titulo="Correlação parcial, controlando por terceiras variáveis"
                    colunas={["Controlando por", "Especificação de referência", "Especificação compartilhada"]}
                    linhas={(C.controles as { variavel: string; parcial_referencia: number | null; parcial_compartilhada: number | null }[]).map((x) => [x.variavel, x.parcial_referencia, x.parcial_compartilhada])}
                    casas={[null, 3, 3]}
                    nota={`Calculado, entre ${C.n_uf} unidades da federação.`}
                  />
                  <TabelaDados
                    recolhida={false}
                    id="mecanismo"
                    tituloVisivel="O mecanismo não está estabelecido"
                    titulo="Candidatos a mecanismo testados"
                    lead={<>A direção da associação é robusta, mas nenhuma explicação testada a sustenta. Quatro candidatos foram medidos, e os quatro falham; um deles com o sinal contrário ao que a hipótese previa.<DicaRolagem /></>}
                    colunas={["Candidato a mecanismo", "Correlação com consignado por pessoa de 60 anos ou mais", "Correlação com a dependência", "Leitura"]}
                    linhas={(C.mecanismo.testados as { variavel: string; com_consignado_por_60: number | null; com_peso: number | null; leitura: string }[]).map((m) => [m.variavel, m.com_consignado_por_60, m.com_peso, t(m.leitura)])}
                    casas={[null, 3, 3, null]}
                    nota={t(C.mecanismo.conclusao)}
                  />
                </>
              }
            >
              <DispersaoEstados
                estados={estados.map((e) => ({ uf: e.uf, nome: e.nome, outras_censo: e.outras_censo as number, cons_por_60: e.cons_por_60 as number, a60: typeof e.a60 === "number" ? e.a60 : null }))}
                periodo={`SCR de ${mesScr}`}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="saturacao"
              pergunta="Em quantos municípios a exposição estimada é alta?"
              subtitulo={`Municípios por classe de saturação · número de municípios · ${n(T.municipios)} municípios, estimativa por alocação do saldo estadual de ${mesScr}`}
              natureza="ESTIMADO"
              proveniencia={provConsignado(g, "scr", {
                indicador: "Classe de saturação do consignado por município", natureza: "ESTIMADO", unidade: "municípios", inicio: S.data_base, fim: S.data_base,
                formula: "saldo estimado por benefício elegível e serviço da dívida de um contrato de 84 meses sobre o valor líquido dos benefícios elegíveis",
                limitacoes: ["Nenhum município é classificado como saturado a partir de alocação proporcional pura.", "O serviço da dívida é cenário aritmético, não parcela observada."],
              })}
              leitura={
                <LeituraGuiada>
                  {n(semClasse)} dos {n(T.municipios)} municípios ficam sem classificação, por confiabilidade baixa ou por falta de sinal de intensidade.
                </LeituraGuiada>
              }
              comoInterpretar="Saturação não é tamanho de carteira. A classificação usa saldo estimado por benefício elegível e serviço da dívida, e tem uma trava: município cujo indicador é apenas alocação proporcional, sem nenhum sinal de intensidade, ou cuja confiabilidade é baixa, não recebe classificação."
              naoConcluir="que um município está saturado de crédito. A classe usa saldo estimado por alocação e um cenário aritmético de 84 meses; rotular quem só recebeu uma fatia da fórmula seria transformar aritmética em diagnóstico."
              tabela={{
                titulo: "Municípios por classe de saturação (estimado)",
                colunas: ["Classe", "Municípios"],
                linhas: [...classes.map((k) => [ROTULO_SATURACAO[k], T.saturacao[k]]), ["Sem classificação", semClasse]],
                casas: [null, 0],
              }}
              complemento={
                <TabelaDados
                  recolhida={false}
                  id="criterios"
                  tituloVisivel="Critérios, para quem quiser recalcular"
                  lead={<DicaRolagem />}
                  titulo="Critérios da classificação de saturação"
                  colunas={["Classe", "Critério"]}
                  linhas={[
                    ["Possível saturação", `saldo por benefício acima de R$ ${n(cr.cons_ben_alto)} ou serviço da dívida acima de ${n(cr.servico_alto)}%`],
                    ["Penetração elevada", `saldo por benefício acima de R$ ${n(cr.cons_ben_medio)} ou serviço da dívida acima de ${n(cr.servico_medio)}%`],
                    ["Baixa penetração", "abaixo dos dois limiares"],
                  ]}
                  nota="O serviço da dívida é a parcela implícita de um contrato de 84 meses sobre o valor líquido dos benefícios elegíveis. É cenário aritmético, não parcela observada: a parcela real do consignado não é publicada por município."
                />
              }
            >
              <GraficoBarras
                semTabela
                titulo="Municípios por classe de saturação"
                dados={[...classes.map((k) => ({ classe: ROTULO_SATURACAO[k], municipios: T.saturacao[k] as number })), { classe: "Sem classificação", municipios: semClasse }]}
                chaveCategoria="classe"
                series={[{ id: "municipios", rotulo: "Municípios", cor: "var(--serie-4)" }]}
                unidade="municípios"
                casas={0}
                rotulosValor
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="instituicoes"
              pergunta="Quanto cada instituição cobra no consignado do INSS?"
              subtitulo={`${t(I.modalidade)} · % ao ano · ${ranking.length} instituições, operações contratadas de ${janela}`}
              natureza="OBSERVADO"
              proveniencia={provConsignado(g, "txjuros", { indicador: "Taxa média de contratação do consignado do INSS por instituição", natureza: "OBSERVADO", unidade: "% ao ano", inicio: I.janela.inicio, fim: I.janela.fim, limitacoes: [t(I.aviso)] })}
              leitura={
                <LeituraGuiada>
                  A mediana é de {n(I.stats.mediana, 2)}% ao ano entre {ranking.length} instituições, {n(I.spread_selic, 2)} pontos percentuais acima da Selic. A maior taxa supera a menor em {n(100 * (I.stats.max / I.stats.min - 1), 0)}%, no mesmo produto e com o mesmo mecanismo de garantia.
                </LeituraGuiada>
              }
              comoInterpretar="Nem a taxa cobrada nem a reclamação existem por município para cada instituição. Estimar participação municipal por instituição exigiria uma metodologia que nenhuma fonte sustenta, e a página não a inventa: as duas tabelas ficam na geografia em que foram medidas, a nacional."
              naoConcluir="a participação de mercado nem a carteira de cada instituição. Taxa de contratação é preço de operação nova na janela divulgada, e não existe em nível municipal ou estadual."
              tabela={{
                titulo: `Taxa de contratação do consignado do INSS por instituição, ${janela}`,
                colunas: ["Posição", "Instituição", "Taxa (% ao ano)", "Taxa (% ao mês)", "Diferença para a mediana (pontos percentuais)"],
                linhas: ranking.map((r) => [String(r.posicao), r.nome, r.taxa_aa, r.taxa_am, r.vs_mediana]),
                casas: [null, null, 2, 2, 2],
                limite: ranking.length,
                idiomaTexto: [null, "nome", null, null, null],
              }}
            >
              <GraficoBarras
                semTabela
                titulo="Taxa de contratação do consignado do INSS por instituição"
                dados={ranking.map((r) => ({ cnpj8: r.cnpj8, nome: r.nome, taxa: r.taxa_aa }))}
                chaveCategoria="cnpj8"
                chaveRotulo="nome"
                series={[{ id: "taxa", rotulo: "Taxa de contratação", cor: "var(--cor-energia)" }]}
                unidade="% ao ano"
                casas={2}
                orientacao="horizontal"
                limiteInicial={12}
                referencias={[{ valor: I.stats.mediana, rotulo: "Mediana" }]}
                rotulosValor
                rotulosSaoNomes
              />
            </FiguraAnalitica>
          </>
        }
        tabelas={
          <>
            <TabelaDados
              recolhida={false}
              id="sensibilidade"
              tituloVisivel="Sensibilidade social e regulatória"
              titulo="Os 15 maiores índices de sensibilidade, municípios de 20 mil habitantes ou mais, sem confiabilidade baixa"
              lead={<>Este índice mede a sensibilidade do contexto, não a conduta de ninguém. Ele não classifica moradores nem instituições. Um município no topo da lista é um lugar onde envelhecimento, peso dos benefícios na renda e exposição estimada coincidem, o que torna decisões de crédito ali mais consequentes, e não onde há irregularidade demonstrada.<DicaRolagem /></>}
              colunas={COLUNAS_SENSIBILIDADE}
              linhas={resumo.sensiveis.map(linhaSensibilidade)}
              casas={[null, null, 0, 0, 0, 0]}
              limite={15}
              nota={`Estimado, com a Previdência de ${dez}, o Censo 2022 e o SCR de ${mesScr}. Os 15 maiores índices do país entre municípios de 20 mil habitantes ou mais; para ver uma região, use o filtro do mapa. Cada dimensão é a posição do município na distribuição nacional, de 0 a 100, entre os percentis 5 e 95. Vulnerabilidade combina participação de 60 anos ou mais, peso dos benefícios na renda e renda domiciliar por habitante invertida. Exposição combina saldo estimado por benefício e serviço da dívida. Perfil do benefício combina participação de assistenciais e de clientela rural. A soma é simples e sem pesos escondidos: as três parcelas estão publicadas para quem quiser outro arranjo.`}
            />
            <TabelaDados
              recolhida={false}
              id="reclamacoes"
              tituloVisivel="Reclamações sobre consignado de beneficiários do INSS"
              titulo={`Reclamações sobre consignado de beneficiários do INSS por instituição, ${periodoRec}`}
              lead={<>{`Observado: ${n(R.total)} reclamações de ${periodoRec}, em ${n(R.municipios)} municípios. ${coberturaRec} Fonte: consumidor.gov.br, categoria dedicada a beneficiários do INSS. A tabela traz as 12 instituições com mais reclamações, de ${n(R.instituicoes.length)}.`}<DicaRolagem /></>}
              colunas={["Instituição", "Reclamações", "Com 61 anos ou mais (%)", "Resolvidas (%)", "Nota do consumidor"]}
              linhas={(R.instituicoes as { nome: string; total: number; part_idosos: number | null; taxa_resolucao: number | null; nota: number | null }[]).slice(0, 12).map((x) => [x.nome, x.total, x.part_idosos, x.taxa_resolucao, x.nota])}
              casas={[null, 0, 1, 1, 1]}
              idiomaTexto={["nome", null, null, null, null]}
              limite={12}
              nota={t(R.aviso)}
            />
          </>
        }
        notas={{
          id: "dicionario",
          titulo: "Para ler esta página: os indicadores e seus limites",
          itens: (g.dicionario as { t: string; selo: string; d: string; f: string; l: string }[]).map((x) => ({
            termo: <>{t(x.t)} <span className="rotulo text-mineral">{x.selo}</span></>,
            definicao: t(x.d),
            exemplo: <>Limite: {t(x.l)} Fonte: {t(x.f)}</>,
          })),
          nota: "Observado é o valor publicado pela fonte; calculado é conta sobre valores observados; estimado é alocação declarada; cenário é aritmética com hipótese fixa. Os quatro nunca são somados nem trocados um pelo outro.",
        }}
        metodo={
          <>
            <p>
              Três geografias que não se convertem umas nas outras: o Censo e a Previdência são municipais, o consignado é estadual e a taxa por instituição é nacional. Fontes: IBGE, Censo Demográfico 2022; Ministério da Previdência Social, Estatísticas Municipais de {g.ano}; Banco Central, SGS ({mesSgs}), SCR ({mesScr}) e taxas por instituição ({janela}); consumidor.gov.br ({periodoRec}). Leitura da Scrutiniums em {dataBr(g.gerado_em)}.
            </p>
            <div>
              <p className="font-medium text-carvao">O que esta página não autoriza concluir</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>O município dos benefícios é o do órgão pagador, não o de residência. Onde os dois universos divergem, o indicador se distorce, e o teste de coerência mede exatamente isso, reprovando {n(T.incoerentes)} municípios.</li>
                <li>O valor dos benefícios é líquido de descontos. O consignado já saiu dele, então esse número nunca serve de medida de exposição ao crédito.</li>
                <li>A contagem é de créditos emitidos, não de pessoas. Não existe contagem de beneficiários por município em nenhuma fonte pública.</li>
                <li>O Censo não separa aposentadoria e pensão das demais rendas. A participação de outras fontes é publicada como teto, jamais como renda previdenciária.</li>
                <li>Não existe carteira municipal pública de consignado. Toda exposição municipal aqui é estimativa por alocação do total estadual.</li>
                <li>A relação entre dependência previdenciária e consignado só é afirmada a partir do dado estadual observado. A versão municipal dessa relação é mecânica.</li>
                <li>Reclamação mede propensão a reclamar, não incidência de problema, e contagem bruta não é ranking de conduta.</li>
                <li>Nenhum município é classificado como saturado a partir de alocação proporcional pura.</li>
              </ul>
            </div>
            <div data-linha-do-tempo="">
              <p className="font-medium text-carvao">Evolução regulatória: {tempo.length} eventos com norma e data</p>
              <ol className="mt-2 space-y-2">
                {tempo.map((e) => (
                  <li key={`${e.d}-${e.t}`}>
                    <span className="tabular-nums text-carvao">{dataBr(e.d)}</span> · <span className="font-medium text-carvao">{t(e.t)}</span> ({TIPO_NORMA[e.tipo] ?? e.tipo}). {t(e.norma)}. {t(e.o)}
                  </li>
                ))}
              </ol>
              <p className="mt-2">Observado. Cada evento traz a norma que o produziu. As mudanças de margem aparecem marcadas na série do saldo para permitir inspeção, não para atribuir a elas a variação observada.</p>
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
