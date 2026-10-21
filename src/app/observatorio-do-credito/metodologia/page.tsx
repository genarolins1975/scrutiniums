import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AberturaCredito, CascaCredito, SecaoCredito } from "@/components/credito/Blocos";
import { metodologiaCredito } from "@/lib/credito/metodologia";
import { goldJuros } from "@/lib/credito/juros";
import { dataBr, diaBrasilia, num } from "@/lib/credito/formato";
import { METODO_SPA, paginaCredito } from "@/lib/credito/navegacao";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

/**
 * Metodologia e fontes do Crédito em página estática (Onda 2 da banca de 19/10/2026): o mesmo conteúdo da vista
 * "Metodologia e fontes" da aplicação de página única (/observatorio/methodology), lido no build das mesmas golds e dos
 * textos fixos da SPA (src/lib/credito/metodologia.ts). Nada reescrito à mão: se a origem mudar, a página muda junto.
 *
 * Rota com conta por ora (rota nova nasce fechada); a abertura depende de decisão do dono.
 */
export const dynamic = "force-static";

const pagina = paginaCredito("metodologia");

export const metadata: Metadata = {
  title: tituloNaColecao(pagina.titulo, pagina.href),
  description: pagina.descricao,
  alternates: { canonical: pagina.href },
};

/** "2026-08" ou "2026-08-01" como "08/2026"; "202606" como "06/2026". */
function refMes(ref: string | null): string {
  if (!ref) return "sem data";
  const m = /^(\d{4})-?(\d{2})/.exec(ref);
  return m ? `${m[2]}/${m[1]}` : ref;
}

const INDICE: [string, string][] = [
  ["como-ler", "Como ler"],
  ["reguas", "Réguas que diferem"],
  ["catalogo", "Catálogo"],
  ["dicionario", "Dicionário"],
  ["model-cards", "Model cards"],
  ["score-cards", "Score cards"],
  ["versoes", "Versões"],
  ["linhagem", "Linhagem"],
  ["juros", "Juros por instituição"],
  ["glossario", "Glossário"],
];

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-carvao">{rotulo}</dt>
      <dd >{children}</dd>
    </div>
  );
}

