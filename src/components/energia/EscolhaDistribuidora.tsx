"use client";

import { useId, useState } from "react";

/**
 * Pergunta do dia a dia sobre "a minha distribuidora" (seção 6.2 D): a pessoa escolhe
 * a distribuidora e o link abre a página de destino com ela já selecionada, pelo mesmo
 * parâmetro de URL que a página usa (Perdas: ?d=CNPJ; Qualidade: ?dist=CNPJ). Só
 * entram distribuidoras que a página de destino publica. Sem JavaScript, o link leva à
 * página sem escolha.
 */

export type OpcaoDistribuidora = { cnpj: string; sigla: string; nome: string | null; ufs?: string[] };

export function EscolhaDistribuidora({
  opcoes,
  destino,
  parametro,
  ancora,
  rotulo,
  ano,
}: {
  opcoes: OpcaoDistribuidora[];
  destino: string;
  parametro: "d" | "dist";
  ancora: string;
  rotulo: string;
  /** Ano do dado de cada distribuidora da lista (a lista só tem quem tem dado nele). */
  ano?: number | null;
}) {
  const [cnpj, setCnpj] = useState("");
  const id = useId();
  const escolhida = opcoes.find((o) => o.cnpj === cnpj) ?? null;
  const href = `${destino}${escolhida ? `?${parametro}=${escolhida.cnpj}` : ""}#${ancora}`;

  return (
    <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
      <div className="min-w-0">
        <label htmlFor={`${id}-d`} className="block text-xs text-mineral">
          Sua distribuidora
        </label>
        <select
          id={`${id}-d`}
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          className="mt-1 min-h-[44px] max-w-full border border-linha bg-superficie px-2 text-sm text-carvao"
        >
          <option value="">
            Escolha ({opcoes.length} distribuidoras{ano ? ` com dado de ${ano}` : ""})
          </option>
          {opcoes.map((o) => (
            // sigla e estados: o nome oficial da fonte vem em caixa alta e sem acento, e fica no title
            <option key={o.cnpj} value={o.cnpj} title={o.nome ?? undefined}>
              {o.sigla}
              {o.ufs && o.ufs.length ? ` (${o.ufs.join(", ")})` : ""}
            </option>
          ))}
        </select>
      </div>
      <a href={href} className="rotulo inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
        {escolhida ? `${rotulo}: ${escolhida.sigla}` : rotulo}
      </a>
    </div>
  );
}
