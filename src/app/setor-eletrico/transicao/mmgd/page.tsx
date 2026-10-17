import type { Metadata, ResolvingMetadata } from "next";
import type { ReactNode } from "react";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoDestaques, TransicaoMmgdMensal, TransicaoMmgdPerfil, TransicaoMmgdUf, TransicaoMunicipios } from "@/components/energia/TransicaoMmgd";
import {
  TransicaoAnalise,
  TransicaoAuditoria,
  TransicaoAviso,
  TransicaoDatas,
  TransicaoDocumento,
  TransicaoIndisponivel,
  TransicaoNavegacao,
  NotaGold,
  TransicaoRecorte,
  TransicaoSeguir,
  TransicaoTabela,
} from "@/components/energia/TransicaoPagina";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { Nome } from "@/components/i18n/Nome";
import { carimbo } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { marcarNomes } from "@/lib/energia/i18n/qualidade-perdas";
import { MOTIVO_CEP_EN, RESULTADO_CONTROLE_EN } from "@/lib/energia/i18n/expansao-transicao-territorio";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  FONTE_ANEEL,
  FONTE_ANEEL_CADASTRO,
  colunasAnual,
  fonteTransicao,
  perguntaOns,
  semDado,
  cnpjFormatado,
  colunasDistribuidoras,
  conectadaNoAnoDeReferencia,
  contagem,
  dadosMensal,
  data,
  inteiro,
  linhasAnual,
  listasDestaque,
  linhasDistribuidoras,
  linhasFontes,
  linhasUfs,
  mes,
  mudancaMmgd,
  mudancaMmgdAno,
  nomesMunicipios,
  numTexto,
  participacaoTexto,
  pctTexto,
  perguntaPainel,
  primeiroAnoCoberto,
  respostaMmgd,
  rotaPainel,
  textoModalidadesRemotas,
  ufAnualCompacto,
  vereditoMmgd,
} from "@/lib/energia/transicao";
import type { GoldTransicao, MunicipiosMmgdArquivo } from "@/lib/energia/tipos-transicao";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/transicao/mmgd", {
    title: tx("MMGD no território: onde a geração distribuída cresce", "MMGD across the territory: where distributed generation is growing"),
    description: tx(
      "Micro e minigeração distribuída no cadastro da ANEEL por UF, município, distribuidora, fonte e perfil, com potência por habitante (IBGE), histórico de conexões, perfis e controles do cadastro. Capacidade instalada, não energia gerada.",
      "Distributed micro and mini generation (MMGD) in the ANEEL register by state, municipality, distribution utility, source and profile, with capacity per inhabitant (IBGE), connection history, profiles and register checks. Installed capacity, not energy generated.",
    ),
    alternates: { canonical: "/setor-eletrico/transicao/mmgd" },
  }, anterior);
}

/**
 * Nomes dos municípios das listas do modo Auditar que a gold publica só com o código
 * IBGE, lidos no build do JSON municipal publicado (o mesmo que o mapa baixa sob
 * demanda): fica no servidor e só os nomes dessas linhas entram no HTML. Arquivo
 * ausente ou ilegível: a tabela mostra o código, sem nome inventado.
 */
function nomesNoServidor(url: string, ids: string[]): Map<string, string> {
  try {
    const arq = JSON.parse(readFileSync(join(process.cwd(), "public", url), "utf-8")) as MunicipiosMmgdArquivo;
    return nomesMunicipios(arq, ids);
  } catch {
    return new Map();
  }
}

/**
 * P063, MMGD e distribuição territorial: o cadastro da ANEEL (capacidade, não
 * energia) no mapa por UF e por município, com histórico de conexões, perfis,
 * distribuidoras e controles. A estimativa de energia do ONS e a conferência do
 * achado A11 ficam na página seguinte (/energia-estimada), nunca somadas ao
 * cadastro. Leitura da gold transicao.json; todo número vem dela.
 */
