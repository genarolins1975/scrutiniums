"use client";

import { useId, useMemo } from "react";
import { Controles } from "@/components/painel/Controles";
import { GraficoLinhas } from "@/components/painel/GraficoLinhas";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import { CLASSE_BAIXAR, baixarTexto, montarCsv } from "./BaixarCsv";

export type IndicadorExplorador = { key: string; rotulo: string; unidade: string; fonte: string; codigo: string };
type Linha = { mes: string } & Record<string, string | number | null>;
type Escala = "nivel" | "base100" | "z";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
const SELECT = "mt-1 min-h-[44px] w-full max-w-xs border border-linha bg-superficie px-2 text-sm text-carvao";

/**
 * Explorador de indicadores de crédito das famílias com os marcos do tema (Apostas; Golpes e fraudes). Uma série por vez, nunca em
 * dois eixos com a exposição ao tema: a base não tem observações suficientes para correlação, e a página diz isso ao lado.
 *
 * As três escalas são as da vista de origem, sobre a janela exibida: nível (o valor publicado), base 100 no primeiro mês da janela e
 * desvios-padrão em relação à média da janela. O recorte fica na URL (?ind=, ?escala=, ?marcos=). O arquivo baixado traz a série
 * inteira do indicador escolhido, no valor publicado.
 */
export function ExploradorCredito({
  indicadores,
  linhas,
  desde,
  marcos,
  rotuloMarcos,
  arquivo,
}: Readonly<{
  indicadores: readonly IndicadorExplorador[];
  /** Todos os meses da base, um por linha; mês sem observação é null. */
  linhas: readonly Linha[];
  /** Primeiro mês da janela exibida ("AAAA-MM"). */
  desde: string;
  marcos: readonly { x: string; rotulo: string }[];
  rotuloMarcos: string;
  /** Prefixo do nome do arquivo baixado. */
  arquivo: string;
}>) {
  const id = useId();
  const chaves = indicadores.map((i) => i.key).join(",");
  const esquema = useMemo(
    () => ({
      ind: campo(tiposUrl.opcao(chaves.split(",")), chaves.split(",")[0]),
      escala: campo(tiposUrl.opcao(["nivel", "base100", "z"] as const), "nivel" as Escala),
      marcos: campo(tiposUrl.booleano(), true),
    }),
    [chaves],
  );
  const [estado, definir] = useEstadoUrl(esquema);
  const indicador = indicadores.find((i) => i.key === estado.ind) ?? indicadores[0];
  const escala = estado.escala as Escala;

  const janela = useMemo(() => linhas.filter((l) => l.mes >= desde && typeof l[indicador.key] === "number"), [linhas, desde, indicador.key]);
  const dados = useMemo(() => {
    const valores = janela.map((l) => l[indicador.key] as number);
    if (escala === "base100" && valores.length) {
      const base = valores[0];
      return janela.map((l, i) => ({ mes: l.mes, v: base ? (valores[i] / base) * 100 : null }));
    }
    if (escala === "z" && valores.length > 2) {
      const media = valores.reduce((a, b) => a + b, 0) / valores.length;
      const desvio = Math.sqrt(valores.reduce((a, b) => a + (b - media) ** 2, 0) / valores.length) || 1;
      return janela.map((l, i) => ({ mes: l.mes, v: (valores[i] - media) / desvio }));
    }
    return janela.map((l, i) => ({ mes: l.mes, v: valores[i] }));
  }, [janela, indicador.key, escala]);

  const primeiro = janela[0]?.mes ?? desde;
  const ultimo = janela[janela.length - 1]?.mes ?? desde;
  const unidade = escala === "nivel" ? indicador.unidade : escala === "base100" ? `base 100 em ${mesAno(primeiro)}` : "desvios-padrão em relação à média da janela";
  const nomeEscala = escala === "nivel" ? "valor publicado" : escala === "base100" ? `base 100 em ${mesAno(primeiro)}` : "desvios-padrão na janela";
  const padrao = estado.ind === indicadores[0].key && escala === "nivel" && estado.marcos;

  const baixar = () => {
    const serie = linhas.filter((l) => typeof l[indicador.key] === "number");
    baixarTexto(
      `${arquivo}_${indicador.key}.csv`,
      montarCsv([["referencia", indicador.rotulo, "unidade", "fonte", "serie_sgs"], ...serie.map((l) => [l.mes, l[indicador.key] as number, indicador.unidade, indicador.fonte, indicador.codigo])]),
    );
  };

  return (
    <div data-explorador-credito="">
      <Controles
        rotulo="Recorte do explorador de crédito"
        resumo={`Mostrando ${indicador.rotulo}, ${nomeEscala}, de ${mesAno(primeiro)} a ${mesAno(ultimo)}. Fonte: ${indicador.fonte}.`}
        limpar={padrao ? undefined : { href: "?" }}
      >
        <div className="min-w-0">
          <label htmlFor={`${id}-ind`} className="rotulo block text-mineral">
            Indicador de crédito
          </label>
          <select id={`${id}-ind`} className={SELECT} value={indicador.key} onChange={(e) => definir({ ind: e.target.value })}>
            {indicadores.map((i) => (
              <option key={i.key} value={i.key}>
                {i.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-escala`} className="rotulo block text-mineral">
            Escala
          </label>
          <select id={`${id}-escala`} className={SELECT} value={escala} onChange={(e) => definir({ escala: e.target.value as Escala })}>
            <option value="nivel">Valor publicado</option>
            <option value="base100">Base 100 no início da janela</option>
            <option value="z">Desvios-padrão na janela</option>
          </select>
        </div>
        <label className="inline-flex min-h-[44px] items-center gap-2 text-sm text-carvao">
          <input type="checkbox" className="h-5 w-5 accent-current" checked={estado.marcos} onChange={(e) => definir({ marcos: e.target.checked })} />
          {rotuloMarcos}
        </label>
        <button type="button" className={CLASSE_BAIXAR} onClick={baixar}>
          Baixar a série completa do indicador (CSV)
        </button>
      </Controles>
      <div className="mt-4">
        <GraficoLinhas
          semTabela
          titulo={`${indicador.rotulo}, ${nomeEscala}`}
          dados={dados}
          chaveX="mes"
          formatoX="mes"
          series={[{ id: "v", rotulo: indicador.rotulo, cor: "var(--serie-1)" }]}
          unidade={unidade}
          casas={escala === "base100" ? 1 : 2}
          marcos={estado.marcos ? marcos.map((m) => ({ x: m.x, rotulo: m.rotulo })) : []}
          altura={300}
        />
      </div>
    </div>
  );
}
