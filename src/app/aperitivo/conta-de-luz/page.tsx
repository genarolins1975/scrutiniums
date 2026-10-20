import type { Metadata, ResolvingMetadata } from "next";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { ContaLuzNaMinhaCidade, type DistribuidoraAperitivo } from "@/components/energia/ContaLuzNaMinhaCidade";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { Footer } from "@/components/layout/Footer";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { infoDasDistribuidoras } from "@/app/setor-eletrico/conta-de-luz/dados";
import { mesCorrenteBrasilia } from "@/lib/energia/bandeira-do-mes";
import { linhasEvolucao, resumoSerieReal, rotuloDistribuidora } from "@/lib/energia/conta";
import { dataBR, mesAno } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import { integra, lerGold } from "@/lib/energia/gold";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import type { ContaGold } from "@/lib/energia/tipos-conta";

/**
 * Versão aperitivo da Conta de luz (princípio do aperitivo, decisão do dono de 20/10/2026). Quem acessa
 * /setor-eletrico/conta-de-luz sem sessão recebe esta página por rewrite do middleware, no mesmo endereço; quem tem
 * sessão recebe a página completa (src/app/setor-eletrico/conta-de-luz/page.tsx), sem mudança. Por isso o canonical e o
 * convite apontam o endereço público, nunca este caminho interno.
 *
 * Só o aperitivo: a pergunta da cidade, a estimativa mensal sem tributos para a distribuidora escolhida (a mesma função do
 * simulador completo), a bandeira do mês, a data da tarifa, a fonte e a ressalva. Ranking, mediana, composição, série,
 * simulador completo, reajustes, auditoria e downloads ficam no painel com conta, listados no convite do fim.
 */

const ROTA_PUBLICA = "/setor-eletrico/conta-de-luz";

export const dynamic = "force-static";

export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia(
    ROTA_PUBLICA,
    {
      // fora da casca do Setor Elétrico, o título leva o nome do observatório por inteiro, como o da página completa
      title: {
        absolute: tx(
          "Conta de luz: quanto custa na minha cidade? · Setor Elétrico · Scrutiniums",
          "Electricity bill: how much does it cost in my city? · Setor Elétrico · Scrutiniums",
        ),
      },
      description: tx(
        "Escolha o município ou a distribuidora e o consumo do mês: estimativa mensal sem tributos com a tarifa residencial homologada pela ANEEL e a bandeira do mês.",
        "Choose the municipality or the distribution utility and the month's consumption: monthly estimate without taxes with the residential tariff ratified by ANEEL and the month's tariff flag.",
      ),
      alternates: { canonical: ROTA_PUBLICA },
    },
    anterior,
  );
}

/**
 * O que o painel completo mostra a mais, seção por seção (regra do dono de 20/10/2026: o convite cobre tudo o que a página com
 * conta oferece, dimensionado pelo próprio dado). Os números vêm da gold; sem gold, a lista fica sem número em vez de inventar.
 */
function comConta(g: ContaGold | null): string[] {
  if (!g) {
    return [
      tx("O ranking das distribuidoras para o mesmo consumo, com a mediana nacional", "The ranking of distribution utilities for the same consumption, with the national median"),
      tx("A série da tarifa corrigida pela inflação e o histórico de cada distribuidora", "The tariff series adjusted for inflation and each distribution utility's history"),
      tx("A composição da tarifa e o simulador completo", "The tariff composition and the full simulator"),
      tx("Reajustes, bandeiras, subsídios, auditoria e arquivos para baixar", "Adjustments, tariff flags, subsidies, audit and files to download"),
    ];
  }
  const t = g.tarifas;
  const ref = dataBR(g.data_referencia);
  const serie = resumoSerieReal(linhasEvolucao(t.evolucao), g.reajustes.comparacao_inflacao?.ultimo_ipca ?? null);
  const inicioArquivo = t.evolucao[0]?.[0] ?? null;
  const primeiraBandeira = g.bandeiras.acionamento[0]?.m ?? null;
  const primeiroSubsidio = g.subsidios.anual[0]?.ano ?? null;
  const sim = g.simulador;
  const itens = [
    tx(
      `O ranking das ${t.resumo.n} distribuidoras com tarifa em ${ref} para o mesmo consumo, com a mediana nacional`,
      `The ranking of the ${t.resumo.n} distribution utilities with a tariff on ${ref} for the same consumption, with the national median`,
    ),
    serie
      ? tx(
          `A mediana da tarifa desde ${mesAno(`${serie.inicio}-01`)}, com e sem a correção pela inflação (IPCA)`,
          `The median tariff since ${mesAno(`${serie.inicio}-01`)}, with and without the inflation adjustment (IPCA)`,
        )
      : null,
    inicioArquivo
      ? tx(
          `A tarifa de cada distribuidora mês a mês desde ${mesAno(`${inicioArquivo}-01`)}, até ${LIMITE_COMPARACAO} lado a lado`,
          `Each distribution utility's tariff month by month since ${mesAno(`${inicioArquivo}-01`)}, up to ${LIMITE_COMPARACAO} side by side`,
        )
      : null,
    tx(
      `Para onde vai o valor da conta: energia, transmissão, rede de distribuição, perdas e encargos, em ${g.composicao.distribuidoras.length} distribuidoras`,
      `Where the bill money goes: energy, transmission, distribution grid, losses and sector charges, at ${g.composicao.distribuidoras.length} distribution utilities`,
    ),
    tx(
      `O simulador completo: ${sim.classes.length} classes (com Tarifa Social e Desconto Social), 3 tipos de ligação, a bandeira à escolha e a memória de cálculo`,
      `The full simulator: ${sim.classes.length} classes (including Tarifa Social and Desconto Social), 3 connection types, the tariff flag of your choice and the calculation breakdown`,
    ),
    tx(
      `Quem ficou fora do ranking: ${t.sem_vigente.length} distribuidoras sem tarifa vigente na data, com o motivo`,
      `Who was left out of the ranking: ${t.sem_vigente.length} distribution utilities without a tariff in force on the date, with the reason`,
    ),
    tx("Os reajustes de cada distribuidora comparados com a inflação", "Each distribution utility's adjustments compared with inflation"),
    primeiraBandeira
      ? tx(`Todas as bandeiras acionadas desde ${mesAno(`${primeiraBandeira}-01`)}`, `Every tariff flag activated since ${mesAno(`${primeiraBandeira}-01`)}`)
      : null,
    primeiroSubsidio
      ? tx(
          `Quanto custam os descontos e benefícios pagos na conta desde ${primeiroSubsidio}, e o orçamento da CDE que os financia`,
          `How much the discounts and benefits paid through the bill have cost since ${primeiroSubsidio}, and the CDE budget that funds them`,
        )
      : null,
    tx(
      `A auditoria (regras conferidas, normas e casos de referência) e ${g.downloads.length} arquivos para baixar`,
      `The audit (rules checked, regulations and reference cases) and ${g.downloads.length} files to download`,
    ),
  ];
  return itens.filter((x): x is string => !!x);
}

