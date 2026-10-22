import type { ReactNode } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { Nome } from "@/components/i18n/Nome";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasControle } from "@/components/energia/EmpresasControle";
import {
  EmpresasAviso,
  EmpresasDatas,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasNota,
  EmpresasRecorte,
  EmpresasSeguir,
} from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_MOTIVOS,
  COLUNAS_NIVEIS,
  COLUNAS_PERIODOS_POLIMERO,
  COLUNAS_TIPOS,
  COR_MEDIDA,
  LIMIARES_HHI_CADE,
  ROTULO_FAIXA,
  ancoraPainel,
  barrasGrupos,
  dataTexto,
  downloadsDe,
  entidadesControle,
  inteiro,
  linhasGrupos,
  linhasMotivos,
  linhasNiveis,
  linhasPeriodosPolimero,
  linhasTipos,
  mwTexto,
  painel,
  pctTexto,
  respostaControle,
  rotaPainel,
  textoFronteiraNoCadastro,
  textoTipos,
  trimestreTexto,
  vereditoControle,
} from "@/lib/energia/empresas";
import { arvoreDoArquivo } from "@/lib/energia/empresas-arquivos";
import { carimbo, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import { tx } from "@/lib/energia/idioma";
import { DEFINICAO_EMPRESAS_EN, DOWNLOAD_EMPRESAS_EN, LIMITACAO_EMPRESAS_EN, comNomes, traduzir } from "@/lib/energia/i18n/empresas-leiloes";
import { metrica } from "@/lib/energia/metricas";
import { SIGLAS, SIGLAS_IDIOMAS } from "@/lib/energia/siglas";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/empresas/controle", {
    title: tx("Quem controla e qual a concentração? Grupos e HHI da capacidade", "Who controls and how concentrated is it? Groups and capacity HHI"),
    description: tx(
      "Grupos de controle declarados à ANEEL (Composição Societária), capacidade proporcional e capacidade sob controle por grupo, árvore societária de cada CNPJ e HHI, CR4 e CR10 da potência em operação sobre fronteira explícita.",
      "Controlling groups declared to ANEEL in its shareholding structure dataset, proportional capacity and capacity under control by group, shareholding tree of each CNPJ and HHI, CR4 and CR10 of the capacity in operation over an explicit boundary.",
    ),
    alternates: { canonical: "/setor-eletrico/empresas/controle" },
  }, anterior);
}

/** Definição ou regra publicada pela gold, no idioma da página (tabela exata; sem forma inglesa, o texto como veio). */
const def = (x: string) => comNomes(traduzir(DEFINICAO_EMPRESAS_EN, x));
const lim = (x: string) => comNomes(traduzir(LIMITACAO_EMPRESAS_EN, x));

