import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { BotaoLink } from "@/components/home/BotaoLink";
import { SeloFrescor } from "@/components/dados/SeloFrescor";
import { ACESSO } from "@/lib/acesso";
import { fmtRefMes, geradoEmPublicado, resumoDiario } from "@/lib/dadosPublicos";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { goldJuros, rotuloModalidade } from "@/lib/credito/juros";
import { janela as janelaJuros, num as numJuros } from "@/lib/credito/formato";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { CircuitoCredito } from "@/components/observatorios/CircuitoCredito";
import { circuitoCredito } from "@/lib/observatorios/entradas/economia";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

/**
 * Vitrine pública da coleção Crédito e sistema financeiro.
 *
 * Com os painéis atrás da conta gratuita, esta página é a vitrine aberta
 * do Crédito e a porta de entrada editorial: números reais da última data-base, as
 * perguntas que cada área responde e o que diferencia o Observatório de
 * consultar as fontes primárias — com o convite direto para explorar.
 *
 * Estática por construção (`force-static`): os números vêm dos arquivos gold no
 * momento do build, que o pipeline diário reescreve. Nenhuma consulta em
 * runtime, nenhum dado de usuário, indexável por buscadores.
 */
export const dynamic = "force-static";

const metadadosOriginais: Metadata = {
  // "Página · Coleção · Scrutiniums" (Iniciativa 1 do parecer de UX, 21/10/2026); o H1 da página muda na Iniciativa 4
  title: "Apresentação · Crédito e sistema financeiro",
  description:
    "Crédito, instituições financeiras, Pix, juros e litigiosidade em uma plataforma gratuita: dados oficiais do Banco Central, CVM, IBGE e CNJ com metodologia declarada, distinguindo dado observado de indicador calculado.",
  alternates: { canonical: "/observatorio-do-credito" },
  openGraph: {
    title: "Crédito e sistema financeiro · Scrutiniums",
    description:
      "O mercado de crédito brasileiro explicado com rigor: fontes oficiais, metodologia declarada e acesso gratuito.",
    type: "website",
  },
};

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/observatorio-do-credito", metadadosOriginais, await parent);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
function lerGold(nome: string): any {
  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), "public", "obs", "data", "gold", `${nome}.json`), "utf-8"),
    );
  } catch {
    return null;
  }
}
/** Selo dos destinos fechados nesta página aberta: a promessa não pode parecer pública. */
function ComConta() {
  return <span className="ml-2 inline-block normal-case tracking-normal text-mineral">com conta</span>;
}

function nbr(v: number, dec = 1) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Números-vitrine da escala: cada um sai de um módulo diferente, com fonte e data-base (o painel de destino lê a mesma gold). */
function numerosVivos(): { numeros: NumeroPorta[]; vintages: Record<string, string> } {
  const panorama = lerGold("panorama");
  const pix = lerGold("pix");
  const judicial = lerGold("judicial");
  const meta = lerGold("meta");
  const out: NumeroPorta[] = [];

  if (panorama?.disponivel) {
    out.push({ rotulo: "Carteira de crédito do país", valor: `R$ ${nbr(panorama.kpis.saldo.v / 1e12, 2)}`, unidade: "trilhões", periodo: panorama.data_base, fonte: "Banco Central, SCR.data", href: "/observatorio/credit-panorama" });
    out.push({ rotulo: "Inadimplência (conceito SCR)", valor: `${nbr(panorama.kpis.inad.v, 1)}%`, unidade: "da carteira", periodo: panorama.data_base, fonte: "Banco Central, SCR.data", nota: "27 estados.", href: "/observatorio/credit-panorama" });
  }
  if (pix?.disponivel) {
    out.push({ rotulo: "Transações Pix no mês", valor: nbr(pix.kpis.qtd.v / 1e9, 1), unidade: "bilhões", periodo: pix.mes, fonte: "Banco Central", href: "/observatorio/pix" });
  }
  if (judicial?.disponivel) {
    const n = judicial.camada_nacional.total_civel_casos + judicial.camada_nacional.total_trabalhista_casos;
    out.push({
      rotulo: "Processos em temas bancários",
      valor: nbr(n / 1e6, 1),
      unidade: "milhões",
      periodo: `acervo coletado em ${String(judicial.coletado_em).slice(0, 10).split("-").reverse().join("/")}`,
      fonte: "CNJ, DataJud",
      nota: `${judicial.camada_nacional.n_tribunais} tribunais.`,
      href: "/observatorio/lawsuits",
    });
  }
  const vintages = meta?.vintages ?? {};
  return { numeros: out.slice(0, 4), vintages };
}

