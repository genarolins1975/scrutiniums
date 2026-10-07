import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { statSync } from "node:fs";
import { join } from "node:path";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Histograma } from "@/components/energia/Histograma";
import { Numero } from "@/components/energia/Numero";
import { QualidadeComparador } from "@/components/energia/QualidadeComparador";
import { QualidadeConjuntos } from "@/components/energia/QualidadeConjuntos";
import { QualidadeLimites } from "@/components/energia/QualidadeLimites";
import { QualidadeLinkPainel } from "@/components/energia/QualidadeLinkPainel";
import { QualidadeMapa } from "@/components/energia/QualidadeMapa";
import { QualidadeTabela } from "@/components/energia/QualidadeTabela";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { montaHistograma } from "@/lib/energia/distribuicao";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_COMP_ANUAL,
  COR_PARCELA,
  FONTE_CONTINUIDADE,
  ORDEM_PARCELAS,
  ROTULO_PARCELA_CURTO,
  anoBrasil,
  avisoDefasagem,
  histogramaDeFaixas,
  horasEMinutos,
  itensLimite,
  pctCobertura,
  linhasBrasilAnual,
  linhasBrasilMensal,
  linhasCompensacaoAnual,
  linhasCompensacaoMensal,
  linhasHistoricoConjuntos,
  linhasOuvidoriaNacional,
  linhasParcelas,
  linhasReclamacoesNacional,
  linhasResiliencia,
  linhasTelefonico,
  linhasTipoAnoReferencia,
  maioresDistribuidoras,
  mudancaP051,
  mudancaP052,
  mudancaP053,
  mudancaP054,
  respostaP051,
  respostaP052,
  respostaP053,
  respostaP054,
  rotuloDistribuidora,
  tabelaQualidade,
  textoAtualidade,
  notaTiposSemUc,
  type IdTabela,
} from "@/lib/energia/qualidade";
import type { QualidadeGold } from "@/lib/energia/tipos-qualidade";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Qualidade do serviço de distribuição: interrupções, limites, compensações e atendimento",
  description:
    "DEC e FEC por conjunto, distribuidora e Brasil (ANEEL), realizado diante dos limites regulatórios, compensações pagas por violação de limites individuais, reclamações por unidade consumidora, IASC com amostra, atendimento emergencial e eventos de emergência.",
  alternates: { canonical: "/setor-eletrico/qualidade" },
};

const URL_SERIE = "/energia/series/qualidade_distribuidoras_serie.json";
const URL_MUNICIPIOS = "/energia/series/qualidade_municipios.csv";

