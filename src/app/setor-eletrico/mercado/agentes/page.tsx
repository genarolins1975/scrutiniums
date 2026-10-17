import type { ReactNode } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import {
  MercadoAusencias,
  MercadoAviso,
  MercadoDefinicoes,
  MercadoIndisponivel,
  MercadoLimitacoes,
  MercadoNavegacao,
  MercadoPendenciasAuditoria,
  MercadoRecorte,
  MercadoResposta,
  MercadoVerificacoes,
  ReferenciaMercado,
  TextoGold,
} from "@/components/energia/MercadoPainel";
import { Nome } from "@/components/i18n/Nome";
import { Numero } from "@/components/energia/Numero";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { TabelaDados } from "@/components/energia/TabelaDados";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, mesAno, nomeSubmercado, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { CLASSES_MERCADO_EN, NOTAS_MERCADO_EN, rotuloCategoria, traducaoExata } from "@/lib/energia/i18n/mercado-preco";
import {
  colunasParcelas,
  colunasPerfis,
  CSV_MERCADO,
  TITULO_PAGINA_MERCADO,
  barrasAgentesClasse,
  barrasDesligamentos,
  itensAusentesMercado,
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

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/mercado/agentes", {
    title: tx("Mercado de energia: agentes e migração", "Energy market: agents and migration"),
    description: tx(
      "Quem participa do mercado de energia e como a composição mudou: agentes contabilizados pela CCEE por classe, perfis, parcelas de carga, migrações, desligamentos e unidades consumidoras livres, cada contagem com a sua definição.",
      "Who takes part in the energy market and how its makeup has changed: agents accounted by CCEE by class, profiles, load parcels, migrations, disconnections and free consumer units, each count with its own definition.",
    ),
    alternates: { canonical: "/setor-eletrico/mercado/agentes" },
  }, anterior);
}

