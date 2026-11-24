"use client";

import { useId, useState } from "react";
import type { MudancaEtapa, PeriodoDecomposto, RecorteDecomposto } from "@/lib/educacao/decomposicao";

/**
 * "Aprenderam mais ou reprovaram menos?" (seção própria da entrada). Recebe do servidor os recortes já divididos
 * (src/lib/educacao/decomposicao.ts); o navegador só escolhe o lugar e o período. As barras de todas as etapas, períodos e
 * lugares dividem a mesma escala, para que a troca compare tamanhos de verdade.
 */
const NOME: Record<MudancaEtapa["etapa"], [string, string]> = { ai: ["Anos iniciais", "1º ao 5º ano"], af: ["Anos finais", "6º ao 9º ano"] };

const br = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const sinal = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${br(Math.abs(v), 2)}`;

export function MotorIdeb({ recortes, inicial, padrao }: { recortes: RecorteDecomposto[]; inicial: string; padrao: number }) {
  const id = useId().replace(/:/g, "");
  const [lugar, setLugar] = useState(inicial);
  const [inicio, setInicio] = useState(padrao);
  const r = recortes.find((x) => x.id === lugar) ?? recortes[0];
  const atual = r.periodos.find((p) => p.inicio === inicio) ?? r.periodos[r.periodos.length - 1];
  // escala comum: do menor valor negativo (ou zero) ao maior positivo, entre todas as parcelas de todos os recortes
  const parcelas = recortes.flatMap((y) => y.periodos.flatMap((p) => p.etapas.flatMap((e) => [e.parcelaN, e.parcelaP]))).filter((v): v is number => v !== null);
  const lo = Math.min(0, ...parcelas);
  const hi = Math.max(0.1, ...parcelas);
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="edm-motor" data-motor-ideb="">
      <div className="edm-motor-controles">
        <div className="edm-quem-escolha">
          <label htmlFor={`${id}-lugar`}>Lugar</label>
          <select id={`${id}-lugar`} value={r.id} onChange={(e) => setLugar(e.target.value)}>
            {recortes.map((y) => (
              <option key={y.id} value={y.id}>
                {y.nome}, {y.rede}
              </option>
            ))}
          </select>
        </div>
        <div className="edm-segmento" role="group" aria-label="Período da comparação">
          {r.periodos.map((p) => (
            <button key={p.inicio} type="button" aria-pressed={p.inicio === atual.inicio} onClick={() => setInicio(p.inicio)}>
              {p.inicio} a {p.fim}
            </button>
          ))}
        </div>
      </div>
      <p className="edm-motor-achado" aria-live="polite">
        {achado(atual, r)}
      </p>
      <div className="edm-motor-grade">
        {atual.etapas.map((e) => (
          <Etapa key={e.etapa} e={e} x={x} zero={x(0)} />
        ))}
      </div>
    </div>
  );
}

function Etapa({ e, x, zero }: { e: MudancaEtapa; x: (v: number) => number; zero: number }) {
  const [nome, series] = NOME[e.etapa];
  const barras: [string, string, number | null, string][] = [
    ["n", "Aprendizagem", e.parcelaN, `nota do Saeb (N): ${br(e.n[0], 2)} → ${br(e.n[1], 2)}, de 0 a 10`],
    ["p", "Aprovação", e.parcelaP, `fluxo (P): ${br(e.p[0], 2)} → ${br(e.p[1], 2)}, de 0 a 1`],
  ];
  return (
    <section className="edm-motor-etapa" aria-label={`${nome}, ${e.inicio} a ${e.fim}`}>
      <h3>
        {nome} <span>{series}</span>
      </h3>
      <p className="edm-motor-ideb">
        <span className="numero-m">{br(e.ideb[0], 1)}</span>
        <span aria-hidden="true" className="edm-motor-seta">→</span>
        <span className="sr-only"> para </span>
        <span className="numero-m edm-motor-final">{br(e.ideb[1], 1)}</span>
        <span className="edm-unidade">Ideb publicado, de 0 a 10, de {e.inicio} a {e.fim}</span>
      </p>
      {e.parcelaN !== null && e.parcelaP !== null ? (
        <dl className="edm-motor-barras">
          {barras.map(([id, rotulo, v, detalhe]) => (
            <div key={id} data-parcela={id}>
              <dt>
                Parcela da {rotulo.toLowerCase()}
                <small>{detalhe}</small>
              </dt>
              <dd>
                <span className="edm-motor-trilho" aria-hidden="true">
                  <b style={{ left: `${zero}%` }} />
                  <i className={`edm-motor-${id}`} style={{ left: `${Math.min(zero, x(v!))}%`, width: `${Math.abs(x(v!) - zero)}%` }} />
                </span>
                <span className="edm-motor-valor">{sinal(v!)} <small>ponto</small></span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="edm-aviso">A mudança do produto N × P é menor que 0,05 ponto: o painel mostra os movimentos sem dividir a variação.</p>
      )}
      <p className="edm-motor-apoio">
        {e.aprov[0] !== null && e.aprov[1] !== null && <>Taxa de aprovação da etapa: {br(e.aprov[0], 1)}% → {br(e.aprov[1], 1)}%. </>}
        {e.mat[0] !== null && e.mat[1] !== null && e.port[0] !== null && e.port[1] !== null && (
          <>
            Saeb, em pontos: matemática {br(e.mat[0], 1)} → {br(e.mat[1], 1)}; português {br(e.port[0], 1)} → {br(e.port[1], 1)}.
          </>
        )}
      </p>
    </section>
  );
}

/** A frase do período, calculada com os mesmos números das barras: qual parcela foi maior em cada etapa. */
function achado(p: PeriodoDecomposto, r: RecorteDecomposto): string {
  const partes = p.etapas.map((e) => {
    const [nome] = NOME[e.etapa];
    if (e.parcelaN === null || e.parcelaP === null) return `nos ${nome.toLowerCase()}, a mudança do produto N × P foi menor que 0,05 ponto e não foi dividida`;
    const maior = Math.abs(e.parcelaP) > Math.abs(e.parcelaN) ? "da aprovação" : "da aprendizagem";
    return `nos ${nome.toLowerCase()}, a maior parcela veio ${maior} (${sinal(e.parcelaN)} ponto da aprendizagem e ${sinal(e.parcelaP)} da aprovação)`;
  });
  return `${r.nome}, ${r.rede}, de ${p.inicio} a ${p.fim}: ${partes.join("; ")}.`;
}
