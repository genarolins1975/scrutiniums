import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { NotaGas, numeroDoIndicador } from "@/components/gas/Blocos";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { goldGas } from "@/lib/gas/gold";
import { carimbo, mesExtenso, num, periodoLegivel } from "@/lib/gas/formato";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { destinosDaColecao } from "@/components/observatorios/DestinosDaColecao";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { GRUPOS_GAS, PAGINAS_GAS } from "@/lib/gas/navegacao";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: { absolute: "Gás Natural · Scrutiniums" },
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
  const pg = (slug: string) => PAGINAS_GAS.find((p) => p.slug === slug)!;
  const ind = { prod: prod.indicadores, glp: glp.indicadores, gnv: gnv.indicadores, imp: imp.indicadores, pr: pr.indicadores, merc: merc.indicadores };
  // molde único de entrada (Iniciativa 4 do parecer de UX, 22/10/2026): dos oito números de antes, quatro na escala e quatro nos
  // caminhos, cada um lido da gold da página de destino; o fluxo do gás é o modelo didático; a lista de todas as páginas e o
  // calendário das fontes ficam recolhidos e no método
  return (
    <>
      <MarcaVisita secao="gas:inicial" />
      <header>
        <CabecalhoPlataforma colecao="gas" destinoConta="/gas-natural" />
        <NavegacaoColecao colecao="gas" />
      </header>
      <EntradaColecao
        tipo="colecao"
        rota="/gas-natural"
        acento="gas"
        titulo="De onde vem o gás e quanto ele custa?"
        frase="Produção, aproveitamento, importação, preços, botijão, GNV e transporte, com dados abertos da ANP, do IBGE, do Banco Central, do Comex Stat e do Banco Mundial; fonte, período e fórmula ao lado de cada número."
        frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/gas-natural"]} conteiner="mx-auto max-w-page px-6" />}
        escala={[
          numeroDoIndicador(ind.prod.producao_mes, ind.prod.producao_mes?.rotulo ?? "Produção de gás natural", pg("producao").href, 1),
          numeroDoIndicador(ind.glp.medio_mes, "Botijão de 13 kg, preço médio", pg("gas-de-cozinha").href),
          numeroDoIndicador(ind.gnv.medio_mes, "GNV, preço médio", pg("gnv-e-gas-encanado").href),
          numeroDoIndicador(ind.imp.participacao_12m, "Importado na oferta, 12 meses", pg("importacao").href, 1),
        ]}
        paraVoce={<ParaVoce entrada="/gas-natural" />}
        destinos={destinosDaColecao("gas")}
        artefato={
          <ModeloDidatico
            id="fluxo"
            titulo="O que acontece com o gás produzido"
            descricao={<>Milhões de m³ por dia, média de {periodo}. A mesma escala nas duas barras: a de baixo soma o que sobrou da produção nacional ao gás importado.</>}
            deixaDeFora={[
              "O processamento: parte do gás disponível é consumida e convertida em líquidos, como o GLP, nas unidades de processamento",
              "Para onde o gás vai depois, por mercado, que está em Preços na cadeia",
              "A variação de um mês para outro: as barras são a média dos 12 meses",
            ]}
          >
            <div className="space-y-6">
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
            </div>
          </ModeloDidatico>
        }
        caminhos={[
          { pergunta: pg("mercado").pergunta, resumo: pg("mercado").descricao, href: pg("mercado").href, numero: numeroDoIndicador(ind.merc.carregadores_mes, ind.merc.carregadores_mes?.rotulo ?? "Carregadores", pg("mercado").href, 0) },
          { pergunta: pg("precos").pergunta, resumo: pg("precos").descricao, href: pg("precos").href, numero: numeroDoIndicador(ind.pr.brasil_usd_mes, "Gás vendido às distribuidoras, em dólar", pg("precos").href) },
          { pergunta: "Como o preço daqui se compara ao dos Estados Unidos?", resumo: "A referência Henry Hub ao lado do preço pago pelas distribuidoras, em dólar por milhão de BTU.", href: `${pg("precos").href}#internacional`, numero: numeroDoIndicador(ind.pr.henry_hub_mes, ind.pr.henry_hub_mes?.rotulo ?? "Henry Hub", `${pg("precos").href}#internacional`) },
          { pergunta: "Como o preço daqui se compara ao da Europa?", resumo: "A referência TTF ao lado do preço pago pelas distribuidoras, em dólar por milhão de BTU.", href: `${pg("precos").href}#internacional`, numero: numeroDoIndicador(ind.pr.ttf_mes, ind.pr.ttf_mes?.rotulo ?? "TTF", `${pg("precos").href}#internacional`) },
        ]}
        recolhidos={
          <Recolhido id="perguntas" titulo="Todas as páginas, no caminho do gás" resumo="Da produção ao preço e ao mercado, uma pergunta por página.">
            <p className="max-w-prose2 text-sm text-carvao-muted">Comece pela produção e seus destinos. Depois, acompanhe a oferta e os preços. O botijão contém GLP, um produto diferente do gás natural.</p>
            <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
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
          </Recolhido>
        }
        metodo={
          <div id="atualidade" className="space-y-4">
            <h3 className="font-serif text-xl text-carvao">Até quando vão os dados</h3>
            <p className="text-sm text-carvao-muted">Cada fonte tem calendário próprio; as páginas mostram o período de cada número.</p>
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
            {meta.dados_capturados_em && <p className="text-xs text-mineral">Captura mais recente das fontes: {carimbo(meta.dados_capturados_em)}. Os {meta.fontes.length} conjuntos de dados, com o método e o glossário, estão em <Link href="/gas-natural/metodologia" className="underline underline-offset-2">Método e glossário</Link>.</p>}
          </div>
        }
        frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/gas-natural"]} variante="metodo" />}
      />
    </>
  );
}
