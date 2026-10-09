import type { Metadata } from "next";
import Link from "next/link";
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
import { SIGLAS } from "@/lib/energia/siglas";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export const dynamicParams = false;

/** Uma página por distribuidora do índice (slug principal) e uma rota de apoio por slug alternativo, que redireciona ao principal. */
export function generateStaticParams() {
  const g = lerGold<EmpresasGold>("empresas.json");
  return integra(g) ? slugsEstaticos(g.distribuidoras.indice).map((entidade) => ({ entidade })) : [];
}

export function generateMetadata({ params }: { params: { entidade: string } }): Metadata {
  const g = lerGold<EmpresasGold>("empresas.json");
  const r = integra(g) ? resolverEntidade(g.distribuidoras.indice, params.entidade) : null;
  if (!r) return {};
  const d = r.dist;
  return {
    title: `${d.sigla}: perdas, continuidade, tarifa, controle e finanças da distribuidora`,
    description: `Perfil da ${d.sigla} (${d.nome ?? "razão social sem registro"}, CNPJ ${cnpjFormatado(d.cnpj)}): perdas, DEC e FEC diante do limite, tarifa residencial, evolução própria, pares, cadeia de controle e demonstrações na CVM quando é companhia aberta.`,
    alternates: { canonical: rotaEntidade(d.slug) },
  };
}

const COLUNAS_FIN: ColunaTabela[] = [
  { id: "x", rotulo: "Exercício", tipo: "texto" },
  { id: "receita", rotulo: "Receita", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "ebit", rotulo: "Resultado antes do financeiro e dos tributos", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "lucro_liquido", rotulo: "Lucro líquido", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "ativo_total", rotulo: "Ativo total", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "divida_bruta", rotulo: "Dívida bruta", tipo: "numero", unidade: "R$ milhões", casas: 1 },
  { id: "patrimonio_liquido", rotulo: "Patrimônio líquido", tipo: "numero", unidade: "R$ milhões", casas: 1 },
];
const CONTAS_FICHA = ["receita", "ebit", "lucro_liquido", "ativo_total", "divida_bruta", "patrimonio_liquido"] as const;

/** Frase do limite que a ANEEL fixa para a própria distribuidora: o valor, a diferença e o sentido dela em palavras. */
function notaLimite(valor: number | null | undefined, limite: number | null | undefined, sufixo: string): string {
  if (!temValor(limite)) return "Limite sem dado nesta publicação.";
  const base = `Limite da ANEEL para ela: ${numTexto(limite, 2)}${sufixo}.`;
  const s = sentidoLimite(valor, limite);
  if (!temValor(valor) || !s) return base;
  const sentido = s === "igual" ? "igual ao limite" : s === "abaixo" ? "abaixo do limite" : "acima do limite";
  return `${base} Diferença: ${sinal(valor - limite, 2, sufixo)}, ${sentido}.`;
}

