import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Nota, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { Documentos, QuadroLinhas, SubnavPreco } from "@/components/saneamento/PrecoRegulado";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { ROTA } from "@/lib/saneamento/capitulos";
import { ESTUDOS, GLOSSARIO_CONTA, type Estudo } from "@/lib/saneamento/dados/estudos";
import { numero } from "@/lib/saneamento/formato";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Como o regulador chega ao valor da tarifa?",
  description:
    "Dois casos reconstruídos com documentos oficiais: o reajuste contratual da Sabesp (ARSESP) e a revisão periódica da Sanepar (AGEPAR), com receita requerida, custo de capital, base de remuneração e o que foi pedido e reconhecido.",
  alternates: { canonical: `${ROTA}/preco-regulado/formacao` },
};

function Caso({ e }: { e: Estudo }) {
  const sabesp = e.id.startsWith("sabesp");
  return (
    <article aria-labelledby={`caso-${e.id}`} className="mt-12 border-t-2 border-carvao pt-8">
      <p className="rotulo text-obee-dark">
        {e.regulador} · {e.prestador}
      </p>
      <h2 id={`caso-${e.id}`} className="mt-2 max-w-4xl font-serif text-[1.7rem] leading-snug text-carvao md:text-[2rem]">
        {e.titulo}
      </h2>
      <dl className="mt-5 grid grid-cols-1 max-w-5xl gap-x-10 gap-y-3 text-sm md:grid-cols-2">
        <div>
          <dt className="rotulo text-mineral">Modelo</dt>
          <dd className="mt-1 text-carvao">{e.modelo}</dd>
          <dd className="mt-2 leading-relaxed text-carvao-muted">{e.modeloResumo}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Base legal e contratual</dt>
          <dd className="mt-1 text-carvao">{e.baseLegal}</dd>
        </div>
      </dl>

      <h3 className="mt-8 font-serif text-xl text-carvao">Quem propõe, quem aprova e quando</h3>
      <ol className="mt-3 max-w-4xl">
        {e.cronologia.map((c) => (
          <li key={c.quando + c.o_que} className="grid grid-cols-1 gap-x-6 border-t border-linha py-2 text-sm sm:grid-cols-[9rem_1fr]">
            <span className="font-medium tabular-nums text-carvao">{c.quando}</span>
            <span className="text-carvao">
              {c.o_que} <span className="block text-xs text-carvao-muted">{c.fonte}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <QuadroLinhas titulo="Pedido, reconhecido e autorizado" linhas={e.pedidoReconhecido} />
      </div>

      <div className="mt-10 grid max-w-5xl grid-cols-1 gap-10">
        <div>
          <GraficoBarras
            titulo={`${e.receita.titulo} (${sabesp ? "R$ milhões" : "R$/m³"})`}
            dados={e.receita.linhas.map((l, i) => ({ id: String(i), rotulo: l.rotulo, v: l.valor }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: sabesp ? "R$ milhões" : "R$/m³", cor: "var(--cor-obee)" }]}
            unidade={sabesp ? "R$ mi" : "R$/m³"}
            casas={2}
            orientacao="horizontal"
            rotulosValor
          />
          <p className="mt-2 text-xs text-carvao-muted">{e.receita.moeda}.</p>
        </div>
        <QuadroLinhas titulo={e.receita.titulo} legenda={e.receita.moeda} linhas={e.receita.linhas} total={e.receita.total} />
      </div>
      <Nota>{e.receita.nota}</Nota>

      {e.ponte && (
        <div className="mt-8">
          <QuadroLinhas titulo={e.ponte.titulo} linhas={e.ponte.linhas} />
          <Nota>{e.ponte.nota}</Nota>
        </div>
      )}

      <div className="mt-8 grid max-w-5xl grid-cols-1 gap-10">
        <QuadroLinhas titulo="Custo de capital regulatório (WACC) e seus parâmetros" linhas={e.wacc} />
        <QuadroLinhas titulo="Outros parâmetros" linhas={e.outrosParametros} />
      </div>

      <details className="mt-8">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-obee-dark underline underline-offset-4">
          Documentos originais e o que não foi verificado
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
          <Documentos documentos={e.documentos} />
          <ul className="list-disc space-y-1 pl-5 text-sm text-carvao-muted">
            {e.naoVerificado.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </details>
    </article>
  );
}

export default function Pagina() {
  const [a, b] = ESTUDOS;
  const w = (e: Estudo, rot: string) => e.wacc.find((l) => l.rotulo.startsWith(rot))?.valor ?? null;
  return (
    <>
      <Cabecalho atual="preco-regulado/formacao" />
      <MarcaVisita secao="saneamento:preco-formacao" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={5}
          rotuloExtra="5.2"
          titulo="Como o regulador chega ao valor da tarifa?"
          texto={
            <p>
              Dois casos sob modelos distintos. No contrato da Sabesp, regras fixadas na concessão recalculam a tarifa todo ano com custos já
              realizados. Na revisão da Sanepar, o regulador projeta os quatro anos do ciclo e escolhe a tarifa média que paga custos, investimentos
              e capital. Os números são os publicados; nada foi estimado.
            </p>
          }
          recorte={<>ARSESP, 1º reajuste do Contrato 01/2024 (vigência em 01/01/2026); AGEPAR, 3ª Revisão Tarifária Periódica (vigência em 17/05/2025).</>}
        />
        <SubnavPreco atual="formacao" />

        <Secao id="comparacao" titulo="Os dois modelos lado a lado" texto="Leitura descritiva. Os valores têm datas-base, perímetros e moedas próprios: não se comparam diretamente.">
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Comparação entre os modelos (rolável)">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">Comparação descritiva dos dois casos</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Dimensão</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{a.prestador.split(" ")[0]} / {a.regulador}</th>
                  <th scope="col" className="py-2 font-medium">{b.prestador} / {b.regulador}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Método", "Blocos de custo com dados realizados, recalculados todo ano", "Fluxo de caixa descontado prospectivo para 4 anos"],
                  ["Custo de capital real antes de impostos", `${numero(w(a, "WACC real antes"), 2)}%, fixo no contrato para o 1º ciclo`, `${numero(w(b, "WACC real antes"), 2)}%, definido na revisão`],
                  ["Custo de capital real depois de impostos", `${numero(w(a, "WACC real depois"), 2)}%`, `${numero(w(b, "WACC real depois"), 2)}%`],
                  ["Fator X", "0,89% ao ano (contrato)", "0% (neutralizado na revisão)"],
                  ["Inadimplência reconhecida", "1,65% fixo", "0,6574%"],
                  ["Pleitos e ajustes", "Reconhecimento provisório de 40% de três pleitos", "Ajustes extraordinários de R$ 617,4 mi na revisão"],
                  ["Tarifas resultantes", "Equilíbrio e aplicação (vale a menor; diferença coberta por fundo)", "Tarifa média única por ciclo"],
                ].map(([d, x, y]) => (
                  <tr key={d} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao-muted">{d}</th>
                    <td className="py-2 pr-4 text-carvao">{x}</td>
                    <td className="py-2 text-carvao">{y}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Ver quais escolhas metodológicas cada regulador fez e de onde vem cada parcela da tarifa média."
            naoPermite="Concluir que um modelo é melhor ou que um custo de capital é alto ou baixo sem conferir moeda, data, inflação, tributos e o risco que cada contrato aloca. Remuneração regulatória não é lucro realizado; a base regulatória não é o ativo contábil."
          />
        </Secao>

        {ESTUDOS.map((e) => (
          <Caso key={e.id} e={e} />
        ))}

        <Secao id="glossario" titulo="Como isso aparece na sua conta?">
          <dl className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
            {GLOSSARIO_CONTA.map((g) => (
              <div key={g.termo} className="border-t border-linha py-4">
                <dt className="font-serif text-lg text-carvao">{g.termo}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-carvao-muted">{g.definicao}</dd>
                <dd className="mt-2 text-sm leading-relaxed text-carvao">
                  <span className="rotulo mr-1 text-obee-dark">Na conta</span> {g.naConta}
                </dd>
              </div>
            ))}
          </dl>
          <Fonte>Notas técnicas, deliberações, resoluções e contrato listados em cada caso, com sha256 dos originais.</Fonte>
        </Secao>
      </main>
    </>
  );
}