export default function MmgdPage() {
  const g = lerGold<GoldTransicao>("transicao.json");
  if (!integra(g)) return <TransicaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const m = g.mmgd;
  const r = m.resumo;
  const ctl = m.controles;
  const fora = ctl.distribuidora_fora_da_uf;
  const cobertura = ctl.cobertura_das_series;
  const primeiroCoberto = primeiroAnoCoberto(cobertura.inicio_declarado);
  const anoCadastro = Number(m.data_cadastro.slice(0, 4));
  const anual = linhasAnual(m);
  const fontes = linhasFontes(m.fontes);
  const conectada = conectadaNoAnoDeReferencia(m);
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));
  const siglaDe = new Map(m.distribuidoras.map((d) => [d.cnpj, d.sigla ?? cnpjFormatado(d.cnpj)]));
  const dq = m.distribuicao_municipal.quantis_w_por_habitante;
  const modalidades = textoModalidadesRemotas(m.perfis);
  const nomesFora = fora.disponivel ? nomesNoServidor(g.mapa_municipios, fora.maiores_municipios.map((x) => x.ibge)) : new Map<string, string>();
  const oQueMudou = (
    <>
      {mudancaMmgdAno(m)}
      <span data-nivel="analisar" className="mt-2 block">
        {mudancaMmgd(m)}
      </span>
    </>
  );
  const comoInterpretar = tx(
    <>
      Unidades = empreendimentos no cadastro vigente; potência = soma da potência instalada informada (kW; MW nas tabelas). W por habitante = potência ÷ população estimada
      pelo IBGE, as duas somadas no território. Crescimento do estoque em {m.ano_referencia} = potência conectada no ano ÷ potência conectada até o fim de {m.ano_referencia - 1}. O ano
      de conexão vem da data publicada pela ANEEL, conferida com a data de conexão do recurso técnico. {g.regras.ano_referencia} Pelo Sistema de Compensação de Energia Elétrica (SCEE), a
      energia que a unidade injeta na rede vira crédito para abater o consumo, no mesmo local, em outra unidade do mesmo titular, entre condôminos ou entre os participantes de uma
      geração compartilhada. {g.regras.cadastro_x_estimativa}
    </>,
    <>
      Units = projects in the register in force; capacity = sum of the reported installed capacity (kW; MW in the tables). W per inhabitant = capacity ÷ population estimated
      by the IBGE, both summed over the territory. Stock growth in {m.ano_referencia} = capacity connected in the year ÷ capacity connected through the end of {m.ano_referencia - 1}. The
      connection year comes from the date published by ANEEL, checked against the connection date in the technical resource. <NotaGold texto={g.regras.ano_referencia} regiao="transicao-regra" />{" "}
      Under the Electric Energy Compensation System (SCEE), the energy the unit injects into the grid becomes a credit to offset consumption, at the same site, in another unit of the same
      holder, among condominium members or among the participants of shared generation. <NotaGold texto={g.regras.cadastro_x_estimativa} regiao="transicao-regra" />
    </>,
  );
  const naoConcluir = tx(
    <>
      Quanta energia cada lugar gera: o cadastro mede capacidade, e a geração não é publicada por unidade nem por município. Nada sobre renda ou perfil de quem tem o
      sistema: potência por habitante relaciona território, não pessoas. {modalidades} Os meses recentes ainda podem mudar, e unidades desativadas não aparecem no
      histórico.
    </>,
    <>
      How much energy each place generates: the register measures capacity, and generation is not published by unit or by municipality. Nothing about the income or profile of who owns
      the system: capacity per inhabitant relates territory, not people. {modalidades} Recent months may still change, and deactivated units do not appear in the
      history.
    </>,
  );
  const sd = semDado();
  const notaGold = (texto: string, regiao: string, tabela?: Readonly<Record<string, string>>): ReactNode => <NotaGold texto={texto} regiao={regiao} tabela={tabela} />;
  const resultado = (texto: string): ReactNode => tx<ReactNode>(texto, notaGold(texto, "transicao-controle", RESULTADO_CONTROLE_EN));

  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <MarcaVisita secao="energia:transicao-mmgd" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <TransicaoNavegacao atual="p063" />
        <CabecalhoModulo
          siglas={["MMGD", "SIN", "MWmed", "UC", "ANEEL", "ONS", "IBGE"]}
          rotulo={tx("Transição e ambiente", "Transition and environment")}
          titulo={perguntaPainel("p063")}
          lead={tx(
            <>
              Onde está e quanto cresce a <Termo slug="geracao-distribuida">micro e minigeração distribuída</Termo> (MMGD, a geração instalada junto às unidades consumidoras) cadastrada na ANEEL.
            </>,
            <>
              Where the <Termo slug="geracao-distribuida">distributed micro and mini generation</Termo> (MMGD, generation installed next to consumer units) registered with ANEEL is located and how much it grows.
            </>,
          )}
          recorte={tx(
            `Cadastro de ${data(m.data_cadastro)} · conexões de ${anual[0]?.ano ?? "sem dado"} a ${data(r.ultima_data_conexao)} · MW e W por habitante`,
            `Register of ${data(m.data_cadastro)} · connections from ${anual[0]?.ano ?? sd} to ${data(r.ultima_data_conexao)} · MW and W per inhabitant`,
          )}
          fonte={tx("ANEEL, relação de empreendimentos de MMGD; IBGE, população", "ANEEL, register of MMGD projects; IBGE, population")}
          referencia={tx(
            <>
              Cadastro da ANEEL gerado em {data(m.data_cadastro)} (capturado em {carimbo(m.proveniencia.cadastro.capturado_em)}); população estimada pelo IBGE para {m.ano_populacao ?? "sem dado"}.
              Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              ANEEL register generated on {data(m.data_cadastro)} (captured on {carimbo(m.proveniencia.cadastro.capturado_em)}); population estimated by the IBGE for {m.ano_populacao ?? sd}.
              Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <TransicaoDatas
              itens={[
                { rotulo: tx("Cadastro de MMGD (ANEEL)", "MMGD register (ANEEL)"), texto: tx(`gerado em ${data(m.data_cadastro)}`, `generated on ${data(m.data_cadastro)}`), natureza: "OBSERVADO" },
                { rotulo: tx("Conexões", "Connections"), texto: tx(`até ${data(r.ultima_data_conexao)}`, `through ${data(r.ultima_data_conexao)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("População (IBGE)", "Population (IBGE)"),
                  texto: tx(`estimativa para ${m.ano_populacao ?? "sem dado"}`, `estimate for ${m.ano_populacao ?? sd}`),
                  natureza: "CALCULADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores da MMGD no cadastro", "MMGD indicators in the register")}
              nota={tx<ReactNode>(g.regras.capacidade_nao_e_energia, notaGold(g.regras.capacidade_nao_e_energia, "transicao-regra"))}
            >
              <Numero
                variante="faixa"
                rotulo={tx("Potência instalada cadastrada", "Registered installed capacity")}
                natureza="OBSERVADO"
                evidencia={m.evidencias.potencia}
                casas={1}
                unidade="MW"
                cor="var(--serie-solar)"
                nota={tx(
                  `Capacidade, não energia. ${participacaoTexto(r.participacao_solar_potencia_pct)} solar.`,
                  `Capacity, not energy. ${participacaoTexto(r.participacao_solar_potencia_pct)} solar.`,
                )}
                endereco={`${rotaPainel("p063")}#p063`}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Unidades de MMGD no cadastro", "MMGD units in the register")}
                natureza="OBSERVADO"
                evidencia={m.evidencias.unidades}
                casas={0}
                unidade={tx("unidades", "units")}
                nota={tx(
                  `Empreendimentos geradores. As unidades consumidoras com crédito (${inteiro(r.ucs_recebem_credito)}) são outra contagem.`,
                  `Generating projects. The consumer units receiving credit (${inteiro(r.ucs_recebem_credito)}) are a different count.`,
                )}
                endereco={`${rotaPainel("p063")}#p063`}
              />
              <Numero
                variante="faixa"
                rotulo={tx(`Potência conectada em ${conectada?.ano ?? "sem dado"}`, `Capacity connected in ${conectada?.ano ?? sd}`)}
                natureza="OBSERVADO"
                valor={conectada?.potencia_mw ?? null}
                casas={1}
                unidade="MW"
                periodo={tx("ano completo, pela data de conexão", "full year, by connection date")}
                cor="var(--serie-solar)"
                nota={
                  conectada
                    ? tx(`Capacidade adicionada no ano, em ${inteiro(conectada.unidades)} unidades.`, `Capacity added in the year, in ${inteiro(conectada.unidades)} units.`)
                    : undefined
                }
                motivoAusencia={tx("Sem o último ano completo nesta publicação.", "No last full year in this release.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Potência por habitante no Brasil", "Capacity per inhabitant in Brazil")}
                natureza="CALCULADO"
                valor={r.w_por_habitante_brasil}
                casas={1}
                unidade={tx("W/hab", "W/inhab.")}
                periodo={tx(`população do IBGE para ${m.ano_populacao ?? "sem dado"}`, `IBGE population for ${m.ano_populacao ?? sd}`)}
                cor="var(--serie-referencia)"
                nota={tx("Potência instalada ÷ população estimada, as duas somadas no país.", "Installed capacity ÷ estimated population, both summed over the country.")}
                motivoAusencia={tx("Sem a população do IBGE nesta publicação.", "No IBGE population in this release.")}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            "A energia que essas unidades entregam ao SIN está na página da energia estimada pelo ONS, sem nunca ser somada ao cadastro. Unidades, potência e potência por habitante são lidas por UF, município, distribuidora e perfil, com a data do cadastro e a população do IBGE ao lado de cada medida.",
            "The energy these units deliver to the SIN is on the page of the energy estimated by the ONS, never added to the register. Units, capacity and capacity per inhabitant are read by state, municipality, distribution utility and profile, with the register date and the IBGE population next to each measure.",
          )}
        </CabecalhoModulo>
        {g.pendencias.length > 0 && (
          <div className="pb-4">
            <TransicaoAviso rotulo={tx("Blocos ausentes nesta publicação", "Blocks missing in this release")} alerta>
              {notaGold(g.pendencias.join(" "), "transicao-pendencias")}
            </TransicaoAviso>
          </div>
        )}
        <ModoProfundidade>
          <Bloco id="mmgd">
            <PainelEvidencia
              id="p063"
              pergunta={tx("Potência instalada por UF e por habitante", "Installed capacity by state and per inhabitant")}
              subtitulo={tx(
                "Micro e minigeração distribuída no cadastro da ANEEL · unidades, MW instalados e W por habitante",
                "Distributed micro and mini generation in the ANEEL register · units, installed MW and W per inhabitant",
              )}
              natureza="OBSERVADO"
              porQueImporta={tx(
                <>
                  A <Termo slug="geracao-distribuida">micro e minigeração distribuída</Termo> é a geração instalada junto às unidades consumidoras, quase toda solar. Ela cresce de forma
                  desigual pelo território, muda o que a distribuidora entrega e o que o ONS precisa prever, e entra na conta de quem gera pelo Sistema de Compensação de Energia Elétrica (SCEE).
                </>,
                <>
                  <Termo slug="geracao-distribuida">Distributed micro and mini generation</Termo> is generation installed next to consumer units, almost all of it solar. It grows unevenly
                  across the territory, changes what the distribution utility delivers and what the ONS needs to forecast, and enters the bill of whoever generates through the Electric Energy
                  Compensation System (SCEE).
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={m.proveniencia.cadastro}
              complementares={[{ rotulo: tx("Por habitante (ANEEL e IBGE)", "Per inhabitant (ANEEL and IBGE)"), p: m.proveniencia.por_habitante }]}
            >
              <div className="space-y-6">
                <RespostaCurta id="p063" veredito={marcarNomes(vereditoMmgd(m) || respostaMmgd(m), m.ufs.map((u) => u.nome), idiomaEnergia())}>
                  {marcarNomes(respostaMmgd(m), m.ufs.map((u) => u.nome), idiomaEnergia())}
                </RespostaCurta>
                <TransicaoMmgdUf
                  linhas={linhasUfs(m.ufs)}
                  ufAnual={ufAnualCompacto(m.uf_anual)}
                  anoReferencia={m.ano_referencia}
                  anoPopulacao={m.ano_populacao}
                  primeiroCoberto={primeiroCoberto}
                  wPorHabitanteBrasil={r.w_por_habitante_brasil}
                  dataCadastro={m.data_cadastro}
                  fonte={fonteTransicao(FONTE_ANEEL)}
                />
                <TransicaoRecorte
                  periodo={tx(
                    <>
                      Cadastro vigente em {data(m.data_cadastro)}; conexões de {anual[0]?.ano ?? "sem dado"} a {data(r.ultima_data_conexao)} (cobertura declarada pela ANEEL a partir
                      de {mes(cobertura.inicio_declarado.slice(0, 7))}); ano de referência {m.ano_referencia}
                    </>,
                    <>
                      Register in force on {data(m.data_cadastro)}; connections from {anual[0]?.ano ?? sd} to {data(r.ultima_data_conexao)} (coverage declared by ANEEL from{" "}
                      {mes(cobertura.inicio_declarado.slice(0, 7))}); reference year {m.ano_referencia}
                    </>,
                  )}
                  universo={tx(
                    <>
                      {inteiro(r.unidades)} unidades em {inteiro(r.municipios_com_mmgd)} de {inteiro(r.municipios_no_cadastro_ibge)} municípios; {inteiro(m.distribuidoras.length)}{" "}
                      distribuidoras (CNPJ)
                    </>,
                    <>
                      {inteiro(r.unidades)} units in {inteiro(r.municipios_com_mmgd)} of {inteiro(r.municipios_no_cadastro_ibge)} municipalities; {inteiro(m.distribuidoras.length)} distribution
                      utilities (CNPJ)
                    </>,
                  )}
                  unidade={tx(
                    <>Unidades; potência instalada em kW e MW (capacidade, não energia); W por habitante com a população do IBGE de {m.ano_populacao ?? "sem dado"}</>,
                    <>Units; installed capacity in kW and MW (capacity, not energy); W per inhabitant with the IBGE population of {m.ano_populacao ?? sd}</>,
                  )}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="por-ano" titulo={tx("Quanto foi conectado a cada ano no Brasil?", "How much was connected each year in Brazil?")}>
                  <GraficoBarras
                    titulo={tx(
                      `Potência conectada por ano de conexão, Brasil (cadastro de ${data(m.data_cadastro)})`,
                      `Capacity connected by year of connection, Brazil (register of ${data(m.data_cadastro)})`,
                    )}
                    dados={anual}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[{ id: "potencia_mw", rotulo: tx("Potência conectada no ano", "Capacity connected in the year"), cor: "var(--serie-solar)" }]}
                    unidade="MW"
                    casas={1}
                    altura={300}
                  />
                  <TabelaInterativa
                    titulo={tx("Conexões e estoque por ano, Brasil", "Connections and stock by year, Brazil")}
                    colunas={colunasAnual()}
                    linhas={anual}
                    chaveLinha="id"
                    colunaRotulo="ano" // i18n: dado
                    fonte={fonteTransicao(FONTE_ANEEL_CADASTRO)}
                    versao={m.data_cadastro}
                    nomeArquivo="transicao-mmgd-anual"
                    chaveUrl="mmgd.ano" // i18n: dado
                    ordemInicial={{ coluna: "ano", direcao: "desc" }} // i18n: dado
                    dicaBusca={tx("Ano", "Year")}
                    nota={tx<ReactNode>(
                      `${cobertura.regra} O estoque inclui ${contagem(cobertura.unidades_anteriores, "registro anterior", "registros anteriores")} à cobertura e exclui ${contagem(r.unidades_sem_data, "unidade", "unidades")} sem data de conexão (no total do cadastro).`,
                      <>
                        {notaGold(cobertura.regra, "transicao-cobertura")} The stock includes {contagem(cobertura.unidades_anteriores, "record", "records")} prior to the coverage and excludes{" "}
                        {contagem(r.unidades_sem_data, "unit", "units")} without a connection date (in the register total).
                      </>,
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="fontes" titulo={tx("Com que fonte?", "With which source?")}>
                  <GraficoBarras
                    titulo={tx("Potência instalada por fonte de geração", "Installed capacity by generation source")}
                    dados={fontes}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[{ id: "potencia_mw", rotulo: tx("Potência instalada", "Installed capacity"), cor: "var(--serie-solar)" }]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <TransicaoTabela
                    titulo={tx("Unidades, potência e participação por fonte", "Units, capacity and share by source")}
                    colunas={tx(["Fonte", "Unidades", "Potência (MW)", "Participação na potência"], ["Source", "Units", "Capacity (MW)", "Share of capacity"])}
                    numericas={[1, 2, 3]}
                    linhas={fontes.map((f) => [f.rotulo, inteiro(f.unidades), numTexto(f.potencia_mw, 3), participacaoTexto(f.participacao_potencia_pct)])}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="perfil" titulo={tx("Quem tem: classe, modalidade, porte e tipo de consumidor", "Who owns it: class, modality, size and consumer type")}>
                  <TransicaoMmgdPerfil perfis={m.perfis} anoReferencia={m.ano_referencia} />
                  <div data-nivel="analisar" className="space-y-3">
                    {m.documentos.map((d) => (
                      <TransicaoDocumento key={d.url + d.titulo} doc={d} />
                    ))}
                  </div>
                </SecaoDoPainel>

                <SecaoDoPainel id="municipios" titulo={tx("E nos municípios: destaques e mapa", "And in the municipalities: highlights and map")}>
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        Entre os {inteiro(m.distribuicao_municipal.municipios_com_populacao)} municípios com população estimada, a potência por habitante vai de {numTexto(dq.p10, 1)} W/hab
                        (10% dos municípios abaixo) a {numTexto(dq.p90, 1)} W/hab (10% acima), com mediana de {numTexto(dq.p50, 1)}. {contagem(m.distribuicao_municipal.municipios_sem_mmgd, "município não tem", "municípios não têm")} nenhuma unidade. Rankings só com população de pelo menos {inteiro(m.municipios_destaque.populacao_minima_ranking)} habitantes e potência
                        completa.
                      </>,
                      <>
                        Among the {inteiro(m.distribuicao_municipal.municipios_com_populacao)} municipalities with an estimated population, capacity per inhabitant ranges from{" "}
                        {numTexto(dq.p10, 1)} W/inhab. (10% of municipalities below) to {numTexto(dq.p90, 1)} W/inhab. (10% above), with a median of {numTexto(dq.p50, 1)}.{" "}
                        {contagem(m.distribuicao_municipal.municipios_sem_mmgd, "municipality has", "municipalities have")} no unit at all. Rankings only with a population of at least{" "}
                        {inteiro(m.municipios_destaque.populacao_minima_ranking)} inhabitants and complete capacity.
                      </>,
                    )}
                  </p>
                  <TransicaoDestaques listas={listasDestaque(m.municipios_destaque)} anoReferencia={m.ano_referencia} populacaoMinima={m.municipios_destaque.populacao_minima_ranking} />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        &ldquo;Distribuidora sem conjunto na UF&rdquo;: unidades do município cuja distribuidora (CNPJ) não tem conjunto elétrico na UF (detalhe no modo Auditar). Crescimento
                        alto pode refletir um estoque inicial pequeno: leia junto com a potência.
                      </>,
                      <>
                        &ldquo;Utility with no consumer set in the state&rdquo;: units of the municipality whose distribution utility (CNPJ) has no consumer set in the state (detail in Audit
                        mode). High growth may reflect a small initial stock: read it together with capacity.
                      </>,
                    )}
                  </p>
                  <TransicaoMunicipios
                    jsonUrl={g.mapa_municipios}
                    csvUrl="/energia/series/transicao_mmgd_municipio_ano_fonte.csv"
                    anoReferencia={m.ano_referencia}
                    anoPopulacao={m.ano_populacao}
                    anoFinal={anoCadastro}
                    primeiroCoberto={primeiroCoberto}
                    fonte={fonteTransicao(FONTE_ANEEL)}
                    versao={m.data_cadastro}
                  />
                </SecaoDoPainel>

                <TransicaoAnalise titulo={tx("Mês a mês: conexões e estoque", "Month by month: connections and stock")}>
                  <TransicaoMmgdMensal dados={dadosMensal(m.mensal)} corte={m.corte_provisorio} />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {tx(
                      <>
                        {g.regras.provisorio} Meses antes de {mes(cobertura.inicio_declarado.slice(0, 7))} sem registro ficam em branco: a ANEEL não declara cobertura ali. A série por UF e mês
                        está no CSV por UF, mês e fonte.
                      </>,
                      <>
                        {notaGold(g.regras.provisorio, "transicao-regra")} Months before {mes(cobertura.inicio_declarado.slice(0, 7))} without records are left blank: ANEEL declares no coverage
                        there. The series by state and month is in the CSV by state, month and source.
                      </>,
                    )}
                  </p>
                </TransicaoAnalise>

                <TransicaoAnalise titulo={tx("Distribuidoras", "Distribution utilities")}>
                  <TabelaInterativa
                    titulo={tx(`MMGD por distribuidora (CNPJ), cadastro de ${data(m.data_cadastro)}`, `MMGD by distribution utility (CNPJ), register of ${data(m.data_cadastro)}`)}
                    colunas={colunasDistribuidoras(m.ano_referencia)}
                    linhas={linhasDistribuidoras(m.distribuidoras)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={fonteTransicao(FONTE_ANEEL_CADASTRO)}
                    versao={m.data_cadastro}
                    nomeArquivo="transicao-mmgd-distribuidoras"
                    chaveUrl="mmgd.dist"
                    ordemInicial={{ coluna: "potencia_mw", direcao: "desc" }}
                    dicaBusca={tx("Sigla, nome ou CNPJ", "Acronym, name or CNPJ")}
                    nota={tx(
                      "A distribuidora é identificada pelo CNPJ de 14 dígitos; sigla e nome são os publicados. Quando o aviso aparece, parte do total provavelmente é de outra distribuidora.",
                      "The distribution utility is identified by its 14-digit CNPJ; acronym and name are the published ones. When the warning appears, part of the total probably belongs to another utility.",
                    )}
                  />
                </TransicaoAnalise>

                <TransicaoAuditoria titulo={tx("Controles do cadastro", "Register checks")}>
                  <TransicaoTabela
                    titulo={tx(`Controles executados a cada publicação (arquivo de ${data(m.data_cadastro)})`, `Checks run on every release (file of ${data(m.data_cadastro)})`)}
                    colunas={tx(["Controle", "Valor", "Resultado"], ["Check", "Value", "Result"])}
                    linhas={[
                      [
                        tx("Linhas do arquivo e códigos distintos", "File rows and distinct codes"),
                        tx(
                          `${inteiro(ctl.linhas_do_arquivo)} linhas; ${inteiro(ctl.codigos_distintos)} códigos; ${inteiro(ctl.codigos_repetidos)} repetidos`,
                          `${inteiro(ctl.linhas_do_arquivo)} rows; ${inteiro(ctl.codigos_distintos)} codes; ${inteiro(ctl.codigos_repetidos)} repeated`,
                        ),
                        ctl.codigos_repetidos === 0 ? tx("aprovado", "passed") : tx("reprovado", "failed"),
                      ],
                      [
                        tx("Estoque com data + sem data = total", "Stock with date + without date = total"),
                        tx(
                          `${inteiro(ctl.identidade_estoque.unidades_com_data_serie_anual)} + ${inteiro(ctl.identidade_estoque.unidades_sem_data)} = ${inteiro(ctl.identidade_estoque.unidades_total)} unidades; diferença de ${numTexto(ctl.identidade_estoque.diferenca_kw, 2)} kW (tolerância ${numTexto(ctl.identidade_estoque.tolerancia_kw, 2)} kW)`,
                          `${inteiro(ctl.identidade_estoque.unidades_com_data_serie_anual)} + ${inteiro(ctl.identidade_estoque.unidades_sem_data)} = ${inteiro(ctl.identidade_estoque.unidades_total)} units; difference of ${numTexto(ctl.identidade_estoque.diferenca_kw, 2)} kW (tolerance ${numTexto(ctl.identidade_estoque.tolerancia_kw, 2)} kW)`,
                        ),
                        resultado(ctl.identidade_estoque.resultado),
                      ],
                      [
                        tx("Município e UF somam o mesmo", "Municipality and state add up to the same"),
                        tx(
                          `${inteiro(ctl.identidade_agregacao.unidades)} unidades; diferença de ${numTexto(ctl.identidade_agregacao.diferenca_kw_municipio_uf, 2)} kW`,
                          `${inteiro(ctl.identidade_agregacao.unidades)} units; difference of ${numTexto(ctl.identidade_agregacao.diferenca_kw_municipio_uf, 2)} kW`,
                        ),
                        resultado(ctl.identidade_agregacao.resultado),
                      ],
                      [
                        tx("Data de conexão conferida com o recurso técnico", "Connection date checked against the technical resource"),
                        tx(
                          `${inteiro(ctl.data_de_conexao.datas_iguais)} de ${inteiro(ctl.data_de_conexao.ufv_na_relacao)} datas e ${inteiro(ctl.data_de_conexao.potencias_iguais)} potências iguais`,
                          `${inteiro(ctl.data_de_conexao.datas_iguais)} of ${inteiro(ctl.data_de_conexao.ufv_na_relacao)} dates and ${inteiro(ctl.data_de_conexao.potencias_iguais)} capacities equal`,
                        ),
                        resultado(ctl.data_de_conexao.resultado),
                      ],
                      [
                        tx("Duplicidade candidata (medida, não removida)", "Candidate duplicates (measured, not removed)"),
                        tx(
                          `${inteiro(ctl.duplicidade_candidata.grupos)} grupos; ${inteiro(ctl.duplicidade_candidata.linhas_extras)} unidades a mais (${pctTexto(ctl.duplicidade_candidata.participacao_unidades_pct, 2)}); ${numTexto(ctl.duplicidade_candidata.potencia_kw_extras === null ? null : ctl.duplicidade_candidata.potencia_kw_extras / 1000, 1)} MW`,
                          `${inteiro(ctl.duplicidade_candidata.grupos)} groups; ${inteiro(ctl.duplicidade_candidata.linhas_extras)} extra units (${pctTexto(ctl.duplicidade_candidata.participacao_unidades_pct, 2)}); ${numTexto(ctl.duplicidade_candidata.potencia_kw_extras === null ? null : ctl.duplicidade_candidata.potencia_kw_extras / 1000, 1)} MW`,
                        ),
                        tx<ReactNode>(ctl.duplicidade_candidata.tratamento, notaGold(ctl.duplicidade_candidata.tratamento, "transicao-controle")),
                      ],
                      [
                        tx("Potência ausente, negativa e zero", "Missing, negative and zero capacity"),
                        tx(
                          `${inteiro(ctl.potencia_ausente)} ausentes; ${inteiro(ctl.potencia_negativa)} negativas; ${inteiro(ctl.potencia_zero)} iguais a zero; ${inteiro(ctl.unidades_sem_potencia_nos_agregados)} sem potência nos agregados`,
                          `${inteiro(ctl.potencia_ausente)} missing; ${inteiro(ctl.potencia_negativa)} negative; ${inteiro(ctl.potencia_zero)} equal to zero; ${inteiro(ctl.unidades_sem_potencia_nos_agregados)} without capacity in the aggregates`,
                        ),
                        tx<ReactNode>(g.regras.potencia_ausente, notaGold(g.regras.potencia_ausente, "transicao-regra")),
                      ],
                      [
                        tx("Datas de conexão sentinela (inválidas)", "Sentinel connection dates (invalid)"),
                        tx(
                          `${contagem(ctl.datas_sentinela, "unidade", "unidades")}; ${numTexto(ctl.potencia_sem_data_kw, 2)} kW`,
                          `${contagem(ctl.datas_sentinela, "unit", "units")}; ${numTexto(ctl.potencia_sem_data_kw, 2)} kW`,
                        ),
                        tx("no estoque, sem ano de conexão", "in the stock, without connection year"),
                      ],
                      [
                        tx("Antes da cobertura declarada", "Before the declared coverage"),
                        tx(
                          `${contagem(cobertura.unidades_anteriores, "registro", "registros")}; ${contagem(cobertura.pontos_nulos_anual, "ano nulo", "anos nulos")} e ${contagem(cobertura.pontos_nulos_mensal, "mês nulo", "meses nulos")}`,
                          `${contagem(cobertura.unidades_anteriores, "record", "records")}; ${contagem(cobertura.pontos_nulos_anual, "null year", "null years")} and ${contagem(cobertura.pontos_nulos_mensal, "null month", "null months")}`,
                        ),
                        tx("rotulados fora da cobertura", "labeled outside coverage"),
                      ],
                      [
                        tx("Código de município de 6 dígitos completado", "6-digit municipality code completed"),
                        inteiro(ctl.municipio_codigo_6_digitos_completado),
                        tx("só quando o prefixo é único no IBGE", "only when the prefix is unique in the IBGE"),
                      ],
                      [
                        tx("UF publicada ausente ou divergente do município", "Published state missing or diverging from the municipality"),
                        tx(
                          `${inteiro(ctl.uf_publicada_ausente)} ausente; ${inteiro(ctl.uf_publicada_diverge_do_municipio)} divergentes`,
                          `${inteiro(ctl.uf_publicada_ausente)} missing; ${inteiro(ctl.uf_publicada_diverge_do_municipio)} diverging`,
                        ),
                        tx("UF pelo código IBGE", "state by IBGE code"),
                      ],
                      [tx("Fonte não informada", "Source not reported"), inteiro(ctl.fonte_nao_informada), tx("categoria própria", "own category")],
                      [
                        tx("Período de referência publicado", "Published reference period"),
                        ctl.periodo_referencia_publicado ?? sd,
                        tx(
                          `conexões de ${data(ctl.data_conexao_minima)} a ${data(ctl.data_conexao_maxima)}`,
                          `connections from ${data(ctl.data_conexao_minima)} to ${data(ctl.data_conexao_maxima)}`,
                        ),
                      ],
                    ]}
                  />
                </TransicaoAuditoria>

                <TransicaoAuditoria titulo={tx("Unidades em UF onde a distribuidora não tem conjunto elétrico", "Units in a state where the distribution utility has no consumer set")}>
                  {fora.disponivel ? (
                    <>
                      <p className="max-w-prose2 text-sm text-carvao-muted">
                        {tx(
                          <>
                            {inteiro(fora.unidades)} unidades ({numTexto(fora.potencia_kw / 1000, 1)} MW, {participacaoTexto(fora.participacao_unidades_pct)} do cadastro) em{" "}
                            {contagem(fora.municipios_sinalizados, "município", "municípios")}, de {contagem(fora.distribuidoras_com_unidades_fora, "distribuidora", "distribuidoras")}. {g.regras.distribuidora_fora_da_uf}{" "}
                            Tratamento: {fora.tratamento}. Referência: {fora.referencia.regra}.
                          </>,
                          <>
                            {inteiro(fora.unidades)} units ({numTexto(fora.potencia_kw / 1000, 1)} MW, {participacaoTexto(fora.participacao_unidades_pct)} of the register) in{" "}
                            {contagem(fora.municipios_sinalizados, "municipality", "municipalities")}, from {contagem(fora.distribuidoras_com_unidades_fora, "distribution utility", "distribution utilities")}.{" "}
                            {notaGold(g.regras.distribuidora_fora_da_uf, "transicao-regra")} Treatment: {notaGold(fora.tratamento, "transicao-controle")}. Reference:{" "}
                            {notaGold(fora.referencia.regra, "transicao-controle")}.
                          </>,
                        )}
                      </p>
                      {fora.classes_pelo_cep.disponivel ? (
                        <>
                          <TransicaoTabela
                            titulo={tx("Classes pelo CEP publicado", "Classes by published postal code (CEP)")}
                            colunas={tx(["Classe", "Unidades", "Potência (kW)", "Municípios", "Distribuidoras"], ["Class", "Units", "Capacity (kW)", "Municipalities", "Distribution utilities"])}
                            numericas={[1, 2, 3, 4]}
                            linhas={fora.classes_pelo_cep.classes.map((c) => [
                              tx<ReactNode>(c.rotulo, notaGold(c.rotulo, "transicao-controle")),
                              inteiro(c.unidades),
                              numTexto(c.potencia_kw, 2),
                              inteiro(c.municipios),
                              inteiro(c.distribuidoras),
                            ])}
                          />
                          <TransicaoTabela
                            titulo={tx("Indeterminadas, por motivo", "Undetermined, by reason")}
                            colunas={tx(["Motivo", "Unidades", "Potência (kW)"], ["Reason", "Units", "Capacity (kW)"])}
                            numericas={[1, 2]}
                            linhas={fora.classes_pelo_cep.indeterminadas_por_motivo.map((x) => {
                              const motivo = x.motivo.replace(/_/g, " ");
                              return [tx<ReactNode>(motivo, notaGold(motivo, "transicao-controle", MOTIVO_CEP_EN)), inteiro(x.unidades), numTexto(x.potencia_kw, 2)];
                            })}
                          />
                          <p className="max-w-prose2 text-sm text-carvao-muted">
                            {tx(
                              <>
                                {fora.classes_pelo_cep.orientacao} Referência da UF do CEP: {fora.classes_pelo_cep.referencia_uf_do_cep.regra}
                              </>,
                              <>
                                {notaGold(fora.classes_pelo_cep.orientacao, "transicao-controle")} Reference for the state of the postal code:{" "}
                                {notaGold(fora.classes_pelo_cep.referencia_uf_do_cep.regra, "transicao-controle")}
                              </>,
                            )}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-carvao-muted">
                          {tx(
                            <>Classes pelo CEP indisponíveis nesta publicação: {fora.classes_pelo_cep.motivo}</>,
                            <>Classes by postal code unavailable in this release: {notaGold(fora.classes_pelo_cep.motivo, "transicao-controle")}</>,
                          )}
                        </p>
                      )}
                      <div className="grid gap-6 lg:grid-cols-2">
                        <TransicaoTabela
                          titulo={tx("Distribuidoras com mais unidades fora da área", "Distribution utilities with the most units outside their area")}
                          colunas={tx(["Distribuidora", "Unidades", "Potência (kW)", "UF sem conjunto"], ["Distribution utility", "Units", "Capacity (kW)", "State with no consumer set"])}
                          numericas={[1, 2]}
                          linhas={fora.por_distribuidora.slice(0, 10).map((x) => [siglaDe.get(x.cnpj) ?? cnpjFormatado(x.cnpj), inteiro(x.unidades), numTexto(x.potencia_kw, 2), x.ufs_fora.join(", ")])}
                        />
                        <TransicaoTabela
                          titulo={tx("Municípios com mais unidades sinalizadas", "Municipalities with the most flagged units")}
                          colunas={tx(["Município", "Código IBGE", "Unidades", "Potência (kW)"], ["Municipality", "IBGE code", "Units", "Capacity (kW)"])}
                          numericas={[2, 3]}
                          linhas={fora.maiores_municipios.map((x) => {
                            const nome = nomesFora.get(x.ibge);
                            return [
                              nome ? tx<ReactNode>(nome, <Nome>{nome}</Nome>) : tx("nome indisponível", "name unavailable"),
                              x.ibge,
                              inteiro(x.unidades),
                              numTexto(x.potencia_kw, 2),
                            ];
                          })}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-carvao-muted">
                      {tx(<>Conferência indisponível nesta publicação: {fora.motivo}</>, <>Check unavailable in this release: {notaGold(fora.motivo, "transicao-controle")}</>)}
                    </p>
                  )}
                </TransicaoAuditoria>

                <TransicaoAuditoria titulo={tx("Revisões entre capturas do cadastro", "Revisions between captures of the register")}>
                  {m.revisoes.capturas_comparadas < 2 ? (
                    <p className="max-w-prose2 text-sm text-carvao-muted">
                      {m.revisoes.nota
                        ? tx<ReactNode>(m.revisoes.nota, notaGold(m.revisoes.nota, "transicao-revisoes"))
                        : tx("Uma única captura integrada: sem revisão medida.", "A single capture integrated: no revision measured.")}
                    </p>
                  ) : (
                    <TransicaoTabela
                      titulo={tx(
                        `Meses de conexão que mudaram entre ${data(m.revisoes.primeira_captura)} e ${data(m.revisoes.ultima_captura)}`,
                        `Connection months that changed between ${data(m.revisoes.primeira_captura)} and ${data(m.revisoes.ultima_captura)}`,
                      )}
                      colunas={tx(["Mês", "Unidades antes", "Unidades depois", "MW antes", "MW depois"], ["Month", "Units before", "Units after", "MW before", "MW after"])}
                      numericas={[1, 2, 3, 4]}
                      linhas={m.revisoes.meses.map((x) => [mes(x.m), inteiro(x.unidades_primeira), inteiro(x.unidades_ultima), numTexto(x.potencia_mw_primeira, 3), numTexto(x.potencia_mw_ultima, 3)])}
                    />
                  )}
                </TransicaoAuditoria>

                <TransicaoSeguir
                  ancora="p063"
                  href={`${rotaPainel("ons")}#ons`}
                  pergunta={perguntaOns()}
                  downloads={downloads([
                    "/energia/series/transicao_mmgd_municipios.csv",
                    "/energia/series/transicao_mmgd_municipio_ano_fonte.csv",
                    "/energia/series/transicao_mmgd_uf_mes_fonte.csv",
                    "/energia/series/transicao_mmgd_distribuidoras.csv",
                    "/energia/series/transicao_mmgd_perfil.csv",
                  ])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

        </ModoProfundidade>
      </main>
    </>
  );
}
