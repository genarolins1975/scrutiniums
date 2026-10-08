import type { Metadata } from "next";
import { DataDaFonte } from "@/components/energia/TextoEnergia";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoCompararAnos, TransicaoFatorMensal } from "@/components/energia/TransicaoEmissoes";
import {
  TransicaoAnalise,
  TransicaoAuditoria,
  TransicaoAviso,
  TransicaoDocumento,
  TransicaoIndisponivel,
  TransicaoNavegacao,
  TransicaoRecorte,
  TransicaoSeguir,
  TransicaoTabela,
} from "@/components/energia/TransicaoPagina";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_FATOR_ANUAL,
  COLUNAS_FATOR_MENSAL,
  FONTE_MCTI,
  LIGACAO_GERACAO,
  anosDoFatorMensal,
  dadosFatorAnual,
  dadosFatorMensal,
  dadosMargemOperacao,
  dadosMdlAnual,
  data,
  estadoAcessoMcti,
  fator,
  inteiro,
  linhasFatorAnual,
  linhasFatorMensal,
  mes,
  mudancaEmissoes,
  numTexto,
  pctTexto,
  perguntaPainel,
  referenciaAnual,
  respostaEmissoes,
  rotaPainel,
} from "@/lib/energia/transicao";
import type { GoldTransicao } from "@/lib/energia/tipos-transicao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Emissões: como varia a intensidade de CO2 da geração no SIN",
  description:
    "Fator médio de emissão de CO2 do SIN publicado pelo MCTI, mensal e anual, com a quebra de base declarada pela fonte, comparação de anos mês a mês, os fatores do MDL em séries separadas e as revisões e divergências registradas na leitura das planilhas.",
  alternates: { canonical: "/setor-eletrico/transicao/emissoes" },
};

/**
 * P064, emissões: o fator médio oficial do MCTI (inventários), mensal e anual, sem
 * cálculo da plataforma; os fatores do MDL em séries separadas e rotuladas; a
 * quebra de jan/2025 declarada pela fonte; e, no modo Auditar, revisões,
 * divergências e descartes da leitura das planilhas. Nenhuma intensidade horária ou
 * municipal: a fonte não publica, e nada é derivado do fator nacional mensal.
 */
