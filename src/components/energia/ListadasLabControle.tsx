"use client";

import { useId, useState } from "react";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { Nome } from "@/components/i18n/Nome";

export type CompanhiaLabControle = {
  papel: string;
  nome: string;
  mwControle: number;
  mwProporcional: number;
  porNivel: { nivel: number; mw: number; usinas: number }[];
  /** Participações declaradas no FRE de outras companhias da carteira nesta (ex.: Cemig na Taesa), em texto pronto. */
  cruzadas: string[];
};


/**
 * Laboratório "como ler uma cadeia de controle", com os números reais de uma companhia da carteira. O leitor escolhe até quantos
 * degraus abaixo da companhia o dono direto da usina pode estar: no degrau 0 só contam as usinas da própria companhia; cada degrau
 * acrescenta as controladas das controladas. Ao lado, as três medidas que não se somam: potência sob controle (a usina inteira de quem
 * tem mais de 50%), potência proporcional (a fatia das empresas sob controle) e a participação cruzada declarada entre companhias da
 * carteira, que fica fora quando o controle é compartilhado.
 */
export function ListadasLabControle({ companhias, inicial }: { companhias: CompanhiaLabControle[]; inicial: string }) {
  const tx = useTx();
  const f = formatos(useIdioma());
  const n = (v: number, casas = 0) => f.num(v, casas);
  const [papel, setPapel] = useState(inicial);
  const c = companhias.find((x) => x.papel === papel) ?? companhias[0];
  const maxNivel = Math.max(0, ...c.porNivel.map((x) => x.nivel));
  const [nivel, setNivel] = useState(maxNivel);
  const nivelUsado = Math.min(nivel, maxNivel);
  const id = useId();
  const ate = c.porNivel.filter((x) => x.nivel <= nivelUsado);
  const mwAte = ate.reduce((a, x) => a + x.mw, 0);
  const usinasAte = ate.reduce((a, x) => a + x.usinas, 0);
  const escala = Math.max(c.mwControle, c.mwProporcional, 1);

  return (
    <div className="space-y-5" data-lab="controle">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-papel`}>
          <span className="rotulo text-mineral">{tx("Companhia", "Company")}</span>
          <select
            id={`${id}-papel`}
            value={c.papel}
            onChange={(e) => {
              setPapel(e.target.value);
              const nova = companhias.find((x) => x.papel === e.target.value);
              setNivel(Math.max(0, ...(nova?.porNivel.map((x) => x.nivel) ?? [0])));
            }}
            className="min-h-[44px] border border-linha bg-superficie px-3 text-sm text-carvao"
          >
            {companhias.map((x) => (
              <option key={x.papel} value={x.papel}>
                {x.papel} · {x.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm" htmlFor={`${id}-nivel`}>
          <span className="rotulo text-mineral">
            {tx("Degraus de controle abaixo da companhia", "Control steps below the company")}: {nivelUsado}
          </span>
          <input
            id={`${id}-nivel`}
            type="range"
            min={0}
            max={maxNivel}
            step={1}
            value={nivelUsado}
            onChange={(e) => setNivel(Number(e.target.value))}
            className="min-h-[44px] w-full accent-energia"
            aria-valuetext={tx(`${nivelUsado} degraus: ${n(mwAte)} MW em ${n(usinasAte)} usinas`, `${nivelUsado} ${nivelUsado === 1 ? "step" : "steps"}: ${n(mwAte)} MW in ${n(usinasAte)} ${usinasAte === 1 ? "plant" : "plants"}`)}
          />
        </label>
      </div>

      <figure className="space-y-2">
        <figcaption className="text-sm text-carvao">
          {tx(
            <>
              Usinas em operação cujo dono majoritário está a até {nivelUsado} {nivelUsado === 1 ? "degrau" : "degraus"} da {c.nome}:{" "}
              <strong className="font-medium tabular-nums">{n(mwAte)} MW</strong> em {n(usinasAte)} usinas, de {n(c.mwControle)} MW sob controle no total.
            </>,
            <>
              Plants in operation whose majority owner is up to {nivelUsado} {nivelUsado === 1 ? "step" : "steps"} from <Nome>{c.nome}</Nome>:{" "}
              <strong className="font-medium tabular-nums">{n(mwAte)} MW</strong> in {n(usinasAte)} {usinasAte === 1 ? "plant" : "plants"}, out of {n(c.mwControle)} MW under
              control in total.
            </>,
          )}
        </figcaption>
        <ol className="space-y-1.5" aria-label={tx("Potência sob controle por degrau", "Capacity under control by step")}>
          {c.porNivel.map((x) => (
            <li key={x.nivel} className="grid grid-cols-[7.5rem_1fr_6.5rem] items-center gap-3 text-xs">
              <span className="text-carvao-muted">
                {x.nivel === 0
                  ? tx("A própria companhia", "The company itself")
                  : tx(`${x.nivel} ${x.nivel === 1 ? "degrau" : "degraus"} abaixo`, `${x.nivel} ${x.nivel === 1 ? "step" : "steps"} below`)}
              </span>
              <span className="relative h-4 bg-energia-fundo" aria-hidden="true">
                <span
                  className={`absolute inset-y-0 left-0 ${x.nivel <= nivelUsado ? "bg-energia" : "bg-energia-soft opacity-40"}`}
                  style={{ width: `${Math.max(0.5, (100 * x.mw) / escala)}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-carvao">
                {n(x.mw)} MW · {n(x.usinas)}
              </span>
            </li>
          ))}
        </ol>
      </figure>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          {
            rotulo: tx("Sob controle", "Under control"),
            v: c.mwControle,
            texto: tx("A usina inteira, quando uma empresa sob controle tem mais de 50% dela. Mede comando.", "The whole plant, when a company under control holds more than 50% of it. It measures command."),
          },
          {
            rotulo: tx("Proporcional", "Proportional"),
            v: c.mwProporcional,
            texto: tx(
              "A fatia que as empresas sob controle detêm diretamente, inclusive em usinas em que são minoritárias. Mede propriedade direta.",
              "The share that the companies under control hold directly, including in plants where they are minority holders. It measures direct ownership.",
            ),
          },
        ].map((m) => (
          <div key={m.rotulo} className="border-l-2 border-linha pl-3">
            <p className="rotulo text-mineral">{m.rotulo}</p>
            <p className="tabular-nums text-carvao">{n(m.v)} MW</p>
            <span className="mt-1 block h-2 bg-energia-fundo" aria-hidden="true">
              <span className="block h-2 bg-carvao-muted" style={{ width: `${(100 * m.v) / escala}%` }} />
            </span>
            <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{m.texto}</p>
          </div>
        ))}
      </div>
      {c.cruzadas.length > 0 && (
        <ul className="space-y-1 border-l-2 border-linha pl-3 text-sm leading-relaxed text-carvao-muted">
          {c.cruzadas.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
