import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { FaixaMedidas, MedidaGas, NotaGas, SecaoGas } from "@/components/gas/Blocos";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas } from "@/lib/gas/gold";
import { carimbo, mesExtenso, num, periodoLegivel } from "@/lib/gas/formato";
import { GRUPOS_GAS, PAGINAS_GAS } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "Observatório Brasileiro de Gás Natural · Scrutiniums" },
  description:
    "Quanto gás o Brasil produz, quanto chega ao mercado, de onde vem o importado e quanto custa em cada elo, do poço ao botijão e ao gás encanado, com fonte, período e fórmula em cada número.",
  alternates: { canonical: "/gas-natural" },
};

type Parte = { id: string; rotulo: string; valor: number; percentual: number; cor: string; href: string };

/** Barra proporcional em milhões de m³/dia: as partes somam a largura da barra; a escala é a mesma nas duas barras. */
function BarraFluxo({ titulo, partes, escala, periodo, totalPublicado, somaPublicada }: { titulo: string; partes: Parte[]; escala: number; periodo: string; totalPublicado: number; somaPublicada: number }) {
  const soma = somaPublicada;
  const total = totalPublicado;
  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-carvao">
        <span>{titulo}</span>
        <span className="text-carvao-muted [font-variant-numeric:tabular-nums]">{num(total, 1)} milhões de m³/dia</span>
      </figcaption>
      <div className="mt-2 flex h-9 w-full overflow-hidden bg-superficie" aria-hidden="true">
        <div className="flex h-full" style={{ width: `${(100 * soma) / escala}%` }}>
          {partes.map((p) => (
            <div key={p.id} className="h-full border-r border-superficie last:border-r-0" style={{ width: `${(100 * p.valor) / soma}%`, background: p.cor }} />
          ))}
        </div>
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {partes.map((p) => (
          <li key={p.id} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0" style={{ background: p.cor }} />
            <span>
              <Link href={p.href} prefetch={false} className="text-carvao underline decoration-linha underline-offset-4 hover:decoration-gas">{p.rotulo}</Link>
              <span className="block text-carvao-muted [font-variant-numeric:tabular-nums]">
                {num(p.valor, 1)} milhões de m³/dia · {num(p.percentual, 1)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
      {totalPublicado !== undefined && Math.abs(soma - totalPublicado) >= 0.05 && (
        <p className="mt-2 text-xs leading-relaxed text-mineral">
          A soma das parcelas é {num(soma, 1)} milhões de m³/dia e a produção publicada, {num(totalPublicado, 1)}: os conjuntos da ANP não fecham
          exatamente, como mostra a página <Link href="/gas-natural/aproveitamento#conferencia" className="underline underline-offset-2">Aproveitamento</Link>.
        </p>
      )}
      <p className="sr-only">Média de {periodo}.</p>
    </figure>
  );
}

export default function InicialGasPage() {
  const prod = goldGas.producao();
  const ap = goldGas.aproveitamento();
  const imp = goldGas.importacao();
  const pr = goldGas.precos();
  const glp = goldGas.glp();
  const gnv = goldGas.gnv();
  const merc = goldGas.mercado();
  const meta = goldGas.meta();

  // a produção do fluxo é a da janela do aproveitamento (últimos 12 meses com os cinco conjuntos da ANP publicados)
  const p12 = ap.indicadores.producao_mmd_12m.valor as number | null;
  const fr = (k: string) => ap.indicadores[`${k}_mmd_12m`].valor as number;
  const pct = (k: string) => ap.indicadores[k].valor as number;
  const somaParcelas = ap.indicadores.soma_parcelas_mmd_12m.valor as number;
  const totalOferta = imp.indicadores.oferta_12m.valor as number;
  const disponivel = ap.indicadores.disponivel_mmd_12m.valor as number;
  const importado = imp.indicadores.importado_12m.valor as number;
  const periodo = periodoLegivel(ap.indicadores.producao_mmd_12m.periodo);
  const mesmaJanela = ap.indicadores.producao_mmd_12m.periodo === imp.indicadores.importado_12m.periodo;

  const producao: Parte[] = [
    { id: "reinjecao", rotulo: "Reinjetado nos reservatórios", valor: fr("reinjecao"), percentual: pct("reinjecao"), cor: "var(--serie-comp-1)", href: "/gas-natural/aproveitamento" },
    { id: "consumo", rotulo: "Consumido nas plataformas", valor: fr("consumo_proprio"), percentual: pct("consumo_proprio"), cor: "var(--serie-comp-3)", href: "/gas-natural/aproveitamento" },
    { id: "queima", rotulo: "Queimado ou perdido", valor: fr("queima"), percentual: pct("queima"), cor: "var(--serie-comp-2)", href: "/gas-natural/aproveitamento" },
    { id: "disponivel", rotulo: "Disponível para o mercado", valor: disponivel, percentual: pct("disponivel"), cor: "var(--cor-gas)", href: "/gas-natural/aproveitamento" },
  ];
  const oferta: Parte[] = [
    { id: "disponivel", rotulo: "Disponível da produção nacional", valor: disponivel, percentual: imp.indicadores.disponivel_participacao_12m.valor as number, cor: "var(--cor-gas)", href: "/gas-natural/aproveitamento" },
    { id: "importado", rotulo: "Importado por gasoduto e GNL", valor: importado, percentual: imp.indicadores.participacao_12m.valor as number, cor: "var(--escala-gas-3)", href: "/gas-natural/importacao" },
  ];

  const fluxoCompleto = mesmaJanela && [p12, somaParcelas, totalOferta].every((v) => typeof v === "number" && Number.isFinite(v) && v > 0) && [...producao, ...oferta].every((x) => Number.isFinite(x.valor) && Number.isFinite(x.percentual));
  const escala = fluxoCompleto ? Math.max(p12!, somaParcelas, totalOferta) : 1;
  return (
    <>
      <MarcaVisita secao="gas:inicial" />
      <CabecalhoGas atual="inicial" />
      <main id="conteudo" className="ed-pagina pb-12">
        <div className="cab-modulo">
          <p className="rotulo text-gas-dark">Observatório Brasileiro de Gás Natural</p>
          <h1 className="ed-h1 mt-3 max-w-4xl font-serif text-carvao">Do poço ao consumidor: quanto gás o Brasil tem, usa e paga</h1>
          <div className="ed-lead mt-4 max-w-prose2 space-y-3 text-carvao-muted">
            <p>
              Produção, aproveitamento, importação, preços na cadeia, botijão, GNV e transporte, em páginas que respondem a uma pergunta cada. Os números vêm de{" "}
              {meta.fontes.length} conjuntos de dados abertos da ANP, do IBGE, do Banco Central, do Comex Stat e do Banco Mundial, com fonte, período e fórmula ao lado.
            </p>
          </div>
        </div>

        <SecaoGas
          id="fluxo"
          titulo="O que acontece com o gás produzido"
          subtitulo={<>Milhões de m³ por dia, média de {periodo}. A mesma escala nas duas barras: a de baixo soma o que sobrou da produção nacional ao gás importado.</>}
        >
          {fluxoCompleto ? (
            <>
              <BarraFluxo titulo="Produção nacional" partes={producao} escala={escala} periodo={periodo} totalPublicado={p12!} somaPublicada={somaParcelas} />
              <BarraFluxo titulo="Importado mais disponível nacional" partes={oferta} escala={escala} periodo={periodo} totalPublicado={totalOferta} somaPublicada={totalOferta} />
            </>
          ) : (
            <p className="text-sm text-carvao-muted">Composição indisponível: as janelas diferem ou falta um valor válido nos conjuntos da ANP. Os detalhes estão em Aproveitamento e Importação.</p>
          )}
          <p className="max-w-prose2 text-xs leading-relaxed text-mineral">
            Fonte: ANP, produção, reinjeção, queima, consumo próprio, gás disponível e importação de gás natural. Médias diárias dos 12 meses calculadas pela
            Scrutiniums{mesmaJanela ? "" : "; produção e importação em janelas diferentes, ver cada página"}.
          </p>
          <NotaGas>
            <p>
              Oferta aqui é volume, antes do processamento. Parte do gás disponível é consumida e convertida em líquidos, como o GLP, nas unidades de processamento.
              Para onde o gás vai depois, por mercado, está em <Link href="/gas-natural/precos#mercados" className="text-gas-dark underline underline-offset-4">Preços na cadeia</Link>.
            </p>
          </NotaGas>
        </SecaoGas>

        <SecaoGas id="numeros" titulo="Números para começar" subtitulo="O valor mais recente de cada página, com período e natureza. A fórmula fica em Como este número é obtido.">
          <FaixaMedidas>
            <MedidaGas ind={prod.indicadores.producao_mes} />
            <MedidaGas ind={glp.indicadores.medio_mes} casas={2} rotulo="Botijão de 13 kg, preço médio" />
            <MedidaGas ind={gnv.indicadores.medio_mes} casas={2} rotulo="GNV, preço médio" />
            <MedidaGas ind={merc.indicadores.carregadores_mes} casas={0} />
          </FaixaMedidas>
          {pr.indicadores.brasil_usd_mes && (
            <FaixaMedidas>
              <MedidaGas ind={pr.indicadores.brasil_usd_mes} casas={2} rotulo="Gás vendido às distribuidoras, em dólar" />
              <MedidaGas ind={pr.indicadores.henry_hub_mes} casas={2} />
              <MedidaGas ind={pr.indicadores.ttf_mes} casas={2} />
              <MedidaGas ind={imp.indicadores.participacao_12m} rotulo="Importado na oferta, 12 meses" />
            </FaixaMedidas>
          )}
        </SecaoGas>

        <SecaoGas id="perguntas" titulo="Por onde começar" subtitulo="Cada página responde a uma pergunta. Os grupos seguem o caminho do gás.">
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {GRUPOS_GAS.map((g) => (
              <div key={g.id}>
                <h3 className="rotulo text-gas-dark">{g.rotulo}</h3>
                <ul className="mt-2">
                  {PAGINAS_GAS.filter((p) => p.grupo === g.id).map((p) => (
                    <li key={p.slug} className="border-t border-linha py-3">
                      <Link href={p.href} prefetch={false} className="font-serif text-lg leading-snug text-carvao underline decoration-linha underline-offset-4 hover:decoration-gas">
                        {p.pergunta}
                      </Link>
                      <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{p.descricao}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SecaoGas>

        <SecaoGas id="atualidade" titulo="Até quando vão os dados" subtitulo="Cada fonte tem calendário próprio; as páginas mostram o período de cada número.">
          <ul className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
            <li className="border-t border-linha pt-2"><span className="text-carvao">Produção (ANP):</span> <span className="text-carvao-muted">até {mesExtenso(prod.ultimo_mes)}</span></li>
            <li className="border-t border-linha pt-2"><span className="text-carvao">Preço do botijão (ANP):</span> <span className="text-carvao-muted">até {mesExtenso(glp.ultimo_mes)}</span></li>
            <li className="border-t border-linha pt-2"><span className="text-carvao">Aproveitamento (ANP):</span> <span className="text-carvao-muted">até {mesExtenso(ap.ultimo_mes)}</span></li>
            <li className="border-t border-linha pt-2"><span className="text-carvao">Importação (ANP):</span> <span className="text-carvao-muted">até {mesExtenso(imp.ultimo_mes)}</span></li>
            <li className="border-t border-linha pt-2"><span className="text-carvao">Preço do GNV (ANP):</span> <span className="text-carvao-muted">até {mesExtenso(gnv.ultimo_mes)}</span></li>
            <li className="border-t border-linha pt-2"><span className="text-carvao">Venda às distribuidoras (ANP):</span> <span className="text-carvao-muted">até {mesExtenso(pr.ultimo_mes)}</span></li>
            <li className="border-t border-linha pt-2"><span className="text-carvao">Origem das importações (Comex Stat):</span> <span className="text-carvao-muted">até {mesExtenso(imp.ultimo_mes_comex)}</span></li>
            <li className="border-t border-linha pt-2"><span className="text-carvao">IPCA do gás (IBGE):</span> <span className="text-carvao-muted">até {mesExtenso(glp.ipca.ultimo_mes)}</span></li>
            <li className="border-t border-linha pt-2"><span className="text-carvao">Movimentação nos gasodutos (ANP):</span> <span className="text-carvao-muted">até {mesExtenso(goldGas.infraestrutura().ultimo_mes)}</span></li>
          </ul>
          {meta.dados_capturados_em && <p className="text-xs text-mineral">Captura mais recente das fontes: {carimbo(meta.dados_capturados_em)}.</p>}
        </SecaoGas>
      </main>
    </>
  );
}