/** Número de cada área nos caminhos, lido da gold do painel da área; área sem número simples fica sem número. */
function numeroDaArea(area: string): NumeroPorta | undefined {
  const juros = goldJuros();
  if (area === "Produtos e taxas" && juros) {
    const pf = juros.modalidades.filter((m) => m.segmento === "PF");
    const maior = [...(pf.length ? pf : juros.modalidades)].sort((a, b) => b.stats.n - a.stats.n)[0];
    return { rotulo: `Taxa mediana: ${rotuloModalidade(maior.modalidade).toLowerCase()}`, valor: `${numJuros(maior.stats.mediana)}%`, unidade: "ao ano", periodo: `semana de ${janelaJuros(maior.janela)}`, fonte: "Banco Central", href: "/observatorio/interest-rates" };
  }
  if (area === "Instituições financeiras") {
    const g = lerGold("institutions");
    if (g?.instituicoes?.length) return { rotulo: "Instituições comparadas", valor: String(g.instituicoes.length), unidade: "instituições", periodo: `${String(g.anomes).slice(4)}/${String(g.anomes).slice(0, 4)}`, fonte: "Banco Central, IF.data", href: "/observatorio/institutions" };
  }
  if (area === "Apostas e crédito das famílias" || area === "Fraudes financeiras") {
    const g = lerGold(area === "Fraudes financeiras" ? "fraudes" : "bets");
    const s = Array.isArray(g?.sintese) ? g.sintese[0] : null;
    if (s) return { rotulo: s.rotulo, valor: s.exibir, unidade: "", periodo: s.data_ref, fonte: s.fonte, href: area === "Fraudes financeiras" ? "/observatorio/financial-fraud" : "/observatorio/bets-financial-risk" };
  }
  return undefined;
}

/** As perguntas que o acervo responde — o mesmo catálogo didático da aplicação. */
const AREAS = [
  {
    titulo: "Panorama do crédito",
    href: "/observatorio/credit-panorama",
    pergunta: "Onde está o crédito no Brasil e quem são os tomadores?",
    detalhe:
      "Mapa por estado, faixa de renda, ocupação e produto, a partir dos agregados públicos do SCR. Normalizado por habitante, porque valor absoluto só reproduz o tamanho da população.",
  },
  {
    titulo: "Instituições financeiras",
    href: "/observatorio/institutions",
    pergunta: "Qual a situação de cada banco, e como se comparam?",
    detalhe:
      "Capital, inadimplência, rentabilidade e carteira por instituição e conglomerado, com comparador que bloqueia a mistura de níveis de consolidação.",
  },
  {
    titulo: "Produtos e taxas",
    href: "/observatorio/products",
    pergunta: "Quanto custa cada produto, em cada instituição?",
    detalhe:
      "Consignado, cartão, veículos e imobiliário com atraso específico do produto — e as taxas de novas operações por instituição e modalidade.",
  },
  {
    titulo: "Pix e meios de pagamento",
    href: "/observatorio/pix",
    pergunta: "Como o Pix mudou os pagamentos brasileiros?",
    detalhe:
      "Evolução desde o lançamento, comparação com cartões, TED e boleto, natureza dos fluxos, geografia e o Mecanismo Especial de Devolução.",
  },
  {
    titulo: "Sinais antecedentes",
    href: "/observatorio/leading-signals",
    pergunta: "Há estresse de crédito se formando agora?",
    detalhe:
      "Endividamento das famílias, garantias imobiliárias, crédito não bancário e judicialização combinados em subíndices, com alertas que exigem persistência.",
  },
  {
    titulo: "Mercado e valor",
    href: "/observatorio/market",
    pergunta: "Quanto valem os bancos listados e de onde vem o lucro?",
    detalhe:
      "Preços, proventos e valuation dos bancos em bolsa, com a ponte do lucro reconstruída da DRE da CVM. Nada aqui é recomendação de investimento.",
  },
  {
    titulo: "Apostas e crédito das famílias",
    href: "/observatorio/bets-financial-risk",
    pergunta: "O que as apostas online fazem com a saúde financeira das famílias?",
    detalhe:
      "GGR, apostadores, autoexclusão e fluxo Pix com hierarquia de evidências A–E: o painel investiga a hipótese em vez de partir da conclusão, e diz onde a evidência termina.",
  },
  {
    titulo: "Fraudes financeiras",
    href: "/observatorio/financial-fraud",
    pergunta: "Quanto o Brasil perde com golpes, e o que os dados permitem afirmar?",
    detalhe:
      "Perdas reportadas, devoluções via Pix/MED e tipologias — separando dado administrativo oficial de estimativa privada, com a fonte primária de cada número.",
  },
];