export default function PaginaP039() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cadastro;
  const d = g.distribuidoras;
  const ct = g.controle;
  const datas = g.datas;
  const grupo = ct.concentracao.grupo_proporcional;
  // fonte das tabelas (texto puro, que vai também para o arquivo baixado): em inglês, a base pela descrição; o nome próprio fica no cabeçalho
  const fontePolimero = tx("ANEEL, SIGA e Composição Societária (Polímero)", "ANEEL, SIGA and shareholding structure declarations");
  const fonteMotivos = tx("ANEEL, Composição Societária (Polímero)", "ANEEL, shareholding structure declarations");
  const janela = datas.polimero_janela.length
    ? tx(
        `${trimestreTexto(datas.polimero_janela[0])} a ${trimestreTexto(datas.polimero_janela.at(-1))}`,
        `${trimestreTexto(datas.polimero_janela[0])} to ${trimestreTexto(datas.polimero_janela.at(-1))}`,
      )
    : tx("sem janela", "no window");
  const inicioJanela = datas.polimero_janela.length ? trimestreTexto(datas.polimero_janela[0]) : tx("sem janela", "no window");
  const dataSiga = dataTexto(ct.fronteira.data);
  const bloqueioP039 = g.bloqueios.filter((b) => b.painel === "P039");
  // árvore do maior grupo já na página; as demais vêm do arquivo da cadeia no navegador
  const padraoGrupo = ct.grupos[0]?.cnpj ?? "";
  const arvoreInicial = padraoGrupo ? arvoreDoArquivo(g.series.cadeia, padraoGrupo) : null;
  const regraCade = metrica("empresas_hhi_capacidade")?.regras_comparabilidade.find((r) => r.includes("CADE")) ?? null;
  const csvGrupos0 = g.downloads.find((x) => x.url === "/energia/series/empresas_grupos.csv") ?? null;
  const csvGrupos = csvGrupos0 ? { ...csvGrupos0, rotulo: traduzir(DOWNLOAD_EMPRESAS_EN, csvGrupos0.rotulo) } : null;
  const aprovada = (ok: boolean) => (ok ? tx("aprovada", "passed") : tx("reprovada", "failed"));

  const oQueMudou = tx(
    <>
      A cadeia de controle usa a última declaração de cada agente de {janela} (referência: {trimestreTexto(ct.polimero?.trimestre_referencia)}, com {inteiro(ct.polimero?.declarantes)} declarantes);{" "}
      {inteiro(ct.polimero?.agentes_com_mudanca_relevante_declarada)} agentes declararam mudança societária relevante em algum momento da base.
    </>,
    <>
      The control chain uses each agent&apos;s latest declaration from {janela} (reference: {trimestreTexto(ct.polimero?.trimestre_referencia)}, with {inteiro(ct.polimero?.declarantes)} declaring
      agents); {inteiro(ct.polimero?.agentes_com_mudanca_relevante_declarada)} agents declared a relevant change in shareholding at some point in the database.
    </>,
  );
  const comoInterpretar = tx(
    <>
      {g.definicoes.hhi} {regraCade ?? ""} A capacidade proporcional do grupo soma as participações diretas das empresas do grupo; a capacidade sob controle conta a usina inteira quando o dono
      majoritário está no grupo. As duas medidas não se somam.
    </>,
    <>
      {def(g.definicoes.hhi)} {regraCade ? def(regraCade) : ""} The group&apos;s proportional capacity adds up the direct stakes of the group&apos;s companies; capacity under control counts the whole
      plant when the majority owner is in the group. The two measures are not added together.
    </>,
  );
  const naoConcluir = tx(
    <>
      A fronteira é capacidade instalada em operação, não energia vendida nem mercado relevante de uma análise concorrencial: o HHI aqui não diz se há poder de mercado. Participação econômica
      indireta (multiplicar as frações ao longo da cadeia) não é calculada. Controle por acordo de acionistas não está na fonte.
    </>,
    <>
      The boundary is installed capacity in operation, not energy sold nor the relevant market of a competition analysis: the HHI here does not say whether there is market power. Indirect economic
      interest (multiplying the fractions along the chain) is not calculated. Control through shareholders&apos; agreements is not in the source.
    </>,
  );
  const referenciasCade = [
    { valor: LIMIARES_HHI_CADE.moderado, rotulo: tx("início da faixa moderadamente concentrada (CADE)", "start of the moderately concentrated band (CADE)") },
    { valor: LIMIARES_HHI_CADE.alto, rotulo: tx("acima: altamente concentrada (CADE)", "above: highly concentrated (CADE)") },
  ];
  const rotuloDefinicao = {
    grupo: tx("Grupo", "Group"),
    capacidade_proporcional_grupo: tx("Capacidade proporcional do grupo", "Proportional capacity of the group"),
    capacidade_controle_grupo: tx("Capacidade sob controle do grupo", "Capacity under the group's control"),
  };

  return (
    <>
      <header><CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" navegacao="setor-eletrico" idiomas /></header>
      <MarcaVisita secao="energia:empresas-controle" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="p039" />
        <CabecalhoModulo
          rotulo={tx("Empresas", "Companies")}
          siglas={["SIGA", "HHI", "CR4", "CR10", "ANEEL", "CADE", "CNPJ"]}
          titulo={painel("p039").pergunta}
          lead={tx(
            `Grupos no topo da cadeia de controle declarada à ANEEL (${SIGLAS.ANEEL}): quanta capacidade detêm e controlam, e quão concentrada ela está.`,
            `Groups at the top of the control chain declared to ANEEL (${SIGLAS_IDIOMAS.en.ANEEL}): how much capacity they hold and control, and how concentrated it is.`,
          )}
          recorte={tx(
            `Usinas em operação do SIGA (${SIGLAS.SIGA}) de ${dataSiga} · declarações de ${janela} · MW, % e pontos do índice de concentração (HHI)`,
            `SIGA (${SIGLAS_IDIOMAS.en.SIGA}) plants in operation as of ${dataSiga} · declarations from ${janela} · MW, % and points of the concentration index (HHI)`,
          )}
          fonte={tx<ReactNode>("ANEEL, SIGA e Composição Societária", <>ANEEL, SIGA and <Nome>Composição Societária</Nome> (shareholding structure)</>)}
          referencia={tx(
            <>
              SIGA de {dataTexto(datas.siga)} e composição societária declarada à ANEEL de {janela} (referência {trimestreTexto(datas.polimero_referencia)}). Processado em {carimbo(g.gerado_em)}.
            </>,
            <>
              SIGA as of {dataTexto(datas.siga)} and shareholding structure declared to ANEEL from {janela} (reference {trimestreTexto(datas.polimero_referencia)}). Processed on {carimbo(g.gerado_em)}.
            </>,
          )}
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: tx("SIGA (usinas em operação)", "SIGA (plants in operation)"), texto: tx(`até ${dataTexto(datas.siga)}`, `up to ${dataTexto(datas.siga)}`), natureza: "OBSERVADO" },
                {
                  rotulo: tx("Composição societária", "Shareholding structure"),
                  texto: tx(
                    `declarações de ${janela}, referência ${trimestreTexto(datas.polimero_referencia)}`,
                    `declarations from ${janela}, reference ${trimestreTexto(datas.polimero_referencia)}`,
                  ),
                  natureza: "OBSERVADO",
                },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo={tx("Indicadores de controle e concentração", "Control and concentration indicators")}
              nota={
                <>
                  {def(g.definicoes.hhi)}{" "}
                  {tx(
                    "Medidas da fronteira inteira, fixas: não mudam com o grupo escolhido nos gráficos, na tabela ou na árvore.",
                    "Measures of the whole boundary, fixed: they do not change with the group chosen in the charts, the table or the tree.",
                  )}
                </>
              }
            >
              <Numero
                variante="faixa"
                rotulo={tx("Concentração por grupo de controle (HHI)", "Concentration by controlling group (HHI)")}
                natureza="CALCULADO"
                evidencia={ct.concentracao.evidencia}
                casas={0}
                unidade={tx("pontos", "points")}
                cor={COR_MEDIDA.hhi}
                nota={
                  grupo?.faixa
                    ? tx(`Faixa no Guia do CADE (${SIGLAS.CADE}): ${ROTULO_FAIXA[grupo.faixa]}.`, `Band in the CADE Guide (${SIGLAS_IDIOMAS.en.CADE}): ${ROTULO_FAIXA[grupo.faixa]}.`)
                    : undefined
                }
                endereco={ancoraPainel("p039")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Quatro maiores grupos (CR4)", "Four largest groups (CR4)")}
                natureza="CALCULADO"
                valor={grupo?.cr4 ?? null}
                formato="pct"
                casas={2}
                unidade={tx("da fronteira", "of the boundary")}
                periodo={tx(`SIGA de ${dataSiga}`, `SIGA as of ${dataSiga}`)}
                motivoAusencia={tx("Sem grupos com potência publicada nesta publicação.", "No groups with published capacity in this release.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Dez maiores grupos (CR10)", "Ten largest groups (CR10)")}
                natureza="CALCULADO"
                valor={grupo?.cr10 ?? null}
                formato="pct"
                casas={2}
                unidade={tx("da fronteira", "of the boundary")}
                periodo={tx(`SIGA de ${dataSiga}`, `SIGA as of ${dataSiga}`)}
                motivoAusencia={tx("Sem grupos com potência publicada nesta publicação.", "No groups with published capacity in this release.")}
              />
              <Numero
                variante="faixa"
                rotulo={tx("Fronteira de usinas", "Plant boundary")}
                natureza="CALCULADO"
                valor={ct.fronteira.mw}
                formato="num"
                casas={1}
                unidade="MW"
                periodo={tx(`SIGA de ${dataSiga}`, `SIGA as of ${dataSiga}`)}
                nota={tx(
                  `${inteiro(ct.fronteira.usinas)} usinas em operação com participações somando 100%.`,
                  `${inteiro(ct.fronteira.usinas)} plants in operation with stakes adding up to 100%.`,
                )}
              />
            </FaixaMetricas>
          }
        >
          {tx(
            <>
              Cada agente declara à ANEEL, a cada trimestre, quem são os seus sócios; vale a última declaração de cada um dentro do intervalo de trimestres considerado. O recorte de usinas é dito
              explicitamente, a fronteira: as usinas em operação cujas participações somam 100%. Propriedade direta e controle são medidas separadas.
            </>,
            <>
              Each agent declares its shareholders to ANEEL every quarter; each one&apos;s latest declaration within the range of quarters considered applies. The set of plants is stated explicitly, the
              boundary: the plants in operation whose stakes add up to 100%. Direct ownership and control are separate measures.
            </>,
          )}
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="controle">
            <PainelEvidencia
              id="p039"
              pergunta={tx("Quem detém e quem controla a capacidade em operação?", "Who holds and who controls the capacity in operation?")}
              subtitulo={tx(
                "Grupos de controle declarados à ANEEL e concentração da potência em operação · pontos de HHI, %, MW",
                "Controlling groups declared to ANEEL and concentration of the capacity in operation · HHI points, %, MW",
              )}
              porQueImporta={tx(
                <>
                  A mesma empresa pode aparecer com dezenas de CNPJ, um por usina. Subir a cadeia de controladores até o grupo mostra quem decide sobre quanto da capacidade instalada, e o índice
                  Herfindahl-Hirschman (HHI) resume quão repartida ela está.
                </>,
                <>
                  The same company can appear with dozens of CNPJs, one per plant. Going up the chain of controlling shareholders to the group shows who decides over how much of the installed
                  capacity, and the Herfindahl-Hirschman Index (HHI) sums up how spread out it is.
                </>,
              )}
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.controle}
              complementares={[{ rotulo: tx("Concentração (HHI, CR4, CR10)", "Concentration (HHI, CR4, CR10)"), p: g.proveniencia.concentracao }]}
            >
              <div className="space-y-6">
                <EmpresasControle
                  linhasGrupos={linhasGrupos(ct.grupos)}
                  barras={barrasGrupos(ct.grupos)}
                  entidades={entidadesControle(ct.grupos, c.proprietarios, d.indice)}
                  padrao={padraoGrupo}
                  arvoreInicial={arvoreInicial}
                  urlCadeia={g.series.cadeia}
                  motivos={ct.cobertura.motivos_parada}
                  totalGrupos={grupo?.participantes ?? null}
                  csv={csvGrupos}
                  fonte={fontePolimero}
                  versao={datas.polimero_referencia ?? ""}
                  aposFigura={
                    <div className="space-y-6">
                      {/* a faixa já traz o HHI; a resposta vem depois da figura, para o gráfico começar na primeira tela */}
                      <RespostaCurta id="p039" veredito={comNomes(vereditoControle(ct), ct.concentracao.grupo_proporcional?.maiores.map((m) => m.nome) ?? [])} depois>
                        {comNomes(respostaControle(ct), ct.concentracao.grupo_proporcional?.maiores.map((m) => m.nome) ?? [])}
                      </RespostaCurta>
                      <EmpresasRecorte
                        periodo={tx(
                          <>
                            SIGA de {dataSiga} e declarações de composição societária à ANEEL de {janela}
                          </>,
                          <>
                            SIGA as of {dataSiga} and shareholding structure declarations to ANEEL from {janela}
                          </>,
                        )}
                        universo={tx(
                          <>
                            Fronteira: {ct.fronteira.descricao} {mwTexto(ct.fronteira.mw)} em {inteiro(ct.fronteira.usinas)} usinas
                          </>,
                          <>
                            Boundary: {def(ct.fronteira.descricao)} {mwTexto(ct.fronteira.mw)} in {inteiro(ct.fronteira.usinas)} plants
                          </>,
                        )}
                        unidade={tx("Pontos de HHI (0 a 10.000); % da potência da fronteira; MW", "HHI points (0 to 10,000); % of the boundary capacity; MW")}
                      />
                      <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                    </div>
                  }
                />

                <SecaoDoPainel
                  id="niveis"
                  titulo={tx("Quanto a concentração muda conforme o nível?", "How much does concentration change with the level?")}
                  lead={
                    <span data-leitura-niveis="">
                      {tx(
                        <>
                          Os três HHI usam a mesma fronteira de usinas e diferem no que é contado: o dono direto ou o grupo de controle, e a capacidade proporcional ou a capacidade sob controle. As duas
                          capacidades não se somam.
                        </>,
                        <>
                          The three HHIs use the same plant boundary and differ in what is counted: the direct owner or the controlling group, and the proportional capacity or the capacity under
                          control. The two capacities are not added together.
                        </>,
                      )}
                    </span>
                  }
                >
                  <EmpresasAviso rotulo={tx("Fronteira explícita", "Explicit boundary")}>
                    <p>{textoFronteiraNoCadastro(ct.fronteira, c.ativos)}</p>
                    <p className="mt-1">
                      {tx(
                        <>
                          {mwTexto(ct.fronteira.mw_sem_documento)} pertencem a participantes sem CNPJ: contam no total da fronteira, mas não entram em nenhum grupo, e por isso o índice é um limite inferior (o valor real pode ser
                          maior, não menor). {mwTexto(ct.fronteira.mw_sem_controlador_majoritario)} em {inteiro(ct.fronteira.usinas_sem_controlador_majoritario)} usinas sem dono com mais de 50% ficam fora da
                          capacidade sob controle.
                        </>,
                        <>
                          {mwTexto(ct.fronteira.mw_sem_documento)} belong to participants without CNPJ: they count in the boundary total but do not enter any group, so the index is a lower bound (the
                          real value can be higher, not lower). {mwTexto(ct.fronteira.mw_sem_controlador_majoritario)} in {inteiro(ct.fronteira.usinas_sem_controlador_majoritario)} plants with no
                          owner holding more than 50% are left out of the capacity under control.
                        </>,
                      )}
                    </p>
                  </EmpresasAviso>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-leitura-hhi="">
                    {tx(
                      <>
                        Como ler o HHI: ele vai de 0 a 10.000, e 10.000 seria um único dono de toda a capacidade. Nas faixas do Guia do CADE, abaixo de {num(LIMIARES_HHI_CADE.moderado, 0)} pontos é não concentrado, de{" "}
                        {num(LIMIARES_HHI_CADE.moderado, 0)} a {num(LIMIARES_HHI_CADE.alto, 0)} é moderadamente concentrado e acima de {num(LIMIARES_HHI_CADE.alto, 0)}, altamente concentrado. O período vai do primeiro
                        trimestre de declarações considerado ({inicioJanela}) à data do SIGA.
                      </>,
                      <>
                        How to read the HHI: it goes from 0 to 10,000, and 10,000 would be a single owner of all the capacity. In the CADE Guide bands, below {num(LIMIARES_HHI_CADE.moderado, 0)} points
                        is unconcentrated, from {num(LIMIARES_HHI_CADE.moderado, 0)} to {num(LIMIARES_HHI_CADE.alto, 0)} is moderately concentrated and above {num(LIMIARES_HHI_CADE.alto, 0)}, highly
                        concentrated. The period runs from the first quarter of declarations considered ({inicioJanela}) to the SIGA date.
                      </>,
                    )}
                  </p>
                  <GraficoBarras
                    titulo={tx("HHI da potência em operação por nível, com os limiares do Guia do CADE", "HHI of the capacity in operation by level, with the CADE Guide thresholds")}
                    dados={linhasNiveis(ct.concentracao)}
                    chaveCategoria="id"
                    chaveRotulo="nivel_curto"
                    series={[{ id: "hhi", rotulo: "HHI", cor: COR_MEDIDA.hhi }]}
                    unidade={tx("pontos", "points")}
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                    referencias={referenciasCade}
                  />
                  <TabelaInterativa
                    titulo={tx("HHI, CR4 e CR10 por nível de agregação", "HHI, CR4 and CR10 by aggregation level")}
                    colunas={COLUNAS_NIVEIS}
                    linhas={linhasNiveis(ct.concentracao)}
                    chaveLinha="id"
                    colunaRotulo="nivel"
                    fonte={fontePolimero}
                    versao={ct.fronteira.data ?? ""}
                    nomeArquivo="empresas-concentracao-niveis"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="tipos" titulo={tx("A concentração muda conforme o tipo de usina?", "Does concentration change with the type of plant?")}>
                  <p className="max-w-prose2 text-sm text-carvao" data-texto="tipos">
                    {textoTipos(ct.concentracao.por_tipo)}
                  </p>
                  <GraficoBarras
                    titulo={tx("HHI por grupo de controle em cada tipo de usina", "HHI by controlling group in each type of plant")}
                    dados={linhasTipos(ct.concentracao.por_tipo)}
                    chaveCategoria="id"
                    chaveRotulo="tipo"
                    series={[{ id: "hhi", rotulo: tx("HHI por grupo", "HHI by group"), cor: COR_MEDIDA.hhi }]}
                    unidade={tx("pontos", "points")}
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                    referencias={referenciasCade}
                  />
                  <EmpresasNota>
                    {tx(
                      "Tipo com poucos grupos tem HHI alto por construção (um só participante dá 10.000 pontos): a faixa descreve o número, não um mercado.",
                      "A type with few groups has a high HHI by construction (a single participant gives 10,000 points): the band describes the number, not a market.",
                    )}
                  </EmpresasNota>
                  <TabelaInterativa
                    titulo={tx("Concentração por tipo de usina (grupos, capacidade proporcional)", "Concentration by type of plant (groups, proportional capacity)")}
                    colunas={COLUNAS_TIPOS}
                    linhas={linhasTipos(ct.concentracao.por_tipo)}
                    chaveLinha="id"
                    colunaRotulo="tipo"
                    fonte={fontePolimero}
                    versao={ct.fronteira.data ?? ""}
                    nomeArquivo="empresas-concentracao-tipos"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="motivos" titulo={tx("Por que as cadeias de controle param", "Why the control chains stop")} nivel="analisar">
                  <TabelaInterativa
                    titulo={tx("Por que as cadeias de controle param", "Why the control chains stop")}
                    colunas={COLUNAS_MOTIVOS}
                    linhas={linhasMotivos(ct.cobertura)}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte={fonteMotivos}
                    versao={datas.polimero_referencia ?? ""}
                    nomeArquivo="empresas-motivos-parada"
                    nota={tx(
                      `${inteiro(ct.cobertura.proprietarios_com_grupo_acima)} dos ${inteiro(ct.cobertura.proprietarios)} proprietários diretos têm grupo acima deles (${pctTexto(ct.cobertura.pct_mw_consolidado_em_grupo, 2)} da capacidade proporcional, ${mwTexto(ct.cobertura.mw_consolidado_em_grupo)}).`,
                      `${inteiro(ct.cobertura.proprietarios_com_grupo_acima)} of the ${inteiro(ct.cobertura.proprietarios)} direct owners have a group above them (${pctTexto(ct.cobertura.pct_mw_consolidado_em_grupo, 2)} of the proportional capacity, ${mwTexto(ct.cobertura.mw_consolidado_em_grupo)}).`,
                    )}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="grafo" titulo={tx("Grafo societário, janela e limites", "Shareholding graph, window and limits")} nivel="auditar">
                  {ct.polimero && (
                    <>
                      <p className="text-sm text-carvao-muted">
                        {tx(
                          <>
                            Composição Societária: {inteiro(ct.polimero.linhas)} linhas e {inteiro(ct.polimero.arvores)} árvores na base; janela de {janela}, {inteiro(ct.polimero.declarantes)} agentes com
                            declaração vigente e {inteiro(ct.polimero.fora_janela)} que só declararam antes dela; {inteiro(ct.polimero.nos)} empresas no grafo, {inteiro(ct.polimero.nos_ambiguos)} ambíguas (as listas de sócios
                            concordam sobre o controlador em menos de {pctTexto(ct.polimero.limiar_concordancia * 100, 0)} dos casos); {inteiro(ct.polimero.percentual_ausente)} linhas sem percentual.
                          </>,
                          <>
                            <Nome>Composição Societária</Nome>: {inteiro(ct.polimero.linhas)} rows and {inteiro(ct.polimero.arvores)} trees in the database; window from {janela},{" "}
                            {inteiro(ct.polimero.declarantes)} agents with a current declaration and {inteiro(ct.polimero.fora_janela)} that only declared before it; {inteiro(ct.polimero.nos)} companies
                            in the graph, {inteiro(ct.polimero.nos_ambiguos)} ambiguous (the shareholder lists agree on the controlling shareholder in less than{" "}
                            {pctTexto(ct.polimero.limiar_concordancia * 100, 0)} of the cases); {inteiro(ct.polimero.percentual_ausente)} rows without a percentage.
                          </>,
                        )}
                      </p>
                      <TabelaInterativa
                        titulo={tx("Agentes declarantes por trimestre (quebra de série na base)", "Declaring agents by quarter (series break in the database)")}
                        colunas={COLUNAS_PERIODOS_POLIMERO}
                        linhas={linhasPeriodosPolimero(ct.polimero)}
                        chaveLinha="id"
                        colunaRotulo="trimestre"
                        fonte={fonteMotivos}
                        versao={ct.polimero.trimestre_referencia ?? ""}
                        nomeArquivo="empresas-polimero-declarantes"
                        ordemInicial={{ coluna: "trimestre", direcao: "desc" }}
                        nota={tx(
                          "O número de declarantes muda de patamar ao longo da base; o trimestre mais recente, ainda em preenchimento, não é o de referência.",
                          "The number of declaring agents shifts level over the database; the most recent quarter, still being filled in, is not the reference one.",
                        )}
                      />
                    </>
                  )}
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {(["grupo", "capacidade_proporcional_grupo", "capacidade_controle_grupo"] as const).map((k) => (
                      <div key={k}>
                        <dt className="font-medium text-carvao">{rotuloDefinicao[k]}</dt>
                        <dd className="mt-0.5 text-carvao-muted">{def(g.definicoes[k])}</dd>
                      </div>
                    ))}
                  </dl>
                  {bloqueioP039.map((b) => (
                    <EmpresasAviso key={b.id} rotulo={tx("Limitação documentada", "Documented limitation")}>
                      <p>
                        {lim(b.descricao)} {lim(b.evidencia)} {lim(b.alternativa)}
                      </p>
                    </EmpresasAviso>
                  ))}
                  <p className="text-sm text-carvao-muted">
                    {tx(
                      <>
                        Identidades conferidas na publicação: soma dos grupos igual à soma dos proprietários diretos ({aprovada(g.validacao.identidades.particao_grupos)}); soma dos
                        proprietários e da parcela sem CNPJ igual à fronteira ({aprovada(g.validacao.identidades.particao_fronteira)}).
                      </>,
                      <>
                        Identities checked in the release: sum of the groups equal to the sum of the direct owners ({aprovada(g.validacao.identidades.particao_grupos)}); sum of the owners and
                        of the part without CNPJ equal to the boundary ({aprovada(g.validacao.identidades.particao_fronteira)}).
                      </>,
                    )}
                  </p>
                </SecaoDoPainel>

                <EmpresasSeguir
                  ancora="p039"
                  proximo={{ href: rotaPainel("p038"), pergunta: painel("p038").pergunta }}
                  downloads={downloadsDe(g.downloads, ["/energia/series/empresas_grupos.csv", "/energia/series/empresas_cadeia_societaria.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
