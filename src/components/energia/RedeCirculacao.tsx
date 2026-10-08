"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { RedeEscolha, RedeLista } from "@/components/energia/RedeControles";
import { RedeMapaFluxos, type FluxoMapa } from "@/components/energia/RedeMapaFluxos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, horaLocal, mesAno, num, reais } from "@/lib/energia/formato";
import {
  COLUNAS_DIARIO_FRONTEIRA,
  COLUNAS_FRONTEIRAS_DIA,
  COLUNAS_HORA,
  COLUNAS_MENSAL_FRONTEIRA,
  COLUNAS_RESUMO_30D,
  COLUNAS_SUBSISTEMAS_DIA,
  COR_PAR,
  COR_SM,
  DO_SM,
  FRONTEIRAS,
  LIMIAR_NULO_MWMED,
  LIMIAR_PRECOS_RS_MWH,
  PAISES_SUL,
  PONTAS,
  NOME_SM,
  colunasJanela,
  colunasSaldoFronteiras,
  curtoFronteira,
  diaEscolhido,
  diasDaJanela,
  entreFronteira,
  fronteiraDestaque,
  indiceHora,
  linhasDiarioFronteira,
  linhasFronteirasDia,
  linhasHora,
  linhasMensalFronteira,
  linhasResumo30d,
  linhasSaldoDiario,
  linhasSaldoMensal,
  linhasSubsistemasDia,
  nomeFronteira,
  paraTabela,
  respostaCirculacao,
  respostaDia,
  respostaHora,
  respostaSubsistemasDia,
  sentidoNegativo,
  sentidoPositivo,
  serieJanela,
  textoPrecos30d,
  vereditoCirculacao,
} from "@/lib/energia/rede";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { CirculacaoRede, FronteiraRede, JanelaHorariaRede } from "@/lib/energia/tipos-rede";

/**
 * P028, circulação de energia. O recorte fica na URL: escala (?esc=dia|hora), dia
 * (?dia=), hora (?hora=AAAA-MM-DDTHH:MM), fronteira escolhida (?fr=), fronteiras
 * comparadas (?frs=, até quatro) e intervalo do histórico mensal (?de=, ?ate=); busca,
 * ordem, filtros e página de cada tabela também (prefixos fd, fh, d30, jh, sub, r30,
 * m.t). Escolher uma fronteira no esquema, na lista do celular ou na tabela seleciona a
 * mesma linha nas três e muda o histórico (seleção sincronizada, seção 7.3).
 *
 * A escala diária usa a gold (30 dias); a horária carrega sob demanda o JSON da janela
 * de 7 dias (contrato, seção 5.1), com fluxo, programa, exterior e PLD na mesma hora.
 * O PLD só aparece na escala horária: comparar preço e fluxo exige a mesma hora.
 */
const ESCALAS = ["dia", "hora"] as const;
const ESQUEMA = {
  esc: campo(tiposUrl.opcao(ESCALAS), "dia"),
  dia: campo(tiposUrl.data(), ""),
  hora: campo(tiposUrl.texto({ max: 16 }), ""),
  fr: campo(tiposUrl.opcao(["", ...FRONTEIRAS]), ""),
  frs: campo(tiposUrl.lista(tiposUrl.opcao(FRONTEIRAS), { max: LIMITE_COMPARACAO }), [...FRONTEIRAS]),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
};

const OPCOES_ESCALA = [
  { id: "dia" as const, rotulo: "Dia", detalhe: "Energia de cada dia, últimos 30 dias" },
  { id: "hora" as const, rotulo: "Hora", detalhe: "Fluxo, programa e PLD na mesma hora, últimos 7 dias" },
];

type EstadoJanela = { estado: "ocioso" | "carregando" | "pronto" | "erro"; dado?: JanelaHorariaRede; erro?: string };