export default function FichaDistribuidora({ params }: { params: { entidade: string } }) {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="empresas" />
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
          <Indisponivel
            titulo="Ficha da distribuidora indisponível nesta publicação"
            motivo={(g as { motivo?: string } | null)?.motivo ?? "Os dados do módulo Empresas não foram gerados ou não passaram na validação desta publicação, e nenhum número de reserva é exibido."}
          />
        </main>
      </>
    );
  }
  const r = resolverEntidade(g.distribuidoras.indice, params.entidade);
  if (!r) notFound();
  // slug alternativo (outra sigla publicada pelas fontes): rota de apoio que leva à ficha principal
  if (!r.principal) permanentRedirect(rotaEntidade(r.dist.slug));

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
  const janela = `${trimestreTexto(g.datas.polimero_janela[0])} a ${trimestreTexto(g.datas.polimero_janela.at(-1))}`;
  const semSerie: ParteComoLer[] = [];
  if (!evol.perdas.length) semSerie.push("perdas");
  if (!evol.qualidade.length) semSerie.push("continuidade");
  if (!evol.tarifa.length) semSerie.push("tarifa");

  const oQueMudou = (
    <>
      Evolução própria: perdas de {evol.perdas[0]?.ano ?? "sem dado"} a {evol.perdas.at(-1)?.ano ?? "sem dado"}, continuidade de {evol.qualidade[0]?.ano ?? "sem dado"} a{" "}
      {evol.qualidade.at(-1)?.ano ?? "sem dado"}, {inteiro(evol.tarifa.length)} vigências tarifárias.
      {evol.quebrasQualidade.length ? ` O perímetro da continuidade mudou em ${evol.quebrasQualidade.join(", ")}.` : ""}
    </>
  );
  const comoInterpretar = (
    <>
      {semNomesDeCampo(g.distribuidoras.pares)} Ano incompleto de perdas aparece tracejado e fora da comparação; o limite de DEC e FEC é o fixado pela ANEEL para a própria distribuidora. A referência do Brasil
      é a taxa das concessionárias em conjunto (perdas somadas sobre energia injetada somada), não a média simples das taxas.
    </>
  );
  const naoConcluir = (
    <>
      Não se conclui eficiência nem culpa: perdas, interrupções e tarifa dependem da área atendida. A tarifa B1 sem tributos não é a conta inteira. As taxas da distribuidora não valem para cada
      município da área (não se replicam por município).
    </>
  );
  const cvmLink = (cnpj: string) => `${rotaPainel("p038")}?fin.sel=${cnpj}#p038`;

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-ficha" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="ficha" />
        <CabecalhoModulo
          rotulo="Perfil da distribuidora"
          siglas={["CNPJ", "ANEEL", "SAMP", "DEC", "FEC", "TE", "TUSD", "REH", "SIGA", "CVM", "DFP", "ITR"]}
          titulo={`${d.sigla}: perdas, continuidade e tarifa`}
          lead={
            <>
              {d.nome ?? "Razão social sem registro"} · CNPJ ({SIGLAS.CNPJ}) <span className="whitespace-nowrap">{cnpjFormatado(d.cnpj)}</span> · {d.classificacao ?? rotuloGrupo(d.grupo)} ·{" "}
              {d.ufs.length ? `área em ${d.ufs.join(", ")}` : "sem conjunto elétrico vigente (UF sem registro)"} · {d.ativa ? "ativa" : "inativa"}.
            </>
          }
          recorte={`Perdas de ${p?.ano ?? "sem dado"} · continuidade de ${q?.ano ?? "sem dado"} · tarifa ${t && t.vigente ? `vigente de ${dataTexto(t.inicio)} a ${dataTexto(t.fim)}` : "sem vigência na data do arquivo de tarifas"}`}
          fonte={`ANEEL (${SIGLAS.ANEEL}), bases de perdas, continuidade e tarifas, pelo mesmo CNPJ`}
          referencia={
            <>
              Perdas de {p?.ano ?? "sem dado"} (base publicada de Perdas), continuidade de {q?.ano ?? "sem dado"} (base publicada de Qualidade), tarifas da base publicada de Conta de luz; cadeia de controle
              declarada à ANEEL de {janela}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: "Perdas", texto: `${p?.ano ?? "sem dado"}, base publicada de Perdas`, natureza: prov.distribuidoras_perdas?.natureza ?? "CALCULADO" },
                { rotulo: "Continuidade", texto: `${q?.ano ?? "sem dado"}, base publicada de Qualidade`, natureza: prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO" },
                { rotulo: "Tarifa B1", texto: t && t.vigente ? `vigente de ${dataTexto(t.inicio)} a ${dataTexto(t.fim)}` : "sem vigência na data do arquivo", natureza: prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO" },
                { rotulo: "Cadeia de controle", texto: `declarações de ${janela}`, natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo={`Indicadores da ${d.sigla}`} nota="Medidas do último ano de cada base, fixas: não mudam com a distribuidora escolhida nos pares. Só as perdas têm ficha de prova; DEC, FEC e tarifa vêm das bases de Qualidade e de Conta de luz, sem ficha por distribuidora.">
              {evPerdas ? (
                <Numero
                  variante="faixa"
                  rotulo="Perdas totais"
                  natureza={prov.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                  evidencia={comValorExibido(evPerdas.evidencia, pctTexto(evPerdas.evidencia.valor_calculo, 2).replace("−", "-"))}
                  formato="pct"
                  casas={2}
                  unidade="da energia injetada"
                  nota={temValor(nacionalDoAno) ? `Taxa nacional das concessionárias no mesmo ano: ${pctTexto(nacionalDoAno, 2)}.` : undefined}
                  endereco={`${rotaEntidade(d.slug)}#ficha`}
                />
              ) : (
                <Numero
                  variante="faixa"
                  rotulo="Perdas totais"
                  natureza={prov.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                  valor={p?.taxa_total_pct ?? null}
                  formato="pct"
                  casas={2}
                  unidade="da energia injetada"
                  periodo={p?.ano ? String(p.ano) : undefined}
                  motivoAusencia={p ? `Sem taxa de perdas no ano de referência; último mês no SAMP: ${dataTexto(p.ultima_competencia)}.` : "A distribuidora não aparece no SAMP."}
                  nota={p && temValor(p.taxa_total_pct) ? "O módulo Perdas não publica a ficha Comprove deste CNPJ." : undefined}
                />
              )}
              <Numero
                variante="faixa"
                rotulo="Duração das interrupções (DEC)"
                natureza={prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO"}
                valor={q?.dec ?? null}
                formato="num"
                casas={2}
                unidade="h"
                periodo={q?.ano ? String(q.ano) : undefined}
                motivoAusencia={q?.ano ? "DEC sem dado no ano de referência." : "Sem indicadores de continuidade publicados para esta distribuidora no ano de referência."}
                nota={q ? notaLimite(q.dec, q.dec_limite, " h") : undefined}
              />
              <Numero
                variante="faixa"
                rotulo="Frequência das interrupções (FEC)"
                natureza={prov.distribuidoras_qualidade?.natureza ?? "OBSERVADO"}
                valor={q?.fec ?? null}
                formato="num"
                casas={2}
                unidade="interrupções"
                periodo={q?.ano ? String(q.ano) : undefined}
                motivoAusencia={q?.ano ? "FEC sem dado no ano de referência." : "Sem indicadores de continuidade publicados para esta distribuidora no ano de referência."}
                nota={q ? notaLimite(q.fec, q.fec_limite, "") : undefined}
              />
              <Numero
                variante="faixa"
                rotulo="Tarifa residencial B1 vigente"
                natureza={prov.distribuidoras_tarifa?.natureza ?? "OBSERVADO"}
                valor={t && t.vigente ? t.total : null}
                formato="reais"
                casas={2}
                unidade="R$/MWh"
                periodo={t && t.vigente ? `de ${dataTexto(t.inicio)} a ${dataTexto(t.fim)}` : undefined}
                motivoAusencia={
                  t && !t.vigente ? `Distribuidora sem tarifa vigente na data do arquivo de tarifas: ${t.motivo ?? "motivo não publicado"}.` : "A distribuidora não aparece nas tarifas de aplicação."
                }
                nota={t && t.vigente ? `Sem tributos nem bandeira; ${(t.ato ?? "ato sem número").replace(/^REH\b/, "Resolução Homologatória")}.` : undefined}
              />
            </FaixaMetricas>
          }
        >
          {siglasDiferentes ? `Siglas publicadas pelas fontes: ${d.siglas.map((s) => `${s.sigla} (${{ tarifas: "tarifas", continuidade: "continuidade", samp: "SAMP", cadastro_agentes: "cadastro de agentes" }[s.fonte]})`).join("; ")}.` : null}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="perfil">
            <PainelEvidencia
              id="ficha"
              pergunta={`Como a ${d.sigla} atende sua área?`}
              subtitulo="Perdas, continuidade e tarifa residencial pelo mesmo CNPJ dos módulos de origem · %, horas, interrupções, R$/MWh"
              porQueImporta={
                <>
                  As <Termo slug="perdas-de-energia">perdas</Termo>, o <Termo slug="dec">DEC</Termo> e o <Termo slug="fec">FEC</Termo> e a <Termo slug="tarifa-te-tusd">tarifa</Termo> dizem
                  quanto da energia se perde na rede da {d.sigla}, quanto tempo e quantas vezes falta luz para os seus consumidores e quanto eles pagam por MWh. A ficha junta as três bases da ANEEL pela
                  mesma identidade.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={prov.distribuidoras}
              complementares={[
                ...(prov.distribuidoras_perdas ? [{ rotulo: "Perdas totais (base publicada de Perdas)", p: prov.distribuidoras_perdas }] : []),
                ...(prov.distribuidoras_qualidade ? [{ rotulo: "DEC e FEC (base publicada de Qualidade)", p: prov.distribuidoras_qualidade }] : []),
                ...(prov.distribuidoras_tarifa ? [{ rotulo: "Tarifa B1 (base publicada de Conta de luz)", p: prov.distribuidoras_tarifa }] : []),
              ]}
            >
              <div className="space-y-6">
                <RespostaCurta id="ficha" veredito={vereditoFicha(d, nacionalDoAno)}>
                  {respostaFicha(d)}
                </RespostaCurta>
                {p && p.taxa_total_pct !== null && p.taxa_total_pct < 0 && (
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-perda-negativa="">
                    Valor negativo quer dizer que a medida publicada pelo SAMP é negativa. O observatório mostra o valor como a fonte o entrega, sem corrigi-lo.
                    {alertas.length ? ` O módulo Perdas marca a ${d.sigla} em ${p.ano} com os alertas: ${alertas.join("; ")}.` : ""}
                  </p>
                )}

                {evol.perdas.length > 0 && (
                  <SecaoDoPainel id="perdas" titulo={`Como as perdas da ${d.sigla} evoluíram?`}>
                    <GraficoLinhas
                      titulo={`Perdas totais da ${d.sigla} por ano (% da energia injetada)`}
                      dados={perdasSerie}
                      chaveX="ano"
                      formatoX="texto"
                      series={[
                        { id: "taxa_completo", rotulo: `${d.sigla}, ano completo`, sigla: d.sigla, cor: "var(--serie-comp-1)" },
                        ...(perdasSerie.some((x) => x.taxa_parcial !== null) ? [{ id: "taxa_parcial", rotulo: "Ano incompleto (fora da comparação)", sigla: "Incompleto", cor: "var(--serie-referencia)", tracejada: true }] : []),
                        ...(perdasSerie.some((x) => x.brasil !== null) ? [{ id: "brasil", rotulo: "Concessionárias do Brasil", sigla: "Brasil", cor: "var(--serie-referencia)" }] : []),
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
                  periodo={
                    <>
                      Perdas de {p?.ano ?? "sem dado"}; continuidade de {q?.ano ?? "sem dado"}; tarifa {t && t.vigente ? `vigente de ${dataTexto(t.inicio)} a ${dataTexto(t.fim)}` : "sem vigência na data do arquivo"}
                    </>
                  }
                  universo={
                    <>
                      Uma distribuidora (CNPJ {cnpjFormatado(d.cnpj)}){d.ufs.length ? `, área em ${d.ufs.join(", ")}` : ""}
                    </>
                  }
                  unidade="% da energia injetada; horas e interrupções por unidade consumidora; R$/MWh sem tributos"
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                {evol.qualidade.length > 0 && (
                  <SecaoDoPainel id="continuidade" titulo="E a continuidade do serviço, diante do limite?">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <GraficoLinhas
                        titulo={`DEC da ${d.sigla} e o limite, por ano (horas)`}
                        dados={evol.qualidade}
                        chaveX="ano"
                        formatoX="texto"
                        series={[
                          { id: "dec", rotulo: "DEC apurado", sigla: "DEC", cor: "var(--serie-comp-1)" },
                          { id: "dec_limite", rotulo: "Limite", sigla: "Limite", cor: "var(--serie-referencia)", tracejada: true },
                        ]}
                        unidade="h"
                        casas={2}
                        zeroNoEixo
                        altura={260}
                      />
                      <GraficoLinhas
                        titulo={`FEC da ${d.sigla} e o limite, por ano (interrupções)`}
                        dados={evol.qualidade}
                        chaveX="ano"
                        formatoX="texto"
                        series={[
                          { id: "fec", rotulo: "FEC apurado", sigla: "FEC", cor: "var(--serie-comp-2)" },
                          { id: "fec_limite", rotulo: "Limite", sigla: "Limite", cor: "var(--serie-referencia)", tracejada: true },
                        ]}
                        unidade="interrupções"
                        casas={2}
                        zeroNoEixo
                        altura={260}
                      />
                    </div>
                    <EmpresasComoLer partes={["continuidade"]} />
                  </SecaoDoPainel>
                )}
                {evol.tarifa.length > 0 && (
                  <SecaoDoPainel id="tarifa" titulo="E a tarifa residencial, em cada vigência?">
                    <GraficoLinhas
                      titulo={`Tarifa B1 da ${d.sigla} por início de vigência (R$/MWh nominais, sem tributos)`}
                      dados={evol.tarifa}
                      chaveX="inicio"
                      formatoX="data"
                      series={[
                        { id: "total", rotulo: "Total (TE + TUSD)", sigla: "Total", cor: "var(--serie-comp-1)" },
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
                  <EmpresasAviso rotulo="Sem evolução própria">
                    <p>Nenhuma das bases publicadas de origem publica série histórica para este CNPJ nesta publicação.</p>
                  </EmpresasAviso>
                )}
                {/* a leitura de cada medida fica ao lado da sua figura; a de uma medida sem série própria vem aqui, porque o número dela está na faixa */}
                {semSerie.length > 0 && <EmpresasComoLer partes={semSerie} />}

                <SecaoDoPainel id="pares" titulo="Como ela se compara com as pares?">
                  <ul className="space-y-1 text-sm text-carvao">
                    <li>{textoPares(d.sigla, "taxa de perdas", pp, d.slug)}</li>
                    <li>{textoPares(d.sigla, "DEC", pq, d.slug)}</li>
                  </ul>
                  {d.grupo === "permissionaria" && (
                    <p className="max-w-prose2 text-sm text-carvao-muted" data-grupo-permissionaria="">
                      Permissionária é a classificação que a ANEEL dá a esta distribuidora, diferente da de concessionária. Os pares são só as distribuidoras do mesmo grupo.
                    </p>
                  )}
                  {textoNegativos(pp) && (
                    <p className="max-w-prose2 text-sm text-carvao-muted" data-pares-negativos="">
                      {textoNegativos(pp)}
                    </p>
                  )}
                  <EmpresasFichaPares slug={d.slug} sigla={d.sigla} perdas={pp} qualidade={pq} />
                </SecaoDoPainel>

                <SecaoDoPainel id="controle" titulo={`Quem controla a ${d.sigla}?`}>
                  <p className="text-sm text-carvao">
                    {d.controle.topo
                      ? `O topo da cadeia de controladores únicos declarada à ANEEL é ${nomeOuCnpj(d.controle.topo_nome, d.controle.topo)}; motivo da parada: ${motivoExplicado(d.controle.motivo_parada, motivos)}.`
                      : `A própria ${d.sigla} é o topo da cadeia declarada: ${motivoExplicado(d.controle.motivo_parada, motivos)}.`}
                    {d.controle.acima ? ` Acima, sem CNPJ: ${d.controle.acima}.` : ""}
                  </p>
                  {arvore ? (
                    <EmpresasArvore a={arvore} href={(c) => `${rotaPainel("p039")}?ctl.e=${c}#p039`} motivos={motivos} resumo={false} />
                  ) : (
                    <p className="text-sm text-carvao-muted">O CNPJ não aparece na composição societária declarada na janela vigente nem como sócio de outro declarante.</p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel id="cvm" titulo="O que ela reporta à CVM?">
                  {companhia ? (
                    <>
                      <p className="text-sm text-carvao">{textoCompanhia(companhia, g.financas.contas)}</p>
                      <p className="max-w-prose2 text-xs text-carvao-muted">
                        CVM é a {SIGLAS.CVM}; os valores vêm das {SIGLAS.DFP} (DFP, anuais) e das {SIGLAS.ITR} (ITR, trimestrais).
                      </p>
                      <div className="max-w-sm">
                        <Numero
                          variante="faixa"
                          rotulo={`Receita ${companhia.ultimo_exercicio ?? ""} (${rotuloEscopo(companhia.escopo_exibido)})`}
                          natureza={companhia.alertas.includes("escala_corrigida") ? "ESTIMADO" : "OBSERVADO"}
                          valor={emMilhoes(evReceita?.valor_calculo ?? null)}
                          casas={1}
                          unidade="R$ milhões"
                          evidencia={evReceita}
                          motivoAusencia="A receita do último exercício não tem valor publicado ou ficha Comprove."
                          endereco={`${rotaEntidade(d.slug)}#ficha`}
                        />
                      </div>
                      {linhasFin.length > 0 ? (
                        <div className="grid gap-6 lg:grid-cols-2">
                          <GraficoLinhas
                            titulo={`Receita, resultado e lucro, ${rotuloEscopo(escopo)} (R$ milhões)`}
                            dados={linhasFin}
                            chaveX="x"
                            formatoX="texto"
                            series={[
                              { id: "receita", rotulo: "Receita", cor: "var(--serie-comp-1)" },
                              { id: "ebit", rotulo: "Resultado antes do financeiro e dos tributos", sigla: "Resultado", cor: "var(--serie-comp-2)" },
                              { id: "lucro_liquido", rotulo: "Lucro líquido", sigla: "Lucro", cor: "var(--serie-comp-3)" },
                            ]}
                            unidade="R$ milhões"
                            casas={1}
                            legendaInterativa
                            altura={260}
                          />
                          <GraficoLinhas
                            titulo={`Ativo, dívida bruta e patrimônio no fim do exercício, ${rotuloEscopo(escopo)} (R$ milhões)`}
                            dados={linhasFin}
                            chaveX="x"
                            formatoX="texto"
                            series={[
                              { id: "ativo_total", rotulo: "Ativo total", sigla: "Ativo", cor: "var(--serie-comp-1)" },
                              { id: "divida_bruta", rotulo: "Dívida bruta", sigla: "Dívida", cor: "var(--serie-comp-2)" },
                              { id: "patrimonio_liquido", rotulo: "Patrimônio líquido", sigla: "PL", cor: "var(--serie-comp-3)" },
                            ]}
                            unidade="R$ milhões"
                            casas={1}
                            legendaInterativa
                            altura={260}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-carvao-muted">Sem série anual no escopo {rotuloEscopo(escopo)} para esta companhia.</p>
                      )}
                      {fin?.[companhia.cnpj]?.escala_corrigida?.length ? (
                        <p className="text-xs text-carvao-muted">Escala convertida pelo observatório (natureza estimada): {datasLegiveis(fin[companhia.cnpj].escala_corrigida!.join("; "))}.</p>
                      ) : null}
                      <p className="text-sm">
                        <Link href={cvmLink(companhia.cnpj)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                          Comparar com outras companhias e ver as informações trimestrais
                        </Link>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-carvao">
                      A {d.sigla} não é companhia aberta registrada no setor elétrico da CVM ({SIGLAS.CVM}): não publica DFP ({SIGLAS.DFP}) nem ITR ({SIGLAS.ITR}) padronizados.
                      {abertaAcima ? (
                        <>
                          {" "}
                          A primeira companhia aberta na cadeia de controle declarada é{" "}
                          <Link href={cvmLink(abertaAcima.cnpj)} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                            {nomeOuCnpj(abertaAcima.nome, abertaAcima.cnpj)}
                          </Link>
                          , cujas demonstrações consolidadas incluem esta distribuidora (e não se somam a ela).
                        </>
                      ) : (
                        " Nenhuma companhia aberta ativa aparece na cadeia de controle declarada."
                      )}
                    </p>
                  )}
                  {d.geracao && (
                    <p className="text-sm text-carvao-muted">
                      Também tem participação em {inteiro(d.geracao.usinas)} usinas do SIGA ({SIGLAS.SIGA}), com {mwTexto(d.geracao.mw_proporcional, 2)} de capacidade proporcional.
                    </p>
                  )}
                </SecaoDoPainel>

                {origens.length > 0 && (
                  <div className="border-t border-linha pt-4" data-origens="true">
                    <p className="rotulo text-mineral">Ver nos módulos de origem, com a {d.sigla} já escolhida</p>
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

                <SecaoDoPainel id="tabelas" titulo="Tabelas da evolução própria (as mesmas linhas dos gráficos)" nivel="analisar">
                  {perdasSerie.length > 0 && (
                    <TabelaInterativa
                      titulo={`Perdas da ${d.sigla} por ano`}
                      colunas={COLUNAS_EVOLUCAO_PERDAS}
                      linhas={perdasSerie.map((x) => ({ ...x, id: x.ano }))}
                      chaveLinha="id"
                      colunaRotulo="ano"
                      fonte="ANEEL, SAMP (base publicada de Perdas)"
                      versao={g.distribuidoras.golds_origem["perdas.json"].gerado_em?.slice(0, 10) ?? ""}
                      nomeArquivo={`empresas-${d.slug}-perdas`}
                      ordemInicial={{ coluna: "ano", direcao: "desc" }}
                    />
                  )}
                  {evol.qualidade.length > 0 && (
                    <TabelaInterativa
                      titulo={`DEC e FEC da ${d.sigla} por ano`}
                      colunas={COLUNAS_EVOLUCAO_QUALIDADE}
                      linhas={evol.qualidade.map((x) => ({ ...x, id: x.ano }))}
                      chaveLinha="id"
                      colunaRotulo="ano"
                      fonte="ANEEL, indicadores de continuidade (base publicada de Qualidade)"
                      versao={g.distribuidoras.golds_origem["qualidade.json"].gerado_em?.slice(0, 10) ?? ""}
                      nomeArquivo={`empresas-${d.slug}-continuidade`}
                      ordemInicial={{ coluna: "ano", direcao: "desc" }}
                    />
                  )}
                  {evol.tarifa.length > 0 && (
                    <TabelaInterativa
                      titulo={`Vigências da tarifa B1 da ${d.sigla}`}
                      colunas={COLUNAS_EVOLUCAO_TARIFA}
                      linhas={evol.tarifa.map((x) => ({ ...x, id: `${x.inicio}|${x.ato}` }))}
                      chaveLinha="id"
                      colunaRotulo="inicio"
                      fonte="ANEEL, tarifas de aplicação (base publicada de Conta de luz)"
                      versao={g.distribuidoras.golds_origem["conta.json"].gerado_em?.slice(0, 10) ?? ""}
                      nomeArquivo={`empresas-${d.slug}-tarifa-b1`}
                      ordemInicial={{ coluna: "inicio", direcao: "desc" }}
                    />
                  )}
                  {linhasFin.length > 0 && (
                    <TabelaInterativa
                      titulo={`Demonstrações anuais na CVM, ${rotuloEscopo(escopo)}`}
                      colunas={COLUNAS_FIN}
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

                <SecaoDoPainel id="identidade" titulo="Identidade e origem de cada número" nivel="auditar">
                  <p className="text-sm text-carvao-muted">
                    Identidade: CNPJ {cnpjFormatado(d.cnpj)}; slug estável {d.slug}
                    {d.slugs_alternativos.length ? ` (também por ${d.slugs_alternativos.join(", ")})` : ""}. Classificação {d.classificacao ?? "sem registro"}
                    {d.conflito_classificacao ? ", com conflito entre o SAMP e a continuidade" : ""}. {g.distribuidoras.regra_universo}
                  </p>
                  <ul className="space-y-1 text-sm text-carvao-muted">
                    {evol.arquivos.map((a) => (
                      <li key={a.url}>
                        Série de {{ perdas: "perdas", qualidade: "continuidade", tarifa: "tarifa" }[a.modulo]}:{" "}
                        <a href={a.url} className="underline underline-offset-4 hover:text-carvao">
                          {a.url.split("/").pop()}
                        </a>
                        {a.disponivel ? "" : " (arquivo ausente nesta publicação)"}
                      </li>
                    ))}
                  </ul>
                  {companhia && (
                    <p className="text-sm text-carvao-muted">
                      CVM: código {companhia.cd_cvm ?? "sem registro"}, situação {companhia.situacao ?? "sem registro"}, setor {companhia.setor ?? "sem registro"}; {inteiro(companhia.valores_reapresentados)}{" "}
                      valores reapresentados no comparativo do ano seguinte.
                    </p>
                  )}
                </SecaoDoPainel>

                <EmpresasSeguir
                  ancora="ficha"
                  proximo={{ href: `${rotaPainel("p037")}?dist.cmp=${d.slug}#p037`, pergunta: `Como a ${d.sigla} se compara com outras distribuidoras?` }}
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
