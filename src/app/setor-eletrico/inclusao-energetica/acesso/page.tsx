import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { InclusaoAnalise, InclusaoAuditoria, InclusaoIndisponivel, InclusaoNavegacao, InclusaoRecorte, InclusaoSeguir, InclusaoSubtitulo } from "@/components/energia/InclusaoPagina";
import { InclusaoIsolados, InclusaoLpt, InclusaoMapaPnad, InclusaoRegioesPnad } from "@/components/energia/InclusaoAcesso";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Numero } from "@/components/energia/Numero";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, num } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  colunasLpt,
  FONTE_LPT,
  FONTE_PASI,
  FONTE_PNAD,
  inteiro,
  linhasLptAnual,
  mes,
  mudancaAcesso,
  pctTexto,
  respostaAcesso,
  rotaPainel,
  textoPrecisaoPnad,
} from "@/lib/energia/inclusao";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { InclusaoGold } from "@/lib/energia/tipos-inclusao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Acesso à energia, sistemas isolados e Luz para Todos",
  description:
    "Domicílios sem energia elétrica e com fornecimento em tempo integral (PNAD Contínua), localidades e população dos sistemas isolados (PASI, EPE) e domicílios atendidos pelo Luz para Todos (MME), por UF e ano.",
  alternates: { canonical: "/setor-eletrico/inclusao-energetica/acesso" },
};

const COLUNAS_CICLOS: ColunaTabela[] = [
  { id: "ciclo", rotulo: "Ciclo do PASI", tipo: "texto" },
  { id: "localidades", rotulo: "Localidades", tipo: "numero", casas: 0 },
  { id: "populacao", rotulo: "População informada", tipo: "numero", unidade: "pessoas", casas: 0 },
  { id: "sem_pop", rotulo: "Sem população informada", tipo: "numero", casas: 0 },
  { id: "previsao", rotulo: "Com previsão de interligação", tipo: "numero", casas: 0 },
  { id: "sairam", rotulo: "Saíram da lista", tipo: "numero", casas: 0 },
];

const COLUNAS_MUN_LPT: ColunaTabela[] = [
  { id: "municipio", rotulo: "Município", tipo: "texto" },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "cod", rotulo: "Código IBGE (6 dígitos)", tipo: "texto" },
  { id: "domicilios", rotulo: "Domicílios atendidos desde jan/2023", tipo: "numero", casas: 0 },
];

const ROTULO_FONTE_RECURSO: Record<string, string> = { cde: "CDE", rgr: "RGR", caixa_outras: "Caixa ou outras", agente_executor: "Agente executor" };

