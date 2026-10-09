import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { Numero } from "@/components/energia/Numero";
import { TerritorioExplorador } from "@/components/energia/TerritorioExplorador";
import { TerritorioAviso, TerritorioIndisponivel, TerritorioRecorte, TerritorioTabela } from "@/components/energia/TerritorioPagina";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia, type ProvenienciaComplementar } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { lerGold } from "@/lib/energia/gold";
import {
  motivoLegivel,
  ID_PAINEL,
  NOME_SUBMERCADO,
  ROTULO_ESTADO_SM,
  dadosExplorador,
  distribuidorasSemArea,
  evidenciaLegivel,
  inteiro,
  numTexto,
  proximaPergunta,
  quartisDistribuidoras,
  respostaTerritorio,
  textoBasesDePerdas,
  textoAtualidade,
  textoLegivel,
  textoPeriodoPainel,
  textoReferencia,
  textoTesteDeCarga,
  textoUniverso,
  vereditoTerritorio,
} from "@/lib/energia/territorio";
import type { GoldTerritorio } from "@/lib/energia/tipos-territorio";
import { lerPerdasDaFonte, lerUsinasDoServidor, situacaoDosInsumos } from "@/lib/energia/territorio-servidor";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Minha região: submercado, distribuidora, município e usinas no mapa",
  description:
    "Mapa geográfico do setor elétrico: submercado de cada UF (EPE e ONS), área de cada distribuidora (relação oficial da ANEEL), indicadores por município e usinas do SIGA, cada número na área da sua fonte e com a fonte.",
  alternates: { canonical: "/setor-eletrico/territorio" },
};

const ROTULO_COMPLEMENTAR: Record<string, string> = {
  subsistema_uf: "UF e subsistema (EPE)",
  areas_carga: "Pertença das áreas de carga (ONS)",
  distribuidora_perdas: "Perdas da distribuidora",
  distribuidora_qualidade: "DEC e FEC da distribuidora",
  conjuntos: "DEC e FEC do conjunto",
  distribuidora_tarifa: "Tarifa B1 da distribuidora",
  mmgd: "MMGD por município",
  mmgd_ons: "MMGD estimada pelo ONS",
  populacao: "População estimada (IBGE)",
  tarifa_social: "Tarifa Social",
  luz_para_todos: "Luz para Todos",
  isolados: "Sistemas isolados (PASI)",
  usinas: "Usinas (SIGA)",
  pld_dia: "PLD do dia",
  pld_mes: "PLD do mês",
  ear: "Energia armazenada",
};

const curto = (sha: string | null | undefined) => (sha ? `${sha.slice(0, 12)}…` : "sem registro");

/**
 * P002, mapa geográfico transversal: "o que acontece na minha região?". Junta seis
 * grãos que não se trocam (submercado, UF, distribuidora, conjunto elétrico, município
 * e usina) sem atribuir nenhum número a um grão menor que o da fonte. A resposta, o
 * recorte e os números de destaque vêm da gold; o mapa, a ficha e as tabelas
 * interativas ficam no explorador (cliente), com estado na URL. Os modos Analisar e
 * Auditar trazem a regra de compatibilidade entre camadas, o catálogo de indicadores
 * por grão, a prova da pertença das áreas de carga, os controles e os bloqueios.
 * Complementa o mapa conceitual da página inicial (P001), sem substituí-lo.
 */
