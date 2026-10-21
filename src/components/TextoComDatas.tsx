import { LiteralFonte } from "@/components/LiteralFonte";
import { LITERAIS, type ClasseLiteral } from "@/lib/literais-fonte";
import { segmentosComDatas, type OpcoesData } from "@/lib/texto-datas";

export type LiteralNoTexto = {
  classe: ClasseLiteral;
  /** Endereço (https ou caminho do site) do recurso de onde o literal foi tirado. */
  origem: string;
  /** Sobrepõe a detecção do registro; o grupo 1 é o literal. */
  deteccao?: RegExp;
};

type Parte = { tipo: "texto"; texto: string } | { tipo: "literal"; texto: string; classe: ClasseLiteral; origem: string };

/** Separa os literais declarados do texto corrido; o grupo 1 de cada detecção é o literal. */
function partes(texto: string, literais: LiteralNoTexto[]): Parte[] {
  const achados: { ini: number; fim: number; classe: ClasseLiteral; origem: string }[] = [];
  for (const l of literais) {
    const re = l.deteccao ?? (LITERAIS[l.classe] as { deteccao?: RegExp }).deteccao;
    if (!re) continue;
    const g = new RegExp(re.source, "g");
    for (let m = g.exec(texto); m !== null; m = g.exec(texto)) {
      if (m[1] === undefined) continue;
      const ini = m.index + m[0].indexOf(m[1]);
      achados.push({ ini, fim: ini + m[1].length, classe: l.classe, origem: l.origem });
    }
  }
  achados.sort((a, b) => a.ini - b.ini);
  const out: Parte[] = [];
  let ultimo = 0;
  for (const a of achados) {
    if (a.ini < ultimo) continue;
    if (a.ini > ultimo) out.push({ tipo: "texto", texto: texto.slice(ultimo, a.ini) });
    out.push({ tipo: "literal", texto: texto.slice(a.ini, a.fim), classe: a.classe, origem: a.origem });
    ultimo = a.fim;
  }
  if (ultimo < texto.length) out.push({ tipo: "texto", texto: texto.slice(ultimo) });
  return out;
}

/**
 * Texto do pipeline com datas ISO legíveis (<time datetime> preserva o original) e, quando
 * declarados, literais da fonte identificados. Data inexistente ou horário inválido fora de um
 * literal fica como veio e reprova a verificação do HTML.
 */
export function TextoComDatas({ texto, literais = [], ...opcoes }: { texto: string; literais?: LiteralNoTexto[] } & OpcoesData) {
  return (
    <>
      {partes(texto, literais).map((p, i) =>
        p.tipo === "literal" ? (
          <LiteralFonte key={i} classe={p.classe} origem={p.origem}>
            {p.texto}
          </LiteralFonte>
        ) : (
          <TrechoComDatas key={i} texto={p.texto} {...opcoes} />
        ),
      )}
    </>
  );
}

function TrechoComDatas({ texto, ...opcoes }: { texto: string } & OpcoesData) {
  return (
    <>
      {segmentosComDatas(texto, opcoes).map((s, i) =>
        typeof s === "string" ? (
          s
        ) : s.tipo === "data" ? (
          <time key={i} dateTime={s.iso}>
            {s.texto}
          </time>
        ) : (
          s.bruto
        ),
      )}
    </>
  );
}
