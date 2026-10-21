import Link from "@/components/energia/LinkSemPrefetch";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { dataBR, num, plural } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";
import type { DestaquesVisao, DestaqueVisao, EstadoRegra, FraseVisao, IdFrase } from "@/lib/energia/tipos-visao";
import { ROTA_VISAO, URL_GOLD_VISAO, minuscula, rotuloEstado, rotuloFrase, textoAtualidadeFrase, textoComponentesFrase, textoRevisoesFraseEn, trechosFraseEn } from "@/lib/energia/visao";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { comCodigo, goldEmString, goldNoBloco, valorProvaNoIdioma } from "@/lib/energia/i18n/entrada-visao";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import type { ReactNode } from "react";

/**
 * "O sistema em 60 segundos" (P004): as frases da síntese, cada uma montada no pipeline
 * por um modelo fixo a partir de números da gold de origem, com a sua data de referência,
 * a qualidade do dado (natureza, componentes estimados ou previstos, defasagem, atualidade
 * da fonte, revisões nas séries usadas) e o "Comprove este número". Ao lado, a caixa de
 * destaques: regras sobre o sistema confirmadas há pouco, com fato e hipóteses separados.
 *
 * Componente de servidor: o texto é o da gold, sem reescrita. Trecho com link leva ao
 * painel de origem; o caminho do número na gold vai no title e na tabela de auditoria.
 * A frase de um indicador que tem regra em alerta ou em observação leva a marca da regra,
 * com ligação para ela no "O que observar": o leitor do topo não lê o número sem saber.
 */
export type MarcaDeRegra = { id: string; titulo: string; estado: EstadoRegra };

