"use client";

import { useId, useState } from "react";

/**
 * "Da creche ao 9º ano: quem cuida de cada etapa" (modelo didático da entrada). As quatro etapas que a prefeitura atende, na
 * ordem da vida escolar, com a parte das matrículas que fica na rede municipal, no Brasil ou no estado escolhido, e onde o
 * Saeb e o Ideb medem. As contagens vêm do Censo Escolar pelo servidor; o navegador só troca o recorte.
 */
export type Recorte = { id: string; nome: string; etapas: { creche: Par; pre: Par; ai: Par & { publica: number }; af: Par & { publica: number } } };
type Par = { mun: number; total: number };

const ETAPAS = [
  { id: "creche", nome: "Creche", idade: "até 3 anos", medida: "Sem Ideb: não há prova nesta etapa" },
  { id: "pre", nome: "Pré escola", idade: "4 e 5 anos", medida: "Sem Ideb: não há prova nesta etapa" },
  { id: "ai", nome: "Anos iniciais", idade: "1º ao 5º ano", medida: "Saeb no 5º ano: daqui sai o Ideb dos anos iniciais" },
  { id: "af", nome: "Anos finais", idade: "6º ao 9º ano", medida: "Saeb no 9º ano: daqui sai o Ideb dos anos finais" },
] as const;

const br = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pct = (a: number, b: number) => (b > 0 ? `${br((a / b) * 100, 1)}%` : null);

export function QuemCuida({ recortes, inicial, ano }: { recortes: Recorte[]; inicial: string; ano: number }) {
  const id = useId().replace(/:/g, "");
  const [escolhido, setEscolhido] = useState(inicial);
  const r = recortes.find((x) => x.id === escolhido) ?? recortes[0];
  return (
    <div className="edm-quem" data-quem-cuida="">
      <div className="edm-quem-escolha">
        <label htmlFor={`${id}-recorte`}>Ver no</label>
        <select id={`${id}-recorte`} value={r.id} onChange={(e) => setEscolhido(e.target.value)}>
          {recortes.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
      </div>
      <ol className="edm-quem-linha" aria-live="polite">
        {ETAPAS.map((e) => {
          const par = r.etapas[e.id];
          const parte = par.total > 0 ? par.mun / par.total : null;
          const publica = "publica" in par ? pct(par.mun, par.publica) : null;
          return (
            <li key={e.id} data-etapa={e.id}>
              <h3>
                {e.nome} <span>{e.idade}</span>
              </h3>
              {parte === null ? (
                <p className="edm-quem-valor edm-quem-sem">Sem matrícula publicada</p>
              ) : (
                <p className="edm-quem-valor">
                  <span className="numero-m">{pct(par.mun, par.total)}</span>
                  <span className="edm-unidade">na rede municipal</span>
                </p>
              )}
              <span className="edm-quem-barra" aria-hidden="true">
                <i style={{ width: `${(parte ?? 0) * 100}%` }} />
              </span>
              <p className="edm-quem-conta">
                {br(par.mun)} de {br(par.total)} matrículas, todas as redes
                {publica && <> · {publica} da rede pública</>}
              </p>
              <p className={`edm-quem-medida${e.id === "ai" || e.id === "af" ? " edm-quem-mede" : ""}`}>{e.medida}</p>
            </li>
          );
        })}
      </ol>
      <p className="edm-fonte">
        {r.id === "DF"
          ? "O Distrito Federal não tem rede municipal: as escolas públicas de Brasília são distritais, registradas como estaduais. "
          : ""}
        Fonte: INEP, Sinopse Estatística do Censo Escolar {ano}, matrículas por etapa e dependência administrativa. Partes calculadas pela Scrutiniums sobre as matrículas
        de todas as redes, inclusive a privada.
      </p>
    </div>
  );
}
