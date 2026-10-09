import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasControle } from "@/components/energia/EmpresasControle";
import {
  EmpresasAnalise,
  EmpresasAuditoria,
  EmpresasAviso,
  EmpresasIndisponivel,
  EmpresasNavegacao,
  EmpresasRecorte,
  EmpresasSeguir,
  EmpresasSubtitulo,
} from "@/components/energia/EmpresasPagina";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COLUNAS_MOTIVOS,
  COLUNAS_NIVEIS,
  COLUNAS_PERIODOS_POLIMERO,
  COLUNAS_TIPOS,
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
  const fontePolimero = "ANEEL, SIGA e Composição Societária (Polímero)";
  const janela = datas.polimero_janela.length ? `${trimestreTexto(datas.polimero_janela[0])} a ${trimestreTexto(datas.polimero_janela.at(-1))}` : "sem janela";
  const inicioJanela = datas.polimero_janela.length ? trimestreTexto(datas.polimero_janela[0]) : "sem janela";
  const bloqueioP039 = g.bloqueios.filter((b) => b.painel === "P039");
  // árvore do maior grupo já na página; as demais vêm do arquivo da cadeia no navegador
  const padraoGrupo = ct.grupos[0]?.cnpj ?? "";
  const arvoreInicial = padraoGrupo ? arvoreDoArquivo(g.series.cadeia, padraoGrupo) : null;
  const regraCade = metrica("empresas_hhi_capacidade")?.regras_comparabilidade.find((r) => r.includes("CADE")) ?? null;

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-controle" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <CabecalhoModulo siglas={["SIGA", "HHI", "CR4", "CR10", "ANEEL", "CADE"]}
          rotulo="Empresas"
          titulo={painel("p039").pergunta}
          referencia={
            <>
              SIGA de {dataTexto(datas.siga)} e composição societária declarada à ANEEL de {janela} (referência {trimestreTexto(datas.polimero_referencia)}). Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quem está no topo da cadeia de controle declarada à ANEEL de cada dono de usina, quanto da capacidade instalada cada grupo detém e controla, e quão concentrada ela está,
          sobre um recorte de usinas dito explicitamente, a fronteira: as usinas em operação cujas participações somam 100%. Cada agente declara à ANEEL, a cada trimestre, quem são os seus sócios; vale a
          última declaração de cada um dentro do intervalo de trimestres considerado.
        </CabecalhoModulo>
        <EmpresasNavegacao atual="p039" />
        <ModoProfundidade>

          <Bloco id="controle">
            <PainelEvidencia
              id="p039"
              pergunta={painel("p039").pergunta}
              subtitulo="Grupos de controle declarados à ANEEL e concentração da potência em operação · pontos de HHI, %, MW"
              porQueImporta={
                <>
                  A mesma empresa pode aparecer com dezenas de CNPJ, um por usina. Subir a cadeia de controladores até o grupo mostra quem decide sobre quanto da capacidade instalada, e o
                  índice Herfindahl-Hirschman (HHI) resume quão repartida ela está.
                </>
              }
              oQueMudou={
                <>
                  A cadeia de controle usa a última declaração de cada agente de {janela} (referência: {trimestreTexto(ct.polimero?.trimestre_referencia)}, com {inteiro(ct.polimero?.declarantes)}{" "}
                  declarantes); {inteiro(ct.polimero?.agentes_com_mudanca_relevante_declarada)} agentes declararam mudança societária relevante em algum momento da base.
                </>
              }
              comoInterpretar={
                <>
                  {g.definicoes.hhi} {regraCade ?? ""} A capacidade proporcional do grupo soma as participações diretas das empresas do grupo; a capacidade sob controle conta a usina
                  inteira quando o dono majoritário está no grupo. As duas medidas não se somam.
                </>
              }
              naoConcluir={
                <>
                  A fronteira é capacidade instalada em operação, não energia vendida nem mercado relevante de uma análise concorrencial: o HHI aqui não diz se há poder de mercado.
                  Participação econômica indireta (multiplicar as frações ao longo da cadeia) não é calculada. Controle por acordo de acionistas não está na fonte.
                </>
              }
              proveniencia={g.proveniencia.controle}
              complementares={[{ rotulo: "Concentração (HHI, CR4, CR10)", p: g.proveniencia.concentracao }]}
            >
              <div className="space-y-6">
                <RespostaCurta id="p039" veredito={vereditoControle(ct)}>
                  {respostaControle(ct)}
                </RespostaCurta>
                <EmpresasRecorte
                  periodo={
                    <>
                      SIGA de {dataTexto(ct.fronteira.data)} e declarações de composição societária à ANEEL de {janela}
                    </>
                  }
                  universo={
                    <>
                      Fronteira: {ct.fronteira.descricao} {mwTexto(ct.fronteira.mw)} em {inteiro(ct.fronteira.usinas)} usinas
                    </>
                  }
                  unidade="Pontos de HHI (0 a 10.000); % da potência da fronteira; MW"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Numero
                    rotulo="HHI por grupo de controle"
                    natureza="CALCULADO"
                    evidencia={ct.concentracao.evidencia}
                    casas={0}
                    unidade="pontos"
                    tamanho="medio"
                    nota={
                      ct.concentracao.grupo_proporcional?.faixa
                        ? `${ROTULO_FAIXA[ct.concentracao.grupo_proporcional.faixa]} nas faixas do Guia do CADE; CR4 ${pctTexto(ct.concentracao.grupo_proporcional.cr4, 2)}, CR10 ${pctTexto(ct.concentracao.grupo_proporcional.cr10, 2)}. O período vai do primeiro trimestre de declarações considerado (${inicioJanela}) à data do SIGA.`
                        : undefined
                    }
                    endereco={ancoraPainel("p039")}
                  />
                  <div className="space-y-1 border border-linha bg-superficie p-5 text-sm text-carvao-muted">
                    <p className="rotulo text-mineral">Fronteira explícita</p>
                    <p>{textoFronteiraNoCadastro(ct.fronteira, c.ativos)}</p>
                    <p>
                      {mwTexto(ct.fronteira.mw_sem_documento)} pertencem a participantes sem CNPJ: contam no total da fronteira, mas não entram em nenhum grupo, e por isso o índice é um limite inferior (o valor real pode ser maior, não menor).{" "}
                      {mwTexto(ct.fronteira.mw_sem_controlador_majoritario)} em {inteiro(ct.fronteira.usinas_sem_controlador_majoritario)} usinas sem dono com mais de 50% ficam fora da capacidade sob controle.
                    </p>
                  </div>
                </div>
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-leitura-hhi="">
                  Como ler o HHI: ele vai de 0 a 10.000, e 10.000 seria um único dono de toda a capacidade. Nas faixas do Guia do CADE, abaixo de {num(LIMIARES_HHI_CADE.moderado, 0)} pontos é não concentrado, de{" "}
                  {num(LIMIARES_HHI_CADE.moderado, 0)} a {num(LIMIARES_HHI_CADE.alto, 0)} é moderadamente concentrado e acima de {num(LIMIARES_HHI_CADE.alto, 0)}, altamente concentrado.
                </p>

                <EmpresasSubtitulo>Quanto a concentração muda conforme o nível?</EmpresasSubtitulo>
                <GraficoBarras
                  titulo="HHI da potência em operação por nível, com os limiares do Guia do CADE"
                  dados={linhasNiveis(ct.concentracao)}
                  chaveCategoria="id"
                  chaveRotulo="nivel_curto"
                  series={[{ id: "hhi", rotulo: "HHI", cor: "var(--serie-comp-1)" }]}
                  unidade="pontos"
                  casas={0}
                  orientacao="horizontal"
                  rotulosValor
                  referencias={[
                    { valor: LIMIARES_HHI_CADE.moderado, rotulo: "início da faixa moderadamente concentrada (CADE)" },
                    { valor: LIMIARES_HHI_CADE.alto, rotulo: "acima: altamente concentrada (CADE)" },
                  ]}
                />
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-leitura-niveis="">
                  Os três HHI usam a mesma fronteira de usinas e diferem no que é contado: o dono direto ou o grupo de controle, e a capacidade proporcional ou a capacidade sob controle. As duas capacidades não se somam.
                </p>
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

                <EmpresasSubtitulo>Quem controla mais capacidade, e como cada cadeia sobe?</EmpresasSubtitulo>
                <EmpresasControle
                  linhasGrupos={linhasGrupos(ct.grupos)}
                  barras={barrasGrupos(ct.grupos)}
                  entidades={entidadesControle(ct.grupos, c.proprietarios, d.indice)}
                  padrao={padraoGrupo}
                  arvoreInicial={arvoreInicial}
                  urlCadeia={g.series.cadeia}
                  motivos={ct.cobertura.motivos_parada}
                  fonte={fontePolimero}
                  versao={datas.polimero_referencia ?? ""}
                />

                <EmpresasAnalise titulo="Concentração por tipo de usina">
                  <p className="text-sm text-carvao">{textoTipos(ct.concentracao.por_tipo)}</p>
                  <GraficoBarras
                    titulo="HHI por grupo de controle em cada tipo de usina"
                    dados={linhasTipos(ct.concentracao.por_tipo)}
                    chaveCategoria="id"
                    chaveRotulo="tipo"
                    series={[{ id: "hhi", rotulo: "HHI por grupo", cor: "var(--serie-comp-2)" }]}
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
                    titulo="Concentração por tipo de usina (grupos, capacidade proporcional)"
                    colunas={COLUNAS_TIPOS}
                    linhas={linhasTipos(ct.concentracao.por_tipo)}
                    chaveLinha="id"
                    colunaRotulo="tipo"
                    fonte={fontePolimero}
                    versao={ct.fronteira.data ?? ""}
                    nomeArquivo="empresas-concentracao-tipos"
                    nota="Tipo com poucos grupos tem HHI alto por construção (um só participante dá 10.000 pontos); a faixa descreve o número, não um mercado."
                  />
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
                </EmpresasAnalise>

                <EmpresasAuditoria titulo="Grafo societário, janela e limites">
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
                </EmpresasAuditoria>

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
