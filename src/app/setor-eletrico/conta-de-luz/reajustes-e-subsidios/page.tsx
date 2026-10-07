import { recusaEmLinguagemSimples } from "@/lib/energia/bastidor";
import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ContaBandeiras } from "@/components/energia/ContaBandeiras";
import { ContaLinkFiltros } from "@/components/energia/ContaLinkPainel";
import { ContaReajustes } from "@/components/energia/ContaReajustes";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  COR_GRUPO_CDE,
  GRUPOS_DESPESA_CDE,
  categoriasSubsidio,
  corSubsidio,
  linhasCde,
  linhasSubsidios,
  mudancaSubsidios,
  respostaBandeira,
  respostaCde,
  respostaSubsidios,
  minuscula,
  rotuloDistribuidora,
  verboVariacao,
} from "@/lib/energia/conta";
import { carimbo, dataBR, mesAno, num, pct, reais } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { ContaGold } from "@/lib/energia/tipos-conta";
import { Auditoria, FONTE_TARIFAS, ROTA_CONTA, ROTA_REAJUSTES, Recorte, Seguir } from "../partes";

/**
 * P050 do módulo Conta de luz em página própria: "O que mudou e quem financia os
 * benefícios?". Três painéis de fontes e naturezas diferentes (variação da tarifa
 * B1 contra o IPCA, bandeiras acionadas e financiamento dos descontos pela CDE).
 * Fica separada das tarifas, da composição e do simulador por peso: as duas metades
 * juntas passavam da meta de HTML do contrato dos módulos (seção 5.1). A escolha de
 * distribuidoras (?dist=) atravessa as duas páginas pelos links internos.
 */

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Conta de luz: reajustes, bandeiras e subsídios",
  description:
    "Variação da tarifa B1 residencial de cada distribuidora contra o IPCA no mesmo período, bandeiras tarifárias acionadas mês a mês, subsídios tarifários por categoria e orçamento anual da CDE.",
  alternates: { canonical: "/setor-eletrico/conta-de-luz/reajustes-e-subsidios" },
};

const COLUNAS_BANDEIRAS: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "data" },
  { id: "bandeira", rotulo: "Bandeira", tipo: "texto", categorica: true },
  {
    id: "rs_mwh",
    rotulo: "Adicional acionado",
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
];

const COLUNAS_SUB_DIST: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "nome", rotulo: "Razão social", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  {
    id: "total",
    rotulo: "Repasse homologado no ano",
    tipo: "numero",
    unidade: "R$ milhões",
    casas: 1,
  },
];

