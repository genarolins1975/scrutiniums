import type { Metadata } from "next";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { AberturaGas, DownloadsGas, FaixaMedidas, FonteFigura, MedidaGas, NotaGas, ProximasPerguntas, SecaoGas } from "@/components/gas/Blocos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { mesAno, mesExtenso, num } from "@/lib/gas/formato";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("mercado");

export const metadata: Metadata = {
  title: "Abertura do mercado de gás natural",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

export default function MercadoPage() {
  const g = goldGas.mercado();
  const inf = goldGas.infraestrutura();
  const i = g.indicadores;
  const principais = g.transportadoras.filter((t) => g.carregadores.some((x) => (x[`n:${t}`] as number) > 2));
  const incompletos = inf.meses_incompletos.map((m) => mesAno(m.mes));
  return (
    <>
      <MarcaVisita secao="gas:mercado" />
      <CabecalhoGas atual="mercado" />
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas pagina={pagina} dadosAte={<>Movimentação nos gasodutos até {mesExtenso(g.ultimo_mes)}; vendas entre agentes até {mesExtenso(i.vendas_comercializadores_mes.periodo)}.</>}>
          <p>
            Carregador é a empresa que contrata capacidade na malha de transporte e coloca gás nela, para vender ou para consumir. Em {mesExtenso(i.carregadores_mes.periodo)},{" "}
            {num(i.carregadores_mes.valor as number, 0)} carregadores movimentaram gás nos gasodutos de transporte, segundo os arquivos que as transportadoras
            entregam à ANP. Em {mesExtenso(i.carregadores_inicio.periodo)}, primeiro mês da série, eram {num(i.carregadores_inicio.valor as number, 0)}.
          </p>
          <p>
            A Lei 14.134/2021 assegura a terceiros o acesso aos gasodutos de transporte, mediante contratação de capacidade. O número de quem efetivamente
            movimenta gás mostra quantas empresas usam esse acesso; não diz quanto gás cada uma movimenta nem a que preço.
          </p>
        </AberturaGas>

        <section aria-label="Medidas principais" className="py-6">
          <FaixaMedidas>
            <MedidaGas ind={i.carregadores_mes} casas={0} />
            <MedidaGas ind={i.carregadores_inicio} casas={0} />
            <MedidaGas ind={i.vendas_comercializadores_mes} />
            <MedidaGas ind={i.vendas_produtores_mes} />
          </FaixaMedidas>
        </section>

        <SecaoGas
          id="carregadores"
          titulo="Quantas empresas movimentam gás na malha de transporte"
          subtitulo="Carregadores distintos com volume realizado positivo em pontos de recebimento ou entrega, por mês, desde janeiro de 2021."
        >
          <GraficoLinhas
            titulo="Carregadores com gás movimentado na malha de transporte"
            dados={g.carregadores}
            chaveX="mes"
            formatoX="mes"
            unidade="carregadores"
            casas={0}
            zeroNoEixo
            series={[{ id: "ativos", rotulo: "Carregadores com movimentação", cor: COR.foco, espessura: 2.5 }]}
          />
          <FonteFigura ids={["anp_movimentacao"]} />
          {incompletos.length > 0 && (
            <NotaGas titulo="Meses sem valor">
              <p>
                {incompletos.join(", ")} ficam sem total, porque o arquivo de uma transportadora relevante veio sem volume ou com volume fora de escala (ver
                Infraestrutura). O dado não foi estimado.
              </p>
            </NotaGas>
          )}
        </SecaoGas>

        <SecaoGas
          id="por-transportadora"
          titulo="Carregadores em cada transportadora"
          subtitulo="Carregadores com volume realizado no mês, por transportadora. Um carregador pode atuar em mais de uma malha, por isso a soma das linhas passa do total."
        >
          <GraficoLinhas
            titulo="Carregadores com movimentação por transportadora"
            dados={g.carregadores}
            chaveX="mes"
            formatoX="mes"
            unidade="carregadores"
            casas={0}
            zeroNoEixo
            legendaInterativa
            series={principais.map((t, k) => ({ id: `n:${t}`, rotulo: g.transportadoras_nome[t] ?? t, sigla: t, cor: k === 0 ? COR.foco : COR.comp[(k - 1) % COR.comp.length] }))}
          />
          <FonteFigura ids={["anp_movimentacao"]} />
        </SecaoGas>

        <SecaoGas
          id="entre-agentes"
          titulo="Quanto gás é negociado entre empresas antes de chegar às distribuidoras"
          subtitulo="Milhões de m³ por dia, média mensal. Gás processado vendido entre comercializadores e gás não processado vendido entre produtores e comercializadores."
        >
          <GraficoLinhas
            titulo="Volume vendido entre agentes do mercado de gás"
            dados={g.secundario}
            chaveX="mes"
            formatoX="mes"
            unidade="milhões de m³/dia"
            casas={1}
            zeroNoEixo
            series={[
              { id: "comercializadores", rotulo: "Gás processado, entre comercializadores", sigla: "Processado", cor: COR.foco, espessura: 2.5 },
              { id: "produtores", rotulo: "Gás não processado, entre produtores e comercializadores", sigla: "Não processado", cor: COR.comp[0] },
            ]}
          />
          <FonteFigura ids={["anp_vendas_comercializadores", "anp_vendas_produtores"]} />
          <NotaGas>
            <p>
              As vendas a distribuidoras e a consumidores livres ficam em outro conjunto, na página Preços na cadeia. A ANP não publica, em dados abertos, a
              participação de cada vendedor no volume nem a lista de consumidores livres; esses indicadores ficam fora desta página até haver fonte estruturada.
            </p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="baixar" titulo="Baixar os dados desta página">
          <DownloadsGas series={[{ id: "carregadores-ativos-mensal", descricao: "carregadores com movimentação, total e por transportadora" }]} />
        </SecaoGas>

        <SecaoGas id="proximas" titulo="Para continuar">
          <ProximasPerguntas itens={[
            { href: "/gas-natural/infraestrutura", pergunta: "Por onde o gás chega ao consumidor?", motivo: "Volume entregue por transportadora e terminais de GNL." },
            { href: "/gas-natural/regulacao", pergunta: "Quem define as regras do gás?", motivo: "A lei que abriu o transporte e o papel dos estados." },
            { href: "/gas-natural/precos", pergunta: "Quanto custa o gás antes da distribuidora?", motivo: "Preços nas vendas entre agentes e às distribuidoras." },
          ]} />
        </SecaoGas>
      </main>
    </>
  );
}
