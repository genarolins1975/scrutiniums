import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { BotaoLink } from "@/components/home/BotaoLink";
import { LinkEntrarComDestino } from "@/components/home/LinkEntrarComDestino";
import { fmtRefMes, resumoDiario } from "@/lib/dadosPublicos";

/**
 * Vitrine pública do Observatório Brasileiro de Crédito.
 *
 * Com o Observatório aberto para leitura sem cadastro, esta página é a
 * porta de entrada editorial: números reais da última data-base, as
 * perguntas que cada área responde e o que diferencia o Observatório de
 * consultar as fontes primárias — com o convite direto para explorar.
 *
 * Estática por construção (`force-static`): os números vêm dos arquivos gold no
 * momento do build, que o pipeline diário reescreve. Nenhuma consulta em
 * runtime, nenhum dado de usuário, indexável por buscadores.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Observatório Brasileiro de Crédito",
  description:
    "Crédito, instituições financeiras, Pix, juros e litigiosidade em uma plataforma gratuita: dados oficiais do Banco Central, CVM, IBGE e CNJ com metodologia aberta, distinguindo dado observado de indicador calculado.",
  alternates: { canonical: "/observatorio-do-credito" },
  openGraph: {
    title: "Observatório Brasileiro de Crédito",
    description:
      "O mercado de crédito brasileiro explicado com rigor: 12 fontes oficiais, metodologia aberta e gratuito.",
    type: "website",
  },
};

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
function nbr(v: number, dec = 1) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Números-vitrine: cada um sai de um módulo diferente, com fonte e data-base. */
function numerosVivos() {
  const panorama = lerGold("panorama");
  const pix = lerGold("pix");
  const judicial = lerGold("judicial");
  const meta = lerGold("meta");
  const out: { valor: string; rotulo: string; nota: string }[] = [];

  if (panorama?.disponivel) {
    out.push({
      valor: `R$ ${nbr(panorama.kpis.saldo.v / 1e12, 2)} tri`,
      rotulo: "carteira de crédito do país",
      nota: `SCR.data · ${panorama.data_base}`,
    });
    out.push({
      valor: `${nbr(panorama.kpis.inad.v, 1)}%`,
      rotulo: "inadimplência (conceito SCR)",
      nota: `27 estados · ${panorama.data_base}`,
    });
  }
  if (pix?.disponivel) {
    out.push({
      valor: `${nbr(pix.kpis.qtd.v / 1e9, 1)} bi`,
      rotulo: "transações Pix no mês",
      nota: `Banco Central · ${pix.mes}`,
    });
  }
  if (judicial?.disponivel) {
    const n = judicial.camada_nacional.total_civel_casos + judicial.camada_nacional.total_trabalhista_casos;
    out.push({
      valor: `${nbr(n / 1e6, 1)} mi`,
      rotulo: "processos em temas bancários",
      nota: `CNJ/DataJud · ${judicial.camada_nacional.n_tribunais} tribunais`,
    });
  }
  const vintages = meta?.vintages ?? {};
  return { numeros: out.slice(0, 4), vintages };
}

