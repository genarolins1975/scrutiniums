"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { MapaCalor } from "@/components/energia/MapaCalor";
import { MapaSubmercados } from "@/components/energia/MapaSubmercados";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { PldEscolha, PldLista } from "@/components/energia/PldControles";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, plural } from "@/lib/energia/formato";
import {
  COLUNAS_AMPLITUDE,
  COLUNAS_FLUXOS,
  COLUNAS_JANELA_HORARIA,
  COLUNAS_MATRIZ,
  COLUNAS_SEPARACAO,
  COR_SM,
  CURTO_SM,
  ESCALA_DIFERENCA,
  ESCALA_FRACAO,
  NOME_SM,
  PARES,
  SUBMERCADOS,
  curtoPar,
  emPct,
  estadoHora,
  extremosMatriz,
  linhasAmplitude,
  linhasFluxos,
  linhasJanelaHoraria,
  linhasMatriz,
  linhasSeparacao,
  matrizRegional,
  nomePar,
  respostaHora,
  respostaP012,
  rotaPainel,
  serieSeparacaoHoraria,
  textoHora,
  vereditoP012,
  type MedidaMatriz,
} from "@/lib/energia/pld";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { BlocoRegional, Par, PldHorarioRecenteArquivo } from "@/lib/energia/tipos-pld";

/**
 * P012, diferenças regionais: período (?per=), par em destaque (?par=), pares nos
 * pequenos múltiplos (?pares=, até quatro), medida da matriz (?mat=) e hora do
 * esquema (?h=) ficam na URL; busca, ordem e filtros das tabelas também (prefixos
 * sep, mat.t, amp, flx e hora.t). A hora é uma só para o esquema, a tabela horária e
 * o gráfico das 168 horas: escolher uma linha da tabela muda o esquema e a marca no
 * gráfico, e o voltar do navegador desfaz. Preço e fluxo são sempre da MESMA hora; a
 * leitura é descritiva (sem os limites de intercâmbio, nenhuma hora é chamada de
 * congestionada).
 *
 * Ordem da página: resposta e escolha de período e par, faixa de medidas, figura principal
 * (horas separadas por par e matriz dos últimos 12 meses), recorte, tabelas, notas do painel e o perfil
 * horário da separação, visível em Entender. O preço e o fluxo na mesma hora e o sentido do fluxo nas
 * horas separadas ficam em Analisar.
 */
const MEDIDAS_MATRIZ: readonly MedidaMatriz[] = ["dif_media", "frac_separadas"];