export default function ContaDeLuzAperitivo() {
  const g = lerGold<ContaGold>("conta.json");
  const idioma = idiomaEnergia();
  const rota = idioma === "en" ? `/en${ROTA_PUBLICA}` : ROTA_PUBLICA;

  let corpo: React.ReactNode;
  if (!integra(g)) {
    corpo = (
      <Indisponivel
        titulo={tx("Conta de luz indisponível nesta publicação", "Electricity bill unavailable in this publication")}
        motivo={
          g?.motivo ??
          tx(
            "A gold do módulo Conta de luz não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe.",
            "The Electricity bill module gold was not generated or did not pass validation; the last valid publication is kept when there is one.",
          )
        }
      />
    );
  } else {
    const sim = g.simulador;
    const info = infoDasDistribuidoras(sim.distribuidoras.map((d) => d.cnpj));
    // só a tarifa residencial de cada distribuidora com tarifa vigente, em ordem alfabética (a lista serve para escolher, não para comparar)
    const distribuidoras: DistribuidoraAperitivo[] = sim.distribuidoras
      .map((d): DistribuidoraAperitivo => [d.cnpj, d.sigla, d.inicio, d.ato, d.tarifas.residencial?.[0] ?? null, d.tarifas.residencial?.[1] ?? null, info[d.cnpj]?.uf ?? null])
      .sort((a, b) => rotuloDistribuidora(a[1], a[0]).localeCompare(rotuloDistribuidora(b[1], b[0]), "pt-BR"));
    corpo = (
      <ContaLuzNaMinhaCidade
        distribuidoras={distribuidoras}
        regras={sim.regras}
        bandeiraVigente={sim.bandeira_vigente}
        mesDaPagina={mesCorrenteBrasilia()}
        dataReferencia={g.data_referencia}
      />
    );
  }

  return (
    <div className="dominio-energia flex min-h-screen flex-col bg-papel">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-[44px] focus:items-center focus:border focus:border-energia focus:bg-superficie focus:px-4 focus:text-sm focus:text-carvao"
      >
        {tx("Pular para o conteúdo", "Skip to content")}
      </a>
      <CabecalhoEnergia atual="conta-de-luz" comSelo rotaPublica={ROTA_PUBLICA} />
      <MarcaVisita secao="energia:conta-de-luz:aperitivo" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina flex-1 pb-6 pt-8 sm:pt-12">
        <p className="rotulo text-mineral">{tx("Setor Elétrico · Conta de luz", "Setor Elétrico · Electricity bill")}</p>
        <h1 className="ed-h1 mt-2 max-w-[22ch] font-serif text-carvao">{tx("Quanto custa a conta de luz na minha cidade?", "How much does the electricity bill cost in my city?")}</h1>
        <p className="mt-3 max-w-prose2 text-base leading-relaxed text-carvao-muted">
          {tx(
            "Cada distribuidora cobra pela energia e pelo uso da rede a tarifa que a ANEEL homologa para a sua área. Escolha o município ou a distribuidora e informe o consumo do mês: a página estima quanto isso custa, antes dos tributos.",
            "Each distribution utility charges for energy and grid use the tariff that ANEEL ratifies for its area. Choose the municipality or the distribution utility and enter the month's consumption: the page estimates what it costs, before taxes.",
          )}
        </p>
        <div className="mt-8">{corpo}</div>
        <ConviteAperitivo rota={rota} comConta={comConta(integra(g) ? g : null)} className="mt-10" />
      </main>
      <Footer compacto />
    </div>
  );
}
