import type { Metadata } from "next";
import Link from "next/link";
import { TextoReadme } from "@/components/territorio/TextoReadme";
import { dataBr } from "@/lib/perguntas/leitura";
import { ROTULO_NAO_CONCLUIR, ROTULO_VALIDACOES, atualizacaoTerritorio, fontesTerritorio, frase, itemReadme, lacunasTerritorio } from "@/lib/territorio/metodo";
import { RotuloContexto } from "@/components/layout/RotuloContexto";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Método, fontes e validações",
  description:
    "Como o Observatório do Território e Clima mede focos de calor (INPE), desastres reconhecidos (Atlas Digital de Desastres, Sedec/MIDR) e emissões (inventário oficial do MCTI): fontes, datas de captura, sha256, validações que retêm a publicação e o que cada número não permite concluir.",
  alternates: { canonical: "/territorio/metodologia" },
  robots: { index: true },
};

/** Itens do README que a página mostra em destaque; os demais vão para a ficha técnica. */
const EM_DESTAQUE = new Set([ROTULO_NAO_CONCLUIR, ROTULO_VALIDACOES, "Ressalvas que vão para a página"]);

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

function Cadeado() {
  return (
    <svg aria-hidden="true" width="11" height="12" viewBox="0 0 11 12" fill="none" className="shrink-0">
      <rect x="0.75" y="5.25" width="9.5" height="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.75 5.25V3.5a2.75 2.75 0 0 1 5.5 0v1.75" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ComConta() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-mineral no-underline">
      <Cadeado /> com conta
    </span>
  );
}