export default function MercadoAgentesPage() {
  const idioma = idiomaEnergia();
  const classe = (c: string) => rotuloCategoria(CLASSES_MERCADO_EN, c, idioma);
  const g = lerGold<MercadoGold>("mercado.json");
  if (!integra(g)) return <MercadoIndisponivel motivo={g?.motivo} />;

  const p = painelMercado(g, "P033");
  const prov = provenienciasLegiveis(g);
  const am = g.agentes_migracao;
  const k = am.kpis;
  const versao = tx(
    `CCEE até ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "sem mês"}, publicado em ${dataBR(g.gerado_em)}`,
    `CCEE to ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "no month"}, published on ${dataBR(g.gerado_em)}`,
  );
  const classes = barrasAgentesClasse(g);
  const fluxos = serieFluxosAssociados(g);
  const desl = barrasDesligamentos(g);
  const anoAberto = am.desligamentos_por_ano.find((d) => !d.completo);
  const perfis = am.perfis;
  const pum = am.parcelas_ultimo_mes;
  const ucsClasse = am.ucs_livres_por_classe_ultimo_mes;
  const samp = am.samp_ucs_livres_ultimo_mes;
  const fora = am.parcelas_mensal.filter((x) => x.conferencia_ok === false);
  const ausentes = itensAusentesMercado(g).filter((i) => i.paineis.includes("P033"));
  const colunasClasse = Object.keys(am.agentes_por_classe_mensal.at(-1)?.por_classe ?? {});

  const oQueMudou = k.ucs_livres ? (
    tx(
      <>
        A EPE contou {num(k.ucs_livres.valor, 0)} unidades consumidoras livres em {mesAno(k.ucs_livres.mes)}
        {k.ucs_livres.variacao_12m !== null ? <>, {num(k.ucs_livres.variacao_12m, 0)} a mais que 12 meses antes</> : null}.
        {k.parcelas_carga?.migracoes_no_mes !== null && k.parcelas_carga?.migracoes_no_mes !== undefined && (
          <> Na CCEE, {num(k.parcelas_carga.migracoes_no_mes, 0)} parcelas de carga tiveram data de migração em {mesAno(k.parcelas_carga.mes)}.</>
        )}
      </>,
      <>
        EPE counted {num(k.ucs_livres.valor, 0)} free consumer units in {mesAno(k.ucs_livres.mes)}
        {k.ucs_livres.variacao_12m !== null ? <>, {num(k.ucs_livres.variacao_12m, 0)} more than 12 months earlier</> : null}.
        {k.parcelas_carga?.migracoes_no_mes !== null && k.parcelas_carga?.migracoes_no_mes !== undefined && (
          <> At CCEE, {num(k.parcelas_carga.migracoes_no_mes, 0)} load parcels had a migration date in {mesAno(k.parcelas_carga.mes)}.</>
        )}
      </>,
    )
  ) : (
    <>{tx("Sem contagem de unidades livres nesta atualização.", "No count of free consumer units in this update.")}</>
  );
  const comoInterpretar = tx(
    <>
      Agentes contabilizados vêm do conjunto da CCEE com a quantidade por classe no mês. Parcelas de carga do ACL excluem a parcela de cada distribuidora, que representa o consumo do ACR. Migração é
      a parcela cuja data de migração cai no próprio mês. Entrada e saída comparam a lista de associados de um mês com a do anterior, pelo CNPJ. Desligamento é o cancelamento aprovado pela CCEE,
      voluntário ou compulsório.
    </>,
    <>
      Accounted agents come from the CCEE dataset with the number per class in the month. ACL load parcels exclude each distribution utility&apos;s parcel, which represents ACR consumption. Migration is
      the parcel whose migration date falls within the month itself. Entry and exit compare one month&apos;s member list with the previous one, by CNPJ. Disconnection is the cancellation approved by CCEE,
      voluntary or compulsory.
    </>,
  );
  const naoConcluir = tx(
    <>
      Que cada perfil novo seja empresa nova, nem que cada saída da lista de associados seja desligamento (sucessão e troca de CNPJ também tiram um nome da lista). Que unidade consumidora e parcela de
      carga sejam a mesma coisa. Que o consumo do mercado livre cresça na mesma proporção das unidades.
    </>,
    <>
      That each new profile is a new company, or that each exit from the member list is a disconnection (succession and a change of CNPJ also remove a name from the list). That a consumer unit and a load
      parcel are the same thing. That free-market consumption grows in the same proportion as the units.
    </>,
  );

  return (
    <>
      <CabecalhoEnergia atual="mercado" />
      <MarcaVisita secao="energia:mercado:agentes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <MercadoNavegacao atual="agentes" />
        <CabecalhoModulo
          siglas={["CCEE", "EPE", "GSF", "SAMP", "ANEEL", "MRE", "ACL", "ACR", "CNPJ"]}
          rotulo={tx("Mercado de energia", "Energy market")}
          titulo={TITULO_PAGINA_MERCADO.agentes}
          lead={tx<ReactNode>(
            "Agente, perfil, parcela de carga e unidade consumidora são contagens diferentes e não se somam: um agente (a empresa, identificada pelo CNPJ) pode ter vários perfis na Câmara de Comercialização de Energia Elétrica (CCEE).",
            <>
              Agent, profile, load parcel and consumer unit are different counts and cannot be added up: an agent (the company, identified by its CNPJ tax ID) can have several profiles at the electric energy trading chamber (<Nome>Câmara de Comercialização de Energia Elétrica</Nome>, CCEE).
            </>,
          )}
          recorte={tx(
            `CCEE até ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "mês não publicado"}, EPE até ${mesAno(g.referencias.epe_ultimo_mes)}, publicado em ${dataBR(g.gerado_em)}`,
            `CCEE to ${g.referencias.ccee_ultimo_mes_consumo ? mesAno(g.referencias.ccee_ultimo_mes_consumo) : "month not published"}, EPE to ${mesAno(g.referencias.epe_ultimo_mes)}, published on ${dataBR(g.gerado_em)}`,
          )}
          fonte={tx("CCEE, Câmara de Comercialização de Energia Elétrica; EPE, Empresa de Pesquisa Energética", "CCEE (electric energy trading chamber); EPE (Energy Research Office)")}
          referencia={<ReferenciaMercado g={g} />}
          metricas={
            <FaixaMetricas
              colunas={3}
              rotulo={tx("Agentes, unidades livres e parcelas de carga", "Agents, free consumer units and load parcels")}
              nota={tx(
                <>Cada medida diz a sua data e o seu universo, e nenhuma se soma às outras: as unidades consumidoras livres são da EPE; os agentes e as parcelas de carga, da CCEE.</>,
                <>Each measure states its own date and universe, and none is added to the others: free consumer units are from EPE; agents and load parcels, from CCEE.</>,
              )}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Agentes contabilizados pela CCEE", "Agents accounted by CCEE")}
                natureza="OBSERVADO"
                evidencia={k.agentes_contabilizados?.evidencia ?? null}
                formato="num"
                casas={0}
                unidade={tx("agentes", "agents")}
                periodo={k.agentes_contabilizados ? mesAno(k.agentes_contabilizados.mes) : undefined}
                cor="var(--serie-4)"
                motivoAusencia={tx("A CCEE não publicou a contagem do mês.", "CCEE did not publish the count for the month.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/agentes#agentes"
              />
              <Numero
                variante="faixa"
                rotulo={tx("Unidades consumidoras livres (EPE)", "Free consumer units (EPE)")}
                natureza="OBSERVADO"
                evidencia={k.ucs_livres?.evidencia ?? null}
                formato="num"
                casas={0}
                unidade={tx("unidades", "units")}
                periodo={k.ucs_livres ? mesAno(k.ucs_livres.mes) : undefined}
                cor="var(--cor-energia)"
                variacao={k.ucs_livres?.variacao_12m !== null && k.ucs_livres?.variacao_12m !== undefined ? { valor: k.ucs_livres.variacao_12m, casas: 0, referencia: tx("contra 12 meses antes", "versus 12 months earlier") } : undefined}
                motivoAusencia={tx("A EPE não publicou o mês.", "EPE did not publish the month.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/agentes#agentes"
              />
              <Numero
                variante="faixa"
                rotulo={tx("Parcelas de carga do ACL", "ACL load parcels")}
                natureza="CALCULADO"
                evidencia={k.parcelas_carga?.evidencia ?? null}
                formato="num"
                casas={0}
                unidade={tx("parcelas", "parcels")}
                periodo={k.parcelas_carga ? mesAno(k.parcelas_carga.mes) : undefined}
                cor="var(--serie-comp-1)"
                nota={k.parcelas_carga?.distribuidoras_excluidas ? tx(<>sem as {num(k.parcelas_carga.distribuidoras_excluidas, 0)} parcelas das distribuidoras (ACR)</>, <>excluding the {num(k.parcelas_carga.distribuidoras_excluidas, 0)} distribution utility parcels (ACR)</>) : undefined}
                motivoAusencia={tx("A CCEE não publicou as parcelas do mês.", "CCEE did not publish the parcels for the month.")}
                endereco="https://scrutiniums.com/setor-eletrico/mercado/agentes#agentes"
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Agente, perfil, parcela de carga e unidade consumidora são contagens diferentes e não se somam: um agente (a empresa, identificada pelo CNPJ) pode ter vários perfis na CCEE, uma parcela de carga pode
              reunir várias unidades consumidoras, e a EPE conta unidades, não empresas. As parcelas de carga contadas são as do mercado livre (<Termo slug="acl">ACL</Termo>); as das distribuidoras, que representam
              o mercado regulado (<Termo slug="acr">ACR</Termo>), ficam fora. Aqui cada número diz o que conta.
            </>,
            <>
              Agent, profile, load parcel and consumer unit are different counts and cannot be added up: an agent (the company, identified by its CNPJ) can have several profiles at CCEE, a load parcel can
              group several consumer units, and EPE counts units, not companies. The load parcels counted are those of the free market (<Termo slug="acl">ACL</Termo>); those of distribution utilities, which represent
              the regulated market (<Termo slug="acr">ACR</Termo>), are excluded. Here each number states what it counts.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="agentes">
            <PainelEvidencia
              id="painel-agentes"
              pergunta={tx("Quantos agentes e unidades livres o mercado tem?", "How many agents and free consumer units does the market have?")}
              subtitulo={tx("Agentes, parcelas de carga e unidades consumidoras livres · contagens · CCEE e EPE", "Agents, load parcels and free consumer units · counts · CCEE and EPE")}
              natureza="OBSERVADO"
              proveniencia={prov.agentes_ccee}
              complementares={[{ rotulo: tx("Unidades consumidoras livres (EPE)", "Free consumer units (EPE)"), p: prov.consumo_epe }]}
              extraFonte={
                prov.agentes_ccee.notas_fonte ? (
                  <span data-referencia-por-serie="agentes">
                    {tx("Cada série tem o seu período; a referência acima é a da que vai mais longe.", "Each series has its own period; the reference above is the one that goes furthest.")}{" "}
                    <TextoGold regiao="mercado-notas-fonte">{prov.agentes_ccee.notas_fonte}</TextoGold>
                  </span>
                ) : undefined
              }
              porQueImporta={
                tx(
                  <>
                    A entrada de consumidores no mercado livre muda quem paga o quê: a energia passa a ser contratada fora da distribuidora, e a CCEE passa a contabilizar mais parcelas de carga. A contagem
                    certa evita confundir novo perfil com nova empresa ou migração com crescimento do consumo.
                  </>,
                  <>
                    Consumers entering the free market change who pays for what: energy starts to be contracted outside the distribution utility, and CCEE starts to account for more load parcels. The right count
                    avoids confusing a new profile with a new company or migration with growth in consumption.
                  </>,
                )
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
            >
              <div className="space-y-6">
                <GraficoLinhas
                  chaveUrl="ulv"
                  titulo={tx("Unidades consumidoras livres, estoque no fim de cada mês (EPE)", "Free consumer units, stock at the end of each month (EPE)")}
                  dados={serieUcsLivres(g)}
                  chaveX="mes"
                  formatoX="mes"
                  series={[{ id: "livres", rotulo: tx("Unidades livres", "Free consumer units"), cor: "var(--cor-energia)", espessura: 2.5 }]} // i18n: dado
                  unidade={tx("unidades", "units")}
                  casas={0}
                  zeroNoEixo
                  zoom
                  altura={280}
                />
                <MercadoRecorte
                  periodo={
                    tx(
                      <>
                        EPE de {mesAno(g.livre_regulado.epe_mensal_desde)} a {mesAno(g.livre_regulado.epe_ultimo_mes)}; agentes da CCEE desde {mesAno(am.agentes_por_classe_mensal[0]?.mes ?? g.livre_regulado.epe_ultimo_mes)};
                        parcelas desde {mesAno(am.parcelas_mensal[0]?.mes ?? g.livre_regulado.epe_ultimo_mes)}
                      </>,
                      <>
                        EPE from {mesAno(g.livre_regulado.epe_mensal_desde)} to {mesAno(g.livre_regulado.epe_ultimo_mes)}; CCEE agents since {mesAno(am.agentes_por_classe_mensal[0]?.mes ?? g.livre_regulado.epe_ultimo_mes)};
                        parcels since {mesAno(am.parcelas_mensal[0]?.mes ?? g.livre_regulado.epe_ultimo_mes)}
                      </>,
                    )
                  }
                  universo={tx("unidades consumidoras livres do Brasil (EPE); agentes e parcelas contabilizados no mercado de curto prazo (CCEE)", "free consumer units in Brazil (EPE); agents and parcels accounted in the short-term market (CCEE)")}
                  unidade={tx("contagens (unidades, agentes, parcelas)", "counts (units, agents, parcels)")}
                />
                <GraficoBarras
                  titulo={tx(`Agentes contabilizados por classe${classes.mes ? `, ${mesAno(classes.mes)}` : ""} (CCEE)`, `Agents accounted by class${classes.mes ? `, ${mesAno(classes.mes)}` : ""} (CCEE)`)}
                  dados={classes.linhas.map((l) => ({ ...l, classe: classe(l.classe) }))}
                  chaveCategoria="classe"
                  series={[{ id: "agentes", rotulo: tx("Agentes", "Agents"), cor: "var(--serie-4)" }]}
                  unidade={tx("agentes", "agents")}
                  casas={0}
                  orientacao="horizontal"
                  alturaCategoria={44}
                  rotulosValor
                />
                <TabelaDados
                  titulo={tx("Agentes contabilizados por mês (CCEE)", "Agents accounted by month (CCEE)")}
                  colunas={[tx("Mês", "Month"), "Total", ...colunasClasse.map(classe)]} // i18n: dado
                  linhas={am.agentes_por_classe_mensal.map((m) => [mesAno(m.mes), m.total, ...colunasClasse.map((c) => m.por_classe[c] ?? null)])}
                  casas={[null, 0, 0, 0, 0, 0, 0, 0, 0, 0]}
                  limite={36}
                  csv={CSV_MERCADO.ccee.url}
                />
                <MercadoResposta painel="P033" veredito={vereditoAgentes(g)}>
                  {p?.resposta ?? tx("Sem resposta nesta atualização: faltam as contagens na base publicada.", "No answer in this update: the counts are missing from the published database.")}
                </MercadoResposta>
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel
                  id="agentes-movimento"
                  titulo={tx("Quantos agentes e parcelas entraram, saíram ou migraram?", "How many agents and parcels entered, left or migrated?")}
                  lead={tx(
                    "Migração é a parcela de carga cuja data de migração cai no mês; entrada e saída comparam a lista de associados da CCEE de um mês com a do anterior; desligamento é o cancelamento aprovado.",
                    "Migration is the load parcel whose migration date falls within the month; entry and exit compare one month's CCEE member list with the previous one; disconnection is the approved cancellation.",
                  )}
                >
                  <GraficoBarras
                    titulo={tx("Parcelas de carga com data de migração no mês (CCEE)", "Load parcels with a migration date in the month (CCEE)")}
                    dados={serieParcelas(g)}
                    chaveCategoria="mes"
                    chaveRotulo="rotulo"
                    series={[{ id: "migracoes", rotulo: tx("Migrações no mês", "Migrations in the month"), cor: "var(--serie-comp-1)" }]}
                    unidade={tx("parcelas", "parcels")}
                    casas={0}
                    altura={260}
                  />
                  {fluxos.length > 0 && (
                    <GraficoBarras
                      titulo={tx("Entradas e saídas da lista de associados da CCEE (CNPJ)", "Entries and exits from the CCEE member list (CNPJ)")}
                      dados={fluxos}
                      chaveCategoria="mes"
                      chaveRotulo="rotulo"
                      series={[
                        { id: "entradas", rotulo: tx("Entradas", "Entries"), cor: "var(--serie-2)" },
                        { id: "saidas", rotulo: tx("Saídas", "Exits"), cor: "var(--serie-referencia)" },
                      ]}
                      unidade={tx("agentes", "agents")}
                      casas={0}
                      altura={240}
                    />
                  )}
                  <GraficoBarras
                    titulo={tx("Desligamentos de agentes da CCEE por ano", "CCEE agent disconnections by year")}
                    dados={desl}
                    chaveCategoria="ano" // i18n: dado
                    chaveRotulo="rotulo"
                    series={[
                      { id: "voluntario", rotulo: tx("Voluntário", "Voluntary"), cor: "var(--serie-4)" },
                      { id: "compulsorio", rotulo: tx("Compulsório", "Compulsory"), cor: "var(--serie-termica)" },
                    ]}
                    unidade={tx("agentes", "agents")}
                    casas={0}
                    empilhado
                    altura={260}
                  />
                  {anoAberto && (
                    <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                      {tx(
                        `${anoAberto.ano} é parcial: a lista cobre até ${dataBR(anoAberto.ultima_data)}, ${anoAberto.meses} meses do ano.`,
                        `${anoAberto.ano} is partial: the list covers up to ${dataBR(anoAberto.ultima_data)}, ${anoAberto.meses} ${anoAberto.meses === 1 ? "month" : "months"} of the year.`,
                      )}
                    </p>
                  )}
                </SecaoDoPainel>

                <MercadoAusencias id="ainda-nao" titulo={tx("O que esta página ainda não mostra?", "What does this page not yet show?")} itens={ausentes} />

                <SecaoDoPainel id="agentes-analise" nivel="analisar" titulo={tx("Parcelas do ACL, agentes por mês e contagens do último mês", "ACL parcels, agents by month and counts for the latest month")}>
                  <GraficoLinhas
                    titulo={tx("Agentes contabilizados pela CCEE, total por mês", "Agents accounted by CCEE, total by month")}
                    dados={serieAgentesTotal(g)}
                    chaveX="mes"
                    formatoX="mes"
                    series={[{ id: "total", rotulo: tx("Agentes contabilizados", "Accounted agents"), cor: "var(--serie-4)", espessura: 2.5 }]} // i18n: dado
                    unidade={tx("agentes", "agents")}
                    casas={0}
                    altura={220}
                  />
                  <GraficoLinhas
                    titulo={tx("Parcelas de carga do ACL contabilizadas, mês a mês (CCEE)", "ACL load parcels accounted, month by month (CCEE)")}
                    dados={serieParcelas(g).map((x) => ({ mes: x.mes, parcelas: x.parcelas }))}
                    chaveX="mes"
                    formatoX="mes"
                    series={[{ id: "parcelas", rotulo: tx("Parcelas do ACL", "ACL parcels"), cor: "var(--serie-comp-1)", espessura: 2.5 }]}
                    unidade={tx("parcelas", "parcels")}
                    casas={0}
                    zeroNoEixo
                    altura={240}
                  />
                  {fora.length > 0 && (
                    <MercadoAviso>
                      {tx(
                        `Nos meses ${fora.map((x) => mesAno(x.mes)).join(", ")}, a soma das parcelas difere do consumo por classe acima de 5 MW médios; os meses ficam no gráfico e marcados na tabela.`,
                        `In ${fora.map((x) => mesAno(x.mes)).join(", ")}, the sum of the parcels differs from consumption by class by more than 5 MWavg; the months stay in the chart and are marked in the table.`,
                      )}
                    </MercadoAviso>
                  )}
                  {pum && (
                    <TabelaDados
                      titulo={tx(`Parcelas de carga do ACL por classe do perfil e por submercado, ${mesAno(pum.mes)}`, `ACL load parcels by profile class and by submarket, ${mesAno(pum.mes)}`)}
                      colunas={tx(["Recorte", "Parcelas", "Consumo (GWh)"], ["Breakdown", "Parcels", "Consumption (GWh)"])}
                      linhas={[
                        ...Object.entries(pum.por_classe_perfil).map(([c, v]) => [classe(c), v.parcelas, v.consumo_mwh === null ? null : v.consumo_mwh / 1e3] as (string | number | null)[]),
                        ...Object.entries(pum.por_submercado).map(([s, v]) => [tx(`Submercado ${nomeSubmercado(s)}`, `${nomeSubmercado(s)} submarket`), v ?? null, null] as (string | number | null)[]),
                      ]}
                      casas={[null, 0, 0]}
                    />
                  )}
                  {ucsClasse.mes && (
                    <TabelaDados
                      titulo={tx(`Unidades consumidoras livres por classe, ${mesAno(ucsClasse.mes)} (EPE)`, `Free consumer units by class, ${mesAno(ucsClasse.mes)} (EPE)`)}
                      colunas={tx(["Classe", "Unidades livres"], ["Class", "Free consumer units"])}
                      linhas={ucsClasse.linhas.map((l) => [classe(l.classe), l.livre_uc])}
                      casas={[null, 0]}
                    />
                  )}
                  {samp && (
                    <p className="text-sm leading-relaxed text-carvao-muted">
                      {tx(
                        <>
                          No SAMP, em {mesAno(samp.mes)} (último mês comparável), as distribuidoras faturaram {num(samp.livre_uc_incentivada, 0)} unidades livres incentivadas,{" "}
                          {num(samp.livre_uc_convencional, 0)} convencionais e {num(samp.livre_uc_autoproducao, 0)} de autoprodução.
                        </>,
                        <>
                          In SAMP, in {mesAno(samp.mes)} (latest comparable month), distribution utilities billed {num(samp.livre_uc_incentivada, 0)} incentivized free consumer units,{" "}
                          {num(samp.livre_uc_convencional, 0)} conventional ones and {num(samp.livre_uc_autoproducao, 0)} self-production ones.
                        </>,
                      )}
                    </p>
                  )}
                  <TabelaInterativa
                    titulo={tx("Parcelas de carga do ACL e migrações por mês (CCEE)", "ACL load parcels and migrations by month (CCEE)")}
                    colunas={colunasParcelas()}
                    linhas={linhasParcelas(g)}
                    chaveLinha="id"
                    colunaRotulo="mes"
                    fonte={tx("CCEE, PARCELA_CARGA_CONSUMO", "CCEE, open dataset of consumption load parcels")}
                    versao={versao}
                    nomeArquivo="mercado-parcelas"
                    chaveUrl="parc"
                    ordemInicial={{ coluna: "mes", direcao: "desc" }}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="agentes-auditoria" nivel="auditar" titulo={tx("Cadastro de perfis, agentes na ANEEL, pendências e conferências", "Profile registry, agents at ANEEL, pending items and checks")}>
                  {p && <MercadoVerificacoes painel={p} />}
                  <TabelaInterativa
                    chaveUrl="perf"
                    titulo={tx("Perfis e agentes por classe no cadastro de perfis da CCEE", "Profiles and agents by class in the CCEE profile registry")}
                    colunas={colunasPerfis()}
                    linhas={linhasPerfis(g).map((l) => ({ ...l, classe: classe(String(l.classe)) }))}
                    chaveLinha="id"
                    colunaRotulo="classe"
                    fonte="CCEE, LISTA_PERFIL_V1"
                    versao={perfis.data_modificacao_portal ? tx(`modificação informada pelo portal em ${dataBR(perfis.data_modificacao_portal)}`, `modification reported by the portal on ${dataBR(perfis.data_modificacao_portal)}`) : versao}
                    nomeArquivo="mercado-perfis"
                    nota={tx(
                      `${perfis.nota_data} Agentes por classe não se somam: um agente pode ter perfis em mais de uma classe. Capturado em ${carimbo(perfis.capturado_em)}.`,
                      `${traducaoExata(NOTAS_MERCADO_EN, perfis.nota_data, idioma) ?? perfis.nota_data} Agents by class cannot be added up: an agent can have profiles in more than one class. Captured on ${carimbo(perfis.capturado_em)}.`,
                    )}
                  />
                  <p className="text-sm leading-relaxed text-carvao-muted">
                    {tx(
                      <>
                        Cadastro da ANEEL (gerado em {dataBR(am.agentes_aneel.gerado_em)}): {num(am.agentes_aneel.cadastrados, 0)} agentes cadastrados, {num(am.agentes_aneel.ativos, 0)} ativos; entre os
                        ativos, {num(am.agentes_aneel.ativos_por_atividade.geracao, 0)} com atividade de geração, {num(am.agentes_aneel.ativos_por_atividade.comercializacao, 0)} de comercialização (
                        {num(am.agentes_aneel.ativos_so_comercializacao, 0)} só de comercialização), {num(am.agentes_aneel.ativos_por_atividade.distribuicao, 0)} de distribuição e{" "}
                        {num(am.agentes_aneel.ativos_por_atividade.transmissao, 0)} de transmissão. Um agente pode ter mais de uma atividade.
                      </>,
                      <>
                        ANEEL registry (generated on {dataBR(am.agentes_aneel.gerado_em)}): {num(am.agentes_aneel.cadastrados, 0)} registered agents, {num(am.agentes_aneel.ativos, 0)} active; among the
                        active ones, {num(am.agentes_aneel.ativos_por_atividade.geracao, 0)} in generation, {num(am.agentes_aneel.ativos_por_atividade.comercializacao, 0)} in energy trading (
                        {num(am.agentes_aneel.ativos_so_comercializacao, 0)} in trading only), {num(am.agentes_aneel.ativos_por_atividade.distribuicao, 0)} in distribution and{" "}
                        {num(am.agentes_aneel.ativos_por_atividade.transmissao, 0)} in transmission. An agent can have more than one activity.
                      </>,
                    )}
                  </p>
                  {pum && (
                    <p className="text-sm leading-relaxed text-carvao-muted">
                      {tx(
                        <>
                          Conferência de {mesAno(pum.mes)}: parcelas do ACL somam {num(pum.conferencia.parcelas_acl_mwmed, 1)} MW médios contra {num(pum.conferencia.classes_acl_mwmed, 1)} no consumo por classe
                          (resíduo de {num(pum.conferencia.residuo_acl_mwmed, 2)}); as parcelas das distribuidoras somam {num(pum.conferencia.parcelas_distribuidor_mwmed, 1)} contra{" "}
                          {num(pum.conferencia.classe_distribuidor_mwmed, 1)} da classe Distribuidor.
                        </>,
                        <>
                          Check for {mesAno(pum.mes)}: ACL parcels add up to {num(pum.conferencia.parcelas_acl_mwmed, 1)} MWavg against {num(pum.conferencia.classes_acl_mwmed, 1)} in consumption by class
                          (residual of {num(pum.conferencia.residuo_acl_mwmed, 2)}); distribution utility parcels add up to {num(pum.conferencia.parcelas_distribuidor_mwmed, 1)} against{" "}
                          {num(pum.conferencia.classe_distribuidor_mwmed, 1)} for the Distributor class.
                        </>,
                      )}
                    </p>
                  )}
                  <MercadoPendenciasAuditoria g={{ pendencias: g.pendencias.filter((x) => x.paineis.includes("P033")), bloqueios: g.bloqueios.filter((x) => x.paineis.includes("P033")) }} />
                  <MercadoDefinicoes g={g} chaves={["agente", "perfil", "parcela_de_carga", "unidade_consumidora", "migracao", "entrada_saida_agente", "desligamento", "variacao_liquida"]} />
                </SecaoDoPainel>

                {p && <MercadoLimitacoes painel={p} />}
                <SeguirPainel
                  ancora="agentes"
                  proximo={{ href: "/setor-eletrico/mercado/mre-e-gsf", pergunta: TITULO_PAGINA_MERCADO["mre-gsf"] }}
                  downloads={[CSV_MERCADO.ccee, CSV_MERCADO.desligamentos, CSV_MERCADO.agentesAneel, CSV_MERCADO.nacional].map((d) => ({ ...d }))}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
