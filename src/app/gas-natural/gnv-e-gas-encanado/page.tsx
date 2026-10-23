import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { DownloadsGas, FonteFigura, numeroGas, ProximasPerguntas } from "@/components/gas/Blocos";
import { AtalhosGas } from "@/components/gas/GuiaLeituraGas";
import { FiguraAnalitica, GraficoLinhas, LeituraGuiada, PaginaPainel } from "@/components/painel";
import { MapaUf } from "@/components/gas/MapaUf";
import { SeriePorUf } from "@/components/gas/SeriePorUf";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { mesAno, mesExtenso, num, sinal } from "@/lib/gas/formato";
import { LEITURAS_GAS } from "@/lib/gas/leitura";
import { GRUPOS_GAS, paginaGas } from "@/lib/gas/navegacao";
import { provenienciaGas } from "@/lib/gas/proveniencia";

export const dynamic = "force-static";

const pagina = paginaGas("gnv-e-gas-encanado");

export const metadata: Metadata = {
  title: "Preço do GNV e inflação do gás encanado",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

/**
 * Painel do GNV e do gás encanado, no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): abertura com a pergunta, os
 * quatro números da gold, uma figura por gráfico (mapa e tabela por UF, a série da UF escolhida, o histórico nominal e corrigido e a
 * inflação no IPCA), as notas de leitura e o método recolhido com as fontes e os arquivos. Nenhum número, série ou texto da página
 * anterior saiu: o que não cabe antes dos números foi para a leitura das figuras, a nota da faixa, as notas e o método.
 */
export default function GnvPage() {
  const g = goldGas.gnv();
  const i = g.indicadores;
  const ip = g.ipca.indicadores;
  const maior = g.por_uf[0];
  const menor = g.por_uf[g.por_uf.length - 1];
  const valoresMapa = Object.fromEntries(g.por_uf.map((x) => [x.codigo, x.medio]));
  const ufs = [...g.por_uf].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((x) => ({ uf: x.uf, nome: x.nome }));
  const variacao = i.variacao_12m.valor as number | null;
  const guia = LEITURAS_GAS[pagina.slug];
  const grupo = GRUPOS_GAS.find((x) => x.id === pagina.grupo);
  const primeiro = g.serie[0].mes;
  const doze = g.serie_uf.slice(-12);
  const brasilPorMes = new Map(g.serie.map((x) => [x.mes, x.medio]));
  return (
    <>
      <MarcaVisita secao="gas:gnv-e-gas-encanado" />
      <header>
        <CabecalhoPlataforma colecao="gas" destinoConta="/gas-natural" />
        <NavegacaoColecao colecao="gas" />
      </header>
      <PaginaPainel
        rota="/gas-natural/gnv-e-gas-encanado"
        abertura={{
          grupo: grupo?.rotulo,
          acento: "gas",
          titulo: pagina.pergunta,
          lead: (
            <>
              Em {mesExtenso(g.ultimo_mes)}, o metro cúbico de gás natural veicular (GNV) custou em média R$ {num(i.medio_mes.valor as number, 2)} nos{" "}
              {num(i.postos_mes.valor as number, 0)} postos pesquisados pela ANP{variacao === null ? "" : `, ${sinal(variacao, 1, "%")} em 12 meses`}.
            </>
          ),
          recorte: {
            periodo: mesAno(g.ultimo_mes),
            universo: `Brasil, ${num(i.ufs_mes.valor as number, 0)} UFs com GNV na pesquisa`,
            unidade: "R$ por m³ e % em 12 meses",
            fonte: "ANP, Levantamento de Preços de Combustíveis; IBGE, IPCA",
          },
          limite:
            "quanto custa o gás encanado em cada casa: para ele a página mostra a variação do IPCA, não uma tarifa, que depende da distribuidora, da faixa de consumo e das regras locais.",
          fontesDatasSiglas: (
            <>
              <p>
                Preços da ANP até {mesExtenso(g.ultimo_mes)}; IPCA do IBGE até {mesExtenso(g.ipca.ultimo_mes)}.
              </p>
              <FonteFigura ids={["anp_precos_brasil", "anp_precos_estados", "ibge_ipca"]} />
              <p>GNV: gás natural veicular. IPCA: Índice Nacional de Preços ao Consumidor Amplo, do IBGE. ANP: Agência Nacional do Petróleo, Gás Natural e Biocombustíveis. UF: unidade da federação.</p>
            </>
          ),
        }}
        rotuloNumeros="Preço do GNV e inflação do gás"
        numeros={[numeroGas(i.medio_mes, { casas: 2 }), numeroGas(i.variacao_12m, { variacao: true }), numeroGas(ip.encanado, { casas: 2, variacao: true }), numeroGas(ip.veicular, { casas: 2, variacao: true })]}
        notaNumeros={
          <p>
            Para o gás encanado das residências não há pesquisa nacional de preço: a tarifa é fixada por cada estado para cada distribuidora. O IPCA acompanha a
            variação do que as famílias pagam. Em 12 meses até {mesExtenso(g.ipca.ultimo_mes)}, o gás encanado variou {sinal(ip.encanado.valor as number, 2, "%")} e
            o gás veicular, {sinal(ip.veicular.valor as number, 2, "%")}, ante {sinal(ip.geral.valor as number, 2, "%")} do índice geral.
          </p>
        }
        navegacaoLocal={<AtalhosGas slug={pagina.slug} />}
        figuras={
          <>
            <FiguraAnalitica
              id="estados"
              pergunta="O preço do GNV nas UFs com postos pesquisados"
              subtitulo={`R$ por m³, média da pesquisa de ${mesExtenso(g.ultimo_mes)}. UF sem posto de GNV na amostra fica sem dado.`}
              natureza="OBSERVADO"
              leitura={
                <LeituraGuiada>
                  A pesquisa encontrou GNV em {num(i.ufs_mes.valor as number, 0)} UFs, com média de R$ {num(menor.medio, 2)} ({menor.nome}) a R$ {num(maior.medio, 2)} ({maior.nome}).
                </LeituraGuiada>
              }
              comoInterpretar="Mínimo e máximo são os extremos encontrados na amostra do mês, não limites de preço."
              naoConcluir="se o GNV de um estado é caro ou barato para quem abastece: a cor indica a posição entre as UFs com preço, e a média vem de uma amostra de postos."
              proveniencia={provenienciaGas({
                fonte: "anp_precos_estados",
                indicador: "Preço médio de revenda do GNV por UF",
                natureza: "OBSERVADO",
                unidade: "R$/m³",
                inicio: g.ultimo_mes,
                fim: g.ultimo_mes,
                download: "/gas/series/preco-gnv-por-uf.csv",
              })}
              tabela={{
                titulo: `Preço do GNV por UF, ${mesAno(g.ultimo_mes)}, do maior para o menor preço médio`,
                colunas: ["UF", "Médio, R$/m³", "Mínimo, R$/m³", "Máximo, R$/m³", "Médio 12 meses antes", "Variação em 12 meses, %", "Postos pesquisados"],
                linhas: g.por_uf.map((x) => [x.nome, x.medio, x.minimo, x.maximo, x.medio_ano_anterior, x.variacao_12m_pct, x.postos]),
                casas: [null, 2, 2, 2, 2, 1, 0],
                limite: g.por_uf.length,
                csv: "/gas/series/preco-gnv-por-uf.csv",
              }}
            >
              <div data-mapa-legado="gas-uf">
                <MapaUf
                  semTabela
                  titulo={`Preço médio do GNV por UF, ${mesAno(g.ultimo_mes)}`}
                  valores={valoresMapa}
                  unidade="R$/m³"
                  periodo={mesAno(g.ultimo_mes)}
                  nota="Classes por quantis entre as UFs com preço. Sem dado: a pesquisa do mês não encontrou GNV na UF."
                />
              </div>
            </FiguraAnalitica>

            <FiguraAnalitica
              id="sua-uf"
              pergunta="O preço do GNV no seu estado ao longo do tempo"
              subtitulo="R$ por m³, média mensal desde janeiro de 2019, ao lado da média Brasil."
              natureza="OBSERVADO"
              naoConcluir="por que o preço de um estado mudou: a série mostra a média da amostra de postos de cada mês, e UF sem posto pesquisado num mês fica sem dado."
              proveniencia={provenienciaGas({
                fonte: "anp_precos_estados",
                indicador: "Preço médio mensal do GNV por UF",
                natureza: "OBSERVADO",
                unidade: "R$/m³",
                inicio: g.serie_uf[0].mes as string,
                fim: g.serie_uf[g.serie_uf.length - 1].mes as string,
              })}
              complementares={[
                {
                  rotulo: "Média Brasil",
                  p: provenienciaGas({ fonte: "anp_precos_brasil", indicador: "Preço médio mensal do GNV no Brasil", natureza: "OBSERVADO", unidade: "R$/m³", inicio: primeiro, fim: g.ultimo_mes }),
                },
              ]}
              tabela={{
                titulo: `Preço médio do GNV por UF e média Brasil, R$/m³, últimos 12 meses (${mesAno(doze[0].mes as string)} a ${mesAno(doze[doze.length - 1].mes as string)})`,
                colunas: ["UF", ...doze.map((p) => mesAno(p.mes as string))],
                linhas: [
                  ["Média Brasil", ...doze.map((p) => brasilPorMes.get(p.mes as string) ?? null)],
                  ...ufs.map((u) => [u.nome, ...doze.map((p) => (p[u.uf] as number | null | undefined) ?? null)]),
                ],
                casas: [null, ...doze.map(() => 2)],
                limite: ufs.length + 1,
              }}
            >
              <SeriePorUf
                titulo="Preço médio do GNV"
                retrato={{ periodo: g.ultimo_mes, ufs: g.por_uf }}
                serieUf={g.serie_uf}
                serieBrasil={g.serie}
                ufs={ufs}
                inicial={maior.uf}
                unidade="R$/m³"
                corUf={COR.foco}
                corBrasil={COR.referencia}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="historico"
              pergunta="O GNV desde 2013, em valores da época e corrigidos pela inflação"
              subtitulo={`R$ por m³, média Brasil. A linha corrigida expressa cada mês em reais de ${mesExtenso(g.mes_base_real)} pelo IPCA índice geral; a faixa mostra extremos nominais da pesquisa, não da linha corrigida.`}
              natureza="OBSERVADO"
              naoConcluir="quanto o GNV pesa no orçamento de quem abastece: a correção usa o IPCA índice geral, e a faixa de menor e maior preço vale só para os valores nominais."
              proveniencia={provenienciaGas({
                fonte: "anp_precos_brasil",
                indicador: "Preço médio do GNV no Brasil, nominal e corrigido",
                natureza: "OBSERVADO",
                unidade: "R$/m³",
                inicio: primeiro,
                fim: g.ultimo_mes,
                download: "/gas/series/preco-gnv-brasil-mensal.csv",
              })}
              complementares={[
                {
                  rotulo: "IPCA, correção",
                  p: provenienciaGas({ fonte: "ibge_ipca", indicador: "IPCA índice geral, usado na correção", natureza: "OBSERVADO", unidade: "índice", inicio: primeiro, fim: g.mes_base_real }),
                },
              ]}
              tabela={{
                titulo: "Preço médio do GNV no Brasil, R$/m³",
                colunas: ["Mês", "Médio", "Mínimo", "Máximo", `Médio em reais de ${mesAno(g.mes_base_real)}`, "Postos pesquisados"],
                linhas: g.serie.map((x) => [mesAno(x.mes), x.medio, x.minimo, x.maximo, x.medio_real, x.postos]),
                casas: [null, 2, 2, 2, 2, 0],
                csv: "/gas/series/preco-gnv-brasil-mensal.csv",
              }}
            >
              <GraficoLinhas
                semTabela
                titulo="Preço médio do GNV no Brasil"
                dados={g.serie}
                chaveX="mes"
                formatoX="mes"
                unidade="R$/m³"
                casas={2}
                zeroNoEixo
                zoom
                legendaInterativa
                chaveUrl="gnv"
                banda={{ inferior: "minimo", superior: "maximo", rotulo: "Menor e maior preço da pesquisa" }}
                series={[
                  { id: "medio", rotulo: "Preço médio, valores da época", sigla: "Nominal", cor: COR.foco, espessura: 2.5 },
                  { id: "medio_real", rotulo: `Preço médio em reais de ${mesAno(g.mes_base_real)}`, sigla: "Corrigido", cor: COR.comp[1], tracejada: true },
                ]}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="inflacao"
              pergunta="A inflação do gás encanado e do gás veicular"
              subtitulo="IPCA, variação em 12 meses, %, desde janeiro de 2012."
              natureza="OBSERVADO"
              leitura={
                <LeituraGuiada>
                  De janeiro de 2012 a {mesExtenso(g.ipca.ultimo_mes)}, o gás encanado acumulou alta de {num(ip.encanado_acumulado.valor as number, 1)}% no IPCA, o gás
                  veicular, de {num(ip.veicular_acumulado.valor as number, 1)}%, e o índice geral, de {num(ip.geral_acumulado.valor as number, 1)}%.
                </LeituraGuiada>
              }
              ressalva="O IPCA é medido nas regiões metropolitanas e municípios da pesquisa do IBGE; o subitem gás encanado só existe onde há distribuição canalizada para residências. A variação não é a de cada distribuidora."
              naoConcluir="quanto subiu a tarifa de uma distribuidora: o subitem gás encanado do IPCA mistura as áreas pesquisadas pelo IBGE e não substitui a tarifa fixada por cada estado."
              proveniencia={provenienciaGas({
                fonte: "ibge_ipca",
                indicador: "IPCA em 12 meses: gás encanado, gás veicular e índice geral",
                natureza: "OBSERVADO",
                unidade: "% em 12 meses",
                inicio: g.ipca.doze_meses[0].mes,
                fim: g.ipca.ultimo_mes,
                formula: (ip.encanado_acumulado.formula as string | undefined) ?? null,
                download: "/gas/series/ipca-gas-12-meses.csv",
              })}
              tabela={{
                titulo: "IPCA em 12 meses: gás encanado, gás veicular e índice geral, %",
                colunas: ["Mês", "Gás encanado", "Gás veicular", "IPCA, índice geral"],
                linhas: g.ipca.doze_meses.map((x) => [mesAno(x.mes), x.encanado, x.veicular, x.geral]),
                casas: [null, 2, 2, 2],
                csv: "/gas/series/ipca-gas-12-meses.csv",
              }}
              depois={
                <section aria-labelledby="proximas-h" className="border-t border-linha pt-6">
                  <h2 id="proximas-h" className="t-h3 text-carvao">
                    Para continuar
                  </h2>
                  <div className="mt-4">
                    <ProximasPerguntas
                      itens={[
                        { href: "/gas-natural/precos", pergunta: "Quanto custa o gás antes da distribuidora?", motivo: "O preço de venda às distribuidoras, a primeira parcela da tarifa." },
                        { href: "/gas-natural/regulacao", pergunta: "Quem define a tarifa do gás encanado?", motivo: "Os estados regulam a distribuição de gás canalizado." },
                        { href: "/gas-natural/gas-de-cozinha", pergunta: "Quanto custa o botijão de gás?", motivo: "O GLP, que não é gás natural, por UF." },
                      ]}
                    />
                  </div>
                </section>
              }
            >
              <GraficoLinhas
                semTabela
                titulo="IPCA em 12 meses: gás encanado, gás veicular e índice geral"
                dados={g.ipca.doze_meses}
                chaveX="mes"
                formatoX="mes"
                unidade="% em 12 meses"
                casas={2}
                legendaInterativa
                series={[
                  { id: "encanado", rotulo: "Gás encanado", cor: COR.foco, espessura: 2.5 },
                  { id: "veicular", rotulo: "Gás veicular", cor: COR.comp[1] },
                  { id: "geral", rotulo: "IPCA, índice geral", cor: COR.referencia, tracejada: true },
                ]}
              />
            </FiguraAnalitica>
          </>
        }
        notas={guia ? { id: "para-ler", itens: [{ termo: guia.titulo, definicao: guia.texto }] } : undefined}
        metodo={
          <>
            <p>
              Preços da ANP até {mesExtenso(g.ultimo_mes)}; IPCA do IBGE até {mesExtenso(g.ipca.ultimo_mes)}. Amostra da pesquisa de preços, correção pela inflação e
              glossário em <a href="/gas-natural/metodologia" className="underline underline-offset-4">Metodologia do observatório</a>.
            </p>
            <FonteFigura ids={["anp_precos_brasil", "anp_precos_estados", "ibge_ipca"]} />
            <div>
              <h2 className="rotulo text-mineral">Baixar os dados desta página</h2>
              <div className="mt-2">
                <DownloadsGas
                  series={[
                    { id: "preco-gnv-brasil-mensal", descricao: "preço do GNV no Brasil, médio, mínimo, máximo e corrigido" },
                    { id: "preco-gnv-por-uf", descricao: "preço do GNV por UF no último mês" },
                    { id: "ipca-gas-12-meses", descricao: "IPCA em 12 meses do gás encanado, veicular, de botijão e índice geral" },
                  ]}
                />
              </div>
            </div>
          </>
        }
      />
    </>
  );
}
