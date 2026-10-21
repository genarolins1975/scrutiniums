import type { Metadata } from "next";
import { CabecalhoGas } from "@/components/gas/CabecalhoGas";
import { AberturaGas, SecaoGas } from "@/components/gas/Blocos";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { goldGas, type Indicador } from "@/lib/gas/gold";
import { carimbo, num, periodoLegivel } from "@/lib/gas/formato";
import { PAGINAS_GAS, paginaGas } from "@/lib/gas/navegacao";
import { valorComUnidade } from "@/components/gas/Blocos";

export const dynamic = "force-static";

const pagina = paginaGas("dados");

export const metadata: Metadata = {
  title: "Dados e downloads do gás natural",
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

function indicadoresPorPagina(): { slug: string; rotulo: string; href: string; indicadores: [string, Indicador][] }[] {
  const g = goldGas;
  const blocos: [string, Record<string, Indicador>][] = [
    ["producao", g.producao().indicadores],
    ["aproveitamento", g.aproveitamento().indicadores],
    ["importacao", g.importacao().indicadores],
    ["precos", g.precos().indicadores],
    ["gas-de-cozinha", { ...g.glp().indicadores, ...g.glp().ipca.indicadores, ...(g.glp().vendas?.indicadores ?? {}) }],
    ["gnv-e-gas-encanado", g.gnv().indicadores],
    ["mercado", g.mercado().indicadores],
    ["infraestrutura", g.infraestrutura().indicadores],
  ];
  return blocos.map(([slug, inds]) => {
    const p = PAGINAS_GAS.find((x) => x.slug === slug)!;
    return { slug, rotulo: p.rotulo, href: p.href, indicadores: Object.entries(inds) };
  });
}

export default function DadosPage() {
  const meta = goldGas.meta();
  const blocos = indicadoresPorPagina();
  const total = blocos.reduce((s, b) => s + b.indicadores.length, 0);
  return (
    <>
      <MarcaVisita secao="gas:dados" />
      <CabecalhoGas atual="dados" />
      <main id="conteudo" className="ed-pagina pb-12">
        <AberturaGas pagina={pagina} dadosAte={meta.dados_capturados_em ? <>Captura mais recente: {carimbo(meta.dados_capturados_em)}. Versão {meta.versao_pipeline}, {meta.versao_codigo}.</> : undefined}>
          <p>
            {meta.fontes.length} conjuntos de dados abertos alimentam {total} indicadores e {meta.series.length} séries para download. Cada arquivo original é
            guardado no repositório da Scrutiniums com o sha256 do que foi baixado, e qualquer pessoa pode refazer a gold com um comando.
          </p>
          <p className="text-sm">
            Reproduzir: <code className="bg-gas-fundo px-1">python3 -m pipeline.gas.run</code> reconstrói tudo a partir do seed;{" "}
            <code className="bg-gas-fundo px-1">python3 -m pipeline.gas.run --coleta</code> baixa as fontes de novo.
          </p>
        </AberturaGas>

        <SecaoGas id="fontes" titulo="As fontes" subtitulo="Órgão, conjunto, licença, frequência, data da captura e sha256 do arquivo original.">
          <ul className="space-y-0">
            {meta.fontes.map((f) => (
              <li key={f.id} id={`fonte-${f.id}`} className="border-t border-linha py-4">
                <p className="font-serif text-lg leading-snug text-carvao">
                  <a href={f.pagina} rel="noopener noreferrer" className="underline decoration-linha underline-offset-4 hover:decoration-gas">{f.orgao}, {f.conjunto}</a>
                </p>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
                  <dt className="text-mineral">Unidade e frequência</dt><dd className="text-carvao-muted">{f.unidade}; {f.frequencia}</dd>
                  <dt className="text-mineral">Captura</dt><dd className="text-carvao-muted">{f.capturado_em ? carimbo(f.capturado_em) : "não capturado"}</dd>
                  {f.recorte && <><dt className="text-mineral">Recorte guardado</dt><dd className="text-carvao-muted">{f.recorte}</dd></>}
                  {f.arquivos_origem && <><dt className="text-mineral">Arquivos de origem</dt><dd className="text-carvao-muted">{num(f.arquivos_origem, 0)} arquivos mensais, cada um com sha256 no manifesto</dd></>}
                  <dt className="text-mineral">sha256</dt><dd className="break-all font-mono text-xs text-carvao-muted">{f.sha256_original ?? "não registrado"}{f.bytes_original ? ` (${num(f.bytes_original, 0)} bytes)` : ""}</dd>
                  <dt className="text-mineral">Licença</dt><dd className="text-carvao-muted">{f.licenca}</dd>
                  {f.nota && <><dt className="text-mineral">Nota</dt><dd className="text-carvao-muted">{f.nota}</dd></>}
                </dl>
              </li>
            ))}
          </ul>
        </SecaoGas>

        <SecaoGas id="series" titulo="Séries para baixar" subtitulo="CSV com separador ponto e vírgula e vírgula decimal. Campo vazio é ausência, nunca zero.">
          <ul className="space-y-2 text-sm">
            {meta.series.map((s) => (
              <li key={s.id} className="border-t border-linha pt-2">
                <a href={s.arquivo} download className="inline-flex min-h-[44px] items-center text-gas-dark underline underline-offset-4">{s.id}.csv</a>
                <span className="text-carvao-muted"> · {s.descricao} · {num(s.linhas, 0)} linhas</span>
              </li>
            ))}
          </ul>
        </SecaoGas>

        <SecaoGas id="indicadores" titulo="Todos os indicadores publicados" subtitulo="Valor, período, natureza e fórmula de cada número que aparece nas páginas.">
          {blocos.map((b) => (
            <div key={b.slug} className="min-w-0">
              <h3 className="ed-h3 font-serif text-carvao"><a href={b.href} className="underline decoration-linha underline-offset-4 hover:decoration-gas">{b.rotulo}</a></h3>
              <div className="relative mt-2 overflow-x-auto border-y border-linha" tabIndex={0} role="region" aria-label={`Indicadores de ${b.rotulo}`}>
                <table className="w-full min-w-[44rem] border-collapse text-sm [font-variant-numeric:tabular-nums]">
                  <thead>
                    <tr className="border-b border-linha text-left text-carvao-muted">
                      <th scope="col" className="px-2 py-2 font-normal">Indicador</th>
                      <th scope="col" className="px-2 py-2 text-right font-normal">Valor</th>
                      <th scope="col" className="px-2 py-2 font-normal">Período</th>
                      <th scope="col" className="px-2 py-2 font-normal">Natureza</th>
                      <th scope="col" className="px-2 py-2 font-normal">Fórmula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.indicadores.map(([id, ind]) => {
                      const v = valorComUnidade(ind.valor, ind.unidade, typeof ind.valor === "number" && Math.abs(ind.valor) >= 100 ? 1 : 2);
                      return (
                        <tr key={id} className="border-b border-linha align-top last:border-b-0">
                          <th scope="row" className="px-2 py-2 text-left font-normal text-carvao">{ind.rotulo}{ind.recorte ? ` (${ind.recorte})` : ""}</th>
                          <td className="whitespace-nowrap px-2 py-2 text-right text-carvao">{v.valor} {v.unidade}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-carvao-muted">{periodoLegivel(ind.periodo)}</td>
                          <td className="px-2 py-2"><SeloNatureza natureza={ind.natureza} texto /></td>
                          <td className="px-2 py-2 text-xs leading-relaxed text-carvao-muted">{ind.formula ?? "valor publicado pela fonte"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </SecaoGas>
      </main>
    </>
  );
}
