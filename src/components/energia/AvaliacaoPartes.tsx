import type { ReactNode } from "react";
import Link from "next/link";
import { num } from "@/lib/energia/formato";
import { datasLegiveis } from "@/lib/energia/visao";
import { ESCALA_AVALIACAO, ORDEM_DIMENSOES, ROTULO_CURTO, ROTULO_RESULTADO_JORNADA, evolucao, textoCitado as citado } from "@/lib/energia/avaliacao";
import { JornadaDetalhe } from "@/components/energia/AvaliacaoJornada";
import type { AvaliacaoGold } from "@/lib/energia/tipos-avaliacao";

/** Peças de servidor da página de avaliação (P071): jornadas, rubrica, método e evolução entre rodadas. */

const LINK = "inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao";

export function AvaliacaoJornadas({ a }: { a: AvaliacaoGold }) {
  return (
    <div className="space-y-3" data-lista="jornadas">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        As dez jornadas da seção 15.2 da especificação, executadas como roteiro por script em Chromium, sem participante humano. Cada passo verifica um fato observável: texto, URL, valor ou arquivo baixado. Roteiro cumprido mostra que o caminho existe e funciona; não mede se uma pessoa
        o encontraria sozinha.
      </p>
      <ul className="space-y-3">
        {a.jornadas.map((j) => (
          <li key={j.id} className="border border-linha bg-superficie p-3" data-jornada={j.id} data-resultado={j.resultado}>
            <JornadaDetalhe
              id={j.id}
              resumo={
                <>
                  <span className="rotulo mr-2 text-mineral">{j.id}</span>
                  {j.perfil}: <strong className="font-medium">{ROTULO_RESULTADO_JORNADA[j.resultado].toLowerCase()}</strong>, {j.passos_ok} de {j.passos_total} passos, {j.cliques} interações{j.movel ? ", em celular (390 px)" : ""}
                </>
              }
            >
              <p className="mt-2 text-sm text-carvao">{citado(j.titulo)}</p>
              {(j.atritos ?? []).length > 0 && (
                <div className="mt-2">
                  <p className="rotulo text-mineral">Atritos encontrados</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
                    {(j.atritos ?? []).map((t) => (
                      <li key={t}>{citado(t)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {j.limite && <p className="mt-2 text-xs leading-relaxed text-carvao-muted">Limite: {j.limite}</p>}
            </JornadaDetalhe>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AvaliacaoEvolucao({ a }: { a: AvaliacaoGold }) {
  const linhas = evolucao(a);
  return (
    <div className="space-y-3" data-lista="evolucao">
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Evolução entre rodadas (tabela rolável)">
        <table className="w-full border-collapse text-sm tabular-nums">
          <caption className="pb-2 text-left text-sm font-medium text-carvao">Rodadas de avaliação registradas</caption>
          <thead>
            <tr className="border-b border-linha text-left text-xs text-mineral">
              {["Rodada", "Data", "Páginas", "Dimensões com nota", "Nota ponderada média das dimensões avaliadas", "Atendem a meta", "Defeitos: crítico / alto / médio / baixo", "Jornadas cumpridas"].map((c) => (
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
                <td className="px-2 py-1.5">{l.dimensoes} de 10</td>
                <td className="px-2 py-1.5">{l.nota}</td>
                <td className="px-2 py-1.5">{l.atendem}</td>
                <td className="px-2 py-1.5">{l.defeitos}</td>
                <td className="px-2 py-1.5">{l.jornadas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Média por dimensão em cada rodada (tabela rolável)">
        <table className="w-full border-collapse text-sm tabular-nums">
          <caption className="pb-2 text-left text-sm font-medium text-carvao">Média das páginas em cada dimensão, por rodada (n.av.: dimensão não avaliada na rodada)</caption>
          <thead>
            <tr className="border-b border-linha text-left text-xs text-mineral">
              <th scope="col" className="px-2 py-1.5 font-medium">
                Rodada
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
                    {v === null ? "n.av." : num(v, 1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a.rodadas.some((r) => r.reprocessada || (r.ajustes_do_metodo ?? []).length > 0) && (
        <div data-ajustes-do-metodo="true">
          <p className="rotulo text-mineral">O que mudou no método entre as rodadas</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
            {a.rodadas.flatMap((r) => [
              ...(r.reprocessada ? [<li key={`${r.id}-rep`}>{`Rodada ${r.id} recalculada: ${r.reprocessada}`}</li>] : []),
              ...(r.ajustes_do_metodo ?? []).map((t) => <li key={`${r.id}-${t}`}>{`Rodada ${r.id}: ${t}`}</li>),
            ])}
          </ul>
        </div>
      )}
      {a.corrigidos.length > 0 ? (
        <div>
          <p className="rotulo text-mineral">Defeitos corrigidos desde a rodada anterior</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-carvao-muted">
            {a.corrigidos.map((c) => (
              <li key={c.chave}>{citado(c.descricao)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-carvao-muted">Nenhum defeito da rodada anterior foi dado como corrigido nesta rodada.</p>
      )}
    </div>
  );
}

export function AvaliacaoRubrica({ a }: { a: AvaliacaoGold }) {
  const m = a.rubrica.metas;
  return (
    <div className="space-y-4" data-lista="rubrica">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Rubrica {a.versao_rubrica}. Escala de 0 a 10, truncada em uma casa decimal: nota inferior nunca é arredondada para cima. Meta de produto: todas as dimensões a partir de {num(m.geral, 1)}, didatismo e qualidade visual a partir de {num(m.didatismo, 1)} e nenhum defeito crítico. Nota só existe com evidência medida
        ou revisão registrada; o que não foi testado aparece como não avaliado e não satisfaz o aceite. Os pontos de cada dedução e os limiares são decisão de revisão registrada aqui, não norma externa.
      </p>
      <ul className="space-y-3">
        {ORDEM_DIMENSOES.map((id) => {
          const d = a.rubrica.dimensoes.find((x) => x.id === id)!;
          return (
            <li key={id} className="border border-linha bg-superficie p-3" data-rubrica={id}>
              <details>
                <summary className="cursor-pointer text-sm text-carvao">
                  <strong className="font-medium">{d.nome}</strong> · peso {d.peso}% · nota de {d.fonte_da_nota === "revisao" ? "revisor em contexto limpo" : d.fonte_da_nota === "medicao" ? "medição" : "evidência das golds e dos testes"}
                </summary>
                <p className="mt-2 text-xs text-mineral">Evidência exigida: {d.evidencia}.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
                  {d.regras.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  {d.tetos.map((t) => (
                    <li key={t.motivo}>
                      Teto{t.valor === null ? " variável" : ` ${num(t.valor, 1)}`}: {t.motivo}.
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
      <p className="max-w-prose2">{a.metodo.resumo}</p>
      <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        <div>
          <dt className="rotulo text-mineral">Rodada</dt>
          <dd className="mt-0.5">
            {rod.id}; inspeção gerada em {rod.inspecao_gerada_em ? datasLegiveis(rod.inspecao_gerada_em) : "data não registrada"}; código {a.versao_codigo ?? "não informado"}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Navegador</dt>
          <dd className="mt-0.5">{rod.navegador}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Larguras e modos</dt>
          <dd className="mt-0.5">
            {rod.larguras.join(", ")} px; modos {rod.modos.join(" e ")} (em Auditar, só 390 e 1440 px)
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">
            {rod.rotas_medidas} de {rod.rotas_construidas ?? "número não registrado"} rotas construídas; as famílias dinâmicas foram amostradas (seis páginas de cada)
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="rotulo text-mineral">Scripts e entradas</dt>
          <dd className="mt-0.5 [overflow-wrap:anywhere]">
            {a.metodo.scripts.join("; ")}; entradas versionadas em {a.metodo.entradas}
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
  return (
    <figure className="space-y-2" data-matriz="aceite">
      <figcaption className="text-sm font-medium text-carvao">Média das páginas de cada entrega, por dimensão (nota de 0 a 10)</figcaption>
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Matriz de aceite e evidência (tabela rolável)">
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b border-linha text-left text-xs text-mineral">
              <th scope="col" className="sticky left-0 bg-superficie px-2 py-1.5 font-medium">
                Entrega (páginas)
              </th>
              {ORDEM_DIMENSOES.map((i) => (
                <th key={i} scope="col" className="px-2 py-1.5 text-center font-medium">
                  {ROTULO_CURTO[i]}
                </th>
              ))}
              <th scope="col" className="px-2 py-1.5 text-center font-medium">
                Ponderada
              </th>
              <th scope="col" className="px-2 py-1.5 text-center font-medium">
                Atendem a meta
              </th>
            </tr>
          </thead>
          <tbody>
            {a.modulos.map((m) => (
              <tr key={m.id} className="border-b border-linha text-carvao" data-entrega={m.id}>
                <th scope="row" className="sticky left-0 bg-superficie px-2 py-1.5 text-left font-normal">
                  {m.rotulo} <span className="text-mineral">({m.paginas})</span>
                </th>
                {ORDEM_DIMENSOES.map((i) => {
                  const d = m.dimensoes[i];
                  const f = faixa(d.media);
                  return (
                    <td key={i} className={`px-2 py-1.5 text-center ${f ? f.texto : "text-mineral"}`} style={f ? { background: f.fundo } : undefined} data-dimensao={i}>
                      {d.media === null ? (d.nao_avaliadas ? "n.av." : "n.ap.") : num(d.media, 1)}
                    </td>
                  );
                })}
                <td className={`px-2 py-1.5 text-center ${faixa(m.nota_ponderada)?.texto ?? "text-mineral"}`} style={faixa(m.nota_ponderada) ? { background: faixa(m.nota_ponderada)!.fundo } : undefined} data-coluna="ponderada">
                  {m.nota_ponderada === null ? "n.av." : num(m.nota_ponderada, 1)}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {m.atendem_meta} de {m.paginas}
                </td>
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
        <span>n.av.: não avaliada; n.ap.: não se aplica</span>
      </p>
    </figure>
  );
}

/** Problemas que cada revisor viu se repetirem em várias páginas do seu grupo (texto dos revisores, sem contagem). */
export function AvaliacaoRevisao({ a }: { a: AvaliacaoGold }) {
  const r = a.revisao;
  return (
    <div className="space-y-3" data-lista="revisao">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{r.metodo}</p>
      <ul className="space-y-3">
        {r.revisores.map((x) => (
          <li key={x.id} className="border border-linha bg-superficie p-3" data-revisor={x.id}>
            <p className="text-sm text-carvao">
              <span className="rotulo mr-2 text-mineral">{x.id}</span>
              {x.escopo}, {x.paginas} páginas
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-carvao-muted">
              {(r.problemas_entre_paginas[x.id] ?? []).map((t) => (
                <li key={t}>{citado(t)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        Cada revisor viu só o seu grupo de páginas, e os problemas aparecem como ele os escreveu: a contagem de páginas afetadas não é calculada. O que cada nota de didatismo e de qualidade visual teve de observação e de defeito está na ficha da página.
      </p>
    </div>
  );
}
