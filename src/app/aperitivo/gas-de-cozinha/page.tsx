import type { Metadata } from "next";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { BotijaoNoEstado } from "@/components/gas/BotijaoNoEstado";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { dadosBotijaoNoEstado } from "@/lib/gas/botijaoNoEstado";
import { carimbo, mesExtenso } from "@/lib/gas/formato";
import { fontesPorId, goldGas } from "@/lib/gas/gold";
import { paginaGas } from "@/lib/gas/navegacao";
import { RotuloContexto } from "@/components/layout/RotuloContexto";

export const dynamic = "force-static";

const pagina = paginaGas("gas-de-cozinha");
const PERGUNTA = "Quanto custa o botijão de gás no meu estado?";

export const metadata: Metadata = {
  title: PERGUNTA,
  description: "Preço médio do botijão de 13 kg de gás de cozinha no seu estado, no último mês da pesquisa da ANP, comparado com a média do Brasil.",
  alternates: { canonical: pagina.href },
};

/**
 * Versão aperitivo do Gás de cozinha (princípio do aperitivo, decisão do dono de 20/10/2026). Quem acessa
 * /gas-natural/gas-de-cozinha sem sessão recebe esta página por rewrite (src/middleware.ts); quem tem conta recebe ali o
 * painel completo. Mostra só a consulta do seu caso: o preço médio do botijão no estado escolhido, no último mês da
 * pesquisa da ANP, a média do Brasil e a diferença. Os dados vão no HTML (nada é buscado no navegador). Mapa, comparação
 * entre estados, séries, inflação, vendas e downloads ficam no painel completo, listados no convite do fim. Os links da
 * página apontam sempre para o endereço público, nunca para este caminho interno.
 */
export default function AperitivoGasDeCozinhaPagina() {
  const g = goldGas.glp();
  const dados = dadosBotijaoNoEstado(g);
  const mes = mesExtenso(g.ultimo_mes);
  const fontes = fontesPorId(["anp_precos_estados", "anp_precos_brasil"]);
  const orgao = fontes[0]?.orgao ?? "ANP";
  const conjunto = (fontes[0]?.conjunto ?? "Levantamento de Preços de Combustíveis").split(":")[0];
  const captura = fontes.map((f) => f.capturado_em).filter((c): c is string => Boolean(c)).sort().at(-1) ?? g.dados_capturados_em;
  const inicioUf = typeof g.serie_uf[0]?.mes === "string" ? mesExtenso(g.serie_uf[0].mes) : null;
  const inicioIpca = mesExtenso(g.ipca.doze_meses.find((x) => x.botijao !== null)?.mes);
  const inicioAcumulado = mesExtenso(g.ipca.indicadores.botijao_acumulado?.periodo.slice(0, 7));
  return (
    <>
      <MarcaVisita secao={pagina.secao} />
      <CabecalhoGas atual="gas-de-cozinha" />
      <main id="conteudo" className="ed-pagina pb-12">
        <div className="cab-modulo gas-abertura">
          <RotuloContexto rota="/gas-natural/gas-de-cozinha" pagina={pagina.rotulo} className="text-gas-dark" />
          <h1 className="ed-h1 mt-3 max-w-4xl font-serif text-carvao">{PERGUNTA}</h1>
          <div className="ed-lead mt-4 max-w-prose2 text-carvao-muted">
            <p>Escolha o estado para ver o preço médio do botijão de 13 kg de gás de cozinha em {mes}, comparado com a média do Brasil.</p>
          </div>
        </div>

        <section aria-label="Preço do botijão no seu estado" className="pb-8">
          <BotijaoNoEstado dados={dados} />
        </section>

        <section aria-label="Fonte e ressalvas" className="max-w-prose2 space-y-3 border-t border-linha py-6 text-sm leading-relaxed text-carvao">
          <p>
            Fonte: {orgao}, {conjunto}, séries mensais por estado e Brasil, mês de referência {mes}. Dados capturados em {carimbo(captura)}.
          </p>
          <p className="text-carvao-muted">
            São médias de uma amostra de revendas pesquisadas pela {orgao} no mês, não o preço de uma revenda; a pesquisa não cobre todos os municípios. A
            média do Brasil é calculada pela própria {orgao}. A diferença é o preço médio do estado menos a média do Brasil; em percentual, sobre a média do
            Brasil.
          </p>
          <p className="text-carvao-muted">
            O botijão leva gás liquefeito de petróleo (GLP), mistura de propano e butano. Não é o gás natural que chega às casas por tubulação.
          </p>
        </section>

        <ConviteAperitivo
          rota={pagina.href}
          comConta={[
            `Os ${g.por_uf.length} estados lado a lado, no mapa e na tabela: preço médio, menor e maior preço encontrados, o preço de 12 meses antes, a variação em 12 meses e as revendas pesquisadas em cada um`,
            "A variação do preço médio do Brasil em 12 meses e o estado mais caro e o mais barato do mês",
            ...(inicioUf ? [`O preço do seu estado mês a mês desde ${inicioUf}, ao lado da média do Brasil`] : []),
            `O botijão no Brasil mês a mês desde ${mesExtenso(g.serie[0]?.mes)}, em valores da época e corrigidos pela inflação para reais de ${mesExtenso(g.mes_base_real)}, com o menor e o maior preço de cada pesquisa`,
            `A inflação do gás de botijão no IPCA, em 12 meses desde ${inicioIpca}, comparada com a do índice geral, e a alta acumulada desde ${inicioAcumulado}`,
            ...(g.vendas
              ? [`Quanto gás de cozinha as distribuidoras vendem em botijões de até 13 kg e em outros vasilhames, mês a mês desde ${mesExtenso(g.vendas.serie[0]?.mes)}, e o total de 12 meses em cada um dos ${g.vendas.por_uf.length} estados`]
              : []),
            "Os arquivos para baixar (CSV): o preço do botijão no Brasil mês a mês, o preço por estado e a inflação do gás em 12 meses",
            "As outras páginas do Observatório de Gás Natural, como o GNV e o gás encanado, o preço do gás antes da distribuidora e o método",
          ]}
        />
      </main>
    </>
  );
}