const DIFERENCAS = [
  {
    t: "Cada número diz de onde veio",
    d: "Fonte, série, data-base e fórmula acompanham o indicador. Dado observado e indicador calculado têm selos distintos — a plataforma nunca apresenta os dois como a mesma coisa.",
  },
  {
    t: "Ausência não vira zero",
    d: "Quando a fonte não publica, a plataforma diz que não publica. Nenhuma célula vazia é preenchida por estimativa silenciosa, e cada indisponibilidade traz o motivo.",
  },
  {
    t: "Conceitos que parecem iguais são separados",
    d: "Existem três inadimplências diferentes nas bases oficiais brasileiras, com valores distintos. A plataforma mostra qual está sendo usada em cada número, em vez de escolher uma e omitir as outras.",
  },
  {
    t: "As fontes já são públicas — reuni-las é o trabalho",
    d: "Os dados vêm do Banco Central, CVM, IBGE, B3 e CNJ. O valor está em integrá-los, reconciliá-los e explicá-los: cruzar SCR com IF.data, ligar o balanço ao preço em bolsa, separar o que é comparável do que não é.",
  },
];

export default function ObservatorioPublicoPage() {
  const { numeros, vintages } = numerosVivos();
  const r = resumoDiario();
  const geradoEm = geradoEmPublicado();

  // molde único de entrada (Iniciativa 4 do parecer de UX, 22/10/2026), com o título aprovado pelo dono em 22/10/2026: os números
  // vivos na escala, as consultas no "Para você", o circuito do crédito como modelo didático, as áreas como caminhos (link e número
  // da gold de cada uma, quatro à vista e quatro em "Mais perguntas"), o convite do aperitivo à vista; o diagnóstico do dia, o que
  // muda em relação às fontes e a coleta, no método. Sem a fatia de destinos: a taxa por banco e o simulador estão no "Para você",
  // e o painel completo, no convite e nas perguntas (orçamento de comprimento, decisão do dono de 23/10/2026)
  return (
    <>
      <PublicHeaderView />
      <EntradaColecao
        tipo="colecao"
        rota="/observatorio"
        acento="bronze"
        titulo="Onde o crédito cresce, quanto custa e onde o risco aparece?"
        frase="O crédito brasileiro está em dezenas de bases oficiais que quase ninguém consegue cruzar. O Observatório reúne as fontes, reconcilia os conceitos e diz o que cada número permite concluir."
        frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/observatorio-do-credito"]} conteiner="mx-auto max-w-page px-6" />}
        escala={numeros}
        paraVoce={
          <ParaVoce entrada="/observatorio-do-credito" />
        }
        artefato={<CircuitoCredito circuito={circuitoCredito()} recolhido />}
        caminhosAVista={4}
        caminhos={AREAS.map((a) => ({ pergunta: a.pergunta, resumo: a.detalhe, href: a.href, rotulo: a.titulo, numero: numeroDaArea(a.titulo) }))}
        convite={
          <div className="border-b border-linha bg-papel">
          <ConviteAperitivo
            rota="/observatorio"
            className="mx-auto max-w-page px-6"
            comConta={[
              `As ${ABAS_OBSERVATORIO.filter((a) => a.gold).length} áreas com dados do observatório, do crédito por estado e por município aos juros de cada instituição`,
              "Juros por instituição e por modalidade, a comparação entre instituições e o simulador da parcela",
              "Consignado, crédito imobiliário, rural e direcionado, consórcios e o crédito a estados e municípios",
              "Bancos na bolsa, captação, Pix, Open Finance, golpes e fraudes, sanções e reclamações",
              "Sinais antecedentes, cenários, o resumo diário completo e a central de alertas",
            ]}
          />
          </div>
        }
        metodoLargo
        metodo={
          <>
          {r && (
            <div id="hoje" className="space-y-4 pb-10">
              <h3 className="font-serif text-xl text-carvao">O diagnóstico de hoje</h3>
              <p className="max-w-prose2 text-base leading-relaxed text-carvao">{r.frase}</p>
              <p className="rotulo mt-6 text-mineral">
                Frase montada por regras determinísticas sobre as séries oficiais — nunca texto
                livre. Atualizada a cada execução do pipeline.
              </p>
              <p className="mt-8">
                <Link
                  href="/resumo"
                  prefetch={prefetchDoLink("/resumo")}
                  className="rotulo inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
                >
                  Ler o resumo completo
                  <ComConta />
                </Link>
              </p>
            </div>
          )}
          <div id="metodo-credito" className="space-y-4 pb-10">
            <h3 className="font-serif text-xl text-carvao">O que muda em relação a consultar as fontes direto</h3>
            <div className="grid gap-x-10 gap-y-12 md:grid-cols-2">
              {DIFERENCAS.map((d) => (
                <article key={d.t}>
                  <h4 className="font-serif text-lg leading-snug text-carvao">{d.t}</h4>
                  <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{d.d}</p>
                </article>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3">
              <Link
                href="/observatorio-do-credito/metodologia"
                prefetch={prefetchDoLink("/observatorio-do-credito/metodologia")}
                className="rotulo text-carvao underline decoration-linha underline-offset-8 hover:text-bronze"
              >
                Metodologia e fontes
                <SeloComConta href="/observatorio-do-credito/metodologia" idioma="pt" />
              </Link>
              <Link href="/glossario" className="rotulo text-carvao underline decoration-linha underline-offset-8 hover:text-bronze">
                Glossário
              </Link>
              <Link href="/dados" className="rotulo text-carvao underline decoration-linha underline-offset-8 hover:text-bronze">
                Indicadores com definição
                <ComConta />
              </Link>
            </div>
          </div>
          <div id="acesso" className="space-y-4">
            <h3 className="font-serif text-xl text-carvao">Coleta diária, sem custo</h3>
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              O pipeline roda todos os dias e só publica a base inteira quando ela passa nos testes
              de conteúdo; reprovada, a última publicação aprovada segue no ar. Cada fonte tem seu
              próprio calendário, e a plataforma mostra a data-base real de cada uma, em vez de uma
              data única de atualização que esconderia a diferença.
            </p>
            <SeloFrescor geradoEm={geradoEm} className="mt-4" />
            {Object.keys(vintages).length > 0 && (
              <dl className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["sgs", "Banco Central · séries mensais"],
                  ["scr", "SCR · crédito por estado"],
                  ["ifdata", "IF.data · instituições"],
                  ["b3", "B3 · mercado"],
                ]
                  .filter(([k]) => vintages[k])
                  .map(([k, rotulo]) => (
                    <div key={k}>
                      <dt className="rotulo text-mineral">{rotulo}</dt>
                      <dd className="mt-1 text-sm text-carvao">dados até {fmtRefMes(`${vintages[k]}-01`)}</dd>
                    </div>
                  ))}
              </dl>
            )}
            <p className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-4">
              <BotaoLink href="/observatorio">Explorar o Observatório</BotaoLink>
              <Link
                href="/cadastro"
                className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
              >
                {ACESSO.ctaConta}
              </Link>
            </p>
            <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              {ACESSO.leitura} {ACESSO.conta}
            </p>
          </div>
          </>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/observatorio-do-credito"]} variante="metodo" />}
      />
      {/* rodapé compacto, como nas páginas abertas dos outros temas (aperitivos): os mesmos links, sem a coluna de apresentação */}
      <Footer compacto />
    </>
  );
}
