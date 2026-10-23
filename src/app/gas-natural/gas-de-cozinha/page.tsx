import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { DownloadsGas, FonteFigura, numeroGas, ProximasPerguntas } from "@/components/gas/Blocos";
import { AtalhosGas } from "@/components/gas/GuiaLeituraGas";
import { FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel } from "@/components/painel";
import { MapaUf } from "@/components/gas/MapaUf";
import { SeriePorUf } from "@/components/gas/SeriePorUf";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { AvisoConsultaAberta } from "@/components/acesso/AvisoConsultaAberta";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { mesAno, mesExtenso, num, periodoLegivel, sinal } from "@/lib/gas/formato";
import { LEITURAS_GAS } from "@/lib/gas/leitura";
import { GRUPOS_GAS, paginaGas } from "@/lib/gas/navegacao";
import { provenienciaGas } from "@/lib/gas/proveniencia";

export const dynamic = "force-static";

const pagina = paginaGas("gas-de-cozinha");

export const metadata: Metadata = {
  title: "Preço do gás de cozinha (GLP) por estado",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

/**
 * Painel com conta do gás de cozinha, no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): abertura com a pergunta, os
 * quatro números da gold, uma figura por gráfico (mapa e tabela por UF, a série da UF escolhida, o histórico nominal e corrigido, a
 * inflação e as vendas), as notas de leitura e o método recolhido com as fontes e os arquivos. Sem sessão, este endereço serve o
 * aperitivo de src/app/aperitivo/gas-de-cozinha, que não muda. Nenhum número, série ou texto da página anterior saiu: o que não cabe
 * antes dos números foi para a leitura das figuras, a nota da faixa, as notas e o método.
 */
export default function GasDeCozinhaPage() {
  const g = goldGas.glp();
  const i = g.indicadores;
  const ip = g.ipca.indicadores;
  const v = g.vendas!;
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
  const vendasUf = v.por_uf.map((x) => ({ uf: x.uf, nome: x.nome, total: x.ate_p13_mil_m3_12m }));
  return (
    <>
      <MarcaVisita secao="gas:gas-de-cozinha" />
      <header>
        <CabecalhoPlataforma colecao="gas" destinoConta="/gas-natural" />
        <NavegacaoColecao colecao="gas" />
      </header>
      <AvisoConsultaAberta className="ed-pagina" comConta="Os arquivos para baixar, a página de dados e as demais páginas do observatório" />
      <PaginaPainel
        rota="/gas-natural/gas-de-cozinha"
        abertura={{
          grupo: grupo?.rotulo,
          acento: "gas",
          titulo: pagina.pergunta,
          lead: (
            <>
              Em {mesExtenso(g.ultimo_mes)}, o botijão de 13 kg de gás de cozinha custou em média R$ {num(i.medio_mes.valor as number, 2)} nas{" "}
              {num(i.postos_mes.valor as number, 0)} revendas pesquisadas pela ANP{variacao === null ? "" : `, ${sinal(variacao, 1, "%")} em 12 meses`}.
            </>
          ),
          recorte: {
            periodo: mesAno(g.ultimo_mes),
            universo: `Brasil, ${num(i.ufs_mes.valor as number, 0)} UFs, revendas pesquisadas`,
            unidade: "R$ por botijão de 13 kg",
            fonte: "ANP, Levantamento de Preços de Combustíveis; IBGE, IPCA",
          },
          limite:
            "quanto cada família paga pelo botijão: o preço é a média de uma amostra de revendas, não uma tarifa regulada, e a pesquisa não cobre todos os municípios.",
          fontesDatasSiglas: (
            <>
              <p>
                Preços da ANP até {mesExtenso(g.ultimo_mes)}; IPCA do IBGE até {mesExtenso(g.ipca.ultimo_mes)}.
              </p>
              <FonteFigura ids={["anp_precos_brasil", "anp_precos_estados", "ibge_ipca", "anp_glp_vasilhame"]} />
              <p>GLP: gás liquefeito de petróleo. IPCA: Índice Nacional de Preços ao Consumidor Amplo, do IBGE. ANP: Agência Nacional do Petróleo, Gás Natural e Biocombustíveis. UF: unidade da federação.</p>
            </>
          ),
        }}
        rotuloNumeros="Preço e inflação do botijão"
        numeros={[numeroGas(i.medio_mes, { casas: 2 }), numeroGas(i.variacao_12m, { variacao: true }), numeroGas(ip.botijao, { casas: 2, variacao: true }), numeroGas(i.postos_mes, { casas: 0 })]}
        notaNumeros={
          <p>
            <span className="font-medium text-carvao">Gás de cozinha não é gás natural.</span> O botijão leva gás liquefeito de petróleo (GLP), uma mistura de
            propano e butano obtida no refino do petróleo e no processamento do gás natural. O gás natural é sobretudo metano e chega às casas por tubulação, como
            gás encanado. As duas cadeias têm distribuidoras, preços e regras diferentes; esta é a única página do observatório sobre GLP.
          </p>
        }
        navegacaoLocal={<AtalhosGas slug={pagina.slug} />}
        figuras={
          <>
            <FiguraAnalitica
              id="estados"
              pergunta="O preço médio do botijão em cada estado"
              subtitulo={`R$ por botijão de 13 kg, média da pesquisa de ${mesExtenso(g.ultimo_mes)} · ${g.por_uf.length} UFs`}
              natureza="OBSERVADO"
              leitura={
                <LeituraGuiada>
                  A média estadual foi de R$ {num(menor.medio, 2)} ({menor.nome}) a R$ {num(maior.medio, 2)} ({maior.nome}).
                </LeituraGuiada>
              }
              comoInterpretar="Mínimo e máximo são os extremos encontrados na amostra do mês, não limites de preço. A pesquisa não cobre todos os municípios."
              naoConcluir="se o preço de um estado é alto ou baixo para quem compra: a cor indica a posição entre as UFs, e a média vem de uma amostra de revendas."
              proveniencia={provenienciaGas({
                fonte: "anp_precos_estados",
                indicador: "Preço médio de revenda do GLP em botijão de 13 kg por UF",
                natureza: "OBSERVADO",
                unidade: "R$/13 kg",
                inicio: g.ultimo_mes,
                fim: g.ultimo_mes,
                download: "/gas/series/preco-glp-por-uf.csv",
              })}
              tabela={{
                titulo: `Preço do botijão por UF, ${mesAno(g.ultimo_mes)}, do maior para o menor preço médio`,
                colunas: ["UF", "Médio, R$", "Mínimo, R$", "Máximo, R$", "Médio 12 meses antes, R$", "Variação em 12 meses, %", "Revendas pesquisadas"],
                linhas: g.por_uf.map((x) => [x.nome, x.medio, x.minimo, x.maximo, x.medio_ano_anterior, x.variacao_12m_pct, x.postos]),
                casas: [null, 2, 2, 2, 2, 1, 0],
                limite: g.por_uf.length,
                csv: "/gas/series/preco-glp-por-uf.csv",
              }}
            >
              <div data-mapa-legado="gas-uf">
                <MapaUf
                  semTabela
                  titulo={`Preço médio do GLP em botijão de 13 kg por UF, ${mesAno(g.ultimo_mes)}`}
                  valores={valoresMapa}
                  unidade="R$/13 kg"
                  periodo={mesAno(g.ultimo_mes)}
                  nota="Classes por quantis. A cor indica a posição entre as UFs, não se o preço é alto ou baixo para quem compra."
                />
              </div>
            </FiguraAnalitica>

            <FiguraAnalitica
              id="sua-uf"
              pergunta="O preço no seu estado ao longo do tempo"
              subtitulo="R$ por botijão de 13 kg, média mensal desde janeiro de 2019, comparada com a média Brasil."
              natureza="OBSERVADO"
              naoConcluir="por que o preço de um estado mudou: a série mostra a média da amostra de revendas de cada mês, e os extremos não são intervalo de confiança nem limites do mercado."
              proveniencia={provenienciaGas({
                fonte: "anp_precos_estados",
                indicador: "Preço médio mensal do GLP em botijão de 13 kg por UF",
                natureza: "OBSERVADO",
                unidade: "R$/13 kg",
                inicio: g.serie_uf[0].mes as string,
                fim: g.serie_uf[g.serie_uf.length - 1].mes as string,
              })}
              complementares={[
                {
                  rotulo: "Média Brasil",
                  p: provenienciaGas({ fonte: "anp_precos_brasil", indicador: "Preço médio mensal do GLP em botijão de 13 kg no Brasil", natureza: "OBSERVADO", unidade: "R$/13 kg", inicio: primeiro, fim: g.ultimo_mes }),
                },
              ]}
              tabela={{
                titulo: `Preço médio do botijão por UF e média Brasil, R$, últimos 12 meses (${mesAno(doze[0].mes as string)} a ${mesAno(doze[doze.length - 1].mes as string)})`,
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
                titulo="Preço médio do botijão de 13 kg"
                retrato={{ periodo: g.ultimo_mes, ufs: g.por_uf }}
                serieUf={g.serie_uf}
                serieBrasil={g.serie}
                ufs={ufs}
                inicial={maior.uf}
                unidade="R$/13 kg"
                corUf={COR.foco}
                corBrasil={COR.referencia}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="historico"
              pergunta="O botijão desde 2013, em valores da época e corrigidos pela inflação"
              subtitulo={`R$ por botijão de 13 kg, média Brasil. A linha corrigida expressa cada mês em reais de ${mesExtenso(g.mes_base_real)}, pelo IPCA índice geral. A faixa mostra o menor e o maior preço nominal da pesquisa; não acompanha a linha corrigida.`}
              natureza="OBSERVADO"
              comoInterpretar="Correção: preço do mês × (IPCA acumulado até o mês da base ÷ IPCA acumulado até o mês)."
              ressalva="Não houve pesquisa de preços entre 18/8/2020 e 17/10/2020; os meses sem pesquisa aparecem como lacuna. A abrangência da pesquisa mudou em 2017 e em 2018, conforme notas da própria planilha da ANP."
              naoConcluir="quanto o botijão pesa no orçamento de cada família: a correção usa o IPCA índice geral, e a faixa de menor e maior preço vale só para os valores nominais."
              proveniencia={provenienciaGas({
                fonte: "anp_precos_brasil",
                indicador: "Preço médio do GLP em botijão de 13 kg no Brasil, nominal e corrigido",
                natureza: "OBSERVADO",
                unidade: "R$/13 kg",
                inicio: primeiro,
                fim: g.ultimo_mes,
                formula: "preço do mês × (IPCA acumulado até o mês da base ÷ IPCA acumulado até o mês)",
                download: "/gas/series/preco-glp-brasil-mensal.csv",
              })}
              complementares={[
                {
                  rotulo: "IPCA, correção",
                  p: provenienciaGas({ fonte: "ibge_ipca", indicador: "IPCA índice geral, usado na correção", natureza: "OBSERVADO", unidade: "índice", inicio: primeiro, fim: g.mes_base_real }),
                },
              ]}
              tabela={{
                titulo: "Preço médio do GLP em botijão de 13 kg no Brasil, R$",
                colunas: ["Mês", "Médio", "Mínimo", "Máximo", `Médio em reais de ${mesAno(g.mes_base_real)}`, "Revendas pesquisadas"],
                linhas: g.serie.map((x) => [mesAno(x.mes), x.medio, x.minimo, x.maximo, x.medio_real, x.postos]),
                casas: [null, 2, 2, 2, 2, 0],
                csv: "/gas/series/preco-glp-brasil-mensal.csv",
              }}
            >
              <GraficoLinhas
                semTabela
                titulo="Preço médio do GLP em botijão de 13 kg no Brasil"
                dados={g.serie}
                chaveX="mes"
                formatoX="mes"
                unidade="R$/13 kg"
                casas={2}
                zeroNoEixo
                zoom
                legendaInterativa
                chaveUrl="glp"
                banda={{ inferior: "minimo", superior: "maximo", rotulo: "Menor e maior preço da pesquisa" }}
                series={[
                  { id: "medio", rotulo: "Preço médio, valores da época", sigla: "Nominal", cor: COR.foco, espessura: 2.5 },
                  { id: "medio_real", rotulo: `Preço médio em reais de ${mesAno(g.mes_base_real)}`, sigla: "Corrigido", cor: COR.comp[1], tracejada: true },
                ]}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="inflacao"
              pergunta="A inflação do gás de botijão"
              subtitulo="IPCA, variação em 12 meses, %. Gás de botijão e índice geral, desde janeiro de 2012."
              natureza="OBSERVADO"
              leitura={
                <LeituraGuiada>
                  No IPCA, o gás de botijão variou {sinal(ip.botijao.valor as number, 2, "%")} em 12 meses até {mesExtenso(g.ipca.ultimo_mes)}, ante{" "}
                  {sinal(ip.geral.valor as number, 2, "%")} do índice geral. De janeiro de 2012 a {mesExtenso(g.ipca.ultimo_mes)}, o gás de botijão acumulou alta de{" "}
                  {num(ip.botijao_acumulado.valor as number, 1)}% no IPCA, e o índice geral, de {num(ip.geral_acumulado.valor as number, 1)}%.
                </LeituraGuiada>
              }
              naoConcluir="quanto variou o botijão em cada estado ou cidade: o IPCA é medido nas regiões metropolitanas e nos municípios da pesquisa do IBGE, não em cada revenda."
              proveniencia={provenienciaGas({
                fonte: "ibge_ipca",
                indicador: "IPCA em 12 meses: gás de botijão e índice geral",
                natureza: "OBSERVADO",
                unidade: "% em 12 meses",
                inicio: g.ipca.doze_meses[0].mes,
                fim: g.ipca.ultimo_mes,
                formula: (ip.botijao_acumulado.formula as string | undefined) ?? null,
                download: "/gas/series/ipca-gas-12-meses.csv",
              })}
              tabela={{
                titulo: "IPCA em 12 meses: gás de botijão e índice geral, %",
                colunas: ["Mês", "Gás de botijão", "IPCA, índice geral"],
                linhas: g.ipca.doze_meses.map((x) => [mesAno(x.mes), x.botijao, x.geral]),
                casas: [null, 2, 2],
                csv: "/gas/series/ipca-gas-12-meses.csv",
              }}
            >
              <GraficoLinhas
                semTabela
                titulo="IPCA em 12 meses: gás de botijão e índice geral"
                dados={g.ipca.doze_meses}
                chaveX="mes"
                formatoX="mes"
                unidade="% em 12 meses"
                casas={2}
                zeroNoEixo
                series={[
                  { id: "botijao", rotulo: "Gás de botijão", cor: COR.foco, espessura: 2.5 },
                  { id: "geral", rotulo: "IPCA, índice geral", cor: COR.referencia, tracejada: true },
                ]}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="vendas"
              pergunta="Quanto GLP é vendido em botijões"
              subtitulo="Vendas das distribuidoras de GLP, milhares de m³ por mês, por tipo de vasilhame."
              natureza="OBSERVADO"
              leitura={
                <LeituraGuiada>
                  Nos 12 meses, os vasilhames de até 13 kg responderam por {num(v.indicadores.p13_pct_12m.valor as number, 1)}% do volume de GLP vendido.
                </LeituraGuiada>
              }
              naoConcluir="quantos botijões cada família comprou: o volume é o das vendas das distribuidoras por tipo de vasilhame, em m³ de GLP, e a categoria Outros da ANP junta vasilhames diferentes."
              proveniencia={provenienciaGas({
                fonte: "anp_glp_vasilhame",
                indicador: "Vendas de GLP por tipo de vasilhame",
                natureza: "OBSERVADO",
                unidade: "mil m³",
                inicio: v.serie[0].mes,
                fim: v.serie[v.serie.length - 1].mes,
              })}
              tabela={{
                titulo: "Vendas de GLP por tipo de vasilhame, mil m³",
                colunas: ["Mês", "Vasilhames de até 13 kg", "Demais vasilhames (categoria Outros da ANP)"],
                linhas: v.serie.map((x) => [mesAno(x.mes), x.ate_p13, x.outros]),
                casas: [null, 1, 1],
                limite: v.serie.length,
              }}
            >
              <GraficoLinhas
                semTabela
                titulo="Vendas de GLP por tipo de vasilhame"
                dados={v.serie}
                chaveX="mes"
                formatoX="mes"
                unidade="mil m³"
                casas={1}
                zeroNoEixo
                zoom
                chaveUrl="vend"
                series={[
                  { id: "ate_p13", rotulo: "Vasilhames de até 13 kg", sigla: "Até P13", cor: COR.foco, espessura: 2.5 },
                  { id: "outros", rotulo: "Demais vasilhames (categoria Outros da ANP)", sigla: "Outros", cor: COR.comp[0] },
                ]}
              />
            </FiguraAnalitica>

            <FiguraAnalitica
              id="vendas-uf"
              nivelTitulo={3}
              pergunta={`Vendas em vasilhames de até 13 kg por UF, ${periodoLegivel(v.indicadores.p13_12m.periodo)}`}
              subtitulo="Vendas das distribuidoras de GLP em vasilhames de até 13 kg, mil m³ em 12 meses, por UF."
              natureza="OBSERVADO"
              naoConcluir="em que estado se consome mais gás por família: o volume é o total vendido na UF, sem divisão pela população nem pelo número de domicílios."
              proveniencia={provenienciaGas({
                fonte: "anp_glp_vasilhame",
                indicador: "Vendas de GLP em vasilhames de até 13 kg por UF, 12 meses",
                natureza: "OBSERVADO",
                unidade: "mil m³",
                inicio: v.serie[Math.max(0, v.serie.length - 12)].mes,
                fim: v.serie[v.serie.length - 1].mes,
              })}
              tabela={{
                titulo: `Vendas em vasilhames de até 13 kg por UF, ${periodoLegivel(v.indicadores.p13_12m.periodo)}, mil m³`,
                colunas: ["UF", "Vendas em até P13, mil m³"],
                linhas: vendasUf.map((x) => [x.nome, x.total]),
                casas: [null, 1],
                limite: vendasUf.length,
              }}
              depois={
                <section aria-labelledby="proximas-h" className="border-t border-linha pt-6">
                  <h2 id="proximas-h" className="t-h3 text-carvao">
                    Para continuar
                  </h2>
                  <div className="mt-4">
                    <ProximasPerguntas
                      itens={[
                        { href: "/gas-natural/gnv-e-gas-encanado", pergunta: "Quanto custa o GNV e como varia o gás encanado?", motivo: "O gás natural que chega ao consumidor por posto e por tubulação." },
                        { href: "/gas-natural/precos", pergunta: "Quanto custa o gás antes da distribuidora?", motivo: "O preço do gás natural nas vendas entre empresas." },
                        { href: "/gas-natural/metodologia", pergunta: "Como ler estes números?", motivo: "Amostra da pesquisa de preços, correção pela inflação e glossário." },
                      ]}
                    />
                  </div>
                </section>
              }
            >
              <GraficoBarras
                semTabela
                titulo={`Vendas em vasilhames de até 13 kg por UF, ${periodoLegivel(v.indicadores.p13_12m.periodo)}`}
                dados={vendasUf}
                chaveCategoria="uf"
                chaveRotulo="nome"
                orientacao="horizontal"
                series={[{ id: "total", rotulo: "Vendas em até P13", cor: COR.foco }]}
                unidade="mil m³"
                casas={1}
                limiteInicial={12}
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
            <FonteFigura ids={["anp_precos_brasil", "anp_precos_estados", "ibge_ipca", "anp_glp_vasilhame"]} />
            <div>
              <h2 className="rotulo text-mineral">Baixar os dados desta página</h2>
              <div className="mt-2">
                <DownloadsGas
                  series={[
                    { id: "preco-glp-brasil-mensal", descricao: "preço do botijão no Brasil, médio, mínimo, máximo e corrigido" },
                    { id: "preco-glp-por-uf", descricao: "preço do botijão por UF no último mês" },
                    { id: "ipca-gas-12-meses", descricao: "IPCA em 12 meses do gás de botijão, encanado, veicular e índice geral" },
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
