import Link from "next/link";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { dataBR, num, plural } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";
import type { DestaquesVisao, DestaqueVisao, FraseVisao, IdFrase } from "@/lib/energia/tipos-visao";
import { ROTA_VISAO, ROTULO_FRASE, URL_GOLD_VISAO, textoAtualidadeFrase, textoComponentesFrase } from "@/lib/energia/visao";

/**
 * "O sistema em 60 segundos" (P004): as frases da síntese, cada uma montada no pipeline
 * por um modelo fixo a partir de números da gold de origem, com a sua data de referência,
 * a qualidade do dado (natureza, componentes estimados ou previstos, defasagem, atualidade
 * da fonte, revisões nas séries usadas) e o "Comprove este número". Ao lado, a caixa de
 * destaques: regras sobre o sistema confirmadas há pouco, com fato e hipóteses separados.
 *
 * Componente de servidor: o texto é o da gold, sem reescrita. Trecho com link leva ao
 * painel de origem; o caminho do número na gold vai no title e na tabela de auditoria.
 */
export function VisaoFrases({ frases, notas = {} }: { frases: FraseVisao[]; notas?: Partial<Record<IdFrase, string>> }) {
  return (
    <ol className="divide-y divide-linha border-y border-linha" aria-label="Fatos do sistema, um por indicador">
      {frases.map((f, i) => {
        const componentes = textoComponentesFrase(f);
        return (
          <li key={f.id} id={`frase-${f.id}`} className="scroll-mt-28 py-4">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mineral">
              <span className="rotulo text-carvao-muted">{ROTULO_FRASE[f.id]}</span>
              <span>Referência {dataBR(f.ref)}</span>
              <SeloNatureza natureza={f.natureza as Natureza} />
              {f.qualidade.atualidade?.situacao === "ATRASADO" && <span className="text-aviso">fonte atrasada</span>}
            </p>
            <p className="mt-1.5 font-serif text-lg leading-relaxed text-carvao md:text-xl">
              {f.trechos.map((t, i) =>
                t.href ? (
                  <Link key={i} href={t.href} title={t.evidencia ? `Número lido de ${t.evidencia}` : undefined} className="underline decoration-energia/50 underline-offset-4 hover:decoration-energia">
                    {t.texto}
                  </Link>
                ) : (
                  <span key={i}>{t.texto}</span>
                ),
              )}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-carvao-muted">
              {f.qualidade.texto_defasagem} {textoAtualidadeFrase(f)}
              {componentes ? ` Parte da série não é medição: ${componentes}.` : ""}
            </p>
            {notas[f.id] && (
              <p className="mt-1.5 text-xs leading-relaxed text-carvao" data-nota-frase={f.id}>
                <span className="rotulo mr-2 text-mineral">Para ler junto</span>
                {notas[f.id]}
              </p>
            )}
            <div data-nivel="analisar" className="mt-1.5 space-y-1 text-xs leading-relaxed text-carvao-muted">
              <p>Revisões: {f.qualidade.revisoes.texto}</p>
              {f.regra && <p>Regra: {f.regra}</p>}
            </div>
            <p className="mt-1">
              {f.evidencia ? (
                <ComproveNumero sobDemanda={{ url: URL_GOLD_VISAO, caminho: `frases[${i}].evidencia`, indicador: ROTULO_FRASE[f.id], valorExibido: f.evidencia.valor_exibido }} endereco={`${ROTA_VISAO}#frase-${f.id}`} />
              ) : (
                <span className="text-xs text-aviso">
                  Evidência deste número não publicada nesta execução{f.evidencia_problemas?.length ? `: ${f.evidencia_problemas.join("; ")}` : "."}
                </span>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Destaque({ d, i }: { d: DestaqueVisao; i: number }) {
  return (
    <article className="space-y-2 border-t border-linha pt-3 first:border-t-0 first:pt-0">
      <h4 className="font-medium text-carvao">
        <Link href={d.href} className="underline-offset-4 hover:underline">
          {d.titulo}
        </Link>
      </h4>
      <p className="text-sm leading-relaxed text-carvao">
        <span className="rotulo mr-2 text-energia-dark">Fato</span>
        {d.texto}
      </p>
      <p className="text-xs leading-relaxed text-carvao-muted">
        Condição desde {dataBR(d.desde)}, alerta confirmado em {dataBR(d.confirmado_em)} ({plural(d.dias, "dia", "dias")} de episódio até {dataBR(d.referencia)}). {d.normaliza_quando}{" "}
        No histórico avaliável desde {dataBR(d.historico_avaliavel_desde)} ({plural(d.dias_avaliados, "dia", "dias")}), a regra esteve em alerta em {num(d.frequencia_historica_pct, 1)}% dos dias.
      </p>
      {d.hipoteses_a_verificar.length > 0 && (
        <div>
          <p className="rotulo text-mineral">Hipóteses a verificar (não testadas nesta página)</p>
          <ul className="mt-1 space-y-1 text-sm text-carvao-muted">
            {d.hipoteses_a_verificar.map((h) => (
              <li key={h.texto}>
                <span className="mr-2 border border-dashed border-mineral px-1.5 text-xs text-carvao-muted">hipótese</span>
                {h.texto}.{" "}
                <Link href={h.onde_verificar} className="text-energia-dark underline underline-offset-4">
                  Onde verificar
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs leading-relaxed text-carvao-muted">
        <span className="text-carvao">Não implica:</span> {d.nao_implica}
      </p>
      {d.evidencia && <ComproveNumero sobDemanda={{ url: URL_GOLD_VISAO, caminho: `destaques.itens[${i}].evidencia`, indicador: d.titulo, valorExibido: d.evidencia.valor_exibido }} endereco={`${ROTA_VISAO}#destaques`} />}
    </article>
  );
}

/** Caixa de destaques: no máximo `limite` regras sobre o sistema, confirmadas há menos de `novidade_dias` dias. */
export function VisaoDestaques({ destaques, fatosEHipoteses, titulos }: { destaques: DestaquesVisao; fatosEHipoteses: string; titulos: Record<string, string> }) {
  return (
    <section id="destaques" aria-labelledby="destaques-titulo" className="scroll-mt-28 border border-linha bg-papel p-4 md:p-5">
      <h3 id="destaques-titulo" className="font-serif text-lg text-carvao">
        Quais alertas sobre o sistema foram confirmados nos últimos {plural(destaques.novidade_dias, "dia", "dias")}?
      </h3>
      <div className="mt-3 space-y-3">
        {destaques.itens.length ? (
          destaques.itens.map((d, i) => <Destaque key={d.regra} d={d} i={i} />)
        ) : (
          <p className="text-sm leading-relaxed text-carvao">{destaques.vazio ?? "Nenhum destaque nesta publicação."}</p>
        )}
        {destaques.outras_regras_em_alerta.length > 0 && (
          <p className="text-xs leading-relaxed text-carvao-muted">
            Em alerta fora da caixa: {destaques.outras_regras_em_alerta.map((o) => `${titulos[o.regra] ?? o.regra} (${o.motivo})`).join("; ")}.
          </p>
        )}
      </div>
      <p className="mt-3 border-t border-linha pt-3 text-xs leading-relaxed text-carvao-muted">{fatosEHipoteses}</p>
      <p data-nivel="analisar" className="mt-2 text-xs leading-relaxed text-carvao-muted">
        Critério da caixa: {destaques.criterio}
      </p>
    </section>
  );
}
