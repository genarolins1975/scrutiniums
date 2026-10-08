import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { Numero } from "@/components/energia/Numero";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import {
  MercadoAnalise,
  MercadoAuditoria,
  MercadoAviso,
  MercadoDefinicoes,
  MercadoIndisponivel,
  MercadoLimitacoes,
  MercadoNavegacao,
  MercadoOutrasPerguntas,
  MercadoRecorte,
  MercadoResposta,
  MercadoSeguir,
  MercadoVerificacoes,
  ReferenciaMercado,
} from "@/components/energia/MercadoPainel";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { integra, lerGold } from "@/lib/energia/gold";
import { carimbo, dataBR, mesAno, num } from "@/lib/energia/formato";
import {
  COLUNAS_PARCELAS,
  COLUNAS_PERFIS,
  CSV_MERCADO,
  barrasAgentesClasse,
  barrasDesligamentos,
  linhasParcelas,
  linhasPerfis,
  painelMercado,
  provenienciasLegiveis,
  serieAgentesTotal,
  serieFluxosAssociados,
  serieParcelas,
  serieUcsLivres,
  vereditoAgentes,
} from "@/lib/energia/mercado";
import type { MercadoGold } from "@/lib/energia/tipos-mercado";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mercado de energia: agentes e migração",
  description:
    "Quem participa do mercado de energia e como a composição mudou: agentes contabilizados pela CCEE por classe, perfis, parcelas de carga, migrações, desligamentos e unidades consumidoras livres, cada contagem com a sua definição.",
  alternates: { canonical: "/setor-eletrico/mercado/agentes" },
};