function Tabela({ legenda, colunas, children, numericas = [], classe = "" }: { legenda: string; colunas: string[]; children: ReactNode; numericas?: number[]; classe?: string }) {
  return (
    <div className="overflow-x-auto border-t border-linha" tabIndex={0} role="region" aria-label={legenda}>
      <table className={`w-full min-w-[40rem] border-collapse text-sm [&_tbody_th]:border-b [&_tbody_th]:border-linha [&_tbody_th]:px-2 [&_tbody_th]:py-2 [&_tbody_th]:text-left [&_tbody_th]:align-top [&_tbody_th]:text-carvao [&_td]:border-b [&_td]:border-linha [&_td]:px-2 [&_td]:py-2 [&_td]:align-top [&_td]:text-carvao-muted ${classe}`}>
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr className="border-b border-linha text-left text-xs text-carvao-muted">
            {colunas.map((c, i) => (
              <th key={c} scope="col" className={`px-2 py-2 font-medium ${numericas.includes(i) ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Rótulos dos conceitos do arquivo de juros; chave nova aparece pelo próprio nome. */
const CONCEITOS_JUROS: Record<string, string> = {
  taxa: "Taxa",
  janela: "Janela",
  mediana_vs_media_bc: "Mediana entre instituições e média do Banco Central",
  spread_selic: "Distância da Selic",
  carteira: "Carteira",
  persistencia: "Persistência",
};

/** Bordas, espaços e cor das células vêm da tabela (Tabela); a célula só declara o que muda. */
const tdNum = "whitespace-nowrap text-right tabular-nums text-carvao";

export default function MetodologiaCreditoPage() {
  const m = metodologiaCredito();
  const juros = goldJuros();

  return (
    <CascaCredito atual="metodologia">
      <AberturaCredito
        titulo={pagina.titulo}
        fonte={m.geradoEm ? <>Gerada dos arquivos publicados pelo pipeline do Crédito, processados em {diaBrasilia(m.geradoEm)}.</> : undefined}
      >
        <p>
          De onde vem cada número do Observatório de Crédito e como foi calculado: o catálogo das séries com a qualidade e a defasagem de cada uma, o
          dicionário de indicadores, os modelos de previsão e os scores com as suas limitações, o histórico de versões e a linhagem dos arquivos.
        </p>
        <p className="text-sm">
          É a mesma documentação da vista do painel, lida dos mesmos arquivos. A{" "}
          <Link href={METODO_SPA} prefetch={prefetchDoLink(METODO_SPA)} className="text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
            versão interativa no painel
          </Link>{" "}
          acrescenta as explicações didáticas de cada conceito, que abrem ao clicar.
        </p>
      </AberturaCredito>

      <nav aria-label="Seções da metodologia" className="border-y border-linha py-2">
        <ul className="flex flex-wrap gap-x-1 gap-y-0">
          {INDICE.map(([id, rotulo]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex min-h-[44px] items-center px-2 text-sm text-carvao-muted underline-offset-4 hover:text-carvao hover:underline">
                {rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <SecaoCredito id="como-ler" titulo="Como ler os números do Observatório">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="text-base font-medium text-carvao">Classificação epistemológica</h3>
            {m.classificacao ? (
              <dl className="mt-3 space-y-3 text-sm leading-relaxed">
                {m.classificacao.map((c) => (
                  <div key={c.selo}>
                    <dt className="rotulo text-carvao">{c.rotulo}</dt>
                    <dd className="mt-0.5 text-carvao-muted">{c.texto}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-carvao-muted">Indisponível nesta versão; consulte a versão interativa no painel.</p>
            )}
          </div>
          <div>
            <h3 className="text-base font-medium text-carvao">Regras metodológicas aplicadas</h3>
            <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{m.regras ?? "Indisponível nesta versão; consulte a versão interativa no painel."}</p>
            {m.ibcc && (
              <>
                <h3 className="mt-8 text-base font-medium text-carvao">IBCC: método</h3>
                <p className="mt-3 text-sm leading-relaxed text-carvao-muted">{m.ibcc.metodo}</p>
                {m.ibcc.limitacoes && (
                  <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
                    <span className="text-carvao">Limitações:</span> {m.ibcc.limitacoes}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </SecaoCredito>

      <SecaoCredito id="reguas" titulo="Réguas que parecem iguais e diferem" subtitulo="Três inadimplências, quatro carteiras e três contagens de instituições convivem no painel por construção das fontes. Cada página declara a sua ao lado do número.">
        {m.inadimplencias.length > 0 && (
          <>
            <h3 className="text-base font-medium text-carvao">As três inadimplências</h3>
            <div className="mt-3">
              <Tabela legenda="As três inadimplências" colunas={["Conceito", "Definição", "Valor", "Referência"]} numericas={[2]}>
                {m.inadimplencias.map((i) => (
                  <tr key={i.id}>
                    <th scope="row" className="text-left font-medium text-carvao">{i.nome}</th>
                    <td>{i.definicao}</td>
                    <td className={tdNum}>{i.valor === null ? "por produto" : `${num(i.valor)}%`}</td>
                    <td className="tabular-nums">{refMes(i.ref)}</td>
                  </tr>
                ))}
              </Tabela>
            </div>
          </>
        )}
        {m.carteiras.length > 0 && (
          <>
            <h3 className="mt-8 text-base font-medium text-carvao">Quatro carteiras</h3>
            <div className="mt-3">
              <Tabela legenda="Quatro carteiras" colunas={["Régua", "O que mede", "Valor", "Referência"]} numericas={[2]}>
                {m.carteiras.map((c) => (
                  <tr key={c.id}>
                    <th scope="row" className="text-left font-medium text-carvao">{c.nome}</th>
                    <td>{c.definicao}</td>
                    <td className={tdNum}>R$ {num(c.valorBi, 1)} bi</td>
                    <td className="tabular-nums">{refMes(c.ref)}</td>
                  </tr>
                ))}
              </Tabela>
            </div>
          </>
        )}
        {m.contagens.length > 0 && (
          <>
            <h3 className="mt-8 text-base font-medium text-carvao">Três contagens de instituições</h3>
            <div className="mt-3">
              <Tabela legenda="Três contagens de instituições" colunas={["Quantas instituições?", "Contagem", "Referência"]} numericas={[1]}>
                {m.contagens.map((c) => (
                  <tr key={c.id}>
                    <td>{c.definicao}</td>
                    <td className={tdNum}>{c.n.toLocaleString("pt-BR")}</td>
                    <td className="tabular-nums">{refMes(c.ref)}</td>
                  </tr>
                ))}
              </Tabela>
            </div>
          </>
        )}
        {m.notaReguas && <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">{m.notaReguas}</p>}
      </SecaoCredito>

      <SecaoCredito
        id="catalogo"
        titulo={`Catálogo de dados: ${m.catalogo.length.toLocaleString("pt-BR")} séries`}
        subtitulo="Ordenadas da menor para a maior nota de qualidade. A nota combina completude, atualidade, histórico, estabilidade e transparência, de 0 a 100; defasagem é o número de dias desde a última referência publicada."
      >
        <details className="border-t border-linha pt-2 text-sm">
          <summary className="flex min-h-[44px] cursor-pointer items-center text-carvao">Ver as {m.catalogo.length.toLocaleString("pt-BR")} séries, com fonte, acesso e qualidade</summary>
          <div className="mt-2">
            <Tabela legenda="Catálogo de séries do Crédito" colunas={["Série", "Fonte e código", "Acesso", "Última referência", "Defasagem", "Observações", "Revisões", "Qualidade"]} numericas={[4, 5, 6, 7]} classe="[&_td:nth-child(n+5)]:whitespace-nowrap [&_td:nth-child(n+5)]:text-right [&_td:nth-child(n+5)]:tabular-nums [&_td:nth-child(n+5)]:text-carvao">
              {m.catalogo.map((s) => (
                <tr key={s.chave}>
                  <th scope="row" className="font-normal">{s.nome}</th>
                  <td>
                    {s.fonte}
                    {s.codigo ? ` · ${s.codigo}` : ""}
                  </td>
                  <td>
                    {s.url ? (
                      <>
                        <a href={s.url} rel="noopener noreferrer" target="_blank" className="text-carvao underline decoration-linha underline-offset-4">
                          endpoint
                        </a>
                        {s.freq ? ` · ${s.freq}` : ""}
                        {s.unidade ? ` · ${s.unidade}` : ""}
                      </>
                    ) : (
                      "sem endpoint no catálogo"
                    )}
                  </td>
                  <td className="tabular-nums">{refMes(s.ultimaRef)}</td>
                  <td>{s.dias === null ? "sem dado" : `${s.dias} dias`}</td>
                  <td>{s.obs === null ? "sem dado" : s.obs.toLocaleString("pt-BR")}</td>
                  <td>{s.revisoes === null ? "sem dado" : s.revisoes.toLocaleString("pt-BR")}</td>
                  <td>
                    {num(s.score, 1)}
                  </td>
                </tr>
              ))}
            </Tabela>
          </div>
        </details>
      </SecaoCredito>

      <SecaoCredito id="dicionario" titulo="Dicionário de indicadores">
        <div className="space-y-2">
          {m.dicionario.map((d) => (
            <details key={d.nome} className="border-t border-linha pt-2 text-sm">
              <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 text-carvao">
                <span>
                  <strong className="font-medium">{d.nome}</strong>: {d.definicao}
                </span>
              </summary>
              <dl className="mt-2 space-y-2 pb-3 leading-relaxed">
                <Campo rotulo="Fórmula">{d.formula}</Campo>
                {d.numerador && d.numerador !== "—" && <Campo rotulo="Numerador">{d.numerador}</Campo>}
                {d.denominador && d.denominador !== "—" && <Campo rotulo="Denominador">{d.denominador}</Campo>}
                <Campo rotulo="Interpretação">{d.interpretacao}</Campo>
                <Campo rotulo="Limitações">{d.limitacoes}</Campo>
                <Campo rotulo="Periodicidade">{d.periodicidade}</Campo>
              </dl>
            </details>
          ))}
        </div>
      </SecaoCredito>

      <SecaoCredito id="model-cards" titulo="Model cards" subtitulo="Os modelos de previsão do painel, cada um com variável, algoritmo, validação, comparação com a referência ingênua, incerteza e limitações.">
        <div className="space-y-2">
          {m.modelCards.map((c, i) => (
            <details key={`${c.nome}-${i}`} className="border-t border-linha pt-2 text-sm">
              <summary className="flex min-h-[44px] cursor-pointer items-center text-carvao">
                <span>
                  <strong className="font-medium">{c.nome}</strong> · v{c.versao} · {c.objetivo}
                </span>
              </summary>
              <dl className="mt-2 space-y-2 pb-3 leading-relaxed">
                <Campo rotulo="Variável-alvo">{c.variavel_alvo}</Campo>
                <Campo rotulo="Algoritmo">{c.algoritmo}</Campo>
                <Campo rotulo="Validação">{c.validacao}</Campo>
                <Campo rotulo="Benchmark">{c.benchmark}</Campo>
                <Campo rotulo="Desempenho">
                  {c.desempenho && typeof c.desempenho === "object"
                    ? Object.entries(c.desempenho as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : String(v)}`)
                        .join(" · ")
                    : "sem dado"}
                </Campo>
                <Campo rotulo="Incerteza">{c.incerteza}</Campo>
                <Campo rotulo="Limitações">{c.limitacoes || "não declaradas"}</Campo>
                <Campo rotulo="Atualizado">{c.atualizado_em ? diaBrasilia(c.atualizado_em) : "sem data"}</Campo>
              </dl>
            </details>
          ))}
        </div>
      </SecaoCredito>

      <SecaoCredito id="score-cards" titulo="Score cards">
        <div className="space-y-2">
          {m.scoreCards.map((c, i) => (
            <details key={`${c.nome}-${i}`} className="border-t border-linha pt-2 text-sm">
              <summary className="flex min-h-[44px] cursor-pointer items-center text-carvao">
                <span>
                  <strong className="font-medium">{c.nome}</strong> · v{c.versao}
                </span>
              </summary>
              <dl className="mt-2 space-y-2 pb-3 leading-relaxed">
                <Campo rotulo="Componentes">{Array.isArray(c.componentes) ? c.componentes.join("; ") : String(c.componentes ?? "")}</Campo>
                <Campo rotulo="Pesos">{c.pesos}</Campo>
                <Campo rotulo="Normalização">{c.normalizacao}</Campo>
                <Campo rotulo="Tratamento de ausência">{c.tratamento_ausencia}</Campo>
                <Campo rotulo="Cobertura">{c.cobertura}</Campo>
                <Campo rotulo="Sensibilidade">{c.sensibilidade}</Campo>
                <Campo rotulo="Validação">{c.validacao}</Campo>
              </dl>
            </details>
          ))}
        </div>
      </SecaoCredito>

      <SecaoCredito id="versoes" titulo="Histórico de versões">
        <div className="space-y-2">
          {m.versoes.map((v) => (
            <details key={v.versao} className="border-t border-linha pt-2 text-sm">
              <summary className="flex min-h-[44px] cursor-pointer items-center text-carvao">
                <span>
                  <strong className="font-medium">v{v.versao}</strong> · {dataBr(v.data)}
                </span>
              </summary>
              <ul className="list-disc space-y-1 pb-3 pl-5 leading-relaxed text-carvao-muted">
                {v.mudancas.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </SecaoCredito>

      <SecaoCredito id="linhagem" titulo="Linhagem dos arquivos" subtitulo="De cada arquivo bruto coletado (bronze) ao arquivo publicado (gold), com o resumo criptográfico do bruto.">
        <h3 className="text-base font-medium text-carvao">Linhagem recente</h3>
        <div className="mt-3">
          <Tabela legenda="Linhagem recente, bronze para gold" colunas={["Objeto", "Arquivo bronze", "SHA-256", "Transformação", "Quando"]}>
            {m.linhagemRecente.map((l, i) => (
              <tr key={`${l.gold_object}-${i}`}>
                <th scope="row" className="font-normal">{l.gold_object}</th>
                <td className="break-all">{l.bronze_file}</td>
                <td className="font-mono text-xs">{l.sha256.slice(0, 12)}…</td>
                <td>{l.transform}</td>
                <td className="tabular-nums">{l.created_at.slice(0, 19).replace("T", " ")}</td>
              </tr>
            ))}
          </Tabela>
        </div>
        {m.mapa && (
          <>
            <h3 className="mt-8 text-base font-medium text-carvao">Linhagem completa: {m.mapa.resumo?.objetos_mapeados ?? m.mapa.objetos.length} objetos, gerada do código</h3>
            <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
              {m.mapa.gerado_de}. Método: {m.mapa.metodo}
            </p>
            {m.mapa.resumo && (
              <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                {m.mapa.resumo.publicados_no_gold} objetos publicados na execução; {(m.mapa.resumo.publicados_sem_produtor_mapeado ?? []).length} sem produtor
                mapeado.
              </p>
            )}
            <details className="mt-3 border-t border-linha pt-2 text-sm">
              <summary className="flex min-h-[44px] cursor-pointer items-center text-carvao">Ver os {m.mapa.objetos.length} objetos</summary>
              <div className="mt-2">
                <Tabela legenda="Linhagem completa" colunas={["Objeto gold", "Produzido por", "Fontes", "Depende de", "Consumido em"]}>
                  {m.mapa.objetos.map((o) => (
                    <tr key={o.gold}>
                      <th scope="row" className="font-normal">
                        {o.gold}
                        {o.notas.length > 0 && <span className="mt-1 block text-xs text-carvao-muted">{o.notas.join(" · ")}</span>}
                      </th>
                      <td className="break-words">{o.produtores.join(", ") || "sem registro"}</td>
                      <td className="break-words">{o.fontes.join(", ") || "sem registro"}</td>
                      <td className="break-words">{o.depende_de.join(", ") || "nenhum"}</td>
                      <td className="break-words">{o.consumido_em.join(", ") || "sem registro"}</td>
                    </tr>
                  ))}
                </Tabela>
              </div>
            </details>
          </>
        )}
      </SecaoCredito>

      <SecaoCredito
        id="juros"
        titulo="Juros por instituição: conceitos do arquivo"
        subtitulo="Definições publicadas junto das taxas por instituição e modalidade, usadas nas consultas Quanto meu banco cobra? e no simulador da parcela."
      >
        {juros ? (
          <>
            <dl className="max-w-prose2 space-y-3 text-sm leading-relaxed">
              {Object.entries(juros.conceitos ?? {}).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-carvao">{CONCEITOS_JUROS[k] ?? k.replace(/_/g, " ")}</dt>
                  <dd className="mt-0.5 text-carvao-muted">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-mineral">
              Fonte: {juros.fonte}. Processado em {diaBrasilia(juros.gerado_em)}.
            </p>
          </>
        ) : (
          <p className="text-sm text-carvao-muted">O arquivo de juros por instituição não está disponível nesta versão.</p>
        )}
      </SecaoCredito>

      <SecaoCredito id="glossario" titulo="Glossário: termos marcados nas abas do painel">
        {m.glossario ? (
          <dl className="grid gap-x-10 gap-y-3 text-sm leading-relaxed md:grid-cols-2">
            {m.glossario.map((g) => (
              <div key={g.termo} className="border-t border-linha pt-2">
                <dt className="font-medium text-carvao">{g.termo}</dt>
                <dd className="mt-0.5 text-carvao-muted">{g.definicao}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-carvao-muted">Indisponível nesta versão; consulte a versão interativa no painel.</p>
        )}
        <p className="mt-6 text-sm text-carvao-muted">
          Termos de toda a plataforma, com fórmula e limitações, estão no{" "}
          <Link href="/glossario" className="text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
            glossário geral
          </Link>
          .
        </p>
      </SecaoCredito>
    </CascaCredito>
  );
}
