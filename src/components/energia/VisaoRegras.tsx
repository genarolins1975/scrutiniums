import type { ReactNode } from "react";
import Link from "@/components/energia/LinkSemPrefetch";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { VisaoFaixaEstados } from "@/components/energia/VisaoFaixaEstados";
import { carimbo, dataBR, num, plural } from "@/lib/energia/formato";
import type { RegraObservar } from "@/lib/energia/tipos-visao";
import { ROTA_VISAO, URL_GOLD_VISAO, comUnidade, conjuntosLegiveis, datasLegiveis, enumLegivel, somaDias, textoLinhaEstado, textoValorRegra, trechosEstado } from "@/lib/energia/visao";
import { TextoDoLeitor } from "@/components/energia/TextoDoLeitor";
import { TextoEnergia } from "@/components/energia/TextoEnergia";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { partirBastidor } from "@/lib/energia/bastidor";
import { idiomaEnergia, tx, tx as txNoIdioma } from "@/lib/energia/idioma";
import { goldEmString, goldNoBloco, traduzModeloDaGold } from "@/lib/energia/i18n/entrada-visao";
import type { Idioma } from "@/lib/idioma";

/**
 * O texto do dia de uma regra na página inglesa: a forma inglesa do modelo (mesmos números e datas), com os títulos de conjunto
 * (nomes em português do painel de saúde dos dados) marcados como nome próprio e as frases de bastidor em Analisar.
 */
