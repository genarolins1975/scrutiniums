import { Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { LINK_PERDAS } from "@/components/energia/PerdasPainel";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { Nome } from "@/components/i18n/Nome";
import { carimbo } from "@/lib/energia/formato";
import { DEFINICOES_PERDAS_EN, TEXTOS_PERDAS_EN, traduzOuMarca } from "@/lib/energia/i18n/qualidade-perdas";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { numOu, pctOu, rotulosAlerta, rotulosDecomposicao, rotulosDefinicao, rotulosReconciliacao } from "@/lib/energia/perdas";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";

/**
 * Bloco "Auditar" comum às páginas do módulo Perdas: fechamento do balanço e alertas,
 * decomposição, mudanças de universo, conferência com o relatório da ANEEL, definições,
 * decisões de método, bloqueios externos, arquivos e o comando de reprodução, todos lidos
 * da gold (nenhum número escrito aqui; contagem ausente aparece como "sem dado", nunca zero).
 */
export function PerdasAuditoria({ g }: { g: PerdasGold }) {
  const ev = g.evidencias;
  const qual = g.qualidade;
  const rel = qual.comparacao_relatorio_aneel;
  const LINK = LINK_PERDAS;
  const idioma = idiomaEnergia();
  const ROTULO_ALERTA = rotulosAlerta(idioma);
  const ROTULO_DECOMPOSICAO = rotulosDecomposicao(idioma);
  const ROTULO_DEFINICAO = rotulosDefinicao(idioma);
  const ROTULO_RECONCILIACAO = rotulosReconciliacao(idioma);
  const daGold = (t: string, regiao: string) => traduzOuMarca(t, TEXTOS_PERDAS_EN, idioma, regiao);
  return (
    <Bloco id="auditoria" nivel="auditar">
      <SecaoDoPainel id="perdas-auditoria" nivel="auditar" titulo={tx("Como esses números foram conferidos?", "How were these numbers checked?")}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-2 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">
            <h4 className="rotulo text-mineral">{tx("Balanço e alertas", "Balance and alerts")}</h4>
            <p>
              {tx(
                <>
                  {numOu(qual.agentes_no_arquivo, 0)} agentes no arquivo, {numOu(qual.agentes_com_balanco_de_distribuicao, 0)} com balanço de distribuição e {numOu(qual.agentes_ano_completos, 0)} agentes-ano
                  completos. Fechamento do balanço anual: {Object.entries(qual.reconciliacao).map(([k, n]) => `${ROTULO_RECONCILIACAO[k as keyof typeof ROTULO_RECONCILIACAO] ?? k} ${numOu(n, 0)}`).join("; ")} (limite de alerta: resíduo acima
                  de {pctOu(qual.limite_residuo_balanco_pct, 0)} da injetada).
                </>,
                <>
                  {numOu(qual.agentes_no_arquivo, 0)} agents in the file, {numOu(qual.agentes_com_balanco_de_distribuicao, 0)} with a distribution balance and {numOu(qual.agentes_ano_completos, 0)} complete
                  agent-years. Closing of the annual balance: {Object.entries(qual.reconciliacao).map(([k, n]) => `${ROTULO_RECONCILIACAO[k as keyof typeof ROTULO_RECONCILIACAO] ?? k} ${numOu(n, 0)}`).join("; ")} (alert threshold: residual above{" "}
                  {pctOu(qual.limite_residuo_balanco_pct, 0)} of the injected energy).
                </>,
              )}
            </p>
            <p>
              {tx(
                <>Alertas que tiram o agente-ano das comparações: {Object.entries(qual.alertas).map(([k, n]) => `${ROTULO_ALERTA[k as keyof typeof ROTULO_ALERTA] ?? k} (${numOu(n, 0)})`).join("; ")}.</>,
                <>Alerts that remove the agent-year from the comparisons: {Object.entries(qual.alertas).map(([k, n]) => `${ROTULO_ALERTA[k as keyof typeof ROTULO_ALERTA] ?? k} (${numOu(n, 0)})`).join("; ")}.</>,
              )}
            </p>
            <p>
              {tx("Decomposição total = técnica + não técnica:", "Decomposition total = technical + non-technical:")}{" "}
              {Object.entries(qual.decomposicao).map(([k, n]) => `${ROTULO_DECOMPOSICAO[k as keyof typeof ROTULO_DECOMPOSICAO] ?? k} ${numOu(n, 0)}`).join("; ")}.
            </p>
            <p>
              {tx(
                <>
                  Mudanças de universo observadas na energia: {qual.mudancas_de_universo.absorcoes} absorções e {qual.mudancas_de_universo.sucessoes} sucessões prováveis,{" "}
                  {qual.mudancas_de_universo.pares_com_quebra_de_escala} pares de anos com quebra de escala; CNPJ publicado com dígito inválido: {qual.mudancas_de_universo.cnpj_com_digito_invalido.join(", ") || "nenhum"}.
                </>,
                <>
                  Universe changes observed in the energy data: {qual.mudancas_de_universo.absorcoes} probable absorptions and {qual.mudancas_de_universo.sucessoes} probable successions,{" "}
                  {qual.mudancas_de_universo.pares_com_quebra_de_escala} pairs of years with a scale break; CNPJ published with an invalid check digit: {qual.mudancas_de_universo.cnpj_com_digito_invalido.join(", ") || "none"}.
                </>,
              )}
            </p>
            {qual.ressalvas.map((r) => (
              <p key={r} className="text-carvao-muted">
                {tx("Ressalva:", "Caveat:")} {daGold(r, "ressalva-perdas")}.
              </p>
            ))}
          </div>
          <div className="min-w-0 space-y-2 text-sm leading-relaxed text-carvao [overflow-wrap:anywhere]">
            <h4 className="rotulo text-mineral">{tx("Conferência com o relatório da ANEEL", "Check against the ANEEL report")}</h4>
            <p>
              {tx(
                <>
                  {rel.documento}. Relatório: taxa total {pctOu(rel.valores_relatorio.taxa_total_pct, 1)} (base {rel.valores_relatorio.base}), técnicas {numOu(rel.valores_relatorio.perdas_tecnicas_twh, 1)}{" "}
                  TWh ({pctOu(rel.valores_relatorio.taxa_tecnica_pct, 1)}), não técnicas {numOu(rel.valores_relatorio.pnt_twh, 1)} TWh ({pctOu(rel.valores_relatorio.pnt_injetada_pct, 1)}). Observatório: taxa
                  total {pctOu(rel.valores_observatorio.taxa_total_pct, 2)} (base {rel.valores_observatorio.base}), injetada de referência {numOu(rel.valores_observatorio.injetada_twh, 1)} TWh (publicada{" "}
                  {numOu(rel.valores_observatorio.injetada_publicada_twh, 1)} TWh).
                </>,
                <>
                  {daGold(rel.documento, "documento-relatorio")}. Report: total rate {pctOu(rel.valores_relatorio.taxa_total_pct, 1)} ({daGold(rel.valores_relatorio.base, "base-relatorio")} base), technical{" "}
                  {numOu(rel.valores_relatorio.perdas_tecnicas_twh, 1)} TWh ({pctOu(rel.valores_relatorio.taxa_tecnica_pct, 1)}), non-technical {numOu(rel.valores_relatorio.pnt_twh, 1)} TWh (
                  {pctOu(rel.valores_relatorio.pnt_injetada_pct, 1)}). Observatory: total rate {pctOu(rel.valores_observatorio.taxa_total_pct, 2)} ({daGold(rel.valores_observatorio.base, "base-observatorio")}{" "}
                  base), reference injected energy {numOu(rel.valores_observatorio.injetada_twh, 1)} TWh (published {numOu(rel.valores_observatorio.injetada_publicada_twh, 1)} TWh).
                </>,
              )}
            </p>
            <p>{daGold(rel.leitura, "leitura-relatorio")}</p>
            <p className="text-xs text-carvao-muted">{daGold(rel.acesso, "acesso-relatorio")}</p>
            {ev.injetada_2024 && (
              <ComproveNumero evidencia={ev.injetada_2024} rotulo={tx("Comprove a injetada de 2024 e a reconciliação", "Check the 2024 injected energy and the reconciliation")} />
            )}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="rotulo text-mineral">{tx("Definições usadas", "Definitions used")}</h4>
            <dl className="mt-2 space-y-2 text-sm leading-relaxed">
              {Object.entries(g.definicoes).map(([k, t]) => (
                <div key={k}>
                  <dt className="font-medium text-carvao">{ROTULO_DEFINICAO[k as keyof typeof ROTULO_DEFINICAO] ?? k}</dt>
                  <dd className="text-carvao-muted">{traduzOuMarca(t, DEFINICOES_PERDAS_EN, idioma, `definicao-${k}`)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h4 className="rotulo text-mineral">{tx("Decisões de método", "Method decisions")}</h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted">
              {g.decisoes.map((d) => (
                <li key={d}>{daGold(d, "decisao-metodo")}</li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <h4 className="rotulo text-mineral">{tx("Bloqueios externos", "External blocks")}</h4>
          <ul className="mt-2 space-y-3 text-sm leading-relaxed text-carvao">
            {g.bloqueios.map((b) => (
              <li key={b.item} className="border-l-2 border-erro pl-3">
                <p className="font-medium">{daGold(b.item, "bloqueio-item")}</p>
                <p className="text-carvao-muted">{daGold(b.evidencia, "bloqueio-evidencia")}</p>
                <p className="text-carvao-muted">
                  {tx("Dependência:", "Dependency:")} {daGold(b.dependencia, "bloqueio-dependencia")}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="rotulo text-mineral">{tx("Arquivos e reprodução", "Files and reproduction")}</h4>
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {g.downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className={LINK}>
                  {daGold(d.rotulo, "arquivo-perdas")}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-carvao-muted">
            {tx("Reprodução:", "Reproduction:")}{" "}
            <code className="break-all text-xs">
              <Nome>python3 pipeline/energia/executar_modulo.py perdas --sem-coleta</Nome>
            </code>{" "}
            (<Nome>silver data/energia/silver/aneel_distribuicao.db</Nome>).{" "}
            {tx(
              <>
                Versão do pipeline {g.versao_pipeline}, código {g.versao_codigo ?? "não informado"}, gold gerada em {carimbo(g.gerado_em)}.
              </>,
              <>
                Pipeline version {g.versao_pipeline}, code {g.versao_codigo ?? "not reported"}, gold generated on {carimbo(g.gerado_em)}.
              </>,
            )}
          </p>
        </div>
      </SecaoDoPainel>
    </Bloco>
  );
}
