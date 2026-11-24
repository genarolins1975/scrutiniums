"use client";

import { useId, useState, type ReactNode } from "react";

export type OpcaoVista = { id: string; rotulo: string };

/**
 * Alternância entre duas ou mais vistas de uma mesma figura ("Contagem | Por área", "Estados | Municípios"): um grupo de botões de
 * rádio nativos com legenda visível, logo antes do conteúdo que trocam, como os controles do kit de painel. Setas trocam a opção
 * pelo teclado (comportamento nativo do rádio) e o foco fica no controle. Só a vista escolhida é montada, para que uma vista pesada
 * (a malha municipal) não seja baixada sem pedido; sem JavaScript vale a primeira. As tabelas equivalentes ficam fora daqui, no HTML.
 */
export function AlternarVista({
  legenda,
  opcoes,
  vistas,
  inicial,
  aoTrocar,
}: Readonly<{
  legenda: string;
  opcoes: readonly OpcaoVista[];
  /** Uma vista por opção, na mesma ordem. */
  vistas: readonly ReactNode[];
  inicial?: string;
  aoTrocar?: (id: string) => void;
}>) {
  const nome = useId();
  const [atual, setAtual] = useState(inicial ?? opcoes[0].id);
  const i = Math.max(0, opcoes.findIndex((o) => o.id === atual));
  return (
    <div data-alternar-vista={atual}>
      <fieldset className="min-w-0 border-y border-linha py-3" data-controles-vista="">
        <legend className="float-left mr-4 flex min-h-[44px] items-center text-sm text-carvao">{legenda}</legend>
        <div className="inline-flex flex-wrap">
          {opcoes.map((o) => (
            <label
              key={o.id}
              className="-ml-px inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center border border-linha bg-superficie px-4 text-sm text-carvao-muted transition-colors duration-150 first:ml-0 hover:text-carvao has-[:checked]:relative has-[:checked]:z-[1] has-[:checked]:border-obee has-[:checked]:bg-obee-fundo has-[:checked]:text-obee-dark has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-carvao"
            >
              <input
                type="radio"
                name={nome}
                value={o.id}
                checked={o.id === atual}
                onChange={() => {
                  setAtual(o.id);
                  aoTrocar?.(o.id);
                }}
                className="sr-only"
              />
              {o.rotulo}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 min-w-0">{vistas[i]}</div>
    </div>
  );
}
