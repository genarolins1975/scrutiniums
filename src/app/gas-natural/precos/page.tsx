import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { AberturaGas, DownloadsGas, FaixaMedidas, FonteFigura, MedidaGas, NotaGas, ProximasPerguntas, SecaoGas } from "@/components/gas/Blocos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { mesExtenso, num } from "@/lib/gas/formato";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("precos");

export const metadata: Metadata = {
  title: "Preços do gás natural na cadeia",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

export default function PrecosPage() {
  const g = goldGas.precos();
  const i = g.indicadores;
  const nt = g.regioes.filter((r) => r.mercado === "Não Térmico");
  const razaoHH = (i.razao_henry_hub?.valor as number | null | undefined) ?? null;
  const razaoTTF = (i.razao_ttf?.valor as number | null | undefined) ?? null;
  return (
    <>
      <MarcaVisita secao="gas:precos" />
      <header>
        <CabecalhoPlataforma colecao="gas" destinoConta="/gas-natural" />
        <NavegacaoColecao colecao="gas" />
      </header>
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas
          pagina={pagina}
          dadosAte={<>Vendas declaradas à ANP até {mesExtenso(g.ultimo_mes)}; referências do Banco Mundial ({g.atualizado_banco_mundial ?? "data de atualização não informada"}).</>}
        >
          <p>
            Em {mesExtenso(g.ultimo_mes)}, o gás vendido por produtores e comercializadores às distribuidoras e aos consumidores livres do mercado não térmico
            custou em média R$ {num(i.nao_termico_mes.valor as number, 2)} por milhão de BTU, com impostos. O gás vendido para geração termelétrica custou
            R$ {num(i.termico_mes.valor as number, 2)}.
          </p>
          {i.brasil_usd_mes && (
            <p>
              Convertido pela PTAX média de {mesExtenso(i.brasil_usd_mes.periodo)}, o preço não térmico equivale a US$ {num(i.brasil_usd_mes.valor as number, 2)}{" "}
              por milhão de BTU. No mesmo mês, o Henry Hub, nos Estados Unidos, marcou US$ {num(i.henry_hub_mes.valor as number, 2)}
              {razaoHH !== null && ` (o preço brasileiro é ${num(razaoHH, 2)} vezes esse valor)`} e o TTF, na Europa, US$ {num(i.ttf_mes.valor as number, 2)}
              {razaoTTF !== null && ` (${num(razaoTTF, 2)} vezes)`}. O preço brasileiro inclui impostos; as referências internacionais, não.
            </p>
          )}
        </AberturaGas>

        <section aria-label="Medidas principais" className="py-6">
          <FaixaMedidas>
            <MedidaGas ind={i.nao_termico_mes} casas={2} />
            <MedidaGas ind={i.termico_mes} casas={2} />
            {i.brasil_usd_mes && <MedidaGas ind={i.brasil_usd_mes} casas={2} />}
            {i.henry_hub_mes && <MedidaGas ind={i.henry_hub_mes} casas={2} />}
          </FaixaMedidas>
        </section>

        <NotaGas titulo="O que este preço é e o que não é">
          <p>
            É o preço médio do gás vendido a distribuidoras e a consumidores livres, declarado pelos vendedores à ANP e ponderado pelo volume. Não é a tarifa da
            distribuidora: quem compra gás canalizado paga ainda a margem de distribuição, definida pelo regulador de cada estado, e os tributos sobre a fatura.
          </p>
          <p>A ANP agrega as vendas em regiões, para preservar o sigilo comercial; um mês sem alguma região fica sem média nacional.</p>
        </NotaGas>

        <SecaoGas
          id="regioes"
          titulo="O preço do gás vendido às distribuidoras em cada região"
          subtitulo="Mercado não térmico, R$ por milhão de BTU (MMBtu), com impostos, mês a mês desde setembro de 2019. A média Brasil é ponderada pelo volume de cada região."
        >
          <GraficoLinhas
            titulo="Preço médio de venda às distribuidoras e consumidores livres, mercado não térmico"
            dados={g.serie}
            chaveX="mes"
            formatoX="mes"
            unidade="R$/MMBtu"
            casas={2}
            zeroNoEixo
            legendaInterativa
            chaveUrl="reg"
            series={[
              { id: "nao_termico", rotulo: "Média Brasil", cor: COR.foco, espessura: 2.5 },
              ...nt.map((r, k) => ({ id: r.id, rotulo: r.regiao, cor: COR.comp[k % COR.comp.length], tracejada: true })),
            ]}
          />
          <FonteFigura ids={["anp_vendas_distribuidoras"]} />
        </SecaoGas>

        <SecaoGas
          id="mercados"
          titulo="Gás para indústria e cidades e gás para térmicas"
          subtitulo="Média Brasil ponderada pelo volume, R$/MMBtu, com impostos. Meses em que a ANP não publicou alguma região do mercado ficam sem valor."
        >
          <GraficoLinhas
            titulo="Preço médio por mercado atendido"
            dados={g.serie}
            chaveX="mes"
            formatoX="mes"
            unidade="R$/MMBtu"
            casas={2}
            zeroNoEixo
            series={[
              { id: "nao_termico", rotulo: "Não térmico", cor: COR.foco, espessura: 2.5 },
              { id: "termico", rotulo: "Térmico", cor: COR.comp[1] },
            ]}
          />
          <GraficoLinhas
            titulo="Volume vendido por mercado atendido"
            dados={g.serie}
            chaveX="mes"
            formatoX="mes"
            unidade="milhões de m³/dia"
            casas={1}
            zeroNoEixo
            series={[
              { id: "nao_termico_volume", rotulo: "Não térmico", cor: COR.foco, espessura: 2.5 },
              { id: "termico_volume", rotulo: "Térmico", cor: COR.comp[1] },
            ]}
          />
          <FonteFigura ids={["anp_vendas_distribuidoras"]} />
        </SecaoGas>

        <SecaoGas
          id="internacional"
          titulo="O preço brasileiro ao lado das referências internacionais"
          subtitulo="US$ por milhão de BTU, mês a mês. Henry Hub (Estados Unidos), TTF (Países Baixos) e GNL importado pelo Japão, do Banco Mundial; Brasil, preço não térmico da ANP convertido pela PTAX média do mês."
        >
          <GraficoLinhas
            titulo="Preço do gás natural: Brasil e referências internacionais"
            dados={g.internacional}
            chaveX="mes"
            formatoX="mes"
            unidade="US$/MMBtu"
            casas={2}
            zeroNoEixo
            legendaInterativa
            chaveUrl="int"
            series={[
              { id: "brasil_nao_termico_usd", rotulo: "Brasil, não térmico (com impostos)", sigla: "Brasil", cor: COR.foco, espessura: 2.5 },
              { id: "henry_hub", rotulo: "Henry Hub", cor: COR.comp[0] },
              { id: "ttf", rotulo: "TTF", cor: COR.comp[1] },
              { id: "gnl_japao", rotulo: "GNL Japão", cor: COR.comp[2], tracejada: true },
            ]}
          />
          <FonteFigura ids={["wb_pinksheet", "anp_vendas_distribuidoras", "bcb_ptax"]} />
          <NotaGas>
            <p>
              As referências são preços de mercados atacadistas sem impostos; o preço brasileiro é a média declarada à ANP com impostos, e os metadados da ANP
              não informam se ele inclui transporte. A diferença entre as linhas não mede, sozinha, o efeito de tributos, transporte ou concorrência.
            </p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas
          id="entre-agentes"
          titulo="O preço nas vendas entre produtores e comercializadores"
          subtitulo="R$/MMBtu, com impostos. Gás não processado vendido entre produtores e comercializadores, por bacia; e gás processado vendido entre comercializadores."
        >
          <GraficoLinhas
            titulo="Preço médio nas vendas entre agentes"
            dados={g.produtores.map((x) => ({ ...x, comercializadores: g.comercializadores.find((c) => c.mes === x.mes)?.preco ?? null }))}
            chaveX="mes"
            formatoX="mes"
            unidade="R$/MMBtu"
            casas={2}
            zeroNoEixo
            legendaInterativa
            series={[
              ...g.bacias.map((b, k) => ({ id: b, rotulo: `Gás não processado, ${b}`, sigla: b, cor: COR.comp[k % COR.comp.length] })),
              { id: "comercializadores", rotulo: "Gás processado, entre comercializadores", sigla: "Processado", cor: COR.foco, espessura: 2.5 },
            ]}
          />
          <FonteFigura ids={["anp_vendas_produtores", "anp_vendas_comercializadores"]} />
        </SecaoGas>

        <SecaoGas id="baixar" titulo="Baixar os dados desta página">
          <DownloadsGas series={[
            { id: "preco-venda-distribuidoras-mensal", descricao: "preço e volume por mercado, média Brasil ponderada" },
            { id: "precos-internacionais-mensal", descricao: "Henry Hub, TTF, GNL Japão, Brasil em dólar e PTAX" },
          ]} />
        </SecaoGas>

        <SecaoGas id="proximas" titulo="Para continuar">
          <ProximasPerguntas itens={[
            { href: "/gas-natural/gnv-e-gas-encanado", pergunta: "Quanto custa o GNV e como varia o gás encanado?", motivo: "Preço do GNV por UF e a inflação do gás encanado." },
            { href: "/gas-natural/mercado", pergunta: "Mais empresas estão comprando e vendendo gás?", motivo: "Carregadores na malha e volumes entre agentes." },
            { href: "/gas-natural/regulacao", pergunta: "Quem define as regras do gás?", motivo: "União, ANP e os estados, que regulam a distribuição." },
          ]} />
        </SecaoGas>
      </main>
    </>
  );
}