export default function AcessoPage() {
  const g = lerGold<InclusaoGold>("inclusao.json");
  if (!integra(g)) return <InclusaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const a = g.acesso;
  const custeio = g.tarifa_social.custeio_cde;
  const si = a.sistemas_isolados;
  const lpt = a.universalizacao.luz_para_todos;
  const brPnad = a.pnad_serie.find((l) => l.territorio === "BR" && l.ano === a.ano_referencia && l.situacao === "total");
  const recursosCols: ColunaTabela[] = lpt
    ? [
        { id: "nome", rotulo: "UF", tipo: "texto" },
        { id: "contratos", rotulo: "Contratos", tipo: "numero", casas: 0 },
        ...Array.from(new Set(lpt.recursos_por_uf.flatMap((r) => Object.keys(r).filter((x) => x.endsWith("_reais")))))
          .sort()
          .map((id): ColunaTabela => {
            const m = /^(.*)_(contratado|pago)_reais$/.exec(id);
            const rot = m ? `${ROTULO_FONTE_RECURSO[m[1]] ?? m[1]}, ${m[2]}` : id;
            return { id, rotulo: rot, tipo: "numero", unidade: "R$", casas: 2 };
          }),
      ]
    : [];
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));

  return (
    <>
      <CabecalhoEnergia atual="inclusao-energetica" />
      <MarcaVisita secao="energia:inclusao-acesso" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo
          rotulo="Inclusão energética"
          titulo="Acesso à energia e sistemas isolados"
          referencia={
            <>
              PNAD Contínua anual até {a.ano_referencia}; PASI ciclo {si?.ciclo ?? "sem dado"} (EPE); Luz para Todos até {mes(lpt?.ultimo_mes)} (MME); custeio da CDE até{" "}
              {custeio?.linhas.at(-1)?.ano ?? "sem dado"}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Quem ainda não tem energia, com que regularidade ela chega a quem tem ligação, quem vive fora do Sistema Interligado e quantas ligações o Luz para Todos fez. Três
          dimensões, três fontes, que não se somam.
        </CabecalhoModulo>
        <InclusaoNavegacao atual="p062" />
        <ModoProfundidade>
          <Bloco id="acesso">
            <PainelEvidencia
              id="p062"
              pergunta={a.pergunta}
              subtitulo="Domicílios sem energia e com rede em tempo integral (PNAD), localidades isoladas (PASI) e ligações do Luz para Todos · domicílios e pessoas"
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  Ter ligação e ter serviço confiável são coisas diferentes, e as duas faltam em lugares diferentes. Localidades fora do Sistema Interligado têm energia, em geral de usinas
                  a óleo diesel pagas em parte pela CCC, e o Luz para Todos registra as ligações novas que o programa fez.
                </>
              }
              oQueMudou={mudancaAcesso(a)}
              comoInterpretar={
                <>
                  Três dimensões, três fontes: a PNAD estima domicílios sem energia de nenhuma fonte e o fornecimento em tempo integral entre os ligados à rede geral; o PASI lista as
                  localidades atendidas por sistemas isolados; o Luz para Todos conta domicílios ligados por ano do atendimento. Elas não se somam. O percentual em tempo integral é sobre
                  os ligados à rede, não sobre todos os domicílios.
                </>
              }
              naoConcluir={
                <>
                  A carga do SIN não mede acesso: sistemas isolados e domicílios sem ligação ficam fora dela. Ligação feita não garante serviço confiável depois.{" "}
                  {textoPrecisaoPnad({ ano_referencia: a.ano_referencia, pnad_serie: a.pnad_serie, pnad_situacao: a.pnad_situacao })} Localidade isolada não é localidade sem energia.
                </>
              }
              proveniencia={a.proveniencia.pnad}
              complementares={[
                ...(a.proveniencia.isolados ? [{ rotulo: "Sistemas isolados (PASI)", p: a.proveniencia.isolados }] : []),
                ...(a.proveniencia.luz_para_todos ? [{ rotulo: "Luz para Todos", p: a.proveniencia.luz_para_todos }] : []),
                ...(custeio ? [{ rotulo: "Custeio anual da CDE", p: custeio.proveniencia }] : []),
              ]}
            >
              <div className="space-y-6">
                <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p062">
                  {respostaAcesso(a)}
                </p>
                <InclusaoRecorte
                  periodo={
                    <>
                      PNAD de {a.pnad_serie[0]?.ano} a {a.ano_referencia}; PASI ciclos {si?.ciclos.map((x) => x.ciclo).join(", ") ?? "sem dado"}; Luz para Todos de{" "}
                      {mes(lpt?.evidencia_total.periodo.inicio)} a {mes(lpt?.ultimo_mes)}
                    </>
                  }
                  universo={<>Domicílios particulares permanentes do Brasil, regiões e UF; localidades isoladas do planejamento da EPE; atendimentos homologados pelo MME</>}
                  unidade="domicílios (mil e %); pessoas; domicílios atendidos"
                />
                {/* três números com ficha de prova; o tempo integral (tabela 6738) não tem ficha própria na gold e entra como nota, não como número de destaque */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Numero
                    rotulo={`Sem energia de nenhuma fonte, ${a.ano_referencia}`}
                    natureza="ESTIMADO"
                    evidencia={a.evidencia_sem_energia}
                    casas={0}
                    unidade="mil domicílios"
                    tamanho="medio"
                    motivoAusencia="Sem estimativa nesta publicação."
                    nota={
                      brPnad
                        ? `${pctTexto(brPnad.pct_sem_energia, 1)} dos domicílios. Entre os ligados à rede geral, ${pctTexto(brPnad.pct_integral_entre_rede, 1)} têm fornecimento em tempo integral (CV ${pctTexto(brPnad.cv_pct_integral, 1)}, tabela 6738 do IBGE, no CSV da PNAD).`
                        : undefined
                    }
                    endereco={`${rotaPainel("p062")}#p062`}
                  />
                  <Numero
                    rotulo={`Pessoas em localidades isoladas, ciclo ${si?.ciclo ?? ""}`.trim()}
                    natureza="OBSERVADO"
                    evidencia={si?.evidencia_populacao ?? null}
                    casas={0}
                    unidade="pessoas"
                    tamanho="medio"
                    motivoAusencia="PASI não processado nesta publicação."
                    endereco={`${rotaPainel("p062")}#p062`}
                  />
                  <Numero
                    rotulo="Domicílios atendidos pelo Luz para Todos"
                    natureza="OBSERVADO"
                    evidencia={lpt?.evidencia_total ?? null}
                    casas={0}
                    unidade="domicílios"
                    tamanho="medio"
                    motivoAusencia="Arquivo do MME não processado nesta publicação."
                    endereco={`${rotaPainel("p062")}#p062`}
                  />
                </div>

                <InclusaoSubtitulo>Quantos domicílios ainda não têm energia, e com que regularidade chega a dos ligados?</InclusaoSubtitulo>
                <InclusaoRegioesPnad serie={a.pnad_serie} />
                <InclusaoMapaPnad acesso={{ ano_referencia: a.ano_referencia, pnad_serie: a.pnad_serie, pnad_situacao: a.pnad_situacao }} csvUrl="/energia/series/inclusao_acesso_pnad.csv" fonte={FONTE_PNAD} />

                {si && (
                  <>
                    <InclusaoSubtitulo>Quem vive fora do Sistema Interligado?</InclusaoSubtitulo>
                    <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                      Localidades atendidas por sistemas isolados no planejamento da EPE (PASI). Isolamento não é falta de acesso: é acesso fora do SIN, em geral por usinas térmicas
                      locais. A população é informada pelas distribuidoras, não é contagem censitária.
                    </p>
                    <InclusaoIsolados si={{ ciclo: si.ciclo, por_uf: si.por_uf, localidades_mais_populosas: si.localidades_mais_populosas, pontos_json: si.pontos_json }} fonte={FONTE_PASI} />
                    <TabelaInterativa
                      titulo="Localidades isoladas por ciclo do PASI"
                      colunas={COLUNAS_CICLOS}
                      linhas={si.ciclos.map((x) => ({
                        id: x.ciclo,
                        ciclo: x.ciclo,
                        localidades: x.localidades,
                        populacao: x.populacao,
                        sem_pop: x.localidades_sem_populacao,
                        previsao: x.com_previsao_interligacao,
                        sairam: x.sairam_da_lista ?? null,
                      }))}
                      chaveLinha="id"
                      colunaRotulo="ciclo"
                      fonte={FONTE_PASI}
                      versao={si.ciclo}
                      nomeArquivo="inclusao-pasi-ciclos"
                      chaveUrl="ac.cic"
                      nota="Sair da lista de um ciclo para o seguinte costuma indicar interligação ao SIN, mas o PASI não informa o motivo em cada caso. O primeiro ciclo não tem anterior: saídas sem dado."
                    />
                  </>
                )}

                {lpt && (
                  <>
                    <InclusaoSubtitulo>Quantas ligações o Luz para Todos fez, e onde?</InclusaoSubtitulo>
                    <InclusaoLpt lpt={{ serie_anual: lpt.serie_anual, ultimo_mes: lpt.ultimo_mes, programas: lpt.programas, por_uf: lpt.por_uf }} fonte={FONTE_LPT} />
                  </>
                )}

                <InclusaoAnalise titulo="Detalhes do atendimento: municípios, recursos e custeio">
                  {lpt && (
                    <>
                      <TabelaInterativa
                        titulo={`Municípios com mais domicílios atendidos desde jan/2023 (até ${mes(lpt.ultimo_mes)})`}
                        colunas={COLUNAS_MUN_LPT}
                        linhas={lpt.municipios_mais_atendidos_desde_2023.map((m, i) => ({ id: `${m.uf}|${m.cod ?? i}`, municipio: m.municipio, uf: m.uf, cod: m.cod, domicilios: m.domicilios }))}
                        chaveLinha="id"
                        colunaRotulo="municipio"
                        fonte={FONTE_LPT}
                        versao={lpt.ultimo_mes}
                        nomeArquivo="inclusao-luz-para-todos-municipios-desde-2023"
                        chaveUrl="ac.mun"
                        ordemInicial={{ coluna: "domicilios", direcao: "desc" }}
                      />
                      <TabelaInterativa
                        titulo="Luz para Todos por ano do atendimento e programa"
                        colunas={colunasLpt(lpt)}
                        linhas={linhasLptAnual(lpt)}
                        chaveLinha="id"
                        colunaRotulo="ano"
                        fonte={FONTE_LPT}
                        versao={lpt.ultimo_mes}
                        nomeArquivo="inclusao-luz-para-todos-anual"
                        chaveUrl="ac.ano"
                        nota="Sem dado: nenhuma linha do programa no ano. Zero: linhas com quantidade zero no arquivo do MME."
                      />
                      <TabelaInterativa
                        titulo="Recursos do Luz para Todos por UF e fonte (contratado e pago não se somam)"
                        colunas={recursosCols}
                        linhas={lpt.recursos_por_uf.map((r) => ({ id: r.uf, ...r, nome: r.nome ?? r.uf }))}
                        chaveLinha="id"
                        colunaRotulo="nome"
                        fonte={FONTE_LPT}
                        versao={lpt.ultimo_mes}
                        nomeArquivo="inclusao-luz-para-todos-recursos-uf"
                        chaveUrl="ac.rec"
                        nota="R$ correntes, sem correção pela inflação. Os recursos por contrato e o valor anual da CDE para o programa são grandezas diferentes."
                      />
                    </>
                  )}
                  <GraficoBarras
                    titulo={`Valores anuais da CDE para o Luz para Todos e para a CCC, ${a.universalizacao.luz_para_todos_cde[0]?.ano ?? "sem dado"} a ${a.universalizacao.luz_para_todos_cde.at(-1)?.ano ?? "sem dado"} (R$ bilhões correntes; o ano em curso é orçado)`}
                    dados={a.universalizacao.luz_para_todos_cde.map((l) => {
                      const ccc = a.universalizacao.ccc_cde.find((x) => x.ano === l.ano)?.valor_reais ?? null;
                      return {
                        id: l.ano,
                        rotulo: l.ano === a.universalizacao.ano_corrente_orcado ? `${l.ano} (ano em curso)` : l.ano,
                        lpt: l.valor_reais === null ? null : l.valor_reais / 1e9,
                        ccc: ccc === null ? null : ccc / 1e9,
                      };
                    })}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[
                      { id: "lpt", rotulo: "Luz para Todos", cor: "var(--cor-energia)" },
                      { id: "ccc", rotulo: "CCC (sistemas isolados)", cor: "var(--serie-termica)" },
                    ]}
                    unidade="R$ bilhões"
                    casas={2}
                    altura={300}
                  />
                </InclusaoAnalise>

                <InclusaoAuditoria titulo="Conferências, lacunas e fontes tentadas">
                  {si?.conferencia_pdf && (
                    <p className="text-sm text-carvao-muted">
                      PASI contra o caderno em PDF ({si.conferencia_pdf.documento}, página {si.conferencia_pdf.pagina}): {si.conferencia_pdf.localidades_pdf} localidades e{" "}
                      {num(si.conferencia_pdf.populacao_milhoes_pdf, 3)} milhão de pessoas no texto; {si.conferencia_pdf.localidades_xlsx} localidades e{" "}
                      {inteiro(si.conferencia_pdf.populacao_xlsx)} pessoas na exportação. Resultado: {si.conferencia_pdf.resultado}. Tolerância: {si.conferencia_pdf.tolerancia}.
                    </p>
                  )}
                  {lpt && (
                    <p className="text-sm text-carvao-muted">
                      Luz para Todos: {inteiro(lpt.municipios.total)} nomes de município no arquivo, {inteiro(lpt.municipios.com_codigo_ibge)} com código IBGE pelo nome exato na UF;{" "}
                      {lpt.municipios.sem_codigo_ibge} sem correspondência ({inteiro(lpt.municipios.domicilios_sem_codigo)} domicílios, contados na UF e no total). Maiores sem código:{" "}
                      {lpt.municipios.maiores_sem_codigo
                        .slice(0, 5)
                        .map((m) => `${m.municipio} (${m.uf})`)
                        .join(", ")}
                      .
                    </p>
                  )}
                  <p className="text-sm text-carvao-muted">{a.universalizacao.limitacao}</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
                    {a.universalizacao.fontes_tentadas.map((f) => (
                      <li key={f} className="break-words">
                        {f}
                      </li>
                    ))}
                  </ul>
                </InclusaoAuditoria>

                <InclusaoSeguir
                  ancora="p062"
                  href="/setor-eletrico/conta-de-luz"
                  pergunta="Quanto custa a energia ao consumidor e o que compõe a conta?"
                  downloads={downloads([
                    "/energia/series/inclusao_acesso_pnad.csv",
                    "/energia/series/inclusao_sistemas_isolados.csv",
                    "/energia/series/inclusao_luz_para_todos_mensal.csv",
                    "/energia/series/inclusao_luz_para_todos_municipios.csv",
                    "/energia/series/inclusao_luz_para_todos_recursos.csv",
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
