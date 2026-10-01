import { Bloco } from "@/components/energia/CabecalhoModulo";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { LINK_PERDAS } from "@/components/energia/PerdasPainel";
import { carimbo, num } from "@/lib/energia/formato";
import { ROTULO_ALERTA, ROTULO_DECOMPOSICAO, ROTULO_DEFINICAO, ROTULO_RECONCILIACAO } from "@/lib/energia/perdas";
import type { PerdasGold } from "@/lib/energia/tipos-perdas";

/**
 * Bloco "Auditar" comum às páginas do módulo Perdas: fechamento do balanço e alertas,
 * decomposição, mudanças de universo, conferência com o relatório da ANEEL, definições,
 * decisões de método, bloqueios externos, arquivos e o comando de reprodução, todos lidos
 * da gold (nenhum número escrito aqui).
 */
export function PerdasAuditoria({ g }: { g: PerdasGold }) {
  const ev = g.evidencias;
  const qual = g.qualidade;
  const rel = qual.comparacao_relatorio_aneel;
  const LINK = LINK_PERDAS;
  return (
    <Bloco id="auditoria" nivel="auditar">
      <section aria-labelledby="perdas-auditoria" className="border border-linha bg-superficie px-5 py-6 md:px-8">
        <h2 id="perdas-auditoria" className="font-serif text-xl text-carvao md:text-2xl">
          Como esses números foram conferidos?
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-2 text-sm leading-relaxed text-carvao">
            <h3 className="rotulo text-mineral">Balanço e alertas</h3>
            <p>
              {num(qual.agentes_no_arquivo, 0)} agentes no arquivo, {num(qual.agentes_com_balanco_de_distribuicao, 0)} com balanço de distribuição e {num(qual.agentes_ano_completos, 0)} agentes-ano
              completos. Fechamento do balanço anual: {Object.entries(qual.reconciliacao).map(([k, n]) => `${ROTULO_RECONCILIACAO[k as keyof typeof ROTULO_RECONCILIACAO] ?? k} ${num(n ?? 0, 0)}`).join("; ")} (limite de alerta: resíduo acima
              de {num(qual.limite_residuo_balanco_pct, 0)}% da injetada).
            </p>
            <p>Alertas que tiram o agente-ano das comparações: {Object.entries(qual.alertas).map(([k, n]) => `${ROTULO_ALERTA[k as keyof typeof ROTULO_ALERTA] ?? k} (${num(n ?? 0, 0)})`).join("; ")}.</p>
            <p>
              Decomposição total = técnica + não técnica:{" "}
              {Object.entries(qual.decomposicao).map(([k, n]) => `${ROTULO_DECOMPOSICAO[k as keyof typeof ROTULO_DECOMPOSICAO] ?? k} ${num(n ?? 0, 0)}`).join("; ")}.
            </p>
            <p>
              Mudanças de universo observadas na energia: {qual.mudancas_de_universo.absorcoes} absorções e {qual.mudancas_de_universo.sucessoes} sucessões prováveis,{" "}
              {qual.mudancas_de_universo.pares_com_quebra_de_escala} pares de anos com quebra de escala; CNPJ publicado com dígito inválido: {qual.mudancas_de_universo.cnpj_com_digito_invalido.join(", ") || "nenhum"}.
            </p>
            {qual.ressalvas.map((r) => (
              <p key={r} className="text-carvao-muted">
                Ressalva: {r}.
              </p>
            ))}
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-carvao">
            <h3 className="rotulo text-mineral">Conferência com o relatório da ANEEL</h3>
            <p>
              {rel.documento}. Relatório: taxa total {num(rel.valores_relatorio.taxa_total_pct, 1)}% (base {rel.valores_relatorio.base}), técnicas {num(rel.valores_relatorio.perdas_tecnicas_twh, 1)}{" "}
              TWh ({num(rel.valores_relatorio.taxa_tecnica_pct, 1)}%), não técnicas {num(rel.valores_relatorio.pnt_twh, 1)} TWh ({num(rel.valores_relatorio.pnt_injetada_pct, 1)}%). Observatório: taxa
              total {num(rel.valores_observatorio.taxa_total_pct, 2)}% (base {rel.valores_observatorio.base}), injetada de referência {num(rel.valores_observatorio.injetada_twh, 1)} TWh (publicada{" "}
              {num(rel.valores_observatorio.injetada_publicada_twh, 1)} TWh).
            </p>
            <p>{rel.leitura}</p>
            <p className="text-xs text-carvao-muted">{rel.acesso}</p>
            {ev.injetada_2024 && <ComproveNumero evidencia={ev.injetada_2024} rotulo="Comprove a injetada de 2024 e a reconciliação" />}
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="rotulo text-mineral">Definições usadas</h3>
            <dl className="mt-2 space-y-2 text-sm leading-relaxed">
              {Object.entries(g.definicoes).map(([k, t]) => (
                <div key={k}>
                  <dt className="font-medium text-carvao">{ROTULO_DEFINICAO[k as keyof typeof ROTULO_DEFINICAO] ?? k}</dt>
                  <dd className="text-carvao-muted">{t}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="rotulo text-mineral">Decisões de método</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-carvao-muted">
              {g.decisoes.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-6">
          <h3 className="rotulo text-mineral">Bloqueios externos</h3>
          <ul className="mt-2 space-y-3 text-sm leading-relaxed text-carvao">
            {g.bloqueios.map((b) => (
              <li key={b.item} className="border-l-2 border-erro pl-3">
                <p className="font-medium">{b.item}</p>
                <p className="text-carvao-muted">{b.evidencia}</p>
                <p className="text-carvao-muted">Dependência: {b.dependencia}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6">
          <h3 className="rotulo text-mineral">Arquivos e reprodução</h3>
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {g.downloads.map((d) => (
              <li key={d.url}>
                <a href={d.url} download className={LINK}>
                  {d.rotulo}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-carvao-muted">
            Reprodução: <code className="break-all text-xs">python3 pipeline/energia/executar_modulo.py perdas --sem-coleta</code> (silver data/energia/silver/aneel_distribuicao.db). Versão do pipeline{" "}
            {g.versao_pipeline}, código {g.versao_codigo ?? "não informado"}, gold gerada em {carimbo(g.gerado_em)}.
          </p>
        </div>
      </section>
    </Bloco>
  );
}
