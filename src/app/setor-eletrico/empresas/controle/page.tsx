import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
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
import { metrica } from "@/lib/energia/metricas";
import { SIGLAS } from "@/lib/energia/siglas";
import type { EmpresasGold } from "@/lib/energia/tipos-empresas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quem controla e qual a concentração? Grupos e HHI da capacidade",
  description:
    "Grupos de controle declarados à ANEEL (Composição Societária), capacidade proporcional e capacidade sob controle por grupo, árvore societária de cada CNPJ e HHI, CR4 e CR10 da potência em operação sobre fronteira explícita.",
  alternates: { canonical: "/setor-eletrico/empresas/controle" },
};

export default function PaginaP039() {
  const g = lerGold<EmpresasGold>("empresas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const c = g.cadastro;
  const d = g.distribuidoras;
  const ct = g.controle;
  const datas = g.datas;
  const grupo = ct.concentracao.grupo_proporcional;
  const fontePolimero = "ANEEL, SIGA e Composição Societária (Polímero)";
  const janela = datas.polimero_janela.length ? `${trimestreTexto(datas.polimero_janela[0])} a ${trimestreTexto(datas.polimero_janela.at(-1))}` : "sem janela";
  const inicioJanela = datas.polimero_janela.length ? trimestreTexto(datas.polimero_janela[0]) : "sem janela";
  const dataSiga = dataTexto(ct.fronteira.data);
  const bloqueioP039 = g.bloqueios.filter((b) => b.painel === "P039");
  // árvore do maior grupo já na página; as demais vêm do arquivo da cadeia no navegador
  const padraoGrupo = ct.grupos[0]?.cnpj ?? "";
  const arvoreInicial = padraoGrupo ? arvoreDoArquivo(g.series.cadeia, padraoGrupo) : null;
  const regraCade = metrica("empresas_hhi_capacidade")?.regras_comparabilidade.find((r) => r.includes("CADE")) ?? null;
  const csvGrupos = g.downloads.find((x) => x.url === "/energia/series/empresas_grupos.csv") ?? null;

  const oQueMudou = (
    <>
      A cadeia de controle usa a última declaração de cada agente de {janela} (referência: {trimestreTexto(ct.polimero?.trimestre_referencia)}, com {inteiro(ct.polimero?.declarantes)} declarantes);{" "}
      {inteiro(ct.polimero?.agentes_com_mudanca_relevante_declarada)} agentes declararam mudança societária relevante em algum momento da base.
    </>
  );
  const comoInterpretar = (
    <>
      {g.definicoes.hhi} {regraCade ?? ""} A capacidade proporcional do grupo soma as participações diretas das empresas do grupo; a capacidade sob controle conta a usina inteira quando o dono
      majoritário está no grupo. As duas medidas não se somam.
    </>
  );
  const naoConcluir = (
    <>
      A fronteira é capacidade instalada em operação, não energia vendida nem mercado relevante de uma análise concorrencial: o HHI aqui não diz se há poder de mercado. Participação econômica
      indireta (multiplicar as frações ao longo da cadeia) não é calculada. Controle por acordo de acionistas não está na fonte.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-controle" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="p039" />
        <CabecalhoModulo
          rotulo="Empresas"
          siglas={["SIGA", "HHI", "CR4", "CR10", "ANEEL", "CADE"]}
          titulo={painel("p039").pergunta}
          lead={`Quem está no topo da cadeia de controle que cada dono de usina declara à ANEEL (${SIGLAS.ANEEL}), quanta capacidade instalada cada grupo detém e controla, e quão concentrada ela está.`}
          recorte={`Usinas em operação do SIGA (${SIGLAS.SIGA}) de ${dataSiga} · declarações de ${janela} · MW, % e pontos de HHI`}
          fonte="ANEEL, SIGA e Composição Societária"
          referencia={
            <>
              SIGA de {dataTexto(datas.siga)} e composição societária declarada à ANEEL de {janela} (referência {trimestreTexto(datas.polimero_referencia)}). Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: "SIGA (usinas em operação)", texto: `até ${dataTexto(datas.siga)}`, natureza: "OBSERVADO" },
                { rotulo: "Composição societária", texto: `declarações de ${janela}, referência ${trimestreTexto(datas.polimero_referencia)}`, natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas
              colunas={4}
              rotulo="Indicadores de controle e concentração"
              nota={
                <>
                  {g.definicoes.hhi} A leitura por faixas do Guia do CADE e a fronteira de usinas estão na seção sobre os níveis de concentração. Medidas da fronteira inteira, fixas: não mudam com o grupo escolhido
                  nos gráficos, na tabela ou na árvore.
                </>
              }
            >
              <Numero
                variante="faixa"
                rotulo="Concentração por grupo de controle (HHI)"
                natureza="CALCULADO"
                evidencia={ct.concentracao.evidencia}
                casas={0}
                unidade="pontos"
                cor={COR_MEDIDA.hhi}
                nota={grupo?.faixa ? `${ROTULO_FAIXA[grupo.faixa]} nas faixas do Guia do CADE (${SIGLAS.CADE}).` : undefined}
                endereco={ancoraPainel("p039")}
              />
              <Numero
                variante="faixa"
                rotulo="Quatro maiores grupos (CR4)"
                natureza="CALCULADO"
                valor={grupo?.cr4 ?? null}
                formato="pct"
                casas={2}
                unidade="da potência da fronteira"
                periodo={`SIGA de ${dataSiga}`}
                motivoAusencia="Sem grupos com potência publicada nesta publicação."
              />
              <Numero
                variante="faixa"
                rotulo="Dez maiores grupos (CR10)"
                natureza="CALCULADO"
                valor={grupo?.cr10 ?? null}
                formato="pct"
                casas={2}
                unidade="da potência da fronteira"
                periodo={`SIGA de ${dataSiga}`}
                motivoAusencia="Sem grupos com potência publicada nesta publicação."
              />
              <Numero
                variante="faixa"
                rotulo="Fronteira de usinas"
                natureza="CALCULADO"
                valor={ct.fronteira.mw}
                formato="num"
                casas={1}
                unidade="MW"
                periodo={`SIGA de ${dataSiga}`}
                nota={`${inteiro(ct.fronteira.usinas)} usinas em operação com participações somando 100%.`}
              />
            </FaixaMetricas>
          }
        >
          Cada agente declara à ANEEL, a cada trimestre, quem são os seus sócios; vale a última declaração de cada um dentro do intervalo de trimestres considerado. O recorte de usinas é dito
          explicitamente, a fronteira: as usinas em operação cujas participações somam 100%. Propriedade direta e controle são medidas separadas.
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="controle">
            <PainelEvidencia
              id="p039"
              pergunta="Quem detém e quem controla a capacidade em operação?"
              subtitulo="Grupos de controle declarados à ANEEL e concentração da potência em operação · pontos de HHI, %, MW"
              porQueImporta={
                <>
                  A mesma empresa pode aparecer com dezenas de CNPJ, um por usina. Subir a cadeia de controladores até o grupo mostra quem decide sobre quanto da capacidade instalada, e o índice
                  Herfindahl-Hirschman (HHI) resume quão repartida ela está.
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={g.proveniencia.controle}
              complementares={[{ rotulo: "Concentração (HHI, CR4, CR10)", p: g.proveniencia.concentracao }]}
            >
              <div className="space-y-6">
                <RespostaCurta id="p039" veredito={vereditoControle(ct)}>
                  {respostaControle(ct)}
                </RespostaCurta>
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
                      <EmpresasRecorte
                        periodo={
                          <>
                            SIGA de {dataSiga} e declarações de composição societária à ANEEL de {janela}
                          </>
                        }
                        universo={
                          <>
                            Fronteira: {ct.fronteira.descricao} {mwTexto(ct.fronteira.mw)} em {inteiro(ct.fronteira.usinas)} usinas
                          </>
                        }
                        unidade="Pontos de HHI (0 a 10.000); % da potência da fronteira; MW"
                      />
                      <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />
                    </div>
                  }
                />

                <SecaoDoPainel
                  id="niveis"
                  titulo="Quanto a concentração muda conforme o nível?"
                  lead={
                    <span data-leitura-niveis="">
                      Os três HHI usam a mesma fronteira de usinas e diferem no que é contado: o dono direto ou o grupo de controle, e a capacidade proporcional ou a capacidade sob controle. As duas
                      capacidades não se somam.
                    </span>
                  }
                >
                  <EmpresasAviso rotulo="Fronteira explícita">
                    <p>{textoFronteiraNoCadastro(ct.fronteira, c.ativos)}</p>
                    <p className="mt-1">
                      {mwTexto(ct.fronteira.mw_sem_documento)} pertencem a participantes sem CNPJ: contam no total da fronteira, mas não entram em nenhum grupo, e por isso o índice é um limite inferior (o valor real pode ser
                      maior, não menor). {mwTexto(ct.fronteira.mw_sem_controlador_majoritario)} em {inteiro(ct.fronteira.usinas_sem_controlador_majoritario)} usinas sem dono com mais de 50% ficam fora da
                      capacidade sob controle.
                    </p>
                  </EmpresasAviso>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-leitura-hhi="">
                    Como ler o HHI: ele vai de 0 a 10.000, e 10.000 seria um único dono de toda a capacidade. Nas faixas do Guia do CADE, abaixo de {num(LIMIARES_HHI_CADE.moderado, 0)} pontos é não concentrado, de{" "}
                    {num(LIMIARES_HHI_CADE.moderado, 0)} a {num(LIMIARES_HHI_CADE.alto, 0)} é moderadamente concentrado e acima de {num(LIMIARES_HHI_CADE.alto, 0)}, altamente concentrado. O período vai do primeiro
                    trimestre de declarações considerado ({inicioJanela}) à data do SIGA.
                  </p>
                  <GraficoBarras
                    titulo="HHI da potência em operação por nível, com os limiares do Guia do CADE"
                    dados={linhasNiveis(ct.concentracao)}
                    chaveCategoria="id"
                    chaveRotulo="nivel_curto"
                    series={[{ id: "hhi", rotulo: "HHI", cor: COR_MEDIDA.hhi }]}
                    unidade="pontos"
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                    referencias={[
                      { valor: LIMIARES_HHI_CADE.moderado, rotulo: "início da faixa moderadamente concentrada (CADE)" },
                      { valor: LIMIARES_HHI_CADE.alto, rotulo: "acima: altamente concentrada (CADE)" },
                    ]}
                  />
                  <TabelaInterativa
                    titulo="HHI, CR4 e CR10 por nível de agregação"
                    colunas={COLUNAS_NIVEIS}
                    linhas={linhasNiveis(ct.concentracao)}
                    chaveLinha="id"
                    colunaRotulo="nivel"
                    fonte={fontePolimero}
                    versao={ct.fronteira.data ?? ""}
                    nomeArquivo="empresas-concentracao-niveis"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="tipos" titulo="A concentração muda conforme o tipo de usina?">
                  <p className="max-w-prose2 text-sm text-carvao" data-texto="tipos">
                    {textoTipos(ct.concentracao.por_tipo)}
                  </p>
                  <GraficoBarras
                    titulo="HHI por grupo de controle em cada tipo de usina"
                    dados={linhasTipos(ct.concentracao.por_tipo)}
                    chaveCategoria="id"
                    chaveRotulo="tipo"
                    series={[{ id: "hhi", rotulo: "HHI por grupo", cor: COR_MEDIDA.hhi }]}
                    unidade="pontos"
                    casas={0}
                    orientacao="horizontal"
                    rotulosValor
                    referencias={[
                      { valor: LIMIARES_HHI_CADE.moderado, rotulo: "início da faixa moderadamente concentrada (CADE)" },
                      { valor: LIMIARES_HHI_CADE.alto, rotulo: "acima: altamente concentrada (CADE)" },
                    ]}
                  />
                  <EmpresasNota>Tipo com poucos grupos tem HHI alto por construção (um só participante dá 10.000 pontos): a faixa descreve o número, não um mercado.</EmpresasNota>
                  <TabelaInterativa
                    titulo="Concentração por tipo de usina (grupos, capacidade proporcional)"
                    colunas={COLUNAS_TIPOS}
                    linhas={linhasTipos(ct.concentracao.por_tipo)}
                    chaveLinha="id"
                    colunaRotulo="tipo"
                    fonte={fontePolimero}
                    versao={ct.fronteira.data ?? ""}
                    nomeArquivo="empresas-concentracao-tipos"
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="motivos" titulo="Por que as cadeias de controle param" nivel="analisar">
                  <TabelaInterativa
                    titulo="Por que as cadeias de controle param"
                    colunas={COLUNAS_MOTIVOS}
                    linhas={linhasMotivos(ct.cobertura)}
                    chaveLinha="id"
                    colunaRotulo="rotulo"
                    fonte="ANEEL, Composição Societária (Polímero)"
                    versao={datas.polimero_referencia ?? ""}
                    nomeArquivo="empresas-motivos-parada"
                    nota={`${inteiro(ct.cobertura.proprietarios_com_grupo_acima)} dos ${inteiro(ct.cobertura.proprietarios)} proprietários diretos têm grupo acima deles (${pctTexto(ct.cobertura.pct_mw_consolidado_em_grupo, 2)} da capacidade proporcional, ${mwTexto(ct.cobertura.mw_consolidado_em_grupo)}).`}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="grafo" titulo="Grafo societário, janela e limites" nivel="auditar">
                  {ct.polimero && (
                    <>
                      <p className="text-sm text-carvao-muted">
                        Composição Societária: {inteiro(ct.polimero.linhas)} linhas e {inteiro(ct.polimero.arvores)} árvores na base; janela de {janela}, {inteiro(ct.polimero.declarantes)} agentes com
                        declaração vigente e {inteiro(ct.polimero.fora_janela)} que só declararam antes dela; {inteiro(ct.polimero.nos)} empresas no grafo, {inteiro(ct.polimero.nos_ambiguos)} ambíguas (as listas de sócios
                        concordam sobre o controlador em menos de {pctTexto(ct.polimero.limiar_concordancia * 100, 0)} dos casos); {inteiro(ct.polimero.percentual_ausente)} linhas sem percentual.
                      </p>
                      <TabelaInterativa
                        titulo="Agentes declarantes por trimestre (quebra de série na base)"
                        colunas={COLUNAS_PERIODOS_POLIMERO}
                        linhas={linhasPeriodosPolimero(ct.polimero)}
                        chaveLinha="id"
                        colunaRotulo="trimestre"
                        fonte="ANEEL, Composição Societária (Polímero)"
                        versao={ct.polimero.trimestre_referencia ?? ""}
                        nomeArquivo="empresas-polimero-declarantes"
                        ordemInicial={{ coluna: "trimestre", direcao: "desc" }}
                        nota="O número de declarantes muda de patamar ao longo da base; o trimestre mais recente, ainda em preenchimento, não é o de referência."
                      />
                    </>
                  )}
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {(["grupo", "capacidade_proporcional_grupo", "capacidade_controle_grupo"] as const).map((k) => (
                      <div key={k}>
                        <dt className="font-medium text-carvao">{{ grupo: "Grupo", capacidade_proporcional_grupo: "Capacidade proporcional do grupo", capacidade_controle_grupo: "Capacidade sob controle do grupo" }[k]}</dt>
                        <dd className="mt-0.5 text-carvao-muted">{g.definicoes[k]}</dd>
                      </div>
                    ))}
                  </dl>
                  {bloqueioP039.map((b) => (
                    <EmpresasAviso key={b.id} rotulo="Limitação documentada">
                      <p>
                        {b.descricao} {b.evidencia} {b.alternativa}
                      </p>
                    </EmpresasAviso>
                  ))}
                  <p className="text-sm text-carvao-muted">
                    Identidades conferidas na publicação: soma dos grupos igual à soma dos proprietários diretos ({g.validacao.identidades.particao_grupos ? "aprovada" : "reprovada"}); soma dos
                    proprietários e da parcela sem CNPJ igual à fronteira ({g.validacao.identidades.particao_fronteira ? "aprovada" : "reprovada"}).
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
