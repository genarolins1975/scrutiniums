import type { Metadata } from "next";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { AberturaGas, DownloadsGas, FaixaMedidas, FonteFigura, MedidaGas, NotaGas, ProximasPerguntas, SecaoGas, TabelaGas } from "@/components/gas/Blocos";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { COR } from "@/lib/gas/cores";
import { mesExtenso, num, periodoLegivel } from "@/lib/gas/formato";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("importacao");

export const metadata: Metadata = {
  title: "Importação de gás natural",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

export default function ImportacaoPage() {
  const g = goldGas.importacao();
  const i = g.indicadores;
  const origem = g.origem_12m;
  const primeiro = origem[0];
  const serie = g.serie.filter((x) => x.mes >= "2000-01");
  return (
    <>
      <MarcaVisita secao="gas:importacao" />
      <CabecalhoGas atual="importacao" />
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas
          pagina={pagina}
          dadosAte={<>Volume e dispêndio da ANP até {mesExtenso(g.ultimo_mes)}; origem por país do Comex Stat até {mesExtenso(g.ultimo_mes_comex)}.</>}
        >
          <p>
            De {periodoLegivel(i.importado_12m.periodo)}, o Brasil importou em média {num(i.importado_12m.valor as number, 1)} milhões de m³ de gás natural por
            dia, com dispêndio de US$ {num(i.dispendio_12m.valor as number, 0)} milhões. Somado ao gás disponível da produção nacional, o importado respondeu por{" "}
            {num(i.participacao_12m.valor as number, 1)}% desse total.
          </p>
          <p>
            O gás chega de duas formas: pelo gasoduto entre Bolívia e Brasil, no estado gasoso, e por navio, como gás natural liquefeito (GNL), regaseificado nos
            terminais do litoral. Nos 12 meses do Comex Stat, o principal país de origem ({primeiro.pais}) respondeu por {num(primeiro.participacao_massa_pct, 1)}% da massa importada e o
            GNL, por {num(i.gnl_participacao_massa_12m.valor as number, 1)}%.
          </p>
        </AberturaGas>

        <section aria-label="Medidas principais" className="py-6">
          <FaixaMedidas>
            <MedidaGas ind={i.importado_12m} />
            <MedidaGas ind={i.participacao_12m} />
            <MedidaGas ind={i.dispendio_12m} casas={0} />
            <MedidaGas ind={i.gnl_participacao_massa_12m} />
          </FaixaMedidas>
        </section>

        <SecaoGas id="volume" titulo="Quanto gás entrou no país em cada mês" subtitulo="Milhões de m³ por dia, média de cada mês, desde 2000.">
          <GraficoLinhas
            titulo="Importação de gás natural pelo Brasil"
            dados={serie}
            chaveX="mes"
            formatoX="mes"
            unidade="milhões de m³/dia"
            casas={1}
            zeroNoEixo
            zoom
            chaveUrl="imp"
            series={[{ id: "importado", rotulo: "Gás importado", cor: COR.foco, espessura: 2.5 }]}
          />
          <FonteFigura ids={["anp_importacao"]} />
        </SecaoGas>

        <SecaoGas
          id="participacao"
          titulo="Quanto da oferta veio de fora"
          subtitulo="Percentual do gás importado na soma do importado com o gás disponível da produção nacional, mês a mês."
        >
          <GraficoLinhas
            titulo="Participação do gás importado na oferta"
            dados={serie}
            chaveX="mes"
            formatoX="mes"
            unidade="%"
            casas={1}
            zeroNoEixo
            zoom
            chaveUrl="part"
            series={[{ id: "participacao_pct", rotulo: "Participação do importado", cor: COR.foco, espessura: 2.5 }]}
          />
          <FonteFigura ids={["anp_importacao", "anp_disponivel"]} />
          <NotaGas>
            <p>{i.participacao_12m.nota}</p>
            <p>
              A geração de eletricidade a gás, uma das destinações do gás ofertado, está na{" "}
              <a href="/setor-eletrico/geracao/termica" className="text-gas-dark underline underline-offset-4">página de térmicas do Setor Elétrico</a>.
            </p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="origem" titulo="De onde vem o gás importado" subtitulo={<>Massa líquida em mil toneladas e valor FOB em US$ milhões, {periodoLegivel(g.periodo_origem)}.</>}>
          <GraficoBarras
            titulo={`Importação de gás natural por país de origem, ${periodoLegivel(g.periodo_origem)}, mil toneladas`}
            dados={origem.map((x) => ({ pais: x.pais, gasoso: x.gasoso_mil_t, gnl: x.gnl_mil_t }))}
            chaveCategoria="pais"
            orientacao="horizontal"
            empilhado
            series={[
              { id: "gasoso", rotulo: "Gasoso (gasoduto)", cor: COR.foco },
              { id: "gnl", rotulo: "Liquefeito (GNL)", cor: COR.comp[1] },
            ]}
            unidade="mil t"
            casas={1}
            rotulosValor
          />
          <TabelaGas
            titulo="Massa, valor e participação por país de origem"
            colunas={[
              { id: "pais", rotulo: "País" },
              { id: "gasoso_mil_t", rotulo: "Gasoso, mil t", numero: true, casas: 1 },
              { id: "gnl_mil_t", rotulo: "GNL, mil t", numero: true, casas: 1 },
              { id: "musd", rotulo: "Valor FOB, US$ milhões", numero: true, casas: 1 },
              { id: "participacao_massa_pct", rotulo: "Participação na massa", numero: true, casas: 1, sufixo: "%" },
            ]}
            linhas={origem}
            nota="País de origem como declarado no registro aduaneiro do Comex Stat."
          />
          <FonteFigura ids={["comex_gas"]} />
        </SecaoGas>

        <SecaoGas id="anos" titulo="Gasoduto e GNL em cada ano" subtitulo="Mil toneladas por ano, Comex Stat. O ano corrente aparece com os meses já publicados.">
          <GraficoBarras
            titulo="Importação de gás natural por forma de transporte, mil toneladas"
            dados={g.comex_anual.map((x) => ({ ano: x.meses < 12 ? `${x.ano} (${x.meses} meses)` : x.ano, gasoso: x.gasoso_mil_t, gnl: x.gnl_mil_t }))}
            chaveCategoria="ano"
            empilhado
            series={[
              { id: "gasoso", rotulo: "Gasoso (gasoduto)", cor: COR.foco },
              { id: "gnl", rotulo: "Liquefeito (GNL)", cor: COR.comp[1] },
            ]}
            unidade="mil t"
            casas={0}
          />
          <TabelaGas
            titulo="Valor FOB por forma de transporte e número de países de origem"
            colunas={[
              { id: "ano", rotulo: "Ano" },
              { id: "meses", rotulo: "Meses publicados", numero: true, casas: 0 },
              { id: "gasoso_musd", rotulo: "Gasoso, US$ milhões", numero: true, casas: 1 },
              { id: "gnl_musd", rotulo: "GNL, US$ milhões", numero: true, casas: 1 },
              { id: "paises", rotulo: "Países de origem", numero: true, casas: 0 },
            ]}
            linhas={g.comex_anual}
          />
          <FonteFigura ids={["comex_gas"]} />
          <NotaGas>
            <p>
              O Comex Stat registra massa (kg) e valor; a ANP registra volume (m³) e dispêndio. As duas bases medem o mesmo fluxo com unidades e datas de registro
              diferentes e não devem ser somadas nem convertidas uma na outra nesta página.
            </p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="baixar" titulo="Baixar os dados desta página">
          <DownloadsGas series={[
            { id: "importacao-gas-natural-mensal", descricao: "volume, dispêndio, preço implícito e participação, mês a mês" },
            { id: "importacao-por-origem-12m", descricao: "origem por país nos últimos 12 meses" },
          ]} />
        </SecaoGas>

        <SecaoGas id="proximas" titulo="Para continuar">
          <ProximasPerguntas itens={[
            { href: "/gas-natural/precos", pergunta: "Quanto custa o gás antes da distribuidora?", motivo: "O preço brasileiro ao lado do Henry Hub, do TTF e do GNL no Japão." },
            { href: "/gas-natural/infraestrutura", pergunta: "Por onde o gás chega ao consumidor?", motivo: "Os terminais de GNL e a malha de transporte." },
            { href: "/gas-natural/aproveitamento", pergunta: "Quanto do gás produzido chega ao mercado?", motivo: "O gás disponível da produção nacional." },
          ]} />
        </SecaoGas>
      </main>
    </>
  );
}
