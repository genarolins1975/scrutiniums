import type { ReactNode } from "react";
import Link from "@/components/i18n/LinkIdioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { PAINEIS_EN, rotuloDado } from "@/lib/energia/i18n/regulacao-dados-metodo";
import { datasLegiveis } from "@/lib/energia/visao";
import { ESCALA_AVALIACAO, ORDEM_DIMENSOES, ROTULO_CURTO, ROTULO_RESULTADO_JORNADA, evolucao, textoCitado as citado } from "@/lib/energia/avaliacao";
import { JornadaDetalhe } from "@/components/energia/AvaliacaoJornada";
import type { AvaliacaoGold } from "@/lib/energia/tipos-avaliacao";

/**
 * Peças de servidor da página de avaliação (P071): jornadas, rubrica, método e evolução entre rodadas. Na página inglesa, o texto escrito
 * pela avaliação (perfis, atritos, regras da rubrica, problemas vistos pelos revisores) sai marcado como trecho em português.
 */

const LINK = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

export function AvaliacaoJornadas({ a }: { a: AvaliacaoGold }) {
  return (
    <div className="space-y-3" data-lista="jornadas">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          "As dez jornadas da seção 15.2 da especificação, executadas como roteiro por script em Chromium, sem participante humano. Cada passo verifica um fato observável: texto, URL, valor ou arquivo baixado. Roteiro cumprido mostra que o caminho existe e funciona; não mede se uma pessoa o encontraria sozinha.",
          "The ten journeys of section 15.2 of the specification, run as a script in Chromium, with no human participant. Each step checks an observable fact: text, URL, value or downloaded file. A completed script shows that the path exists and works; it does not measure whether a person would find it alone.",
        )}
      </p>
      <ul className="space-y-3">
        {a.jornadas.map((j) => (
          <li key={j.id} className="border border-linha bg-superficie p-3" data-jornada={j.id} data-resultado={j.resultado}>
            <JornadaDetalhe
              id={j.id}
              resumo={
                <>
                  <span className="rotulo mr-2 text-mineral">{j.id}</span>
                  <TrechoPortugues regiao="avaliacao-jornada-perfil">{j.perfil}</TrechoPortugues>: <strong className="font-medium">{ROTULO_RESULTADO_JORNADA[j.resultado].toLowerCase()}</strong>
                  {tx(
                    `, ${j.passos_ok} de ${j.passos_total} passos, ${j.cliques} interações${j.movel ? ", em celular (390 px)" : ""}`,
                    `, ${j.passos_ok} of ${j.passos_total} steps, ${j.cliques} interactions${j.movel ? ", on a phone (390 px)" : ""}`,
                  )}
                </>
              }
            >
              <p className="mt-2 text-sm text-carvao">
                <TrechoPortugues regiao="avaliacao-jornada-titulo">{citado(j.titulo)}</TrechoPortugues>
              </p>
              {(j.atritos ?? []).length > 0 && (
                <div className="mt-2">
                  <p className="rotulo text-mineral">{tx("Atritos encontrados", "Friction found")}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
                    {(j.atritos ?? []).map((t) => (
                      <li key={t}>
                        <TrechoPortugues regiao="avaliacao-jornada-atrito">{citado(t)}</TrechoPortugues>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {j.limite && (
                <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                  {tx("Limite:", "Limit:")} <TrechoPortugues regiao="avaliacao-jornada-limite">{j.limite}</TrechoPortugues>
                </p>
              )}
            </JornadaDetalhe>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AvaliacaoEvolucao({ a }: { a: AvaliacaoGold }) {
  const linhas = evolucao(a);
  const cabecalhos = tx(
    ["Rodada", "Data", "Páginas", "Dimensões com nota", "Nota ponderada média das dimensões avaliadas", "Atendem a meta", "Defeitos: crítico / alto / médio / baixo", "Jornadas cumpridas"],
    ["Round", "Date", "Pages", "Dimensions with a score", "Average weighted score of the assessed dimensions", "Meet the target", "Defects: critical / high / medium / low", "Journeys completed"],
  );
  const naoAvaliada = tx("n.av.", "n.a.");
  return (
    <div className="space-y-3" data-lista="evolucao">
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Evolução entre rodadas (tabela rolável)", "Progress between rounds (scrollable table)")}>
        <table className="w-full border-collapse text-sm tabular-nums">
          <caption className="pb-2 text-left text-sm font-medium text-carvao">{tx("Rodadas de avaliação registradas", "Evaluation rounds recorded")}</caption>
          <thead>
            <tr className="border-b border-linha text-left text-xs text-mineral">
              {cabecalhos.map((c) => (
                <th key={c} scope="col" className="px-2 py-1.5 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-linha align-top text-carvao">
                <th scope="row" className="px-2 py-1.5 text-left font-normal">
                  {l.id}
                </th>
                <td className="px-2 py-1.5">{l.data}</td>
                <td className="px-2 py-1.5">{l.paginas}</td>
                <td className="px-2 py-1.5">{tx(`${l.dimensoes} de 10`, `${l.dimensoes} of 10`)}</td>
                <td className="px-2 py-1.5">{l.nota}</td>
                <td className="px-2 py-1.5">{l.atendem}</td>
                <td className="px-2 py-1.5">{l.defeitos}</td>
                <td className="px-2 py-1.5">{l.jornadas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Média por dimensão em cada rodada (tabela rolável)", "Average by dimension in each round (scrollable table)")}>
        <table className="w-full border-collapse text-sm tabular-nums">
          <caption className="pb-2 text-left text-sm font-medium text-carvao">
            {tx(
              "Média das páginas em cada dimensão, por rodada (n.av.: dimensão não avaliada na rodada)",
              "Average of the pages in each dimension, by round (n.a.: dimension not assessed in the round)",
            )}
          </caption>
          <thead>
            <tr className="border-b border-linha text-left text-xs text-mineral">
              <th scope="col" className="px-2 py-1.5 font-medium">
                {tx("Rodada", "Round")}
              </th>
              {ORDEM_DIMENSOES.map((i) => (
                <th key={i} scope="col" className="px-2 py-1.5 font-medium">
                  {ROTULO_CURTO[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-linha text-carvao">
                <th scope="row" className="px-2 py-1.5 text-left font-normal">
                  {l.id}
                </th>
                {l.medias.map((v, k) => (
                  <td key={ORDEM_DIMENSOES[k]} className="px-2 py-1.5">
                    {v === null ? naoAvaliada : num(v, 1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a.rodadas.some((r) => r.reprocessada || (r.ajustes_do_metodo ?? []).length > 0) && (
        <div data-ajustes-do-metodo="true">
          <p className="rotulo text-mineral">{tx("O que mudou no método entre as rodadas", "What changed in the method between rounds")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
            {a.rodadas.flatMap((r) => [
              ...(r.reprocessada
                ? [
                    <li key={`${r.id}-rep`}>
                      {tx(`Rodada ${r.id} recalculada: `, `Round ${r.id} recomputed: `)}
                      <TrechoPortugues regiao="avaliacao-reprocessada">{r.reprocessada}</TrechoPortugues>
                    </li>,
                  ]
                : []),
              ...(r.ajustes_do_metodo ?? []).map((t) => (
                <li key={`${r.id}-${t}`}>
                  {tx(`Rodada ${r.id}: `, `Round ${r.id}: `)}
                  <TrechoPortugues regiao="avaliacao-ajuste">{t}</TrechoPortugues>
                </li>
              )),
            ])}
          </ul>
        </div>
      )}
      {a.corrigidos.length > 0 ? (
        <div>
          <p className="rotulo text-mineral">{tx("Defeitos corrigidos desde a rodada anterior", "Defects fixed since the previous round")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
            {a.corrigidos.map((c) => (
              <li key={c.chave}>
                <TrechoPortugues regiao="avaliacao-corrigido">{citado(c.descricao)}</TrechoPortugues>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-carvao-muted">
          {tx("Nenhum defeito da rodada anterior foi dado como corrigido nesta rodada.", "No defect from the previous round was marked as fixed in this round.")}
        </p>
      )}
    </div>
  );
}

export function AvaliacaoRubrica({ a }: { a: AvaliacaoGold }) {
  const m = a.rubrica.metas;
  return (
    <div className="space-y-4" data-lista="rubrica">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {tx(
          `Rubrica ${a.versao_rubrica}. Escala de 0 a 10, truncada em uma casa decimal: nota inferior nunca é arredondada para cima. Meta de produto: todas as dimensões a partir de ${num(m.geral, 1)}, didatismo e qualidade visual a partir de ${num(m.didatismo, 1)} e nenhum defeito crítico. Nota só existe com evidência medida ou revisão registrada; o que não foi testado aparece como não avaliado e não satisfaz o aceite. Os pontos de cada dedução e os limiares são decisão de revisão registrada aqui, não norma externa.`,
          `Rubric ${a.versao_rubrica}. Scale from 0 to 10, truncated to one decimal place: a lower score is never rounded up. Product target: every dimension from ${num(m.geral, 1)}, didactic and visual quality from ${num(m.didatismo, 1)} and no critical defect. A score exists only with measured evidence or a recorded review; what was not tested appears as not assessed and does not meet acceptance. The points of each deduction and the thresholds are a review decision recorded here, not an external standard.`,
        )}
      </p>
      <ul className="space-y-3">
        {ORDEM_DIMENSOES.map((id) => {
          const d = a.rubrica.dimensoes.find((x) => x.id === id)!;
          const fonte =
            d.fonte_da_nota === "revisao"
              ? tx("revisor em contexto limpo", "a reviewer in a clean context")
              : d.fonte_da_nota === "medicao"
                ? tx("medição", "measurement")
                : tx("evidência das golds e dos testes", "evidence from the gold files and tests");
          return (
            <li key={id} className="border border-linha bg-superficie p-3" data-rubrica={id}>
              <details>
                <summary className="cursor-pointer text-sm text-carvao">
                  <strong className="font-medium">{tx(d.nome, ROTULO_CURTO[id])}</strong> · {tx(`peso ${d.peso}% · nota de ${fonte}`, `weight ${d.peso}% · score from ${fonte}`)}
                </summary>
                <p className="mt-2 text-xs text-mineral">
                  {tx("Evidência exigida:", "Evidence required:")} <TrechoPortugues regiao="avaliacao-rubrica-evidencia">{d.evidencia}</TrechoPortugues>.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
                  {d.regras.map((r) => (
                    <li key={r}>
                      <TrechoPortugues regiao="avaliacao-rubrica-regra">{r}</TrechoPortugues>
                    </li>
                  ))}
                  {d.tetos.map((t) => (
                    <li key={t.motivo}>
                      {tx(`Teto${t.valor === null ? " variável" : ` ${num(t.valor, 1)}`}:`, `Cap${t.valor === null ? " (variable)" : ` ${num(t.valor, 1)}`}:`)}{" "}
                      <TrechoPortugues regiao="avaliacao-rubrica-teto">{t.motivo}</TrechoPortugues>.
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AvaliacaoMetodo({ a, children }: { a: AvaliacaoGold; children?: ReactNode }) {
  const rod = a.rodada;
  return (
    <div className="space-y-3 text-sm leading-relaxed text-carvao-muted" data-lista="metodo">
      <p className="max-w-prose2">
        <TrechoPortugues regiao="avaliacao-metodo">{a.metodo.resumo}</TrechoPortugues>
      </p>
      <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        <div>
          <dt className="rotulo text-mineral">{tx("Rodada", "Round")}</dt>
          <dd className="mt-0.5">
            {tx(
              `${rod.id}; inspeção gerada em ${rod.inspecao_gerada_em ? datasLegiveis(rod.inspecao_gerada_em) : "data não registrada"}; código ${a.versao_codigo ?? "não informado"}`,
              `${rod.id}; inspection generated on ${rod.inspecao_gerada_em ? datasLegiveis(rod.inspecao_gerada_em) : "date not recorded"}; code ${a.versao_codigo ?? "not reported"}`,
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Navegador", "Browser")}</dt>
          <dd className="mt-0.5">
            <TrechoPortugues regiao="avaliacao-navegador">{rod.navegador}</TrechoPortugues>
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Larguras e modos", "Widths and modes")}</dt>
          <dd className="mt-0.5">
            {tx(
              `${rod.larguras.join(", ")} px; modos ${rod.modos.join(" e ")} (em Auditar, só 390 e 1440 px)`,
              `${rod.larguras.join(", ")} px; modes ${rod.modos.map((x) => (x === "entender" ? "understand" : x === "auditar" ? "audit" : x === "analisar" ? "analyze" : x)).join(" and ")} (in Audit, only 390 and 1440 px)`,
            )}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
          <dd className="mt-0.5">
            {tx(
              `${rod.rotas_medidas} de ${rod.rotas_construidas ?? "número não registrado"} rotas construídas; as famílias dinâmicas foram amostradas (seis páginas de cada)`,
              `${rod.rotas_medidas} of ${rod.rotas_construidas ?? "unrecorded number of"} routes built; the dynamic families were sampled (six pages from each)`,
            )}
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="rotulo text-mineral">{tx("Scripts e entradas", "Scripts and inputs")}</dt>
          <dd className="mt-0.5 [overflow-wrap:anywhere]">
            {tx(`${a.metodo.scripts.join("; ")}; entradas versionadas em ${a.metodo.entradas}`, `${a.metodo.scripts.join("; ")}; inputs versioned in ${a.metodo.entradas}`)}
          </dd>
        </div>
      </dl>
      {children}
    </div>
  );
}

export function AvaliacaoLinkRepositorio({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={LINK}>
      {children}
    </Link>
  );
}

/** Faixa da nota: fundo da célula da matriz (o número sempre aparece em texto; a cor reforça, não carrega sozinha). */
function faixa(v: number | null): { fundo: string; texto: string; indice: number } | null {
  if (v === null) return null;
  const lim = ESCALA_AVALIACAO.limites;
  const i = v < lim[0] ? 0 : v < lim[1] ? 1 : v < lim[2] ? 2 : 3;
  return { fundo: ESCALA_AVALIACAO.cores[i], texto: i === 3 ? "text-superficie" : "text-carvao", indice: i };
}

/**
 * Matriz de aceite e evidência (P071): uma linha por entrega, uma coluna por dimensão, a média
 * das páginas da entrega em cada célula. Célula sem número é dimensão não avaliada ou que não
 * se aplica a nenhuma página da entrega; nunca vira zero.
 */
export function AvaliacaoMatriz({ a }: { a: AvaliacaoGold }) {
  const naoAvaliada = tx("n.av.", "n.a.");
  const naoAplica = tx("n.ap.", "n.app.");
  return (
    <figure className="space-y-2" data-matriz="aceite">
      <figcaption className="text-sm font-medium text-carvao">
        {tx("Média das páginas de cada entrega, por dimensão (nota de 0 a 10)", "Average of the pages of each delivery, by dimension (score from 0 to 10)")}
      </figcaption>
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label={tx("Matriz de aceite e evidência (tabela rolável)", "Acceptance and evidence matrix (scrollable table)")}>
        <table className="w-full border-collapse text-sm tabular-nums [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-center">
          <thead>
            <tr className="border-b border-linha text-left text-xs text-mineral">
              <th scope="col" className="sticky left-0 bg-superficie px-2 py-1.5 font-medium">
                {tx("Entrega (páginas)", "Delivery (pages)")}
              </th>
              {ORDEM_DIMENSOES.map((i) => (
                <th key={i} scope="col" className="px-2 py-1.5 text-center font-medium">
                  {ROTULO_CURTO[i]}
                </th>
              ))}
              <th scope="col" className="px-2 py-1.5 text-center font-medium">
                {tx("Ponderada", "Weighted")}
              </th>
              <th scope="col" className="px-2 py-1.5 text-center font-medium">
                {tx("Atendem a meta", "Meet the target")}
              </th>
            </tr>
          </thead>
          <tbody>
            {a.modulos.map((m) => (
              <tr key={m.id} className="border-b border-linha text-carvao" data-entrega={m.id}>
                <th scope="row" className="sticky left-0 bg-superficie px-2 py-1.5 text-left font-normal">
                  {rotuloDado(PAINEIS_EN, m.rotulo)} <span className="text-mineral">({m.paginas})</span>
                </th>
                {ORDEM_DIMENSOES.map((i) => {
                  const d = m.dimensoes[i];
                  const f = faixa(d.media);
                  return (
                    <td key={i} className={f ? (f.indice === 3 ? "text-superficie" : undefined) : "text-mineral"} style={f ? { background: f.fundo } : undefined}>
                      {d.media === null ? (d.nao_avaliadas ? naoAvaliada : naoAplica) : num(d.media, 1)}
                    </td>
                  );
                })}
                <td className={faixa(m.nota_ponderada) ? (faixa(m.nota_ponderada)!.indice === 3 ? "text-superficie" : undefined) : "text-mineral"} style={faixa(m.nota_ponderada) ? { background: faixa(m.nota_ponderada)!.fundo } : undefined} data-coluna="ponderada">
                  {m.nota_ponderada === null ? naoAvaliada : num(m.nota_ponderada, 1)}
                </td>
                <td>{tx(`${m.atendem_meta} de ${m.paginas}`, `${m.atendem_meta} of ${m.paginas}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-carvao-muted">
        {ESCALA_AVALIACAO.rotulos.map((r, i) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3 border border-linha" style={{ background: ESCALA_AVALIACAO.cores[i] }} />
            {r}
          </span>
        ))}
        <span>{tx("n.av.: não avaliada; n.ap.: não se aplica", "n.a.: not assessed; n.app.: not applicable")}</span>
      </p>
    </figure>
  );
}

/** Problemas que cada revisor viu se repetirem em várias páginas do seu grupo (texto dos revisores, sem contagem). */
export function AvaliacaoRevisao({ a }: { a: AvaliacaoGold }) {
  const r = a.revisao;
  return (
    <div className="space-y-3" data-lista="revisao">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        <TrechoPortugues regiao="avaliacao-revisao-metodo">{r.metodo}</TrechoPortugues>
      </p>
      <ul className="space-y-3">
        {r.revisores.map((x) => (
          <li key={x.id} className="border border-linha bg-superficie p-3" data-revisor={x.id}>
            <p className="text-sm text-carvao">
              <span className="rotulo mr-2 text-mineral">{x.id}</span>
              <TrechoPortugues regiao="avaliacao-revisor-escopo">{x.escopo}</TrechoPortugues>
              {tx(`, ${x.paginas} páginas`, `, ${x.paginas} pages`)}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
              {(r.problemas_entre_paginas[x.id] ?? []).map((t) => (
                <li key={t}>
                  <TrechoPortugues regiao="avaliacao-revisor-problema">{citado(t)}</TrechoPortugues>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        {tx(
          "Cada revisor viu só o seu grupo de páginas, e os problemas aparecem como ele os escreveu: a contagem de páginas afetadas não é calculada. O que cada nota de didatismo e de qualidade visual teve de observação e de defeito está na ficha da página.",
          "Each reviewer saw only their own group of pages, and the problems appear as they wrote them: the count of pages affected is not computed. The observations and defects behind each didactic and visual quality score are in the page record.",
        )}
      </p>
    </div>
  );
}