function EvidenciaEmIngles({ texto, titulos }: { texto: string; titulos: readonly string[] }) {
  const { leitor, tecnico } = partirBastidor(texto);
  const marcar = (t: string) => {
    if (!titulos.length) return t;
    const re = new RegExp(`(${titulos.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
    return t.split(re).map((parte, i) => (titulos.includes(parte) ? <Nome key={i}>{parte}</Nome> : parte));
  };
  return (
    <>
      {marcar(leitor)}
      {tecnico && (
        <span data-nivel="analisar">
          {leitor ? " " : ""}
          {marcar(tecnico)}
        </span>
      )}
    </>
  );
}

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
  const idioma = idiomaEnergia();
  const valor = textoValorRegra(o, idioma);
  const titulo = goldEmString(o.titulo, idioma);
  // o texto do dia: em inglês, a forma do modelo com os mesmos números; sem modelo reconhecido, o português marcado
  const evidenciaEn = idioma === "en" ? traduzModeloDaGold(o.evidencia) : null;
  const evidencia = conjuntosLegiveis(evidenciaEn ?? enumLegivel(datasLegiveis(o.evidencia, "pt"), "pt"), titulosConjuntos);
  const titulosUsados = evidencia.ids.map((id) => titulosConjuntos[id]).filter(Boolean);
  const le = o.linha_estado;
  const trechos = trechosEstado(le);
  const fim = le?.inicio && le.estados ? somaDias(le.inicio, le.estados.length - 1) : null;
  return (
    <div className="space-y-1.5">
      <p className="text-sm leading-relaxed text-carvao-muted">
        {idioma !== "en" ? (
          <TextoDoLeitor texto={evidencia.texto} />
        ) : evidenciaEn ? (
          <EvidenciaEmIngles texto={evidencia.texto} titulos={titulosUsados} />
        ) : (
          <TrechoPortugues regiao={`visao-regra-evidencia-${o.id}`}>
            <TextoDoLeitor texto={evidencia.texto} />
          </TrechoPortugues>
        )}
        {evidencia.ids.length > 0 && (
          <span data-nivel="analisar">
            {" "}
            {tx("Identificador do conjunto:", "Dataset identifier:")} {evidencia.ids.join(", ")}.
          </span>
        )}
      </p>
      {nota && (
        <p className="text-xs leading-relaxed text-carvao" data-nota-regra={o.id}>
          <span className="rotulo mr-2 text-mineral">{tx("Para ler junto", "Read together")}</span>
          {nota}
        </p>
      )}
      {valor && (
        <p className="text-xs text-carvao-muted">
          <span className="text-carvao">{tx("Valor avaliado:", "Value assessed:")}</span> {valor}
          {o.defasagem_dias !== null && o.defasagem_dias > 0
            ? tx(` · referência ${plural(o.defasagem_dias, "dia", "dias")} antes do processamento`, ` · reference ${plural(o.defasagem_dias, "day", "days")} before processing`)
            : ""}
        </p>
      )}
      {o.evidencia_numero ? (
        caminho ? (
          <ComproveNumero sobDemanda={{ url: URL_GOLD_VISAO, caminho: `${caminho}.evidencia_numero`, indicador: titulo, valorExibido: o.evidencia_numero.valor_exibido }} endereco={`${ROTA_VISAO}#regra-${o.id}`} />
        ) : (
          <ComproveNumero evidencia={o.evidencia_numero} endereco={`${ROTA_VISAO}#regra-${o.id}`} />
        )
      ) : o.evidencia_problemas?.length ? (
        <p className="text-xs text-aviso">
          {tx("Evidência do número não publicada:", "Evidence for the number not published:")} {goldNoBloco(o.evidencia_problemas.join("; "), idioma, `visao-regra-problemas-${o.id}`)}
        </p>
      ) : null}
      {le?.inicio && fim && trechos.length > 0 && (
        <div className="pt-1">
          <VisaoFaixaEstados
            trechos={trechos}
            inicio={le.inicio}
            fim={fim}
            rotulo={tx(`Linha de estado de ${titulo}: ${textoLinhaEstado(o, idioma) ?? ""}`, `State line of ${titulo}: ${textoLinhaEstado(o, idioma) ?? ""}`)}
          />
          <p className="mt-0.5 flex justify-between text-xs text-mineral" aria-hidden="true">
            <span>{dataBR(le.inicio)}</span>
            <span>{dataBR(fim)}</span>
          </p>
          <p className="text-xs text-carvao-muted">{textoLinhaEstado(o, idioma)}</p>
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

export function VisaoRegraDetalhe({ o, idioma = idiomaEnergia() }: { o: RegraObservar; idioma?: Idioma }) {
  const h = o.historico;
  const ep = o.episodio_atual;
  const seq = o.sequencia_atual;
  const re = o.registro_emissoes;
  const tx = <T,>(pt: T, en: T) => txNoIdioma(pt, en, idioma);
  const g = (texto: string, regiao: string) => goldNoBloco(texto, idioma, `visao-regra-${o.id}-${regiao}`);
  const d = (iso: string) => dataBR(iso, idioma);
  const n = (v: number | null | undefined, c: number) => num(v, c, idioma);
  const p = (v: number, um: string, varios: string) => plural(v, um, varios, idioma);
  const lim = o.limites_vigentes;
  return (
    <div className="space-y-3">
      <dl className="grid gap-3 md:grid-cols-2">
        <Item rotulo={tx("Condição", "Condition")}>{g(o.condicao, "condicao")}</Item>
        {o.limiar && <Item rotulo={tx("Limiar", "Threshold")}>{g(o.limiar, "limiar")}</Item>}
        <Item rotulo={tx("Duração mínima e retorno", "Minimum duration and return")}>
          {o.duracao_minima_dias !== null
            ? tx(
                `${p(o.duracao_minima_dias, "dia seguido", "dias seguidos")} com a condição para confirmar o alerta. `,
                `${p(o.duracao_minima_dias, "consecutive day", "consecutive days")} with the condition to confirm the alert. `,
              )
            : tx("Sem duração mínima (regra de estado). ", "No minimum duration (state rule). ")}
          {g(o.regra_retorno, "retorno")}
        </Item>
        <Item rotulo={tx("Materialidade", "Materiality")}>{g(o.materialidade, "materialidade")}</Item>
        <Item rotulo={tx("O que o alerta não implica", "What the alert does not imply")}>
          {g(o.nao_implica, "nao-implica")} {g(o.alerta_nao_implica_causa, "nao-implica-causa")}
        </Item>
        {o.hipoteses.length > 0 && (
          <Item rotulo={tx("Hipóteses a verificar (não testadas nesta página)", "Hypotheses to check (not tested on this page)")}>
            <ul className="space-y-1">
              {o.hipoteses.map((x) => (
                <li key={x.texto}>
                  <span className="mr-2 border border-dashed border-mineral px-1.5 text-xs">{tx("hipótese", "hypothesis")}</span>
                  {g(x.texto, "hipotese")}.{" "}
                  <Link href={x.onde_verificar} className="text-energia-dark underline underline-offset-4">
                    {tx("Onde verificar", "Where to check")}
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
            ? tx(
                `Episódio em curso: condição desde ${d(ep.inicio)}, alerta confirmado em ${d(ep.confirmado_em)}, ${p(ep.duracao_dias, "dia", "dias")} até ${d(ep.fim)}.`,
                `Ongoing episode: condition since ${d(ep.inicio)}, alert confirmed on ${d(ep.confirmado_em)}, ${p(ep.duracao_dias, "day", "days")} through ${d(ep.fim)}.`,
              )
            : seq
              ? tx(
                  `Condição presente desde ${d(seq.inicio)} (${p(seq.dias, "dia", "dias")}), ainda sem a duração mínima de ${p(o.duracao_minima_dias ?? 0, "dia", "dias")}.`,
                  `Condition present since ${d(seq.inicio)} (${p(seq.dias, "day", "days")}), still without the minimum duration of ${p(o.duracao_minima_dias ?? 0, "day", "days")}.`,
                )
              : ""}
        </p>
      )}
      {h ? (
        <p className="text-sm leading-relaxed text-carvao-muted">
          {tx(
            <>
              Histórico reavaliado com os dados da data de processamento, avaliável desde {d(h.primeiro_dia_avaliado)} ({p(h.dias_avaliados, "dia", "dias")} avaliados): condição em{" "}
              {n(h.pct_dias_com_condicao, 1)}% dos dias e alerta exibido em {n(h.pct_dias_exibidos, 1)}%; {p(h.episodios, "episódio", "episódios")}
              {h.episodios_por_ano !== null ? ` (${n(h.episodios_por_ano, 1)} por ano)` : " (frequência anual não estimável com menos de um ano avaliado)"}; {p(h.acionamentos_brutos, "acionamento", "acionamentos")}, dos quais{" "}
              {p(h.acionamentos_curtos_descartados, "foi descartado", "foram descartados")} por durar menos que o mínimo
              {h.duracao_mediana_dias !== null ? `; duração mediana de ${n(h.duracao_mediana_dias, 1)} dias e máxima de ${p(h.duracao_maxima_dias ?? 0, "dia", "dias")}` : ""}.
            </>,
            <>
              History reassessed with the data of the processing date, assessable since {d(h.primeiro_dia_avaliado)} ({p(h.dias_avaliados, "day", "days")} assessed): condition on{" "}
              {n(h.pct_dias_com_condicao, 1)}% of the days and alert displayed on {n(h.pct_dias_exibidos, 1)}%; {p(h.episodios, "episode", "episodes")}
              {h.episodios_por_ano !== null ? ` (${n(h.episodios_por_ano, 1)} per year)` : " (annual frequency cannot be estimated with less than one year assessed)"}; {p(h.acionamentos_brutos, "trigger", "triggers")}, of which{" "}
              {h.acionamentos_curtos_descartados === 1 ? "1 was" : `${n(h.acionamentos_curtos_descartados, 0)} were`} discarded for lasting less than the minimum
              {h.duracao_mediana_dias !== null ? `; median duration of ${n(h.duracao_mediana_dias, 1)} days and maximum of ${p(h.duracao_maxima_dias ?? 0, "day", "days")}` : ""}.
            </>,
          )}
        </p>
      ) : (
        o.historico_nao_se_aplica && <p className="text-sm text-carvao-muted">{g(o.historico_nao_se_aplica, "historico")}</p>
      )}
      {lim && (
        <p className="text-sm text-carvao-muted">
          {tx(
            <>
              Limites vigentes em {dataBR(lim.data)}: piso {comUnidade(lim.pld_min, "R$/MWh", 2)} ({lim.ato_pld_min}); teto horário {comUnidade(lim.pld_max_horario, "R$/MWh", 2)} ({lim.ato_pld_max_horario}); teto
              estrutural {comUnidade(lim.pld_max_estrutural, "R$/MWh", 2)} ({lim.ato_pld_max_estrutural}).
              {o.conferencia_limites ? ` Conferência com a Regulação: ${o.conferencia_limites.resultado === "aprovado" ? "valores iguais" : "com ressalva"}.` : ""}
            </>,
            <>
              Limits in force on {d(lim.data)}: floor {comUnidade(lim.pld_min, "R$/MWh", 2, idioma)} (<Nome>{lim.ato_pld_min}</Nome>); hourly ceiling {comUnidade(lim.pld_max_horario, "R$/MWh", 2, idioma)} (
              <Nome>{lim.ato_pld_max_horario}</Nome>); structural ceiling {comUnidade(lim.pld_max_estrutural, "R$/MWh", 2, idioma)} (<Nome>{lim.ato_pld_max_estrutural}</Nome>).
              {o.conferencia_limites ? ` Check against the Regulation module: ${o.conferencia_limites.resultado === "aprovado" ? "equal values" : "with a caveat"}.` : ""}
            </>,
          )}
        </p>
      )}
      {o.conjuntos_avaliados && (
        <p data-nivel="auditar" className="text-sm text-carvao-muted [overflow-wrap:anywhere]">
          {tx("Conjuntos avaliados:", "Datasets assessed:")} {o.conjuntos_avaliados.join(", ")}.
        </p>
      )}
      {o.coleta_direta && (
        <p data-nivel="auditar" className="text-sm text-carvao-muted">
          {tx("Última tentativa de coleta direta registrada:", "Last direct collection attempt recorded:")}{" "}
          {o.coleta_direta.tentado_em ? carimbo(o.coleta_direta.tentado_em, idioma) : tx("sem registro", "no record")}
          {o.coleta_direta.ok === false ? tx(", sem sucesso", ", unsuccessful") : o.coleta_direta.ok ? tx(", com sucesso", ", successful") : ""} ({o.coleta_direta.fonte}).
        </p>
      )}
      {o.bloqueios_registrados && o.bloqueios_registrados.length > 0 && (
        <ul data-nivel="auditar" className="space-y-1 text-sm text-carvao-muted [overflow-wrap:anywhere]">
          {o.bloqueios_registrados.map((b) => (
            <li key={b.fonte + b.evidencia}>
              {tx("Bloqueio registrado", "Recorded block")} ({b.origem}): {g(b.fonte, "bloqueio-fonte")}.{" "}
              {idioma === "en" ? (
                <TrechoPortugues regiao={`visao-regra-${o.id}-bloqueio`}>
                  <TextoEnergia texto={b.evidencia} />
                </TrechoPortugues>
              ) : (
                <TextoEnergia texto={b.evidencia} />
              )}
            </li>
          ))}
        </ul>
      )}
      <p data-nivel="auditar" className="text-xs leading-relaxed text-carvao-muted">
        {tx(
          <>
            Registro das publicações: {p(re.publicacoes_registradas, "publicação aceita registrada", "publicações aceitas registradas")}
            {re.inicio ? ` desde ${carimbo(re.inicio)}` : ""}; {p(re.emitidos, "alerta emitido", "alertas emitidos")}
            {re.nao_confirmados_apos_revisao !== null ? `; ${p(re.nao_confirmados_apos_revisao, "não confirmado", "não confirmados")} depois da revisão da fonte` : ""}. {re.nota} Versão da regra{" "}
            {o.versao_regra}; medida {o.metrica ?? "sem medida no catálogo"}.
          </>,
          <>
            Record of publications: {p(re.publicacoes_registradas, "accepted publication recorded", "accepted publications recorded")}
            {re.inicio ? ` since ${carimbo(re.inicio, idioma)}` : ""}; {p(re.emitidos, "alert issued", "alerts issued")}
            {re.nao_confirmados_apos_revisao !== null ? `; ${p(re.nao_confirmados_apos_revisao, "not confirmed", "not confirmed")} after the source revision` : ""}. {g(re.nota, "registro")} Rule version{" "}
            {o.versao_regra}; measure {o.metrica ?? "no measure in the catalog"}.
          </>,
        )}
      </p>
      <p className="text-sm">
        <Link href={o.href} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
          {tx("Ver os dados no painel de origem", "See the data in the source panel")}
        </Link>
      </p>
    </div>
  );
}