const tamanho = (bytes: number) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1e3)).toLocaleString("pt-BR")} kB`;

/**
 * Método aberto do Observatório do Território e Clima (rota pública em
 * src/lib/rotasPublicas.ts). Fontes, cobertura, datas e sha256 vêm das golds; o que
 * cada número não permite concluir, as validações que retêm a publicação, a agenda de
 * atualização e as lacunas vêm de docs/territorio/README.md. Painéis e downloads
 * seguem com conta e aparecem com o selo.
 */
export default function MetodologiaTerritorio() {
  const fontes = fontesTerritorio();
  const atualizacao = atualizacaoTerritorio();
  const lacunas = lacunasTerritorio();
  const indice = [
    ...fontes.map((f) => ({ id: f.id, rotulo: f.titulo })),
    { id: "atualizacao", rotulo: "Atualização" },
    { id: "lacunas", rotulo: "O que não é medido" },
    { id: "outras", rotulo: "Painéis de outras coleções" },
  ];

  return (
    <main className="bg-papel">
      <section aria-labelledby="metodo-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-10 pt-10 md:pt-12">
          <nav aria-label="Trilha" className="text-sm text-carvao-muted">
            <Link href="/perguntas/territorio-e-clima" className={link}>Território e Clima</Link>
            <span aria-hidden="true" className="mx-2 text-mineral">/</span>
            <span aria-current="page">Método</span>
          </nav>
          <RotuloContexto rota="/territorio/metodologia" className="mt-8 flex flex-wrap items-center gap-x-3 text-mineral" marca={<span aria-hidden="true" className="h-[3px] w-8 bg-obee" />} />
          <h1 id="metodo-titulo" className="mt-5 max-w-4xl font-serif text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.12] text-carvao [text-wrap:balance]">
            Como o observatório mede o fogo, os desastres e as emissões
          </h1>
          <p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted">
            As fontes oficiais, quando cada arquivo foi capturado, o código de verificação (sha256) de cada original, as regras que impedem a
            publicação e o que cada número não permite concluir. Tudo lido dos dados publicados e do documento de método do pipeline.
          </p>
          <nav aria-label="Nesta página" className="mt-8">
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {indice.map((i) => (
                <li key={i.id}><a href={`#${i.id}`} className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>{i.rotulo}</a></li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {fontes.map((f, idx) => {
        const naoConcluir = itemReadme(f.readme, ROTULO_NAO_CONCLUIR);
        const validacoes = itemReadme(f.readme, ROTULO_VALIDACOES);
        const ficha = f.readme.itens.filter((i) => !EM_DESTAQUE.has(i.rotulo));
        return (
          <section key={f.id} id={f.id} aria-labelledby={`${f.id}-titulo`} className={`scroll-mt-24 ${idx > 0 ? "border-t border-linha" : ""}`}>
            <div className="mx-auto max-w-page px-6 py-12 md:py-14">
              <p className="rotulo text-mineral tabular-nums">{String(idx + 1).padStart(2, "0")}</p>
              <h2 id={`${f.id}-titulo`} className="mt-2 font-serif text-[clamp(1.5rem,2.8vw,2rem)] leading-tight text-carvao">{f.titulo}</h2>
              <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao">{f.fonte}</p>
              <ul className="mt-1 flex flex-wrap gap-x-5 text-sm">
                {f.links.map((l) => (
                  <li key={l.href}><a href={l.href} rel="noopener noreferrer" className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>{l.rotulo}</a></li>
                ))}
              </ul>

              <dl className="mt-6 grid gap-px border border-linha bg-linha md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-papel p-4"><dt className="text-xs text-mineral">O que se conta</dt><dd className="mt-1 text-sm leading-relaxed text-carvao">{frase(f.unidade)}</dd></div>
                <div className="bg-papel p-4"><dt className="text-xs text-mineral">Período coberto</dt><dd className="mt-1 text-sm leading-relaxed text-carvao">{f.cobertura}</dd></div>
                <div className="bg-papel p-4"><dt className="text-xs text-mineral">Captura</dt><dd className="mt-1 text-sm leading-relaxed text-carvao">{dataBr(f.capturadoEm)}</dd></div>
                <div className="bg-papel p-4"><dt className="text-xs text-mineral">Licença e citação</dt><dd className="mt-1 text-sm leading-relaxed text-carvao">{f.licenca}</dd></div>
              </dl>

              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg leading-snug text-carvao">O que este número não permite concluir</h3>
                  <p className="mt-2 border-l-2 border-obee pl-3 text-sm leading-relaxed text-carvao">
                    {naoConcluir ? <TextoReadme texto={frase(naoConcluir)} /> : "Ressalva não declarada no documento de método."}
                  </p>
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif text-lg leading-snug text-carvao">Validações que retêm a publicação</h3>
                  <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                    Se qualquer uma falhar, a nova coleta não é publicada e o painel continua com a versão anterior, já conferida:
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-carvao">
                    {validacoes ? <TextoReadme texto={frase(validacoes)} /> : "Validações não declaradas no documento de método."}
                  </p>
                </div>
              </div>

              <h3 className="mt-8 font-serif text-lg leading-snug text-carvao">Ressalvas que acompanham os dados</h3>
              <ul className="mt-3 list-disc gap-10 space-y-2 pl-5 text-sm leading-relaxed text-carvao-muted lg:columns-2 [&>li]:break-inside-avoid">
                {f.ressalvas.map((r) => <li key={r}>{r}</li>)}
              </ul>

              <details className="mt-8 border-t border-linha pt-3">
                <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-carvao-muted hover:text-carvao">
                  Arquivos originais ({f.originais.length}), com tamanho, data e sha256
                </summary>
                <p className="mt-2 text-xs text-mineral md:hidden">Arraste a tabela para o lado para ver a data e o sha256.</p>
                <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={`Arquivos originais: ${f.titulo}`}>
                  <table className="w-full min-w-[640px] text-xs">
                    <caption className="sr-only">{`Arquivos originais de ${f.titulo}, com tamanho, data e sha256`}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="border-b border-linha px-2 py-2 text-left font-medium text-carvao">Arquivo</th>
                        <th scope="col" className="border-b border-linha px-2 py-2 text-right font-medium text-carvao">Tamanho</th>
                        <th scope="col" className="border-b border-linha px-2 py-2 text-left font-medium text-carvao">Data</th>
                        <th scope="col" className="border-b border-linha px-2 py-2 text-left font-medium text-carvao">sha256</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.originais.map((o) => (
                        <tr key={o.url}>
                          <td className="border-b border-linha px-2 py-2 align-top"><a href={o.url} rel="noopener noreferrer" className={`text-carvao ${link}`}>{o.nome}</a></td>
                          <td className="whitespace-nowrap border-b border-linha px-2 py-2 text-right align-top tabular-nums text-carvao">{tamanho(o.bytes)}</td>
                          <td className="whitespace-nowrap border-b border-linha px-2 py-2 align-top text-carvao">
                            {o.data ? `${dataBr(o.data)} (${o.tipoData === "fonte" ? "na fonte" : "captura"})` : "não informada pela fonte"}
                          </td>
                          <td className="border-b border-linha px-2 py-2 align-top font-mono text-[11px] text-carvao-muted [overflow-wrap:anywhere]">{o.sha256}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              {ficha.length > 0 && (
                <details className="border-t border-linha pt-3">
                  <summary className="flex min-h-[44px] cursor-pointer items-center text-sm text-carvao-muted hover:text-carvao">Ficha técnica do pipeline</summary>
                  <dl className="mt-3 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
                    {ficha.map((i) => (
                      <div key={i.rotulo}>
                        <dt className="font-medium text-carvao">{i.rotulo}</dt>
                        <dd className="mt-1"><TextoReadme texto={frase(i.texto)} /></dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}

              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-linha pt-3 text-sm">
                <li>
                  <Link href={f.rota} prefetch={false} className={`inline-flex min-h-[44px] items-center gap-2 text-carvao ${link}`}>Ver o painel <ComConta /></Link>
                </li>
                <li>
                  <a href={f.gold} className={`inline-flex min-h-[44px] items-center gap-2 text-carvao ${link}`}>Baixar os dados publicados (JSON) <ComConta /></a>
                </li>
              </ul>
            </div>
          </section>
        );
      })}

      <section id="atualizacao" aria-labelledby="atualizacao-titulo" className="scroll-mt-24 border-t border-linha bg-marfim">
        <div className="mx-auto grid max-w-page gap-10 px-6 py-12 md:py-14 lg:grid-cols-2">
          <div className="min-w-0">
            <h2 id="atualizacao-titulo" className="font-serif text-[clamp(1.4rem,2.6vw,1.8rem)] leading-tight text-carvao">Atualização</h2>
            <dl className="mt-4 space-y-4 text-sm leading-relaxed text-carvao-muted">
              {atualizacao.map((i) => (
                <div key={i.rotulo}>
                  <dt className="font-medium text-carvao">{i.rotulo}</dt>
                  <dd className="mt-1"><TextoReadme texto={frase(i.texto)} /></dd>
                </div>
              ))}
            </dl>
          </div>
          <div id="lacunas" className="min-w-0 scroll-mt-24">
            <h2 className="font-serif text-[clamp(1.4rem,2.6vw,1.8rem)] leading-tight text-carvao">O que não é medido</h2>
            <p className="mt-2 text-sm leading-relaxed text-carvao-muted">Lacunas declaradas: onde a fonte não publica o recorte, a plataforma não mostra zero nem estimativa.</p>
            <dl className="mt-4 space-y-4 text-sm leading-relaxed text-carvao-muted">
              {lacunas.map((i) => (
                <div key={i.rotulo}>
                  <dt className="font-medium text-carvao">{i.rotulo}</dt>
                  <dd className="mt-1"><TextoReadme texto={frase(i.texto)} /></dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section id="outras" aria-labelledby="outras-titulo" className="mx-auto max-w-page scroll-mt-24 px-6 py-12 md:py-14">
        <h2 id="outras-titulo" className="font-serif text-[clamp(1.4rem,2.6vw,1.8rem)] leading-tight text-carvao">Painéis de outras coleções</h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          O observatório também reúne painéis mantidos por outras coleções: desmatamento (PRODES, do INPE), cidades, drenagem e resíduos (SINISA, do
          Ministério das Cidades), secas no abastecimento de água e reservatórios das hidrelétricas (ONS). O método de cada um está na página da coleção.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <li><Link href="/agronegocio/metodologia" className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>Agronegócio: método</Link></li>
          <li><Link href="/saneamento/metodologia" className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>Saneamento: método</Link></li>
          <li><Link href="/setor-eletrico/metodologia" className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>Setor Elétrico: método</Link></li>
          <li><Link href="/perguntas/territorio-e-clima" className={`inline-flex min-h-[44px] items-center text-carvao ${link}`}>Resumo aberto do observatório</Link></li>
        </ul>
      </section>
    </main>
  );
}
