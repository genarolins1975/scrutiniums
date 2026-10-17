import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { caminhoComParametros, metadadosEnergia } from "@/lib/energia/metadados-idioma";
import Link from "@/components/i18n/LinkIdioma";
import { Nome } from "@/components/i18n/Nome";
import { notFound, permanentRedirect } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasArvore } from "@/components/energia/EmpresasArvore";
import { EmpresasFichaPares } from "@/components/energia/EmpresasFichaPares";
import { EmpresasAviso, EmpresasComoLer, EmpresasDatas, EmpresasNavegacao, EmpresasRecorte, EmpresasSeguir, type ParteComoLer } from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_EVOLUCAO_PERDAS,
  COLUNAS_EVOLUCAO_QUALIDADE,
  COLUNAS_EVOLUCAO_TARIFA,
  cnpjFormatado,
  comReferenciaNacional,
  dadosFinancas,
  dataTexto,
  downloadsDe,
  emMilhoes,
  inteiro,
  linksOrigem,
  motivoExplicado,
  mwTexto,
  nomeOuCnpj,
  numTexto,
  paresPerdas,
  paresQualidade,
  pctTexto,
  resolverEntidade,
  respostaFicha,
  rotaEntidade,
  rotaPainel,
  rotuloEscopo,
  rotuloGrupo,
  rotuloSetorCvm,
  rotuloSituacaoCvm,
  semNomesDeCampo,
  sentidoLimite,
  slugsEstaticos,
  temValor,
  textoAnosNegativos,
  textoCompanhia,
  textoNegativos,
  textoPares,
  trimestreTexto,
  vereditoFicha,
} from "@/lib/energia/empresas";
import { alertasDePerdas, arvoreDoArquivo, evidenciaPerdas, evidenciasReceita, evolucaoDistribuidora, seriesFinanceirasDe } from "@/lib/energia/empresas-arquivos";
import { comValorExibido } from "@/lib/energia/evidencia";
import { carimbo, datasLegiveis, sinal } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { CLASSIFICACAO_DIST_EN, DEFINICAO_EMPRESAS_EN, NOMES_FONTES, atoNoIdioma, comNomes, motivoTarifa, traduzir } from "@/lib/energia/i18n/empresas-leiloes";
import { SIGLAS, SIGLAS_IDIOMAS } from "@/lib/energia/siglas";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export const dynamicParams = false;

/** Uma página por distribuidora do índice (slug principal) e uma rota de apoio por slug alternativo, que redireciona ao principal. */
export function generateStaticParams() {
  const g = lerGold<EmpresasGold>("empresas.json");
  return integra(g) ? slugsEstaticos(g.distribuidoras.indice).map((entidade) => ({ entidade })) : [];
}

function metadadosDaPagina({ params }: { params: { entidade: string } }): Metadata {
  const g = lerGold<EmpresasGold>("empresas.json");
  const r = integra(g) ? resolverEntidade(g.distribuidoras.indice, params.entidade) : null;
  if (!r) return {};
  const d = r.dist;
  return {
    title: tx(`${d.sigla}: perdas, continuidade, tarifa, controle e finanças da distribuidora`, `${d.sigla}: losses, continuity, tariff, control and finances of the distribution utility`),
    description: tx(
      `Perfil da ${d.sigla} (${d.nome ?? "razão social sem registro"}, CNPJ ${cnpjFormatado(d.cnpj)}): perdas, DEC e FEC diante do limite, tarifa residencial, evolução própria, pares, cadeia de controle e demonstrações na CVM quando é companhia aberta.`,
      `Profile of ${d.sigla} (${d.nome ?? "corporate name not recorded"}, CNPJ ${cnpjFormatado(d.cnpj)}): losses, DEC and FEC against the limit, residential tariff, own evolution, peers, control chain and CVM financial statements when it is a publicly held company.`,
    ),
    alternates: { canonical: rotaEntidade(d.slug) },
  };
}

export async function generateMetadata(props: { params: { entidade: string } }, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia(caminhoComParametros("/setor-eletrico/empresas/[entidade]", props.params), metadadosDaPagina(props), anterior);
}

function colunasFin(): ColunaTabela[] {
  const milhoes = tx("R$ milhões", "R$ million");
  return [
    { id: "x", rotulo: tx("Exercício", "Fiscal year"), tipo: "texto" },
    { id: "receita", rotulo: tx("Receita", "Revenue"), tipo: "numero", unidade: milhoes, casas: 1 },
    { id: "ebit", rotulo: tx("Resultado antes do financeiro e dos tributos", "Earnings before financial result and taxes (EBIT)"), tipo: "numero", unidade: milhoes, casas: 1 },
    { id: "lucro_liquido", rotulo: tx("Lucro líquido", "Net income"), tipo: "numero", unidade: milhoes, casas: 1 },
    { id: "ativo_total", rotulo: tx("Ativo total", "Total assets"), tipo: "numero", unidade: milhoes, casas: 1 },
    { id: "divida_bruta", rotulo: tx("Dívida bruta", "Gross debt"), tipo: "numero", unidade: milhoes, casas: 1 },
    { id: "patrimonio_liquido", rotulo: tx("Patrimônio líquido", "Shareholders' equity"), tipo: "numero", unidade: milhoes, casas: 1 },
  ];
}
const CONTAS_FICHA = ["receita", "ebit", "lucro_liquido", "ativo_total", "divida_bruta", "patrimonio_liquido"] as const;

/** Frase do limite que a ANEEL fixa para a própria distribuidora: o valor, a diferença e o sentido dela em palavras. */
function notaLimite(valor: number | null | undefined, limite: number | null | undefined, sufixo: string): string {
  if (!temValor(limite)) return tx("Limite sem dado nesta publicação.", "Limit without data in this release.");
  const base = tx(`Limite da ANEEL para ela: ${numTexto(limite, 2)}${sufixo}.`, `ANEEL's limit for it: ${numTexto(limite, 2)}${sufixo}.`);
  const s = sentidoLimite(valor, limite);
  if (!temValor(valor) || !s) return base;
  const sentido =
    s === "igual"
      ? tx("igual ao limite", "equal to the limit")
      : s === "abaixo"
        ? tx("abaixo do limite", "below the limit")
        : tx("acima do limite", "above the limit");
  return tx(`${base} Diferença: ${sinal(valor - limite, 2, sufixo)}, ${sentido}.`, `${base} Difference: ${sinal(valor - limite, 2, sufixo)}, ${sentido}.`);
}