export default function TerritorioPage() {
  const g = lerGold<GoldTerritorio>("territorio.json");
  if (!g || !g.disponivel || !g.proveniencia?.indice) return <TerritorioIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  // as usinas do arquivo publicado separam, por UF, os registros de até 10 kW (a regra da contagem municipal) e contam as usinas em mais de uma UF
  // e a energia sobre a qual cada distribuidora calcula a taxa de perdas (o arquivo anual de perdas por distribuidora)
  const dados = dadosExplorador(g, lerUsinasDoServidor(g.series.usinas, g.resumo.usinas.limite_registro_kw), lerPerdasDaFonte(g.referencias.perdas_ano));
  const r = g.resumo;
  const u = r.usinas;
  const prox = proximaPergunta("distribuidora");
  const siglaDe = new Map(g.distribuidoras.map((d) => [d.cnpj, d.sigla]));
  const sigla = (cnpj: string) => siglaDe.get(cnpj) ?? cnpj;
  const complementares: ProvenienciaComplementar[] = Object.entries(g.proveniencia)
    .filter(([k, p]) => k !== "indice" && p)
    .map(([k, p]) => ({ rotulo: ROTULO_COMPLEMENTAR[k] ?? k, p: p! }));
  const semArea = distribuidorasSemArea(g);
  const ev = g.evidencias;
  // o sha256 de cada arquivo que o índice leu, recalculado sobre o arquivo servido na hora de montar a página
  const insumos = situacaoDosInsumos(g.insumos);
  const situacaoPorChave = new Map(insumos.map((x) => [x.chave, x]));
  const mudaram = insumos.filter((x) => x.confere === false).length;
  const naoLidos = insumos.filter((x) => x.confere === null).length;
  const quartis = quartisDistribuidoras(dados.distribuidoras);

  return (
    <>
      <CabecalhoEnergia atual="territorio" />
      <MarcaVisita secao="energia:territorio" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo
          siglas={["SIN", "PLD", "DEC", "FEC", "MMGD", "SIGA"]}
          titulo={g.pergunta}
          lead={
            <>
              Quem mora num município paga a tarifa da distribuidora da área e vive num <Termo slug="submercado">submercado</Termo>, com preço próprio, por isso cada número aqui é da área da sua fonte. Escolha uma região
              para ver preço, tarifa, perdas, continuidade e usinas.
            </>
          }
          limite="Tarifa, perdas, DEC e FEC são da distribuidora inteira e não distinguem os municípios dela; preço e energia armazenada são do submercado; a área da distribuidora é a união de municípios inteiros."
          recorte={`${dataBR(g.data_referencia)} · ${inteiro(g.resumo.municipios)} municípios · cada medida com unidade e data próprias`}
          fonte="ANEEL, ONS, CCEE, EPE e IBGE"
          referencia={
            <>
              Publicação de {dataBR(g.data_referencia)}; processada em {carimbo(g.gerado_em)}. Malha territorial do IBGE{g.geometria.malha ? `, revisão de ${g.geometria.malha.revisao}` : ""}. Data de cada parte: PLD
              {g.referencias.pld_dia ? ` até ${dataBR(g.referencias.pld_dia)}` : " sem dado"}; energia armazenada{g.referencias.ear_dia ? ` até ${dataBR(g.referencias.ear_dia)}` : " sem dado"}; tarifa B1
              {g.referencias.tarifa_data ? ` vigente em ${dataBR(g.referencias.tarifa_data)}` : " sem dado"}; perdas e continuidade de {g.referencias.perdas_ano ?? "ano sem dado"} e{" "}
              {g.referencias.qualidade_ano ?? "ano sem dado"}; MMGD{g.referencias.mmgd_data_cadastro ? ` no cadastro de ${dataBR(g.referencias.mmgd_data_cadastro)}` : " sem dado"}; Tarifa Social do município em{" "}
              {textoReferencia(g.referencias.tsee_mes_cde)} (a da distribuidora tem o mês do SCS na ficha); usinas do SIGA de {g.referencias.siga_data ? dataBR(g.referencias.siga_data) : "data sem registro"}.
            </>
          }
        />

        <ModoProfundidade>
            <PainelEvidencia
              id={ID_PAINEL}
              pergunta="Qual número vale para qual área?"
              subtitulo="Submercado, distribuidora, conjunto elétrico, município e usina: o tipo de área de cada número"
              natureza={g.proveniencia.indice.natureza}
              porQueImporta={
                <>
                  Quem mora num município paga a tarifa da sua distribuidora, está num submercado com o seu PLD, é atendido por um conjunto elétrico com a sua
                  continuidade e vive num lugar com a sua geração distribuída. Juntar essas peças mostra o que acontece na região sem atribuir a um lugar um número que pertence a uma
                  área maior.
                </>
              }
              oQueMudou={textoAtualidade(g)}
              comoInterpretar={
                <>
                  Escolha uma camada: submercado (cor da UF), distribuidoras (municípios inteiros da relação oficial), municípios (uma medida publicada por município) ou usinas
                  (pontos do SIGA, o Sistema de Informações de Geração da ANEEL). A ficha diz de quem é cada valor. Ao trocar de camada, a escolha continua só onde há correspondência
                  válida; onde não há, a página diz por quê.
                </>
              }
              naoConcluir={
                <>
                  Que a tarifa, as perdas, o DEC ou o FEC sejam do município: são da distribuidora inteira (ou do conjunto inteiro) e não servem para comparar municípios da mesma
                  distribuidora. Que o PLD ou a energia armazenada descrevam um município ou uma UF. Que a área de concessão tenha esses limites: ela é desenhada por municípios
                  inteiros, sem os limites internos. Em que submercado está uma usina: depende do ponto de conexão, que o SIGA não publica. Associação entre camadas não é causa.
                </>
              }
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.indice}
              complementares={complementares}
            >
              <div className="space-y-6">
                <TerritorioExplorador dados={dados} />

                <div id="territorio-limites" className="scroll-mt-28">
                  <NotasDoPainel
                    oQueMudou={textoAtualidade(g)}
                    comoInterpretar={
                      <>
                        Escolha uma camada: submercado (cor da UF), distribuidoras (municípios inteiros da relação oficial), municípios (uma medida publicada por município) ou usinas (pontos do SIGA, o Sistema de Informações de Geração da ANEEL). A
                        ficha diz de quem é cada valor. Ao trocar de camada, a escolha continua só onde há correspondência válida; onde não há, a página diz por quê.
                      </>
                    }
                    naoConcluir={
                      <>
                        Que a tarifa, as perdas, o DEC ou o FEC sejam do município: são da distribuidora inteira (ou do conjunto inteiro) e não servem para comparar municípios da mesma distribuidora. Que o
                        PLD ou a energia armazenada descrevam um município ou uma UF. Que a área de concessão tenha esses limites: ela é desenhada por municípios inteiros, sem os limites internos. Em que
                        submercado está uma usina: depende do ponto de conexão, que o SIGA não publica. Associação entre camadas não é causa.
                      </>
                    }
                  />
                </div>

                <RespostaCurta id={ID_PAINEL} veredito={vereditoTerritorio(g)} depois>
                  {respostaTerritorio(g)}
                </RespostaCurta>
                <TerritorioRecorte
                  periodo={textoPeriodoPainel(g)}
                  universo={textoUniverso(g)}
                  unidade="R$/MWh (PLD e tarifa), % (perdas, EAR, Tarifa Social), horas e interrupções por unidade consumidora (DEC e FEC), unidades e kW (MMGD), MW (usinas), habitantes e domicílios."
                />
                <div data-nivel="analisar" className="grid gap-4 md:grid-cols-3">
                  {ev.municipios_compartilhados && (
                    <Numero
                      rotulo="Municípios atendidos por mais de uma distribuidora"
                      natureza="CALCULADO"
                      evidencia={ev.municipios_compartilhados}
                      casas={0}
                      unidade="municípios"
                      tamanho="medio"
                      nota={`De ${inteiro(r.municipios)} municípios; neles a página lista as distribuidoras e não escolhe uma.`}
                      endereco={`/setor-eletrico/territorio#${ID_PAINEL}`}
                    />
                  )}
                  {ev.municipios_com_submercado && (
                    <Numero
                      rotulo="Municípios com submercado conferido pela UF"
                      natureza="CALCULADO"
                      evidencia={{ ...ev.municipios_com_submercado, indicador: textoLegivel(ev.municipios_com_submercado.indicador) }}
                      casas={0}
                      unidade="municípios"
                      tamanho="medio"
                      nota={`${inteiro(r.municipios_por_estado_submercado.provado ?? 0)} conferidos pela carga das áreas do ONS e ${inteiro(r.municipios_por_estado_submercado.provado_com_area_sem_carga ?? 0)} conferidos só por uma das áreas (a outra sem carga nos dias conferidos, em Tocantins). ${textoTesteDeCarga(g)} Fora deles: ${inteiro(r.municipios_por_estado_submercado.com_localidade_isolada ?? 0)} com localidade isolada dentro do SIN (submercado da UF, com aviso) e ${inteiro(r.municipios_fora_do_sin.total)} fora do SIN.`}
                      endereco={`/setor-eletrico/territorio#${ID_PAINEL}`}
                    />
                  )}
                  {ev.usinas_municipio_reconhecido && (
                    <Numero
                      rotulo="Usinas com o município declarado reconhecido"
                      natureza="CALCULADO"
                      evidencia={ev.usinas_municipio_reconhecido}
                      casas={0}
                      unidade="usinas"
                      tamanho="medio"
                      nota={`De ${inteiro(u.total)} usinas do SIGA; ${inteiro(u.multimunicipio)} declaradas em mais de um município, sem potência repartida.`}
                      endereco={`/setor-eletrico/territorio#${ID_PAINEL}`}
                    />
                  )}
                </div>
                <TerritorioAviso rotulo="Regra de atribuição" nivel="analisar">{textoLegivel(g.regra_granularidade)}</TerritorioAviso>

                <SecaoDoPainel nivel="analisar" titulo="Como os indicadores das distribuidoras se distribuem entre elas" id="territorio-quartis">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Menor valor, quartis e maior valor de cada indicador do quadro de distribuidoras, só entre as que têm o dado. Cada valor é o da área inteira da distribuidora, e cada distribuidora conta uma vez,
                    seja qual for o tamanho; as duas últimas colunas mostram o outro lado, com as unidades consumidoras (UC) de cada uma. A distribuição não diz nada sobre um município.
                  </p>
                  <TerritorioTabela
                    titulo={`Indicadores de ${inteiro(dados.distribuidoras.length)} distribuidoras com município na relação`}
                    colunas={["Indicador", "Unidade", "Com dado", "Menor", "1º quartil", "Mediana", "3º quartil", "Maior", "UC reunidas (% do quadro)", "Mediana pesada pelas UC"]}
                    numericas={[2, 3, 4, 5, 6, 7, 8, 9]}
                    linhas={quartis.map((q) => [
                      q.rotulo,
                      q.unidade,
                      inteiro(q.n),
                      numTexto(q.min, q.casas),
                      numTexto(q.p25, q.casas),
                      numTexto(q.mediana, q.casas),
                      numTexto(q.p75, q.casas),
                      numTexto(q.max, q.casas),
                      q.cobertura_uc_pct === null ? "sem dado" : `${num(q.cobertura_uc_pct, 1)}%`,
                      numTexto(q.mediana_uc, q.casas),
                    ])}
                  />
                  <p className="max-w-prose2 text-sm text-carvao-muted" data-nota-perdas-base="">
                    {textoBasesDePerdas(dados.distribuidoras)}
                  </p>
                  <p className="max-w-prose2 text-xs text-carvao-muted">
                    A mediana pesada pelas UC e a parcela das UC usam as unidades consumidoras do cadastro de continuidade (as mesmas do DEC); a distribuidora sem esse número fica fora das duas colunas e dentro das demais.
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="analisar" titulo="Quando a escolha passa de uma camada para outra?" id="territorio-compatibilidade">
                  <TerritorioTabela
                    titulo="Correspondências entre tipos de área declaradas na base"
                    colunas={["De", "Para", "Passa", "Regra", "Condição"]}
                    linhas={g.compatibilidade.map((c) => [c.de, c.para, c.valida ? "sim" : "não", textoLegivel(c.regra), c.condicao ? textoLegivel(c.condicao) : "sem condição"])}
                  />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Par que não está na tabela não passa: a camada mostra só o contorno da UF quando ele ajuda a localizar a escolha, sem levar nenhum valor da UF para outro tipo de área.
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="analisar" titulo="Onde cada indicador mora (catálogo por tipo de área)" id="territorio-catalogo">
                  <TerritorioTabela
                    titulo={`${inteiro(g.indicadores.length)} indicadores, cada um na tabela da sua área`}
                    colunas={["Indicador", "Tipo de área", "Unidade", "Natureza", "Como aparece na ficha do município", "Origem"]}
                    linhas={g.indicadores.map((i) => [
                      i.rotulo,
                      i.rotulo_grao,
                      i.unidade,
                      i.natureza.toLowerCase(),
                      i.rotulo_no_municipio,
                      <a key={i.id} href={i.pagina.href} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                        {i.pagina.rotulo}
                      </a>,
                    ])}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="analisar" titulo="Distribuidoras sem município na relação vigente" id="territorio-sem-area">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {inteiro(semArea.length)} CNPJs aparecem nas bases publicadas de origem, mas nenhum município da relação de {g.referencias.relacao_distribuidoras_ano ?? "sem data"} os
                    liga a eles: ficam fora do mapa e das fichas, com o motivo de cada indicador.
                  </p>
                  <TerritorioTabela
                    titulo="Distribuidoras sem área na relação"
                    colunas={["Distribuidora", "CNPJ", "Ativa", "Perdas", "Tarifa"]}
                    linhas={semArea.map((d) => [
                      d.sigla,
                      d.cnpj_formatado ?? d.cnpj,
                      d.ativa === null ? "sem dado" : d.ativa ? "sim" : "não",
                      d.indicadores.perdas.disponivel ? `${numTexto(d.indicadores.perdas.taxa_total_pct, 2)}%` : motivoLegivel(d.indicadores.perdas.motivo),
                      d.indicadores.tarifa.disponivel ? `R$ ${numTexto(d.indicadores.tarifa.total_rs_mwh, 2)}/MWh` : d.indicadores.tarifa.motivo,
                    ])}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo="Como o submercado de cada UF foi conferido" id="territorio-areas-carga">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Hipótese: {g.areas_carga.hipotese_de}. {textoLegivel(g.areas_carga.regra)}
                  </p>
                  <p className="max-w-prose2 text-sm text-carvao-muted" data-teste-de-carga="">
                    {textoTesteDeCarga(g)}
                  </p>
                  <TerritorioTabela
                    titulo={`Fechamento por submercado nos dias conferidos (ONS, ${g.areas_carga.fonte.conjunto})`}
                    colunas={["Submercado", "Dia", "Carga do submercado (MWmed)", "Soma das áreas (MWmed)", "Resíduo das médias (MWmed)", "Mediana do resíduo por meia hora (MWmed)", "Máximo (MWmed)", "Meias horas", "Tolerância (MWmed)"]}
                    numericas={[2, 3, 4, 5, 6, 7, 8]}
                    linhas={g.submercados.flatMap((s) =>
                      s.conferencia.map((c) => [
                        `${NOME_SUBMERCADO[s.sm]} (${c.area_perdas})`,
                        dataBR(c.dia),
                        num(c.submercado_mwmed, 2),
                        num(c.soma_areas_mwmed, 2),
                        num(c.residuo_mwmed, 3),
                        num(c.mediana_abs_mwmed, 3),
                        num(c.max_abs_mwmed, 3),
                        inteiro(c.meias_horas),
                        num(c.tolerancia_mwmed, 1),
                      ]),
                    )}
                  />
                  <TerritorioTabela
                    titulo="Alternativas testadas em cada dia (mover uma área ou trocar duas)"
                    colunas={["Dia", "Fecha", "Ruído da hipótese (MWmed)", "Menor alternativa por meia hora", "Menor alternativa pelas médias do dia", "Avaliadas", "Fechariam pelas médias do dia", "Áreas sem carga"]}
                    numericas={[2, 5]}
                    linhas={g.areas_carga.conferencias.map((c) => [
                      dataBR(c.dia),
                      c.fecha === null ? "sem conferência" : c.fecha ? "sim" : "não",
                      numTexto(c.ruido_mwmed, 3),
                      c.menor_alternativa ? `${c.menor_alternativa.descricao}: ${numTexto(c.menor_alternativa.mediana_abs_mwmed, 1)} MWmed` : "nenhuma",
                      c.menor_alternativa_pelas_medias ? `${c.menor_alternativa_pelas_medias.descricao}: ${numTexto(c.menor_alternativa_pelas_medias.residuo_medias_dia_mwmed, 1)} MWmed` : "nenhuma",
                      inteiro(c.alternativas_avaliadas),
                      c.alternativas_que_fechariam_pelas_medias.length ? c.alternativas_que_fechariam_pelas_medias.join("; ") : "nenhuma",
                      c.areas_indeterminadas.length ? c.areas_indeterminadas.join(", ") : "nenhuma",
                    ])}
                  />
                  <TerritorioTabela
                    titulo="Subsistema de cada UF: camada da EPE, módulo Água e módulo Carga"
                    colunas={["UF", "EPE (camada 24)", "Água e clima", "Carga", "Estado da prova"]}
                    linhas={g.ufs.map((x) => [
                      x.uf,
                      g.areas_carga.mapeamento_epe[x.uf] ?? "sem registro",
                      g.areas_carga.mapeamento_agua[x.uf] ?? "sem registro",
                      g.areas_carga.mapeamento_carga[x.uf] ?? "sem registro",
                      ROTULO_ESTADO_SM[x.estado_subsistema],
                    ])}
                  />
                  {g.areas_carga.epe && (
                    <p className="text-xs text-carvao-muted">
                      Camada da EPE capturada em {carimbo(g.areas_carga.epe.capturado_em)}, sha256 {curto(g.areas_carga.epe.sha256)}. Dicionário do ONS versão {g.areas_carga.fonte.dicionario_versao}, sha256{" "}
                      {curto(g.areas_carga.fonte.dicionario_sha256)}.
                    </p>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo="Controles executados nesta publicação" id="territorio-controles">
                  <TerritorioTabela
                    titulo={`${inteiro(g.controles.length)} controles (os críticos derrubam a publicação)`}
                    colunas={["Controle", "Resultado", "Crítico", "Detalhe"]}
                    linhas={g.controles.map((c) => [textoLegivel(c.nome), c.resultado, c.critico ? "sim" : "não", textoLegivel(datasLegiveis(c.detalhe))])}
                  />
                  {g.ressalvas.length > 0 && (
                    <ul className="max-w-prose2 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                      {g.ressalvas.map((x) => (
                        <li key={x}>{textoLegivel(datasLegiveis(x))}</li>
                      ))}
                    </ul>
                  )}
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo="Vínculos com ressalva" id="territorio-vinculos">
                  <TerritorioTabela
                    titulo={`Municípios em que a relação de Perdas (${g.referencias.relacao_distribuidoras_ano ?? "sem data"}) e os conjuntos de Qualidade (${g.referencias.qualidade_ano ?? "sem data"}) listam distribuidoras diferentes`}
                    colunas={["Município", "UF", "Código IBGE", "Relação (Perdas)", "Conjuntos (Qualidade)"]}
                    linhas={r.distribuidoras_por_municipio_perdas_x_qualidade.map((x) => [x.nome, x.uf, x.codigo, x.perdas.map(sigla).join(", ") || "nenhuma", x.qualidade.map(sigla).join(", ") || "nenhuma"])}
                  />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Sem vínculo: {r.municipios_sem_vinculo.map((x) => `${x.nome} (${x.uf}, ${x.codigo})`).join("; ") || "nenhum"}. Só com vínculo sem confirmação (códigos IBGE):{" "}
                    {r.municipios_so_vinculo_nao_confirmado.join(", ") || "nenhum"}. Códigos da relação fora da malha do IBGE:{" "}
                    {r.codigos_da_relacao_fora_da_malha.map((x) => `${x.codigo} (${x.distribuidoras.map(sigla).join(", ")})`).join("; ") || "nenhum"}.
                  </p>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo="Usinas: municípios declarados e coordenadas" id="territorio-usinas">
                  <TerritorioTabela
                    titulo={`Conferência das ${inteiro(u.total)} usinas do SIGA`}
                    colunas={["Conferência", "Usinas"]}
                    numericas={[1]}
                    linhas={[
                      ["Todos os municípios reconhecidos no IBGE", inteiro(u.todos_municipios_reconhecidos)],
                      ["Reconhecidas pela tabela de grafias antigas (DTB)", inteiro(u.via_grafia_antiga)],
                      ["Parcialmente reconhecidas", inteiro(u.parcialmente_reconhecidos)],
                      ["Sem município reconhecido", inteiro(u.sem_municipio_reconhecido)],
                      ["Em mais de um município (potência não repartida)", inteiro(u.multimunicipio)],
                      ["Com coordenada", inteiro(u.com_coordenada)],
                      [`Coordenada no município declarado (malha ${u.conferencia_coordenada.conferencia === "maxima" ? "de qualidade máxima" : "simplificada, aproximada"})`, inteiro(u.coordenada_no_municipio_declarado)],
                      ["Coordenada fora do município declarado", inteiro(u.coordenada_fora_do_municipio_declarado)],
                      ["Coordenada fora de qualquer município", inteiro(u.coordenada_fora_da_malha)],
                      [`Registros de até ${num(u.limite_registro_kw, 0)} kW em operação (coluna própria)`, inteiro(u.registros_ate_10kw)],
                    ]}
                  />
                  <TerritorioTabela
                    titulo="Nomes de município que o SIGA declara e o IBGE não reconhece"
                    colunas={["Nome na fonte", "UF", "Citações"]}
                    numericas={[2]}
                    linhas={u.nomes_nao_reconhecidos.map((x) => [x.nome, x.uf ?? "sem UF", inteiro(x.citacoes)])}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo="O que não foi possível obter" id="territorio-bloqueios">
                  {g.bloqueios.map((b) => {
                    const evidencia = evidenciaLegivel(b.evidencia);
                    return (
                      <div key={b.item} className="space-y-1 text-sm">
                        <p className="font-medium text-carvao">{b.item}</p>
                        <ul className="list-disc space-y-0.5 pl-5 text-carvao-muted">
                          {b.tentativas.map((t) => (
                            <li key={t}>{textoLegivel(t)}</li>
                          ))}
                        </ul>
                        <p className="text-carvao-muted">
                          Evidência:{" "}
                          {evidencia.href ? (
                            <a href={evidencia.href} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                              {evidencia.texto}
                            </a>
                          ) : (
                            evidencia.texto
                          )}
                          . Dependência: {textoLegivel(b.dependencia)}.
                        </p>
                      </div>
                    );
                  })}
                  <div className="max-w-prose2 space-y-1 text-sm">
                    <p className="font-medium text-carvao">Conferência da camada de subsistemas da EPE por quem lê</p>
                    <p className="text-carvao-muted">
                      A tabela de UF e subsistema vem da camada 24 do serviço de mapas da EPE, capturada em {carimbo(g.referencias.subsistema_uf_epe_capturado_em)}, com data e sha256 registrados. A captura bruta fica no
                      repositório de dados do observatório e não é publicada no site. O serviço da EPE pode responder que exige credencial (&quot;Token Required&quot;) a quem consulta a camada, e a recoleta pode falhar: a
                      conferência por quem lê depende do acesso ao serviço, e a publicação mantém a última captura válida.
                    </p>
                  </div>
                  <ul className="max-w-prose2 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {g.limitacoes.map((x) => (
                      <li key={x}>{textoLegivel(x)}</li>
                    ))}
                  </ul>
                </SecaoDoPainel>

                <SecaoDoPainel nivel="auditar" titulo="Arquivos lidos dos módulos de origem" id="territorio-insumos">
                  <p className="max-w-prose2 text-sm text-carvao-muted" data-insumos-resumo="">
                    O índice registrou o sha256 de cada arquivo que leu. A tabela compara esse valor com o sha256 do arquivo servido, recalculado na hora de montar esta página.{" "}
                    {mudaram === 0 && naoLidos === 0
                      ? "Todos conferem: o índice foi calculado sobre estes mesmos arquivos."
                      : `${inteiro(mudaram)} de ${inteiro(g.insumos.length)} arquivos mudaram depois do índice${naoLidos ? ` e ${inteiro(naoLidos)} não puderam ser lidos na montagem desta página` : ""}: o módulo de origem foi regerado e o índice ainda não. O índice só é regerado quando a rotina de geração dos dados roda de novo; até lá, o que ele tirou desses arquivos vem da versão anterior deles.`}
                  </p>
                  <TerritorioTabela
                    titulo={`${inteiro(g.insumos.length)} arquivos lidos: o sha256 do índice e a situação do arquivo servido`}
                    colunas={["Módulo", "Arquivo", "Gerado em (no índice)", "sha256 do índice", "Situação"]}
                    linhas={g.insumos.map((x) => {
                      const st = situacaoPorChave.get(x.chave);
                      const situacao =
                        !st || st.confere === null
                          ? "arquivo não lido na montagem da página"
                          : st.confere
                            ? "confere"
                            : `o arquivo mudou depois do índice (${st.regeradoEm ? `regerado em ${carimbo(st.regeradoEm)}` : "sem data de geração no arquivo"}); sha256 do arquivo servido ${curto(st.sha256Atual)}`;
                      return [x.modulo, <span key={x.chave} className="break-all">{x.url}</span>, carimbo(x.gerado_em), curto(x.sha256), <span key={`${x.chave}-s`} data-situacao-insumo={st?.confere === true ? "confere" : st?.confere === false ? "mudou" : "sem-leitura"}>{situacao}</span>];
                    })}
                  />
                  <p className="text-xs text-carvao-muted">
                    Geometria: {g.geometria.fonte ?? "sem fonte registrada"}, capturada em {carimbo(g.geometria.capturado_em)}, sha256 {curto(g.geometria.sha256)}.
                  </p>
                </SecaoDoPainel>

                <SeguirPainel ancora={ID_PAINEL} proximo={{ href: prox.href, pergunta: prox.pergunta }} downloads={g.downloads} />
              </div>
            </PainelEvidencia>
        </ModoProfundidade>
      </main>
    </>
  );
}
