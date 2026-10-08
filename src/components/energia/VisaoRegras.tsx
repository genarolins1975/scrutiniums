import type { ReactNode } from "react";
import Link from "next/link";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { VisaoFaixaEstados } from "@/components/energia/VisaoFaixaEstados";
import { carimbo, dataBR, num, plural } from "@/lib/energia/formato";
import type { RegraObservar } from "@/lib/energia/tipos-visao";
import { ROTA_VISAO, URL_GOLD_VISAO, comUnidade, conjuntosLegiveis, datasLegiveis, somaDias, textoLinhaEstado, textoValorRegra, trechosEstado } from "@/lib/energia/visao";
import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";

/**
 * Conteúdo de cada regra do "O que observar" (P007), montado no servidor e entregue ao
 * componente cliente que filtra a lista: o resumo (texto do dia com os números da gold de
 * origem, valor avaliado com os limiares, "Comprove este número" e a linha de estado dos
 * últimos 365 dias) e o detalhe (condição, limiar, duração mínima, regra de retorno,
 * materialidade, o que o alerta não implica, hipóteses rotuladas, episódio em curso,
 * frequência de disparo no histórico e o registro das publicações).
 */

/** `caminho` é o lugar da regra na gold ("observar[3]"), para a ficha de prova ser lida sob demanda. */
export function VisaoRegraResumo({
  o,
  caminho,
  nota,
  titulosConjuntos = {},
}: {
  o: RegraObservar;
  caminho?: string;
  nota?: string | null;
  /** Título de cada conjunto no painel de saúde dos dados, para o texto do leitor não citar o identificador interno. */
  titulosConjuntos?: Readonly<Record<string, string>>;
}) {
  const valor = textoValorRegra(o);
  const evidencia = conjuntosLegiveis(datasLegiveis(o.evidencia), titulosConjuntos);
  const le = o.linha_estado;
  const trechos = trechosEstado(le);
  const fim = le?.inicio && le.estados ? somaDias(le.inicio, le.estados.length - 1) : null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm leading-relaxed text-carvao-muted">
        <TextoDoLeitor texto={evidencia.texto} />
        {evidencia.ids.length > 0 && <span data-nivel="analisar"> Identificador do conjunto: {evidencia.ids.join(", ")}.</span>}
      </p>
      {nota && (
        <p className="text-xs leading-relaxed text-carvao" data-nota-regra={o.id}>
          <span className="rotulo mr-2 text-mineral">Para ler junto</span>
          {nota}
        </p>
      )}
      {valor && (
        <p className="text-xs text-carvao-muted">
          <span className="text-carvao">Valor avaliado:</span> {valor}
          {o.defasagem_dias !== null && o.defasagem_dias > 0 ? ` · referência ${plural(o.defasagem_dias, "dia", "dias")} antes do processamento` : ""}
        </p>
      )}
      {o.evidencia_numero ? (
        caminho ? (
          <ComproveNumero sobDemanda={{ url: URL_GOLD_VISAO, caminho: `${caminho}.evidencia_numero`, indicador: o.titulo, valorExibido: o.evidencia_numero.valor_exibido }} endereco={`${ROTA_VISAO}#regra-${o.id}`} />
        ) : (
          <ComproveNumero evidencia={o.evidencia_numero} endereco={`${ROTA_VISAO}#regra-${o.id}`} />
        )
      ) : o.evidencia_problemas?.length ? (
        <p className="text-xs text-aviso">Evidência do número não publicada: {o.evidencia_problemas.join("; ")}</p>
      ) : null}
      {le?.inicio && fim && trechos.length > 0 && (
        <div className="pt-1">
          <VisaoFaixaEstados trechos={trechos} inicio={le.inicio} fim={fim} rotulo={`Linha de estado de ${o.titulo}: ${textoLinhaEstado(o) ?? ""}`} />
          <p className="mt-0.5 flex justify-between text-[11px] text-mineral" aria-hidden="true">
            <span>{dataBR(le.inicio)}</span>
            <span>{dataBR(fim)}</span>
          </p>
          <p className="text-xs text-carvao-muted">{textoLinhaEstado(o)}</p>
        </div>
      )}
    </div>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="rotulo text-mineral">{rotulo}</dt>
      <dd className="mt-0.5 text-sm leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function VisaoRegraDetalhe({ o }: { o: RegraObservar }) {
  const h = o.historico;
  const ep = o.episodio_atual;
  const seq = o.sequencia_atual;
  const re = o.registro_emissoes;
  return (
    <div className="space-y-3">
      <dl className="grid gap-3 md:grid-cols-2">
        <Item rotulo="Condição">{o.condicao}</Item>
        {o.limiar && <Item rotulo="Limiar">{o.limiar}</Item>}
        <Item rotulo="Duração mínima e retorno">
          {o.duracao_minima_dias !== null ? `${plural(o.duracao_minima_dias, "dia seguido", "dias seguidos")} com a condição para confirmar o alerta. ` : "Sem duração mínima (regra de estado). "}
          {o.regra_retorno}
        </Item>
        <Item rotulo="Materialidade">{o.materialidade}</Item>
        <Item rotulo="O que o alerta não implica">
          {o.nao_implica} {o.alerta_nao_implica_causa}
        </Item>
        {o.hipoteses.length > 0 && (
          <Item rotulo="Hipóteses a verificar (não testadas nesta página)">
            <ul className="space-y-1">
              {o.hipoteses.map((x) => (
                <li key={x.texto}>
                  <span className="mr-2 border border-dashed border-mineral px-1.5 text-xs">hipótese</span>
                  {x.texto}.{" "}
                  <Link href={x.onde_verificar} className="text-energia-dark underline underline-offset-4">
                    Onde verificar
                  </Link>
                </li>
              ))}
            </ul>
          </Item>
        )}
      </dl>
      {(ep || seq) && (
        <p className="text-sm text-carvao-muted">
          {ep
            ? `Episódio em curso: condição desde ${dataBR(ep.inicio)}, alerta confirmado em ${dataBR(ep.confirmado_em)}, ${plural(ep.duracao_dias, "dia", "dias")} até ${dataBR(ep.fim)}.`
            : seq
              ? `Condição presente desde ${dataBR(seq.inicio)} (${plural(seq.dias, "dia", "dias")}), ainda sem a duração mínima de ${plural(o.duracao_minima_dias ?? 0, "dia", "dias")}.`
              : ""}
        </p>
      )}
      {h ? (
        <p className="text-sm leading-relaxed text-carvao-muted">
          Histórico reavaliado com os dados da data de processamento, avaliável desde {dataBR(h.primeiro_dia_avaliado)} ({plural(h.dias_avaliados, "dia", "dias")} avaliados): condição em{" "}
          {num(h.pct_dias_com_condicao, 1)}% dos dias e alerta exibido em {num(h.pct_dias_exibidos, 1)}%; {plural(h.episodios, "episódio", "episódios")}
          {h.episodios_por_ano !== null ? ` (${num(h.episodios_por_ano, 1)} por ano)` : " (frequência anual não estimável com menos de um ano avaliado)"}; {plural(h.acionamentos_brutos, "acionamento", "acionamentos")}, dos quais{" "}
          {plural(h.acionamentos_curtos_descartados, "foi descartado", "foram descartados")} por durar menos que o mínimo
          {h.duracao_mediana_dias !== null ? `; duração mediana de ${num(h.duracao_mediana_dias, 1)} dias e máxima de ${plural(h.duracao_maxima_dias ?? 0, "dia", "dias")}` : ""}.
        </p>
      ) : (
        o.historico_nao_se_aplica && <p className="text-sm text-carvao-muted">{o.historico_nao_se_aplica}</p>
      )}
      {o.limites_vigentes && (
        <p className="text-sm text-carvao-muted">
          Limites vigentes em {dataBR(o.limites_vigentes.data)}: piso {comUnidade(o.limites_vigentes.pld_min, "R$/MWh", 2)} ({o.limites_vigentes.ato_pld_min}); teto horário{" "}
          {comUnidade(o.limites_vigentes.pld_max_horario, "R$/MWh", 2)} ({o.limites_vigentes.ato_pld_max_horario}); teto estrutural{" "}
          {comUnidade(o.limites_vigentes.pld_max_estrutural, "R$/MWh", 2)} ({o.limites_vigentes.ato_pld_max_estrutural}).
          {o.conferencia_limites ? ` Conferência com a Regulação: ${o.conferencia_limites.resultado === "aprovado" ? "valores iguais" : "com ressalva"}.` : ""}
        </p>
      )}
      {o.conjuntos_avaliados && (
        <p data-nivel="auditar" className="text-sm text-carvao-muted [overflow-wrap:anywhere]">
          Conjuntos avaliados: {o.conjuntos_avaliados.join(", ")}.
        </p>
      )}
      {o.coleta_direta && (
        <p data-nivel="auditar" className="text-sm text-carvao-muted">
          Última tentativa de coleta direta registrada: {o.coleta_direta.tentado_em ? carimbo(o.coleta_direta.tentado_em) : "sem registro"}
          {o.coleta_direta.ok === false ? ", sem sucesso" : o.coleta_direta.ok ? ", com sucesso" : ""} ({o.coleta_direta.fonte}).
        </p>
      )}
      {o.bloqueios_registrados && o.bloqueios_registrados.length > 0 && (
        <ul data-nivel="auditar" className="space-y-1 text-sm text-carvao-muted [overflow-wrap:anywhere]">
          {o.bloqueios_registrados.map((b) => (
            <li key={b.fonte + b.evidencia}>
              Bloqueio registrado ({b.origem}): {b.fonte}. {b.evidencia}
            </li>
          ))}
        </ul>
      )}
      <p data-nivel="auditar" className="text-xs leading-relaxed text-carvao-muted">
        Registro das publicações: {plural(re.publicacoes_registradas, "publicação aceita registrada", "publicações aceitas registradas")}
        {re.inicio ? ` desde ${carimbo(re.inicio)}` : ""}; {plural(re.emitidos, "alerta emitido", "alertas emitidos")}
        {re.nao_confirmados_apos_revisao !== null ? `; ${plural(re.nao_confirmados_apos_revisao, "não confirmado", "não confirmados")} depois da revisão da fonte` : ""}. {re.nota} Versão da regra{" "}
        {o.versao_regra}; medida {o.metrica ?? "sem medida no catálogo"}.
      </p>
      <p className="text-sm">
        <Link href={o.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
          Ver os dados no painel de origem
        </Link>
      </p>
    </div>
  );
}
