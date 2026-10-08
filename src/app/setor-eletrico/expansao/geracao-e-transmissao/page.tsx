import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { ExpansaoMapaRede } from "@/components/energia/ExpansaoMapas";
import {
  ExpansaoAnalise,
  ExpansaoAuditoria,
  ExpansaoAusencia,
  ExpansaoIndisponivel,
  ExpansaoLimitacoes,
  ExpansaoNavegacao,
  ExpansaoNota,
  ExpansaoRecorte,
  ExpansaoSeguir,
  ExpansaoSubtitulo,
  ExpansaoTabelaSimples,
  tamanhoPublicado,
} from "@/components/energia/ExpansaoPagina";
import { ExpansaoGeracaoRedeUf } from "@/components/energia/ExpansaoTransmissao";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_CONTRATOS_ANO,
  COLUNAS_CONTRATOS_RECENTES,
  COLUNAS_DESVIO_OBRAS,
  COLUNAS_LEILOES,
  COLUNAS_OBRAS_SITUACAO,
  COLUNAS_PRAZOS_VENCIDOS,
  COLUNAS_REDE_TENSAO,
  DOWNLOADS_PAINEL,
  FONTE_EPE_REDE,
  FONTE_LEILOES,
  FONTE_LIBERACOES,
  FONTE_RALIE,
  FONTE_SIGET,
  dadosSerieKm,
  dadosSerieMva,
  dadosSerieMw,
  dataTexto,
  diasTexto,
  downloadsDe,
  inteiro,
  kmTexto,
  linhasContratosAno,
  linhasContratosRecentes,
  linhasDesvioObras,
  linhasGeracaoRedeUf,
  linhasLeiloes,
  linhasObrasSituacao,
  linhasPrazosVencidos,
  linhasRedeTensao,
  mudancaTransmissao,
  mvaTexto,
  painel,
  respostaTransmissao,
  vereditoTransmissao,
} from "@/lib/energia/expansao";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Geração e transmissão: a expansão vem acompanhada de rede?",
  description:
    "Geração em implantação (RALIE) e obras de transmissão (SIGET) por UF lado a lado, linhas existentes e planejadas da EPE no mapa, leilões de transmissão, contratos de concessão e a série anual de MW liberados, km e MVA energizados, sem somar unidades diferentes.",
  alternates: { canonical: "/setor-eletrico/expansao/geracao-e-transmissao" },
};

const URL_REDE = "/energia/series/expansao_rede_epe.json";

