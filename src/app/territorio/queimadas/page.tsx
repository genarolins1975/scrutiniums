import type { Metadata } from "next";
import Link from "next/link";
import { lerQueimadas, recorte, NOME_UF } from "@/lib/territorio/queimadas";
import { BarrasComparadas, DoSateliteAoFoco, Figura, MesAMes, SerieAnual, TabelaAnual, TabelaMensal, TabelaUF, dataBr, mesAno, n } from "@/components/territorio/Queimadas";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Queimadas e focos de calor",
  description: "Focos de calor do satélite de referência do INPE desde 2003, o ano em curso contra o mesmo período do ano anterior, estados e biomas, e a área queimada mapeada.",
};

const FONTE = "INPE, Programa Queimadas, satélite de referência AQUA_M-T";

/**
 * Painel de queimadas do Observatório do Território e Clima: pergunta, números de
 * escala com fonte e período, série anual comparável (satélite de referência), ano em
 * curso contra o mesmo período, estados e biomas, área queimada provisória, modelo
 * didático do que um foco é e método recolhido. Tudo lido de public/territorio/gold.
 */
export default function PaginaQueimadas() {
  const g = lerQueimadas();
  const c = g.comparacao;
  const fechados = g.anual.filter((a) => !a.parcial && a.focos !== null);
  const ultimo = fechados[fechados.length - 1];
  const parcial = g.anual.find((a) => a.parcial);
  const atual = recorte(g, "acumuladoAnoCorrente");
  const anterior = recorte(g, "mesmoPeriodoAnoAnterior");
  const anoCompleto = recorte(g, "ultimoAnoCompleto");
  const biomaLider = atual?.porBioma?.[0];
  const aq = g.areaQueimada;
  const aqFechado = aq?.anual.filter((a) => !a.parcial).at(-1);
  // o ano parcial da tabela é o mais recente (a série também começa parcial, em set/2002)
  const aqParcial = aq?.anual.filter((a) => a.parcial && aqFechado && a.ano > aqFechado.ano).at(-1);
  const aqUltimoMes = aqParcial ? aq?.mensal.filter((m) => m.mes.startsWith(String(aqParcial.ano))).at(-1)?.mes : undefined;
  const periodoAtual = c ? `${mesAno(c.periodoAtual.inicio)} a ${mesAno(c.periodoAtual.fim)}` : null;
  const periodoAnterior = c ? `${mesAno(c.periodoAnterior.inicio)} a ${mesAno(c.periodoAnterior.fim)}` : null;

  const ufs = (atual?.porUF ?? []).filter((u) => NOME_UF[u.id]).map((u) => ({
    id: u.id,
    atual: u.focos,
    anterior: anterior?.porUF?.find((x) => x.id === u.id)?.focos ?? null,
    anoCompleto: anoCompleto?.porUF?.find((x) => x.id === u.id)?.focos ?? null,
  }));
  const biomas = (atual?.porBioma ?? []).map((b) => ({ id: b.id, atual: b.focos, anterior: anterior?.porBioma?.find((x) => x.id === b.id)?.focos ?? null }));
  const semUF = (atual?.porUF ?? []).filter((u) => !NOME_UF[u.id]);

  const numeros = [
    { rotulo: `Focos de calor em ${ultimo.ano}`, valor: n(ultimo.focos as number), unidade: "focos", periodo: ultimo.preliminar ? `${ultimo.ano}, preliminar: o consolidado anual do INPE ainda não saiu` : `${ultimo.ano}, ano fechado`, nota: "Satélite de referência; é o número comparável entre anos." },
    c && { rotulo: `Focos de ${periodoAtual}`, valor: n(c.focosAtual), unidade: "focos", periodo: `${c.variacaoPct > 0 ? "+" : "−"}${n(Math.abs(c.variacaoPct), 1)}% sobre ${periodoAnterior}`, nota: "Ano em curso, preliminar: o INPE pode regerar os arquivos mensais." },
    biomaLider && atual && { rotulo: `Bioma com mais focos em ${periodoAtual ?? "o ano em curso"}`, valor: biomaLider.id, unidade: `${n(biomaLider.focos)} focos`, periodo: `${n((100 * biomaLider.focos) / (atual.focos as number), 1)}% do total do período`, nota: "Bioma atribuído pelo INPE a cada foco." },
    aqFechado && { rotulo: `Área queimada mapeada em ${aqFechado.ano}`, valor: n(aqFechado.totalKm2), unidade: "km²", periodo: `${aqFechado.ano}, produto provisório`, nota: "Outra medida, de outro produto do INPE (AQ1km): não se compara com a contagem de focos." },
  ].filter(Boolean) as { rotulo: string; valor: string; unidade: string; periodo: string; nota: string }[];

  return (
    <main className="bg-papel">
      <section aria-labelledby="queimadas-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-12 pt-10 md:pb-14 md:pt-14">
          <nav aria-label="Trilha" className="text-sm text-carvao-muted">
            <Link href="/observatorios/territorio-e-clima" className="underline decoration-linha underline-offset-4 hover:text-carvao">Território e Clima</Link>
            <span aria-hidden="true" className="mx-2 text-mineral">/</span>
            <span aria-current="page">Fogo e queimadas</span>
          </nav>
          <p className="rotulo mt-8 flex items-center gap-3 text-mineral"><span aria-hidden="true" className="h-[3px] w-8 bg-obee" />Fogo e queimadas</p>
          <h1 id="queimadas-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]">
            Onde e quanto o fogo aparece no Brasil?
          </h1>
          <p className="mt-6 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
            Focos de calor detectados pelo satélite de referência do INPE desde 2003, o ano em curso comparado ao mesmo período do
            ano anterior, os estados e os biomas, e a área queimada mapeada.
          </p>
          <dl className="mt-10 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
            {numeros.map((x) => (
              <div key={x.rotulo} className="flex flex-col bg-papel p-5">
                <dt className="text-sm leading-snug text-carvao-muted">{x.rotulo}</dt>
                <dd className="mt-2">
                  <span className="font-label text-[2rem] leading-none tabular-nums text-carvao">{x.valor}</span>{" "}
                  <span className="text-sm text-carvao-muted">{x.unidade}</span>
                </dd>
                <dd className="mt-2 text-xs leading-relaxed text-mineral">{x.periodo}</dd>
                <dd className="mt-3 border-l-2 border-linha pl-3 text-xs leading-relaxed text-carvao-muted">{x.nota}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 max-w-prose2 border-l-2 border-obee pl-3 text-sm leading-relaxed text-carvao">
            Foco de calor não é incêndio nem área queimada: é um pixel de cerca de 1 km com fogo ativo na passagem do satélite. Serve
            para comparar tendência entre anos e lugares, sempre com o mesmo satélite.
          </p>
        </div>
      </section>

      <section aria-labelledby="serie-titulo" className="mx-auto max-w-page space-y-12 px-6 py-12 md:py-14">
        <h2 id="serie-titulo" className="sr-only">Quanto o fogo variou ao longo do tempo</h2>
        <Figura
          id="anual"
          titulo="Os focos de cada ano desde 2003"
          subtitulo={`Focos de calor por ano, Brasil, satélite de referência. ${parcial ? `* ${parcial.ano} é parcial, até ${parcial.ultimoDia ? dataBr(parcial.ultimoDia) : "a captura"}, e não se compara com anos fechados.` : ""}`}
          fonte={<>{FONTE}, arquivos anuais consolidados; ano em curso pelos arquivos mensais filtrados para o mesmo satélite. Capturado em {dataBr(g.capturadoEm)}.</>}
          tabela={<TabelaAnual g={g} />}
        >
          <SerieAnual g={g} />
        </Figura>

        <Figura
          id="mensal"
          titulo="Mês a mês, este ano e o anterior"
          subtitulo="Focos de calor por mês, Brasil, satélite de referência. Os meses de agosto a outubro concentram o fogo na maior parte do país."
          fonte={<>{FONTE}. O mês em curso é parcial; arquivos mensais recentes podem ser regerados pelo INPE.</>}
          tabela={<TabelaMensal g={g} />}
        >
          <MesAMes g={g} />
        </Figura>
      </section>

      <section aria-labelledby="onde-titulo" className="border-t border-linha">
        <div className="mx-auto max-w-page px-6 py-12 md:py-14">
          <h2 id="onde-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Onde o fogo aparece</h2>
          <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            {periodoAtual ? `De ${periodoAtual}, comparado aos mesmos meses de ${periodoAnterior?.slice(-4)}.` : "Ano em curso."} Estado e bioma vêm da própria
            fonte. Estados maiores tendem a ter mais focos: a contagem não está dividida pela área.
          </p>
          <div className="mt-8 grid gap-12 lg:grid-cols-2">
            <Figura
              id="biomas"
              titulo="Por bioma"
              subtitulo={`Focos de calor, ${periodoAtual ?? "ano em curso"}; o traço marca os mesmos meses do ano anterior.`}
              fonte={<>{FONTE}.</>}
              tabela={
                <table className="w-full min-w-[320px] text-sm"><thead><tr><th className="border-b border-linha px-3 py-2 text-left font-medium">Bioma</th><th className="border-b border-linha px-3 py-2 text-right font-medium">{periodoAtual}</th><th className="border-b border-linha px-3 py-2 text-right font-medium">{periodoAnterior}</th></tr></thead>
                  <tbody>{biomas.map((b) => <tr key={b.id}><td className="border-b border-linha px-3 py-2">{b.id}</td><td className="border-b border-linha px-3 py-2 text-right tabular-nums">{n(b.atual)}</td><td className="border-b border-linha px-3 py-2 text-right tabular-nums">{b.anterior === null ? "" : n(b.anterior)}</td></tr>)}</tbody></table>
              }
            >
              <BarrasComparadas linhas={biomas} rotuloAtual={periodoAtual ?? "Ano em curso"} rotuloAnterior={periodoAnterior ?? "Ano anterior"} />
            </Figura>
            <Figura
              id="ufs-top"
              titulo="Os dez estados com mais focos"
              subtitulo={`Focos de calor, ${periodoAtual ?? "ano em curso"}; o traço marca os mesmos meses do ano anterior.`}
              fonte={<>{FONTE}. Todos os estados na tabela abaixo.</>}
              tabela={<TabelaUF g={g} linhas={ufs.slice(0, 10)} />}
            >
              <BarrasComparadas linhas={ufs.slice(0, 10)} rotuloAtual={periodoAtual ?? "Ano em curso"} rotuloAnterior={periodoAnterior ?? "Ano anterior"} nome={(id) => NOME_UF[id] ?? id} />
            </Figura>
          </div>
          <div className="mt-12 border-t border-linha pt-6">
            <h3 className="font-serif text-xl leading-snug text-carvao">Todos os estados</h3>
            <p className="mt-1 text-sm text-carvao-muted">Focos de calor do satélite de referência, ordenados pelo período mais recente.</p>
            <div className="mt-4 overflow-x-auto"><TabelaUF g={g} linhas={ufs} /></div>
            {semUF.length > 0 && <p className="mt-2 text-xs text-mineral">Focos sem estado informado na fonte: {n(semUF.reduce((s, u) => s + u.focos, 0))}, contados no total do Brasil.</p>}
          </div>
        </div>
      </section>

      {aq && aqFechado && (
        <section aria-labelledby="area-titulo" className="border-t border-linha">
          <div className="mx-auto max-w-page px-6 py-12 md:py-14">
            <p className="rotulo text-mineral">Produto provisório do INPE</p>
            <h2 id="area-titulo" className="mt-2 font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">Quanta área queimou</h2>
            <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              Área queimada mapeada pelo INPE em pixels de 1 km (AQ1km, Coleção 2), por bioma. É outra medida, de outro produto: não se
              soma nem se compara com a contagem de focos, e difere de outras estimativas, como a do MapBiomas. O INPE classifica a série
              como provisória.
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-linha px-3 py-2 text-left font-medium text-carvao">Bioma</th>
                    {aq.anual.filter((a) => a.ano >= aqFechado.ano - 2).map((a) => (
                      <th key={a.ano} className="border-b border-linha px-3 py-2 text-right font-medium text-carvao">{a.ano}{a.parcial ? ` (${a.meses} meses)` : ""}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(aqFechado.km2).sort((x, y) => aqFechado.km2[y] - aqFechado.km2[x]).map((b) => (
                    <tr key={b}>
                      <td className="border-b border-linha px-3 py-2 text-carvao">{b}</td>
                      {aq.anual.filter((a) => a.ano >= aqFechado.ano - 2).map((a) => (
                        <td key={a.ano} className="border-b border-linha px-3 py-2 text-right tabular-nums text-carvao">{n(a.km2[b])}</td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="px-3 py-2 font-medium text-carvao">Total</td>
                    {aq.anual.filter((a) => a.ano >= aqFechado.ano - 2).map((a) => (
                      <td key={a.ano} className="px-3 py-2 text-right font-medium tabular-nums text-carvao">{n(a.totalKm2)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-mineral">
              km² de área queimada mapeada. INPE, AQ1km Coleção 2, produto provisório{aqParcial && aqUltimoMes ? `; ${aqParcial.ano} até ${mesAno(aqUltimoMes)}` : ""}. Sem recorte por estado na fonte.
            </p>
          </div>
        </section>
      )}

      <DoSateliteAoFoco />

      <section aria-labelledby="metodo-titulo" className="mx-auto max-w-page px-6 py-12">
        <details className="border-t border-linha pt-4">
          <summary id="metodo-titulo" className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método, fontes e ressalvas</summary>
          <div className="mt-3 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
            <p>
              Fonte: {g.fonte.nome} (<a href={g.fonte.portal} className="underline decoration-linha underline-offset-4">portal de dados abertos</a>). {g.fonte.licenca}
            </p>
            <p>
              Satélite de referência: {g.sateliteReferencia.id} ({g.sateliteReferencia.sensor}), desde {dataBr(g.sateliteReferencia.desde)}. Antes: {g.sateliteReferencia.antes}.
              Unidade: {g.unidade}.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              {g.ressalvas.map((r) => <li key={r}>{r}</li>)}
              {aq?.ressalvas.map((r) => <li key={r}>Área queimada: {r}</li>)}
            </ul>
            <p>
              Captura em {dataBr(g.capturadoEm)}, com data de referência {dataBr(g.dataReferencia)}. Cada arquivo original tem sha256 e tamanho
              registrados ({Object.keys(g.originais).length} arquivos de focos{aq ? " e o arquivo de área queimada" : ""}). Os números são lidos da gold
              publicada pelo pipeline do observatório; quando um mês não tem arquivo na fonte, ele aparece como indisponível, nunca como zero.
            </p>
            <p>
              <a href="/territorio/gold/queimadas.json" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Baixar os dados deste painel (JSON)</a>
            </p>
          </div>
        </details>
      </section>
    </main>
  );
}
