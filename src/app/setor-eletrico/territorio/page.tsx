import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { Numero } from "@/components/energia/Numero";
import { TerritorioExplorador } from "@/components/energia/TerritorioExplorador";
import {
  TerritorioAnalise,
  TerritorioAuditoria,
  TerritorioAviso,
  TerritorioIndisponivel,
  TerritorioRecorte,
  TerritorioSeguir,
  TerritorioTabela,
} from "@/components/energia/TerritorioPagina";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia, type ProvenienciaComplementar } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, num } from "@/lib/energia/formato";
import { lerGold } from "@/lib/energia/gold";
import {
  ID_PAINEL,
  NOME_SUBMERCADO,
  dadosExplorador,
  distribuidorasSemArea,
  inteiro,
  numTexto,
  proximaPergunta,
  respostaTerritorio,
  textoAtualidade,
  textoPeriodoPainel,
  textoUniverso,
} from "@/lib/energia/territorio";
import type { GoldTerritorio } from "@/lib/energia/tipos-territorio";
import { datasLegiveis } from "@/lib/energia/visao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Minha região: submercado, distribuidora, município e usinas no mapa",
  description:
    "Mapa geográfico do setor elétrico: submercado de cada UF (EPE e ONS), área de cada distribuidora (relação oficial da ANEEL), indicadores por município e usinas do SIGA, cada número no seu recorte e com a fonte.",
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

  const dados = dadosExplorador(g);
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

  return (
    <>
      <CabecalhoEnergia atual="territorio" />
      <MarcaVisita secao="energia:territorio" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["DEC", "FEC"]}
          rotulo="Minha região"
          titulo={g.pergunta}
          referencia={
            <>
              Publicação de {dataBR(g.data_referencia)}; processada em {carimbo(g.gerado_em)}. Malha territorial do IBGE{g.geometria.malha ? `, revisão de ${g.geometria.malha.revisao}` : ""}.
            </>
          }
        >
          Escolha o município, a distribuidora, a UF ou o submercado e veja o que cada fonte oficial publica. Os números não mudam de recorte: o preço é do submercado, a tarifa e as perdas são
          da distribuidora inteira, o DEC é do conjunto elétrico, e só o publicado por município aparece como do município.
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="territorio">
            <PainelEvidencia
              id={ID_PAINEL}
              pergunta={g.pergunta}
              subtitulo="Submercado, UF, distribuidora, conjunto elétrico, município e usina · cada número no seu grão e na unidade da fonte"
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
                  (pontos do SIGA). A ficha separa os números pelo grão de cada um e diz de quem é cada valor. Ao trocar de camada, a escolha continua só onde há correspondência
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
              proveniencia={g.proveniencia.indice}
              complementares={complementares}
            >
              <div className="space-y-6">
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta={ID_PAINEL}>
                  {respostaTerritorio(g)}
                </p>
                <TerritorioRecorte
                  periodo={textoPeriodoPainel(g)}
                  universo={textoUniverso(g)}
                  unidade="Cada indicador na unidade da sua fonte: R$/MWh (PLD e tarifa), % (perdas, EAR, Tarifa Social), horas e interrupções por unidade consumidora (DEC e FEC), unidades e kW (MMGD), MW (usinas), habitantes e domicílios."
                />
                <div className="grid gap-4 md:grid-cols-3">
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
                      rotulo="Municípios com submercado provado pela UF"
                      natureza="CALCULADO"
                      evidencia={ev.municipios_com_submercado}
                      casas={0}
                      unidade="municípios"
                      tamanho="medio"
                      nota={`Fora deles: ${inteiro(r.municipios_por_estado_submercado.com_localidade_isolada ?? 0)} com localidade isolada (submercado da UF com aviso) e ${inteiro(r.municipios_fora_do_sin.total)} fora do SIN.`}
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
                <TerritorioAviso rotulo="Regra do grão">{g.regra_granularidade}</TerritorioAviso>

                <TerritorioExplorador dados={dados} />

                <TerritorioAnalise titulo="Quando a escolha passa de uma camada para outra?" id="territorio-compatibilidade">
                  <TerritorioTabela
                    titulo="Correspondências entre recortes declaradas na base"
                    colunas={["De", "Para", "Passa", "Regra", "Condição"]}
                    linhas={g.compatibilidade.map((c) => [c.de, c.para, c.valida ? "sim" : "não", c.regra, c.condicao ?? "sem condição"])}
                  />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Par que não está na tabela não passa: a camada mostra só o contorno da UF quando ele ajuda a localizar a escolha, sem levar nenhum valor da UF para outro grão.
                  </p>
                </TerritorioAnalise>

                <TerritorioAnalise titulo="Onde cada indicador mora (catálogo por grão)" id="territorio-catalogo">
                  <TerritorioTabela
                    titulo={`${inteiro(g.indicadores.length)} indicadores, cada um na tabela do seu grão`}
                    colunas={["Indicador", "Grão", "Unidade", "Natureza", "Como aparece na ficha do município", "Origem"]}
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
                </TerritorioAnalise>

                <TerritorioAnalise titulo="Distribuidoras sem município na relação vigente" id="territorio-sem-area">
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
                      d.indicadores.perdas.disponivel ? `${numTexto(d.indicadores.perdas.taxa_total_pct, 2)}%` : d.indicadores.perdas.motivo,
                      d.indicadores.tarifa.disponivel ? `R$ ${numTexto(d.indicadores.tarifa.total_rs_mwh, 2)}/MWh` : d.indicadores.tarifa.motivo,
                    ])}
                  />
                </TerritorioAnalise>

                <TerritorioAuditoria titulo="Como o submercado de cada UF foi provado" id="territorio-areas-carga">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Hipótese: {g.areas_carga.hipotese_de}. {g.areas_carga.regra}
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
                      x.estado_subsistema.replace(/_/g, " "),
                    ])}
                  />
                  {g.areas_carga.epe && (
                    <p className="text-xs text-carvao-muted">
                      Camada da EPE capturada em {carimbo(g.areas_carga.epe.capturado_em)}, sha256 {curto(g.areas_carga.epe.sha256)}. Dicionário do ONS versão {g.areas_carga.fonte.dicionario_versao}, sha256{" "}
                      {curto(g.areas_carga.fonte.dicionario_sha256)}.
                    </p>
                  )}
                </TerritorioAuditoria>

                <TerritorioAuditoria titulo="Controles executados nesta publicação" id="territorio-controles">
                  <TerritorioTabela
                    titulo={`${inteiro(g.controles.length)} controles (os críticos derrubam a publicação)`}
                    colunas={["Controle", "Resultado", "Crítico", "Detalhe"]}
                    linhas={g.controles.map((c) => [c.nome, c.resultado, c.critico ? "sim" : "não", datasLegiveis(c.detalhe)])}
                  />
                  {g.ressalvas.length > 0 && (
                    <ul className="max-w-prose2 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                      {g.ressalvas.map((x) => (
                        <li key={x}>{datasLegiveis(x)}</li>
                      ))}
                    </ul>
                  )}
                </TerritorioAuditoria>

                <TerritorioAuditoria titulo="Vínculos com ressalva" id="territorio-vinculos">
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
                </TerritorioAuditoria>

                <TerritorioAuditoria titulo="Usinas: municípios declarados e coordenadas" id="territorio-usinas">
                  <TerritorioTabela
                    titulo={`Conferência das ${inteiro(u.total)} usinas do SIGA`}
                    colunas={["Conferência", "Usinas"]}
                    numericas={[1]}
                    linhas={[
                      ["Todos os municípios declarados reconhecidos no IBGE", inteiro(u.todos_municipios_reconhecidos)],
                      ["Reconhecidas pela tabela de grafias antigas (DTB)", inteiro(u.via_grafia_antiga)],
                      ["Parcialmente reconhecidas", inteiro(u.parcialmente_reconhecidos)],
                      ["Sem município reconhecido", inteiro(u.sem_municipio_reconhecido)],
                      ["Declaradas em mais de um município (sem potência repartida)", inteiro(u.multimunicipio)],
                      ["Com coordenada", inteiro(u.com_coordenada)],
                      [`Coordenada no município declarado (malha ${u.conferencia_coordenada.conferencia === "maxima" ? "de qualidade máxima" : "simplificada, aproximada"})`, inteiro(u.coordenada_no_municipio_declarado)],
                      ["Coordenada fora do município declarado (a declaração prevalece)", inteiro(u.coordenada_fora_do_municipio_declarado)],
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
                </TerritorioAuditoria>

                <TerritorioAuditoria titulo="O que não foi possível obter" id="territorio-bloqueios">
                  {g.bloqueios.map((b) => (
                    <div key={b.item} className="space-y-1 text-sm">
                      <p className="font-medium text-carvao">{b.item}</p>
                      <ul className="list-disc space-y-0.5 pl-5 text-carvao-muted">
                        {b.tentativas.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                      <p className="text-carvao-muted">
                        Evidência: <span className="break-all">{b.evidencia}</span>. Dependência: {b.dependencia}.
                      </p>
                    </div>
                  ))}
                  <ul className="max-w-prose2 list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {g.limitacoes.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </TerritorioAuditoria>

                <TerritorioAuditoria titulo="Arquivos lidos dos módulos de origem" id="territorio-insumos">
                  <TerritorioTabela
                    titulo={`${inteiro(g.insumos.length)} insumos com sha256 (o mesmo arquivo reproduz o mesmo índice)`}
                    colunas={["Módulo", "Arquivo", "Gerado em", "sha256"]}
                    linhas={g.insumos.map((x) => [x.modulo, <span key={x.chave} className="break-all">{x.url}</span>, carimbo(x.gerado_em), curto(x.sha256)])}
                  />
                  <p className="text-xs text-carvao-muted">
                    Geometria: {g.geometria.fonte ?? "sem fonte registrada"}, capturada em {carimbo(g.geometria.capturado_em)}, sha256 {curto(g.geometria.sha256)}.
                  </p>
                </TerritorioAuditoria>

                <TerritorioSeguir ancora={ID_PAINEL} href={prox.href} pergunta={prox.pergunta} downloads={g.downloads} />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
