import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { AberturaGas, DownloadsGas, FaixaMedidas, FonteFigura, MedidaGas, NotaGas, ProximasPerguntas, SecaoGas, TabelaGas } from "@/components/gas/Blocos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { mesExtenso, num, periodoLegivel, sinal } from "@/lib/gas/formato";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("producao");

export const metadata: Metadata = {
  title: "Produção de gás natural",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

export default function ProducaoPage() {
  const g = goldGas.producao();
  const i = g.indicadores;
  const lider = g.por_uf[0];
  const variacao = i.producao_variacao_anual.valor as number | null;
  return (
    <>
      <MarcaVisita secao="gas:producao" />
      <header>
        <CabecalhoPlataforma colecao="gas" destinoConta="/gas-natural" />
        <NavegacaoColecao colecao="gas" />
      </header>
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas pagina={pagina} dadosAte={<>Dados da ANP até {mesExtenso(g.ultimo_mes)}.</>}>
          <p>
            Em {mesExtenso(g.ultimo_mes)}, a produção de gás natural no Brasil foi de {num(i.producao_mes.valor as number, 1)} milhões de m³ por dia, em
            média, {variacao === null ? "sem comparação com o ano anterior" : `${sinal(variacao, 1, "%")} em relação a ${mesExtenso(i.producao_mes_ano_anterior.periodo)}`}. Nos últimos 12
            meses, {num(i.mar_pct_12m.valor as number, 1)}% da produção veio de campos no mar, e a UF com maior produção ({lider.nome}) respondeu por {num(lider.participacao_pct, 1)}% do total.
          </p>
          <p>
            Produção é o volume medido na saída dos poços. Uma parte volta para os reservatórios, é queimada ou é consumida nas próprias plataformas; a página{" "}
            <a href="/gas-natural/aproveitamento" className="text-gas-dark underline underline-offset-4">Aproveitamento</a> mostra quanto sobra para o mercado.
          </p>
        </AberturaGas>

        <section aria-label="Medidas principais" className="py-6">
          <FaixaMedidas>
            <MedidaGas ind={i.producao_mes} />
            <MedidaGas ind={i.producao_variacao_anual} variacao rotulo="Variação sobre o mesmo mês do ano anterior" comparacao={<>Base: {num(i.producao_mes_ano_anterior.valor as number, 1)} milhões de m³/dia em {mesExtenso(i.producao_mes_ano_anterior.periodo)}.</>} />
            <MedidaGas ind={i.producao_12m} />
            <MedidaGas ind={i.mar_pct_12m} />
          </FaixaMedidas>
        </section>

        <SecaoGas
          id="evolucao"
          titulo="Como a produção evoluiu desde 1997"
          subtitulo="Milhões de m³ por dia, média de cada mês. Total, campos no mar e campos em terra. Arraste sobre o gráfico ou use os períodos prontos para aproximar."
        >
          <GraficoLinhas
            titulo="Produção de gás natural no Brasil, mar e terra"
            dados={g.serie}
            chaveX="mes"
            formatoX="mes"
            unidade="milhões de m³/dia"
            casas={1}
            zeroNoEixo
            zoom
            legendaInterativa
            chaveUrl="prod"
            series={[
              { id: "total", rotulo: "Total", cor: COR.foco, espessura: 2.5 },
              { id: "mar", rotulo: "Mar", cor: COR.comp[0] },
              { id: "terra", rotulo: "Terra", cor: COR.comp[1], tracejada: true },
            ]}
          />
          <FonteFigura ids={["anp_producao"]} extra="Média diária calculada pela Scrutiniums: volume do mês dividido pelos dias do mês." />
        </SecaoGas>

        <SecaoGas
          id="estados"
          titulo="Em que estados o gás é produzido"
          subtitulo={<>Média de {periodoLegivel(i.producao_12m.periodo)}, milhões de m³ por dia. {g.por_uf.length} UFs registraram produção nesse período.</>}
        >
          <GraficoBarras
            titulo={`Produção média por UF, ${periodoLegivel(i.producao_12m.periodo)}`}
            dados={g.por_uf.map((x) => ({ uf: x.uf, nome: x.nome, mmd: x.mmd_12m }))}
            chaveCategoria="uf"
            chaveRotulo="nome"
            orientacao="horizontal"
            series={[{ id: "mmd", rotulo: "Produção média", cor: COR.foco }]}
            unidade="milhões de m³/dia"
            casas={1}
            rotulosValor
          />
          <TabelaGas
            titulo="Participação, local de produção e variação por UF"
            colunas={[
              { id: "nome", rotulo: "UF" },
              { id: "mmd_12m", rotulo: "Milhões de m³/dia", numero: true, casas: 2 },
              { id: "participacao_pct", rotulo: "Participação", numero: true, casas: 1, sufixo: "%" },
              { id: "mar_pct", rotulo: "Produção no mar", numero: true, casas: 1, sufixo: "%" },
              { id: "variacao_12m_pct", rotulo: "Variação sobre os 12 meses anteriores", numero: true, casas: 1, sufixo: "%" },
            ]}
            linhas={g.por_uf}
            nota="Variação: soma dos últimos 12 meses comparada com a soma dos 12 meses imediatamente anteriores. UF sem linha não registrou produção no conjunto."
          />
          <FonteFigura ids={["anp_producao"]} />
        </SecaoGas>

        <SecaoGas
          id="maiores"
          titulo="A produção das cinco maiores UFs desde 2010"
          subtitulo="Milhões de m³ por dia, média de cada mês. As cinco UFs com maior produção nos últimos 12 meses. Toque na legenda para ocultar uma série."
        >
          <GraficoLinhas
            titulo="Produção de gás natural nas cinco maiores UFs produtoras"
            dados={g.serie_uf}
            chaveX="mes"
            formatoX="mes"
            unidade="milhões de m³/dia"
            casas={1}
            zeroNoEixo
            legendaInterativa
            series={g.ufs_serie.map((uf, k) => ({
              id: uf,
              rotulo: g.por_uf.find((x) => x.uf === uf)?.nome ?? uf,
              sigla: uf,
              cor: k === 0 ? COR.foco : COR.comp[(k - 1) % COR.comp.length],
              tracejada: k === 4,
            }))}
          />
          <FonteFigura ids={["anp_producao"]} />
        </SecaoGas>

        <SecaoGas id="anual" titulo="Produção por ano" subtitulo="Bilhões de m³ no ano. Só anos com os 12 meses publicados.">
          <GraficoBarras
            titulo="Produção anual de gás natural no Brasil"
            dados={g.anual.filter((x) => Number(x.ano) >= 2000).map((x) => ({ ano: x.ano, total: x.bilhoes_m3 }))}
            chaveCategoria="ano"
            series={[{ id: "total", rotulo: "Produção no ano", cor: COR.foco }]}
            unidade="bilhões de m³"
            casas={1}
          />
          <FonteFigura ids={["anp_producao"]} />
          <NotaGas>
            {g.notas.map((n) => <p key={n}>{n}</p>)}
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="baixar" titulo="Baixar os dados desta página">
          <DownloadsGas series={[
            { id: "producao-gas-natural-mensal", descricao: "produção mensal, total, mar e terra" },
            { id: "producao-por-uf-12m", descricao: "produção por UF nos últimos 12 meses" },
          ]} />
        </SecaoGas>

        <SecaoGas id="proximas" titulo="Para continuar">
          <ProximasPerguntas itens={[
            { href: "/gas-natural/aproveitamento", pergunta: "Quanto do gás produzido chega ao mercado?", motivo: "Reinjeção, queima e consumo nas plataformas reduzem o volume disponível." },
            { href: "/gas-natural/importacao", pergunta: "Quanto gás o Brasil importa?", motivo: "A oferta ao mercado soma o gás disponível da produção e o importado." },
            { href: "/gas-natural/precos", pergunta: "Quanto custa o gás antes da distribuidora?", motivo: "Preço de venda por região e referências internacionais." },
          ]} />
        </SecaoGas>
      </main>
    </>
  );
}
