import type { Metadata } from "next";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ContaBandeiras } from "@/components/energia/ContaBandeiras";
import { ContaLinkFiltros } from "@/components/energia/ContaLinkPainel";
import { ContaReajustes } from "@/components/energia/ContaReajustes";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
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
  vereditoBandeira,
  vereditoSubsidios,
} from "@/lib/energia/conta";
import { carimbo, dataBR, mesAno, num, pct, reais } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { ContaGold } from "@/lib/energia/tipos-conta";
import { Auditoria, Datas, FONTE_TARIFAS, Navegacao, ROTA_CONTA, ROTA_REAJUSTES, Recorte, Seguir, downloadsDoPainel } from "../partes";

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
        <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
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
  // a data da recusa vem do registro da coleta (dd/mm/aaaa); o código da resposta e o desafio do navegador ficam em Analisar
  const dataEfeitoMedio = /(\d{2}\/\d{2}\/\d{4})/.exec(reaj.efeito_medio.motivo)?.[1] ?? null;
  const adicionalVigente = band.vigente?.rs_mwh ?? null;
  const janelasMeses = (reaj.comparacao_inflacao?.janelas ?? []).map((j) => j.meses);
  const listaPt = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}` : (xs[0] ?? ""));
  const patamarExemplo = band.patamares.find((p) => p.rs_mwh !== null && p.rs_mwh > 0 && p.rs_kwh !== null) ?? null;
  const contagemUltimoAno =
    Object.entries(band.contagem_por_ano)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .at(-1) ?? null;
  const mesBandeira = band.vigente ? mesAno(`${band.vigente.mes}-01`) : null;

  // notas de cada painel: ficam logo depois das figuras do painel
  const oQueMudouReajustes = ultimoEvento ? (
    <>
      Mudança mais recente no arquivo: {rotuloDistribuidora(ultimoEvento[1], ultimoEvento[0])}, em {dataBR(ultimoEvento[2])} ({ultimoEvento[3]}), quando a tarifa B1{" "}
      {verboVariacao(ultimoEvento[4])}; o IPCA desde a mudança anterior ({mesAno(`${ultimoEvento[6]}-01`)} a {mesAno(`${ultimoEvento[7]}-01`)}) foi {pct(ultimoEvento[5], 2)}.
    </>
  ) : (
    "Nenhuma mudança de tarifa no arquivo."
  );
  const comoInterpretarReajustes = (
    <>
      Barra além da linha do IPCA: a tarifa subiu mais que a inflação na janela; antes dela, menos. A tarifa é a vigente no último dia do mês inicial e do mês final; o IPCA é a razão
      dos números-índice dos mesmos meses (
      {reaj.comparacao_inflacao?.conferencia_ipca_12m.confere ? "conferida contra a variação publicada pelo IBGE" : "sem conferência com a variação publicada"}
      ).
    </>
  );
  const naoConcluirReajustes = (
    <>
      {reaj.nota} O efeito médio de cada processo para todos os consumidores não está publicado aqui. O conjunto não informa se o ato é reajuste, revisão periódica ou extraordinária. A
      diferença entre o PLD e a tarifa não é margem da distribuidora.
    </>
  );
  const oQueMudouBandeiras = contagemUltimoAno ? (
    <>
      Em {contagemUltimoAno[0]} (até {mesBandeira ?? "o último mês publicado"}
      ):{" "}
      {Object.entries(contagemUltimoAno[1])
        .map(([b, n]) => `${n} ${n === 1 ? "mês" : "meses"} de ${minuscula(b)}`)
        .join(", ")}
      .
    </>
  ) : (
    "Sem acionamento publicado."
  );
  const comoInterpretarBandeiras = (
    <>
      Cada célula é um mês, com a sigla da bandeira; o valor do adicional de cada patamar mudou ao longo do tempo (tabela de adicionais por resolução, no modo Analisar). O valor
      publicado está em R$/MWh e se divide por 1000 para chegar ao valor por kWh
      {patamarExemplo ? `: ${num(patamarExemplo.rs_mwh, 2)} R$/MWh da ${minuscula(patamarExemplo.bandeira)} são ${reais(patamarExemplo.rs_kwh, 5)} por kWh, como na página da ANEEL` : ""}.
    </>
  );
  const naoConcluirBandeiras = (
    <>
      A grade não mostra o efeito da bandeira na conta de cada distribuidora: o acréscimo depende do consumo e não vale nos sistemas isolados. Em {band.conferencia.divergem.length} dos{" "}
      {band.conferencia.meses} meses o valor acionado não confere com a tabela de adicionais ou não tem resolução correspondente (lista no modo Auditar).
    </>
  );
  const comoInterpretarSubsidios = (
    <>
      O primeiro gráfico soma os repasses homologados por distribuidora e mês, por ano de competência (
      {linhasSub.filter((l) => String(l.rotulo).includes("parcial")).length ? "o ano parcial está marcado" : "todos os anos completos"}). O segundo mostra o orçamento anual da CDE por grupo
      de despesa: valores aprovados ou previstos pela ANEEL, não execução.
    </>
  );
  const naoConcluirSubsidios = (
    <>
      {sub.nota} Os dois conjuntos não se somam: {cde?.comparacao_com_subsidios ?? "o orçamento da CDE não foi publicado nesta gold."} Orçamento não é o que foi gasto.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="conta-de-luz" />
      <MarcaVisita secao="energia:conta-de-luz:reajustes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <Navegacao atual="reajustes" />
        <CabecalhoModulo
          siglas={["REH", "PLD", "SIN", "TUSD", "TE", "ANEEL", "IPCA", "CDE", "SCEE"]}
          rotulo="Conta de luz"
          titulo="O que mudou e quem financia os benefícios?"
          lead="A variação da tarifa B1 diante da inflação (IPCA), as bandeiras com acréscimo e quem custeia os descontos tarifários e a Tarifa Social pela CDE."
          recorte={`Variação até ${dataBR(janela12?.ate ?? ref)} · bandeiras até ${mesBandeira ?? "o último mês publicado"} · subsídios de ${sub.ultimo_ano_completo ?? "sem ano completo"} · orçamento da CDE de ${cde?.ultimo_ano ?? "sem dado"}`}
          fonte="ANEEL e IBGE"
          referencia={
            <>
              Tarifas de aplicação da ANEEL até {dataBR(ref)}; IPCA até {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "mês não publicado"}; bandeira de{" "}
              {mesBandeira ?? "mês não publicado"}; subsídios até {subUltimo ? `${subUltimo.ano}${subUltimo.parcial ? ` (${subUltimo.meses} ${subUltimo.meses === 1 ? "mês" : "meses"}, parcial)` : ""}` : "sem dado"} e orçamento da CDE de{" "}
              {cde?.ultimo_ano ?? "sem dado"}. Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <Datas
              itens={[
                { rotulo: "Tarifas", texto: `até ${dataBR(ref)}`, natureza: "CALCULADO" },
                { rotulo: "IPCA", texto: ultimoIpca ? `até ${mesAno(`${ultimoIpca}-01`)}` : "sem dado nesta publicação", natureza: "OBSERVADO" },
                { rotulo: "Bandeiras", texto: mesBandeira ? `até ${mesBandeira}` : "sem dado nesta publicação", natureza: "OBSERVADO" },
                { rotulo: "Subsídios tarifários", texto: subUltimo ? `até ${subUltimo.ano}${subUltimo.parcial ? " (parcial)" : ""}` : "sem dado nesta publicação", natureza: "CALCULADO" },
                { rotulo: "Orçamento da CDE", texto: cde ? `de ${cde.ultimo_ano}` : "sem dado nesta publicação", natureza: "PREVISTO" },
              ]}
            />
          }
        >
          Três leituras separadas, com fontes e naturezas diferentes: quanto a tarifa B1 de cada distribuidora mudou diante da inflação, quando a bandeira encareceu a conta e quem
          paga os descontos tarifários e a Tarifa Social. Tarifas, composição e o simulador estão na{" "}
          <ContaLinkFiltros href={ROTA_CONTA} className="text-energia-dark underline underline-offset-4">
            página principal da Conta de luz
          </ContaLinkFiltros>
          .
        </CabecalhoModulo>

        <ModoProfundidade>
          {/* ---------------- reajustes ---------------- */}
          <Bloco id="p050">
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
              oQueMudou={oQueMudouReajustes}
              comoInterpretar={comoInterpretarReajustes}
              naoConcluir={naoConcluirReajustes}
              naoConcluirNoCorpo
              proveniencia={reaj.proveniencia}
              complementares={[{ rotulo: "IPCA (IBGE)", p: reaj.proveniencia_ipca }]}
            >
              <div className="space-y-6">
                <ContaReajustes
                  janelas={reaj.comparacao_inflacao?.janelas ?? []}
                  ultimos={reaj.ultimos}
                  dataReferencia={ref}
                  fonte={FONTE_TARIFAS}
                  destaque={
                    <div className="max-w-md border-t border-linha pt-4">
                      <Numero
                        variante="faixa"
                        rotulo="Variação mediana da tarifa B1 em 12 meses"
                        natureza="CALCULADO"
                        valor={janela12?.mediana_pct ?? null}
                        formato="pct"
                        casas={2}
                        evidencia={reaj.evidencia}
                        motivoAusencia="Sem IPCA ou sem tarifa nas duas datas da janela."
                        nota={janela12 ? `${janela12.n} distribuidoras. IPCA no mesmo período: ${pct(janela12.ipca_pct, 2)}.` : undefined}
                        endereco={`${ROTA_REAJUSTES}#reajustes`}
                      />
                    </div>
                  }
                />
                <Recorte
                  periodo={
                    <>
                      Janelas terminadas em {dataBR(reaj.comparacao_inflacao?.referencia)} (último IPCA: {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "não publicado"})
                    </>
                  }
                  universo={<>Distribuidoras com tarifa B1 nas duas datas da janela e sem mudança de área entre elas</>}
                  unidade="% de variação nominal; variação real na tabela"
                />
                <NotasDoPainel oQueMudou={oQueMudouReajustes} comoInterpretar={comoInterpretarReajustes} naoConcluir={naoConcluirReajustes} />
                <div className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
                  <p className="rotulo text-mineral">Efeito médio do processo tarifário: não publicado</p>
                  <p className="mt-1 leading-relaxed">
                    O efeito médio de cada processo tarifário (todas as classes) e o calendário dos processos não estão no portal de dados abertos da ANEEL, e os endereços da ANEEL que os publicam recusaram o
                    acesso do observatório{dataEfeitoMedio ? ` em ${dataEfeitoMedio}` : ""}. Este painel mostra a variação da tarifa B1 residencial, que é outra medida.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-carvao-muted" data-nivel="analisar">
                    Registro da coleta: {reaj.efeito_medio.motivo}
                  </p>
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
                      ). IPCA de {janela12 ? `${mesAno(`${janela12.ipca_meses[0]}-01`)} a ${mesAno(`${janela12.ipca_meses[1]}-01`)}` : "sem janela de 12 meses"}
                      {janela12 ? `: ${pct(janela12.ipca_pct, 2)}, pela razão dos números-índice do IBGE (SIDRA, tabela 1737), na fórmula da ficha "Comprove este número"` : ""}.
                    </p>
                  )}
                </Auditoria>
                <Seguir
                  ancora="reajustes"
                  proximo={{ href: "#bandeiras", pergunta: "Quando a bandeira encareceu a conta?" }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_reajustes_b1.csv", "conta_reajuste_vs_ipca.csv", "conta_ipca.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- bandeiras ---------------- */}
          <Bloco>
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
              oQueMudou={oQueMudouBandeiras}
              comoInterpretar={comoInterpretarBandeiras}
              naoConcluir={naoConcluirBandeiras}
              naoConcluirNoCorpo
              proveniencia={band.proveniencia}
            >
              <div className="space-y-6">
                <RespostaCurta id="p050-bandeiras" veredito={vereditoBandeira(band)}>
                  {respostaBandeira(band)}
                </RespostaCurta>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                  <ContaBandeiras acionamento={band.acionamento} />
                  <div className="min-w-0 space-y-4">
                    <Numero
                      variante="faixa"
                      rotulo={`Adicional de ${band.vigente?.bandeira ? minuscula(band.vigente.bandeira) : "bandeira"} em ${mesBandeira ?? "mês não publicado"}`}
                      natureza="OBSERVADO"
                      valor={adicionalVigente === null ? null : adicionalVigente / 1000}
                      formato="reais"
                      casas={5}
                      unidade="R$/kWh"
                      evidencia={band.evidencia}
                      nota={adicionalVigente !== null ? `${num(adicionalVigente, 2)} R$/MWh no arquivo da ANEEL, dividido por 1000.` : undefined}
                      endereco={`${ROTA_REAJUSTES}#bandeiras`}
                    />
                    <table className="h-fit w-full border-collapse text-sm tabular-nums">
                      <caption className="text-left text-xs text-mineral">Patamares vigentes na data{mesBandeira ? ` (${mesBandeira})` : ""}</caption>
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
                <NotasDoPainel oQueMudou={oQueMudouBandeiras} comoInterpretar={comoInterpretarBandeiras} naoConcluir={naoConcluirBandeiras} />
                <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-6">
                  <h3 className="ed-h3 font-serif text-carvao">Adicionais por resolução</h3>
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
                <Seguir
                  ancora="bandeiras"
                  proximo={{ href: "#subsidios", pergunta: "Quem financia os descontos e benefícios da conta?" }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_bandeiras.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- subsídios e orçamento da CDE ---------------- */}
          <Bloco>
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
              comoInterpretar={comoInterpretarSubsidios}
              naoConcluir={naoConcluirSubsidios}
              naoConcluirNoCorpo
              proveniencia={sub.proveniencia}
              complementares={cde?.proveniencia ? [{ rotulo: "Orçamento da CDE", p: cde.proveniencia }] : []}
            >
              <div className="space-y-6">
                <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
                  <RespostaCurta id="p050-subsidios" veredito={vereditoSubsidios(sub)}>
                    {respostaSubsidios(sub)} {respostaCde(cde)}
                  </RespostaCurta>
                  <div className="space-y-4">
                    <Numero
                      variante="faixa"
                      rotulo={`Subsídios tarifários em ${sub.ultimo_ano_completo ?? "último ano"}`}
                      natureza="CALCULADO"
                      valor={sub.evidencia && sub.evidencia.valor_calculo !== null ? sub.evidencia.valor_calculo / 1e9 : null}
                      formato="reais"
                      casas={1}
                      unidade="bilhões"
                      evidencia={sub.evidencia}
                      motivoAusencia="Sem ano completo publicado."
                      endereco={`${ROTA_REAJUSTES}#subsidios`}
                    />
                    <div className="border-t border-linha pt-4">
                      <Numero
                        variante="faixa"
                        rotulo={`Quotas nas receitas da CDE ${cde?.ultimo_ano ?? ""}`.trim()}
                        natureza="PREVISTO"
                        valor={cde?.evidencia?.valor_calculo ?? null}
                        formato="pct"
                        casas={1}
                        evidencia={cde?.evidencia ?? null}
                        motivoAusencia="Orçamento não publicado."
                        nota="Orçamento aprovado ou previsto pela ANEEL, não execução."
                        endereco={`${ROTA_REAJUSTES}#subsidios`}
                      />
                    </div>
                  </div>
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
                      <dd className="mt-0.5 text-carvao-muted">{c.definicao.replace(/\bo dicionário\b/g, "a fonte")}</dd>
                    </div>
                  ))}
                </dl>
                {cde && (
                  <SecaoDoPainel id="orcamento-cde" titulo={`Como o orçamento anual da CDE se divide, de ${cde.anos[0]} a ${cde.ultimo_ano}?`} lead={cde.natureza_valores.replace(/^./, (c) => c.toUpperCase())}>
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
                  </SecaoDoPainel>
                )}
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
                <NotasDoPainel oQueMudou={mudancaSubsidios(sub)} comoInterpretar={comoInterpretarSubsidios} naoConcluir={naoConcluirSubsidios} />
                <div data-nivel="analisar" className="border-t border-linha pt-6">
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
                <Seguir
                  ancora="subsidios"
                  proximo={{ href: "/setor-eletrico/pld", pergunta: "Como funciona e como varia o PLD, que não é a tarifa da conta?" }}
                  downloads={downloadsDoPainel(g.downloads, ["conta_subsidios_anual.csv", "conta_cde_custeio.csv"])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
