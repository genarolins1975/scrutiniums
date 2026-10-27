"use client";

import { useId, useMemo, type KeyboardEvent } from "react";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";

/**
 * Laboratório do Ideb (modelo didático): o leitor move a aprendizagem (N) e o fluxo (P) e vê o índice que resulta, a
 * partir dos números reais da rede escolhida. A conta é a do INEP (Ideb = N × P, com uma casa); o modelo deixa de fora
 * que P vem da média harmônica das taxas de aprovação de cada ano escolar e que N vem das notas de português e
 * matemática padronizadas pelos limites do Saeb de 1997. Sem script, a página mostra o resultado real em texto.
 */
const fmt = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function LaboratorioIdeb({ n, p, ideb, rede, ano, chaveUrl = "ideb" }: { n: number; p: number; ideb: number; rede: string; ano: number; chaveUrl?: string }) {
  const id = useId().replace(/:/g, "");
  const esquema = useMemo(() => ({
    nota: campo(tiposUrl.numero({ min: 0, max: 10 }), n, { param: `${chaveUrl}_n`, historico: "replace" }),
    fluxo: campo(tiposUrl.numero({ min: 0, max: 100 }), p * 100, { param: `${chaveUrl}_p`, historico: "replace" }),
  }), [n, p, chaveUrl]);
  const [{ nota, fluxo }, definir] = useEstadoUrl(esquema);
  const setNota = (valor: number) => definir({ nota: valor });
  const setFluxo = (valor: number) => definir({ fluxo: valor });
  const resultado = Math.round(nota * (fluxo / 100) * 10) / 10;
  // Precisão publicada no repouso e passo útil por teclado: um décimo em N, um centésimo em P.
  const tecla = (e: KeyboardEvent<HTMLInputElement>, valor: number, passo: number, max: number, definir: (v: number) => void) => {
    const sinal = ["ArrowRight", "ArrowUp"].includes(e.key) ? 1 : ["ArrowLeft", "ArrowDown"].includes(e.key) ? -1 : 0;
    if (!sinal) return;
    e.preventDefault();
    definir(Math.min(max, Math.max(0, Number((valor + sinal * passo).toFixed(4)))));
  };
  const real = n === nota && p * 100 === fluxo;
  return (
    <div className="edm-lab" data-modelo-didatico="">
      <div className="edm-lab-controles">
        <div>
          <label htmlFor={`${id}-n`}>
            Aprendizagem: nota do Saeb padronizada (N), de 0 a 10 <output htmlFor={`${id}-n`}>{fmt(nota, 4)}</output>
          </label>
          <input id={`${id}-n`} type="range" min={0} max={10} step={0.0001} value={nota} onKeyDown={(e) => tecla(e, nota, 0.1, 10, setNota)} onChange={(e) => setNota(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor={`${id}-p`}>
            Fluxo: indicador de rendimento (P), perto da taxa de aprovação <output htmlFor={`${id}-p`}>{fmt(fluxo / 100, 4)}</output>
          </label>
          <input id={`${id}-p`} type="range" min={0} max={100} step={0.01} value={fluxo} onKeyDown={(e) => tecla(e, fluxo, 1, 100, setFluxo)} onChange={(e) => setFluxo(Number(e.target.value))} />
        </div>
      </div>
      <div className="edm-lab-acoes">
        <button type="button" className="edm-lab-voltar" onClick={() => setFluxo(100)}>Aprovação de todos (P = 1)</button>
        <button type="button" className="edm-lab-voltar" onClick={() => { setNota(n); setFluxo(p * 100); }}>Valor publicado</button>
      </div>
      <p className="edm-lab-conta" aria-live="polite">
        <span>{fmt(nota, 4)}</span> × <span>{fmt(fluxo / 100, 4)}</span> = <strong>Ideb {fmt(resultado, 1)}</strong>
        {real ? <small> o valor publicado da {rede} em {ano}: {fmt(ideb, 1)}</small> : <small> com os números que você escolheu</small>}
      </p>
      <p className="edm-lab-nota" aria-live="polite">
        {real ? "Os controles estão nos componentes publicados." : `Com estes componentes, a mudança em relação ao produto publicado N × P seria de ${fmt(resultado - Math.round(n * p * 10) / 10, 1)} ponto de Ideb.`}
        {" "}O produto N × P pode diferir do Ideb publicado pelo arredondamento do INEP. O cenário não é previsão nem relação causal.
      </p>
    </div>
  );
}