export function PldRegional({
  r,
  rec,
  paresPadrao,
  horaInicial,
  fichas,
  ultimaHoraFluxo,
  fonte,
  versao,
  horasAcimaLimiarPaginaPld,
  notas,
}: {
  r: BlocoRegional;
  rec: PldHorarioRecenteArquivo | null;
  paresPadrao: Par[];
  horaInicial: string;
  fichas: Record<string, Evidencia>;
  ultimaHoraFluxo: string | null;
  fonte: string;
  versao: string;
  /** Horas dos últimos 30 dias com diferença acima do limiar na página PLD (pld.json), para conferir com a linha "Últimos 30 dias" daqui. */
  horasAcimaLimiarPaginaPld?: number | null;
  /** Notas do painel (NotasDoPainel), logo depois da figura principal e das tabelas. */
  notas?: ReactNode;
}) {
  const periodos = r.periodos.map((p) => p.id);
  const esquema = useMemo(
    () => ({
      per: campo(tiposUrl.opcao(periodos), periodos.includes("12m") ? "12m" : (periodos[periodos.length - 1] ?? "")),
      par: campo(tiposUrl.opcao(PARES), "SE_S" as Par),
      pares: campo(tiposUrl.lista(tiposUrl.opcao(PARES), { max: LIMITE_COMPARACAO }), paresPadrao),
      mat: campo(tiposUrl.opcao(MEDIDAS_MATRIZ), "frac_separadas" as MedidaMatriz),
      h: campo(tiposUrl.opcao(rec?.t ?? [horaInicial]), horaInicial),
    }),
    // esquema estável no build: depende só dos períodos, das horas e do padrão publicados
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodos.join(","), paresPadrao.join(","), horaInicial, rec?.t.length],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const per = v.per as string;
  const par = v.par as Par;
  const pares = v.pares as Par[];
  const mat = v.mat as MedidaMatriz;
  const a = r.amplitude.find((x) => x.periodo === per) ?? null;
  const s = r.separacao.find((x) => x.periodo === per && x.par === par) ?? null;
  const sep = useMemo(() => linhasSeparacao(r, per), [r, per]);
  const amp = useMemo(() => linhasAmplitude(r), [r]);
  const flx = useMemo(() => linhasFluxos(r, per), [r, per]);
  const matriz = useMemo(() => matrizRegional(r, mat), [r, mat]);
  const matTabela = useMemo(() => linhasMatriz(r), [r]);
  const perfil = useMemo(() => serieSeparacaoHoraria(r), [r]);
  const janela = useMemo(() => (rec ? linhasJanelaHoraria(rec) : []), [rec]);
  const hora = rec ? estadoHora(rec, v.h as string) : null;
  const ficha = per === "12m" ? (fichas[`separacao_12m_${par}`] ?? null) : null;
  const endereco = `${rotaPainel("p012")}#p012`;
  const rotuloPer = r.periodos.find((p) => p.id === per)?.rotulo ?? per;
  const barras = sep.map((l) => ({ id: l.id as string, rotulo: curtoPar(l.id as Par), frac: l.frac }));
  const a30 = r.amplitude.find((x) => x.periodo === "30d") ?? null;
  const notaLimiar =
    a30 && typeof horasAcimaLimiarPaginaPld === "number"
      ? horasAcimaLimiarPaginaPld === a30.horas_acima_1
        ? `Mesmo limiar da página PLD, que conta ${plural(horasAcimaLimiarPaginaPld, "hora", "horas")} nos últimos 30 dias; escolhendo Últimos 30 dias aqui, a contagem é a mesma.`
        : `A página PLD conta ${plural(horasAcimaLimiarPaginaPld, "hora", "horas")} nos últimos 30 dias com o mesmo limiar; aqui, Últimos 30 dias dá ${plural(a30.horas_acima_1, "hora", "horas")}.`
      : "Limiar de R$ 1,00/MWh, o mesmo da página PLD.";
  const extremos = extremosMatriz(matriz, mat);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p012" vivo veredito={vereditoP012(r, per)}>
          {respostaP012(r, per)}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <PldLista rotulo="Período" opcoes={r.periodos.map((p) => ({ id: p.id, rotulo: p.rotulo }))} valor={per} onEscolher={(p) => definir({ per: p })} />
          <PldLista rotulo="Par em destaque" opcoes={PARES.map((p) => ({ id: p, rotulo: nomePar(p) }))} valor={par} onEscolher={(p) => definir({ par: p })} />
        </div>
      </div>

      <FaixaMetricas colunas={4} rotulo={`Medidas de separação entre submercados, ${rotuloPer}`}>
        <Numero
          variante="faixa"
          rotulo="Horas com os preços separados"
          natureza="CALCULADO"
          valor={emPct(a?.frac_com_separacao)}
          formato="pct"
          casas={1}
          unidade="das horas"
          periodo={rotuloPer}
          motivoAusencia="Sem horas com os quatro submercados no período."
          nota={a ? `${plural(a.horas_com_separacao, "hora", "horas")} de ${plural(a.horas, "hora", "horas")}.` : undefined}
        />
        <Numero
          variante="faixa"
          rotulo="Horas com diferença acima de R$ 1,00/MWh"
          natureza="CALCULADO"
          valor={a?.horas_acima_1 ?? null}
          formato="num"
          casas={0}
          unidade="horas"
          periodo={rotuloPer}
          motivoAusencia="Sem horas no período."
          nota={notaLimiar}
        />
        <Numero
          variante="faixa"
          rotulo="Diferença média entre o maior e o menor PLD"
          natureza="CALCULADO"
          valor={a?.media ?? null}
          formato="reais"
          casas={2}
          unidade="R$/MWh"
          periodo={rotuloPer}
          motivoAusencia="Sem horas no período."
        />
        <Numero
          variante="faixa"
          rotulo={`Horas separadas: ${nomePar(par)}`}
          natureza="CALCULADO"
          valor={emPct(s?.frac_separadas)}
          evidencia={ficha}
          formato="pct"
          casas={2}
          unidade="das horas"
          periodo={rotuloPer}
          motivoAusencia="Sem horas com os dois preços no período."
          endereco={endereco}
          nota={ficha ? undefined : "A ficha Comprove é publicada para os últimos 12 meses; os demais períodos estão na tabela e no CSV diário."}
        />
      </FaixaMetricas>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <GraficoBarras
            titulo={`Horas separadas por par de submercados, ${rotuloPer} (%)`}
            dados={barras}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "frac", rotulo: "horas separadas", cor: "var(--cor-energia)" }]}
            unidade="%"
            casas={1}
            orientacao="horizontal"
            selecionado={par}
            onSelecionar={(id) => id && definir({ par: id as Par })}
          />
        </div>
        <div className="min-w-0 space-y-3">
          <PldEscolha
            legenda="Matriz dos últimos 12 meses"
            opcoes={[
              { id: "frac_separadas" as MedidaMatriz, rotulo: "Horas separadas (%)" },
              { id: "dif_media" as MedidaMatriz, rotulo: "Diferença média (R$/MWh)" },
            ]}
            valor={mat}
            onEscolher={(m) => definir({ mat: m })}
          />
          <MapaCalor
            titulo={mat === "dif_media" ? "Média de PLD da linha menos PLD da coluna, mesma hora, últimos 12 meses" : "Horas em que o par se separou, últimos 12 meses"}
            linhas={matriz.eixo}
            colunas={matriz.eixo}
            nomeLinhas="Submercado A (linha)"
            nomeColunas="Submercado B (coluna)"
            valores={matriz.valores}
            escala={mat === "dif_media" ? ESCALA_DIFERENCA : ESCALA_FRACAO}
            unidade={mat === "dif_media" ? "R$/MWh" : "%"}
            casas={mat === "dif_media" ? 2 : 1}
            nota={`Diagonal com borda tracejada: um submercado com ele mesmo não se aplica. Na diferença, positivo é a linha mais cara que a coluna.${extremos ? ` ${extremos}` : ""}`}
          />
        </div>
      </div>

      <dl data-recorte-painel="" className="grid gap-x-6 gap-y-1 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            {rotuloPer}
            {a ? `, ${dataBR(a.inicio)} a ${dataBR(a.fim)}` : ""}; matriz e perfil horário dos últimos 12 meses
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">Horas com o PLD dos quatro submercados publicado, na mesma hora e na mesma publicação da CCEE</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">
            horas, % das horas e R$/MWh; separação = diferença de mais de R$ 0,01/MWh na mesma hora
            <span data-nivel="analisar">; fluxo em MWmed (megawatt médio)</span>
          </dd>
        </div>
      </dl>

      <TabelaInterativa
        titulo={`Tabela equivalente: separação por par, ${rotuloPer}`}
        colunas={COLUNAS_SEPARACAO}
        linhas={sep}
        chaveLinha="id"
        colunaRotulo="par"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`pld-separacao-${per}`}
        chaveUrl="sep"
        selecionado={par}
        onSelecionar={(id) => id && definir({ par: id as Par })}
        nota="Diferenças de exatamente um centavo ficam contadas à parte e não entram na separação."
      />
      <TabelaInterativa
        titulo="Tabela equivalente da matriz: pares ordenados, últimos 12 meses"
        colunas={COLUNAS_MATRIZ}
        linhas={matTabela}
        chaveLinha="id"
        colunaRotulo="a"
        fonte={fonte}
        versao={versao}
        nomeArquivo="pld-matriz-12m"
        chaveUrl="mat.t"
      />

      {notas}

      <SecaoDoPainel id="perfil-horario" titulo="Em que horas do dia cada par se separa?" lead="Fração das horas separadas em cada hora do dia, nos últimos 12 meses, na mesma escala.">
        <Comparador
          rotulo={`Pares nos gráficos (até ${LIMITE_COMPARACAO})`}
          entidades={PARES.map((p) => ({ id: p, rotulo: nomePar(p), sinonimos: [curtoPar(p)] }))}
          selecionadas={pares}
          onMudar={(ids) => definir({ pares: ids as Par[] })}
          dicaBusca="Sul, Norte, SE/CO"
          vazio="Nenhum par escolhido. Escolha até quatro para ver o perfil horário da separação na mesma escala."
        >
          {() => null}
        </Comparador>
        {pares.length > 0 && (
          <PequenosMultiplos
            titulo="Fração das horas separadas por hora do dia, por par"
            dados={perfil}
            chaveX="h"
            formatoX="hora"
            unidade="%"
            casas={1}
            zeroNoEixo
            colunas={pares.length > 2 ? 4 : 2}
            paineis={pares.map((p) => ({ id: p, titulo: nomePar(p) }))}
            cor="var(--cor-energia)"
          />
        )}
        <p className="text-sm leading-relaxed text-carvao-muted">
          O preço e o fluxo na mesma hora, hora a hora, e o sentido do fluxo nas fronteiras nas horas separadas estão no nível Analisar.
        </p>
      </SecaoDoPainel>

      <SecaoDoPainel id="hora-a-hora" titulo="Preço e fluxo na mesma hora, últimas 168 horas" nivel="analisar">
        {rec && hora ? (
          <>
            <PldLista rotulo="Hora no esquema" opcoes={rec.t.map((t) => ({ id: t, rotulo: textoHora(t) }))} valor={hora.t} onEscolher={(t) => definir({ h: t })} />
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p012-hora" aria-live="polite">
              {respostaHora(hora)}
            </p>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <MapaSubmercados fluxos={hora.fluxos} precos={hora.precos} diaFluxo={textoHora(hora.t)} diaPreco={`${textoHora(hora.t)} (valor da hora)`} />
                {ultimaHoraFluxo && hora.t > ultimaHoraFluxo && (
                  <p className="mt-2 text-xs text-carvao-muted">O fluxo do ONS integrado vai até {textoHora(ultimaHoraFluxo)}; nesta hora o fluxo é ausência, não zero.</p>
                )}
              </div>
              <div className="min-w-0">
                <GraficoLinhas
                  titulo="PLD dos quatro submercados, hora a hora"
                  dados={janela}
                  chaveX="t"
                  formatoX="hora"
                  series={SUBMERCADOS.map((sm) => ({ id: sm, rotulo: NOME_SM[sm], sigla: CURTO_SM[sm], cor: COR_SM[sm] }))}
                  unidade="R$/MWh"
                  casas={2}
                  marcos={[{ x: hora.t, rotulo: `hora no esquema: ${textoHora(hora.t)}` }]}
                  legendaInterativa
                />
              </div>
            </div>
            <TabelaInterativa
              titulo="Tabela equivalente: PLD, diferença e fluxo na mesma hora"
              colunas={COLUNAS_JANELA_HORARIA}
              linhas={janela}
              chaveLinha="id"
              colunaRotulo="t"
              fonte="CCEE, PLD horário por submercado; ONS, Intercâmbios entre Subsistemas"
              versao={versao}
              nomeArquivo="pld-hora-a-hora-168h"
              chaveUrl="hora.t"
              ordemInicial={{ coluna: "t", direcao: "desc" }}
              selecionado={hora.t}
              onSelecionar={(id) => id && definir({ h: id })}
              nota="Fluxo positivo da primeira para a segunda ponta da fronteira, como o ONS publica. Escolher uma linha muda o esquema e a marca do gráfico."
            />
          </>
        ) : (
          <p className="text-sm text-carvao-muted">A janela das últimas 168 horas (pld_horario_recente.json) não está nesta publicação; o histórico diário de separação e fluxo está no CSV diário.</p>
        )}
      </SecaoDoPainel>

      <SecaoDoPainel id="fluxo-nas-horas-separadas" titulo={`Sentido do fluxo nas horas separadas, ${rotuloPer}`} nivel="analisar">
        <p className="text-sm leading-relaxed text-carvao-muted">
          Para cada fronteira, as horas em que os dois submercados vizinhos tinham preços diferentes, contadas pelo sentido do fluxo verificado na mesma hora. É uma
          associação descritiva: sem os limites de intercâmbio, não se diz se a fronteira estava no limite.
        </p>
        <TabelaInterativa
          titulo={`Fluxo nas fronteiras nas horas separadas, ${rotuloPer}`}
          colunas={COLUNAS_FLUXOS}
          linhas={flx}
          chaveLinha="id"
          colunaRotulo="fronteira"
          fonte="CCEE, PLD horário por submercado; ONS, Intercâmbios entre Subsistemas"
          versao={versao}
          nomeArquivo={`pld-fluxo-separacao-${per}`}
          chaveUrl="flx"
        />
        <TabelaInterativa
          titulo="Amplitude entre submercados por período"
          colunas={COLUNAS_AMPLITUDE}
          linhas={amp}
          chaveLinha="id"
          colunaRotulo="periodo"
          fonte={fonte}
          versao={versao}
          nomeArquivo="pld-amplitude-periodos"
          chaveUrl="amp"
          selecionado={per}
          onSelecionar={(id) => id && definir({ per: id })}
          nota="Ano marcado como parcial ainda está em curso e não se compara a anos completos sem essa ressalva."
        />
      </SecaoDoPainel>
    </div>
  );
}
