import type { Metadata } from "next";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { AberturaGas, NotaGas, SecaoGas } from "@/components/gas/Blocos";
import { NATUREZAS } from "@/components/evidencia/SeloNatureza";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { paginaGas } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

const pagina = paginaGas("metodologia");

export const metadata: Metadata = {
  title: "Método e glossário do gás natural",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

const REGRAS: [string, string][] = [
  ["Nenhum número digitado", "Todo valor das páginas sai da gold, gerada por código a partir dos arquivos oficiais guardados no repositório. Frases com números são montadas a partir da gold no momento da publicação."],
  ["Observado ou calculado", "Observado é o valor publicado pela fonte. Calculado é transformação feita pela Scrutiniums, sempre com a fórmula ao lado do número (média diária, soma de 12 meses, participação, média ponderada, conversão de moeda, correção pela inflação)."],
  ["Média diária", "Volumes mensais da ANP em mil m³ viram milhões de m³ por dia dividindo pelo número de dias do mês. Janelas de 12 meses exigem cobertura completa e dividem a soma pelos dias da janela. No aproveitamento, a janela termina no último mês com os cinco conjuntos presentes; um mês reprovado dentro da janela impede publicar a medida."],
  ["Médias ponderadas", "A média Brasil do preço de venda às distribuidoras pondera o preço de cada região pelo volume vendido nela. Mês sem alguma região fica sem média, em vez de média parcial."],
  ["Moeda", "O preço em reais vira dólar pela PTAX média de venda do mesmo mês (Banco Central, série 3698). Nenhum fator de poder calorífico é aplicado: m³ e MMBtu não são convertidos um no outro."],
  ["Inflação", "Preço corrigido = preço do mês × IPCA acumulado até o mês da base ÷ IPCA acumulado até o mês, com o índice geral. A falta de um mês interrompe o encadeamento e impede calcular valores derivados até a base. A variação acumulada de cada subitem encadeia as variações mensais publicadas pelo IBGE."],
  ["Ausência", "Mês sem dado, mês reprovado numa validação e UF sem pesquisa aparecem como lacuna ou sem dado. Nunca como zero, nunca preenchidos por estimativa."],
];

const VALIDACOES: [string, string][] = [
  ["Balanço da produção", "Reinjeção, queima, consumo próprio e disponível devem somar a produção. Mês sem parcela fica com situação incompleta e sem diferença calculada. Mês com diferença acima de 2% fica sem as parcelas; a diferença dos demais é publicada."],
  ["Mar e terra", "Produção em mar mais produção em terra igual ao total, em todos os meses."],
  ["Participações", "Participação das UFs na produção soma 100%; participação da importação fica entre 0 e 100%."],
  ["Faixa de preço", "Em cada mês, o preço médio do botijão e do GNV fica entre o mínimo e o máximo da própria pesquisa."],
  ["Cobertura da movimentação", "Transportadora relevante sem volume entregue, ou com volume fora de dez vezes a mediana da própria série, deixa o mês sem total de carregadores. Mudança de patamar sem nota da fonte vira anotação na página."],
  ["Ficha completa", "Indicador sem fonte, unidade ou natureza, ou calculado sem fórmula, interrompe a publicação."],
];

const GLOSSARIO: [string, string][] = [
  ["Gás natural", "Mistura de hidrocarbonetos em estado gasoso, sobretudo metano, extraída de reservatórios. Chega ao consumidor por gasoduto ou como GNL."],
  ["Gás associado", "Gás produzido junto com o petróleo, no mesmo reservatório. O conjunto usado aqui não separa a produção associada da não associada."],
  ["GLP", "Gás liquefeito de petróleo, mistura de propano e butano obtida no refino e no processamento do gás natural. É o gás de cozinha do botijão; não é gás natural."],
  ["GNL", "Gás natural liquefeito: resfriado a cerca de 162 graus negativos para ser transportado em navios e regaseificado no destino."],
  ["GNV", "Gás natural veicular: gás natural comprimido vendido em postos para abastecer veículos."],
  ["Gás encanado", "Gás natural entregue por tubulação da distribuidora estadual a residências e comércio. No IPCA, é o subitem gás encanado."],
  ["Reinjeção", "Gás devolvido ao reservatório depois de produzido, por decisão de operação do campo."],
  ["Queima e perda", "Gás queimado em tocha ou perdido nas instalações de produção."],
  ["Consumo próprio", "Gás usado como combustível nas próprias instalações de produção, como plataformas."],
  ["Gás disponível", "Parte da produção que sobra depois de reinjeção, queima e consumo próprio, e segue para processamento e mercado."],
  ["UPGN", "Unidade de processamento de gás natural: separa líquidos e impurezas e entrega gás especificado para a malha."],
  ["Transportadora", "Empresa autorizada pela ANP a operar gasodutos de transporte, de alta pressão, entre as fontes de gás e os pontos de entrega."],
  ["Carregador", "Empresa que contrata capacidade numa transportadora para movimentar gás próprio ou de clientes."],
  ["Distribuidora", "Concessionária estadual do serviço local de gás canalizado. Leva o gás do ponto de entrega da transportadora ao consumidor final."],
  ["Consumidor livre", "Consumidor que, nas condições definidas pelo estado, compra o gás de qualquer vendedor e paga à distribuidora só pelo uso da rede."],
  ["Mercado térmico e não térmico", "Na ANP, térmico é o gás vendido para geração de eletricidade; não térmico, o demais (indústria, comércio, residências, GNV)."],
  ["MMBtu", "Milhão de unidades térmicas britânicas: medida de energia usada nos preços de gás. Preço por MMBtu compara gás de composições diferentes."],
  ["Henry Hub e TTF", "Henry Hub é o preço de referência do gás nos Estados Unidos; TTF, o do mercado virtual dos Países Baixos, referência na Europa."],
  ["FOB", "Valor da mercadoria no porto de embarque, sem frete e seguro internacionais. É o valor de importação do Comex Stat."],
  ["PTAX", "Taxa de câmbio de referência calculada pelo Banco Central. Aqui, a média de venda do mês."],
];

export default function MetodologiaPage() {
  return (
    <>
      <MarcaVisita secao="gas:metodologia" />
      <CabecalhoGas atual="metodologia" />
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas pagina={pagina}>
          <p>
            O Observatório Brasileiro de Gás Natural apresenta indicadores com fonte, período, natureza e fórmula. Não atribui nota, não classifica estados ou
            empresas e não interpreta política. Esta página é aberta; os painéis pedem uma conta gratuita.
          </p>
        </AberturaGas>

        <SecaoGas id="regras" titulo="Regras de cálculo">
          <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {REGRAS.map(([t, d]) => (
              <div key={t} className="border-t border-linha pt-3">
                <dt className="font-serif text-lg text-carvao">{t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </SecaoGas>

        <SecaoGas id="naturezas" titulo="Natureza do dado" subtitulo="As duas naturezas usadas neste observatório, com o mesmo selo do Setor Elétrico. Não há estimativa, previsão nem cenário.">
          <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {(["OBSERVADO", "CALCULADO"] as const).map((n) => (
              <div key={n} className="border-t border-linha pt-3">
                <dt className="text-carvao"><span aria-hidden="true">{NATUREZAS[n].glifo}</span> {NATUREZAS[n].rotulo}</dt>
                <dd className="mt-1 text-sm text-carvao-muted">{NATUREZAS[n].definicao}</dd>
              </div>
            ))}
          </dl>
        </SecaoGas>

        <SecaoGas id="validacoes" titulo="Validações antes de publicar" subtitulo="Executadas pelo código a cada reconstrução da gold (pipeline/gas/validacoes.py).">
          <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {VALIDACOES.map(([t, d]) => (
              <div key={t} className="border-t border-linha pt-3">
                <dt className="font-serif text-lg text-carvao">{t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </SecaoGas>

        <SecaoGas id="limites" titulo="O que os números não permitem afirmar">
          <NotaGas titulo="Limites declarados">
            <p>O preço de venda às distribuidoras já inclui impostos e não é a tarifa do consumidor: a margem da distribuidora entra depois, e a fatura segue regras tarifárias e tributárias de cada estado. Esta base não separa esses componentes.</p>
            <p>A comparação com Henry Hub, TTF e GNL Japão mistura preço com impostos (Brasil) e sem impostos (referências).</p>
            <p>O preço do botijão e do GNV vem de amostra de revendas; mínimo e máximo são extremos da amostra, não limites do mercado.</p>
            <p>O número de carregadores mede quem movimenta gás, não concentração nem preço. Os volumes por transportadora têm quebras não explicadas pela fonte.</p>
            <p>Massa importada (Comex Stat, kg) e volume importado (ANP, m³) medem o mesmo fluxo em unidades diferentes e não são convertidos.</p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="glossario" titulo="Glossário">
          <dl className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            {GLOSSARIO.map(([t, d]) => (
              <div key={t} id={`termo-${t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}`} className="border-t border-linha pt-3">
                <dt className="text-carvao">{t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </SecaoGas>

        <SecaoGas id="referencias" titulo="Outras leituras">
          <ul className="space-y-2 text-sm">
            <li>
              <a href="https://observatoriodogas.fgv.br/" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-gas-dark underline underline-offset-4">
                Observatório do Gás Natural (Movimento Brasil Competitivo, com apoio técnico do FGV CERI)
              </a>
              <span className="text-carvao-muted"> · painéis sobre abertura do mercado, comercialização, transporte, distribuição e regulação estadual.</span>
            </li>
            <li>
              <a href="https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-gas-dark underline underline-offset-4">
                Dados abertos da ANP
              </a>
              <span className="text-carvao-muted"> · origem da maior parte dos conjuntos deste observatório.</span>
            </li>
          </ul>
        </SecaoGas>
      </main>
    </>
  );
}
