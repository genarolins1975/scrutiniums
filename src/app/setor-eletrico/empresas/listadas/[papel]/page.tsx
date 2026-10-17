import type { ReactNode } from "react";
import { comNomes as marcarNomes } from "@/components/i18n/comNomes";
import type { Metadata, ResolvingMetadata } from "next";
import { caminhoComParametros, metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/energia/LinkSemPrefetch";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasIndisponivel, EmpresasNavegacao } from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { ListadasEstrutura } from "@/components/energia/ListadasEstrutura";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import { ListadasMapaUf } from "@/components/energia/ListadasMapaUf";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { lerSerie } from "@/lib/energia/empresas-arquivos";
import { rotaEntidade, rotuloFase } from "@/lib/energia/empresas";
import { carimbo, dataBR, datasLegiveis, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import { DEFINICAO_LISTADAS_EN, ESPECIE_CONTROLE_EN, FONTE_SIGA_EN, NOMES_FONTES, SEGMENTO_B3_EN, comNomes, notaBolsa, traduzir } from "@/lib/energia/i18n/empresas-leiloes";
import {
  ROTA_LISTADAS,
  logoDe,
  controladoresFre,
  nomeCurto,
  participacoesCruzadas,
  rotaFicha,
  serieBase100,
  sinalPct,
  textoAtuacao,
  textoBolsa,
  textoControle,
  textoCruzada,
} from "@/lib/energia/listadas";
import { lerManifestoLogos } from "@/lib/energia/logos";
import type { CompanhiaListada, EvidenciasListadas, ListadasGold } from "@/lib/energia/tipos-listadas";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  const g = lerGold<ListadasGold>("listadas.json");
  return integra(g) ? g.companhias.map((c) => ({ papel: c.slug })) : [];
}

function achar(papel: string): { g: ListadasGold; c: CompanhiaListada } | null {
  const g = lerGold<ListadasGold>("listadas.json");
  if (!integra(g)) return null;
  const c = g.companhias.find((x) => x.slug === papel.toLowerCase());
  return c ? { g, c } : null;
}

function metadadosDaPagina({ params }: { params: { papel: string } }): Metadata {
  const r = achar(params.papel);
  if (!r) return {};
  const nome = nomeCurto(r.c, lerManifestoLogos());
  return {
    title: tx(`${nome} (${r.c.papel}): ativos, controle, finanças e ações`, `${nome} (${r.c.papel}): assets, control, finances and shares`),
    description: tx(
      `Ficha da ${nome} na carteira do Índice de Energia Elétrica da B3: usinas, linhas e distribuidoras sob controle, acionistas e cadeia de controle, demonstrações consolidadas, retorno da ação com proventos e fatos relevantes.`,
      `Profile of ${nome} in the portfolio of the B3 Electric Power Index: plants, lines and distribution utilities under control, shareholders and control chain, consolidated statements, share return with distributions and material facts.`,
    ),
    alternates: { canonical: rotaFicha(r.c) },
  };
}

export async function generateMetadata(props: { params: { papel: string } }, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia(caminhoComParametros("/setor-eletrico/empresas/listadas/[papel]", props.params), metadadosDaPagina(props), anterior);
}

const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";
/** Rótulo do tipo de usina do SIGA, no idioma da página. */
function rotuloTipo(t: string): string {
  const r: Record<string, string> = {
    UHE: tx("Hidrelétrica (UHE)", "Hydroelectric plant (UHE)"),
    PCH: tx("Pequena central hidrelétrica (PCH)", "Small hydroelectric plant (PCH)"),
    CGH: tx("Central geradora hidrelétrica (CGH)", "Hydroelectric generating station (CGH)"),
    UTE: tx("Termelétrica (UTE)", "Thermal plant (UTE)"),
    UTN: tx("Termonuclear (UTN)", "Nuclear plant (UTN)"),
    EOL: tx("Eólica (EOL)", "Wind (EOL)"),
    UFV: tx("Solar fotovoltaica (UFV)", "Solar photovoltaic (UFV)"),
  };
  return r[t] ?? t;
}
function contasFin(): { id: "receita" | "ebit" | "lucro_liquido" | "divida_bruta" | "patrimonio_liquido"; rotulo: string }[] {
  return [
    { id: "receita", rotulo: tx("Receita", "Revenue") },
    { id: "ebit", rotulo: tx("Resultado antes do financeiro e dos tributos", "Earnings before financial result and taxes (EBIT)") },
    { id: "lucro_liquido", rotulo: tx("Lucro líquido", "Net income") },
    { id: "divida_bruta", rotulo: tx("Dívida bruta", "Gross debt") },
    { id: "patrimonio_liquido", rotulo: tx("Patrimônio líquido", "Shareholders' equity") },
  ];
}
/** Definição publicada pela gold de Listadas, no idioma da página. */
const def = (x: string) => comNomes(traduzir(DEFINICAO_LISTADAS_EN, x));
/** Extensão em km, igual nas duas línguas. */
const kmTexto = (v: number | null | undefined) => `${num(v, 0)} km`; // i18n: dado (unidade igual nas duas línguas)

export default function FichaListada({ params }: { params: { papel: string } }) {
  const r = achar(params.papel);
  if (!r) return <EmpresasIndisponivel motivo={tx("A companhia não está na carteira do IEE publicada nesta atualização.", "The company is not in the IEE portfolio published in this update.")} />;
  const { g, c } = r;
  const logos = lerManifestoLogos();
  const nome = nomeCurto(c, logos);
  const logo = logoDe(logos, c.papel);
  const ev = lerSerie<EvidenciasListadas>(g.series.evidencias)?.evidencias?.[c.papel] ?? {};
  const prov = g.proveniencia;
  const ger = c.geracao;
  const tr = c.transmissao;
  const dist = c.distribuicao;
  const b = c.bolsa;
  const fin = c.financas;
  const dataSiga = dataBR(g.datas.siga);
  const outras = g.companhias.filter((x) => x.papel !== c.papel);
  const semDado = tx("sem dado", "no data");
  const acao = c.iee.classe === "UNT" ? "unit" : tx("ação", "share");
  const segmento = c.iee.segmento_nome ? traduzir(SEGMENTO_B3_EN, c.iee.segmento_nome) : (c.iee.segmento ?? tx("segmento sem dado", "segment without data"));
  /** Título do fato relevante: o assunto que a companhia deu ao documento, em português. */
  const assunto = (a: string | null | undefined) =>
    a ? <TrechoPortugues regiao="listadas-fato-assunto">{a}</TrechoPortugues> : tx("Fato relevante sem assunto informado", "Material fact with no subject stated");

  const barrasTipo = ger.por_tipo.map((t) => ({ tipo: t.tipo, nome: rotuloTipo(t.tipo), controle: t.mw_controle, proporcional: t.mw_proporcional }));
  const inicioBolsa = b && !b.motivo ? (b.retorno_desde_2020 ? "2020-12" : undefined) : undefined;
  const base = b && !b.motivo ? serieBase100(b, inicioBolsa) : [];
  const mensalTela = b && !b.motivo ? new Map(b.mensal.map(([m, f]) => [m, f])) : new Map<string, number>();
  const f0 = base.length ? (mensalTela.get(base[0].m) ?? null) : null;
  const dadosBolsa = base.map((x) => ({ m: x.m, total: x.total, preco: x.preco, tela: f0 ? (100 * (mensalTela.get(x.m) ?? NaN)) / f0 : null }));
  const desde = b?.retorno_desde_2020 ?? b?.retorno_desde_inicio ?? null;
  const ultFin = fin?.serie.at(-1) ?? null;
  const cruzadas = participacoesCruzadas(g).filter((x) => x.de.papel === c.papel || x.em.papel === c.papel);

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-listadas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="listadas" />
        <div className="flex flex-wrap items-center gap-4 pt-6">
          <ListadasLogo logo={logo} nome={nome} tamanho="lg" />
          <p className="text-sm text-carvao-muted">
            <Link href={ROTA_LISTADAS} className={link}>
              {tx("Companhias listadas", "Listed companies")}
            </Link>{" "}
            ·{" "}
            {tx(
              <>
                {c.papel} · {pct(c.iee.peso_pct, 2)} da carteira do IEE de {dataBR(g.datas.carteira_iee)}
              </>,
              <>
                {c.papel} · {pct(c.iee.peso_pct, 2)} of the IEE portfolio of {dataBR(g.datas.carteira_iee)}
              </>,
            )}
          </p>
        </div>
        <CabecalhoModulo
          rotulo={tx("Empresas listadas", "Listed companies")}
          siglas={["IEE", "B3", "CVM", "FCA", "FRE", "SIGA", "SIGET", "ANEEL"]}
          titulo={tx<ReactNode>(`${nome}: ativos, controle, números e ações`, marcarNomes(`${nome}: assets, control, numbers and shares`, [nome], "en"))}
          lead={textoAtuacao(c)}
          recorte={comNomes(
            tx(
              `${c.nome ?? nome} · CNPJ ${c.cnpj ?? "sem dado"} · ${c.iee.segmento_nome ?? c.iee.segmento ?? "segmento sem dado"} · ativos do SIGA de ${dataSiga}`,
              `${c.nome ?? nome} · CNPJ ${c.cnpj ?? semDado} · ${segmento} · SIGA assets as of ${dataSiga}`,
            ),
            [c.nome ?? nome, ...NOMES_FONTES],
          )}
          fonte={comNomes(
            tx(
              "ANEEL (SIGA, SIGET, Composição Societária); CVM (FCA, FRE, DFP, IPE); B3 (cotações e proventos)",
              "ANEEL (SIGA, SIGET, Composição Societária); CVM (FCA, FRE, DFP, IPE); B3 (quotes and distributions)",
            ),
          )}
          limite={tx(
            "Ativos de coligadas e de sociedades com controle compartilhado não entram; retorno passado não indica retorno futuro.",
            "Assets of affiliates and of companies under shared control are not included; past returns do not indicate future returns.",
          )}
          referencia={tx(
            <>
              Formulário Cadastral de {dataBR(c.fca.data_referencia)} (versão {c.fca.versao ?? "sem dado"}); papel ligado ao CNPJ pelo código CVM {c.codigo_cvm ?? "sem dado"} publicado pela B3, conferência{" "}
              {c.conferencia_cnpj.resultado === "igual" ? "igual no FCA" : c.conferencia_cnpj.resultado}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              Registration Form of {dataBR(c.fca.data_referencia)} (version {c.fca.versao ?? semDado}); stock linked to the CNPJ by the CVM code {c.codigo_cvm ?? semDado} published by B3, check{" "}
              {c.conferencia_cnpj.resultado === "igual" ? "matching in the FCA" : c.conferencia_cnpj.resultado}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx(`Indicadores da ${nome}`, `${nome} indicators`)}
              nota={tx("Cada medida tem a sua fonte e a sua data; nenhuma se soma à outra.", "Each measure has its own source and date; none is added to another.")}
            >
              {ev.mw_controle ? (
                <Numero
                  variante="faixa"
                  rotulo={tx("Potência em operação sob controle", "Capacity in operation under control")}
                  natureza="CALCULADO"
                  evidencia={ev.mw_controle}
                  casas={0}
                  unidade="MW"
                  endereco={`${rotaFicha(c)}#ativos`}
                />
              ) : (
                <Numero
                  variante="faixa"
                  rotulo={tx("Potência em operação sob controle", "Capacity in operation under control")}
                  natureza="CALCULADO"
                  valor={ger.mw_controle}
                  casas={0}
                  unidade="MW"
                  periodo={tx(`SIGA de ${dataSiga}`, `SIGA as of ${dataSiga}`)}
                />
              )}
              <Numero
                variante="faixa"
                rotulo={tx("Transmissão em operação", "Transmission in operation")}
                natureza="CALCULADO"
                valor={tr ? tr.km_circuito_operacao : c.atuacao.transmissao ? null : 0}
                casas={0}
                unidade={tx("km de circuito", "circuit km")}
                periodo={
                  tr
                    ? tx(`SIGET de ${dataBR(g.datas.siget)}`, `SIGET as of ${dataBR(g.datas.siget)}`)
                    : tx(`nenhuma concessionária sob controle no SIGET de ${dataBR(g.datas.siget)}`, `no concession holder under control in SIGET as of ${dataBR(g.datas.siget)}`)
                }
                motivoAusencia={tx("Concessionária sob controle sem km de circuito publicado.", "Concession holder under control without published circuit km.")}
              />
              {dist?.distribuidoras.length ? (
                <Numero
                  variante="faixa"
                  rotulo={tx("Unidades consumidoras das distribuidoras", "Consumer units of the distribution utilities")}
                  natureza="OBSERVADO"
                  valor={dist.unidades_consumidoras ?? null}
                  casas={0}
                  unidade={tx("unidades", "units")}
                  periodo={dist.anos.length ? tx(`ano ${dist.anos.join(", ")}`, `year ${dist.anos.join(", ")}`) : undefined}
                  motivoAusencia={tx(
                    "Unidades consumidoras não publicadas para as distribuidoras sob controle.",
                    "Consumer units not published for the distribution utilities under control.",
                  )}
                />
              ) : (
                <Numero
                  variante="faixa"
                  rotulo={tx("Distribuidoras sob controle", "Distribution utilities under control")}
                  natureza="CALCULADO"
                  valor={0}
                  casas={0}
                  unidade={tx("distribuidoras", "distribution utilities")}
                  periodo={tx("índice de distribuidoras do módulo Empresas", "distribution utility index of the Companies module")}
                />
              )}
              {ev.retorno_total_12m ? (
                <Numero
                  variante="faixa"
                  rotulo={tx(`Retorno total de ${c.papel} em 12 meses`, `${c.papel} total return over 12 months`)}
                  natureza="CALCULADO"
                  evidencia={ev.retorno_total_12m}
                  casas={1}
                  unidade="%"
                  endereco={`${rotaFicha(c)}#bolsa`}
                />
              ) : (
                <Numero
                  variante="faixa"
                  rotulo={tx(`Retorno total de ${c.papel} em 12 meses`, `${c.papel} total return over 12 months`)}
                  natureza="CALCULADO"
                  valor={null}
                  motivoAusencia={tx("Sem 12 meses de cotações.", "Fewer than 12 months of quotes.")}
                />
              )}
            </FaixaMetricas>
          }
        >
          {c.descricao_atividade
            ? tx(
                <>
                  Atividade como a companhia a descreve no Formulário Cadastral da CVM: “{c.descricao_atividade}”
                  {c.nome_anterior ? ` Nome empresarial anterior: ${c.nome_anterior}${c.data_nome ? ` (até ${dataBR(c.data_nome)})` : ""}.` : ""}
                  {c.pagina_web ? ` Página informada: ${c.pagina_web}.` : ""}
                </>,
                <>
                  Activity as the company describes it in its CVM Registration Form: “<TrechoPortugues regiao="listadas-descricao-atividade">{c.descricao_atividade}</TrechoPortugues>”
                  {c.nome_anterior ? (
                    <>
                      {" "}
                      Former corporate name: <Nome>{c.nome_anterior}</Nome>
                      {c.data_nome ? ` (until ${dataBR(c.data_nome)})` : ""}.
                    </>
                  ) : (
                    ""
                  )}
                  {c.pagina_web ? ` Website stated: ${c.pagina_web}.` : ""}
                </>,
              )
            : tx("A companhia não descreve a atividade no Formulário Cadastral lido.", "The company does not describe its activity in the Registration Form read.")}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="ficha">
            {c.descricao_atividade && (
              <blockquote className="max-w-prose2 border-l-2 border-linha pl-4 text-sm leading-relaxed text-carvao-muted">
                <p>
                  “<TrechoPortugues regiao="listadas-descricao-atividade">{c.descricao_atividade}</TrechoPortugues>”
                </p>
                <footer className="mt-1 text-xs text-mineral">
                  {tx(
                    <>Descrição da atividade no Formulário Cadastral entregue à CVM ({dataBR(c.fca.data_referencia)}).</>,
                    <>Description of the activity in the Registration Form filed with the CVM ({dataBR(c.fca.data_referencia)}).</>,
                  )}
                </footer>
              </blockquote>
            )}

            <PainelEvidencia
              id="ativos"
              pergunta={tx("Quais ativos a companhia controla?", "Which assets does the company control?")}
              subtitulo={tx(
                `Usinas em MW (SIGA de ${dataSiga}), transmissão em km de circuito (SIGET), distribuidoras em unidades consumidoras`,
                `Plants in MW (SIGA as of ${dataSiga}), transmission in circuit km (SIGET), distribution utilities in consumer units`,
              )}
              natureza="CALCULADO"
              porQueImporta={tx(
                <>A composição dos ativos define de onde vem a receita: geração vende energia, transmissão recebe receita anual permitida e distribuição tem tarifa revista pela ANEEL.</>,
                <>The asset mix defines where revenue comes from: generation sells energy, transmission receives an allowed annual revenue and distribution has a tariff reviewed by ANEEL.</>,
              )}
              oQueMudou={tx(
                <>
                  Usinas do SIGA de {dataSiga}; transmissão do SIGET de {dataBR(g.datas.siget)}; cadeia de controle do trimestre {g.datas.polimero_trimestre ?? "sem dado"}.
                </>,
                <>
                  Plants from SIGA as of {dataSiga}; transmission from SIGET as of {dataBR(g.datas.siget)}; control chain of quarter {g.datas.polimero_trimestre ?? semDado}.
                </>,
              )}
              comoInterpretar={tx(
                <>
                  {g.definicoes.sob_controle} {g.definicoes.mw_proporcional}
                </>,
                <>
                  {def(g.definicoes.sob_controle)} {def(g.definicoes.mw_proporcional)}
                </>,
              )}
              naoConcluir={tx(
                <>Capacidade instalada não é energia gerada nem receita. Participações minoritárias e em controle compartilhado ficam fora.</>,
                <>Installed capacity is not energy generated nor revenue. Minority stakes and stakes under shared control are left out.</>,
              )}
              proveniencia={prov.ativos}
            >
              <div className="space-y-6">
                <RespostaCurta id="ativos-resposta" tamanho="sm" veredito={textoAtuacao(c)}>
                  {tx(
                    <>
                      {g.definicoes.mw_controle} {ger.mw_controle !== ger.mw_proporcional ? `Proporcional às participações diretas das empresas sob controle: ${num(ger.mw_proporcional, 0)} MW.` : ""}{" "}
                      {c.controle.empresas_sob_controle} CNPJ sob controle, inclusive a companhia.
                    </>,
                    <>
                      {def(g.definicoes.mw_controle)}{" "}
                      {ger.mw_controle !== ger.mw_proporcional ? `Proportional to the direct stakes of the companies under control: ${num(ger.mw_proporcional, 0)} MW.` : ""}{" "}
                      {c.controle.empresas_sob_controle} CNPJs under control, including the company.
                    </>,
                  )}
                </RespostaCurta>
                {ger.usinas_controle > 0 ? (
                  <>
                    <GraficoBarras
                      titulo={tx(`Potência em operação por tipo de usina, SIGA de ${dataSiga}`, `Capacity in operation by type of plant, SIGA as of ${dataSiga}`)}
                      dados={barrasTipo}
                      chaveCategoria="tipo"
                      chaveRotulo="nome"
                      series={[
                        // i18n: dado (chave de dado ou forma de um ramo do tx)
                        { id: "controle", rotulo: tx("Sob controle", "Under control"), cor: "var(--cor-energia)" },
                        { id: "proporcional", rotulo: tx("Proporcional", "Proportional"), cor: "var(--serie-referencia)" },
                      ]}
                      unidade="MW"
                      casas={0}
                      orientacao="horizontal"
                      rotulosValor
                    />
                    <ListadasMapaUf
                      porUf={ger.por_uf}
                      titulo={tx(`Potência em operação sob controle por UF, SIGA de ${dataSiga}`, `Capacity in operation under control by state, SIGA as of ${dataSiga}`)}
                      periodo={tx(`SIGA de ${dataSiga}`, `SIGA as of ${dataSiga}`)}
                      nota={tx(
                        "UF da usina como publicada no SIGA (a principal, quando a usina é multiestadual). UF sem usina sob controle aparece como não se aplica.",
                        "The plant's state as published in SIGA (the main one, when the plant spans several states). A state without a plant under control appears as not applicable.",
                      )}
                    />
                    <SecaoDoPainel id="maiores" titulo={tx("Quais são as maiores usinas sob controle?", "Which are the largest plants under control?")}>
                      <div className="tabela-scroll overflow-x-auto" role="region" aria-label={tx("Maiores usinas sob controle", "Largest plants under control")} tabIndex={0}>
                        <table className="w-full min-w-[640px] border-collapse text-sm">
                          <thead>
                            <tr className="text-left text-xs text-carvao-muted">
                              <th scope="col" className="pb-2 pr-3 font-medium">
                                {tx("Usina", "Plant")}
                              </th>
                              <th scope="col" className="pb-2 pr-3 font-medium">
                                {tx("Tipo", "Type")}
                              </th>
                              <th scope="col" className="pb-2 pr-3 font-medium">
                                {tx("UF", "State")}
                              </th>
                              <th scope="col" className="pb-2 pr-3 text-right font-medium">MW</th>
                              <th scope="col" className="pb-2 font-medium">
                                {tx("Dona direta (participação)", "Direct owner (stake)")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ger.maiores.map((u) => (
                              <tr key={u.nucleo} className="border-t border-linha">
                                <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">
                                  <Nome>{u.nome}</Nome>
                                </th>
                                <td className="py-1.5 pr-3 text-carvao-muted">
                                  {u.tipo}
                                  {u.fonte ? ` · ${traduzir(FONTE_SIGA_EN, u.fonte)}` : ""}
                                </td>
                                <td className="py-1.5 pr-3 text-carvao-muted">{u.uf}</td>
                                <td className="py-1.5 pr-3 text-right tabular-nums text-carvao">{num(u.mw, 1)}</td>
                                <td className="py-1.5 text-carvao-muted">
                                  {u.dono_nome ? <Nome>{u.dono_nome}</Nome> : u.dono_cnpj} ({pct(u.pct_dono, 1)})
                                  {u.nivel > 0
                                    ? tx(` · ${u.nivel} ${u.nivel === 1 ? "degrau" : "degraus"} abaixo`, ` · ${u.nivel} ${u.nivel === 1 ? "step" : "steps"} below`)
                                    : tx(" · a própria companhia", " · the company itself")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {ger.mw_em_implantacao > 0 && (
                        <p className="text-sm text-carvao-muted">
                          {tx(
                            <>
                              Em implantação sob controle: {num(ger.mw_em_implantacao, 0)} MW outorgados em {ger.usinas_em_implantacao} usinas
                              {ger.em_implantacao.length ? `, entre elas ${ger.em_implantacao.slice(0, 3).map((u) => `${u.nome} (${u.tipo}, ${num(u.mw, 0)} MW, ${u.fase.toLowerCase()})`).join("; ")}` : ""}.
                            </>,
                            <>
                              Under development under control: {num(ger.mw_em_implantacao, 0)} MW granted in {ger.usinas_em_implantacao} plants
                              {ger.em_implantacao.length ? (
                                <>
                                  , among them{" "}
                                  {ger.em_implantacao.slice(0, 3).map((u, i) => (
                                    <span key={`${u.nome}-${i}`}>
                                      {i ? "; " : ""}
                                      <Nome>{u.nome}</Nome> ({u.tipo}, {num(u.mw, 0)} MW, {rotuloFase(u.fase).toLowerCase()})
                                    </span>
                                  ))}
                                </>
                              ) : (
                                ""
                              )}
                              .
                            </>,
                          )}
                        </p>
                      )}
                      <p className="text-xs text-carvao-muted">
                        {tx("Lista completa no arquivo", "Full list in the file")}{" "}
                        <a className={link} href="/energia/series/listadas_usinas.csv">
                          listadas_usinas.csv
                        </a>{" "}
                        {tx(`(filtre pelo papel ${c.papel}).`, `(filter by the stock ${c.papel}).`)}
                      </p>
                    </SecaoDoPainel>
                  </>
                ) : (
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      `Nenhuma usina em operação sob controle da companhia no SIGA de ${dataSiga}.`,
                      `No plant in operation under the company's control in SIGA as of ${dataSiga}.`,
                    )}
                  </p>
                )}
                {tr && (
                  <SecaoDoPainel id="transmissao" titulo={tx("Que linhas de transmissão a companhia controla?", "Which transmission lines does the company control?")}>
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          {tr.concessionarias} {tr.concessionarias === 1 ? "concessionária" : "concessionárias"} sob controle, com {num(tr.km_circuito_operacao, 0)} km de circuito em operação, {num(tr.km_circuito_implantacao, 0)} km em implantação e{" "}
                          {num(tr.mva_transformacao_operacao, 0)} MVA de transformação em operação, em {tr.ufs.length} UFs ({tr.ufs.join(", ")}). Linha de circuito duplo conta duas vezes; a mesma subestação pode estar em mais de uma
                          concessionária.
                        </>,
                        <>
                          {tr.concessionarias} {tr.concessionarias === 1 ? "concession holder" : "concession holders"} under control, with {num(tr.km_circuito_operacao, 0)} circuit km in operation,{" "}
                          {num(tr.km_circuito_implantacao, 0)} km under development and {num(tr.mva_transformacao_operacao, 0)} MVA of transformation in operation, in {tr.ufs.length} states (
                          {tr.ufs.join(", ")}). A double-circuit line counts twice; the same substation can be in more than one concession holder.
                        </>,
                      )}
                    </p>
                    <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                      {tr.maiores.map((x) => (
                        <li key={x.cnpj} className="flex justify-between gap-3 border-b border-linha py-1">
                          <span className="text-carvao">
                            <Nome>{x.nome}</Nome>
                          </span>
                          <span className="whitespace-nowrap tabular-nums text-carvao-muted">{kmTexto(x.km)}</span>
                        </li>
                      ))}
                    </ul>
                  </SecaoDoPainel>
                )}
                {dist && (
                  <SecaoDoPainel
                    id="distribuicao"
                    titulo={tx("Que distribuidoras a companhia controla?", "Which distribution utilities does the company control?")}
                    lead={tx(
                      "Cada distribuidora tem ficha própria com perdas, continuidade, tarifa e demonstrações.",
                      "Each distribution utility has its own profile with losses, continuity, tariff and financial statements.",
                    )}
                  >
                    <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                      {dist.distribuidoras.map((d) => (
                        <li key={d.slug} className="flex justify-between gap-3 border-b border-linha py-1">
                          <Link href={rotaEntidade(d.slug)} className={link}>
                            <Nome>{d.sigla}</Nome>
                            <span className="sr-only">{tx(": ficha da distribuidora", ": distribution utility profile")}</span>
                          </Link>
                          <span className="whitespace-nowrap text-carvao-muted">
                            {d.ufs.join(", ")} ·{" "}
                            {d.ucs !== null
                              ? tx(`${num(d.ucs / 1e6, 2)} milhões de UCs`, `${num(d.ucs / 1e6, 2)} million consumer units`)
                              : tx("UCs sem dado", "consumer units without data")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </SecaoDoPainel>
                )}
              </div>
            </PainelEvidencia>

            <PainelEvidencia
              id="controle"
              pergunta={tx("Quem controla a companhia?", "Who controls the company?")}
              subtitulo={tx(
                "Cadeia de controle declarada à ANEEL e acionistas diretos declarados no Formulário de Referência da CVM",
                "Control chain declared to ANEEL and direct shareholders declared in the CVM Reference Form",
              )}
              natureza="OBSERVADO"
              porQueImporta={tx(
                <>O controlador indica quem decide a estratégia, os investimentos e a distribuição de lucros.</>,
                <>The controlling shareholder shows who decides strategy, investments and profit distribution.</>,
              )}
              oQueMudou={
                c.controle.mudancas.length
                  ? tx(
                      <>
                        Desde o formulário de {c.controle.mudancas_desde?.ano_formulario}:{" "}
                        {c.controle.mudancas
                          // i18n: dado (chave de dado ou forma de um ramo do tx)
                          .map((m) => (m.tipo === "entrada" ? `${m.acionista} passa a constar com ${pct(m.depois, 2)}` : m.tipo === "saida" ? `${m.acionista} deixa de constar` : `${m.acionista} de ${pct(m.antes, 2)} para ${pct(m.depois, 2)}`))
                          .join("; ")}
                        .
                      </>,
                      <>
                        Since the form of {c.controle.mudancas_desde?.ano_formulario}:{" "}
                        {c.controle.mudancas.map((m, i) => (
                          <span key={`${m.acionista}-${i}`}>
                            {i ? "; " : ""}
                            <Nome>{m.acionista}</Nome>{" "}
                            {m.tipo === "entrada"
                              ? `now appears with ${pct(m.depois, 2)}`
                              : m.tipo === "saida"
                                // i18n: dado (chave de dado ou forma de um ramo do tx)
                                ? "no longer appears"
                                : `from ${pct(m.antes, 2)} to ${pct(m.depois, 2)}`}
                          </span>
                        ))}
                        .
                      </>,
                    )
                  : tx(
                      <>Nenhuma mudança de pelo menos 0,5 ponto percentual entre os dois últimos formulários lidos.</>,
                      <>No change of at least 0.5 percentage point between the two latest forms read.</>,
                    )
              }
              comoInterpretar={tx(
                <>
                  {comNomes(textoControle(c), controladoresFre(c).map((a) => a.nome))} Espécie de controle declarada no Formulário Cadastral: {c.controle.especie_fca ?? "sem dado"}.
                </>,
                <>
                  {comNomes(textoControle(c), controladoresFre(c).map((a) => a.nome))} Type of control declared in the Registration Form: {c.controle.especie_fca ? traduzir(ESPECIE_CONTROLE_EN, c.controle.especie_fca) : semDado}.
                </>,
              )}
              naoConcluir={tx(
                <>As duas fontes têm datas e critérios próprios; a cadeia da ANEEL para em controle compartilhado e não mostra acordos de acionistas.</>,
                <>The two sources have their own dates and criteria; the ANEEL chain stops at shared control and does not show shareholders&apos; agreements.</>,
              )}
              proveniencia={prov.controle}
              complementares={[{ rotulo: tx("Cadeia de controle (ANEEL)", "Control chain (ANEEL)"), p: prov.ativos }]}
            >
              <ListadasEstrutura c={c} nome={nome} />
              {cruzadas.length > 0 && (
                <SecaoDoPainel id="cruzadas" titulo={tx("Participações entre companhias da carteira", "Stakes between portfolio companies")}>
                  <ul className="space-y-1.5 text-sm leading-relaxed text-carvao-muted">
                    {cruzadas.map((x) => (
                      <li key={`${x.de.papel}-${x.em.papel}`}>{comNomes(textoCruzada(x, (y) => nomeCurto(y, logos)), [nomeCurto(x.de, logos), nomeCurto(x.em, logos)])}</li>
                    ))}
                  </ul>
                </SecaoDoPainel>
              )}
            </PainelEvidencia>

            {fin && (
              <PainelEvidencia
                id="financas"
                pergunta={tx("O que mostram as demonstrações?", "What do the financial statements show?")}
                subtitulo={tx("DFP consolidada na CVM, R$ milhões nominais, exercícios encerrados", "Consolidated DFP at the CVM, nominal R$ million, closed fiscal years")}
                natureza="OBSERVADO"
                porQueImporta={tx(
                  <>Receita, resultado, dívida e patrimônio são a base para comparar a companhia com ela mesma ao longo do tempo.</>,
                  <>Revenue, earnings, debt and equity are the basis for comparing the company with itself over time.</>,
                )}
                oQueMudou={tx(
                  <>
                    Último exercício: {fin.ultimo_exercicio ?? "sem dado"}. {fin.valores_reapresentados ? `${fin.valores_reapresentados} valores reapresentados pela companhia no comparativo do ano seguinte.` : ""}
                  </>,
                  <>
                    Latest fiscal year: {fin.ultimo_exercicio ?? semDado}.{" "}
                    {fin.valores_reapresentados ? `${fin.valores_reapresentados} values restated by the company in the following year's comparative.` : ""}
                  </>,
                )}
                comoInterpretar={tx(
                  <>
                    {g.definicoes.margem_ebit} {g.definicoes.divida_bruta_sobre_pl} {g.definicoes.lucro_sobre_pl}
                  </>,
                  <>
                    {def(g.definicoes.margem_ebit)} {def(g.definicoes.divida_bruta_sobre_pl)} {def(g.definicoes.lucro_sobre_pl)}
                  </>,
                )}
                naoConcluir={tx(
                  <>Valores nominais, sem correção pela inflação; o consolidado mistura todos os negócios da companhia, inclusive fora do setor elétrico.</>,
                  <>Nominal values, not adjusted for inflation; the consolidated statement mixes all of the company&apos;s businesses, including those outside the power sector.</>,
                )}
                proveniencia={prov.financas ?? prov.ativos}
              >
                <div className="space-y-6">
                  <GraficoBarras
                    titulo={tx(
                      "Receita, resultado antes do financeiro e dos tributos e lucro líquido, consolidado",
                      "Revenue, earnings before financial result and taxes, and net income, consolidated",
                    )}
                    dados={fin.serie.map((x) => ({ ano: String(x.exercicio), receita: x.receita, ebit: x.ebit, lucro: x.lucro_liquido }))}
                    // i18n: dado (chave de dado ou forma de um ramo do tx)
                    chaveCategoria="ano"
                    series={[
                      { id: "receita", rotulo: tx("Receita", "Revenue"), cor: "var(--serie-referencia)" },
                      { id: "ebit", rotulo: tx("Resultado antes do financeiro e dos tributos", "Earnings before financial result and taxes (EBIT)"), cor: "var(--serie-comp-4)" },
                      // i18n: dado (chave de dado ou forma de um ramo do tx)
                      { id: "lucro", rotulo: tx("Lucro líquido", "Net income"), cor: "var(--cor-energia)" },
                    ]}
                    unidade={tx("R$ milhões", "R$ million")}
                    casas={0}
                  />
                  <div className="tabela-scroll overflow-x-auto" role="region" aria-label={tx("Demonstrações e razões por exercício", "Statements and ratios by fiscal year")} tabIndex={0}>
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                      <thead>
                        <tr className="text-xs text-carvao-muted">
                          <th scope="col" className="pb-2 pr-3 text-left font-medium">
                            {tx("R$ milhões", "R$ million")}
                          </th>
                          {fin.serie.map((x) => (
                            <th key={x.exercicio} scope="col" className="pb-2 pl-3 text-right font-medium">
                              {x.exercicio}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {contasFin().map((f) => (
                          <tr key={f.id} className="border-t border-linha">
                            <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">{f.rotulo}</th>
                            {fin.serie.map((x) => (
                              <td key={x.exercicio} className="py-1.5 pl-3 text-right tabular-nums text-carvao">{num(x[f.id], 0)}</td>
                            ))}
                          </tr>
                        ))}
                        <tr className="border-t border-linha">
                          <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">
                            {tx("Margem antes do financeiro e dos tributos (%)", "EBIT margin (%)")}
                          </th>
                          {fin.serie.map((x) => (
                            <td key={x.exercicio} className="py-1.5 pl-3 text-right tabular-nums text-carvao-muted">{num(x.margem_ebit_pct, 1)}</td>
                          ))}
                        </tr>
                        <tr className="border-t border-linha">
                          <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">
                            {tx("Dívida bruta ÷ patrimônio líquido (vezes)", "Gross debt ÷ shareholders' equity (times)")}
                          </th>
                          {fin.serie.map((x) => (
                            <td key={x.exercicio} className="py-1.5 pl-3 text-right tabular-nums text-carvao-muted">{num(x.divida_bruta_sobre_pl, 2)}</td>
                          ))}
                        </tr>
                        <tr className="border-t border-linha">
                          <th scope="row" className="py-1.5 pr-3 text-left font-normal text-carvao">
                            {tx("Lucro dos controladores ÷ patrimônio (%)", "Net income attributable to owners of the parent ÷ equity (%)")}
                          </th>
                          {fin.serie.map((x) => (
                            <td key={x.exercicio} className="py-1.5 pl-3 text-right tabular-nums text-carvao-muted">{num(x.lucro_sobre_pl_pct, 1)}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {ultFin && (
                    <p className="text-xs text-carvao-muted">
                      {tx("Séries completas, trimestres e o individual na página de", "Full series, quarters and the individual statements on the page on")}{" "}
                      <Link href="/setor-eletrico/empresas/financas#p038" className={link}>
                        {tx("finanças das companhias abertas", "finances of publicly held companies")}
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </PainelEvidencia>
            )}

            {b && !b.motivo && (
              <PainelEvidencia
                id="bolsa"
                pergunta={tx(`Como a ação ${c.papel} se comportou?`, `How has the ${c.papel} stock performed?`)}
                subtitulo={tx(
                  `Índice mensal em base 100 · último pregão de cada mês até ${dataBR(b.ultimo_pregao)}`,
                  `Monthly index based 100 · last trading session of each month up to ${dataBR(b.ultimo_pregao)}`,
                )}
                natureza="CALCULADO"
                porQueImporta={tx(
                  <>O retorno total mostra o que o acionista obteve com a ação e os proventos; o preço sozinho ignora dividendos e juros sobre capital próprio.</>,
                  <>Total return shows what the shareholder obtained from the share and the distributions; price alone ignores dividends and interest on equity.</>,
                )}
                oQueMudou={<>{textoBolsa(b)}</>}
                comoInterpretar={tx(
                  <>
                    {g.definicoes.retorno_total} {g.definicoes.retorno_preco}
                  </>,
                  <>
                    {def(g.definicoes.retorno_total)} {def(g.definicoes.retorno_preco)}
                  </>,
                )}
                naoConcluir={tx(
                  <>Retorno passado não indica retorno futuro e não é recomendação de investimento.</>,
                  <>Past returns do not indicate future returns, and this is not investment advice.</>,
                )}
                proveniencia={prov.bolsa}
              >
                <div className="space-y-6">
                  <GraficoLinhas
                    titulo={tx(
                      `${c.papel}: retorno total, preço ajustado e fechamento de tela (base 100 em ${dataBR(base[0]?.m)})`,
                      `${c.papel}: total return, adjusted price and screen close (base 100 in ${dataBR(base[0]?.m)})`,
                    )}
                    dados={dadosBolsa}
                    chaveX="m"
                    formatoX="mes"
                    unidade={tx("base 100", "base 100")}
                    casas={1}
                    series={[
                      // i18n: dado (chave de dado ou forma de um ramo do tx)
                      { id: "total", rotulo: tx("Retorno total", "Total return"), cor: "var(--cor-energia)", espessura: 2.5 },
                      { id: "preco", rotulo: tx("Preço ajustado", "Adjusted price"), cor: "var(--serie-comp-4)" },
                      { id: "tela", rotulo: tx("Fechamento de tela", "Screen close"), cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    legendaInterativa
                    zoom
                  />
                  <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                    {[
                      { id: "12m", rot: tx("12 meses", "12 months"), r: b.retorno_12m },
                      // i18n: dado (chave de dado ou forma de um ramo do tx)
                      { id: "ano", rot: tx("No ano", "Year to date"), r: b.retorno_no_ano },
                      // i18n: dado (chave de dado ou forma de um ramo do tx)
                      { id: "desde", rot: desde ? tx(`Desde ${dataBR(desde.de)}`, `Since ${dataBR(desde.de)}`) : tx("Desde o início da série", "Since the start of the series"), r: desde },
                    ].map((x) => (
                      <div key={x.id} className="border-l-2 border-linha pl-3">
                        <dt className="rotulo text-mineral">{x.rot}</dt>
                        <dd className="tabular-nums text-carvao">
                          {tx(
                            <>
                              {sinalPct(x.r?.total_pct)} com proventos · {sinalPct(x.r?.preco_pct)} no preço
                            </>,
                            <>
                              {sinalPct(x.r?.total_pct)} with distributions · {sinalPct(x.r?.preco_pct)} in price
                            </>,
                          )}
                        </dd>
                        {x.r && (
                          <dd className="text-xs text-mineral">
                            {tx(`de ${dataBR(x.r.de)} a ${dataBR(x.r.ate)}`, `from ${dataBR(x.r.de)} to ${dataBR(x.r.ate)}`)}
                          </dd>
                        )}
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Fechamento em {dataBR(b.ultimo_pregao)}: R$ {num(b.fechamento, 2)} por {acao}. Volume médio diário nos últimos 3 meses: R$ {num((b.volume_medio_diario_3m ?? 0) / 1e6, 1)} milhões em {b.pregoes_3m} pregões.
                        Proventos com data ex nos últimos 12 meses: R$ {num(b.proventos_12m, 2)} por {acao}, brutos.
                      </>,
                      <>
                        Close on {dataBR(b.ultimo_pregao)}: R$ {num(b.fechamento, 2)} per {acao}. Average daily volume over the last 3 months: R$ {num((b.volume_medio_diario_3m ?? 0) / 1e6, 1)} million
                        in {b.pregoes_3m} trading sessions. Distributions with an ex-date in the last 12 months: R$ {num(b.proventos_12m, 2)} per {acao}, gross.
                      </>,
                    )}
                  </p>
                  {(b.emendas.length > 0 || b.notas.length > 0 || b.eventos_acoes.length > 0 || b.bonificacoes_outra_classe.length > 0) && (
                    <ul className="space-y-1.5 border-l-2 border-linha pl-3 text-sm leading-relaxed text-carvao-muted">
                      {b.emendas.map((e) => (
                        <li key={e.codigo_anterior}>
                          {tx(
                            <>
                              A série emenda {e.codigo_anterior} (até {dataBR(e.ultimo_pregao_anterior)}) e {e.codigo} (desde {dataBR(e.primeiro_pregao)}): mesma companhia e mesma classe no Formulário Cadastral.
                            </>,
                            <>
                              The series joins {e.codigo_anterior} (up to {dataBR(e.ultimo_pregao_anterior)}) and {e.codigo} (since {dataBR(e.primeiro_pregao)}): same company and same class in the
                              Registration Form.
                            </>,
                          )}
                        </li>
                      ))}
                      {b.eventos_acoes.map((e) => (
                        <li key={e.data_ex}>
                          {tx(
                            <>
                              {dataBR(e.data_ex)}: evento em ações com multiplicador {num(e.multiplicador, 2)} (data com {dataBR(e.data_com)}), publicado pela B3.
                            </>,
                            <>
                              {dataBR(e.data_ex)}: stock event with multiplier {num(e.multiplicador, 2)} (cum date {dataBR(e.data_com)}), published by B3.
                            </>,
                          )}
                        </li>
                      ))}
                      {b.bonificacoes_outra_classe.map((e) => (
                        <li key={e.data_com}>
                          {tx(
                            <>
                              Bonificação em ações de outra classe ({e.isin_emitido}), {num(e.fator, 2)} por 100 ações, valorizada em R$ {num(e.valor, 2)} por ação pelo primeiro fechamento da classe recebida em{" "}
                              {dataBR(e.data_fechamento)} (estimativa do observatório).
                            </>,
                            <>
                              Bonus in shares of another class ({e.isin_emitido}), {num(e.fator, 2)} per 100 shares, valued at R$ {num(e.valor, 2)} per share by the first close of the class received on{" "}
                              {dataBR(e.data_fechamento)} (observatory estimate).
                            </>,
                          )}
                        </li>
                      ))}
                      {b.notas.map((t) => (
                        <li key={t}>{datasLegiveis(notaBolsa(t))}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </PainelEvidencia>
            )}

            <PainelEvidencia
              id="movimentos"
              pergunta={tx("Como a companhia tem se movimentado?", "How has the company been moving?")}
              subtitulo={tx(
                `Fatos relevantes entregues à CVM desde ${dataBR(c.movimentos.desde)} · os mais recentes`,
                `Material facts filed with the CVM since ${dataBR(c.movimentos.desde)} · the most recent ones`,
              )}
              natureza="OBSERVADO"
              porQueImporta={tx(
                <>Aquisições, vendas de ativos, emissões, mudanças de controle e decisões regulatórias aparecem primeiro nos fatos relevantes.</>,
                <>Acquisitions, asset sales, issuances, changes of control and regulatory decisions appear first in material facts.</>,
              )}
              oQueMudou={tx(
                <>
                  {c.movimentos.fatos_relevantes_24m} fatos relevantes no período
                  {Object.keys(c.movimentos.por_ano).length ? ` (${Object.entries(c.movimentos.por_ano).map(([a, n]) => `${a}: ${n}`).join("; ")})` : ""}.
                </>,
                <>
                  {c.movimentos.fatos_relevantes_24m} material facts in the period
                  {Object.keys(c.movimentos.por_ano).length ? ` (${Object.entries(c.movimentos.por_ano).map(([a, n]) => `${a}: ${n}`).join("; ")})` : ""}.
                </>,
              )}
              comoInterpretar={tx(
                <>O título é o assunto que a própria companhia deu ao documento; o link leva ao arquivo no sistema da CVM.</>,
                <>The title is the subject the company itself gave the document, in Portuguese; the link leads to the file in the CVM system.</>,
              )}
              naoConcluir={tx(<>O observatório não resume nem classifica o conteúdo dos documentos.</>, <>The observatory neither summarizes nor classifies the content of the documents.</>)}
              proveniencia={prov.movimentos}
            >
              {c.movimentos.recentes.length ? (
                <ol className="space-y-2" aria-label={tx(`Fatos relevantes mais recentes de ${nome}`, `Most recent material facts of ${nome}`)}>
                  {c.movimentos.recentes.map((f, i) => (
                    <li key={`${f.protocolo ?? f.data_entrega}-${i}`} className="grid gap-x-4 border-b border-linha pb-2 text-sm sm:grid-cols-[6.5rem_1fr]">
                      <time dateTime={f.data_entrega} className="tabular-nums text-mineral">
                        {dataBR(f.data_entrega)}
                      </time>
                      {f.link ? (
                        <a href={f.link} className={link} rel="noopener noreferrer">
                          {assunto(f.assunto)}
                          <span className="sr-only">{tx(" (documento na CVM)", " (document at the CVM)")}</span>
                        </a>
                      ) : (
                        <span className="text-carvao">{assunto(f.assunto)}</span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-carvao-muted">{tx("Nenhum fato relevante entregue no período.", "No material fact filed in the period.")}</p>
              )}
              <p className="mt-2 text-xs text-carvao-muted">
                {tx("Todos os fatos relevantes de 24 meses no arquivo", "All material facts from 24 months in the file")}{" "}
                <a className={link} href="/energia/series/listadas_fatos_relevantes.csv">
                  listadas_fatos_relevantes.csv
                </a>
                .
              </p>
            </PainelEvidencia>

            <nav aria-label={tx("Outras companhias da carteira", "Other portfolio companies")} className="border-t border-linha pt-6">
              <h2 className="ed-h3 font-serif text-carvao">{tx("Outras companhias da carteira", "Other portfolio companies")}</h2>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {outras.map((x) => (
                  <li key={x.papel}>
                    <Link href={rotaFicha(x)} className={`${link} inline-flex min-h-[44px] items-center`}>
                      <Nome>{nomeCurto(x, logos)}</Nome> ({x.papel})
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