export default function ContaReajustesPage() {
  const g = lerGold<ContaGold>("conta.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="conta-de-luz" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel
            titulo="Reajustes, bandeiras e subsídios indisponíveis nesta publicação"
            motivo={
              g?.motivo ??
              "A gold do módulo Conta de luz (public/energia/gold/conta.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
            }
          />
        </main>
      </>
    );
  }

  const reaj = g.reajustes;
  const band = g.bandeiras;
  const sub = g.subsidios;
  const cde = g.financiamento_cde;
  const ref = g.data_referencia;
  const ultimoIpca = reaj.comparacao_inflacao?.ultimo_ipca ?? null;
  const janela12 = reaj.comparacao_inflacao?.janelas.find((j) => j.meses === 12) ?? null;
  const linhasSub = linhasSubsidios(sub);
  const catsSub = categoriasSubsidio(sub);
  const linhasSubDist = sub.distribuidoras_ultimo_ano.map((d) => ({
    id: d.cnpj,
    sigla: rotuloDistribuidora(d.sigla, d.cnpj),
    nome: d.nome,
    cnpj: d.cnpj,
    total: d.total === null ? null : d.total / 1e6,
  }));
  const linhasCdeAno = cde ? linhasCde(cde) : [];
  const rotuloGrupoCde = new Map((cde?.grupos ?? []).map((x) => [x.id, x.rotulo]));
  // a mudança mais recente pela data (a ordem do arquivo não é contrato)
  const ultimoEvento = reaj.ultimos.reduce<(typeof reaj.ultimos)[number] | null>((m, u) => (m === null || u[2] > m[2] ? u : m), null);
  const subUltimo = sub.anual.at(-1) ?? null;
  const adicionalVigente = band.vigente?.rs_mwh ?? null;
  const janelasMeses = (reaj.comparacao_inflacao?.janelas ?? []).map((j) => j.meses);
  const listaPt = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}` : (xs[0] ?? ""));
  const patamarExemplo = band.patamares.find((p) => p.rs_mwh !== null && p.rs_mwh > 0 && p.rs_kwh !== null) ?? null;
  const contagemUltimoAno =
    Object.entries(band.contagem_por_ano)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .at(-1) ?? null;

  return (
    <>
      <CabecalhoEnergia atual="conta-de-luz" />
      <MarcaVisita secao="energia:conta-de-luz:reajustes" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <nav aria-label="Trilha" className="pt-6 text-sm text-carvao-muted">
          <ContaLinkFiltros href={ROTA_CONTA} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
            Conta de luz
          </ContaLinkFiltros>{" "}
          <span aria-hidden="true">›</span> Reajustes, bandeiras e subsídios
        </nav>
        <CabecalhoModulo siglas={["REH", "PLD", "SIN", "TUSD", "TE", "ANEEL"]}
          rotulo="Conta de luz"
          titulo="O que mudou e quem financia os benefícios?"
          referencia={
            <>
              Tarifas de aplicação da ANEEL até {dataBR(ref)}; IPCA até {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "mês não publicado"}; bandeira de{" "}
              {band.vigente ? mesAno(`${band.vigente.mes}-01`) : "mês não publicado"}; subsídios até {subUltimo ? `${subUltimo.ano}${subUltimo.parcial ? ` (${subUltimo.meses} ${subUltimo.meses === 1 ? "mês" : "meses"}, parcial)` : ""}` : "sem dado"} e orçamento da CDE de{" "}
              {cde?.ultimo_ano ?? "sem dado"}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
        >
          Três leituras separadas, com fontes e naturezas diferentes: quanto a tarifa B1 de cada distribuidora mudou diante da inflação, quando a bandeira encareceu a conta e quem
          paga os descontos tarifários e a Tarifa Social. Tarifas, composição e o simulador estão na{" "}
          <ContaLinkFiltros href={ROTA_CONTA} className="text-energia-dark underline underline-offset-4">
            página principal da Conta de luz
          </ContaLinkFiltros>
          .
        </CabecalhoModulo>

        <nav aria-label="Perguntas desta página" className="pb-4">
          <ol className="grid gap-2 text-sm sm:grid-cols-3">
            {[
              ["#reajustes", "A tarifa subiu mais que a inflação?"],
              ["#bandeiras", "Quando a bandeira encareceu a conta?"],
              ["#subsidios", "Quem financia os descontos e benefícios da conta?"],
            ].map(([href, rot], i) => (
              <li key={href}>
                <a href={href} className="flex min-h-[44px] items-center gap-2 border border-linha bg-superficie px-3 py-2 text-carvao hover:border-energia">
                  <span className="rotulo text-mineral">{i + 1}</span>
                  {rot}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <ModoProfundidade>
          <Bloco id="p050">
            <div className="space-y-8">
              <PainelEvidencia
                id="reajustes"
                pergunta="A tarifa subiu mais que a inflação?"
                subtitulo="Variação da tarifa B1 residencial de aplicação e IPCA no mesmo período · %"
                natureza="CALCULADO"
                porQueImporta={
                  <>
                    Compara a variação da tarifa de cada distribuidora com a inflação medida pelo IPCA nos mesmos meses
                    {janelasMeses.length ? `, em janelas de ${listaPt(janelasMeses.map(String))} meses` : ""}.
                  </>
                }
                oQueMudou={
                  ultimoEvento ? (
                    <>
                      Mudança mais recente no arquivo: {rotuloDistribuidora(ultimoEvento[1], ultimoEvento[0])}, em {dataBR(ultimoEvento[2])} ({ultimoEvento[3]}), quando a tarifa B1{" "}
                      {verboVariacao(ultimoEvento[4])}; o IPCA desde a mudança anterior foi {pct(ultimoEvento[5], 2)}.
                    </>
                  ) : (
                    "Nenhuma mudança de tarifa no arquivo."
                  )
                }
                comoInterpretar={
                  <>
                    Barra além da linha do IPCA: a tarifa subiu mais que a inflação na janela; antes dela, menos. A tarifa é a vigente no último dia do mês inicial e do mês final;
                    o IPCA é a razão dos números-índice dos mesmos meses (
                    {reaj.comparacao_inflacao?.conferencia_ipca_12m.confere ? "conferida contra a variação publicada pelo IBGE" : "sem conferência com a variação publicada"}
                    ).
                  </>
                }
                naoConcluir={
                  <>
                    {reaj.nota} O efeito médio de cada processo para todos os consumidores não está publicado aqui. O conjunto não informa se o ato é reajuste, revisão periódica ou
                    extraordinária. A diferença entre o PLD e a tarifa não é margem da distribuidora.
                  </>
                }
                proveniencia={reaj.proveniencia}
                complementares={[{ rotulo: "IPCA (IBGE)", p: reaj.proveniencia_ipca }]}
              >
                <div className="space-y-6">
                  <Recorte
                    periodo={
                      <>
                        Janelas terminadas em {dataBR(reaj.comparacao_inflacao?.referencia)} (último IPCA: {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "não publicado"})
                      </>
                    }
                    universo={<>Distribuidoras com tarifa B1 nas duas datas da janela e sem mudança de área entre elas</>}
                    unidade="% de variação nominal; variação real na tabela"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Numero
                      rotulo="Variação mediana da tarifa B1 em 12 meses"
                      natureza="CALCULADO"
                      valor={janela12?.mediana_pct ?? null}
                      formato="pct"
                      casas={2}
                      evidencia={reaj.evidencia}
                      motivoAusencia="Sem IPCA ou sem tarifa nas duas datas da janela."
                      nota={
                        janela12
                          ? `${janela12.n} distribuidoras. IPCA de ${mesAno(`${janela12.ipca_meses[0]}-01`)} a ${mesAno(`${janela12.ipca_meses[1]}-01`)}: ${pct(janela12.ipca_pct, 2)}, pela razão dos números-índice do IBGE (SIDRA, tabela 1737), na fórmula desta prova e conferido contra a variação publicada no modo Auditar.`
                          : undefined
                      }
                      tamanho="medio"
                      endereco={`${ROTA_REAJUSTES}#reajustes`}
                    />
                    {/* O IPCA da janela não ganha destaque próprio: a gold não traz evidência só para ele, e ele
                        já está na nota acima, na resposta, na linha de referência do gráfico e na conferência. */}
                  </div>
                  <ContaReajustes janelas={reaj.comparacao_inflacao?.janelas ?? []} ultimos={reaj.ultimos} dataReferencia={ref} fonte={FONTE_TARIFAS} />
                  <div className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
                    <p className="rotulo text-mineral">Efeito médio do processo tarifário: não publicado</p>
                    <p className="mt-1 leading-relaxed">{recusaEmLinguagemSimples(reaj.efeito_medio.motivo)}</p>
                  </div>
                  <Auditoria titulo="Incorporações e conferência do IPCA">
                    <ul className="space-y-2 text-sm text-carvao-muted">
                      {g.incorporacoes.map((i) => (
                        <li key={i.id}>
                          <span className="font-medium text-carvao">{rotuloDistribuidora(i.sigla_incorporadora, i.incorporadora)}</span> incorporou{" "}
                          {i.siglas_incorporadas.map((s, k) => rotuloDistribuidora(s, i.incorporadas[k])).join(", ")}; {i.ato} de {dataBR(i.data_ato)}; tarifa unificada desde{" "}
                          {dataBR(i.tarifa_unificada_desde)}; situação nos dados: {i.situacao}. Origem do número do ato: {i.identificacao}.
                        </li>
                      ))}
                    </ul>
                    {reaj.comparacao_inflacao && (
                      <p className="text-sm text-carvao-muted">
                        IPCA em 12 meses até {mesAno(`${reaj.comparacao_inflacao.conferencia_ipca_12m.mes}-01`)}:{" "}
                        {pct(reaj.comparacao_inflacao.conferencia_ipca_12m.calculado_pct, 4)} pela razão de índices e{" "}
                        {pct(reaj.comparacao_inflacao.conferencia_ipca_12m.publicado_pct, 2)} publicado pelo IBGE (tolerância de{" "}
                        {num(reaj.comparacao_inflacao.conferencia_ipca_12m.tolerancia_pp, 2)} ponto percentual: {reaj.comparacao_inflacao.conferencia_ipca_12m.justificativa}
                        ).
                      </p>
                    )}
                  </Auditoria>
                  <Seguir ancora="reajustes" href="#bandeiras" pergunta="Quando a bandeira encareceu a conta?" />
                </div>
              </PainelEvidencia>

              <PainelEvidencia
                id="bandeiras"
                pergunta="Quando a bandeira encareceu a conta?"
                subtitulo="Bandeira tarifária acionada por mês e adicional por kWh consumido · R$/MWh e R$/kWh"
                natureza="OBSERVADO"
                porQueImporta={
                  <>
                    A <Termo slug="bandeira-tarifaria">bandeira tarifária</Termo> soma à conta um valor por kWh consumido conforme o patamar acionado no mês; a verde não tem
                    acréscimo.
                  </>
                }
                oQueMudou={
                  contagemUltimoAno ? (
                    <>
                      Em {contagemUltimoAno[0]} (até {band.vigente ? mesAno(`${band.vigente.mes}-01`) : "o último mês publicado"}
                      ):{" "}
                      {Object.entries(contagemUltimoAno[1])
                        .map(([b, n]) => `${n} ${n === 1 ? "mês" : "meses"} de ${minuscula(b)}`)
                        .join(", ")}
                      .
                    </>
                  ) : (
                    "Sem acionamento publicado."
                  )
                }
                comoInterpretar={
                  <>
                    Cada célula é um mês, com a sigla da bandeira; o valor do adicional de cada patamar mudou ao longo do tempo (tabela de adicionais por resolução, no modo
                    Analisar). O valor publicado está em R$/MWh e se divide por 1000 para chegar ao valor por kWh
                    {patamarExemplo
                      ? `: ${num(patamarExemplo.rs_mwh, 2)} R$/MWh da ${minuscula(patamarExemplo.bandeira)} são ${reais(patamarExemplo.rs_kwh, 5)} por kWh, como na página da ANEEL`
                      : ""}
                    .
                  </>
                }
                naoConcluir={
                  <>
                    A grade não mostra o efeito da bandeira na conta de cada distribuidora: o acréscimo depende do consumo e não vale nos sistemas isolados. Em{" "}
                    {band.conferencia.divergem.length} dos {band.conferencia.meses} meses o valor acionado não confere com a tabela de adicionais ou não tem resolução
                    correspondente (lista no modo Auditar).
                  </>
                }
                proveniencia={band.proveniencia}
              >
                <div className="space-y-6">
                  <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p050-bandeiras">
                    {respostaBandeira(band)}
                  </p>
                  <Recorte
                    periodo={
                      <>
                        {band.acionamento[0] ? mesAno(`${band.acionamento[0].m}-01`) : "sem dado"} a{" "}
                        {band.acionamento.at(-1) ? mesAno(`${band.acionamento.at(-1)!.m}-01`) : "sem dado"}
                      </>
                    }
                    universo="Consumidores cativos do SIN; não se aplica a sistemas isolados"
                    unidade="R$/MWh publicado (÷ 1000 = R$/kWh)"
                  />
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                    <ContaBandeiras acionamento={band.acionamento} />
                    {/* o cartão não ocupa 100% da altura da linha: a tabela de patamares vem depois dele e, com h-full, passava da linha e cobria o rodapé do painel */}
                    <div className="min-w-0 [&>[role=group]]:h-auto">
                      <Numero
                        rotulo={`Adicional de ${band.vigente?.bandeira ? minuscula(band.vigente.bandeira) : "bandeira"} em ${band.vigente ? mesAno(`${band.vigente.mes}-01`) : "mês não publicado"}`}
                        natureza="OBSERVADO"
                        valor={adicionalVigente === null ? null : adicionalVigente / 1000}
                        formato="reais"
                        casas={5}
                        unidade="R$/kWh"
                        evidencia={band.evidencia}
                        nota={adicionalVigente !== null ? `${num(adicionalVigente, 2)} R$/MWh no arquivo da ANEEL, dividido por 1000.` : undefined}
                        tamanho="medio"
                        endereco={`${ROTA_REAJUSTES}#bandeiras`}
                      />
                      <table className="mt-3 w-full border-collapse text-sm tabular-nums">
                        <caption className="text-left text-xs text-mineral">Patamares vigentes na data</caption>
                        <tbody>
                          {band.patamares.map((p) => (
                            <tr key={p.bandeira} className="border-b border-linha">
                              <th scope="row" className="py-1.5 pr-2 text-left font-normal text-carvao">
                                {p.bandeira}
                              </th>
                              <td className="py-1.5 text-right">{p.rs_kwh === null ? "sem valor" : p.rs_kwh === 0 ? "sem acréscimo" : `${reais(p.rs_kwh, 5)}/kWh`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div data-nivel="analisar" className="space-y-3">
                    <h4 className="font-serif text-base text-carvao">Adicionais por resolução</h4>
                    <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Adicionais de bandeira por resolução">
                      <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums">
                        <thead>
                          <tr className="border-b border-linha text-left text-xs text-mineral">
                            <th scope="col" className="py-2 pr-3 font-normal">
                              Vigência
                            </th>
                            <th scope="col" className="py-2 pr-3 font-normal">
                              Resolução
                            </th>
                            {Array.from(new Set(band.adicionais.flatMap((a) => Object.keys(a.valores)))).map((b) => (
                              <th key={b} scope="col" className="py-2 pr-3 text-right font-normal">
                                {b} (R$/MWh)
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {band.adicionais.map((a) => (
                            <tr key={a.vigencia} className="border-b border-linha">
                              <td className="py-1.5 pr-3">{dataBR(a.vigencia)}</td>
                              <td className="py-1.5 pr-3">{a.resolucao ?? "sem resolução no conjunto"}</td>
                              {Array.from(new Set(band.adicionais.flatMap((x) => Object.keys(x.valores)))).map((b) => (
                                <td key={b} className="py-1.5 pr-3 text-right">
                                  {b in a.valores ? num(a.valores[b], 2) : "não se aplica"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ContaSobDemanda chaveUrl="band" rotulo="a tabela mês a mês das bandeiras" detalhe={`${band.acionamento.length} meses`}>
                      <TabelaInterativa
                        titulo="Bandeira acionada por mês"
                        colunas={COLUNAS_BANDEIRAS}
                        linhas={band.acionamento.map((a) => ({
                          id: a.m,
                          m: a.m,
                          bandeira: a.bandeira,
                          rs_mwh: a.rs_mwh,
                        }))}
                        chaveLinha="id"
                        colunaRotulo="m"
                        fonte="ANEEL, Bandeiras Tarifárias"
                        versao={band.vigente?.mes ?? ref}
                        nomeArquivo="conta-bandeiras-mensal"
                        chaveUrl="band"
                        ordemInicial={{ coluna: "m", direcao: "desc" }}
                      />
                    </ContaSobDemanda>
                  </div>
                  <Auditoria titulo="Conferência do acionamento contra a tabela de adicionais">
                    <p className="text-sm text-carvao-muted">
                      {band.conferencia.conferem} de {band.conferencia.meses} meses conferem com o adicional da resolução vigente. Os demais:
                    </p>
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-carvao-muted">
                      {band.conferencia.divergem.map((d) => (
                        <li key={d.mes}>
                          {mesAno(`${d.mes}-01`)}, {d.bandeira ?? "sem nome"}: acionamento de {num(d.acionamento, 2)} R$/MWh;{" "}
                          {d.tabela === null ? "sem resolução correspondente na tabela" : `tabela vigente de ${num(d.tabela, 2)} R$/MWh`}.
                        </li>
                      ))}
                    </ul>
                  </Auditoria>
                  <Seguir ancora="bandeiras" href="#subsidios" pergunta="Quem financia os descontos e benefícios da conta?" />
                </div>
              </PainelEvidencia>

              <PainelEvidencia
                id="subsidios"
                pergunta="Quem financia os descontos e benefícios da conta?"
                subtitulo="Subsídios tarifários homologados por categoria e orçamento anual da CDE · R$ bilhões"
                natureza="CALCULADO"
                porQueImporta={
                  <>
                    Descontos a categorias de usuários (rural, irrigação, fontes incentivadas, micro e minigeração) e a Tarifa Social são custeados pela{" "}
                    <Termo slug="cde">Conta de Desenvolvimento Energético</Termo>, cuja maior receita são as quotas cobradas nas tarifas de todos os consumidores.
                  </>
                }
                oQueMudou={mudancaSubsidios(sub)}
                comoInterpretar={
                  <>
                    O primeiro gráfico soma os repasses homologados por distribuidora e mês, por ano de competência (
                    {linhasSub.filter((l) => String(l.rotulo).includes("parcial")).length ? "o ano parcial está marcado" : "todos os anos completos"}
                    ). O segundo mostra o orçamento anual da CDE por grupo de despesa: valores aprovados ou previstos pela ANEEL, não execução.
                  </>
                }
                naoConcluir={
                  <>
                    {sub.nota} Os dois conjuntos não se somam: {cde?.comparacao_com_subsidios ?? "o orçamento da CDE não foi publicado nesta gold."} Orçamento não é o que foi
                    gasto.
                  </>
                }
                proveniencia={sub.proveniencia}
                complementares={cde?.proveniencia ? [{ rotulo: "Orçamento da CDE", p: cde.proveniencia }] : []}
              >
                <div className="space-y-6">
                  <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p050-subsidios">
                    {respostaSubsidios(sub)} {respostaCde(cde)}
                  </p>
                  <Recorte
                    periodo={
                      <>
                        Subsídios de {sub.anual[0]?.ano ?? "sem dado"} a {sub.anual.at(-1)?.ano ?? "sem dado"}; orçamento da CDE de {cde?.anos[0] ?? "sem dado"} a{" "}
                        {cde?.ultimo_ano ?? "sem dado"}
                      </>
                    }
                    universo={
                      <>
                        Todas as distribuidoras do conjunto de subsídios; todas as rubricas do orçamento da CDE ({sub.competencias_futuras_excluidas} competências futuras já
                        homologadas ficam fora)
                      </>
                    }
                    unidade="R$ bilhões nominais"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Numero
                      rotulo={`Subsídios tarifários em ${sub.ultimo_ano_completo ?? "último ano"}`}
                      natureza="CALCULADO"
                      valor={sub.evidencia && sub.evidencia.valor_calculo !== null ? sub.evidencia.valor_calculo / 1e9 : null}
                      formato="reais"
                      casas={1}
                      unidade="bilhões"
                      evidencia={sub.evidencia}
                      tamanho="medio"
                      motivoAusencia="Sem ano completo publicado."
                      endereco={`${ROTA_REAJUSTES}#subsidios`}
                    />
                    <Numero
                      rotulo={`Quotas nas receitas da CDE ${cde?.ultimo_ano ?? ""}`.trim()}
                      natureza="PREVISTO"
                      valor={cde?.evidencia?.valor_calculo ?? null}
                      formato="pct"
                      casas={1}
                      evidencia={cde?.evidencia ?? null}
                      tamanho="medio"
                      motivoAusencia="Orçamento não publicado."
                      nota="Orçamento aprovado ou previsto pela ANEEL, não execução."
                      endereco={`${ROTA_REAJUSTES}#subsidios`}
                    />
                  </div>
                  <GraficoBarras
                    titulo="Subsídios tarifários homologados por categoria e ano (repasses da CDE às distribuidoras)"
                    dados={linhasSub}
                    chaveCategoria="ano"
                    chaveRotulo="rotulo"
                    series={catsSub.map((c) => ({
                      id: c,
                      rotulo: c,
                      cor: corSubsidio(c),
                    }))}
                    empilhado
                    unidade="R$ bi"
                    casas={2}
                    altura={360}
                  />
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {sub.categorias.map((c) => (
                      <div key={c.categoria}>
                        <dt className="font-medium text-carvao">
                          <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 align-middle" style={{ background: corSubsidio(c.categoria) }} />
                          {c.categoria}
                        </dt>
                        <dd className="mt-0.5 text-carvao-muted">{c.definicao}</dd>
                      </div>
                    ))}
                  </dl>
                  {cde && (
                    <>
                      <GraficoBarras
                        titulo={`Orçamento anual da CDE por grupo de despesa, ${cde.anos[0]} a ${cde.ultimo_ano} (aprovado ou previsto pela ANEEL)`}
                        dados={linhasCdeAno}
                        chaveCategoria="ano"
                        series={GRUPOS_DESPESA_CDE.map((id) => ({
                          id,
                          rotulo: rotuloGrupoCde.get(id) ?? id,
                          cor: COR_GRUPO_CDE[id],
                        }))}
                        empilhado
                        unidade="R$ bi"
                        casas={2}
                        altura={340}
                      />
                      <ContaSobDemanda chaveUrl="cde" rotulo="a tabela do orçamento da CDE por ano" detalhe={`${linhasCdeAno.length} anos, exportável`}>
                        <TabelaInterativa
                          titulo="Orçamento da CDE por ano: despesas, receitas, quotas e Tarifa Social"
                          colunas={[
                            { id: "ano", rotulo: "Ano", tipo: "texto" },
                            {
                              id: "despesa",
                              rotulo: "Despesa",
                              tipo: "numero",
                              unidade: "R$ bi",
                              casas: 2,
                            },
                            ...GRUPOS_DESPESA_CDE.map((id) => ({
                              id,
                              rotulo: rotuloGrupoCde.get(id) ?? id,
                              tipo: "numero" as const,
                              unidade: "R$ bi",
                              casas: 2,
                            })),
                            {
                              id: "receita",
                              rotulo: "Receita",
                              tipo: "numero",
                              unidade: "R$ bi",
                              casas: 2,
                            },
                            {
                              id: "quotas_tarifa",
                              rotulo: rotuloGrupoCde.get("quotas_tarifa") ?? "Quotas",
                              tipo: "numero",
                              unidade: "R$ bi",
                              casas: 2,
                            },
                            {
                              id: "outras_receitas",
                              rotulo: rotuloGrupoCde.get("outras_receitas") ?? "Outras receitas",
                              tipo: "numero",
                              unidade: "R$ bi",
                              casas: 2,
                            },
                            {
                              id: "quotas_pct",
                              rotulo: "Quotas nas receitas",
                              tipo: "percentual",
                              casas: 1,
                            },
                            {
                              id: "tarifa_social_pct",
                              rotulo: "Tarifa Social nas despesas",
                              tipo: "percentual",
                              casas: 1,
                            },
                          ]}
                          linhas={linhasCdeAno.map((l) => ({
                            ...l,
                            id: l.ano,
                          }))}
                          chaveLinha="id"
                          colunaRotulo="ano"
                          fonte="ANEEL, CDE: custeio dos benefícios tarifários"
                          versao={cde.ultimo_ano}
                          nomeArquivo="conta-orcamento-cde"
                          chaveUrl="cde"
                          ordemInicial={{ coluna: "ano", direcao: "desc" }}
                          nota={cde.natureza_valores}
                        />
                      </ContaSobDemanda>
                      <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        {cde.grupos.map((gr) => (
                          <div key={gr.id}>
                            <dt className="font-medium text-carvao">
                              {gr.rotulo} ({gr.tipo.toLowerCase()})
                            </dt>
                            <dd className="mt-0.5 text-carvao-muted">{gr.definicao}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                  <div data-nivel="analisar">
                    <ContaSobDemanda chaveUrl="sub" rotulo="os subsídios por distribuidora" detalhe={`${linhasSubDist.length} distribuidoras, exportável`}>
                      <TabelaInterativa
                        titulo={`Subsídios tarifários por distribuidora em ${sub.ultimo_ano_completo ?? "último ano completo"}`}
                        colunas={COLUNAS_SUB_DIST}
                        linhas={linhasSubDist}
                        chaveLinha="id"
                        colunaRotulo="sigla"
                        fonte="ANEEL, Subsídios Tarifários"
                        versao={sub.ultimo_ano_completo ?? ref}
                        nomeArquivo="conta-subsidios-por-distribuidora"
                        chaveUrl="sub"
                        ordemInicial={{ coluna: "total", direcao: "desc" }}
                        dicaBusca="Sigla, razão social ou CNPJ"
                        nota="Repasse homologado (previsão mais ajuste) somado nas competências do ano; por categoria no CSV de subsídios."
                      />
                    </ContaSobDemanda>
                  </div>
                  <Auditoria titulo="Conferências dos subsídios e do orçamento da CDE">
                    <p className="text-sm text-carvao-muted">
                      Categorias contra a linha Total publicada: {num(sub.checagem.total_vs_categorias.comparacoes, 0)} pares distribuidora e mês,{" "}
                      {num(sub.checagem.total_vs_categorias.divergem, 0)} com diferença (maior de {reais(sub.checagem.total_vs_categorias.maior_diferenca_rs)}
                      ); o ano exibido usa a soma das categorias. Total contra previsão mais ajuste: {num(sub.checagem.total_vs_previsao_mais_ajuste.divergem, 0)} de{" "}
                      {num(sub.checagem.total_vs_previsao_mais_ajuste.comparacoes, 0)} comparações diferem.
                    </p>
                    {cde && (
                      <>
                        <ul className="space-y-1 text-sm text-carvao-muted">
                          {cde.reconciliacao_externa.map((r) => (
                            <li key={r.ano}>
                              {r.ano}: arquivo com despesa de {reais(r.arquivo_despesa_rs === null ? null : r.arquivo_despesa_rs / 1e9, 3)} bilhões; ANEEL, “
                              <a href={r.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
                                {r.titulo}
                              </a>
                              ”: diferença de {reais(r.diferenca_rs === null ? null : r.diferenca_rs / 1e6, 1)} milhões, tolerância de{" "}
                              {reais(r.tolerancia_rs === null ? null : r.tolerancia_rs / 1e6, 0)} milhões (
                              {r.confere === null ? "sem conferência" : r.confere ? "confere" : "não confere"}
                              ). Como a fonte foi lida: {r.acesso.replace(/\.\s*$/, "")}.
                            </li>
                          ))}
                        </ul>
                        <p className="text-sm text-carvao-muted">
                          {cde.nota} Rubricas publicadas sem valor em {cde.ultimo_ano}:{" "}
                          {cde.totais.find((x) => x.ano === cde.ultimo_ano)?.rubricas_sem_valor.join(", ") || "nenhuma"} (ausência, não zero).
                        </p>
                      </>
                    )}
                  </Auditoria>
                  <Seguir ancora="subsidios" href="/setor-eletrico/pld" pergunta="Como funciona e como varia o PLD, que não é a tarifa da conta?" />
                </div>
              </PainelEvidencia>
            </div>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
