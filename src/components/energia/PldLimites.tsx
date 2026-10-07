"use client";

import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MapaCalor } from "@/components/energia/MapaCalor";
import { Numero } from "@/components/energia/Numero";
import { PldEscolha, PldLista } from "@/components/energia/PldControles";
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
  type JanelaCalendario,
  type LimiteHora,
} from "@/lib/energia/pld";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Submercado } from "@/lib/energia/tipos";
import type { BlocoLimitesDisponivel } from "@/lib/energia/tipos-pld";

/**
 * P010, limites, piso e tetos: submercado (?sm=), ano (?ano=) e limite do
 * calendário (?lim=) ficam na URL; busca, ordem e filtros das tabelas também
 * (prefixos cal, perm e emp). A resposta, os números, as barras de permanência e a
 * tabela leem as mesmas linhas (linhasPermanencia); o calendário e a sua tabela, a
 * mesma série diária da gold. Hora no limite é igualdade ao centavo, regra da gold;
 * o menor valor observado nunca aparece como piso.
 */
const ROTULO_LIMITE: Record<LimiteHora, string> = { piso: "Horas no piso", teto_horario: "Horas no teto horário" };

export type LimitesP010 = Pick<BlocoLimitesDisponivel, "permanencia_anual" | "regimes" | "empates_piso" | "calendario" | "tolerancia">;

export function PldLimites({
  l,
  anos,
  diaReferencia,
  fichas,
  fonte,
  versao,
}: {
  l: LimitesP010;
  anos: number[];
  diaReferencia: string;
  fichas: Record<string, Evidencia>;
  fonte: string;
  versao: string;
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
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <PldEscolha legenda="Submercado" opcoes={SUBMERCADOS.map((s) => ({ id: s, rotulo: CURTO_SM[s], detalhe: NOME_SM[s] }))} valor={sm} onEscolher={(s) => definir({ sm: s })} />
        <PldLista
          rotulo="Ano"
          opcoes={anos.map((a) => ({ id: String(a), rotulo: permanencia(bloco, a, sm)?.parcial ? `${a} (parcial)` : String(a) }))}
          valor={String(ano)}
          onEscolher={(a) => definir({ ano: Number(a) })}
        />
      </div>

      <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p010" aria-live="polite">
        {respostaP010(bloco, ano, sm, diaReferencia)}
      </p>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
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
          <dd className="mt-0.5">horas e % das horas; limites em R$/MWh nominais; hora no limite = igualdade ao centavo (|PLD − limite| ≤ R$ {String(bloco.tolerancia.hora).replace(".", ",")}/MWh)</dd>
        </div>
      </dl>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="Horas no piso"
          natureza="CALCULADO"
          valor={emPct(p?.frac_piso)}
          evidencia={ficha}
          formato="pct"
          casas={2}
          unidade="das horas com limite"
          periodo={periodoAno}
          motivoAusencia="Sem permanência publicada para o ano e o submercado."
          tamanho="medio"
          cor={COR_SM[sm]}
          endereco={endereco}
          nota={ficha ? undefined : "A ficha Comprove é publicada para o ano de referência; os demais anos estão na tabela e no CSV diário."}
        />
        <Numero
          rotulo="Horas no teto horário"
          natureza="CALCULADO"
          valor={p?.horas_teto_horario ?? null}
          formato="num"
          casas={0}
          unidade="horas"
          periodo={periodoAno}
          motivoAusencia="Sem permanência publicada."
          tamanho="medio"
          cor={COR_SM[sm]}
        />
        <Numero
          rotulo="Dias com média no teto estrutural"
          natureza="CALCULADO"
          valor={p?.dias_teto_estrutural ?? null}
          formato="num"
          casas={0}
          unidade="dias"
          periodo={periodoAno}
          motivoAusencia="Sem permanência publicada."
          tamanho="medio"
          cor={COR_SM[sm]}
          nota="Conferido sobre a média das 24 horas do dia (ver a nota do teto estrutural)."
        />
        <div role="group" aria-label={`Limites vigentes em ${ano}`} className="flex h-full flex-col border border-linha bg-superficie p-5">
          <p className="rotulo text-mineral">Limites de {ano} (atos da ANEEL)</p>
          {reg ? (
            <dl className="mt-2 space-y-1 text-sm tabular-nums text-carvao">
              <div className="flex justify-between gap-3">
                <dt className="text-carvao-muted">Piso</dt>
                <dd>{reais(reg.pld_min)}/MWh</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-carvao-muted">Teto horário</dt>
                <dd>{reais(reg.pld_max_horario)}/MWh</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-carvao-muted">Teto estrutural</dt>
                <dd>{reais(reg.pld_max_estrutural)}/MWh</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-carvao-muted">{regs.length ? "Mais de um trecho de vigência no ano: veja a tabela de limites." : "Sem ato vigente integrado para o ano."}</p>
          )}
          {reg && <p className="mt-2 text-xs text-mineral">Piso: {reg.ato_pld_min ?? "ato não identificado"}; tetos: {reg.ato_pld_max_horario ?? "ato não identificado"}.</p>}
        </div>
      </div>

      <div className="space-y-3">
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
      </div>

      <div className="space-y-3 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Permanência por ano: {NOME_SM[sm]}</h3>
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
      </div>

      <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Comparar submercados: horas no piso por ano</h3>
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
      </div>

      <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Empates no piso: quantos submercados no piso na mesma hora</h3>
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
      </div>
    </div>
  );
}