export function RedeCirculacao({
  circulacao,
  fonte,
  versao,
  destaques,
}: {
  circulacao: Pick<CirculacaoRede, "diario" | "resumo_30d" | "mensal" | "subsistemas_diario" | "janela_horaria">;
  fonte: string;
  versao: string;
  /** Números de destaque com a prova (montados no servidor). */
  destaques?: ReactNode;
}) {
  const c = circulacao;
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const [janela, setJanela] = useState<EstadoJanela>({ estado: "ocioso" });
  const escala = v.esc;

  // a janela horária só é baixada quando a escala horária é pedida
  useEffect(() => {
    if (escala !== "hora" || janela.estado !== "ocioso") return;
    let vivo = true;
    setJanela({ estado: "carregando" });
    fetch(c.janela_horaria.url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`o servidor respondeu ${r.status}`))))
      .then((j: JanelaHorariaRede & { motivo?: string }) => {
        if (!j?.disponivel || !Array.isArray(j.horas) || !j.horas.length) throw new Error(j?.motivo ?? "arquivo sem horas publicadas");
        if (vivo) setJanela({ estado: "pronto", dado: j });
      })
      .catch((e: Error) => vivo && setJanela({ estado: "erro", erro: e.message }));
    return () => {
      vivo = false;
    };
  }, [escala, janela.estado, c.janela_horaria.url]);

  const fr = (v.fr || null) as FronteiraRede | null;
  const frDetalhe = fr ?? fronteiraDestaque(c.resumo_30d);
  const escolhidas = v.frs as FronteiraRede[];
  const selecionar = (id: string | null) => definir({ fr: (id && (FRONTEIRAS as readonly string[]).includes(id) ? id : "") as FronteiraRede | "" });

  // escala diária
  const dia = diaEscolhido(c.diario.dias, v.dia);
  const linhasDia = useMemo(() => linhasFronteirasDia(c, dia), [c, dia]);
  const fluxosDia: FluxoMapa[] = linhasDia.map((l) => ({
    par: l.id,
    valor: l.liquido_mwh,
    rotuloValor: l.liquido_mwh === null ? "sem dado" : `${num(Math.abs(l.liquido_mwh), 0)} MWh`,
    detalhe: l.contra_saldo_mwh ? `${num(l.contra_saldo_mwh, 0)} MWh no sentido contrário` : undefined,
  }));

  // escala horária (sob demanda)
  const j = janela.dado;
  const iHora = j ? indiceHora(j, v.hora) : -1;
  const horaAtual = j && iHora >= 0 ? j.horas[iHora] : "";
  const linhasH = useMemo(() => (j && iHora >= 0 ? linhasHora(j, iHora) : []), [j, iHora]);
  const fluxosHora: FluxoMapa[] = linhasH.map((l) => ({
    par: l.id,
    valor: l.fluxo_mwmed,
    rotuloValor: l.fluxo_mwmed === null ? "sem dado" : `${num(Math.abs(l.fluxo_mwmed), 0)} MWmed`,
    detalhe:
      l.programado_mwmed === null
        ? "sem programa publicado"
        : `programado ${num(Math.abs(l.programado_mwmed), 0)} MWmed${l.programado_mwmed === 0 ? "" : ` ${l.programado_mwmed > 0 ? sentidoPositivo(l.id) : sentidoNegativo(l.id)}`}`,
  }));
  const exteriorHora = j && iHora >= 0 ? Object.fromEntries(PAISES_SUL.map((p) => [p, j.exterior[p]?.[iHora] ?? null])) : undefined;
  const serieH = useMemo(() => (j ? serieJanela(j, frDetalhe) : []), [j, frDetalhe]);
  const diasJanela = j ? diasDaJanela(j) : [];
  const diaHora = horaAtual.slice(0, 10);
  const horasDoDia = j ? j.horas.filter((h) => h.startsWith(diaHora)) : [];

  // histórico
  const diario = useMemo(() => linhasDiarioFronteira(c, frDetalhe), [c, frDetalhe]);
  const saldoDiario = useMemo(() => linhasSaldoDiario(c, escolhidas), [c, escolhidas]);
  const saldoMensal = useMemo(() => linhasSaldoMensal(c, escolhidas), [c, escolhidas]);
  const mensal = useMemo(() => linhasMensalFronteira(c, frDetalhe), [c, frDetalhe]);
  const resumo = useMemo(() => linhasResumo30d(c.resumo_30d), [c.resumo_30d]);
  const diaSub = escala === "hora" && diaHora ? diaHora : dia;
  const subsistemas = useMemo(() => linhasSubsistemasDia(c, diaSub), [c, diaSub]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const [a, b] = PONTAS[frDetalhe];
  const ultimoMes = mensal[mensal.length - 1];

  return (
    <div className="space-y-6">
      <RespostaCurta id="p028" veredito={vereditoCirculacao(c.resumo_30d)}>
        {respostaCirculacao(c.resumo_30d)}
      </RespostaCurta>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <RedeEscolha legenda="Escala" opcoes={OPCOES_ESCALA} valor={escala} onEscolher={(x) => definir({ esc: x })} />
        {escala === "dia" ? (
          <RedeLista
            rotulo="Dia"
            opcoes={[...c.diario.dias].reverse().map((d) => ({ id: d, rotulo: dataBR(d) }))}
            valor={dia}
            onEscolher={(x) => definir({ dia: x })}
          />
        ) : j ? (
          <>
            <RedeLista
              rotulo="Dia da janela"
              opcoes={[...diasJanela].reverse().map((d) => ({ id: d, rotulo: dataBR(d) }))}
              valor={diaHora}
              onEscolher={(d) => {
                // mantém a hora do dia ao trocar de dia, quando ela existe no novo dia
                const hh = horaAtual.slice(10);
                const alvo = j.horas.includes(`${d}${hh}`) ? `${d}${hh}` : (j.horas.filter((h) => h.startsWith(d)).at(-1) ?? "");
                definir({ hora: alvo });
              }}
            />
            <RedeLista rotulo="Hora" opcoes={horasDoDia.map((h) => ({ id: h, rotulo: `${h.slice(11, 13)}h` }))} valor={horaAtual} onEscolher={(h) => definir({ hora: h })} />
          </>
        ) : null}
        {fr && (
          <button
            type="button"
            onClick={() => selecionar(null)}
            className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao-muted hover:border-energia hover:text-carvao"
          >
            Limpar a fronteira escolhida ({curtoFronteira(fr)})
          </button>
        )}
      </div>

      <p className="max-w-prose2 text-sm leading-relaxed text-carvao" aria-live="polite" data-resposta="p028-recorte">
        {escala === "dia"
          ? respostaDia(linhasDia, fr)
          : janela.estado === "pronto" && linhasH.length
            ? respostaHora(linhasH, frDetalhe, exteriorHora)
            : janela.estado === "erro"
              ? `A janela horária não carregou (${janela.erro}). A escala diária continua disponível.`
              : "Carregando a janela horária (fluxo, programa e PLD na mesma hora)…"}
      </p>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            {escala === "dia"
              ? `${dataBR(dia)} (dia escolhido); resumo de ${dataBR(c.resumo_30d[0]?.inicio)} a ${dataBR(c.resumo_30d[0]?.fim)}`
              : horaAtual
                ? `${horaLocal(horaAtual)} (hora de início, Brasília); janela de ${dataBR(c.janela_horaria.inicio)} a ${dataBR(c.janela_horaria.fim)}`
                : `janela de ${dataBR(c.janela_horaria.inicio)} a ${dataBR(c.janela_horaria.fim)}`}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">As quatro fronteiras entre subsistemas publicadas pelo ONS{escala === "hora" ? "; Argentina e Uruguai ligados ao Sul" : ""}</dd>
        </div>
        <div className="min-w-0">
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">{escala === "dia" ? "MWh (energia do dia, soma das horas)" : "MWmed (média da hora); PLD em R$/MWh"}</dd>
        </div>
      </dl>

      {destaques}

      {escala === "dia" ? (
        <RedeMapaFluxos
          titulo="Saldo de cada fronteira no dia"
          periodo={dataBR(dia)}
          unidade="MWh"
          fluxos={fluxosDia}
          selecionado={fr}
          onSelecionar={selecionar}
        />
      ) : janela.estado === "pronto" && j ? (
        <RedeMapaFluxos
          titulo="Fluxo de cada fronteira na hora, com o PLD da mesma hora"
          periodo={horaLocal(horaAtual)}
          unidade="MWmed"
          fluxos={fluxosHora}
          exterior={PAISES_SUL.map((p) => {
            const x = exteriorHora?.[p] ?? null;
            return { pais: p, valor: x, rotuloValor: x === null ? "sem dado" : `${num(Math.abs(x), 0)} MWmed` };
          })}
          precos={Object.fromEntries((["SE", "S", "NE", "N"] as const).map((sm) => [sm, j.pld[sm]?.[iHora] ?? null]))}
          rotuloPrecos="PLD da mesma hora"
          selecionado={fr}
          onSelecionar={selecionar}
        />
      ) : (
        <div role="status" className="border border-dashed border-linha p-6 text-sm text-carvao-muted">
          {janela.estado === "erro" ? (
            <>
              A janela horária não carregou ({janela.erro}).{" "}
              <button type="button" onClick={() => setJanela({ estado: "ocioso" })} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                Tentar de novo
              </button>
            </>
          ) : (
            "Carregando a janela horária…"
          )}
        </div>
      )}

      {escala === "dia" ? (
        <TabelaInterativa
          titulo={`Tabela equivalente: fronteiras em ${dataBR(dia)}`}
          colunas={COLUNAS_FRONTEIRAS_DIA}
          linhas={paraTabela(linhasDia)}
          chaveLinha="id"
          colunaRotulo="fronteira"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-fronteiras-${dia}`}
          chaveUrl="fd"
          selecionado={fr}
          onSelecionar={selecionar}
          nota={`Horas com PLDs diferentes: diferença acima de ${reais(LIMIAR_PRECOS_RS_MWH)}/MWh entre as duas pontas na mesma hora do fluxo. Trocas de sentido contam horas seguidas com fluxo acima de ${num(LIMIAR_NULO_MWMED, 0)} MWmed em módulo.`}
        />
      ) : (
        j && (
          <TabelaInterativa
            titulo={`Tabela equivalente: fronteiras em ${horaLocal(horaAtual)}`}
            colunas={COLUNAS_HORA}
            linhas={paraTabela(linhasH)}
            chaveLinha="id"
            colunaRotulo="fronteira"
            fonte={`${fonte}; CCEE, PLD horário`}
            versao={versao}
            nomeArquivo={`rede-fronteiras-${horaAtual.replace(":", "")}`}
            chaveUrl="fh"
            selecionado={fr}
            onSelecionar={selecionar}
            nota="Primeira e segunda região na ordem do nome da fronteira (Norte → Nordeste: Norte e Nordeste). Sinal positivo no sentido do nome."
          />
        )
      )}

      {escala === "dia" ? (
        <div className="space-y-4">
          <GraficoLinhas
            titulo={`Energia em cada sentido ${entreFronteira(frDetalhe)}, por dia`}
            dados={diario}
            chaveX="d"
            formatoX="data"
            series={[
              { id: "canonico_mwh", rotulo: `${NOME_SM[a]} para ${NOME_SM[b]}`, sigla: `${a}→${b}`, cor: COR_PAR[frDetalhe] },
              { id: "inverso_mwh", rotulo: `${NOME_SM[b]} para ${NOME_SM[a]}`, sigla: `${b}→${a}`, cor: "var(--serie-referencia)", tracejada: true },
              { id: "liquido_mwh", rotulo: "Saldo (positivo no sentido da fronteira)", sigla: "saldo", cor: "var(--cor-carvao)", espessura: 1.5 },
            ]}
            unidade="MWh"
            casas={0}
            zeroNoEixo
            legendaInterativa
          />
          <p className="text-sm text-carvao-muted">
            {fr ? "Fronteira escolhida no esquema ou na tabela." : `Sem fronteira escolhida, o histórico mostra a que teve mais energia escondida pelo saldo em 30 dias (${nomeFronteira(frDetalhe)}). Escolha outra no esquema ou na tabela.`}
          </p>
          <TabelaInterativa
            titulo={`Tabela equivalente: ${nomeFronteira(frDetalhe)}, ${dataBR(c.diario.dias[0])} a ${dataBR(c.diario.dias.at(-1))}`}
            colunas={COLUNAS_DIARIO_FRONTEIRA}
            linhas={paraTabela(diario)}
            chaveLinha="id"
            colunaRotulo="d"
            fonte={fonte}
            versao={versao}
            nomeArquivo={`rede-diario-${frDetalhe}`}
            chaveUrl="d30"
            ordemInicial={{ coluna: "d", direcao: "desc" }}
          />
        </div>
      ) : (
        j && (
          <div className="space-y-4">
            <CursorSincronizado>
              <GraficoLinhas
                titulo={`Fluxo verificado e programado ${entreFronteira(frDetalhe)}, hora a hora (positivo ${sentidoPositivo(frDetalhe)})`}
                dados={serieH}
                chaveX="h"
                formatoX="hora"
                series={[
                  { id: "fluxo", rotulo: "Verificado", cor: COR_PAR[frDetalhe] },
                  { id: "programado", rotulo: "Programado", cor: "var(--serie-referencia)", tracejada: true },
                ]}
                unidade="MWmed"
                casas={0}
                zeroNoEixo
                marcos={horaAtual ? [{ x: horaAtual, rotulo: `hora escolhida: ${horaLocal(horaAtual)}` }] : undefined}
                legendaInterativa
              />
              <GraficoLinhas
                titulo={`PLD ${DO_SM[a]} e ${DO_SM[b]} nas mesmas horas`}
                dados={serieH}
                chaveX="h"
                formatoX="hora"
                series={[
                  { id: "pld_de", rotulo: `PLD ${NOME_SM[a]}`, cor: COR_SM[a] },
                  { id: "pld_para", rotulo: `PLD ${NOME_SM[b]}`, cor: COR_SM[b], tracejada: true },
                ]}
                unidade="R$/MWh"
                casas={2}
                legendaInterativa
              />
            </CursorSincronizado>
            <p className="text-sm text-carvao-muted">
              Os dois gráficos têm o mesmo eixo de horas e a mesma cruz: o PLD de cada hora fica abaixo do fluxo da mesma hora. Preços iguais nas pontas aparecem como linhas
              sobrepostas. Coincidência de preço e fluxo não demonstra fronteira no limite.
            </p>
            <TabelaInterativa
              titulo={`Tabela equivalente: ${nomeFronteira(frDetalhe)}, ${dataBR(c.janela_horaria.inicio)} a ${dataBR(c.janela_horaria.fim)}`}
              colunas={colunasJanela(frDetalhe)}
              linhas={paraTabela(serieH)}
              chaveLinha="id"
              colunaRotulo="h"
              fonte={`${fonte}; CCEE, PLD horário`}
              versao={versao}
              nomeArquivo={`rede-janela-horaria-${frDetalhe}`}
              chaveUrl="jh"
              selecionado={horaAtual || null}
              onSelecionar={(h) => h && definir({ hora: h })}
              ordemInicial={{ coluna: "h", direcao: "desc" }}
            />
          </div>
        )
      )}

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Os 30 dias por fronteira: energia em cada sentido e preço nas pontas</h3>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{textoPrecos30d(c.resumo_30d)}</p>
        <TabelaInterativa
          titulo={`Resumo de ${dataBR(c.resumo_30d[0]?.inicio)} a ${dataBR(c.resumo_30d[0]?.fim)}, por fronteira`}
          colunas={COLUNAS_RESUMO_30D}
          linhas={paraTabela(resumo)}
          chaveLinha="id"
          colunaRotulo="fronteira"
          fonte={fonte}
          versao={versao}
          nomeArquivo="rede-resumo-30-dias"
          chaveUrl="r30"
          selecionado={fr}
          onSelecionar={selecionar}
          nota="Escondida pelo saldo de 30 dias: o menor dos dois sentidos na janela inteira. A soma dia a dia é menor ou igual, porque dias inteiros no sentido oposto entram na janela e não no dia."
        />
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Quem exportou e quem importou em {dataBR(diaSub)}</h3>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-resposta="p028-subsistemas">
          {respostaSubsistemasDia(subsistemas, diaSub)}
        </p>
        <GraficoBarras
          titulo={`Exportação e importação brutas de cada subsistema em ${dataBR(diaSub)}`}
          dados={paraTabela(subsistemas)}
          chaveCategoria="id"
          chaveRotulo="subsistema"
          series={[
            { id: "exportacao_bruta_mwh", rotulo: "Exportação bruta", cor: "var(--cor-energia)" },
            { id: "importacao_bruta_mwh", rotulo: "Importação bruta", cor: "var(--serie-referencia)" },
          ]}
          unidade="MWh"
          casas={0}
        />
        <TabelaInterativa
          titulo={`Tabela equivalente: subsistemas em ${dataBR(diaSub)}`}
          colunas={COLUNAS_SUBSISTEMAS_DIA}
          linhas={paraTabela(subsistemas)}
          chaveLinha="id"
          colunaRotulo="subsistema"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-subsistemas-${diaSub}`}
          chaveUrl="sub"
          nota="Bruto somado hora a hora pelas fronteiras de cada subsistema; no Sul, Argentina e Uruguai entram como fronteiras. Trânsito: horas em que o subsistema exporta por uma fronteira e importa por outra."
        />
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">
          Saldo das fronteiras: 30 dias{c.mensal.meses.length ? ` e meses desde ${mesAno(c.mensal.meses[0])}` : " (sem série mensal nesta publicação)"}
        </h3>
        <Comparador
          rotulo={`Fronteiras nos gráficos (até ${LIMITE_COMPARACAO})`}
          entidades={FRONTEIRAS.map((p) => ({ id: p, rotulo: nomeFronteira(p), sinonimos: [curtoFronteira(p)] }))}
          selecionadas={escolhidas}
          onMudar={(ids) => definir({ frs: ids as FronteiraRede[] })}
          dicaBusca="Buscar, por exemplo Norte, Sul, NE"
          vazio="Nenhuma fronteira escolhida. Escolha até quatro para ver os saldos na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <>
            <GraficoLinhas
              titulo="Saldo diário das fronteiras escolhidas (positivo no sentido do nome)"
              dados={saldoDiario}
              chaveX="d"
              formatoX="data"
              series={escolhidas.map((p) => ({ id: p, rotulo: nomeFronteira(p), sigla: curtoFronteira(p), cor: COR_PAR[p] }))}
              unidade="MWh"
              casas={0}
              zeroNoEixo
            />
            <TabelaInterativa
              titulo="Tabela equivalente: saldo diário das fronteiras escolhidas"
              colunas={colunasSaldoFronteiras("d", escolhidas)}
              linhas={paraTabela(saldoDiario)}
              chaveLinha="id"
              colunaRotulo="d"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`rede-saldo-diario-${escolhidas.join("-")}`}
              chaveUrl="sdia"
              ordemInicial={{ coluna: "d", direcao: "desc" }}
            />
            <GraficoLinhas
              titulo="Saldo mensal das fronteiras escolhidas (positivo no sentido do nome)"
              dados={saldoMensal}
              chaveX="m"
              formatoX="mes"
              series={escolhidas.map((p) => ({ id: p, rotulo: nomeFronteira(p), sigla: curtoFronteira(p), cor: COR_PAR[p] }))}
              unidade="MWh"
              casas={0}
              zeroNoEixo
              zoom
              intervalo={intervalo}
              onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
            />
            <TabelaInterativa
              titulo="Tabela equivalente: saldo mensal das fronteiras escolhidas"
              colunas={colunasSaldoFronteiras("m", escolhidas)}
              linhas={paraTabela(saldoMensal)}
              chaveLinha="id"
              colunaRotulo="m"
              fonte={fonte}
              versao={versao}
              nomeArquivo={`rede-saldo-mensal-${escolhidas.join("-")}`}
              chaveUrl="smes"
              ordemInicial={{ coluna: "m", direcao: "desc" }}
              nota="Mês com menos horas que o calendário (último mês parcial ou dias sem as 24 horas) está marcado na tabela por fronteira abaixo."
            />
          </>
        )}
        <GraficoLinhas
          titulo={`Energia em cada sentido ${entreFronteira(frDetalhe)}, por mês`}
          dados={mensal}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "canonico_mwh", rotulo: `${NOME_SM[a]} para ${NOME_SM[b]}`, sigla: `${a}→${b}`, cor: COR_PAR[frDetalhe] },
            { id: "inverso_mwh", rotulo: `${NOME_SM[b]} para ${NOME_SM[a]}`, sigla: `${b}→${a}`, cor: "var(--serie-referencia)", tracejada: true },
          ]}
          unidade="MWh"
          casas={0}
          zeroNoEixo
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
        />
        {ultimoMes && ultimoMes.mes_completo !== "sim" && (
          <p className="text-sm text-carvao-muted">
            {mesAno(ultimoMes.m)} é parcial, com {ultimoMes.mes_completo.replace(/^não \((.*)\)$/, "$1")}: não compare o seu total com o de meses completos.
          </p>
        )}
        <TabelaInterativa
          titulo={`Tabela equivalente: ${nomeFronteira(frDetalhe)}, por mês`}
          colunas={COLUNAS_MENSAL_FRONTEIRA}
          linhas={paraTabela(mensal)}
          chaveLinha="id"
          colunaRotulo="m"
          fonte={fonte}
          versao={versao}
          nomeArquivo={`rede-mensal-${frDetalhe}`}
          chaveUrl="m.t"
          ordemInicial={{ coluna: "m", direcao: "desc" }}
        />
      </div>
    </div>
  );
}