/** As perguntas que o acervo responde — o mesmo catálogo didático da aplicação. */
const AREAS = [
  {
    titulo: "Panorama do crédito",
    pergunta: "Onde está o crédito no Brasil e quem são os tomadores?",
    detalhe:
      "Mapa por estado, faixa de renda, ocupação e produto, a partir dos agregados públicos do SCR. Normalizado por habitante, porque valor absoluto só reproduz o tamanho da população.",
  },
  {
    titulo: "Instituições financeiras",
    pergunta: "Qual a situação de cada banco, e como se comparam?",
    detalhe:
      "Capital, inadimplência, rentabilidade e carteira por instituição e conglomerado, com comparador que bloqueia a mistura de níveis de consolidação.",
  },
  {
    titulo: "Produtos e taxas",
    pergunta: "Quanto custa cada produto, em cada instituição?",
    detalhe:
      "Consignado, cartão, veículos e imobiliário com atraso específico do produto — e as taxas de novas operações por instituição e modalidade.",
  },
  {
    titulo: "Pix e meios de pagamento",
    pergunta: "Como o Pix mudou os pagamentos brasileiros?",
    detalhe:
      "Evolução desde o lançamento, comparação com cartões, TED e boleto, natureza dos fluxos, geografia e o Mecanismo Especial de Devolução.",
  },
  {
    titulo: "Sinais antecedentes",
    pergunta: "Há estresse de crédito se formando agora?",
    detalhe:
      "Endividamento das famílias, garantias imobiliárias, crédito não bancário e judicialização combinados em subíndices, com alertas que exigem persistência.",
  },
  {
    titulo: "Mercado e valor",
    pergunta: "Quanto valem os bancos listados e de onde vem o lucro?",
    detalhe:
      "Preços, proventos e valuation dos bancos em bolsa, com a ponte do lucro reconstruída da DRE da CVM. Nada aqui é recomendação de investimento.",
  },
  {
    titulo: "Apostas e crédito das famílias",
    pergunta: "O que as apostas online fazem com a saúde financeira das famílias?",
    detalhe:
      "GGR, apostadores, autoexclusão e fluxo Pix com hierarquia de evidências A–E: o painel investiga a hipótese em vez de partir da conclusão, e diz onde a evidência termina.",
  },
  {
    titulo: "Fraudes financeiras",
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

  return (
    <>
      <PublicHeaderView />
      <main>
        {/* ---------------- proposta ---------------- */}
        <section aria-labelledby="titulo" className="border-b border-linha bg-marfim">
          <div className="mx-auto max-w-page px-6 pb-16 pt-14 md:pb-20 md:pt-20">
            <p className="rotulo text-mineral">Plataforma pública · gratuita</p>
            <h1
              id="titulo"
              className="mt-6 max-w-4xl font-serif text-[clamp(2.2rem,5.4vw,3.9rem)] leading-[1.07] tracking-[-0.015em] text-carvao"
            >
              Observatório Brasileiro de <span className="text-bronze">Crédito</span>
            </h1>
            <p className="mt-7 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
              O crédito brasileiro está documentado em dezenas de bases oficiais que quase
              ninguém consegue cruzar. O Observatório reúne essas fontes, reconcilia os
              conceitos e explica o que cada número significa — e o que ele não permite
              concluir.
            </p>

            {numeros.length > 0 && (
              <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {numeros.map((n) => (
                  <div key={n.rotulo}>
                    <p className="font-serif text-[2.6rem] leading-none tracking-[-0.02em] text-carvao">
                      {n.valor}
                    </p>
                    <p className="mt-3 text-sm text-carvao-muted">{n.rotulo}</p>
                    <p className="rotulo mt-1 text-mineral">{n.nota}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-4">
              <BotaoLink href="/observatorio">Explorar o Observatório — aberto, sem cadastro</BotaoLink>
              <LinkEntrarComDestino className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-bronze" />
              <Link
                href="/resumo"
                className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
              >
                Ver o resumo diário
              </Link>
            </div>
          </div>
        </section>

        {/* ---------------- perguntas que responde ---------------- */}
        <section aria-labelledby="areas" className="border-b border-linha bg-papel">
          <div className="mx-auto max-w-page px-6 py-16 md:py-20">
            <h2 id="areas" className="font-serif text-3xl tracking-[-0.012em] text-carvao">
              O que dá para responder aqui
            </h2>
            <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Cada área do Observatório existe para responder a uma pergunta concreta, e
              declara na própria página como ler os dados e onde termina a conclusão possível.
            </p>
            <div className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {AREAS.map((a) => (
                <article key={a.titulo}>
                  <p className="rotulo text-bronze">{a.titulo}</p>
                  <h3 className="mt-3 font-serif text-lg leading-snug text-carvao">{a.pergunta}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{a.detalhe}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- diagnóstico do dia (prova concreta) ---------------- */}
        {r && (
          <section aria-labelledby="hoje" className="border-b border-linha bg-marfim">
            <div className="mx-auto max-w-page px-6 py-16 md:py-20">
              <h2 id="hoje" className="font-serif text-3xl tracking-[-0.012em] text-carvao">
                O diagnóstico de hoje
              </h2>
              <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao">{r.frase}</p>
              <p className="rotulo mt-6 text-mineral">
                Frase montada por regras determinísticas sobre as séries oficiais — nunca texto
                livre. Atualizada a cada execução do pipeline.
              </p>
              <p className="mt-8">
                <Link
                  href="/resumo"
                  className="rotulo inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-8 transition-colors hover:text-bronze"
                >
                  Ler o resumo completo
                </Link>
              </p>
            </div>
          </section>
        )}

        {/* ---------------- por que não é só o IF.data ---------------- */}
        <section aria-labelledby="metodo" className="border-b border-linha bg-papel">
          <div className="mx-auto max-w-page px-6 py-16 md:py-20">
            <h2 id="metodo" className="font-serif text-3xl tracking-[-0.012em] text-carvao">
              O que muda em relação a consultar as fontes direto
            </h2>
            <div className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2">
              {DIFERENCAS.map((d) => (
                <article key={d.t}>
                  <h3 className="font-serif text-lg leading-snug text-carvao">{d.t}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{d.d}</p>
                </article>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3">
              <Link href="/observatorio/methodology" className="rotulo text-carvao underline decoration-linha underline-offset-8 hover:text-bronze">
                Metodologia e fontes
              </Link>
              <Link href="/glossario" className="rotulo text-carvao underline decoration-linha underline-offset-8 hover:text-bronze">
                Glossário
              </Link>
              <Link href="/dados" className="rotulo text-carvao underline decoration-linha underline-offset-8 hover:text-bronze">
                Indicadores abertos
              </Link>
            </div>
          </div>
        </section>

        {/* ---------------- atualização e acesso ---------------- */}
        <section aria-labelledby="acesso" className="bg-marfim">
          <div className="mx-auto max-w-page px-6 py-16 md:py-20">
            <h2 id="acesso" className="font-serif text-3xl tracking-[-0.012em] text-carvao">
              Atualizado todos os dias, sem custo
            </h2>
            <p className="mt-6 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              O pipeline roda diariamente e republica a base inteira. Cada fonte tem seu próprio
              calendário — e a plataforma mostra a data-base real de cada uma, em vez de uma data
              única de atualização que esconderia a diferença.
            </p>
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
                Criar conta gratuita
              </Link>
              <span className="rotulo text-mineral">
                leitura aberta, sem cadastro · a conta guarda preferências e a área de painéis
              </span>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