export function VisaoFrases({
  frases,
  notas = {},
  marcas = {},
}: {
  frases: FraseVisao[];
  notas?: Partial<Record<IdFrase, string>>;
  marcas?: Partial<Record<IdFrase, readonly MarcaDeRegra[]>>;
}) {
  const idioma = idiomaEnergia();
  return (
    <>
    <p className="mb-2 text-xs leading-relaxed text-carvao-muted" data-termos-frases="">
      {tx("p.p. quer dizer pontos percentuais; MWmed, megawatt médio.", "p.p. means percentage points; MWavg, average megawatts.")}
    </p>
    <ol className="divide-y divide-linha border-y border-linha" aria-label={tx("Fatos do sistema, um por indicador", "Facts about the system, one per indicator")}>
      {frases.map((f, i) => {
        const componentes = textoComponentesFrase(f, idioma);
        // a frase inglesa sai do modelo do pipeline com os mesmos números e links; sem modelo reconhecido, a portuguesa vai marcada
        const trechosEn = idioma === "en" ? trechosFraseEn(f) : null;
        const trechos = trechosEn ?? f.trechos;
        const corpo = trechos.map((t, k) =>
          t.href ? (
            <Link
              key={k}
              href={t.href}
              title={t.evidencia ? tx(`Número lido de ${t.evidencia}`, `Number read from ${t.evidencia}`) : undefined}
              className="underline decoration-energia/50 underline-offset-4 hover:decoration-energia"
            >
              {t.texto}
            </Link>
          ) : (
            <span key={k}>{t.texto}</span>
          ),
        );
        const revisoes = idioma === "en" ? textoRevisoesFraseEn(f.qualidade.revisoes) : null;
        return (
          <li key={f.id} id={`frase-${f.id}`} className="scroll-mt-28 py-4">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mineral">
              <span className="rotulo text-carvao-muted">{rotuloFrase(f.id, idioma)}</span>
              <span>{tx(`Referência ${dataBR(f.ref)}`, `Reference date ${dataBR(f.ref)}`)}</span>
              <SeloNatureza natureza={f.natureza as Natureza} />
              {f.qualidade.atualidade?.situacao === "ATRASADO" && <span className="text-aviso">{tx("fonte atrasada", "late source")}</span>}
            </p>
            <p className="mt-1.5 font-serif text-lg leading-relaxed text-carvao md:text-xl">
              {idioma === "en" && !trechosEn ? <TrechoPortugues regiao={`visao-frase-${f.id}`}>{corpo}</TrechoPortugues> : corpo}
            </p>
            {/* diagnóstico de layout de 20/10/2026, item 7: a defasagem desce para Analisar; o que não é medição e a ponte entre números que
                diferem (carga, rede) ficam à vista */}
            <p data-nivel="analisar" className="mt-1.5 text-xs leading-relaxed text-carvao-muted">
              {goldNoBloco(f.qualidade.texto_defasagem, idioma, `visao-frase-defasagem-${f.id}`)} {textoAtualidadeFrase(f, idioma)}
            </p>
            {componentes && (
              <p className="mt-1.5 text-xs leading-relaxed text-carvao-muted" data-nao-medicao={f.id}>
                {tx(`Parte da série não é medição: ${componentes}.`, `Part of the series is not a measurement: ${componentes}.`)}
              </p>
            )}
            {(marcas[f.id] ?? []).map((r) => (
              <p key={r.id} className="mt-1.5 text-xs leading-relaxed text-carvao" data-marca-regra={r.id}>
                <span className="rotulo mr-2 text-mineral">{rotuloEstado(r.estado, idioma)}</span>
                {tx("A regra", "The rule")}{" "}
                <Link href={`#regra-${r.id}`} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
                  {minuscula(goldEmString(r.titulo, idioma))}
                </Link>{" "}
                {tx(
                  <>avalia este indicador{r.estado === "em_observacao" ? ": a condição está presente, ainda sem a duração mínima para virar alerta" : ""}.</>,
                  <>assesses this indicator{r.estado === "em_observacao" ? ": the condition is present, still without the minimum duration to become an alert" : ""}.</>,
                )}
              </p>
            ))}
            {notas[f.id] && (
              <p className="mt-1.5 text-xs leading-relaxed text-carvao" data-nota-frase={f.id}>
                <span className="rotulo mr-2 text-mineral">{tx("Para ler junto", "Read together")}</span>
                {notas[f.id]}
              </p>
            )}
            <div data-nivel="analisar" className="mt-1.5 space-y-1 text-xs leading-relaxed text-carvao-muted">
              <p>
                {tx("Revisões:", "Revisions:")} {revisoes ? comCodigo(revisoes) : goldNoBloco(f.qualidade.revisoes.texto, idioma, `visao-frase-revisoes-${f.id}`)}
              </p>
              {f.regra && (
                <p>
                  {tx("Regra:", "Rule:")} {goldNoBloco(f.regra, idioma, `visao-frase-regra-${f.id}`)}
                </p>
              )}
            </div>
            <p className="mt-1">
              {f.evidencia ? (
                <ComproveNumero
                  sobDemanda={{ url: URL_GOLD_VISAO, caminho: `frases[${i}].evidencia`, indicador: rotuloFrase(f.id, idioma), valorExibido: valorProvaNoIdioma(f.evidencia.valor_exibido, idioma) }}
                  endereco={`${ROTA_VISAO}#frase-${f.id}`}
                />
              ) : (
                <span className="text-xs text-aviso">
                  {tx("Evidência deste número não publicada nesta execução", "Evidence for this number not published in this run")}
                  {f.evidencia_problemas?.length ? <>: {goldNoBloco(f.evidencia_problemas.join("; "), idioma, `visao-frase-problemas-${f.id}`)}</> : "."}
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ol>
    </>
  );
}

function Destaque({ d, i }: { d: DestaqueVisao; i: number }) {
  const idioma = idiomaEnergia();
  const g = (t: string, regiao: string) => goldNoBloco(t, idioma, `visao-destaque-${d.regra}-${regiao}`);
  return (
    <article className="space-y-2 border-t border-linha pt-3 first:border-t-0 first:pt-0">
      <h4 className="font-medium text-carvao">
        <Link href={d.href} className="underline-offset-4 hover:underline">
          {g(d.titulo, "titulo")}
        </Link>
      </h4>
      <p className="text-sm leading-relaxed text-carvao">
        <span className="rotulo mr-2 text-energia-dark">{tx("Fato", "Fact")}</span>
        {g(d.texto, "texto")}
      </p>
      <p className="text-xs leading-relaxed text-carvao-muted">
        {tx(
          <>
            Condição desde {dataBR(d.desde)}, alerta confirmado em {dataBR(d.confirmado_em)} ({plural(d.dias, "dia", "dias")} de episódio até {dataBR(d.referencia)}).
          </>,
          <>
            Condition since {dataBR(d.desde)}, alert confirmed on {dataBR(d.confirmado_em)} ({plural(d.dias, "day", "days")} of episode through {dataBR(d.referencia)}).
          </>,
        )}{" "}
        {g(d.normaliza_quando, "normaliza")}{" "}
        {tx(
          <>
            No histórico avaliável desde {dataBR(d.historico_avaliavel_desde)} ({plural(d.dias_avaliados, "dia", "dias")}), a regra esteve em alerta em {num(d.frequencia_historica_pct, 1)}% dos dias.
          </>,
          <>
            In the assessable history since {dataBR(d.historico_avaliavel_desde)} ({plural(d.dias_avaliados, "day", "days")}), the rule was in alert on {num(d.frequencia_historica_pct, 1)}% of the days.
          </>,
        )}
      </p>
      {d.hipoteses_a_verificar.length > 0 && (
        <div>
          <p className="rotulo text-mineral">{tx("Hipóteses a verificar (não testadas nesta página)", "Hypotheses to check (not tested on this page)")}</p>
          <ul className="mt-1 space-y-1 text-sm text-carvao-muted">
            {d.hipoteses_a_verificar.map((h) => (
              <li key={h.texto}>
                <span className="mr-2 border border-dashed border-mineral px-1.5 text-xs text-carvao-muted">{tx("hipótese", "hypothesis")}</span>
                {g(h.texto, "hipotese")}.{" "}
                <Link href={h.onde_verificar} className="text-energia-dark underline underline-offset-4">
                  {tx("Onde verificar", "Where to check")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs leading-relaxed text-carvao-muted">
        <span className="text-carvao">{tx("Não implica:", "Does not imply:")}</span> {g(d.nao_implica, "nao-implica")}
      </p>
      {d.evidencia && (
        <ComproveNumero
          sobDemanda={{ url: URL_GOLD_VISAO, caminho: `destaques.itens[${i}].evidencia`, indicador: goldEmString(d.titulo, idioma), valorExibido: valorProvaNoIdioma(d.evidencia.valor_exibido, idioma) }}
          endereco={`${ROTA_VISAO}#destaques`}
        />
      )}
    </article>
  );
}

/** Caixa de destaques: no máximo `limite` regras sobre o sistema, confirmadas há menos de `novidade_dias` dias. */
export function VisaoDestaques({ destaques, fatosEHipoteses, titulos }: { destaques: DestaquesVisao; fatosEHipoteses: string; titulos: Record<string, string> }) {
  const idioma = idiomaEnergia();
  return (
    <section id="destaques" aria-labelledby="destaques-titulo" className="scroll-mt-28 border border-linha bg-papel p-4 md:p-5">
      <h3 id="destaques-titulo" className="font-serif text-lg text-carvao">
        {tx(
          <>Quais alertas sobre o sistema foram confirmados nos últimos {plural(destaques.novidade_dias, "dia", "dias")}?</>,
          <>Which alerts about the system were confirmed in the last {plural(destaques.novidade_dias, "day", "days")}?</>,
        )}
      </h3>
      <div className="mt-3 space-y-3">
        {destaques.itens.length ? (
          destaques.itens.map((d, i) => <Destaque key={d.regra} d={d} i={i} />)
        ) : (
          <p className="text-sm leading-relaxed text-carvao">
            {destaques.vazio ? goldNoBloco(destaques.vazio, idioma, "visao-destaques-vazio") : tx("Nenhum destaque nesta publicação.", "No highlight in this publication.")}
          </p>
        )}
        {destaques.outras_regras_em_alerta.length > 0 && (
          <p className="text-xs leading-relaxed text-carvao-muted">
            {tx<ReactNode>(
              `Em alerta fora da caixa: ${destaques.outras_regras_em_alerta.map((o) => `${titulos[o.regra] ?? o.regra} (${o.motivo})`).join("; ")}.`,
              <>
                In alert outside the box:{" "}
                {destaques.outras_regras_em_alerta.map((o, k) => (
                  <span key={o.regra}>
                    {k > 0 && "; "}
                    {goldNoBloco(titulos[o.regra] ?? o.regra, idioma, `visao-destaques-fora-${o.regra}`)} ({goldNoBloco(o.motivo, idioma, `visao-destaques-motivo-${o.regra}`)})
                  </span>
                ))}
                .
              </>,
            )}
          </p>
        )}
      </div>
      <p className="mt-3 border-t border-linha pt-3 text-xs leading-relaxed text-carvao-muted">{goldNoBloco(fatosEHipoteses, idioma, "visao-fatos-e-hipoteses")}</p>
      <p data-nivel="analisar" className="mt-2 text-xs leading-relaxed text-carvao-muted">
        {tx("Critério da caixa:", "Box criterion:")} {goldNoBloco(destaques.criterio, idioma, "visao-destaques-criterio")}
      </p>
    </section>
  );
}