export default function EmissoesPage() {
  const g = lerGold<GoldTransicao>("transicao.json");
  if (!integra(g)) return <TransicaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;
  const e = g.emissoes;
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));

  if (!e) {
    return (
      <>
        <CabecalhoEnergia atual="transicao" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
          <CabecalhoModulo rotulo="Transição e ambiente" titulo="Intensidade de emissões da geração no SIN" />
          <TransicaoNavegacao atual="p064" />
          <div className="py-6">
            <Indisponivel
              titulo="Fatores de emissão do MCTI ausentes nesta publicação"
              motivo={`O bloco de emissões não foi montado nesta execução (${g.pendencias.join(" ") || "sem motivo registrado"}). Nenhum fator é estimado no lugar do oficial; a última publicação válida é mantida pela sentinela quando existe.`}
            />
          </div>
        </main>
      </>
    );
  }

  const acesso = estadoAcessoMcti(e.acesso);
  const quebra = e.quebras[0] ?? null;
  const anual = linhasFatorAnual(e);
  const anos = anosDoFatorMensal(e);
  const padraoAnos = anos.slice(-3);
  const primeiroMes = e.medio_mensal[0]?.m ?? null;
  const docFatorMedio = e.documentos.find((d) => /Fator médio/i.test(d.titulo)) ?? null;
  const docMargem = e.documentos.find((d) => /Margem de operação/i.test(d.titulo)) ?? null;

  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <MarcaVisita secao="energia:transicao-emissoes" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Transição e ambiente"
          titulo="Intensidade de emissões da geração no SIN"
          referencia={
            <>
              Fator médio do MCTI de {mes(primeiroMes)} a {mes(e.ultimo_mes?.m)} (mensal) e de {e.medio_anual[0]?.ano ?? "sem dado"} a {e.ultimo_ano?.ano ?? "sem dado"} (anual), planilha{" "}
              {e.ultimo_mes?.arquivo ?? "sem dado"}; listagem da página do MCTI capturada em {carimbo(e.pagina_vigente?.listagem_capturada_em)}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quantas toneladas de CO2 a geração do SIN emite, em média, por MWh, mês a mês e ano a ano, como o MCTI publica. O fator médio serve a inventários e não é o efeito de consumir ou
          economizar um MWh a mais.
        </CabecalhoModulo>
        <TransicaoNavegacao atual="p064" />
        <ModoProfundidade>
          <Bloco id="emissoes">
            <PainelEvidencia
              id="p064"
              pergunta={perguntaPainel("p064")}
              subtitulo="Fator médio de emissão de CO2 do SIN (inventários, MCTI) · tCO2/MWh"
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  O <Termo slug="fator-de-emissao">fator médio de emissão</Termo> diz quanto CO2 a geração do SIN emitiu por MWh no período. É o número que empresas e governos usam para contabilizar as emissões da eletricidade
                  que consomem. Como é a média de todas as usinas em operação, muda com a composição da geração de cada mês.
                </>
              }
              oQueMudou={mudancaEmissoes(e)}
              comoInterpretar={
                <>
                  Fator médio = emissões de CO2 da geração despachada no SIN ÷ energia gerada no SIN, calculado e publicado pelo MCTI; a plataforma não recalcula nada. O anual é
                  publicado pela fonte e fica perto da média dos meses (controle na coluna &ldquo;Anual × meses&rdquo; da tabela anual). {g.regras.fator_medio_nao_marginal}
                </>
              }
              naoConcluir={
                <>
                  O efeito de consumir ou economizar um MWh a mais (o fator médio não é marginal); emissões em CO2 equivalente ou de ciclo de vida (só CO2 da operação); intensidade
                  por hora, por município ou por distribuidora: {g.regras.sem_intensidade_local.charAt(0).toLowerCase() + g.regras.sem_intensidade_local.slice(1)}
                  {quebra ? ` Comparações que atravessam ${mes(quebra.data)} misturam bases de usinas diferentes.` : ""}
                </>
              }
              proveniencia={e.proveniencia.medio}
              complementares={[{ rotulo: "Fatores do MDL (margens)", p: e.proveniencia.mdl }]}
            >
              <div className="space-y-6">
                {acesso.defasada && (
                  <TransicaoAviso rotulo="Fonte possivelmente defasada" alerta>
                    {acesso.texto}
                  </TransicaoAviso>
                )}
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p064">
                  {respostaEmissoes(e)}
                </p>
                <TransicaoRecorte
                  periodo={
                    <>
                      Mensal de {mes(primeiroMes)} a {mes(e.ultimo_mes?.m)}; anual de {e.medio_anual[0]?.ano ?? "sem dado"} a {e.ultimo_ano?.ano ?? "sem dado"} (o ano corrente não tem
                      fator anual)
                    </>
                  }
                  universo="Geração despachada no SIN (sistemas isolados e geração fora do despacho do ONS ficam fora)"
                  unidade={`${e.unidade}, ${e.gas}: não é CO2 equivalente`}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Numero
                    rotulo={`Fator médio anual de ${e.ultimo_ano?.ano ?? "sem dado"}`}
                    natureza="ESTIMADO"
                    evidencia={e.evidencia}
                    casas={4}
                    unidade="tCO2/MWh"
                    tamanho="medio"
                    cor="var(--serie-termica)"
                    motivoAusencia="Nenhum ano completo publicado nesta versão."
                    nota="Estimado e publicado pelo MCTI, sem alteração."
                    endereco={`${rotaPainel("p064")}#p064`}
                  />
                  <Numero
                    rotulo={`Fator médio do último mês publicado (${mes(e.ultimo_mes?.m)})`}
                    natureza="ESTIMADO"
                    evidencia={e.evidencia_mensal}
                    casas={4}
                    unidade="tCO2/MWh"
                    tamanho="medio"
                    motivoAusencia="Nenhum mês publicado nesta versão."
                    nota="Um mês isolado não equivale ao fator anual; compare com o mesmo mês de outros anos."
                    endereco={`${rotaPainel("p064")}#p064`}
                  />
                </div>
                <TransicaoAviso rotulo="Fator médio, não marginal">
                  {docFatorMedio ? `Nas palavras do MCTI: "${docFatorMedio.trecho}" ` : ""}
                  Para o efeito de uma decisão de consumo, o fator relevante seria marginal, e os fatores de margem do MCTI são de uso exclusivo em projetos de MDL.
                </TransicaoAviso>
                {!acesso.defasada && <p className="text-xs text-carvao-muted">{acesso.texto}</p>}

                <TransicaoFatorMensal
                  dados={dadosFatorMensal(e)}
                  marcos={quebra ? [{ x: quebra.data, rotulo: "Base de usinas ampliada (MCTI)" }] : []}
                />
                <GraficoBarras
                  titulo="Fator médio anual de emissão de CO2 do SIN"
                  dados={dadosFatorAnual(e)}
                  chaveCategoria="id"
                  chaveRotulo="rotulo"
                  series={[{ id: "medio", rotulo: "Fator médio anual", cor: "var(--serie-termica)" }]}
                  unidade="tCO2/MWh"
                  casas={4}
                  referencias={referenciaAnual(e)}
                  altura={300}
                />
                {quebra && (
                  <TransicaoAviso rotulo={`Quebra de ${mes(quebra.data)}`}>
                    {quebra.descricao}
                    {quebra.no_dado ? ` No dado: ${quebra.no_dado.descricao}, ${numTexto(quebra.no_dado.energia_2024_mwh, 0)} MWh no ano anterior e ${numTexto(quebra.no_dado.energia_2025_mwh, 0)} MWh no ano da quebra (${pctTexto(quebra.no_dado.variacao_pct, 1)}).` : ""}
                  </TransicaoAviso>
                )}
                <TabelaInterativa
                  titulo="Fator médio anual e fatores do MDL por ano"
                  colunas={COLUNAS_FATOR_ANUAL}
                  linhas={anual}
                  chaveLinha="id"
                  colunaRotulo="ano"
                  fonte={FONTE_MCTI}
                  versao={e.ultimo_mes?.m ?? g.gerado_em.slice(0, 10)}
                  nomeArquivo="transicao-mcti-fatores-anuais"
                  chaveUrl="em.tab"
                  ordemInicial={{ coluna: "ano", direcao: "desc" }}
                  dicaBusca="Ano"
                  nota={`Valores como o MCTI publica, com 4 casas. As colunas do MDL servem só a projetos de MDL e não substituem o fator médio. O controle compara o anual publicado com a média simples dos 12 meses${e.evidencia?.reconciliacao?.tolerancia ? ` (tolerância de ${e.evidencia.reconciliacao.tolerancia})` : ""}.`}
                />

                <TransicaoAnalise titulo="Mês a mês: compare até quatro anos">
                  <TransicaoCompararAnos medioMensal={e.medio_mensal} anos={anos} padrao={padraoAnos} />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Mesma escala para todos os anos escolhidos. Mês ainda não publicado fica em branco, nunca em zero.
                    {quebra ? ` Anos a partir de ${quebra.data.slice(0, 4)} estão na base ampliada de usinas.` : ""}
                  </p>
                  <TabelaInterativa
                    titulo="Fator médio mensal"
                    colunas={COLUNAS_FATOR_MENSAL}
                    linhas={linhasFatorMensal(e)}
                    chaveLinha="id"
                    colunaRotulo="m"
                    fonte={FONTE_MCTI}
                    versao={e.ultimo_mes?.m ?? g.gerado_em.slice(0, 10)}
                    nomeArquivo="transicao-mcti-fator-medio-mensal"
                    chaveUrl="em.mtab"
                    ordemInicial={{ coluna: "m", direcao: "desc" }}
                    dicaBusca="Mês (08/2025) ou ano"
                  />
                </TransicaoAnalise>

                <TransicaoAnalise titulo="Fatores do MDL: outra pergunta, outra série">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    As margens de operação e de construção estimam a emissão deslocada na margem do sistema, para calcular reduções de emissões de projetos de MDL. Ficam em séries
                    separadas e não substituem o fator médio.
                  </p>
                  {docMargem && <TransicaoDocumento doc={docMargem} />}
                  <GraficoLinhas
                    titulo="Margem de operação pela análise de despacho (MDL), por mês"
                    dados={dadosMargemOperacao(e)}
                    chaveX="m"
                    formatoX="mes"
                    series={[{ id: "om", rotulo: "Margem de operação (despacho)", sigla: "Margem de operação", cor: "var(--serie-3)" }]}
                    unidade="tCO2/MWh"
                    casas={4}
                    zeroNoEixo
                    zoom
                    marcos={quebra ? [{ x: quebra.data, rotulo: "Base de usinas ampliada (MCTI)" }] : []}
                    altura={260}
                    sincronizarCursor={false}
                  />
                  <GraficoLinhas
                    titulo="Margem de construção e margem de operação pelo método simples ajustado (MDL), por ano"
                    dados={dadosMdlAnual(e)}
                    chaveX="ano"
                    formatoX="texto"
                    series={[
                      { id: "bm", rotulo: "Margem de construção", sigla: "Construção", cor: "var(--serie-4)" },
                      { id: "sa", rotulo: "Margem de operação, simples ajustado", sigla: "Simples ajustado", cor: "var(--serie-5)", tracejada: true },
                    ]}
                    unidade="tCO2/MWh"
                    casas={4}
                    zeroNoEixo
                    altura={260}
                    sincronizarCursor={false}
                  />
                </TransicaoAnalise>

                <TransicaoAnalise titulo="Por que não há intensidade horária, municipal nem estimativa própria">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {g.regras.sem_intensidade_local} {e.estimativa_propria.publicada ? "" : e.estimativa_propria.motivo}
                  </p>
                </TransicaoAnalise>

                <TransicaoAuditoria titulo="Quebra, revisões e divergências da fonte">
                  {quebra && <TransicaoDocumento doc={quebra.documento} />}
                  <TabelaInterativa
                    titulo="Revisões declaradas pela fonte (valor anterior e corrigido)"
                    colunas={[
                      { id: "serie", rotulo: "Série", tipo: "texto", categorica: true },
                      { id: "periodo", rotulo: "Período", tipo: "texto" },
                      { id: "anterior", rotulo: "Publicação anterior", tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
                      { id: "atual", rotulo: "Publicação corrigida", tipo: "numero", unidade: "tCO2/MWh", casas: 4 },
                      { id: "arquivo", rotulo: "Planilha", tipo: "texto", categorica: true },
                    ]}
                    linhas={e.revisoes_declaradas_pela_fonte.map((x, i) => ({ id: `${x.serie}-${x.periodo}-${i}`, serie: x.serie.replace(/_/g, " "), periodo: x.periodo, anterior: x.anterior, atual: x.atual, arquivo: x.arquivo }))}
                    chaveLinha="id"
                    colunaRotulo="periodo"
                    fonte={FONTE_MCTI}
                    versao={e.ultimo_mes?.m ?? g.gerado_em.slice(0, 10)}
                    nomeArquivo="transicao-mcti-revisoes"
                    chaveUrl="em.rev"
                    ordemInicial={{ coluna: "periodo", direcao: "desc" }}
                    dicaBusca="Período ou planilha"
                    semLinhas="A fonte não declarou revisões nas planilhas lidas."
                  />
                  <TransicaoTabela
                    titulo="Mesmo período com valor diferente na página vigente e no site anterior do MCTI (vale a vigente)"
                    colunas={["Série", "Período", "Página vigente", "Site anterior"]}
                    numericas={[2, 3]}
                    linhas={e.divergencias_entre_publicacoes.map((x) => [x.rotulo, x.periodo, fator(x.valor_vigente), fator(x.valor_site_anterior)])}
                  />
                  {e.conflitos_entre_arquivos.length > 0 ? (
                    <TransicaoTabela
                      titulo="Arquivos da mesma origem com valores diferentes (vale o mais recente)"
                      colunas={["Série", "Período", "Valores", "Vigente"]}
                      linhas={e.conflitos_entre_arquivos.map((x) => [x.rotulo, x.periodo, x.valores.map((v) => `${v.recurso}: ${fator(v.valor)}`).join("; "), x.recurso_vigente])}
                    />
                  ) : (
                    <p className="text-sm text-carvao-muted">Nenhum conflito entre arquivos da mesma origem nesta leitura.</p>
                  )}
                  <TransicaoTabela
                    titulo="Valores descartados na leitura"
                    colunas={["Data na planilha", "Valor", "Motivo", "Planilha"]}
                    numericas={[1]}
                    linhas={e.descartes.map((x) => [<DataDaFonte key={`${x.arquivo}-${x.data}`} valor={x.data} classe="data-planilha-inexistente" origem={e.acesso.url} />, fator(x.valor), x.motivo, x.arquivo])}
                  />
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {e.problemas_de_leitura.map((x) => (
                      <li key={x.texto}>
                        {x.texto} ({x.arquivo})
                      </li>
                    ))}
                  </ul>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Consistência interna: {e.consistencia_diaria_mensal.descricao}; {inteiro(e.consistencia_diaria_mensal.meses_comparados)} meses, maior diferença de{" "}
                    {fator(e.consistencia_diaria_mensal.maior_diferenca_absoluta)} tCO2/MWh em {mes(e.consistencia_diaria_mensal.mes_da_maior_diferenca)}. É um controle de leitura das
                    planilhas, não um recálculo do MCTI: a diferença fica registrada sem ajuste e sem causa atribuída, e nenhum dos dois valores é alterado.
                  </p>
                </TransicaoAuditoria>

                <TransicaoAuditoria titulo="Acesso à fonte e planilhas lidas">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {acesso.texto} Origens dos valores: {e.acesso.familias_usadas.join(", ") || "sem registro"}. Alternativa registrada: {e.acesso.alternativa}.{" "}
                    {e.acesso.bloqueios_registrados.length
                      ? `Bloqueios registrados: ${e.acesso.bloqueios_registrados.map((b) => `${carimbo(b.tentado_em)} (${b.detalhe})`).join("; ")}.`
                      : "Nenhum bloqueio registrado nas tentativas guardadas."}
                  </p>
                  {e.pagina_vigente && (
                    <>
                      <TransicaoTabela
                        titulo={`Planilhas visíveis na página vigente (listagem de ${data(e.pagina_vigente.listagem_capturada_em)})`}
                        colunas={["Título na página", "Arquivo"]}
                        linhas={e.pagina_vigente.planilhas.map((p) => [
                          p.titulo ?? "sem título",
                          <a key={p.url} href={p.url} className="break-all text-energia-dark underline underline-offset-4 hover:text-carvao">
                            {p.arquivo}
                          </a>,
                        ])}
                      />
                      {e.pagina_vigente.links_ocultos_ignorados.length > 0 && (
                        <p className="max-w-prose2 text-sm text-carvao-muted">
                          Âncoras sem texto, invisíveis ao leitor, ignoradas: {e.pagina_vigente.links_ocultos_ignorados.join(", ")}.
                        </p>
                      )}
                    </>
                  )}
                  {e.notas_da_fonte.length > 0 && (
                    <details className="text-sm">
                      <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
                        Notas da fonte nas planilhas ({e.notas_da_fonte.length})
                      </summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-carvao-muted">
                        {e.notas_da_fonte.map((x, i) => (
                          <li key={i}>
                            {x.texto} ({x.arquivo})
                          </li>
                        ))}
                        {e.notas_margem_construcao.map((x, i) => (
                          <li key={`bm-${i}`}>
                            {x.texto} ({x.arquivo})
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </TransicaoAuditoria>

                <TransicaoSeguir
                  ancora="p064"
                  href={LIGACAO_GERACAO.href}
                  pergunta={LIGACAO_GERACAO.pergunta}
                  downloads={downloads(["/energia/series/transicao_mcti_fatores.csv", "/energia/series/transicao_mcti_om_diario.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