/** Período, universo e unidade do painel, logo abaixo da resposta (anatomia da seção 7.2, item 3). */
function Recorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Rodapé de cada painel: link compartilhável e a próxima pergunta (seção 7.2, itens 9 e 10). */
function Seguir({ ancora, href, pergunta }: { ancora: string; href: string; pergunta: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-linha pt-3">
      <QualidadeLinkPainel ancora={ancora} />
      <p className="text-sm">
        <span className="rotulo mr-2 text-mineral">Próxima pergunta</span>
        {href.startsWith("#") ? (
          <a href={href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {pergunta}
          </a>
        ) : (
          <Link href={href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
            {pergunta}
          </Link>
        )}
      </p>
    </div>
  );
}

function Analise({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-5">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

function Auditoria({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div data-nivel="auditar" className="space-y-3 border-t border-dashed border-linha pt-4">
      <h3 className="font-serif text-lg text-carvao">{titulo}</h3>
      {children}
    </div>
  );
}

function Resposta({ id, children, prova }: { id: string; children: ReactNode; prova?: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta={id}>
        {children}
      </p>
      {prova && <div className="flex flex-wrap items-center gap-x-5 gap-y-1">{prova}</div>}
    </div>
  );
}

/** Tamanho de um arquivo publicado, lido no build (nunca escrito à mão). */
function tamanho(url: string): string {
  try {
    const b = statSync(join(process.cwd(), "public", url)).size;
    return b >= 1e6 ? `${num(b / 1e6, 1)} MB` : `${num(b / 1e3, 0)} KB`;
  } catch {
    return "tamanho não disponível";
  }
}

export default function QualidadePage() {
  const g = lerGold<QualidadeGold>("qualidade.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="qualidade" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel
            titulo="Qualidade do serviço indisponível nesta publicação"
            motivo={
              g?.motivo ??
              "A gold do módulo Qualidade (public/energia/gold/qualidade.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
            }
          />
        </main>
      </>
    );
  }

  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  const c = g.conjuntos;
  const comp = g.compensacoes;
  const at = g.atendimento;
  const ev = g.evidencias;
  const prov = g.proveniencia;
  const anual = linhasBrasilAnual(g);
  const primeiroAno = anual[0]?.ano ?? String(ref);
  const mensal = linhasBrasilMensal(g);
  const incompletos = g.brasil.mensal.filter((m) => !m.completo);
  const parcelas = linhasParcelas(g);
  const inicioParcelas = parcelas[0]?.ano ?? null;
  const marcosParcelas = inicioParcelas ? [{ x: String(inicioParcelas), rotulo: `${inicioParcelas}: parcelas atuais` }] : [];
  const defasagem = avisoDefasagem(prov.conjuntos.publicado_pela_fonte_em, g.gerado_em);
  const entidades = g.distribuidoras
    .map((d) => ({ id: d.cnpj, rotulo: rotuloDistribuidora(d), detalhe: [d.nome_comercial, d.classificacao].filter(Boolean).join(", ") || undefined, sinonimos: [d.cnpj] }))
    .sort((x, y) => x.rotulo.localeCompare(y.rotulo, "pt-BR"));
  const maiores = maioresDistribuidoras(g);
  const histRazao = histogramaDeFaixas(c.histograma_razao_dec, c.quantis_razao_dec);
  const anoComp = comp.anual.find((x) => x.ano === comp.ano_referencia) ?? null;
  const compAnual = linhasCompensacaoAnual(g);
  const compBarras = compAnual.filter((l) => l.valor_uc_mi !== null);
  const compMensal = linhasCompensacaoMensal(g);
  const compIncompletos = comp.mensal.filter((m) => !m.completo);
  const inicioUg = comp.anual.find((x) => x.valor_ug !== null)?.ano ?? null;
  const distComp = g.distribuidoras.filter((d) => d.compensacao).length;
  const valorPorUc = g.distribuidoras.map((d) => d.compensacao?.valor_por_uc ?? null);
  const histValorUc = montaHistograma(valorPorUc, { largura: 5 });
  const iascValores = [...g.distribuidoras.map((d) => (d.iasc && d.iasc.ano === at.iasc.ano ? d.iasc.valor : null)), ...at.iasc.sem_continuidade_no_ano.map((x) => x.iasc)];
  const histIasc = montaHistograma(iascValores, { largura: 5 });
  const rec = at.reclamacoes_distribuidora.find((x) => x.ano === ref) ?? null;
  const recParcial = at.reclamacoes_distribuidora.find((x) => x.por_ucs === null && x.motivo_ausencia) ?? null;
  const tel = at.telefonico.anual.find((x) => x.ano === ref) ?? null;
  const evt = at.eventos_emergencia;
  const nomesDist = g.distribuidoras.map((d) => ({ cnpj: d.cnpj, rotulo: rotuloDistribuidora(d) }));
  const periodoMensal = g.brasil.mensal.length ? `${mesAno(g.brasil.mensal[0].m)} a ${mesAno(g.brasil.mensal.at(-1)!.m)}` : "sem meses publicados";
  // os arquivos anuais por década são os que o pipeline publica (lista da gold, não escrita aqui)
  const conjuntosDownloads = g.downloads.map((d) => d.url).filter((u) => u.includes("/qualidade_conjuntos_anual_"));
  const tamanhos = Object.fromEntries(conjuntosDownloads.map((u) => [u, tamanho(u)]));
  const exemploDec = a?.dec ?? null;
  const n = (id: IdTabela) => tabelaQualidade(id, g).linhas.length;
  const inicioConcessionarias = g.brasil.anual.find((x) => x.dec_concessionarias !== null)?.ano ?? null;
  const ultimaFaixaRazao = c.histograma_razao_dec.at(-1) ?? null;
  const ouvParcial = at.ouvidoria_aneel.filter((o) => o.por_ucs === null);
  const notaSemUc = notaTiposSemUc(g);

  return (
    <>
      <CabecalhoEnergia atual="qualidade" />
      <MarcaVisita secao="energia:qualidade" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Qualidade do serviço"
          titulo="Com que frequência e por quanto tempo falta energia?"
          referencia={
            <>
              {textoAtualidade(g)} Indicadores publicados pela ANEEL em {dataBR(prov.conjuntos.publicado_pela_fonte_em?.slice(0, 10) ?? null)}; processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          A ANEEL mede a continuidade do fornecimento por <Termo slug="conjunto-eletrico">conjunto elétrico</Termo>: o <Termo slug="dec">DEC</Termo> diz quantas horas, em média, cada
          unidade consumidora ficou sem energia, e o <Termo slug="fec">FEC</Termo> quantas vezes. Esta página mostra esses números para o Brasil, as distribuidoras e os conjuntos,
          compara cada um com o limite regulatório do mesmo ano, mostra as <Termo slug="compensacao-continuidade">compensações</Termo> pagas a quem teve limite individual violado e
          como o consumidor é atendido.
        </CabecalhoModulo>

        {defasagem && (
          <p role="status" className="mb-4 border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
            {defasagem}
          </p>
        )}

        <section aria-labelledby="como-ler-unidades" className="mb-6 border border-linha bg-superficie p-5">
          <h2 id="como-ler-unidades" className="rotulo text-mineral">
            Como ler as unidades
          </h2>
          <ul className="mt-2 grid gap-3 text-sm leading-relaxed text-carvao md:grid-cols-3">
            <li>
              <strong className="font-medium">Horas com centésimos, não minutos.</strong> {g.regras.centesimos}
              {exemploDec !== null && ` Assim, as ${num(exemploDec, 2)} h do Brasil em ${ref} são ${horasEMinutos(exemploDec)}.`}
            </li>
            <li>
              <strong className="font-medium">FEC em interrupções por unidade consumidora.</strong> Média de vezes em que cada unidade ficou sem energia por 3 minutos ou mais; também com
              centésimos.
            </li>
            <li>
              <strong className="font-medium">Apurado não é tudo.</strong> {g.regras.apurado}
            </li>
          </ul>
        </section>

        <section aria-label="Números de destaque" className="grid gap-4 pb-6 sm:grid-cols-2 lg:grid-cols-4">
          <Numero
            rotulo={`DEC do Brasil em ${ref}`}
            natureza="CALCULADO"
            valor={a?.dec ?? null}
            casas={2}
            unidade="h"
            evidencia={ev.dec_brasil ?? null}
            motivoAusencia="Ano sem os 12 meses nacionais completos."
            nota={a?.dec !== null && a?.dec !== undefined ? `${horasEMinutos(a.dec)} por unidade consumidora; todas as distribuidoras.` : undefined}
            endereco="/setor-eletrico/qualidade#duracao"
          />
          <Numero
            rotulo={`FEC do Brasil em ${ref}`}
            natureza="CALCULADO"
            valor={a?.fec ?? null}
            casas={2}
            unidade="interrupções"
            evidencia={ev.fec_brasil ?? null}
            motivoAusencia="Ano sem os 12 meses nacionais completos."
            nota="Interrupções de 3 minutos ou mais por unidade consumidora."
            endereco="/setor-eletrico/qualidade#duracao"
          />
          <Numero
            rotulo={`Conjuntos acima do limite de DEC em ${c.ano}`}
            natureza="CALCULADO"
            valor={c.pct_acima_limite_dec}
            formato="pct"
            casas={1}
            // a unidade da evidência começa com "%", que o formato já escreve colado ao número
            unidade="dos conjuntos com 12 meses e limite de DEC"
            evidencia={ev.conjuntos_acima_limite ?? null}
            nota={`${num(c.acima_limite_dec, 0)} de ${num(c.com_limite, 0)} conjuntos; comparação em centésimos.`}
            endereco="/setor-eletrico/qualidade#limites"
          />
          <Numero
            rotulo={`Compensações a unidades consumidoras em ${comp.ano_referencia}`}
            natureza="CALCULADO"
            valor={anoComp?.valor_uc === null || anoComp?.valor_uc === undefined ? null : anoComp.valor_uc / 1e6}
            formato="reais"
            casas={1}
            unidade="milhões"
            periodo={String(comp.ano_referencia)}
            evidencia={ev.compensacoes_ano ?? null}
            motivoAusencia="Ano sem os 12 meses informados pelas distribuidoras."
            nota="Valores nominais da competência; unidades geradoras à parte."
            endereco="/setor-eletrico/qualidade#compensacoes"
          />
        </section>

        <nav aria-label="Perguntas desta página" className="pb-4">
          <ol className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["#duracao", "Por quanto tempo e quantas vezes faltou luz?"],
              ["#limites", "O serviço cumpriu o padrão?"],
              ["#compensacoes", "Quais compensações foram pagas?"],
              ["#atendimento", "Como o consumidor é atendido e como a rede se recupera?"],
            ].map(([href, rot], i) => (
              <li key={href}>
                <a href={href} className="flex min-h-[44px] items-center gap-2 border border-linha bg-superficie px-3 py-2 text-carvao hover:border-energia">
                  <span className="rotulo text-mineral">{i + 1}</span>
                  {rot}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <ModoProfundidade>
          {/* ---------------- P051 ---------------- */}
          <Bloco id="duracao">
            <PainelEvidencia
              id="p051"
              pergunta="Por quanto tempo e quantas vezes faltou luz?"
              subtitulo="DEC e FEC apurados do Brasil, das distribuidoras e dos conjuntos · horas e interrupções por unidade consumidora"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  DEC e FEC são os indicadores com que a ANEEL acompanha a continuidade do fornecimento: limites, ranking e compensações partem deles. A média nacional é ponderada pelas
                  unidades consumidoras de cada conjunto em cada mês, então distribuidoras grandes pesam mais.
                </>
              }
              oQueMudou={mudancaP051(g)}
              comoInterpretar={
                <>
                  {g.regras.agregacao} A linha tracejada é o limite agregado do mesmo ano (limites dos conjuntos ponderados pelas UCs). No mapa, cada município recebe o maior (ou o menor)
                  valor dos conjuntos que o atendem; o histórico ao lado é o da distribuidora inteira.
                  {inicioConcessionarias !== null
                    ? ` Desde ${inicioConcessionarias}, a linha das concessionárias reproduz o universo do número que a ANEEL divulga.`
                    : " A linha só das concessionárias não tem anos com todas as distribuidoras classificadas nesta publicação."}
                </>
              }
              naoConcluir={
                <>
                  DEC e FEC são médias por unidade consumidora: não dizem quanto tempo cada pessoa ficou sem energia, e parte das unidades fica muito acima da média do conjunto. O mapa não
                  mede o município: um conjunto cobre vários municípios e um município pode ter dezenas de conjuntos. O apurado exclui interrupções expurgadas pela regra; comparar anos sem
                  olhar as parcelas pode esconder eventos extremos.
                  {inicioParcelas ? ` Antes de ${inicioParcelas} a fonte usa outra desagregação.` : ""}
                </>
              }
              proveniencia={prov.distribuidoras}
              complementares={[
                { rotulo: "Conjuntos (valores da ANEEL)", p: prov.conjuntos },
                { rotulo: "Mapa por município", p: prov.mapa },
              ]}
            >
              <div className="space-y-6">
                <Resposta
                  id="p051"
                  prova={
                    <>
                      {ev.dec_brasil && <ComproveNumero evidencia={ev.dec_brasil} rotulo="Comprove o DEC do Brasil" endereco="/setor-eletrico/qualidade#duracao" />}
                      {ev.fec_brasil && <ComproveNumero evidencia={ev.fec_brasil} rotulo="Comprove o FEC do Brasil" endereco="/setor-eletrico/qualidade#duracao" />}
                    </>
                  }
                >
                  {respostaP051(g)}
                </Resposta>
                <Recorte
                  periodo={
                    <>
                      Anual de {primeiroAno} a {ref} (só anos com 12 meses nacionais completos); mensal de {periodoMensal}
                    </>
                  }
                  universo={<>{g.brasil.universo.principal} Mapa: conjuntos com DEC em {g.mapa.ano}.</>}
                  unidade={<>{g.unidades.dec}; {g.unidades.fec}</>}
                />
                <CursorSincronizado>
                  <GraficoLinhas
                    titulo={`DEC apurado do Brasil e limite agregado, ${primeiroAno} a ${ref}`}
                    dados={anual}
                    chaveX="ano"
                    formatoX="texto"
                    series={[
                      { id: "dec", rotulo: "DEC, todas as distribuidoras", sigla: "DEC", cor: "var(--cor-energia)" },
                      { id: "dec_concessionarias", rotulo: "DEC, só concessionárias (universo divulgado pela ANEEL)", sigla: "Concess.", cor: "var(--serie-sm-se)" },
                      { id: "dec_limite", rotulo: "Limite agregado do ano", sigla: "Limite", cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade="h"
                    casas={2}
                    zeroNoEixo
                    legendaInterativa
                    marcos={marcosParcelas}
                  />
                  <GraficoLinhas
                    titulo={`FEC apurado do Brasil e limite agregado, ${primeiroAno} a ${ref}`}
                    dados={anual}
                    chaveX="ano"
                    formatoX="texto"
                    series={[
                      { id: "fec", rotulo: "FEC, todas as distribuidoras", sigla: "FEC", cor: "var(--cor-energia)" },
                      { id: "fec_concessionarias", rotulo: "FEC, só concessionárias (universo divulgado pela ANEEL)", sigla: "Concess.", cor: "var(--serie-sm-se)" },
                      { id: "fec_limite", rotulo: "Limite agregado do ano", sigla: "Limite", cor: "var(--serie-referencia)", tracejada: true },
                    ]}
                    unidade="interrupções"
                    casas={2}
                    zeroNoEixo
                    legendaInterativa
                    marcos={marcosParcelas}
                  />
                </CursorSincronizado>

                <div className="space-y-3 border-t border-linha pt-5">
                  <h3 className="font-serif text-lg text-carvao">Onde: os conjuntos que atendem cada município</h3>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {num(g.mapa.municipios_com_valor, 0)} municípios com valor em {g.mapa.ano}. A cor é do conjunto, não do município: quando vários conjuntos atendem a cidade, escolha ver o
                    de maior ou o de menor DEC (ou FEC). Clique num município, ou busque pelo nome, para ver os conjuntos e o histórico das distribuidoras.
                  </p>
                  <QualidadeMapa
                    ano={g.mapa.ano}
                    urlMunicipios={URL_MUNICIPIOS}
                    urlSerie={URL_SERIE}
                    distribuidoras={nomesDist}
                    regra={g.mapa.regra}
                    totalMunicipios={g.mapa.correspondencia.cadastro_ibge}
                    fonte="ANEEL, IndQual Município e Indicadores Coletivos de Continuidade; IBGE, cadastro de municípios"
                    versao={String(g.mapa.ano)}
                  />
                </div>

                <Analise titulo="Distribuidoras lado a lado: DEC e FEC diante do próprio limite">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Sem escolha no link, entram as quatro maiores distribuidoras em unidades consumidoras em {ref}. Todos os painéis usam a mesma escala; a linha tracejada é o limite de cada
                    ano. Incorporações mudam a área da distribuidora e aparecem na nota do painel.
                  </p>
                  <QualidadeComparador entidades={entidades} padrao={maiores} urlSerie={URL_SERIE} />
                </Analise>

                <Analise titulo="Quanto do tempo sem energia a regra tira do apurado?">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    O DEC apurado (o que é comparado ao limite) exclui interrupções em situação de emergência, em dia crítico, de origem externa ao sistema de distribuição e cortes pedidos
                    pelo ONS. As barras empilham as parcelas que a ANEEL publica{inicioParcelas ? ` desde ${inicioParcelas}` : ""}; a soma é o tempo sem energia de todas as origens
                    publicadas.
                  </p>
                  <GraficoBarras
                    titulo={`Parcelas do DEC do Brasil por origem, ${parcelas[0]?.ano ?? ""} a ${ref}`}
                    dados={parcelas}
                    chaveCategoria="ano"
                    series={ORDEM_PARCELAS.map((p) => ({ id: p, rotulo: ROTULO_PARCELA_CURTO[p], cor: COR_PARCELA[p] }))}
                    unidade="h"
                    casas={2}
                    empilhado
                    altura={320}
                  />
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {ORDEM_PARCELAS.map((p) => (
                      <div key={p}>
                        <dt className="font-medium text-carvao">{g.parcelas.rotulos[p]}</dt>
                        <dd className="text-carvao-muted">
                          {g.parcelas.grupos[p].map((s) => `${s}: ${g.parcelas.definicao[s] ?? "sem definição no dicionário"}`).join("; ")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Analise>

                <Analise titulo="Mês a mês, nos últimos meses publicados">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    {g.regras.mes_completo}{" "}
                    {incompletos.length
                      ? `Ficam fora, com o valor publicado na tabela: ${incompletos.map((m) => mesAno(m.m)).join(", ")}.`
                      : "Todos os meses do período estão completos."}
                  </p>
                  <CursorSincronizado>
                    <GraficoLinhas
                      titulo="DEC mensal do Brasil (meses completos)"
                      dados={mensal}
                      chaveX="m"
                      formatoX="mes"
                      series={[{ id: "dec", rotulo: "DEC mensal", cor: "var(--cor-energia)" }]}
                      unidade="h"
                      casas={2}
                      zeroNoEixo
                      altura={220}
                    />
                    <GraficoLinhas
                      titulo="FEC mensal do Brasil (meses completos)"
                      dados={mensal}
                      chaveX="m"
                      formatoX="mes"
                      series={[{ id: "fec", rotulo: "FEC mensal", cor: "var(--serie-sm-se)" }]}
                      unidade="interrupções"
                      casas={2}
                      zeroNoEixo
                      altura={220}
                    />
                  </CursorSincronizado>
                  <QualidadeTabela tabela="mensal" titulo="Meses publicados, com a situação de cada um" linhas={n("mensal")} chaveUrl="tmes" />
                </Analise>

                <Analise titulo={`Todas as distribuidoras em ${ref}: duração, frequência e expurgos`}>
                  <QualidadeTabela tabela="dist-p051" titulo={`DEC, FEC e parcelas por distribuidora, ${ref}`} linhas={n("dist-p051")} chaveUrl="tdist" />
                </Analise>

                <Analise titulo="Todos os conjuntos de um ano">
                  <QualidadeConjuntos anoInicial={Number(primeiroAno)} anoFinal={ref} tamanhos={tamanhos} fonte={FONTE_CONTINUIDADE} />
                </Analise>

                <Auditoria titulo="Universos, pesos, controles e arquivos">
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    <li>
                      <strong className="font-medium text-carvao">Universo principal:</strong> {g.brasil.universo.principal}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">Só concessionárias:</strong> {g.brasil.universo.concessionarias}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">Peso:</strong> {g.regras.agregacao}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">Controle do número de unidades:</strong> {g.regras.numcon}
                    </li>
                    <li>
                      <strong className="font-medium text-carvao">Ano corrente:</strong> {g.regras.parcial} {g.parcial?.aviso}
                    </li>
                  </ul>
                  <QualidadeTabela tabela="identidade" titulo="Identidade do apurado: DEC e FEC iguais às parcelas internas (IP + IND), por ano" linhas={n("identidade")} chaveUrl="tide" />
                  <ul className="space-y-1 text-sm">
                    {["/energia/series/qualidade_brasil.csv", "/energia/series/qualidade_distribuidoras_anual.csv", "/energia/series/qualidade_distribuidoras_mensal.csv", "/energia/series/qualidade_conjuntos_mensal.csv", URL_MUNICIPIOS, ...conjuntosDownloads].map((u) => (
                      <li key={u}>
                        <a href={u} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                          {u.split("/").at(-1)} ({tamanho(u)})
                        </a>
                      </li>
                    ))}
                  </ul>
                </Auditoria>
                <Seguir ancora="duracao" href="#limites" pergunta="O serviço cumpriu o padrão? Veja o realizado diante do limite." />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P052 ---------------- */}
          <Bloco id="limites">
            <PainelEvidencia
              id="p052"
              pergunta="O serviço cumpriu o padrão?"
              subtitulo="DEC e FEC apurados diante do limite regulatório do mesmo ano · razão apurado ÷ limite"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A ANEEL fixa limites de DEC e de FEC para cada <Termo slug="conjunto-eletrico">conjunto</Termo> com a periodicidade das revisões tarifárias. Segundo a ANEEL, o
                  descumprimento traz consequências à distribuidora, como plano de resultados e limitação de proventos aos acionistas, e o ranking da continuidade parte da distância ao
                  limite: ela mostra quem está perto, quem passou e por quanto.
                </>
              }
              oQueMudou={mudancaP052(c)}
              comoInterpretar={
                <>
                  No gráfico de pontos, o círculo é o apurado e o losango o limite da distribuidora (limites dos conjuntos ponderados pelas UCs médias do ano); a diferença está escrita.{" "}
                  {g.regras.limite_centesimos} O histograma mostra todos os conjuntos pela razão apurado ÷ limite: à direita de 1, acima do limite.
                </>
              }
              naoConcluir={
                <>
                  Ficar abaixo do limite agregado não quer dizer que todos os conjuntos da distribuidora ficaram abaixo, nem que nenhum consumidor teve o limite individual violado. Limites
                  diferem entre conjuntos e anos: uma razão menor não é, sozinha, serviço melhor que o de outra área. A razão do Brasil não é um limite oficial nacional.
                </>
              }
              proveniencia={prov.limites}
              complementares={[{ rotulo: "Ranking da continuidade (DGC publicado)", p: prov.ranking }]}
            >
              <div className="space-y-6">
                <Resposta
                  id="p052"
                  prova={ev.conjuntos_acima_limite && <ComproveNumero evidencia={ev.conjuntos_acima_limite} rotulo="Comprove a contagem de conjuntos" endereco="/setor-eletrico/qualidade#limites" />}
                >
                  {respostaP052(g)}
                </Resposta>
                <Recorte
                  periodo={<>Ano de apuração {c.ano}, com o limite do mesmo ano; histórico de {c.historico[0]?.ano ?? c.ano} a {c.ano}</>}
                  universo={
                    <>
                      {num(c.com_limite, 0)} conjuntos com 12 meses e limite; {g.distribuidoras.length} distribuidoras ({g.distribuidoras.filter((d) => d.dec === null).length} sem valor anual)
                    </>
                  }
                  unidade="horas (DEC), interrupções (FEC) e razão apurado ÷ limite (adimensional)"
                />
                <QualidadeLimites
                  ano={ref}
                  itensDec={itensLimite(g, "dec")}
                  itensFec={itensLimite(g, "fec")}
                  classes={Object.fromEntries(g.distribuidoras.map((d) => [d.cnpj, d.classificacao]))}
                  totalLinhas={n("limites")}
                  urlSerie={URL_SERIE}
                />
                <div className="space-y-3 border-t border-linha pt-5">
                  <h3 className="font-serif text-lg text-carvao">A distribuição dos conjuntos: as médias não escondem as caudas</h3>
                  <Histograma
                    titulo={`Conjuntos por razão DEC ÷ limite, ${c.ano}`}
                    dados={histRazao}
                    rotuloX="DEC apurado ÷ limite do conjunto"
                    unidade="vezes o limite"
                    casas={2}
                    contagem={{ singular: "conjunto", plural: "conjuntos" }}
                    periodo={String(c.ano)}
                    valorAtual={{ valor: 1, rotulo: "Limite (razão 1)" }}
                    cor="var(--cor-energia)"
                    nota={`Faixas e quantis calculados no processamento sobre todos os conjuntos.${
                      ultimaFaixaRazao && ultimaFaixaRazao.ate === null && c.quantis_razao_dec.max !== null
                        ? ` A última faixa é aberta na fonte (${num(ultimaFaixaRazao.de, 2)} vezes o limite ou mais) e é desenhada até o máximo (${num(c.quantis_razao_dec.max, 2)}).`
                        : ""
                    } ${num(c.iguais_limite_dec, 0)} conjuntos com DEC igual ao limite não contam como acima.`}
                  />
                </div>

                <Analise titulo="Ano a ano: quantos conjuntos passaram do limite">
                  <GraficoLinhas
                    titulo={`Conjuntos acima do limite de DEC, ${c.historico[0]?.ano ?? ""} a ${c.ano}`}
                    dados={linhasHistoricoConjuntos(c)}
                    chaveX="ano"
                    formatoX="texto"
                    series={[
                      { id: "pct_acima", rotulo: "% dos conjuntos", sigla: "Conjuntos", cor: "var(--cor-energia)" },
                      { id: "pct_ucs_acima", rotulo: "% das unidades consumidoras nesses conjuntos", sigla: "UCs", cor: "var(--serie-sm-se)" },
                    ]}
                    unidade="%"
                    casas={1}
                    zeroNoEixo
                  />
                  <GraficoLinhas
                    titulo="Razão DEC ÷ limite dos conjuntos: mediana e percentil 90"
                    dados={linhasHistoricoConjuntos(c)}
                    chaveX="ano"
                    formatoX="texto"
                    series={[
                      { id: "razao_p50", rotulo: "Mediana dos conjuntos", sigla: "Mediana", cor: "var(--cor-energia)" },
                      { id: "razao_p90", rotulo: "Percentil 90 dos conjuntos", sigla: "P90", cor: "var(--serie-termica)" },
                    ]}
                    unidade="vezes o limite"
                    casas={3}
                    zeroNoEixo
                    altura={240}
                  />
                </Analise>

                <Analise titulo="Limite apertado ou folgado: faixa do limite × distância a ele">
                  <QualidadeTabela tabela="matriz" titulo={`Conjuntos por faixa de limite de DEC e por razão DEC ÷ limite, ${c.ano}`} linhas={n("matriz")} chaveUrl="tmat" />
                </Analise>

                <Analise titulo="As pontas: os conjuntos mais distantes do limite e os de maior DEC">
                  <QualidadeTabela tabela="cauda-razao" titulo={`Conjuntos com maior razão DEC ÷ limite, ${c.ano}`} linhas={n("cauda-razao")} chaveUrl="tcr" />
                  <QualidadeTabela tabela="cauda-dec" titulo={`Conjuntos com maior DEC, ${c.ano}`} linhas={n("cauda-dec")} chaveUrl="tcd" />
                </Analise>

                <Auditoria titulo="DGC calculado × DGC publicado no ranking da ANEEL">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {g.regras.limite} Tolerância de 0,01, a precisão do DGC publicado. As divergências não foram explicadas caso a caso; as hipóteses, não verificadas, estão em
                    &ldquo;Sobre este dado&rdquo; do ranking da continuidade, no rodapé deste painel, e não são afirmadas aqui.
                  </p>
                  <QualidadeTabela tabela="dgc" titulo="Reconciliação do DGC por ano" linhas={n("dgc")} chaveUrl="tdgc" />
                </Auditoria>
                <Seguir ancora="limites" href="#compensacoes" pergunta="Quando o limite individual é violado, quanto a distribuidora paga? Veja as compensações." />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P053 ---------------- */}
          <Bloco id="compensacoes">
            <PainelEvidencia
              id="p053"
              pergunta="Quais compensações foram pagas?"
              subtitulo="Compensações por violação dos limites individuais de continuidade (DIC, FIC, DMIC, DICRI, DISE) · R$ nominais e quantidade"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Quando a unidade consumidora passa do seu limite individual de duração ou de frequência, a distribuidora deve creditar uma compensação na fatura. É o efeito da
                  continuidade que chega ao bolso do consumidor.
                </>
              }
              oQueMudou={mudancaP053(g)}
              comoInterpretar={
                <>
                  {g.regras.compensacao} As barras somam o que as distribuidoras informaram por competência (o mês de apuração), só para unidades consumidoras, o universo que a ANEEL
                  divulga; unidades geradoras ficam na tabela. Valor por UC é só normalização para comparar distribuidoras de tamanhos diferentes.
                </>
              }
              naoConcluir={
                <>
                  Não se calcula o crédito de um consumidor: ele depende do DIC, FIC e DMIC da própria unidade e do encargo de uso, que não são publicados. A quantidade é de compensações
                  (ocorrências), não de consumidores. A fonte informa a competência, não a data do crédito na fatura. Valores sem correção pela inflação.
                </>
              }
              proveniencia={prov.compensacoes}
            >
              <div className="space-y-6">
                <Resposta
                  id="p053"
                  prova={ev.compensacoes_ano && <ComproveNumero evidencia={ev.compensacoes_ano} rotulo="Comprove o total do ano" endereco="/setor-eletrico/qualidade#compensacoes" />}
                >
                  {respostaP053(g)}
                </Resposta>
                <Recorte
                  periodo={
                    <>
                      Anos completos de {compBarras[0]?.ano ?? comp.ano_referencia} a {comp.ano_referencia}; último mês completo {comp.ultimo_mes_completo ? mesAno(comp.ultimo_mes_completo) : "não informado"}
                    </>
                  }
                  universo={`${distComp} distribuidoras informaram compensações em ${comp.ano_referencia}; unidades consumidoras (UC) e unidades geradoras (UG) separadas`}
                  unidade="R$ nominais da competência (milhões no gráfico) e quantidade de compensações"
                />
                <GraficoBarras
                  titulo={`Compensações pagas a unidades consumidoras por ano, ${compBarras[0]?.ano ?? ""} a ${comp.ano_referencia}`}
                  dados={compBarras}
                  chaveCategoria="ano"
                  series={[{ id: "valor_uc_mi", rotulo: "Valor a unidades consumidoras", cor: "var(--cor-energia)" }]}
                  unidade="R$ milhões"
                  casas={1}
                  altura={300}
                />
                <TabelaInterativa
                  titulo="Compensações por ano: unidades consumidoras e geradoras"
                  colunas={COLUNAS_COMP_ANUAL}
                  linhas={compAnual.map((l) => ({ ...l, id: String(l.ano) }))}
                  chaveLinha="id"
                  colunaRotulo="ano"
                  fonte="ANEEL, compensações por violação de limites de continuidade"
                  versao={comp.ultimo_mes_completo ?? String(comp.ano_referencia)}
                  nomeArquivo="qualidade-compensacoes-anual"
                  chaveUrl="tcomp"
                  ordemInicial={{ coluna: "ano", direcao: "desc" }}
                  nota={`Unidade geradora sem linha na fonte${inicioUg ? ` (antes de ${inicioUg})` : ""} é ausência, não zero. O ano corrente é parcial e fica fora do gráfico.`}
                />

                <Analise titulo="Mês a mês: valor e quantidade separados">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Competência mensal. {g.regras.mes_completo_compensacao}{" "}
                    {compIncompletos.length
                      ? `Ficam fora, com o valor publicado na tabela: ${compIncompletos.map((m) => mesAno(m.m)).join(", ")}.`
                      : "Todos os meses do período estão completos."}{" "}
                    Os dois gráficos compartilham o cursor.
                  </p>
                  <CursorSincronizado>
                    <GraficoLinhas
                      titulo="Valor das compensações por mês (meses completos)"
                      dados={compMensal}
                      chaveX="m"
                      formatoX="mes"
                      series={[{ id: "valor_mi", rotulo: "Valor (UC e UG)", cor: "var(--cor-energia)" }]}
                      unidade="R$ milhões"
                      casas={1}
                      zeroNoEixo
                      altura={220}
                    />
                    <GraficoLinhas
                      titulo="Quantidade de compensações por mês (meses completos)"
                      dados={compMensal}
                      chaveX="m"
                      formatoX="mes"
                      series={[{ id: "quantidade_mil", rotulo: "Compensações (UC e UG)", cor: "var(--serie-sm-se)" }]}
                      unidade="mil compensações"
                      casas={0}
                      zeroNoEixo
                      altura={220}
                    />
                  </CursorSincronizado>
                </Analise>

                <Analise titulo={`Por tipo de violação em ${comp.ano_referencia}`}>
                  <GraficoBarras
                    titulo={`Valor pago a unidades consumidoras por tipo de limite violado, ${comp.ano_referencia}`}
                    dados={linhasTipoAnoReferencia(g)}
                    chaveCategoria="id"
                    chaveRotulo="tipo"
                    series={[{ id: "valor_mi", rotulo: "Valor a unidades consumidoras", cor: "var(--cor-energia)" }]}
                    unidade="R$ milhões"
                    casas={2}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  {notaSemUc && <p className="max-w-prose2 text-sm text-carvao-muted">{notaSemUc}</p>}
                  <QualidadeTabela tabela="comp-tipo" titulo="Valor pago a unidades consumidoras por tipo de violação e ano" linhas={n("comp-tipo")} chaveUrl="tctp" />
                </Analise>

                <Analise titulo={`Distribuição entre as distribuidoras em ${comp.ano_referencia}`}>
                  <Histograma
                    titulo={`Distribuidoras por valor de compensação ÷ unidades consumidoras, ${comp.ano_referencia}`}
                    dados={histValorUc}
                    rotuloX="Valor no ano ÷ UCs médias"
                    unidade="R$ por UC"
                    casas={2}
                    contagem={{ singular: "distribuidora", plural: "distribuidoras" }}
                    periodo={String(comp.ano_referencia)}
                    valorAtual={{ valor: anoComp?.valor_por_uc ?? null, rotulo: "Brasil" }}
                    cor="var(--cor-energia)"
                    nota="Normalização para comparar tamanhos; não é o crédito de cada consumidor."
                  />
                  <QualidadeTabela tabela="comp-dist" titulo={`Compensações por distribuidora, ${comp.ano_referencia}`} linhas={n("comp-dist")} chaveUrl="tcdi" />
                </Analise>

                <Auditoria titulo="Conferência com o total divulgado pela ANEEL">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    A ANEEL divulga o total anual pago a unidades consumidoras na notícia do ranking (bilhões com três casas, milhões de compensações com uma). Diferença fora da precisão
                    fica marcada e não foi explicada; a hipótese de revisão dos envios depois da divulgação não está verificada.
                  </p>
                  <QualidadeTabela tabela="divulgado" titulo="Total de compensações a UCs: soma dos dados abertos × total divulgado" linhas={n("divulgado")} chaveUrl="tdiv" />
                </Auditoria>
                <Seguir ancora="compensacoes" href="#atendimento" pergunta="E o atendimento ao consumidor? Veja reclamações, pesquisa e recuperação da rede." />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P054 ---------------- */}
          <Bloco id="atendimento">
            <PainelEvidencia
              id="p054"
              pergunta="Como o consumidor é atendido e como a rede se recupera?"
              subtitulo="Reclamações por unidade consumidora, IASC com amostra, atendimento telefônico e emergencial, eventos de emergência · escopos separados"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A continuidade mede quanto falta energia; o atendimento mede como a distribuidora responde: quantas reclamações recebe para cada mil unidades, quanto tempo leva para
                  chegar a uma ocorrência e como os consumidores avaliam o serviço.
                </>
              }
              oQueMudou={mudancaP054(g)}
              comoInterpretar={
                <>
                  Cada indicador tem o seu escopo e a sua base, e eles não se somam: reclamações na distribuidora por mil UCs, na Ouvidoria da ANEEL por 100 mil, o IASC é uma pesquisa por
                  amostra e o TMAE uma média de tempos ponderada pelas ocorrências. Taxa só existe em ano com os 12 meses enviados.
                </>
              }
              naoConcluir={
                <>
                  Número de reclamações sem a base de unidades consumidoras não compara distribuidoras. Reclamações dependem dos canais e da prática de registro, e a ligação sobre falta de
                  energia conta como reclamação
                  {rec && rec.por_ucs !== null && rec.interrupcao_por_mil_uc !== null
                    ? ` (${num(rec.interrupcao_por_mil_uc, 1)} das ${num(rec.por_ucs, 1)} por mil UCs em ${ref})`
                    : ""}
                  : a taxa inclui as ligações sobre interrupção e não mede só insatisfação com o atendimento. O IASC tem margem de erro amostral e não é publicado com intervalo. A base de
                  eventos de emergência começa em {evt.inicio_min ? mesAno(evt.inicio_min.slice(0, 7)) : "data não publicada"}: não há série anterior para comparar.
                </>
              }
              proveniencia={prov.reclamacoes}
              complementares={[
                { rotulo: "Ouvidoria Setorial da ANEEL", p: prov.ouvidoria_aneel },
                { rotulo: "IASC (pesquisa amostral)", p: prov.iasc },
                { rotulo: "Atendimento emergencial (TMAE)", p: prov.atendimento_emergencial },
                { rotulo: "Atendimento telefônico", p: prov.telefonico },
                { rotulo: "Eventos em situação de emergência", p: prov.eventos },
              ]}
            >
              <div className="space-y-6">
                <Resposta id="p054">{respostaP054(g)}</Resposta>
                <Recorte
                  periodo={
                    <>
                      Reclamações de {at.reclamacoes_distribuidora[0]?.ano ?? ref} a {ref}
                      {recParcial ? ` (${recParcial.ano} sem taxa: ano parcial)` : ""}; IASC de {at.iasc.ano ?? "ano não publicado"}; telefônico desde {at.telefonico.anual[0]?.ano ?? ref}
                    </>
                  }
                  universo={
                    <>
                      {rec ? `${rec.distribuidoras} distribuidoras com os 12 meses enviados (${pctCobertura(rec.cobertura_ucs)} das UCs)` : "sem universo no ano"}; IASC com{" "}
                      {num(at.iasc.entrevistas, 0)} entrevistas
                    </>
                  }
                  unidade="reclamações por mil UCs (distribuidora) e por 100 mil UCs (Ouvidoria); índice de 0 a 100; minutos; % dos meses no padrão"
                />
                <section aria-label="Números de atendimento" className="grid gap-4 sm:grid-cols-2">
                  <Numero
                    rotulo={`Reclamações na distribuidora, ${ref}`}
                    natureza="CALCULADO"
                    evidencia={ev.reclamacoes_distribuidora ?? null}
                    valor={rec?.por_ucs ?? null}
                    casas={1}
                    unidade="por mil UCs"
                    motivoAusencia={rec?.motivo_ausencia ?? "Sem distribuidora com os 12 meses enviados."}
                    nota="Base: unidades consumidoras médias das mesmas distribuidoras."
                    tamanho="medio"
                    endereco="/setor-eletrico/qualidade#atendimento"
                  />
                  <Numero
                    rotulo={`Reclamações na Ouvidoria da ANEEL, ${ref}`}
                    natureza="CALCULADO"
                    evidencia={ev.ouvidoria_aneel ?? null}
                    casas={1}
                    unidade="por 100 mil UCs"
                    motivoAusencia="Arquivo da Ouvidoria sem os 12 meses do ano."
                    nota="Segunda instância, depois do atendimento na distribuidora."
                    tamanho="medio"
                    endereco="/setor-eletrico/qualidade#atendimento"
                  />
                </section>
                <GraficoBarras
                  titulo="Reclamações registradas pelas distribuidoras por mil unidades consumidoras"
                  dados={linhasReclamacoesNacional(g)}
                  chaveCategoria="ano"
                  series={[
                    { id: "total", rotulo: "Todas as reclamações (1º nível)", cor: "var(--cor-energia)" },
                    { id: "interrupcao", rotulo: "Sobre interrupção (1º nível)", cor: "var(--serie-termica)" },
                  ]}
                  unidade="por mil UCs"
                  casas={1}
                  altura={280}
                />
                {recParcial && (
                  <p className="text-sm text-carvao-muted">
                    {recParcial.ano}: barra hachurada é ausência, não zero ({recParcial.motivo_ausencia}).
                  </p>
                )}
                <div className="space-y-3 border-t border-linha pt-5">
                  <h3 className="font-serif text-lg text-carvao">O que dizem os consumidores entrevistados (IASC {at.iasc.ano ?? ""})</h3>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Pesquisa anual por amostra: {num(at.iasc.entrevistas, 0)} entrevistas em {at.iasc.distribuidoras} distribuidoras (a amostra de cada uma está na tabela de atendimento).
                    Resultado estimado; a ANEEL não publica margem de erro por distribuidora.
                  </p>
                  <Histograma
                    titulo={`Distribuidoras por IASC, ${at.iasc.ano ?? ""}`}
                    dados={histIasc}
                    rotuloX="IASC (escala de 0 a 100)"
                    unidade="pontos"
                    casas={1}
                    contagem={{ singular: "distribuidora", plural: "distribuidoras" }}
                    periodo={String(at.iasc.ano ?? "")}
                    cor="var(--cor-energia)"
                    nota="Índice estimado por pesquisa amostral; cada distribuidora tem a sua amostra."
                  />
                </div>

                <Analise titulo="Indicadores de atendimento, cada um com o seu escopo">
                  <QualidadeTabela tabela="escopos" titulo="Indicadores nacionais de atendimento por ano" linhas={n("escopos")} chaveUrl="tesc" />
                  <GraficoBarras
                    titulo="Reclamações na Ouvidoria Setorial da ANEEL por 100 mil unidades consumidoras"
                    dados={linhasOuvidoriaNacional(g)}
                    chaveCategoria="ano"
                    series={[
                      { id: "total", rotulo: "Todas", cor: "var(--cor-energia)" },
                      { id: "procedentes", rotulo: "Procedentes", cor: "var(--serie-sm-se)" },
                    ]}
                    unidade="por 100 mil UCs"
                    casas={1}
                    altura={260}
                  />
                  {ouvParcial.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      {ouvParcial
                        .map((o) =>
                          o.motivo_ausencia
                            ? `${o.ano}: barra hachurada é ausência, não zero (${o.motivo_ausencia})`
                            : `${o.ano}: barra hachurada é ausência, não zero (${
                                o.meses_max !== null ? `até ${o.meses_max} ${o.meses_max === 1 ? "mês publicado" : "meses publicados"} no arquivo do ano` : "ano incompleto no arquivo"
                              }: sem taxa anual; a contagem parcial está na tabela de indicadores nacionais)`,
                        )
                        .join("; ")}
                      .
                    </p>
                  )}
                </Analise>

                <Analise titulo="Atendimento telefônico das distribuidoras obrigadas">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Só as distribuidoras com central obrigatória ({tel ? `${tel.distribuidoras} em ${ref}, ${pctCobertura(tel.cobertura_ucs)} das UCs` : "universo do ano não publicado"}).
                    Padrões: INS de ao menos {num(at.telefonico.padroes.ins_min_pct, 0)}%, IAb de até {num(at.telefonico.padroes.iab_max_pct, 0)}% e ICO de até{" "}
                    {num(at.telefonico.padroes.ico_max_pct, 0)}%. INS e IAb não se agregam (a fonte não publica os numeradores): o gráfico conta os meses dentro do padrão.
                  </p>
                  <GraficoLinhas
                    titulo="Distribuidora-meses dentro do padrão, por indicador"
                    dados={linhasTelefonico(g)}
                    chaveX="ano"
                    formatoX="texto"
                    series={[
                      { id: "ins", rotulo: "INS (nível de serviço)", sigla: "INS", cor: "var(--cor-energia)" },
                      { id: "iab", rotulo: "IAb (abandono)", sigla: "IAb", cor: "var(--serie-termica)" },
                      { id: "ico", rotulo: "ICO (chamadas ocupadas)", sigla: "ICO", cor: "var(--serie-sm-se)" },
                    ]}
                    unidade="%"
                    casas={1}
                    legendaInterativa
                    marcos={at.telefonico.anual.filter((t) => !t.completo).map((t) => ({ x: String(t.ano), rotulo: `${t.ano}: ${t.meses} meses` }))}
                  />
                </Analise>

                <Analise titulo="Recuperação da rede: emergências e dias críticos">
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Parcelas do DEC nacional em situação de emergência e em dia crítico (as horas que a regra tira do apurado). {evt.total} eventos em situação de emergência foram declarados
                    por {evt.distribuidoras} distribuidoras de {evt.inicio_min ? dataBR(evt.inicio_min.slice(0, 10)) : "data não publicada"} a{" "}
                    {evt.inicio_max ? dataBR(evt.inicio_max.slice(0, 10)) : "data não publicada"}; duração mediana de {num(evt.duracao_mediana_h, 0)} h e máxima de{" "}
                    {num(evt.duracao_max_h, 0)} h, entre os eventos com datas válidas.
                  </p>
                  <GraficoBarras
                    titulo="DEC do Brasil em situação de emergência e em dia crítico"
                    dados={linhasResiliencia(g)}
                    chaveCategoria="ano"
                    series={[
                      { id: "emergencia", rotulo: "Situação de emergência", cor: COR_PARCELA.emergencia },
                      { id: "dia_critico", rotulo: "Dia crítico", cor: COR_PARCELA.dia_critico },
                    ]}
                    unidade="h"
                    casas={2}
                    empilhado
                    altura={280}
                  />
                  <QualidadeTabela tabela="eventos" titulo="Eventos em situação de emergência com maior CHI" linhas={n("eventos")} chaveUrl="tevt" />
                  {evt.datas_invalidas.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      Datas mantidas como publicadas, sem duração: {evt.datas_invalidas.map((d) => datasLegiveis(`${d.sigla ?? "distribuidora não identificada"}, evento ${d.codigo} (${d.motivo})`)).join("; ")}.
                    </p>
                  )}
                </Analise>

                <Analise titulo={`Atendimento por distribuidora, ${ref}`}>
                  <QualidadeTabela tabela="atendimento" titulo={`Reclamações, IASC, TMAE e atendimento telefônico por distribuidora, ${ref}`} linhas={n("atendimento")} chaveUrl="tat" />
                </Analise>

                <Auditoria titulo="Quem ficou fora de cada universo">
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {at.reclamacoes_distribuidora
                      .filter((r) => r.fora_meses_incompletos.length)
                      .map((r) => (
                        <li key={r.ano}>
                          <strong className="font-medium text-carvao">Reclamações {r.ano}:</strong> fora por não terem os 12 meses enviados:{" "}
                          {r.fora_meses_incompletos.map((x) => `${x.sigla ?? `CNPJ ${x.cnpj}`} (${x.meses} meses)`).join(", ")}.
                        </li>
                      ))}
                    {at.iasc.sem_continuidade_no_ano.length > 0 && (
                      <li>
                        <strong className="font-medium text-carvao">IASC sem continuidade no ano:</strong>{" "}
                        {at.iasc.sem_continuidade_no_ano.map((x) => `${x.sigla ?? x.nome_iasc ?? `CNPJ ${x.cnpj}`} (IASC ${num(x.iasc, 2)}, ${num(x.amostra, 0)} entrevistas)`).join(", ")}.
                      </li>
                    )}
                    <li>
                      <strong className="font-medium text-carvao">Anos do IASC publicados:</strong> {at.iasc.anos_disponiveis.join(", ")}.
                    </li>
                  </ul>
                </Auditoria>
                <Seguir ancora="atendimento" href="/setor-eletrico/conta-de-luz" pergunta="Quanto essas distribuidoras cobram? Veja a conta de luz." />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- Auditoria do módulo ---------------- */}
          <Bloco id="auditoria-qualidade" nivel="auditar">
            <section aria-labelledby="auditoria-qualidade-titulo" className="space-y-4 border border-linha bg-superficie p-5 md:p-8">
              <h2 id="auditoria-qualidade-titulo" className="font-serif text-xl text-carvao">
                Controles executados nesta publicação e arquivos de origem
              </h2>
              <p className="max-w-prose2 text-sm text-carvao-muted">
                Cada controle roda antes de qualquer arquivo ser escrito; reprovação crítica impede a publicação e mantém a anterior. Ressalva não descarta dado: o valor fica como a fonte
                publicou e o caso fica listado.
              </p>
              <QualidadeTabela tabela="validacao" titulo="Controles de validação" linhas={n("validacao")} chaveUrl="tval" />
              <QualidadeTabela tabela="arquivos" titulo="Arquivos importados (bronze com sha256)" linhas={n("arquivos")} chaveUrl="tarq" />
              {g.mapa.correspondencia.codigos_sem_ibge.length > 0 && (
                <p className="text-sm text-carvao-muted">
                  Códigos da base IndQual Município fora do cadastro do IBGE, fora do mapa:{" "}
                  {g.mapa.correspondencia.codigos_sem_ibge
                    .map((x) => `${x.codigo} (${x.conjuntos_ativos} conjuntos ativos${x.dec_min !== null ? `, DEC de ${num(x.dec_min, 2)} a ${num(x.dec_max, 2)} h` : ""})`)
                    .join("; ")}
                  . Municípios do IBGE sem relação na base:{" "}
                  {g.mapa.correspondencia.ibge_sem_relacao.map((x) => `${x.nome ?? x.codigo} (${x.uf ?? "UF não informada"})`).join(", ") || "nenhum"}.
                </p>
              )}
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {g.downloads.map((d) => (
                  <li key={d.url}>
                    <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                      {d.rotulo} ({tamanho(d.url)})
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-carvao-muted">
                Reprodução: <code className="break-all text-xs">python3 pipeline/energia/executar_modulo.py qualidade --sem-coleta</code>. Regras gerais em{" "}
                <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
                  metodologia
                </Link>
                ; fórmulas, fontes verificadas e conferências deste módulo no documento{" "}
                <code className="break-all text-xs">docs/observatorios/energia/modulos/qualidade.md</code> do{" "}
                <a href="https://github.com/genarolins1975/scrutiniums/tree/main/docs/observatorios" target="_blank" rel="noopener noreferrer" className="text-energia-dark underline underline-offset-4">
                  repositório público do projeto ↗
                </a>
                .
              </p>
            </section>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
