"use client";

import type { Comparacao } from "@/lib/eficiencia/saude/consulta";
import type { MedidaSaude } from "@/lib/eficiencia/saude/medidas";
import { FaixaResumo } from "../PanoramaGraficos";

const nomes = (cs: { nome: string; uf: string }[]) => (cs.length <= 2 ? cs.map((c) => `${c.nome} (${c.uf})`).join(" e ") : `${cs[0].nome} (${cs[0].uf}) e mais ${cs.length - 1}`);

/** Menor valor, mediana e maior valor das capitais numa escala só, com a metade central ao fundo; os extremos são nomeados, nunca escondidos. */
export function PanoramaFaixa({ m, c, ano, destaque, semDestaqueMotivo }: { m: MedidaSaude; c: Comparacao; ano: number; destaque: { rotulo: string; valor: number } | null; semDestaqueMotivo: string | null }) {
  const r = c.ref;
  if (!r || r.mediana === null || r.minimo === null || r.maximo === null) {
    return <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">Nenhuma capital tem valor comparável para este recorte.</p>;
  }
  const faixa = r.quartisExibicao && r.q1 !== null && r.q3 !== null ? { q1: r.q1, q3: r.q3 } : null;
  const descricao = `${m.rotulo}, ${ano}: menor valor ${m.formata(r.minimo)} em ${nomes(r.capitaisMinimo)}; mediana ${m.formata(r.mediana)}; maior valor ${m.formata(r.maximo)} em ${nomes(r.capitaisMaximo)}; ${r.n} capitais na comparação.`;
  return (
    <div>
      <FaixaResumo
        menor={r.minimo}
        mediana={r.mediana}
        maior={r.maximo}
        faixa={faixa}
        destaque={destaque}
        formata={(v) => m.formata(v)}
        formataCurto={(v) => m.formata(v, true)}
        formataEixo={m.formataEixo}
        zero={m.zero}
        tituloEixo={m.unidade("nominal")}
        descricao={descricao}
      />
      <p className="mt-2 text-[0.8125rem] leading-snug text-carvao-muted">
        Menor: {nomes(r.capitaisMinimo)}. Maior: {nomes(r.capitaisMaximo)}.{faixa ? "" : " Metade central não exibida: menos de 8 capitais."}
      </p>
      {semDestaqueMotivo && <p className="mt-1 text-[0.8125rem] leading-snug text-obee-tinta" role="note">{semDestaqueMotivo}</p>}
    </div>
  );
}
