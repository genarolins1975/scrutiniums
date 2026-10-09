"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MapaCalor } from "@/components/energia/MapaCalor";
import { Numero } from "@/components/energia/Numero";
import { PldEscolha, PldLista } from "@/components/energia/PldControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, plural, reais } from "@/lib/energia/formato";
import {
  COLUNAS_CALENDARIO,
  COLUNAS_EMPATES,
  COLUNAS_PERMANENCIA,
  COR_SM,
  CURTO_SM,
  DO_SM,
  ESCALA_HORAS_DIA,
  JANELAS_CALENDARIO,
  LIMITES_HORA,
  NOME_SM,
  SUBMERCADOS,
  calendarioLimite,
  emPct,
  linhasCalendario,
  linhasEmpates,
  linhasPermanencia,
  permanencia,
  regimesDoAno,
  respostaP010,
  rotaPainel,
  vereditoP010,
  type JanelaCalendario,
  type LimiteHora,
} from "@/lib/energia/pld";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Submercado } from "@/lib/energia/tipos";
import type { BlocoLimitesDisponivel } from "@/lib/energia/tipos-pld";

/**
 * P010, limites, piso e tetos: submercado (?sm=), ano (?ano=) e limite do
 * calendário (?lim=) ficam na URL; busca, ordem e filtros das tabelas também
 * (prefixos cal, perm e emp). A resposta, as medidas da faixa, as barras de permanência e a
 * tabela leem as mesmas linhas (linhasPermanencia); o calendário e a sua tabela, a
 * mesma série diária da gold. Hora no limite é igualdade ao centavo, regra da gold;
 * o menor valor observado nunca aparece como piso.
 *
 * Ordem da página: resposta e escolha de submercado e ano, faixa de medidas do ano (com os
 * limites do trecho vigente e o objeto de cada um), figura principal (permanência por ano,
 * com o ano escolhido marcado), recorte, tabela, notas do painel e as três visões
 * complementares (calendário dos dias, horas no piso por submercado e empates), visíveis em Entender.
 */
const ROTULO_LIMITE: Record<LimiteHora, string> = { piso: "Horas no piso", teto_horario: "Horas no teto horário" };

export type LimitesP010 = Pick<BlocoLimitesDisponivel, "permanencia_anual" | "regimes" | "empates_piso" | "calendario" | "tolerancia">;

const valorLimite = (v: number | null) => (v === null ? "sem valor integrado" : `${reais(v)}/MWh`);

