import type { Metadata } from "next";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { AberturaGas, DownloadsGas, FaixaMedidas, FonteFigura, MedidaGas, NotaGas, ProximasPerguntas, SecaoGas, TabelaGas } from "@/components/gas/Blocos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaUf } from "@/components/gas/MapaUf";
import { SeriePorUf } from "@/components/gas/SeriePorUf";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { mesAno, mesExtenso, num, sinal } from "@/lib/gas/formato";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("gnv-e-gas-encanado");

export const metadata: Metadata = {
  title: "Preço do GNV e inflação do gás encanado",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

export default function GnvPage() {
  const g = goldGas.gnv();
  const i = g.indicadores;
  const ip = g.ipca.indicadores;
  const maior = g.por_uf[0];
  const menor = g.por_uf[g.por_uf.length - 1];
  const valoresMapa = Object.fromEntries(g.por_uf.map((x) => [x.codigo, x.medio]));
  const ufs = [...g.por_uf].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((x) => ({ uf: x.uf, nome: x.nome }));
  const variacao = i.variacao_12m.valor as number | null;
  return (
    <>
      <MarcaVisita secao="gas:gnv-e-gas-encanado" />
      <CabecalhoGas atual="gnv-e-gas-encanado" />
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas pagina={pagina} dadosAte={<>Preços da ANP até {mesExtenso(g.ultimo_mes)}; IPCA do IBGE até {mesExtenso(g.ipca.ultimo_mes)}.</>}>
          <p>
            Em {mesExtenso(g.ultimo_mes)}, o metro cúbico de gás natural veicular (GNV) custou em média R$ {num(i.medio_mes.valor as number, 2)} nos{" "}
            {num(i.postos_mes.valor as number, 0)} postos pesquisados pela ANP{variacao === null ? "" : `, ${sinal(variacao, 1, "%")} em 12 meses`}. A pesquisa
            encontrou GNV em {num(i.ufs_mes.valor as number, 0)} UFs, com média de R$ {num(menor.medio, 2)} ({menor.nome}) a R$ {num(maior.medio, 2)} ({maior.nome}).
          </p>
          <p>
            Para o gás encanado das residências não há pesquisa nacional de preço: a tarifa é fixada por cada estado para cada distribuidora. O IPCA acompanha a
            variação do que as famílias pagam. Em 12 meses até {mesExtenso(g.ipca.ultimo_mes)}, o gás encanado variou {sinal(ip.encanado.valor as number, 2, "%")} e
            o gás veicular, {sinal(ip.veicular.valor as number, 2, "%")}, ante {sinal(ip.geral.valor as number, 2, "%")} do índice geral.
          </p>
        </AberturaGas>

        <section aria-label="Medidas principais" className="py-6">
          <FaixaMedidas>
            <MedidaGas ind={i.medio_mes} casas={2} />
            <MedidaGas ind={i.variacao_12m} variacao />
            <MedidaGas ind={ip.encanado} casas={2} variacao />
            <MedidaGas ind={ip.veicular} casas={2} variacao />
          </FaixaMedidas>
        </section>

        <SecaoGas id="estados" titulo="O preço do GNV nas UFs com postos pesquisados" subtitulo={<>R$ por m³, média da pesquisa de {mesExtenso(g.ultimo_mes)}. UF sem posto de GNV na amostra fica sem dado.</>}>
          <MapaUf
            titulo={`Preço médio do GNV por UF, ${mesAno(g.ultimo_mes)}`}
            valores={valoresMapa}
            unidade="R$/m³"
            periodo={mesAno(g.ultimo_mes)}
            nota="Classes por quantis entre as UFs com preço. Sem dado: a pesquisa do mês não encontrou GNV na UF."
          />
          <TabelaGas
            titulo={`Preço do GNV por UF, ${mesAno(g.ultimo_mes)}, do maior para o menor preço médio`}
            colunas={[
              { id: "nome", rotulo: "UF" },
              { id: "medio", rotulo: "Médio, R$/m³", numero: true, casas: 2 },
              { id: "minimo", rotulo: "Mínimo, R$/m³", numero: true, casas: 2 },
              { id: "maximo", rotulo: "Máximo, R$/m³", numero: true, casas: 2 },
              { id: "medio_ano_anterior", rotulo: "Médio 12 meses antes", numero: true, casas: 2 },
              { id: "variacao_12m_pct", rotulo: "Variação em 12 meses", numero: true, casas: 1, sufixo: "%" },
              { id: "postos", rotulo: "Postos pesquisados", numero: true, casas: 0 },
            ]}
            linhas={g.por_uf}
          />
          <FonteFigura ids={["anp_precos_estados"]} />
        </SecaoGas>

        <SecaoGas id="sua-uf" titulo="O preço do GNV no seu estado ao longo do tempo" subtitulo="R$ por m³, média mensal desde janeiro de 2019, ao lado da média Brasil.">
          <SeriePorUf
            titulo="Preço médio do GNV"
            serieUf={g.serie_uf}
            serieBrasil={g.serie}
            ufs={ufs}
            inicial={maior.uf}
            unidade="R$/m³"
            corUf={COR.foco}
            corBrasil={COR.referencia}
          />
          <FonteFigura ids={["anp_precos_estados", "anp_precos_brasil"]} />
        </SecaoGas>

        <SecaoGas
          id="historico"
          titulo="O GNV desde 2013, em valores da época e corrigidos pela inflação"
          subtitulo={<>R$ por m³, média Brasil. A linha corrigida expressa cada mês em reais de {mesExtenso(g.mes_base_real)} pelo IPCA índice geral; a faixa mostra o menor e o maior preço da pesquisa.</>}
        >
          <GraficoLinhas
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
          <FonteFigura ids={["anp_precos_brasil", "ibge_ipca"]} />
        </SecaoGas>

        <SecaoGas id="inflacao" titulo="A inflação do gás encanado e do gás veicular" subtitulo="IPCA, variação em 12 meses, %, desde janeiro de 2012.">
          <GraficoLinhas
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
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            De janeiro de 2012 a {mesExtenso(g.ipca.ultimo_mes)}, o gás encanado acumulou alta de {num(ip.encanado_acumulado.valor as number, 1)}% no IPCA, o gás
            veicular, de {num(ip.veicular_acumulado.valor as number, 1)}%, e o índice geral, de {num(ip.geral_acumulado.valor as number, 1)}%.
          </p>
          <FonteFigura ids={["ibge_ipca"]} />
          <NotaGas>
            <p>
              O IPCA é medido nas regiões metropolitanas e municípios da pesquisa do IBGE; o subitem gás encanado só existe onde há distribuição canalizada para
              residências. A variação não é a de cada distribuidora.
            </p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="baixar" titulo="Baixar os dados desta página">
          <DownloadsGas series={[
            { id: "preco-gnv-brasil-mensal", descricao: "preço do GNV no Brasil, médio, mínimo, máximo e corrigido" },
            { id: "preco-gnv-por-uf", descricao: "preço do GNV por UF no último mês" },
            { id: "ipca-gas-12-meses", descricao: "IPCA em 12 meses do gás encanado, veicular, de botijão e índice geral" },
          ]} />
        </SecaoGas>

        <SecaoGas id="proximas" titulo="Para continuar">
          <ProximasPerguntas itens={[
            { href: "/gas-natural/precos", pergunta: "Quanto custa o gás antes da distribuidora?", motivo: "O preço de venda às distribuidoras, a primeira parcela da tarifa." },
            { href: "/gas-natural/regulacao", pergunta: "Quem define a tarifa do gás encanado?", motivo: "Os estados regulam a distribuição de gás canalizado." },
            { href: "/gas-natural/gas-de-cozinha", pergunta: "Quanto custa o botijão de gás?", motivo: "O GLP, que não é gás natural, por UF." },
          ]} />
        </SecaoGas>
      </main>
    </>
  );
}
