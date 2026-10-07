import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasArvore } from "@/components/energia/EmpresasArvore";
import { EmpresasFichaPares } from "@/components/energia/EmpresasFichaPares";
import {
  EmpresasAnalise,
  EmpresasAuditoria,
  EmpresasAviso,
  EmpresasNavegacao,
  EmpresasRecorte,
  EmpresasResposta,
  EmpresasSeguir,
  EmpresasSubtitulo,
} from "@/components/energia/EmpresasPagina";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_EVOLUCAO_PERDAS,
  COLUNAS_EVOLUCAO_QUALIDADE,
  COLUNAS_EVOLUCAO_TARIFA,
  ROTA_EMPRESAS,
  ROTULO_MOTIVO,
  cnpjFormatado,
  comReferenciaNacional,
  dadosFinancas,
  dataTexto,
  downloadsDe,
  emMilhoes,
  inteiro,
  linksOrigem,
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
  slugsEstaticos,
  textoCompanhia,
  textoPares,
} from "@/lib/energia/empresas";
import { arvoreDoArquivo, evidenciaPerdas, evidenciasReceita, evolucaoDistribuidora, seriesFinanceirasDe } from "@/lib/energia/empresas-arquivos";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
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

export default function FichaDistribuidora({ params }: { params: { entidade: string } }) {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="empresas" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel titulo="Ficha da distribuidora indisponível nesta publicação" motivo={(g as { motivo?: string } | null)?.motivo ?? "A gold do módulo Empresas não foi gerada ou não passou na validação."} />
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
  const evol = evolucaoDistribuidora(g.distribuidoras.series_evolucao, d.cnpj);
  const nacional = lerGold<{ nacional?: { ano: number; parcial: boolean; taxa_total_pct: number | null; universo?: string }[] }>("perdas.json")?.nacional ?? [];
  const perdasSerie = d.grupo === "concessionaria" ? comReferenciaNacional(evol.perdas, nacional) : evol.perdas.map((p) => ({ ...p, brasil: null }));
  const evPerdas = evidenciaPerdas(d.cnpj);
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

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-ficha" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <nav aria-label="Trilha" className="pt-8 text-sm text-mineral">
          <Link href={ROTA_EMPRESAS} className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            Empresas
          </Link>{" "}
          ·{" "}
          <Link href={rotaPainel("p037")} className="inline-flex min-h-[44px] items-center underline underline-offset-4">
            Perfil da distribuidora
          </Link>{" "}
          · {d.sigla}
        </nav>
        <CabecalhoModulo
          rotulo="Perfil da distribuidora"
          titulo={`${d.sigla}: ${d.nome ?? "razão social sem registro"}`}
          referencia={
            <>
              Perdas de {p?.ano ?? "sem dado"} (base publicada de Perdas), continuidade de {q?.ano ?? "sem dado"} (base publicada de Qualidade), tarifas da base publicada de Conta de luz; cadeia de controle declarada à ANEEL de{" "}
              {g.datas.polimero_janela[0] ?? "sem dado"} a {g.datas.polimero_janela.at(-1) ?? "sem dado"}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          CNPJ {cnpjFormatado(d.cnpj)} · {d.classificacao ?? rotuloGrupo(d.grupo)} · {d.ufs.length ? `área em ${d.ufs.join(", ")}` : "sem conjunto elétrico vigente (UF sem registro)"} ·{" "}
          {d.ativa ? "ativa" : "inativa"}. Siglas publicadas pelas fontes: {d.siglas.map((s) => `${s.sigla} (${{ tarifas: "tarifas", continuidade: "continuidade", samp: "SAMP", cadastro_agentes: "cadastro de agentes" }[s.fonte]})`).join("; ")}.
        </CabecalhoModulo>
        <EmpresasNavegacao atual="ficha" />

        <ModoProfundidade>
          <Bloco id="perfil">
            <PainelEvidencia
              id="ficha"
              pergunta={`Como a ${d.sigla} atende sua área?`}
              subtitulo="Perdas, continuidade e tarifa residencial pelo mesmo CNPJ dos módulos de origem · %, horas, interrupções, R$/MWh"
              porQueImporta={
                <>
                  As <Termo slug="perdas-de-energia">perdas</Termo>, o <Termo slug="dec">DEC</Termo> e o <Termo slug="fec">FEC</Termo> e a <Termo slug="tarifa-te-tusd">tarifa</Termo> dizem
                  quanto da energia se perde na rede da {d.sigla}, quanto tempo e quantas vezes falta luz para os seus consumidores e quanto eles pagam por MWh. A ficha junta as três bases da
                  ANEEL pela mesma identidade.
                </>
              }
              oQueMudou={
                <>
                  Evolução própria: perdas de {evol.perdas[0]?.ano ?? "sem dado"} a {evol.perdas.at(-1)?.ano ?? "sem dado"}, continuidade de {evol.qualidade[0]?.ano ?? "sem dado"} a{" "}
                  {evol.qualidade.at(-1)?.ano ?? "sem dado"}, {inteiro(evol.tarifa.length)} vigências tarifárias.
                  {evol.quebrasQualidade.length ? ` O perímetro da continuidade mudou em ${evol.quebrasQualidade.join(", ")}.` : ""}
                </>
              }
              comoInterpretar={<>{g.distribuidoras.pares} Ano incompleto de perdas aparece tracejado e fora da comparação; o limite de DEC e FEC é o fixado pela ANEEL para a própria distribuidora.</>}
              naoConcluir={
                <>
                  Não se conclui eficiência nem culpa: perdas, interrupções e tarifa dependem da área atendida. A tarifa B1 sem tributos não é a conta inteira. As taxas da distribuidora não
                  valem para cada município da área (não se replicam por município).
                </>
              }
              proveniencia={g.proveniencia.distribuidoras}
              complementares={[
                ...(g.proveniencia.distribuidoras_perdas ? [{ rotulo: "Perdas totais (base publicada de Perdas)", p: g.proveniencia.distribuidoras_perdas }] : []),
                ...(g.proveniencia.distribuidoras_qualidade ? [{ rotulo: "DEC e FEC (base publicada de Qualidade)", p: g.proveniencia.distribuidoras_qualidade }] : []),
                ...(g.proveniencia.distribuidoras_tarifa ? [{ rotulo: "Tarifa B1 (base publicada de Conta de luz)", p: g.proveniencia.distribuidoras_tarifa }] : []),
              ]}
            >
              <div className="space-y-6">
                <EmpresasResposta id="ficha">{respostaFicha(d)}</EmpresasResposta>
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {evPerdas ? (
                    <Numero
                      rotulo="Perdas totais"
                      natureza={g.proveniencia.distribuidoras_perdas?.natureza ?? "CALCULADO"}
                      evidencia={evPerdas.evidencia}
                      formato="pct"
                      casas={2}
                      tamanho="medio"
                      nota={pp ? textoPares(d.sigla, "taxa de perdas", pp) : undefined}
                      endereco={`${rotaEntidade(d.slug)}#ficha`}
                    />
                  ) : (
                    <div className="border border-linha bg-superficie p-5 text-sm text-carvao-muted">
                      <p className="rotulo text-mineral">Perdas totais</p>
                      <p className="mt-3 font-serif text-2xl text-carvao">{p && p.taxa_total_pct !== null ? pctTexto(p.taxa_total_pct, 2) : "sem dado"}</p>
                      <p className="mt-2 text-xs">
                        {p && p.ano ? `${p.ano}. ` : ""}O módulo Perdas não publica a ficha de prova deste CNPJ{p && !p.ano ? `; último mês no SAMP: ${dataTexto(p.ultima_competencia)}` : ""}.
                      </p>
                    </div>
                  )}
                  <div className="border border-linha bg-superficie p-5 text-sm text-carvao-muted">
                    <p className="rotulo text-mineral">DEC e limite</p>
                    <p className="mt-3 font-serif text-2xl text-carvao tabular-nums">{q?.dec !== null && q?.dec !== undefined ? `${numTexto(q.dec, 2)} h` : "sem dado"}</p>
                    <p className="mt-2 text-xs">Limite {q?.dec_limite !== null && q?.dec_limite !== undefined ? `${numTexto(q.dec_limite, 2)} h` : "sem dado"}; {q?.ano ?? "sem ano de referência"}.</p>
                  </div>
                  <div className="border border-linha bg-superficie p-5 text-sm text-carvao-muted">
                    <p className="rotulo text-mineral">FEC e limite</p>
                    <p className="mt-3 font-serif text-2xl text-carvao tabular-nums">{q?.fec !== null && q?.fec !== undefined ? numTexto(q.fec, 2) : "sem dado"}</p>
                    <p className="mt-2 text-xs">Interrupções por unidade consumidora; limite {numTexto(q?.fec_limite, 2)}.</p>
                  </div>
                  <div className="border border-linha bg-superficie p-5 text-sm text-carvao-muted">
                    <p className="rotulo text-mineral">Tarifa B1 vigente</p>
                    <p className="mt-3 font-serif text-2xl text-carvao tabular-nums">{t && t.vigente && t.total !== null ? `R$ ${numTexto(t.total, 2)}` : "sem tarifa vigente"}</p>
                    <p className="mt-2 text-xs">
                      {t && t.vigente ? `R$/MWh sem tributos; TE ${numTexto(t.te, 2)} e TUSD ${numTexto(t.tusd, 2)}; ${t.ato ?? "ato sem número"}.` : t && !t.vigente ? (t.motivo ?? "motivo não publicado") : "Não aparece nas tarifas de aplicação."}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-carvao-muted">
                  DEC, FEC e tarifa são cópias das bases publicadas de Qualidade e de Conta de luz, que não publicam ficha de prova por distribuidora; a proveniência de cada um está nos selos abaixo, e o
                  número pode ser conferido na página de origem com a mesma distribuidora escolhida.
                </p>

                {evol.perdas.length > 0 && (
                  <>
                    <EmpresasSubtitulo>Como as perdas da {d.sigla} evoluíram?</EmpresasSubtitulo>
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
                  </>
                )}
                {evol.qualidade.length > 0 && (
                  <>
                    <EmpresasSubtitulo>E a continuidade do serviço, diante do limite?</EmpresasSubtitulo>
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
                  </>
                )}
                {evol.tarifa.length > 0 && (
                  <>
                    <EmpresasSubtitulo>E a tarifa residencial, em cada vigência?</EmpresasSubtitulo>
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
                  </>
                )}
                {!evol.perdas.length && !evol.qualidade.length && !evol.tarifa.length && (
                  <EmpresasAviso rotulo="Sem evolução própria">
                    <p>Nenhuma das bases publicadas de origem publica série histórica para este CNPJ nesta publicação.</p>
                  </EmpresasAviso>
                )}

                <EmpresasSubtitulo>Como ela se compara com as pares?</EmpresasSubtitulo>
                <ul className="space-y-1 text-sm text-carvao">
                  <li>{textoPares(d.sigla, "taxa de perdas", pp)}</li>
                  <li>{textoPares(d.sigla, "DEC", pq)}</li>
                </ul>
                <EmpresasFichaPares slug={d.slug} sigla={d.sigla} perdas={pp} qualidade={pq} />

                <EmpresasSubtitulo>Quem controla a {d.sigla}?</EmpresasSubtitulo>
                <p className="text-sm text-carvao">
                  {d.controle.topo
                    ? `O topo da cadeia de controladores únicos declarada à ANEEL é ${nomeOuCnpj(d.controle.topo_nome, d.controle.topo)}; a cadeia para ali porque: ${ROTULO_MOTIVO[d.controle.motivo_parada]}.`
                    : `A própria ${d.sigla} é o topo da cadeia declarada: ${ROTULO_MOTIVO[d.controle.motivo_parada]}.`}
                  {d.controle.acima ? ` Acima, sem CNPJ: ${d.controle.acima}.` : ""}
                </p>
                {arvore ? (
                  <EmpresasArvore a={arvore} href={(c) => `${rotaPainel("p039")}?ctl.e=${c}#p039`} />
                ) : (
                  <p className="text-sm text-carvao-muted">O CNPJ não aparece na composição societária declarada na janela vigente nem como sócio de outro declarante.</p>
                )}

                <EmpresasSubtitulo>O que ela reporta à CVM?</EmpresasSubtitulo>
                {companhia ? (
                  <>
                    <p className="text-sm text-carvao">{textoCompanhia(companhia, g.financas.contas)}</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Numero
                        rotulo={`Receita ${companhia.ultimo_exercicio ?? ""} (${rotuloEscopo(companhia.escopo_exibido)})`}
                        natureza={companhia.alertas.includes("escala_corrigida") ? "ESTIMADO" : "OBSERVADO"}
                        valor={emMilhoes(evReceita?.valor_calculo ?? null)}
                        casas={1}
                        unidade="R$ milhões"
                        evidencia={evReceita}
                        tamanho="medio"
                        motivoAusencia="A receita do último exercício não tem valor publicado ou ficha de prova."
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
                      <p className="text-xs text-carvao-muted">Escala convertida pelo observatório (natureza estimada): {fin[companhia.cnpj].escala_corrigida!.join("; ")}.</p>
                    ) : null}
                    <p className="text-sm">
                      <Link href={`${rotaPainel("p038")}?fin.sel=${companhia.cnpj}#p038`} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                        Comparar com outras companhias e ver as informações trimestrais
                      </Link>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-carvao">
                    A {d.sigla} não é companhia aberta registrada no setor elétrico da CVM: não publica DFP nem ITR padronizados.
                    {abertaAcima ? (
                      <>
                        {" "}
                        A primeira companhia aberta na cadeia de controle declarada é{" "}
                        <Link href={`${rotaPainel("p038")}?fin.sel=${abertaAcima.cnpj}#p038`} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
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
                    Também tem participação em {inteiro(d.geracao.usinas)} usinas do SIGA, com {mwTexto(d.geracao.mw_proporcional, 2)} de capacidade proporcional.
                  </p>
                )}

                <EmpresasAnalise titulo="Tabelas da evolução própria (as mesmas linhas dos gráficos)">
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
                </EmpresasAnalise>

                {origens.length > 0 && (
                  <div className="mt-6 border-t border-linha pt-4" data-origens="true">
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

                <EmpresasAuditoria titulo="Identidade e origem de cada número">
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
                </EmpresasAuditoria>

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
