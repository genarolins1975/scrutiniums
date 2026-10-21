"use client";

import { useId, useState } from "react";

/**
 * Laboratório do Ideb (modelo didático): o leitor move a aprendizagem (N) e o fluxo (P) e vê o índice que resulta, a
 * partir dos números reais da rede escolhida. A conta é a do INEP (Ideb = N × P, com uma casa); o modelo deixa de fora
 * que P vem da média harmônica das taxas de aprovação de cada ano escolar e que N vem das notas de português e
 * matemática padronizadas pelos limites do Saeb de 1997. Sem script, a página mostra o resultado real em texto.
 */
const fmt = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function LaboratorioIdeb({ n, p, ideb, rede, ano }: { n: number; p: number; ideb: number; rede: string; ano: number }) {
  const id = useId().replace(/:/g, "");
  const [nota, setNota] = useState(Math.round(n * 10) / 10);
  const [fluxo, setFluxo] = useState(Math.round(p * 100));
  const resultado = Math.round(nota * (fluxo / 100) * 10) / 10;
  const real = Math.round(n * 10) / 10 === nota && Math.round(p * 100) === fluxo;
  return (
    <div className="edm-lab" data-modelo-didatico="">
      <div className="edm-lab-controles">
        <div>
          <label htmlFor={`${id}-n`}>
            Aprendizagem: nota do Saeb padronizada (N), de 0 a 10 <output htmlFor={`${id}-n`}>{fmt(nota, 1)}</output>
          </label>
          <input id={`${id}-n`} type="range" min={0} max={10} step={0.1} value={nota} onChange={(e) => setNota(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor={`${id}-p`}>
            Fluxo: indicador de rendimento (P), perto da taxa de aprovação <output htmlFor={`${id}-p`}>{fmt(fluxo / 100, 2)}</output>
          </label>
          <input id={`${id}-p`} type="range" min={50} max={100} step={1} value={fluxo} onChange={(e) => setFluxo(Number(e.target.value))} />
        </div>
      </div>
      <p className="edm-lab-conta" aria-live="polite">
        <span>{fmt(nota, 1)}</span> × <span>{fmt(fluxo / 100, 2)}</span> = <strong>Ideb {fmt(resultado, 1)}</strong>
        {real ? <small> o valor publicado da {rede} em {ano}: {fmt(ideb, 1)}</small> : <small> com os números que você escolheu</small>}
      </p>
      <p className="edm-lab-nota">
        Modelo didático com a conta do INEP. Ele deixa de fora dois detalhes: P é a média harmônica das taxas de aprovação de cada ano escolar, e N junta as notas de português e
        matemática na régua do Saeb de 1997. Com aprovação perfeita (P = 1), o Ideb fica igual à nota; reprovar ou abandonar puxa o índice para baixo na mesma proporção.
      </p>
      {!real && (
        <button type="button" className="edm-lab-voltar edm-toque" onClick={() => { setNota(Math.round(n * 10) / 10); setFluxo(Math.round(p * 100)); }}>
          Voltar aos números da {rede}
        </button>
      )}
    </div>
  );
}