export default function GeracaoTransmissaoPage() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  if (!integra(g)) return <ExpansaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const t = g.transmissao;
  const o = t.obras;
  const l = t.leiloes;
  const ca = t.contratos_assinados;
  const rede = t.rede_epe;
  const p = g.proveniencia;
  const ev = g.evidencias;
  const pp = painel("p042");
  const serie = [...t.serie_anual].sort((a, b) => a.ano.localeCompare(b.ano));
  const capturaEpe = dataTexto(g.referencias.rede_epe_capturada_em);
  const marcosParciais = serie.filter((x) => x.ano_parcial).map((x) => ({ x: x.ano, rotulo: "ano parcial" }));
  const complementares = [
    { rotulo: "Leilões de transmissão", p: p.leiloes },
    { rotulo: "Contratos de concessão", p: p.contratos_transmissao },
    ...(p.rede_epe ? [{ rotulo: "Rede da EPE", p: p.rede_epe }] : []),
    { rotulo: "Geração em implantação", p: p.ralie },
  ];

  return (
    <>
      <CabecalhoEnergia atual="expansao" />
      <MarcaVisita secao="energia:expansao-geracao-e-transmissao" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["RALIE", "RAP", "ANEEL", "EPE", "IBGE", "ONS"]}
          rotulo="Expansão"
          titulo="Geração e transmissão"
          referencia={
            <>
              SIGET da ANEEL de {dataTexto(o.data_referencia)}; RALIE de {dataTexto(g.estagios.ralie.data_ralie)}; leilões de transmissão de {dataTexto(l.periodo.inicio)} a {dataTexto(l.periodo.fim)}{" "}
              (arquivo publicado em {dataTexto(l.publicado_em)}); linhas da EPE capturadas em {capturaEpe}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Onde a geração está sendo construída e onde a rede está sendo ampliada, lado a lado, por UF e por ano. MW, km e MVA ficam em painéis separados: medem coisas diferentes.
        </CabecalhoModulo>
        <ExpansaoNavegacao atual="p042" />
        <ModoProfundidade>
          <Bloco id="geracao-e-transmissao">
            <PainelEvidencia
              id="p042"
              pergunta={pp.pergunta}
              subtitulo="Geração em implantação, obras e leilões de transmissão e rede planejada, por UF e por ano · MW, km e MVA em separado"
              porQueImporta={
                <>
                  Geração sem rede para escoar fica parada ou é cortada; rede sem geração custa à tarifa sem uso. Ver as duas expansões no mesmo território e no mesmo tempo mostra onde
                  elas andam juntas e onde uma vai à frente da outra.
                </>
              }
              oQueMudou={mudancaTransmissao(g)}
              comoInterpretar={<>{g.regras.transmissao}</>}
              naoConcluir={
                <>
                  Se a rede é suficiente para a geração de uma UF: a capacidade de escoamento depende do desenho da rede (topologia) e dos limites dela, não de km ou MVA.
                  Também não liga obra de transmissão a usina específica: a EPE e o SIGET não têm chave comum, e o vínculo publicado é territorial.
                </>
              }
              proveniencia={p.obras}
              complementares={complementares}
            >
              <div className="space-y-6">
                <RespostaCurta id="p042" veredito={vereditoTransmissao(g) || respostaTransmissao(g)}>
                  {respostaTransmissao(g)}
                </RespostaCurta>
                <ExpansaoRecorte
                  periodo={
                    <>
                      SIGET de {dataTexto(o.data_referencia)}; RALIE de {dataTexto(g.estagios.ralie.data_ralie)}; série anual de {serie[0]?.ano} a {serie.at(-1)?.ano}; leilões até {dataTexto(l.ultimo_leilao.data)}
                    </>
                  }
                  universo={
                    <>
                      Empreendimentos de transmissão cadastrados no SIGET; usinas em implantação no RALIE; {inteiro(t.geracao_e_rede_por_uf.length)} UF; {inteiro(l.lotes)} lotes de leilão desde{" "}
                      {l.periodo.inicio?.slice(0, 4)}
                    </>
                  }
                  unidade="MW (geração), km de circuito (SIGET), km de traçado (EPE), MVA (transformação) e R$ milhões nominais, sempre separados"
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Numero rotulo="Linhas novas em obras em andamento" natureza="CALCULADO" evidencia={ev.transmissao_em_andamento ?? null} casas={1} tamanho="medio" endereco="/setor-eletrico/expansao/geracao-e-transmissao#p042" motivoAusencia="Sem o SIGET nesta publicação." />
                  <Numero
                    rotulo={`Extensão contratada em leilão em ${l.ultimo_leilao.data?.slice(0, 4) ?? "último ano do arquivo"}, último ano do arquivo aberto`}
                    natureza="CALCULADO"
                    evidencia={ev.leiloes_ultimo_ano ?? null}
                    casas={1}
                    tamanho="medio"
                    endereco="/setor-eletrico/expansao/geracao-e-transmissao#p042"
                    motivoAusencia="Sem o arquivo de leilões nesta publicação."
                    nota="Os anos seguintes ao último leilão do arquivo aberto são ausência na fonte, não anos sem leilão; por isso este cartão é de um ano anterior aos demais."
                  />
                  <Numero rotulo="Geração em implantação (RALIE)" natureza="CALCULADO" evidencia={ev.ralie_em_implantacao ?? null} casas={1} tamanho="medio" endereco="/setor-eletrico/expansao/geracao-e-transmissao#p042" motivoAusencia="Sem a fotografia do RALIE nesta publicação." />
                </div>

                <ExpansaoSubtitulo>Geração e rede por UF, lado a lado</ExpansaoSubtitulo>
                <ExpansaoGeracaoRedeUf
                  linhas={linhasGeracaoRedeUf(g)}
                  datas={{ ralie: dataTexto(g.estagios.ralie.data_ralie), siget: dataTexto(o.data_referencia), epe: capturaEpe }}
                  fonte={`${FONTE_RALIE}; ${FONTE_SIGET}; ${FONTE_EPE_REDE}`}
                />

                <ExpansaoSubtitulo>Ano a ano: geração liberada, linhas e transformação</ExpansaoSubtitulo>
                <CursorSincronizado>
                  <GraficoLinhas
                    titulo={`Geração liberada para operação comercial por ano, ${serie[0]?.ano} a ${serie.at(-1)?.ano} (MW)`}
                    dados={dadosSerieMw(serie)}
                    chaveX="id"
                    formatoX="texto"
                    series={[{ id: "mw", rotulo: "Liberado (resumo anual oficial)", sigla: "Liberado", cor: "var(--cor-energia)" }]}
                    marcos={marcosParciais}
                    unidade="MW"
                    casas={1}
                    zeroNoEixo
                    altura={260}
                  />
                  <GraficoLinhas
                    titulo="Linhas de transmissão por ano: energizadas, contratadas em leilão e em contratos assinados (km)"
                    dados={dadosSerieKm(serie)}
                    chaveX="id"
                    formatoX="texto"
                    series={[
                      { id: "energizados", rotulo: "Energizadas (SIGET, km de circuito)", sigla: "Energizadas", cor: "var(--cor-energia)" },
                      { id: "leilao", rotulo: "Contratadas em leilão (km do lote)", sigla: "Leilão", cor: "var(--serie-comp-3)", tracejada: true },
                      { id: "contratos", rotulo: "Em contratos assinados no ano (SIGET)", sigla: "Contratos", cor: "var(--escala-seq-3)" },
                    ]}
                    marcos={marcosParciais}
                    unidade="km"
                    casas={1}
                    zeroNoEixo
                    legendaInterativa
                    altura={280}
                  />
                  <GraficoLinhas
                    titulo="Transformação por ano: energizada, contratada em leilão e em contratos assinados (MVA)"
                    dados={dadosSerieMva(serie)}
                    chaveX="id"
                    formatoX="texto"
                    series={[
                      { id: "energizados", rotulo: "Energizada (SIGET, sem o reserva)", sigla: "Energizada", cor: "var(--cor-energia)" },
                      { id: "leilao", rotulo: "Contratada em leilão (como publicada)", sigla: "Leilão", cor: "var(--serie-comp-3)", tracejada: true },
                      { id: "contratos", rotulo: "Em contratos assinados no ano (SIGET)", sigla: "Contratos", cor: "var(--escala-seq-3)" },
                    ]}
                    marcos={marcosParciais}
                    unidade="MVA"
                    casas={0}
                    zeroNoEixo
                    legendaInterativa
                    altura={280}
                  />
                </CursorSincronizado>
                <ExpansaoNota>
                  Três painéis, um por grandeza, com o cursor sincronizado pelo ano; dentro de cada painel, linhas separadas e nunca somadas: energizado, contratado em leilão e
                  contratado no SIGET são momentos diferentes do mesmo tipo de obra, não partes de um total. Lacuna na linha é ausência na fonte; zero é zero. O ano parcial está
                  marcado. <span data-nivel="analisar">{l.nota_mva}</span>
                </ExpansaoNota>
                <ExpansaoAusencia titulo="Leilões depois do arquivo aberto: ausência na fonte">
                  <p>
                    O recurso aberto de resultados de leilões da ANEEL (publicado em {dataTexto(l.publicado_em)}) termina no leilão {l.ultimo_leilao.leilao ?? "sem dado"} ({dataTexto(l.ultimo_leilao.data)}).
                    Os anos seguintes aparecem como ausência, não como anos sem leilão.{" "}
                    <span data-nivel="auditar">
                      A planilha mais recente para a qual a página de relatórios da ANEEL aponta exige um desafio anti-robô para ser baixada, e esse bloqueio não foi contornado.
                    </span>
                  </p>
                  <p>
                    Alternativa usada: os contratos de concessão do SIGET, com a data de assinatura, cobrem o período seguinte, sem RAP nem deságio ({inteiro(ca?.depois_do_ultimo_leilao_do_arquivo.contratos.length)} contratos
                    assinados depois do último leilão do arquivo, na tabela do modo Analisar). Depende de a ANEEL atualizar o recurso aberto.
                  </p>
                </ExpansaoAusencia>

                <ExpansaoAnalise titulo="Mapa das linhas existentes e planejadas" id="mapa-rede">
                  {rede ? (
                    <>
                      <ExpansaoMapaRede url={URL_REDE} tamanho={tamanhoPublicado(URL_REDE)} captura={capturaEpe} fonte={FONTE_EPE_REDE} />
                      <ExpansaoNota>
                        {rede.nota_data} {rede.definicao_km} Existente: {inteiro(rede.existente.linhas)} linhas, {kmTexto(rede.existente.km_geometria)}; planejada: {inteiro(rede.planejada.linhas)} linhas,{" "}
                        {kmTexto(rede.planejada.km_geometria)}, com ano de operação de {rede.planejada.ano_min ?? "sem dado"} a {rede.planejada.ano_max ?? "sem dado"}.
                      </ExpansaoNota>
                      <TabelaInterativa
                        titulo={`Linhas da EPE por tensão, capturadas em ${capturaEpe}`}
                        colunas={COLUNAS_REDE_TENSAO}
                        linhas={linhasRedeTensao(g)}
                        chaveLinha="id"
                        colunaRotulo="tensao"
                        fonte={FONTE_EPE_REDE}
                        versao={capturaEpe}
                        nomeArquivo="expansao-rede-epe-tensao"
                        chaveUrl="tra.ten"
                      />
                      <GraficoBarras
                        titulo="Linhas planejadas pela EPE por ano previsto de operação (km de traçado)"
                        dados={rede.planejada.por_ano.map((a) => ({ id: a.ano === null ? "sem-ano" : String(a.ano), ano: a.ano === null ? "ano não informado" : String(a.ano), km: a.km, linhas: a.linhas }))}
                        chaveCategoria="id"
                        chaveRotulo="ano"
                        series={[{ id: "km", rotulo: "Planejada", cor: "var(--escala-seq-3)" }]}
                        unidade="km"
                        casas={1}
                        altura={260}
                      />
                    </>
                  ) : (
                    <ExpansaoAusencia titulo="Geometria das linhas ausente nesta publicação">
                      <p>As camadas do WebMap da EPE não estão no bronze desta publicação; a tabela por UF acima segue com as obras do SIGET.</p>
                    </ExpansaoAusencia>
                  )}
                  <ExpansaoAusencia titulo="Geometria da ANEEL (SIGEL) e vínculo por empreendimento">
                    <p>
                      O SIGEL da ANEEL, que publicaria a geometria das instalações de transmissão, não respondeu às tentativas de acesso. A geometria vem do WebMap da EPE, que não tem chave comum
                      com o SIGET nem com os leilões: as obras em andamento ficam territorializadas pela UF das subestações, e a rede da EPE fica ao lado, por UF, sem ligação por empreendimento.
                    </p>
                  </ExpansaoAusencia>
                </ExpansaoAnalise>

                <ExpansaoAnalise titulo="Obras de transmissão no SIGET" id="obras">
                  <TabelaInterativa
                    titulo={`Empreendimentos por situação, SIGET de ${dataTexto(o.data_referencia)}`}
                    colunas={COLUNAS_OBRAS_SITUACAO}
                    linhas={linhasObrasSituacao(g)}
                    chaveLinha="id"
                    colunaRotulo="situacao"
                    fonte={FONTE_SIGET}
                    versao={dataTexto(o.data_referencia)}
                    nomeArquivo="expansao-obras-situacao"
                    chaveUrl="tra.sit"
                    nota={o.regra_mva_reserva}
                  />
                  <ExpansaoNota>
                    Em andamento: {inteiro(o.em_andamento.empreendimentos)} empreendimentos, {inteiro(o.em_andamento.com_prazo_legal_vencido)} com o prazo vigente do ato legal vencido (
                    {kmTexto(o.em_andamento.km_prazo_vencido)} e {mvaTexto(o.em_andamento.mva_prazo_vencido)}; mediana de {diasTexto(o.em_andamento.mediana_dias_desde_prazo_legal)} desde o prazo). O prazo
                    vigente já incorpora revisões por ato posterior: vencido não quer dizer atrasado em relação ao contrato original, que o arquivo aberto não traz.
                  </ExpansaoNota>
                  <TabelaInterativa
                    titulo={`Empreendimentos em andamento com o prazo vigente vencido, SIGET de ${dataTexto(o.data_referencia)}`}
                    colunas={COLUNAS_PRAZOS_VENCIDOS}
                    linhas={linhasPrazosVencidos(g)}
                    chaveLinha="id"
                    colunaRotulo="nome"
                    fonte={FONTE_SIGET}
                    versao={dataTexto(o.data_referencia)}
                    nomeArquivo="expansao-obras-prazo-vencido"
                    chaveUrl="tra.ven"
                    ordemInicial={{ coluna: "dias", direcao: "desc" }}
                    nota="Reforço com reator ou capacitor (Mvar) não soma km nem MVA; aparece com zero nas duas colunas."
                  />
                  <GraficoBarras
                    titulo="Empreendimentos que entraram depois do prazo vigente, por ano da entrada (% dos empreendimentos)"
                    dados={linhasDesvioObras(g)}
                    chaveCategoria="id"
                    chaveRotulo="ano"
                    series={[
                      { id: "pct_depois", rotulo: "Depois do prazo vigente", cor: "var(--escala-div-neg-1)" },
                      { id: "pct_iguais", rotulo: "Data efetiva igual ao prazo (sinal de prazo revisto)", cor: "var(--cor-mineral)" },
                    ]}
                    unidade="%"
                    casas={1}
                    altura={260}
                  />
                  <TabelaInterativa
                    titulo="Desvio da entrada das obras em relação ao prazo vigente, por ano (não é atraso)"
                    colunas={COLUNAS_DESVIO_OBRAS}
                    linhas={linhasDesvioObras(g)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte={FONTE_SIGET}
                    versao={dataTexto(o.data_referencia)}
                    nomeArquivo="expansao-obras-desvio-prazo"
                    chaveUrl="tra.dsv"
                    nota={o.desvio_prazo_vigente_por_ano.definicao}
                  />
                </ExpansaoAnalise>

                <ExpansaoAnalise titulo="Leilões e contratos de concessão" id="leiloes">
                  <TabelaInterativa
                    titulo={`Leilões de transmissão por ano, ${dataTexto(l.periodo.inicio)} a ${dataTexto(l.periodo.fim)}`}
                    colunas={COLUNAS_LEILOES}
                    linhas={linhasLeiloes(l.por_ano)}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte={FONTE_LEILOES}
                    versao={dataTexto(l.publicado_em)}
                    nomeArquivo="expansao-leiloes-transmissao-ano"
                    chaveUrl="tra.lei"
                    ordemInicial={{ coluna: "ano", direcao: "desc" }}
                    nota={`${l.regra_sem_vencedor} ${l.regra_zero} Deságio agregado = 100 × (1 − RAP vencedora ÷ RAP do edital) nos lotes com as duas; ${inteiro(l.desagio_inconsistente_total)} lotes com deságio publicado divergente do calculado pela RAP ficam listados no modo Auditar.`}
                  />
                  <GraficoBarras
                    titulo="Investimento previsto nos lotes contratados por ano do leilão (R$ milhões nominais)"
                    dados={linhasLeiloes(l.por_ano)}
                    chaveCategoria="id"
                    chaveRotulo="ano"
                    series={[{ id: "investimento", rotulo: "Investimento previsto no edital", cor: "var(--serie-comp-2)" }]}
                    unidade="R$ milhões"
                    casas={1}
                    altura={260}
                  />
                  <ExpansaoNota>Reais nominais da data de cada leilão, sem correção: os anos não se comparam em valor real. Investimento previsto no edital, não realizado.</ExpansaoNota>
                  {ca && (
                    <>
                      <TabelaInterativa
                        titulo={`Contratos de concessão de transmissão por ano de assinatura, SIGET de ${dataTexto(ca.data_referencia)}`}
                        colunas={COLUNAS_CONTRATOS_ANO}
                        linhas={linhasContratosAno(g)}
                        chaveLinha="id"
                        colunaRotulo="ano"
                        fonte={FONTE_SIGET}
                        versao={dataTexto(ca.data_referencia)}
                        nomeArquivo="expansao-contratos-transmissao-ano"
                        chaveUrl="tra.con"
                        ordemInicial={{ coluna: "ano", direcao: "desc" }}
                        nota={`${ca.regra} ${ca.nota_zero}`}
                      />
                      <TabelaInterativa
                        titulo={`Contratos assinados depois do último leilão do arquivo aberto (${datasLegiveis(ca.depois_do_ultimo_leilao_do_arquivo.ultimo_leilao ?? "sem dado")})`}
                        colunas={COLUNAS_CONTRATOS_RECENTES}
                        linhas={linhasContratosRecentes(g)}
                        chaveLinha="id"
                        colunaRotulo="numero"
                        fonte={FONTE_SIGET}
                        versao={dataTexto(ca.data_referencia)}
                        nomeArquivo="expansao-contratos-recentes"
                        chaveUrl="tra.rec"
                        ordemInicial={{ coluna: "assinatura", direcao: "desc" }}
                        nota="Contrato sem empreendimento cadastrado no SIGET tem km e MVA sem dado, não zero."
                      />
                    </>
                  )}
                </ExpansaoAnalise>

                <ExpansaoAuditoria titulo="Regras, conferências e limitações" id="auditoria-transmissao">
                  <ExpansaoNota>{o.definicao_km}</ExpansaoNota>
                  <ExpansaoNota>
                    Módulos listados em mais de um empreendimento contam uma vez ({inteiro(o.modulos_em_mais_de_um_empreendimento.modulos_lt)} módulos de linha e {inteiro(o.modulos_em_mais_de_um_empreendimento.modulos_tr)} de
                    transformação; {o.modulos_em_mais_de_um_empreendimento.regra}). Módulos de linha com extensão fora do limite físico: {inteiro(o.modulos_lt_fora_do_limite)}.
                  </ExpansaoNota>
                  <ExpansaoTabelaSimples
                    titulo="Lotes com deságio publicado divergente do calculado pela RAP"
                    cabecalho={["Leilão e lote", "Deságio publicado (%)", "Deságio pela RAP (%)"]}
                    linhas={l.desagio_inconsistente.map((d) => [d.lote, d.desagio_fonte_pct === null ? "sem dado" : d.desagio_fonte_pct.toLocaleString("pt-BR"), d.desagio_calculado_pct === null ? "sem dado" : d.desagio_calculado_pct.toLocaleString("pt-BR")])}
                  />
                  <ExpansaoNota>
                    Lotes sem vencedor por motivo: {Object.entries(l.sem_vencedor_por_rotulo).map(([k, n]) => `${k.toLocaleLowerCase("pt-BR")} ${inteiro(n)}`).join("; ")}. Lotes contratados com km não informado:{" "}
                    {inteiro(l.lotes_km_nao_informado)}; com MVA não informado: {inteiro(l.lotes_mva_nao_informado)}. Série de MW liberados: {serie.at(-1)?.fonte_mw_geracao_liberada ?? "sem dado"} ({FONTE_LIBERACOES}).
                  </ExpansaoNota>
                  {rede && (
                    <ExpansaoNota>
                      Rede da EPE: contagem informada pelo serviço {inteiro(rede.existente.contagem_informada)} e {inteiro(rede.planejada.contagem_informada)} feições, recebidas {inteiro(rede.existente.linhas)} e{" "}
                      {inteiro(rede.planejada.linhas)}; geometria generalizada a {rede.generalizacao_grau.toLocaleString("pt-BR")} grau; km fora de qualquer UF {kmTexto(rede.existente.km_fora_de_uf)} (existente) e{" "}
                      {kmTexto(rede.planejada.km_fora_de_uf)} (planejada); campo de extensão da fonte fora de escala em {inteiro(rede.planejada.campo_extensao_fora_de_escala.linhas)} linhas planejadas. sha256 das camadas:{" "}
                      <span className="break-all">{rede.existente.sha256}</span> e <span className="break-all">{rede.planejada.sha256}</span>.
                    </ExpansaoNota>
                  )}
                  <p className="rotulo text-mineral">Limitações declaradas na proveniência</p>
                  <ExpansaoLimitacoes itens={[...p.obras.limitacoes, ...p.leiloes.limitacoes, ...p.contratos_transmissao.limitacoes, ...(p.rede_epe?.limitacoes ?? [])]} />
                </ExpansaoAuditoria>

                <ExpansaoSeguir id="p042" downloads={downloadsDe(g, DOWNLOADS_PAINEL.p042)} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