export default function MercadoAgentesPage() {
  const g = lerGold<MercadoGold>("mercado.json");
  if (!integra(g)) return <MercadoIndisponivel motivo={g?.motivo} />;

  const p = painelMercado(g, "P033");
  const prov = provenienciasLegiveis(g);
  const am = g.agentes_migracao;
  const k = am.kpis;
  const versao = `CCEE até ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "sem mês"}, publicado em ${dataBR(g.gerado_em)}`;
  const classes = barrasAgentesClasse(g);
  const fluxos = serieFluxosAssociados(g);
  const desl = barrasDesligamentos(g);
  const anoAberto = am.desligamentos_por_ano.find((d) => !d.completo);
  const perfis = am.perfis;
  const pum = am.parcelas_ultimo_mes;
  const ucsClasse = am.ucs_livres_por_classe_ultimo_mes;
  const samp = am.samp_ucs_livres_ultimo_mes;
  const fora = am.parcelas_mensal.filter((x) => x.conferencia_ok === false);
  const nomeSm: Record<string, string> = { SE: "Sudeste/Centro-Oeste", S: "Sul", NE: "Nordeste", N: "Norte" };

  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <MarcaVisita secao="energia:mercado:agentes" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["CCEE", "EPE", "GSF", "SAMP", "ANEEL", "MRE", "ACL", "ACR"]} rotulo="Mercado de energia" titulo="Quem participa do mercado e como a composição mudou?" referencia={<ReferenciaMercado g={g} />}>
          Agente, perfil, parcela de carga e unidade consumidora são contagens diferentes e não se somam: um agente (a empresa, identificada pelo CNPJ) pode ter vários perfis na CCEE, uma parcela de carga pode reunir várias
          unidades consumidoras, e a EPE conta unidades, não empresas. As parcelas de carga contadas são as do mercado livre (<Termo slug="acl">ACL</Termo>); as das distribuidoras, que representam o mercado regulado
          (<Termo slug="acr">ACR</Termo>), ficam fora. Aqui cada número diz o que conta.
        </CabecalhoModulo>
        <MercadoNavegacao atual="agentes" />

        <ModoProfundidade>
          <Bloco id="agentes">
            <PainelEvidencia
              id="painel-agentes"
              pergunta={p?.pergunta ?? "Quem participa do mercado e como a composição mudou?"}
              subtitulo="Agentes, parcelas de carga e unidades consumidoras livres · contagens · CCEE e EPE"
              natureza="OBSERVADO"
              proveniencia={prov.agentes_ccee}
              complementares={[{ rotulo: "Unidades consumidoras livres (EPE)", p: prov.consumo_epe }]}
              extraFonte={prov.agentes_ccee.notas_fonte ? <span data-referencia-por-serie="agentes">Cada série tem o seu período; a referência acima é a da que vai mais longe. {prov.agentes_ccee.notas_fonte}</span> : undefined}
              porQueImporta={
                <>
                  A entrada de consumidores no mercado livre muda quem paga o quê: a energia passa a ser contratada fora da distribuidora, e a CCEE passa a contabilizar mais parcelas de carga. A contagem
                  certa evita confundir novo perfil com nova empresa ou migração com crescimento do consumo.
                </>
              }
              oQueMudou={
                k.ucs_livres ? (
                  <>
                    A EPE contou {num(k.ucs_livres.valor, 0)} unidades consumidoras livres em {mesAno(k.ucs_livres.mes)}
                    {k.ucs_livres.variacao_12m !== null ? <>, {num(k.ucs_livres.variacao_12m, 0)} a mais que 12 meses antes</> : null}.
                    {k.parcelas_carga?.migracoes_no_mes !== null && k.parcelas_carga?.migracoes_no_mes !== undefined && (
                      <> Na CCEE, {num(k.parcelas_carga.migracoes_no_mes, 0)} parcelas de carga tiveram data de migração em {mesAno(k.parcelas_carga.mes)}.</>
                    )}
                  </>
                ) : (
                  <>Sem contagem de unidades livres nesta atualização.</>
                )
              }
              comoInterpretar={
                <>
                  Agentes contabilizados vêm do conjunto da CCEE com a quantidade por classe no mês. Parcelas de carga do ACL excluem a parcela de cada distribuidora, que representa o consumo do ACR.
                  Migração é a parcela cuja data de migração cai no próprio mês. Entrada e saída comparam a lista de associados de um mês com a do anterior, pelo CNPJ. Desligamento é o cancelamento
                  aprovado pela CCEE, voluntário ou compulsório.
                </>
              }
              naoConcluir={
                <>
                  Que cada perfil novo seja empresa nova, nem que cada saída da lista de associados seja desligamento (sucessão e troca de CNPJ também tiram um nome da lista). Que unidade consumidora
                  e parcela de carga sejam a mesma coisa. Que o consumo do mercado livre cresça na mesma proporção das unidades.
                </>
              }
            >
              <MercadoResposta
                painel="P033"
                veredito={vereditoAgentes(g)}
                prova={
                  <>
                    {k.agentes_contabilizados && <ComproveNumero evidencia={k.agentes_contabilizados.evidencia} rotulo="Comprove os agentes" />}
                    {k.ucs_livres && <ComproveNumero evidencia={k.ucs_livres.evidencia} rotulo="Comprove as unidades livres" />}
                    {k.parcelas_carga && <ComproveNumero evidencia={k.parcelas_carga.evidencia} rotulo="Comprove as parcelas" />}
                  </>
                }
              >
                {p?.resposta ?? "Sem resposta nesta atualização: faltam as contagens na base publicada."}
              </MercadoResposta>
              <div className="mb-5 grid gap-4 sm:grid-cols-3">
                <Numero
                  rotulo="Agentes contabilizados pela CCEE"
                  natureza="OBSERVADO"
                  evidencia={k.agentes_contabilizados?.evidencia ?? null}
                  formato="num"
                  casas={0}
                  unidade="agentes"
                  periodo={k.agentes_contabilizados ? mesAno(k.agentes_contabilizados.mes) : undefined}
                  tamanho="medio"
                  motivoAusencia="A CCEE não publicou a contagem do mês."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/agentes#agentes"
                />
                <Numero
                  rotulo="Unidades consumidoras livres (EPE)"
                  natureza="OBSERVADO"
                  evidencia={k.ucs_livres?.evidencia ?? null}
                  formato="num"
                  casas={0}
                  unidade="unidades"
                  periodo={k.ucs_livres ? mesAno(k.ucs_livres.mes) : undefined}
                  variacao={k.ucs_livres?.variacao_12m !== null && k.ucs_livres?.variacao_12m !== undefined ? { valor: k.ucs_livres.variacao_12m, casas: 0, referencia: "contra 12 meses antes" } : undefined}
                  tamanho="medio"
                  motivoAusencia="A EPE não publicou o mês."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/agentes#agentes"
                />
                <Numero
                  rotulo="Parcelas de carga do ACL"
                  natureza="CALCULADO"
                  evidencia={k.parcelas_carga?.evidencia ?? null}
                  formato="num"
                  casas={0}
                  unidade="parcelas"
                  periodo={k.parcelas_carga ? mesAno(k.parcelas_carga.mes) : undefined}
                  nota={k.parcelas_carga?.distribuidoras_excluidas ? <>sem as {num(k.parcelas_carga.distribuidoras_excluidas, 0)} parcelas das distribuidoras (ACR)</> : undefined}
                  tamanho="medio"
                  motivoAusencia="A CCEE não publicou as parcelas do mês."
                  endereco="https://scrutiniums.com/setor-eletrico/mercado/agentes#agentes"
                />
              </div>
              <MercadoRecorte
                periodo={
                  <>
                    EPE de {mesAno(g.livre_regulado.epe_mensal_desde)} a {mesAno(g.livre_regulado.epe_ultimo_mes)}; agentes da CCEE desde {mesAno(am.agentes_por_classe_mensal[0]?.mes ?? g.livre_regulado.epe_ultimo_mes)};
                    parcelas desde {mesAno(am.parcelas_mensal[0]?.mes ?? g.livre_regulado.epe_ultimo_mes)}
                  </>
                }
                universo="unidades consumidoras livres do Brasil (EPE); agentes e parcelas contabilizados no mercado de curto prazo (CCEE)"
                unidade="contagens (unidades, agentes, parcelas)"
              />
              <GraficoLinhas
                chaveUrl="ulv"
                titulo="Unidades consumidoras livres, estoque no fim de cada mês (EPE)"
                dados={serieUcsLivres(g)}
                chaveX="mes"
                formatoX="mes"
                series={[{ id: "livres", rotulo: "Unidades livres", cor: "var(--cor-energia)", espessura: 2.5 }]}
                unidade="unidades"
                casas={0}
                zeroNoEixo
                zoom
                altura={280}
              />
              <GraficoBarras
                titulo={`Agentes contabilizados por classe${classes.mes ? `, ${mesAno(classes.mes)}` : ""} (CCEE)`}
                dados={classes.linhas}
                chaveCategoria="classe"
                series={[{ id: "agentes", rotulo: "Agentes", cor: "var(--serie-4)" }]}
                unidade="agentes"
                casas={0}
                orientacao="horizontal"
                alturaCategoria={44}
                rotulosValor
              />
              <TabelaDados
                titulo="Agentes contabilizados por mês (CCEE)"
                colunas={["Mês", "Total", ...Object.keys(am.agentes_por_classe_mensal.at(-1)?.por_classe ?? {})]}
                linhas={am.agentes_por_classe_mensal.map((m) => [mesAno(m.mes), m.total, ...Object.keys(am.agentes_por_classe_mensal.at(-1)?.por_classe ?? {}).map((c) => m.por_classe[c] ?? null)])}
                casas={[null, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
                limite={36}
                csv={CSV_MERCADO.ccee.url}
              />

              <MercadoAnalise titulo="Parcelas, migrações, entradas e desligamentos" id="agentes-analise">
                <GraficoLinhas
                  titulo="Agentes contabilizados pela CCEE, total por mês"
                  dados={serieAgentesTotal(g)}
                  chaveX="mes"
                  formatoX="mes"
                  series={[{ id: "total", rotulo: "Agentes contabilizados", cor: "var(--serie-4)", espessura: 2.5 }]}
                  unidade="agentes"
                  casas={0}
                  altura={220}
                />
                <GraficoBarras
                  titulo="Parcelas de carga com data de migração no mês (CCEE)"
                  dados={serieParcelas(g)}
                  chaveCategoria="mes"
                  chaveRotulo="rotulo"
                  series={[{ id: "migracoes", rotulo: "Migrações no mês", cor: "var(--cor-energia)" }]}
                  unidade="parcelas"
                  casas={0}
                  altura={260}
                />
                <GraficoLinhas
                  titulo="Parcelas de carga do ACL contabilizadas, mês a mês (CCEE)"
                  dados={serieParcelas(g).map((x) => ({ mes: x.mes, parcelas: x.parcelas }))}
                  chaveX="mes"
                  formatoX="mes"
                  series={[{ id: "parcelas", rotulo: "Parcelas do ACL", cor: "var(--serie-4)", espessura: 2.5 }]}
                  unidade="parcelas"
                  casas={0}
                  zeroNoEixo
                  altura={240}
                />
                {fora.length > 0 && (
                  <MercadoAviso>
                    Nos meses {fora.map((x) => mesAno(x.mes)).join(", ")}, a soma das parcelas difere do consumo por classe acima de 5 MW médios; os meses ficam no gráfico e marcados na tabela.
                  </MercadoAviso>
                )}
                {fluxos.length > 0 && (
                  <GraficoBarras
                    titulo="Entradas e saídas da lista de associados da CCEE (CNPJ)"
                    dados={fluxos}
                    chaveCategoria="mes"
                    chaveRotulo="rotulo"
                    series={[
                      { id: "entradas", rotulo: "Entradas", cor: "var(--cor-energia)" },
                      { id: "saidas", rotulo: "Saídas", cor: "var(--serie-referencia)" },
                    ]}
                    unidade="agentes"
                    casas={0}
                    altura={240}
                  />
                )}
                <GraficoBarras
                  titulo="Desligamentos de agentes da CCEE por ano"
                  dados={desl}
                  chaveCategoria="ano"
                  chaveRotulo="rotulo"
                  series={[
                    { id: "voluntario", rotulo: "Voluntário", cor: "var(--serie-4)" },
                    { id: "compulsorio", rotulo: "Compulsório", cor: "var(--serie-termica)" },
                  ]}
                  unidade="agentes"
                  casas={0}
                  empilhado
                  altura={260}
                />
                {anoAberto && (
                  <p className="text-xs leading-relaxed text-carvao-muted">
                    {anoAberto.ano} é parcial: a lista cobre até {dataBR(anoAberto.ultima_data)}, {anoAberto.meses} meses do ano.
                  </p>
                )}
                {pum && (
                  <TabelaDados
                    titulo={`Parcelas de carga do ACL por classe do perfil e por submercado, ${mesAno(pum.mes)}`}
                    colunas={["Recorte", "Parcelas", "Consumo (GWh)"]}
                    linhas={[
                      ...Object.entries(pum.por_classe_perfil).map(([c, v]) => [c, v.parcelas, v.consumo_mwh === null ? null : v.consumo_mwh / 1e3] as (string | number | null)[]),
                      ...Object.entries(pum.por_submercado).map(([s, v]) => [`Submercado ${nomeSm[s] ?? s}`, v ?? null, null] as (string | number | null)[]),
                    ]}
                    casas={[null, 0, 0]}
                  />
                )}
                {ucsClasse.mes && (
                  <TabelaDados
                    titulo={`Unidades consumidoras livres por classe, ${mesAno(ucsClasse.mes)} (EPE)`}
                    colunas={["Classe", "Unidades livres"]}
                    linhas={ucsClasse.linhas.map((l) => [l.classe, l.livre_uc])}
                    casas={[null, 0]}
                  />
                )}
                {samp && (
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    No SAMP, em {mesAno(samp.mes)} (último mês comparável), as distribuidoras faturaram {num(samp.livre_uc_incentivada, 0)} unidades livres incentivadas,{" "}
                    {num(samp.livre_uc_convencional, 0)} convencionais e {num(samp.livre_uc_autoproducao, 0)} de autoprodução.
                  </p>
                )}
                <TabelaInterativa
                  titulo="Parcelas de carga do ACL e migrações por mês (CCEE)"
                  colunas={COLUNAS_PARCELAS}
                  linhas={linhasParcelas(g)}
                  chaveLinha="id"
                  colunaRotulo="mes"
                  fonte="CCEE, PARCELA_CARGA_CONSUMO"
                  versao={versao}
                  nomeArquivo="mercado-parcelas"
                  chaveUrl="parc"
                  ordemInicial={{ coluna: "mes", direcao: "desc" }}
                />
              </MercadoAnalise>

              <MercadoAuditoria titulo="Cadastro de perfis, agentes na ANEEL e conferências" id="agentes-auditoria">
                {p && <MercadoVerificacoes painel={p} />}
                <TabelaInterativa
                  chaveUrl="perf"
                  titulo="Perfis e agentes por classe no cadastro de perfis da CCEE"
                  colunas={COLUNAS_PERFIS}
                  linhas={linhasPerfis(g)}
                  chaveLinha="id"
                  colunaRotulo="classe"
                  fonte="CCEE, LISTA_PERFIL_V1"
                  versao={perfis.data_modificacao_portal ? `modificação informada pelo portal em ${dataBR(perfis.data_modificacao_portal)}` : versao}
                  nomeArquivo="mercado-perfis"
                  nota={`${perfis.nota_data} Agentes por classe não se somam: um agente pode ter perfis em mais de uma classe. Capturado em ${carimbo(perfis.capturado_em)}.`}
                />
                <p className="text-sm leading-relaxed text-carvao-muted">
                  Cadastro da ANEEL (gerado em {dataBR(am.agentes_aneel.gerado_em)}): {num(am.agentes_aneel.cadastrados, 0)} agentes cadastrados, {num(am.agentes_aneel.ativos, 0)} ativos; entre os
                  ativos, {num(am.agentes_aneel.ativos_por_atividade.geracao, 0)} com atividade de geração, {num(am.agentes_aneel.ativos_por_atividade.comercializacao, 0)} de comercialização (
                  {num(am.agentes_aneel.ativos_so_comercializacao, 0)} só de comercialização), {num(am.agentes_aneel.ativos_por_atividade.distribuicao, 0)} de distribuição e{" "}
                  {num(am.agentes_aneel.ativos_por_atividade.transmissao, 0)} de transmissão. Um agente pode ter mais de uma atividade.
                </p>
                {pum && (
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    Conferência de {mesAno(pum.mes)}: parcelas do ACL somam {num(pum.conferencia.parcelas_acl_mwmed, 1)} MW médios contra {num(pum.conferencia.classes_acl_mwmed, 1)} no consumo por classe
                    (resíduo de {num(pum.conferencia.residuo_acl_mwmed, 2)}); as parcelas das distribuidoras somam {num(pum.conferencia.parcelas_distribuidor_mwmed, 1)} contra{" "}
                    {num(pum.conferencia.classe_distribuidor_mwmed, 1)} da classe Distribuidor.
                  </p>
                )}
                <MercadoDefinicoes g={g} chaves={["agente", "perfil", "parcela_de_carga", "unidade_consumidora", "migracao", "entrada_saida_agente", "desligamento", "variacao_liquida"]} />
              </MercadoAuditoria>

              {p && <MercadoLimitacoes painel={p} />}
              <MercadoSeguir
                ancora="agentes"
                proximo={{ href: "/setor-eletrico/mercado/mre-e-gsf", pergunta: "Como foi o ajuste da garantia física das hidrelétricas do MRE?" }}
                downloads={[CSV_MERCADO.ccee, CSV_MERCADO.desligamentos, CSV_MERCADO.agentesAneel, CSV_MERCADO.nacional]}
              />
            </PainelEvidencia>
          </Bloco>

          <Bloco id="outras-perguntas">
            <MercadoOutrasPerguntas g={g} atual="agentes" />
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