export function PldLimites({
  l,
  anos,
  diaReferencia,
  fichas,
  fonte,
  versao,
  notaPermanencia,
  notas,
}: {
  l: LimitesP010;
  anos: number[];
  diaReferencia: string;
  fichas: Record<string, Evidencia>;
  fonte: string;
  versao: string;
  /** Contexto de anos com muitas horas no piso que o dado publicado sustenta (ver o achado A02, na página CMO e formação de preço). */
  notaPermanencia?: ReactNode;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
}) {
  const ultimo = anos[anos.length - 1] ?? Number(diaReferencia.slice(0, 4));
  const esquema = useMemo(
    () => ({
      sm: campo(tiposUrl.opcao(SUBMERCADOS), "SE" as Submercado),
      ano: campo(tiposUrl.inteiro({ min: anos[0] ?? ultimo, max: ultimo }), ultimo),
      lim: campo(tiposUrl.opcao(LIMITES_HORA), "piso" as LimiteHora),
      cal: campo(tiposUrl.opcao(["6m", "12m"] as const), "6m" as JanelaCalendario),
      sms: campo(tiposUrl.lista(tiposUrl.opcao(SUBMERCADOS), { max: LIMITE_COMPARACAO }), [...SUBMERCADOS] as Submercado[]),
    }),
    // o esquema depende só da lista de anos publicada (estável no build)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anos.join(",")],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const sm = v.sm as Submercado;
  const ano = v.ano;
  const lim = v.lim as LimiteHora;
  const bloco = l as BlocoLimitesDisponivel;
  const p = permanencia(bloco, ano, sm);
  const regs = regimesDoAno(bloco, ano);
  const reg = regs.length === 1 ? regs[0] : null;
  const perm = useMemo(() => linhasPermanencia(bloco, sm), [bloco, sm]);
  const nDias = JANELAS_CALENDARIO[v.cal as JanelaCalendario];
  const cal = useMemo(() => calendarioLimite(bloco.calendario, sm, lim, nDias), [bloco, sm, lim, nDias]);
  const calLinhas = useMemo(() => linhasCalendario(bloco.calendario, sm, nDias), [bloco, sm, nDias]);
  const empates = useMemo(() => linhasEmpates(bloco), [bloco]);
  const escolhidos = v.sms as Submercado[];
  // piso por ano para os submercados escolhidos: as mesmas linhas de linhasPermanencia, uma coluna por submercado
  const comparacao = useMemo(() => {
    const porSm = Object.fromEntries(escolhidos.map((s) => [s, linhasPermanencia(bloco, s)]));
    return anos.map((a) => ({
      id: String(a),
      rotulo: permanencia(bloco, a, "SE")?.parcial ? `${a} (parcial)` : String(a),
      ...Object.fromEntries(escolhidos.map((s) => [s, porSm[s].find((l) => l.id === String(a))?.piso_pct ?? null])),
    }));
  }, [bloco, anos, escolhidos]);
  const dias = bloco.calendario.dias.slice(-nDias);
  const endereco = `${rotaPainel("p010")}#p010`;
  const ficha = fichas[`piso_${ano}_${sm}`] ?? null;
  const periodoAno = p?.parcial ? `${ano} até ${dataBR(diaReferencia)}` : String(ano);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p010" vivo veredito={vereditoP010(bloco, ano, sm, diaReferencia)}>
          {respostaP010(bloco, ano, sm, diaReferencia)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <PldEscolha legenda="Submercado" opcoes={SUBMERCADOS.map((s) => ({ id: s, rotulo: CURTO_SM[s], detalhe: NOME_SM[s] }))} valor={sm} onEscolher={(s) => definir({ sm: s })} />
          <PldLista
            rotulo="Ano"
            opcoes={anos.map((a) => ({ id: String(a), rotulo: permanencia(bloco, a, sm)?.parcial ? `${a} (parcial)` : String(a) }))}
            valor={String(ano)}
            onEscolher={(a) => definir({ ano: Number(a) })}
          />
        </div>
      </div>

      <FaixaMetricas colunas={4} rotulo={`Medidas de ${periodoAno}, ${NOME_SM[sm]}`}>
        <Numero
          variante="faixa"
          rotulo="Horas no piso"
          natureza="CALCULADO"
          valor={emPct(p?.frac_piso)}
          evidencia={ficha}
          formato="pct"
          casas={2}
          unidade="das horas com limite"
          periodo={periodoAno}
          motivoAusencia="Sem permanência publicada para o ano e o submercado."
          cor={COR_SM[sm]}
          endereco={endereco}
          nota={ficha ? undefined : "A ficha Comprove é publicada para o ano de referência; os demais anos estão na tabela e no CSV diário."}
        />
        <Numero
          variante="faixa"
          rotulo="Horas no teto horário"
          natureza="CALCULADO"
          valor={p?.horas_teto_horario ?? null}
          formato="num"
          casas={0}
          unidade="horas"
          periodo={periodoAno}
          motivoAusencia="Sem permanência publicada."
          cor={COR_SM[sm]}
        />
        <Numero
          variante="faixa"
          rotulo="Dias com média no teto estrutural"
          natureza="CALCULADO"
          valor={p?.dias_teto_estrutural ?? null}
          formato="num"
          casas={0}
          unidade="dias"
          periodo={periodoAno}
          motivoAusencia="Sem permanência publicada."
          cor={COR_SM[sm]}
          nota="Conferido sobre a média das 24 horas do dia."
        />
        <div role="group" aria-label={`Limites vigentes em ${ano}`} data-metrica="" className="min-w-0">
          <p className="mb-1.5 text-[0.8125rem] leading-snug text-carvao-muted">Limites de {ano} (atos da ANEEL)</p>
          {reg ? (
            <dl className="space-y-1.5 text-sm tabular-nums text-carvao">
              <div className="flex justify-between gap-3">
                <dt className="text-carvao-muted">
                  Piso <span className="text-xs">(cada hora)</span>
                </dt>
                <dd>{valorLimite(reg.pld_min)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-carvao-muted">
                  Teto horário <span className="text-xs">(cada hora)</span>
                </dt>
                <dd>{valorLimite(reg.pld_max_horario)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-carvao-muted">
                  Teto estrutural <span className="text-xs">(média do dia)</span>
                </dt>
                <dd>{valorLimite(reg.pld_max_estrutural)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-carvao-muted">{regs.length ? "Mais de um trecho de vigência no ano: veja a tabela de limites." : "Sem ato vigente integrado para o ano."}</p>
          )}
          {reg && (
            <p className="mt-1.5 text-xs leading-snug text-carvao-muted">
              {reg.ato_pld_min === reg.ato_pld_max_horario && reg.ato_pld_min === reg.ato_pld_max_estrutural
                ? `Piso e tetos: ${reg.ato_pld_min ?? "ato não identificado"}.`
                : `Piso: ${reg.ato_pld_min ?? "ato não identificado"}; teto horário: ${reg.ato_pld_max_horario ?? "ato não identificado"}; teto estrutural: ${reg.ato_pld_max_estrutural ?? "ato não identificado"}.`}
            </p>
          )}
        </div>
      </FaixaMetricas>

      <div className="space-y-3">
        <GraficoBarras
          titulo={`Horas no piso e no teto horário por ano, ${NOME_SM[sm]} (% das horas com limite vigente)`}
          dados={perm}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[
            { id: "piso_pct", rotulo: "no piso", cor: "var(--escala-seq-3)" },
            { id: "teto_pct", rotulo: "no teto horário", cor: "var(--escala-div-neg-2)" },
          ]}
          unidade="%"
          casas={2}
          selecionado={String(ano)}
          onSelecionar={(id) => id && definir({ ano: Number(id) })}
        />
        <p className="text-sm leading-relaxed text-carvao-muted">
          Cada ano tem o próprio piso e os próprios tetos: a barra mede quanto tempo o preço passou no limite daquele ano, não o nível do preço. O ano parcial ainda não
          terminou e não se compara a anos completos sem essa ressalva.
        </p>
        {notaPermanencia ? <p className="text-sm leading-relaxed text-carvao-muted">{notaPermanencia}</p> : null}
      </div>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            Ano {periodoAno}; calendário dos últimos {plural(dias.length, "dia", "dias")} ({dias.length ? `${dataBR(dias[0])} a ${dataBR(dias[dias.length - 1])}` : "sem dias"})
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">Horas com PLD publicado {DO_SM[sm]} e limite vigente do ato da ANEEL</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">
            horas e % das horas; limites em R$/MWh nominais; hora no limite = preço igual ao limite, ao centavo
            <span data-nivel="analisar"> (|PLD − limite| ≤ R$ {String(bloco.tolerancia.hora).replace(".", ",")}/MWh)</span>
          </dd>
        </div>
      </dl>

      <TabelaInterativa
        titulo={`Tabela equivalente: permanência nos limites por ano, ${NOME_SM[sm]}`}
        colunas={COLUNAS_PERMANENCIA}
        linhas={perm}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`pld-permanencia-${sm}`}
        chaveUrl="perm"
        selecionado={String(ano)}
        onSelecionar={(id) => id && definir({ ano: Number(id) })}
      />

      {notas}

      <SecaoDoPainel id="calendario" titulo="Em quais dias o preço ficou no limite?" lead="Cada célula é um dia e cada linha é uma semana; o valor é o número de horas do dia no limite escolhido.">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <PldEscolha
            legenda="Calendário"
            opcoes={LIMITES_HORA.map((x) => ({ id: x, rotulo: ROTULO_LIMITE[x] }))}
            valor={lim}
            onEscolher={(x) => definir({ lim: x })}
          />
          <PldEscolha
            legenda="Janela do calendário"
            opcoes={[
              { id: "6m" as JanelaCalendario, rotulo: "Último semestre" },
              { id: "12m" as JanelaCalendario, rotulo: `Últimos ${bloco.calendario.dias.length} dias` },
            ]}
            valor={v.cal as JanelaCalendario}
            onEscolher={(x) => definir({ cal: x })}
          />
        </div>
        <MapaCalor
          titulo={`${ROTULO_LIMITE[lim]} por dia, ${NOME_SM[sm]}, últimos ${plural(dias.length, "dia", "dias")}`}
          linhas={cal.linhas}
          colunas={cal.colunas}
          nomeLinhas="Semana"
          nomeColunas="Dia da semana"
          valores={cal.valores}
          escala={ESCALA_HORAS_DIA}
          unidade="horas"
          casas={0}
          periodo={dias.length ? `${dataBR(dias[0])} a ${dataBR(dias[dias.length - 1])}` : undefined}
          nota="Célula com borda tracejada: dia fora da janela escolhida. Zero é valor: dia sem nenhuma hora no limite."
        />
        <TabelaInterativa
          titulo={`Tabela equivalente do calendário: horas no limite por dia, ${NOME_SM[sm]}`}
          colunas={COLUNAS_CALENDARIO}
          linhas={calLinhas}
          chaveLinha="id"
          colunaRotulo="dia"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`pld-limites-calendario-${sm}`}
          chaveUrl="cal.t"
          ordemInicial={{ coluna: "dia", direcao: "desc" }}
          nota="O histórico diário desde 2021, com os limites vigentes de cada dia, está no CSV de limites (download no rodapé do painel)."
        />
      </SecaoDoPainel>

      <SecaoDoPainel id="piso-por-submercado" titulo="Quantas horas no piso, por ano e por submercado?">
        <Comparador
          rotulo={`Submercados no gráfico (até ${LIMITE_COMPARACAO})`}
          entidades={SUBMERCADOS.map((s) => ({ id: s, rotulo: NOME_SM[s], sinonimos: [CURTO_SM[s]] }))}
          selecionadas={escolhidos}
          onMudar={(ids) => definir({ sms: ids as Submercado[] })}
          dicaBusca="Sul, Nordeste, Norte"
          vazio="Nenhum submercado escolhido. Escolha até quatro para comparar as horas no piso na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidos.length > 0 && (
          <GraficoBarras
            titulo="Horas no piso por ano e submercado (% das horas com limite vigente)"
            dados={comparacao}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={escolhidos.map((s) => ({ id: s, rotulo: NOME_SM[s], cor: COR_SM[s] }))}
            unidade="%"
            casas={2}
            selecionado={String(ano)}
            onSelecionar={(id) => id && definir({ ano: Number(id) })}
          />
        )}
        <p className="text-sm leading-relaxed text-carvao-muted">
          Os quatro submercados têm o mesmo piso em cada ano; diferenças entre as barras de um ano vêm das horas em que os preços se separaram (painel de diferenças
          regionais), não de pisos diferentes.
        </p>
      </SecaoDoPainel>

      <SecaoDoPainel id="empates-piso" titulo="Em quantas horas vários submercados ficaram no piso ao mesmo tempo?">
        <GraficoBarras
          titulo="Horas de cada ano pelo número de submercados no piso na mesma hora"
          dados={empates}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[
            { id: "q0", rotulo: "nenhum", cor: "var(--escala-seq-1)" },
            { id: "q1", rotulo: "um", cor: "var(--escala-seq-2)" },
            { id: "q2", rotulo: "dois", cor: "var(--escala-seq-3)" },
            { id: "q3", rotulo: "três", cor: "var(--escala-seq-4)" },
            { id: "q4", rotulo: "os quatro", cor: "var(--escala-seq-5)" },
          ]}
          unidade="horas"
          casas={0}
          empilhado
        />
        <p className="text-sm leading-relaxed text-carvao-muted">
          Com os quatro no piso, os preços são iguais por regra, e a hora não diz nada sobre diferenças entre regiões nem sobre o custo de cada uma. As médias e os percentis
          de anos com muitas horas no piso têm uma massa de valores iguais; o painel de histórico mostra essa massa.
        </p>
        <TabelaInterativa
          titulo="Tabela equivalente: horas por número de submercados no piso"
          colunas={COLUNAS_EMPATES}
          linhas={empates}
          chaveLinha="id"
          colunaRotulo="rotulo"
          fonte={fonte}
          versao={versao}
          nomeArquivo="pld-empates-piso"
          chaveUrl="emp"
        />
      </SecaoDoPainel>
    </div>
  );
}
