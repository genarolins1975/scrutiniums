import { prefetchDoLink } from "@/lib/rotasPublicas";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import Link from "next/link";
import { ROTA, capituloPorSlug } from "@/lib/saneamento/capitulos";
import { TARIFAS } from "@/lib/saneamento/tarifas";
import type { Documento, Linha } from "@/lib/saneamento/dados/estudos";
import { inteiro, numero } from "@/lib/saneamento/formato";

/** Navegação entre os cinco subpainéis do capítulo 5, com o atual marcado. */
export function SubnavPreco({ atual }: { atual: string }) {
  const cap = capituloPorSlug("preco-regulado")!;
  return (
    <nav aria-label="Subpainéis da tarifa" className="mb-10 border-y border-linha">
      <ol className="flex flex-wrap gap-x-1">
        <li>
          <Link
            href={`${ROTA}/preco-regulado`}
            prefetch={prefetchDoLink(`${ROTA}/preco-regulado`)}
            aria-current={atual === "" ? "page" : undefined}
            className={`flex min-h-[44px] items-center border-b-2 px-3 text-sm ${atual === "" ? "border-obee text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
          >
            Visão do capítulo
            <SeloComConta href={`${ROTA}/preco-regulado`} />
          </Link>
        </li>
        {cap.subpaineis!.map((s) => (
          <li key={s.slug}>
            <Link
              href={`${ROTA}/preco-regulado/${s.slug}`}
              prefetch={prefetchDoLink(`${ROTA}/preco-regulado/${s.slug}`)}
              aria-current={atual === s.slug ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-1.5 border-b-2 px-3 text-sm ${atual === s.slug ? "border-obee text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
            >
              <span className="tabular-nums text-mineral">{s.numero}</span> {s.rotulo}
              <SeloComConta href={`${ROTA}/preco-regulado/${s.slug}`} />
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Tamanho da amostra de tabelas verificadas: sempre visível, nunca "nacional". */
export function AmostraTarifas() {
  const prestadores = new Set(TARIFAS.map((t) => t.prestadorSinisa));
  const ufs = new Set(TARIFAS.map((t) => t.uf));
  const municipios = new Set(TARIFAS.flatMap((t) => t.municipios));
  return (
    <p className="max-w-prose2 border-l-2 border-aviso pl-4 text-sm leading-relaxed text-carvao-muted">
      <span className="font-medium text-carvao">Amostra, não cobertura nacional.</span> {TARIFAS.length} tabelas residenciais de{" "}
      {prestadores.size} prestadores em {ufs.size} UFs ({[...ufs].sort().join(", ")}), verificadas em atos oficiais e associadas a{" "}
      {inteiro(municipios.size)} municípios. O Brasil tem mais de 1.700 prestadores declarados ao SINISA; os demais ainda não têm tabela verificada
      aqui.
    </p>
  );
}

export function QuadroLinhas({ titulo, linhas, total, legenda }: { titulo: string; linhas: Linha[]; total?: Linha; legenda?: string }) {
  const f = (l: Linha) => (l.valor == null ? "não publicado" : `${numero(l.valor, l.casas)}${l.unidade === "%" ? "%" : ""}`);
  return (
    <div className="tabela-scroll" tabIndex={0} role="region" aria-label={`${titulo} (rolável)`}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="pb-2 text-left font-medium text-carvao">
          {titulo}
          {legenda && <span className="block text-xs font-normal text-carvao-muted">{legenda}</span>}
        </caption>
        <thead>
          <tr className="border-b border-carvao text-left">
            <th scope="col" className="py-2 pr-3 font-medium">Item</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Valor</th>
            <th scope="col" className="py-2 pr-3 font-medium">Unidade</th>
            <th scope="col" className="py-2 font-medium">Documento e localizador</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo} className="border-b border-linha align-top">
              <th scope="row" className="py-2 pr-3 text-left font-normal text-carvao">
                {l.rotulo}
                {l.nota && <span className="block text-xs text-carvao-muted">{l.nota}</span>}
              </th>
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-carvao">{f(l)}</td>
              <td className="py-2 pr-3 text-carvao-muted">{l.unidade === "%" ? "" : l.unidade}</td>
              <td className="py-2 text-xs text-carvao-muted">{l.fonte}</td>
            </tr>
          ))}
          {total && (
            <tr className="border-t-2 border-carvao align-top">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-carvao">{total.rotulo}</th>
              <td className="whitespace-nowrap py-2 pr-3 text-right font-medium tabular-nums text-carvao">{f(total)}</td>
              <td className="py-2 pr-3 text-carvao-muted">{total.unidade === "%" ? "" : total.unidade}</td>
              <td className="py-2 text-xs text-carvao-muted">{total.fonte}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Documentos({ documentos }: { documentos: Documento[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {documentos.map((d) => (
        <li key={d.id} className="border-t border-linha pt-2">
          <a href={d.url} className="text-obee-dark underline underline-offset-2" rel="noopener noreferrer">
            {d.rotulo}
          </a>
          <span className="block break-all font-mono text-xs text-carvao-muted">sha256 {d.sha256}</span>
          {d.observacao && <span className="block text-xs text-carvao-muted">{d.observacao}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Ficha de cada tabela verificada: ato, vigência, área, regras e fontes com hash. */
export function FichasTabelas() {
  return (
    <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
      {TARIFAS.map((t) => (
        <article key={t.id} id={`tabela-${t.id}`} className="scroll-mt-24 border-t border-linha py-5">
          <h3 className="font-serif text-lg leading-snug text-carvao">
            {t.prestador} <span className="text-base text-carvao-muted">· {t.uf}</span>
          </h3>
          <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-carvao-muted">Regulador</dt>
            <dd className="text-carvao">{t.regulador}</dd>
            <dt className="text-carvao-muted">Ato</dt>
            <dd className="text-carvao">{t.ato}</dd>
            <dt className="text-carvao-muted">Vigência</dt>
            <dd className="text-carvao">{t.vigencia}</dd>
            <dt className="text-carvao-muted">Último ajuste</dt>
            <dd className="text-carvao">{t.ultimoReajuste}</dd>
            <dt className="text-carvao-muted">Onde vale</dt>
            <dd className="text-carvao">{t.area}</dd>
            <dt className="text-carvao-muted">Estrutura</dt>
            <dd className="text-carvao">{t.modelo}; cobrança {t.unidade}</dd>
          </dl>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
            {t.observacoes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          <details className="mt-3 text-xs">
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark underline underline-offset-2">Documentos originais ({t.fontes.length})</summary>
            <ul className="mt-2 space-y-2">
              {t.fontes.map((f) => (
                <li key={f.url}>
                  <a href={f.url} className="text-obee-dark underline underline-offset-2" rel="noopener noreferrer">
                    {f.rotulo}
                  </a>
                  <span className="text-carvao-muted"> · {f.localizador}</span>
                  <span className="block break-all font-mono text-xs text-carvao-muted">sha256 {f.sha256}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-carvao-muted">Consultado em {t.acessado.split("-").reverse().join("/")}.</p>
          </details>
        </article>
      ))}
    </div>
  );
}