export default function FichaDistribuidora({ params }: { params: { entidade: string } }) {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="empresas" />
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel
            titulo={tx("Ficha da distribuidora indisponível nesta publicação", "Distribution utility profile unavailable in this release")}
            motivo={
              (g as { motivo?: string } | null)?.motivo ??
              tx(
                "Os dados do módulo Empresas não foram gerados ou não passaram na validação desta publicação, e nenhum número de reserva é exibido.",
                "The Companies module data were not generated or did not pass validation in this release, and no fallback number is shown.",
              )
            }
          />
        </main>
      </>
    );
  }
  const r = resolverEntidade(g.distribuidoras.indice, params.entidade);
  if (!r) notFound();
  // slug alternativo (outra sigla publicada pelas fontes): rota de apoio que leva à ficha principal
  if (!r.principal) permanentRedirect(rotaEntidade(r.dist.slug));

  const en = idiomaEnergia() === "en";
  const d = r.dist;
  const ix = g.distribuidoras.indice;
  const prov = g.proveniencia;
  const evol = evolucaoDistribuidora(g.distribuidoras.series_evolucao, d.cnpj);
  const nacional = lerGold<{ nacional?: { ano: number; parcial: boolean; taxa_total_pct: number | null; universo?: string }[] }>("perdas.json")?.nacional ?? [];
  const perdasSerie = d.grupo === "concessionaria" ? comReferenciaNacional(evol.perdas, nacional) : evol.perdas.map((p) => ({ ...p, brasil: null }));
  const evPerdas = evidenciaPerdas(d.cnpj);
  const alertas = alertasDePerdas(d.cnpj);
  // taxa nacional das concessionárias no mesmo ano da perda exibida (só ano completo, como no gráfico de evolução)
  const nacionalDoAno = perdasSerie.find((x) => x.ano === String(d.perdas?.ano))?.brasil ?? null;
  const motivos = g.controle.cobertura.motivos_parada;
  const pp = paresPerdas(d, ix);
  const pq = paresQualidade(d, ix);
  const arvore = arvoreDoArquivo(g.series.cadeia, d.cnpj);
  const companhia = g.financas.companhias.find((c) => c.distribuidora_slug === d.slug || c.cnpj === d.cnpj) ?? null;
  const fin = companhia ? seriesFinanceirasDe(g.series.financas, [companhia.cnpj]) : null;
  const evReceita = companhia ? (evidenciasReceita(g.series.evidencias, [companhia.cnpj])[companhia.cnpj] ?? null) : null;
  const escopo = companhia?.escopo_exibido ?? "con";
  const linhasFin = (() => {
    if (!companhia || !fin) return [];
    const porAno = new Map<string, Record<string, string | number | null>>();
    for (const conta of CONTAS_FICHA) {
      for (const l of dadosFinancas(fin, [companhia.cnpj], escopo, conta, "anual").linhas) {
        const x = String(l.x);
        const linha = porAno.get(x) ?? { id: x, x };
        linha[conta] = (l[companhia.cnpj] as number | null) ?? null;
        porAno.set(x, linha);
      }
    }
    return Array.from(porAno.values())
      .map((l) => {
        for (const c of CONTAS_FICHA) if (!(c in l)) l[c] = null;
        return l;
      })
      .sort((a, b) => String(a.x).localeCompare(String(b.x)));
  })();
  // controladora aberta acima: a primeira companhia aberta ativa na cadeia declarada (ela consolida esta)
  const abertaAcima = d.controle.cadeia
    .slice(1)
    .map((c) => g.financas.companhias.find((x) => x.cnpj === c && x.situacao === "ATIVO"))
    .find((x) => !!x);
  const q = d.qualidade;
  const t = d.tarifa;
  const p = d.perdas;
  const origens = linksOrigem(d);
  // a linha das siglas só diz algo quando as fontes publicam siglas realmente diferentes (e não a mesma, com outra caixa ou acento)
  const semAcento = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const siglasDiferentes = new Set(d.siglas.map((x) => semAcento(x.sigla))).size > 1;
  const janela = tx(
    `${trimestreTexto(g.datas.polimero_janela[0])} a ${trimestreTexto(g.datas.polimero_janela.at(-1))}`,
    `${trimestreTexto(g.datas.polimero_janela[0])} to ${trimestreTexto(g.datas.polimero_janela.at(-1))}`,
  );
  const semSerie: ParteComoLer[] = [];
  if (!evol.perdas.length) semSerie.push("perdas");
  if (!evol.qualidade.length) semSerie.push("continuidade");
  if (!evol.tarifa.length) semSerie.push("tarifa");
  const semDado = tx("sem dado", "no data");
  const classificacao = d.classificacao ? traduzir(CLASSIFICACAO_DIST_EN, d.classificacao) : null;
  const vigencia = t && t.vigente ? tx(`vigente de ${dataTexto(t.inicio)} a ${dataTexto(t.fim)}`, `in force from ${dataTexto(t.inicio)} to ${dataTexto(t.fim)}`) : null;
  const fonteSigla = (f: string) =>
    ({
      tarifas: tx("tarifas", "tariffs"),
      continuidade: tx("continuidade", "continuity"),
      samp: "SAMP",
      cadastro_agentes: tx("cadastro de agentes", "agent registry"),
    })[f as "tarifas"] ?? f;
  const escalaCorrigida = (x: string) => (en ? x.replace(/\bconsolidado\b/g, "consolidated") : x);

  const oQueMudou = tx(
    <>
      Evolução própria: perdas de {evol.perdas[0]?.ano ?? "sem dado"} a {evol.perdas.at(-1)?.ano ?? "sem dado"}, continuidade de {evol.qualidade[0]?.ano ?? "sem dado"} a{" "}
      {evol.qualidade.at(-1)?.ano ?? "sem dado"}, {inteiro(evol.tarifa.length)} vigências tarifárias.
      {evol.quebrasQualidade.length ? ` O perímetro da continuidade mudou em ${evol.quebrasQualidade.join(", ")}.` : ""}
    </>,
    <>
      Own evolution: losses from {evol.perdas[0]?.ano ?? semDado} to {evol.perdas.at(-1)?.ano ?? semDado}, continuity from {evol.qualidade[0]?.ano ?? semDado} to{" "}
      {evol.qualidade.at(-1)?.ano ?? semDado}, {inteiro(evol.tarifa.length)} tariff validity periods.
      {evol.quebrasQualidade.length ? ` The continuity perimeter changed in ${evol.quebrasQualidade.join(", ")}.` : ""}
    </>,
  );
  const comoInterpretar = tx(
    <>
      {semNomesDeCampo(g.distribuidoras.pares)} Ano incompleto de perdas aparece tracejado e fora da comparação; o limite de DEC e FEC é o fixado pela ANEEL para a própria distribuidora. A referência do Brasil
      é a taxa das concessionárias em conjunto (perdas somadas sobre energia injetada somada), não a média simples das taxas.
    </>,
    <>
      {semNomesDeCampo(traduzir(DEFINICAO_EMPRESAS_EN, g.distribuidoras.pares))} An incomplete year of losses appears dashed and out of the comparison; the DEC and FEC limit is the one set by ANEEL
      for the distribution utility itself. The Brazil reference is the rate of the concession holders taken together (summed losses over summed injected energy), not the simple average of the rates.
    </>,
  );
  const naoConcluir = tx(
    <>
      Não se conclui eficiência nem culpa: perdas, interrupções e tarifa dependem da área atendida. A tarifa B1 sem tributos não é a conta inteira. As taxas da distribuidora não valem para cada
      município da área (não se replicam por município).
    </>,
    <>
      Neither efficiency nor fault can be concluded: losses, interruptions and tariff depend on the area served. The B1 tariff before taxes is not the whole bill. The distribution utility&apos;s rates
      do not apply to each municipality in the area (they are not replicated by municipality).
    </>,
  );
  const cvmLink = (cnpj: string) => `${rotaPainel("p038")}?fin.sel=${cnpj}#p038`;
  const milhoes = tx("R$ milhões", "R$ million");

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-ficha" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="ficha" />
        <CabecalhoModulo
          rotulo={tx("Perfil da distribuidora", "Distribution utility profile")}
          siglas={["CNPJ", "ANEEL", "SAMP", "DEC", "FEC", "TE", "TUSD", "REH", "SIGA", "CVM", "DFP", "ITR"]}
          titulo={tx<ReactNode>(`${d.sigla}: perdas, continuidade e tarifa`, comNomes(`${d.sigla}: losses, continuity and tariff`, [d.sigla]))}
          lead={tx(
            <>
              {d.nome ?? "Razão social sem registro"} · CNPJ ({SIGLAS.CNPJ}) <span className="whitespace-nowrap">{cnpjFormatado(d.cnpj)}</span> · {d.classificacao ?? rotuloGrupo(d.grupo)} ·{" "}
              {d.ufs.length ? `área em ${d.ufs.join(", ")}` : "sem conjunto elétrico vigente (UF sem registro)"} · {d.ativa ? "ativa" : "inativa"}.
            </>,
            <>
              {d.nome ? <Nome>{d.nome}</Nome> : "Corporate name not recorded"} · CNPJ ({SIGLAS_IDIOMAS.en.CNPJ}) <span className="whitespace-nowrap">{cnpjFormatado(d.cnpj)}</span> ·{" "}
              {classificacao ?? rotuloGrupo(d.grupo)} · {d.ufs.length ? `area in ${d.ufs.join(", ")}` : "no current consumer set (state not recorded)"} · {d.ativa ? "active" : "inactive"}.
            </>,
          )}
          recorte={tx(
            `Perdas de ${p?.ano ?? "sem dado"} · continuidade de ${q?.ano ?? "sem dado"} · tarifa ${vigencia ?? "sem vigência na data do arquivo de tarifas"}`,
            `Losses for ${p?.ano ?? semDado} · continuity for ${q?.ano ?? semDado} · tariff ${vigencia ?? "not in force on the date of the tariff file"}`,
          )}
          fonte={tx(
            `ANEEL (${SIGLAS.ANEEL}), bases de perdas, continuidade e tarifas, pelo mesmo CNPJ`,
            `ANEEL (${SIGLAS_IDIOMAS.en.ANEEL}), loss, continuity and tariff databases, by the same CNPJ`,
          )}
          referencia={tx(
            <>
              Perdas de {p?.ano ?? "sem dado"} (base publicada de Perdas), continuidade de {q?.ano ?? "sem dado"} (base publicada de Qualidade), tarifas da base publicada de Conta de luz; cadeia de controle
              declarada à ANEEL de {janela}. Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              Losses for {p?.ano ?? semDado} (Losses published database), continuity for {q?.ano ?? semDado} (Quality of supply published database), tariffs from the Electricity bill published
              database; control chain declared to ANEEL from {janela}. Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <EmpresasDatas
              itens={[
                {
                  rotulo: tx("Perdas", "Losses"),
                  texto: tx(`${p?.ano ?? "sem dado"}, base publicada de Perdas`, `${p?.ano ?? semDado}, Losses published database`),
                  natureza: prov.distribuidoras_perdas?.natureza ?? "CALCULADO",
                },
                {
                  rotulo: tx("Continuidade", "Continuity"),
                  texto: tx(`${q?.ano ?? "sem dado"}, base publicada de Qualidade`, `${q?.ano ?? semDado}, Quality of supply published database`),
                  natureza: prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO",
                },
                {
                  rotulo: tx("Tarifa B1", "B1 tariff"),
                  texto: vigencia ?? tx("sem vigência na data do arquivo", "not in force on the file date"),
                  natureza: prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO",
                },
                { rotulo: tx("Cadeia de controle", "Control chain"), texto: tx(`declarações de ${janela}`, `declarations from ${janela}`), natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx(`Indicadores da ${d.sigla}`, `${d.sigla} indicators`)}
              nota={tx(
                "Medidas do último ano de cada base, fixas: não mudam com a distribuidora escolhida nos pares. Só as perdas têm ficha de prova; DEC, FEC e tarifa vêm das bases de Qualidade e de Conta de luz, sem ficha por distribuidora.",
                "Measures of the latest year of each database, fixed: they do not change with the distribution utility chosen among the peers. Only losses have a proof sheet; DEC, FEC and tariff come from the Quality of supply and Electricity bill databases, without a sheet per distribution utility.",
              )}
            >
              {evPerdas ? (
                <Numero
                  variante="faixa"
                  rotulo={tx("Perdas totais", "Total losses")}
                  natureza={prov.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                  evidencia={comValorExibido(evPerdas.evidencia, pctTexto(evPerdas.evidencia.valor_calculo, 2).replace("−", "-"))}
                  formato="pct"
                  casas={2}
                  unidade={tx("da energia injetada", "of injected energy")}
                  nota={
                    temValor(nacionalDoAno)
                      ? tx(`Taxa nacional das concessionárias no mesmo ano: ${pctTexto(nacionalDoAno, 2)}.`, `National rate of the concession holders in the same year: ${pctTexto(nacionalDoAno, 2)}.`)
                      : undefined
                  }
                  endereco={`${rotaEntidade(d.slug)}#ficha`}
                />
              ) : (
                <Numero
                  variante="faixa"
                  rotulo={tx("Perdas totais", "Total losses")}
                  natureza={prov.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                  valor={p?.taxa_total_pct ?? null}
                  formato="pct"
                  casas={2}
                  unidade={tx("da energia injetada", "of injected energy")}
                  periodo={p?.ano ? String(p.ano) : undefined}
                  motivoAusencia={
                    p
                      ? tx(
                          `Sem taxa de perdas no ano de referência; último mês no SAMP: ${dataTexto(p.ultima_competencia)}.`,
                          `No loss rate in the reference year; latest month in SAMP: ${dataTexto(p.ultima_competencia)}.`,
                        )
                      : tx("A distribuidora não aparece no SAMP.", "The distribution utility does not appear in SAMP.")
                  }
                  nota={
                    p && temValor(p.taxa_total_pct)
                      ? tx("O módulo Perdas não publica a ficha Comprove deste CNPJ.", "The Losses module does not publish the proof sheet for this CNPJ.")
                      : undefined
                  }
                />
              )}
              <Numero
                variante="faixa"
                rotulo={tx("Duração das interrupções (DEC)", "Interruption duration (DEC)")}
                natureza={prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO"}
                valor={q?.dec ?? null}
                formato="num"
                casas={2}
                unidade="h"
                periodo={q?.ano ? String(q.ano) : undefined}
                motivoAusencia={
                  q?.ano
                    ? tx("DEC sem dado no ano de referência.", "DEC without data in the reference year.")
                    : tx(
                        "Sem indicadores de continuidade publicados para esta distribuidora no ano de referência.",
                        "No continuity indicators published for this distribution utility in the reference year.",
                      )
                }
                nota={q ? notaLimite(q.dec, q.dec_limite, " h") : undefined}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Frequência das interrupções (FEC)", "Interruption frequency (FEC)")}
                natureza={prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO"}
                valor={q?.fec ?? null}
                formato="num"
                casas={2}
                unidade={tx("interrupções", "interruptions")}
                periodo={q?.ano ? String(q.ano) : undefined}
                motivoAusencia={
                  q?.ano
                    ? tx("FEC sem dado no ano de referência.", "FEC without data in the reference year.")
                    : tx(
                        "Sem indicadores de continuidade publicados para esta distribuidora no ano de referência.",
                        "No continuity indicators published for this distribution utility in the reference year.",
                      )
                }
                nota={q ? notaLimite(q.fec, q.fec_limite, "") : undefined}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Tarifa residencial B1 vigente", "B1 residential tariff in force")}
                natureza={prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO"}
                valor={t && t.vigente ? t.total : null}
                formato="reais"
                casas={2}
                unidade="R$/MWh"
                periodo={t && t.vigente ? tx(`de ${dataTexto(t.inicio)} a ${dataTexto(t.fim)}`, `from ${dataTexto(t.inicio)} to ${dataTexto(t.fim)}`) : undefined}
                motivoAusencia={
                  t && !t.vigente
                    ? tx(
                        `Distribuidora sem tarifa vigente na data do arquivo de tarifas: ${t.motivo ?? "motivo não publicado"}.`,
                        `Distribution utility without a tariff in force on the date of the tariff file: ${t.motivo ? motivoTarifa(t.motivo) : "reason not published"}.`,
                      )
                    : tx("A distribuidora não aparece nas tarifas de aplicação.", "The distribution utility does not appear in the applied tariffs.")
                }
                nota={
                  t && t.vigente
                    ? tx(
                        `Sem tributos nem bandeira; ${(t.ato ?? "ato sem número").replace(/^REH\b/, "Resolução Homologatória")}.`,
                        `Before taxes and tariff flag; ${(atoNoIdioma(t.ato) ?? "act without number").replace(/^REH\b/, `${SIGLAS_IDIOMAS.en.REH} (REH)`)}.`,
                      )
                    : undefined
                }
              />
            </FaixaMetricas>
          }
        >
          {siglasDiferentes
            ? tx<ReactNode>(
                // i18n: dado (chave de dado ou forma portuguesa do tx)
                `Siglas publicadas pelas fontes: ${d.siglas.map((s) => `${s.sigla} (${{ tarifas: "tarifas", continuidade: "continuidade", samp: "SAMP", cadastro_agentes: "cadastro de agentes" }[s.fonte]})`).join("; ")}.`,
                <>
                  Acronyms published by the sources:{" "}
                  {d.siglas.map((s, i) => (
                    <span key={`${s.fonte}-${s.sigla}`}>
                      {i ? "; " : ""}
                      <Nome>{s.sigla}</Nome> ({fonteSigla(s.fonte)})
                    </span>
                  ))}
                  .
                </>,
              )
            : null}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="perfil">
            <PainelEvidencia
              id="ficha"
              pergunta={tx(`Como a ${d.sigla} atende sua área?`, `How does ${d.sigla} serve its area?`)}
              nomesNaPergunta={[d.sigla]}
              subtitulo={tx(
                "Perdas, continuidade e tarifa residencial pelo mesmo CNPJ dos módulos de origem · %, horas, interrupções, R$/MWh",
                "Losses, continuity and residential tariff by the same CNPJ in the source modules · %, hours, interruptions, R$/MWh",
              )}
              porQueImporta={tx(
                <>
                  As <Termo slug="perdas-de-energia">perdas</Termo>, o <Termo slug="dec">DEC</Termo> e o <Termo slug="fec">FEC</Termo> e a <Termo slug="tarifa-te-tusd">tarifa</Termo> dizem
                  quanto da energia se perde na rede da {d.sigla}, quanto tempo e quantas vezes falta luz para os seus consumidores e quanto eles pagam por MWh. A ficha junta as três bases da ANEEL pela
                  mesma identidade.
                </>,
                <>
                  The <Termo slug="perdas-de-energia">losses</Termo>, <Termo slug="dec">DEC</Termo>, <Termo slug="fec">FEC</Termo> and the <Termo slug="tarifa-te-tusd">tariff</Termo> tell how
                  much energy is lost in <Nome>{d.sigla}</Nome>&apos;s grid, how long and how often its consumers go without power and how much they pay per MWh. The profile brings ANEEL&apos;s three
                  databases together under the same identity.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.distribuidoras}
              complementares={[
                ...(prov.distribuidoras_perdas ? [{ rotulo: tx("Perdas totais (base publicada de Perdas)", "Total losses (Losses published database)"), p: prov.distribuidoras_perdas }] : []),
                ...(prov.distribuidoras_qualidade
                  ? [{ rotulo: tx("DEC e FEC (base publicada de Qualidade)", "DEC and FEC (Quality of supply published database)"), p: prov.distribuidoras_qualidade }]
                  : []),
                ...(prov.distribuidoras_tarifa ? [{ rotulo: tx("Tarifa B1 (base publicada de Conta de luz)", "B1 tariff (Electricity bill published database)"), p: prov.distribuidoras_tarifa }] : []),
              ]}
            >
              <div className="space-y-6">
                <RespostaCurta id="ficha" veredito={comNomes(vereditoFicha(d, nacionalDoAno), [d.sigla])}>
                  {comNomes(respostaFicha(d), [d.sigla, d.nome])}
                </RespostaCurta>
                {p && p.taxa_total_pct !== null && p.taxa_total_pct < 0 && (
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-perda-negativa="">
                    {tx(
                      <>
                        Valor negativo quer dizer que a medida publicada pelo SAMP é negativa. O observatório mostra o valor como a fonte o entrega, sem corrigi-lo.
                        {alertas.length ? ` O módulo Perdas marca a ${d.sigla} em ${p.ano} com os alertas: ${alertas.join("; ")}.` : ""}
                      </>,
                      <>
                        A negative value means that the measure published by SAMP is negative. The observatory shows the value as the source delivers it, without correcting it.
                        {alertas.length ? (
                          <>
                            {" "}
                            The Losses module flags <Nome>{d.sigla}</Nome> in {p.ano} with the alerts: {alertas.join("; ")}.
                          </>
                        ) : (
                          ""
                        )}
                      </>,
                    )}
                  </p>
                )}

                {evol.perdas.length > 0 && (
                  <SecaoDoPainel
                    id="perdas"
                    titulo={tx<ReactNode>(
                      `Como as perdas da ${d.sigla} evoluíram?`,
                      <>
                        How have <Nome>{d.sigla}</Nome>&apos;s losses evolved?
                      </>,
                    )}
                  >
                    <GraficoLinhas
                      titulo={tx(`Perdas totais da ${d.sigla} por ano (% da energia injetada)`, `${d.sigla} total losses by year (% of injected energy)`)}
                      nomesNoTitulo={[d.sigla]}
                      dados={perdasSerie}
                      // i18n: dado (chave de dado ou forma portuguesa do tx)
                      chaveX="ano"
                      formatoX="texto"
                      series={[
                        { id: "taxa_completo", rotulo: tx(`${d.sigla}, ano completo`, "Complete year"), sigla: tx(d.sigla, "Complete"), cor: "var(--serie-comp-1)" },
                        ...(perdasSerie.some((x) => x.taxa_parcial !== null)
                          ? [
                              {
                                id: "taxa_parcial",
                                rotulo: tx("Ano incompleto (fora da comparação)", "Incomplete year (out of the comparison)"),
                                sigla: tx("Incompleto", "Incomplete"),
                                cor: "var(--serie-referencia)",
                                tracejada: true,
                              },
                            ]
                          : []),
                        ...(perdasSerie.some((x) => x.brasil !== null)
                          ? [{ id: "brasil", rotulo: tx("Concessionárias do Brasil", "Brazil's concession holders"), sigla: tx("Brasil", "Brazil"), cor: "var(--serie-referencia)" }]
                          : []),
                      ]}
                      unidade="%"
                      casas={2}
                      zeroNoEixo
                      legendaInterativa
                      altura={280}
                    />
                    {textoAnosNegativos(evol.perdas) && (
                      <p className="max-w-prose2 text-sm text-carvao-muted" data-anos-negativos="">
                        {textoAnosNegativos(evol.perdas)}
                      </p>
                    )}
                    <EmpresasComoLer partes={["perdas"]} />
                  </SecaoDoPainel>
                )}

                <EmpresasRecorte
                  periodo={tx(
                    <>
                      Perdas de {p?.ano ?? "sem dado"}; continuidade de {q?.ano ?? "sem dado"}; tarifa {t && t.vigente ? `vigente de ${dataTexto(t.inicio)} a ${dataTexto(t.fim)}` : "sem vigência na data do arquivo"}
                    </>,
                    <>
                      Losses for {p?.ano ?? semDado}; continuity for {q?.ano ?? semDado}; tariff {vigencia ?? "not in force on the file date"}
                    </>,
                  )}
                  universo={tx(
                    <>
                      Uma distribuidora (CNPJ {cnpjFormatado(d.cnpj)}){d.ufs.length ? `, área em ${d.ufs.join(", ")}` : ""}
                    </>,
                    <>
                      One distribution utility (CNPJ {cnpjFormatado(d.cnpj)}){d.ufs.length ? `, area in ${d.ufs.join(", ")}` : ""}
                    </>,
                  )}
                  unidade={tx(
                    "% da energia injetada; horas e interrupções por unidade consumidora; R$/MWh sem tributos",
                    "% of injected energy; hours and interruptions per consumer unit; R$/MWh before taxes",
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                {evol.qualidade.length > 0 && (
                  <SecaoDoPainel id="continuidade" titulo={tx("E a continuidade do serviço, diante do limite?", "And service continuity, against the limit?")}>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <GraficoLinhas
                        titulo={tx(`DEC da ${d.sigla} e o limite, por ano (horas)`, `${d.sigla} DEC and the limit, by year (hours)`)}
                        nomesNoTitulo={[d.sigla]}
                        dados={evol.qualidade}
                        // i18n: dado (chave de dado ou forma portuguesa do tx)
                        chaveX="ano"
                        formatoX="texto"
                        series={[
                          { id: "dec", rotulo: tx("DEC apurado", "Measured DEC"), sigla: "DEC", cor: "var(--serie-comp-1)" },
                          { id: "dec_limite", rotulo: tx("Limite", "Limit"), sigla: tx("Limite", "Limit"), cor: "var(--serie-referencia)", tracejada: true },
                        ]}
                        unidade="h"
                        casas={2}
                        zeroNoEixo
                        altura={260}
                      />
                      <GraficoLinhas
                        titulo={tx(`FEC da ${d.sigla} e o limite, por ano (interrupções)`, `${d.sigla} FEC and the limit, by year (interruptions)`)}
                        nomesNoTitulo={[d.sigla]}
                        dados={evol.qualidade}
                        // i18n: dado (chave de dado ou forma portuguesa do tx)
                        chaveX="ano"
                        formatoX="texto"
                        series={[
                          { id: "fec", rotulo: tx("FEC apurado", "Measured FEC"), sigla: "FEC", cor: "var(--serie-comp-2)" },
                          { id: "fec_limite", rotulo: tx("Limite", "Limit"), sigla: tx("Limite", "Limit"), cor: "var(--serie-referencia)", tracejada: true },
                        ]}
                        unidade={tx("interrupções", "interruptions")}
                        casas={2}
                        zeroNoEixo
                        altura={260}
                      />
                    </div>
                    <EmpresasComoLer partes={["continuidade"]} />
                  </SecaoDoPainel>
                )}
                {evol.tarifa.length > 0 && (
                  <SecaoDoPainel id="tarifa" titulo={tx("E a tarifa residencial, em cada vigência?", "And the residential tariff, in each validity period?")}>
                    <GraficoLinhas
                      titulo={tx(
                        `Tarifa B1 da ${d.sigla} por início de vigência (R$/MWh nominais, sem tributos)`,
                        `${d.sigla} B1 tariff by start of validity (nominal R$/MWh, before taxes)`,
                      )}
                      nomesNoTitulo={[d.sigla]}
                      dados={evol.tarifa}
                      chaveX="inicio"
                      formatoX="data"
                      series={[
                        { id: "total", rotulo: "Total (TE + TUSD)", sigla: "Total", cor: "var(--serie-comp-1)" }, // i18n: dado (igual nas duas línguas)
                        { id: "tusd", rotulo: "TUSD", sigla: "TUSD", cor: "var(--serie-comp-2)" },
                        { id: "te", rotulo: "TE", sigla: "TE", cor: "var(--serie-comp-3)" },
                      ]}
                      unidade="R$/MWh"
                      casas={2}
                      zeroNoEixo
                      zoom
                      legendaInterativa
                      altura={280}
                    />
                    <EmpresasComoLer partes={["tarifa"]} />
                  </SecaoDoPainel>
                )}
                {!evol.perdas.length && !evol.qualidade.length && !evol.tarifa.length && (
                  <EmpresasAviso rotulo={tx("Sem evolução própria", "No own evolution")}>
                    <p>
                      {tx(
                        "Nenhuma das bases publicadas de origem publica série histórica para este CNPJ nesta publicação.",
                        "None of the source published databases publishes a historical series for this CNPJ in this release.",
                      )}
                    </p>
                  </EmpresasAviso>
                )}
                {/* a leitura de cada medida fica ao lado da sua figura; a de uma medida sem série própria vem aqui, porque o número dela está na faixa */}
                {semSerie.length > 0 && <EmpresasComoLer partes={semSerie} />}

                <SecaoDoPainel id="pares" titulo={tx("Como ela se compara com as pares?", "How does it compare with its peers?")}>
                  <ul className="space-y-1 text-sm text-carvao">
                    <li>{comNomes(textoPares(d.sigla, tx("taxa de perdas", "loss rate"), pp, d.slug), [d.sigla])}</li>
                    <li>{comNomes(textoPares(d.sigla, "DEC", pq, d.slug), [d.sigla])}</li>
                  </ul>
                  {d.grupo === "permissionaria" && (
                    <p className="max-w-prose2 text-sm text-carvao-muted" data-grupo-permissionaria="">
                      {tx(
                        "Permissionária é a classificação que a ANEEL dá a esta distribuidora, diferente da de concessionária. Os pares são só as distribuidoras do mesmo grupo.",
                        "Permit holder is the classification ANEEL gives this distribution utility, different from concession holder. The peers are only the distribution utilities in the same group.",
                      )}
                    </p>
                  )}
                  {textoNegativos(pp) && (
                    <p className="max-w-prose2 text-sm text-carvao-muted" data-pares-negativos="">
                      {comNomes(textoNegativos(pp), pp?.itens.map((x) => x.rotulo) ?? [])}
                    </p>
                  )}
                  <EmpresasFichaPares slug={d.slug} sigla={d.sigla} perdas={pp} qualidade={pq} />
                </SecaoDoPainel>

                <SecaoDoPainel
                  id="controle"
                  titulo={tx<ReactNode>(
                    `Quem controla a ${d.sigla}?`,
                    <>
                      Who controls <Nome>{d.sigla}</Nome>?
                    </>,
                  )}
                >
                  <p className="text-sm text-carvao">
                    {tx(
                      <>
                        {d.controle.topo
                          ? `O topo da cadeia de controladores únicos declarada à ANEEL é ${nomeOuCnpj(d.controle.topo_nome, d.controle.topo)}; motivo da parada: ${motivoExplicado(d.controle.motivo_parada, motivos)}.`
                          : `A própria ${d.sigla} é o topo da cadeia declarada: ${motivoExplicado(d.controle.motivo_parada, motivos)}.`}
                        {d.controle.acima ? ` Acima, sem CNPJ: ${d.controle.acima}.` : ""}
                      </>,
                      <>
                        {d.controle.topo ? (
                          <>
                            The top of the chain of single controlling shareholders declared to ANEEL is{" "}
                            {d.controle.topo_nome ? <Nome>{d.controle.topo_nome}</Nome> : nomeOuCnpj(d.controle.topo_nome, d.controle.topo)}; where the chain stops:{" "}
                            {motivoExplicado(d.controle.motivo_parada, motivos)}.
                          </>
                        ) : (
                          <>
                            <Nome>{d.sigla}</Nome> itself is the top of the declared chain: {motivoExplicado(d.controle.motivo_parada, motivos)}.
                          </>
                        )}
                        {d.controle.acima ? (
                          <>
                            {" "}
                            Above, without CNPJ: <Nome>{d.controle.acima}</Nome>.
                          </>
                        ) : (
                          ""
                        )}
                      </>,
                    )}
                  </p>
                  {arvore ? (
                    <EmpresasArvore a={arvore} href={(c) => `${rotaPainel("p039")}?ctl.e=${c}#p039`} motivos={motivos} resumo={false} />
                  ) : (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        "O CNPJ não aparece na composição societária declarada na janela vigente nem como sócio de outro declarante.",
                        "The CNPJ does not appear in the shareholding structure declared in the current window, nor as a shareholder of another declaring agent.",
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="cvm" titulo={tx("O que ela reporta à CVM?", "What does it report to the CVM?")}>
                  {companhia ? (
                    <>
                      <p className="text-sm text-carvao">{comNomes(textoCompanhia(companhia, g.financas.contas), [companhia.nome, companhia.controladora_aberta?.nome])}</p>
                      <p className="max-w-prose2 text-xs text-carvao-muted">
                        {tx(
                          <>
                            CVM é a {SIGLAS.CVM}; os valores vêm das {SIGLAS.DFP} (DFP, anuais) e das {SIGLAS.ITR} (ITR, trimestrais).
                          </>,
                          <>
                            CVM is the {SIGLAS_IDIOMAS.en.CVM}; the values come from the {SIGLAS_IDIOMAS.en.DFP} (DFP, annual) and the {SIGLAS_IDIOMAS.en.ITR} (ITR, quarterly).
                          </>,
                        )}
                      </p>
                      <div className="max-w-sm">
                        <Numero
                          variante="faixa"
                          rotulo={tx(
                            `Receita ${companhia.ultimo_exercicio ?? ""} (${rotuloEscopo(companhia.escopo_exibido)})`,
                            `Revenue ${companhia.ultimo_exercicio ?? ""} (${rotuloEscopo(companhia.escopo_exibido)})`,
                          )}
                          natureza={companhia.alertas.includes("escala_corrigida") ? "ESTIMADO" : "OBSERVADO"}
                          valor={emMilhoes(evReceita?.valor_calculo ?? null)}
                          casas={1}
                          unidade={milhoes}
                          evidencia={evReceita}
                          motivoAusencia={tx(
                            "A receita do último exercício não tem valor publicado ou ficha Comprove.",
                            "Revenue for the latest fiscal year has no published value or proof sheet.",
                          )}
                          endereco={`${rotaEntidade(d.slug)}#ficha`}
                        />
                      </div>
                      {linhasFin.length > 0 ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                          <GraficoLinhas
                            titulo={tx(`Receita, resultado e lucro, ${rotuloEscopo(escopo)} (R$ milhões)`, `Revenue, earnings and income, ${rotuloEscopo(escopo)} (R$ million)`)}
                            dados={linhasFin}
                            chaveX="x"
                            formatoX="texto"
                            series={[
                              { id: "receita", rotulo: tx("Receita", "Revenue"), cor: "var(--serie-comp-1)" },
                              {
                                id: "ebit",
                                rotulo: tx("Resultado antes do financeiro e dos tributos", "Earnings before financial result and taxes (EBIT)"),
                                sigla: tx("Resultado", "EBIT"),
                                cor: "var(--serie-comp-2)",
                              },
                              { id: "lucro_liquido", rotulo: tx("Lucro líquido", "Net income"), sigla: tx("Lucro", "Net income"), cor: "var(--serie-comp-3)" },
                            ]}
                            unidade={milhoes}
                            casas={1}
                            legendaInterativa
                            altura={260}
                          />
                          <GraficoLinhas
                            titulo={tx(
                              `Ativo, dívida bruta e patrimônio no fim do exercício, ${rotuloEscopo(escopo)} (R$ milhões)`,
                              `Assets, gross debt and equity at the end of the fiscal year, ${rotuloEscopo(escopo)} (R$ million)`,
                            )}
                            dados={linhasFin}
                            chaveX="x"
                            formatoX="texto"
                            series={[
                              { id: "ativo_total", rotulo: tx("Ativo total", "Total assets"), sigla: tx("Ativo", "Assets"), cor: "var(--serie-comp-1)" },
                              { id: "divida_bruta", rotulo: tx("Dívida bruta", "Gross debt"), sigla: tx("Dívida", "Debt"), cor: "var(--serie-comp-2)" },
                              { id: "patrimonio_liquido", rotulo: tx("Patrimônio líquido", "Shareholders' equity"), sigla: tx("PL", "Equity"), cor: "var(--serie-comp-3)" },
                            ]}
                            unidade={milhoes}
                            casas={1}
                            legendaInterativa
                            altura={260}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-carvao-muted">
                          {tx(`Sem série anual no escopo ${rotuloEscopo(escopo)} para esta companhia.`, `No annual series in the ${rotuloEscopo(escopo)} scope for this company.`)}
                        </p>
                      )}
                      {fin?.[companhia.cnpj]?.escala_corrigida?.length ? (
                        <p className="text-xs text-carvao-muted">
                          {tx("Escala convertida pelo observatório (natureza estimada):", "Scale converted by the observatory (estimated nature):")}{" "}
                          {datasLegiveis(escalaCorrigida(fin[companhia.cnpj].escala_corrigida!.join("; ")))}.
                        </p>
                      ) : null}
                      <p className="text-sm">
                        <Link href={cvmLink(companhia.cnpj)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                          {tx("Comparar com outras companhias e ver as informações trimestrais", "Compare with other companies and see the quarterly information")}
                        </Link>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-carvao">
                      {tx(
                        <>
                          A {d.sigla} não é companhia aberta registrada no setor elétrico da CVM ({SIGLAS.CVM}): não publica DFP ({SIGLAS.DFP}) nem ITR ({SIGLAS.ITR}) padronizados.
                        </>,
                        <>
                          <Nome>{d.sigla}</Nome> is not a publicly held company registered in the CVM&apos;s ({SIGLAS_IDIOMAS.en.CVM}) electric power sector: it does not publish standardized DFP (
                          {SIGLAS_IDIOMAS.en.DFP}) or ITR ({SIGLAS_IDIOMAS.en.ITR}).
                        </>,
                      )}
                      {abertaAcima ? (
                        <>
                          {" "}
                          {tx("A primeira companhia aberta na cadeia de controle declarada é", "The first publicly held company in the declared control chain is")}{" "}
                          <Link href={cvmLink(abertaAcima.cnpj)} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                            {abertaAcima.nome ? <Nome>{nomeOuCnpj(abertaAcima.nome, abertaAcima.cnpj)}</Nome> : nomeOuCnpj(abertaAcima.nome, abertaAcima.cnpj)}
                          </Link>
                          {tx(
                            ", cujas demonstrações consolidadas incluem esta distribuidora (e não se somam a ela).",
                            ", whose consolidated statements include this distribution utility (and are not added to it).",
                          )}
                        </>
                      ) : (
                        tx(" Nenhuma companhia aberta ativa aparece na cadeia de controle declarada.", " No active publicly held company appears in the declared control chain.")
                      )}
                    </p>
                  )}
                  {d.geracao && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          Também tem participação em {inteiro(d.geracao.usinas)} usinas do SIGA ({SIGLAS.SIGA}), com {mwTexto(d.geracao.mw_proporcional, 2)} de capacidade proporcional.
                        </>,
                        <>
                          It also holds stakes in {inteiro(d.geracao.usinas)} SIGA ({SIGLAS_IDIOMAS.en.SIGA}) plants, with {mwTexto(d.geracao.mw_proporcional, 2)} of proportional capacity.
                        </>,
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                {origens.length > 0 && (
                  <div className="border-t border-linha pt-4" data-origens="true">
                    <p className="rotulo text-mineral">
                      {tx(
                        <>Ver nos módulos de origem, com a {d.sigla} já escolhida</>,
                        <>
                          See in the source modules, with <Nome>{d.sigla}</Nome> already chosen
                        </>,
                      )}
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-x-5 text-sm">
                      {origens.map((o) => (
                        <li key={o.href}>
                          <Link href={o.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                            {o.rotulo}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <SecaoDoPainel id="tabelas" titulo={tx("Tabelas da evolução própria (as mesmas linhas dos gráficos)", "Tables of the own evolution (the same rows as the charts)")} nivel="analisar">
                  {perdasSerie.length > 0 && (
                    <TabelaInterativa
                      titulo={tx(`Perdas da ${d.sigla} por ano`, `${d.sigla} losses by year`)}
                      nomesNoTitulo={[d.sigla]}
                      colunas={COLUNAS_EVOLUCAO_PERDAS}
                      linhas={perdasSerie.map((x) => ({ ...x, id: x.ano }))}
                      chaveLinha="id"
                      // i18n: dado (chave de dado ou forma portuguesa do tx)
                      colunaRotulo="ano"
                      fonte={tx("ANEEL, SAMP (base publicada de Perdas)", "ANEEL, SAMP (Losses published database)")}
                      versao={g.distribuidoras.golds_origem["perdas.json"].gerado_em?.slice(0, 10) ?? ""}
                      nomeArquivo={`empresas-${d.slug}-perdas`}
                      // i18n: dado (chave de dado ou forma portuguesa do tx)
                      ordemInicial={{ coluna: "ano", direcao: "desc" }}
                    />
                  )}
                  {evol.qualidade.length > 0 && (
                    <TabelaInterativa
                      titulo={tx(`DEC e FEC da ${d.sigla} por ano`, `${d.sigla} DEC and FEC by year`)}
                      nomesNoTitulo={[d.sigla]}
                      colunas={COLUNAS_EVOLUCAO_QUALIDADE}
                      linhas={evol.qualidade.map((x) => ({ ...x, id: x.ano }))}
                      chaveLinha="id"
                      // i18n: dado (chave de dado ou forma portuguesa do tx)
                      colunaRotulo="ano"
                      fonte={tx("ANEEL, indicadores de continuidade (base publicada de Qualidade)", "ANEEL, continuity indicators (Quality of supply published database)")}
                      versao={g.distribuidoras.golds_origem["qualidade.json"].gerado_em?.slice(0, 10) ?? ""}
                      nomeArquivo={`empresas-${d.slug}-continuidade`}
                      // i18n: dado (chave de dado ou forma portuguesa do tx)
                      ordemInicial={{ coluna: "ano", direcao: "desc" }}
                    />
                  )}
                  {evol.tarifa.length > 0 && (
                    <TabelaInterativa
                      titulo={tx(`Vigências da tarifa B1 da ${d.sigla}`, `${d.sigla} B1 tariff validity periods`)}
                      nomesNoTitulo={[d.sigla]}
                      colunas={COLUNAS_EVOLUCAO_TARIFA}
                      linhas={evol.tarifa.map((x) => ({ ...x, ato: atoNoIdioma(x.ato) ?? x.ato, id: `${x.inicio}|${x.ato}` }))}
                      chaveLinha="id"
                      colunaRotulo="inicio"
                      fonte={tx("ANEEL, tarifas de aplicação (base publicada de Conta de luz)", "ANEEL, applied tariffs (Electricity bill published database)")}
                      versao={g.distribuidoras.golds_origem["conta.json"].gerado_em?.slice(0, 10) ?? ""}
                      nomeArquivo={`empresas-${d.slug}-tarifa-b1`}
                      ordemInicial={{ coluna: "inicio", direcao: "desc" }}
                    />
                  )}
                  {linhasFin.length > 0 && (
                    <TabelaInterativa
                      titulo={tx(`Demonstrações anuais na CVM, ${rotuloEscopo(escopo)}`, `Annual statements at the CVM, ${rotuloEscopo(escopo)}`)}
                      colunas={colunasFin()}
                      linhas={linhasFin}
                      chaveLinha="id"
                      colunaRotulo="x"
                      fonte="CVM, DFP"
                      versao={String(companhia?.ultimo_exercicio ?? "")}
                      nomeArquivo={`empresas-${d.slug}-dfp-${escopo}`}
                      ordemInicial={{ coluna: "x", direcao: "desc" }}
                    />
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="identidade" titulo={tx("Identidade e origem de cada número", "Identity and origin of each number")} nivel="auditar">
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Identidade: CNPJ {cnpjFormatado(d.cnpj)}; slug estável {d.slug}
                        {d.slugs_alternativos.length ? ` (também por ${d.slugs_alternativos.join(", ")})` : ""}. Classificação {d.classificacao ?? "sem registro"}
                        {d.conflito_classificacao ? ", com conflito entre o SAMP e a continuidade" : ""}. {g.distribuidoras.regra_universo}
                      </>,
                      <>
                        Identity: CNPJ {cnpjFormatado(d.cnpj)}; stable slug <code>{d.slug}</code>
                        {d.slugs_alternativos.length ? (
                          <>
                            {" "}
                            (also by{" "}
                            {d.slugs_alternativos.map((x, i) => (
                              <span key={x}>
                                {i ? ", " : ""}
                                <code>{x}</code>
                              </span>
                            ))}
                            )
                          </>
                        ) : (
                          ""
                        )}
                        . Classification {classificacao ?? "not recorded"}
                        {d.conflito_classificacao ? ", with a conflict between SAMP and continuity" : ""}. {comNomes(traduzir(DEFINICAO_EMPRESAS_EN, g.distribuidoras.regra_universo), NOMES_FONTES)}
                      </>,
                    )}
                  </p>
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {evol.arquivos.map((a) => (
                      <li key={a.url}>
                        {tx("Série de", "Series of")}{" "}
                        {{ perdas: tx("perdas", "losses"), qualidade: tx("continuidade", "continuity"), tarifa: tx("tarifa", "tariff") }[a.modulo]}:{" "}
                        <a href={a.url} className="underline underline-offset-4 hover:text-carvao">
                          {a.url.split("/").pop()}
                        </a>
                        {a.disponivel ? "" : tx(" (arquivo ausente nesta publicação)", " (file missing in this release)")}
                      </li>
                    ))}
                  </ul>
                  {companhia && (
                    <p className="text-sm text-carvao-muted">
                      {tx(
                        <>
                          CVM: código {companhia.cd_cvm ?? "sem registro"}, situação {companhia.situacao ?? "sem registro"}, setor {companhia.setor ?? "sem registro"}; {inteiro(companhia.valores_reapresentados)}{" "}
                          valores reapresentados no comparativo do ano seguinte.
                        </>,
                        <>
                          CVM: code {companhia.cd_cvm ?? "not recorded"}, status {companhia.situacao ? rotuloSituacaoCvm(companhia.situacao) : "not recorded"}, sector{" "}
                          {companhia.setor ? rotuloSetorCvm(companhia.setor) : "not recorded"}; {inteiro(companhia.valores_reapresentados)} values restated in the following year&apos;s comparative.
                        </>,
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                <EmpresasSeguir
                  ancora="ficha"
                  proximo={{
                    href: `${rotaPainel("p037")}?dist.cmp=${d.slug}#p037`,
                    pergunta: tx(`Como a ${d.sigla} se compara com outras distribuidoras?`, `How does ${d.sigla} compare with other distribution utilities?`),
                    nomes: [d.sigla],
                  }}
                  downloads={[
                    ...downloadsDe(g.downloads, ["/energia/series/empresas_distribuidoras.csv"]),
                    ...(companhia ? downloadsDe(g.downloads, ["/energia/series/empresas_financas_anual.csv", "/energia/series/empresas_financas_trimestral.csv"]) : []),
                  ]}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
