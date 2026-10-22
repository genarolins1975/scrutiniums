"use client";

import Link from "next/link";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { useState } from "react";
import { NumeroEscala } from "@/components/observatorios/NumeroEscala";
import type { Cadeia } from "@/lib/observatorios/entradas/energia";

/**
 * Modelo didático "da origem à sua casa": luz, gás e água e esgoto, cada um
 * em quatro elos, da origem ao consumidor, com um número publicado por elo.
 * A ordem descreve o caminho do serviço; os números têm unidades e períodos
 * diferentes e não formam uma conta.
 */
export function CadeiasInfra({ cadeias }: Readonly<{ cadeias: Cadeia[] }>) {
  const [atual, setAtual] = useState(cadeias[0]?.id);
  const mover = (delta: number) => {
    const i = cadeias.findIndex((c) => c.id === atual);
    const prox = cadeias[(i + delta + cadeias.length) % cadeias.length];
    setAtual(prox.id);
    document.getElementById(`aba-cadeia-${prox.id}`)?.focus();
  };
  return (
    <ModeloDidatico id="cadeias" titulo={<>Da origem à sua casa</>} descricao={<>Luz, gás e água chegam por cadeias diferentes, cada uma com quem produz, quem transporta, quem entrega e quem regula. Os quatro elos vão da origem ao consumidor, com um número publicado em cada um. Os números têm unidades e períodos próprios: não se somam nem se comparam entre os elos.</>} deixaDeFora={["Preço e qualidade de cada serviço, que o modelo não avalia", "Soma ou comparação entre os elos: cada número tem unidade e período próprios", "Mobilidade, que ainda não tem cadeia descrita aqui", "A internet de cada município, que está no painel Conectividade"]}>

        <div role="tablist" aria-label="Serviço" className="mt-8 flex flex-wrap gap-2">
          {cadeias.map((c) => (
            <button
              key={c.id}
              id={`aba-cadeia-${c.id}`}
              type="button"
              role="tab"
              aria-selected={atual === c.id}
              aria-controls={`painel-cadeia-${c.id}`}
              tabIndex={atual === c.id ? 0 : -1}
              onClick={() => setAtual(c.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") mover(1);
                if (e.key === "ArrowLeft") mover(-1);
              }}
              className={`min-h-[44px] border px-4 text-sm ${atual === c.id ? "border-carvao bg-carvao text-marfim" : "border-linha bg-superficie text-carvao hover:border-carvao"}`}
            >
              {c.titulo}
            </button>
          ))}
        </div>

        {cadeias.map((c) => (
          <div key={c.id} id={`painel-cadeia-${c.id}`} role="tabpanel" aria-labelledby={`aba-cadeia-${c.id}`} hidden={atual !== c.id} className="mt-6">
            <h3 className="font-serif text-xl leading-snug text-carvao">{c.pergunta}</h3>
            <ol className="mt-5 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-4">
              {c.elos.map((e, i) => (
                <li key={e.titulo} className="flex flex-col bg-papel p-5">
                  <p className="rotulo flex items-baseline gap-2 text-mineral">
                    <span className="tabular-nums text-carvao">{String(i + 1).padStart(2, "0")}</span>
                    {e.titulo}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{e.texto}</p>
                  {e.numero && (
                    <div className="mt-auto pt-4">
                      <div className="border-t border-linha pt-3">
                        <span className="block text-xs leading-snug text-carvao-muted">{e.numero.rotulo}</span>
                        <span className="mt-1 block"><NumeroEscala n={e.numero} /></span>
                        {e.numero.nota && <span className="mt-1 block text-xs leading-relaxed text-mineral">{e.numero.nota}</span>}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <ul className="mt-4 flex flex-wrap gap-x-6 text-sm">
              {c.paineis.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} prefetch={false} className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">{p.titulo}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-6 text-xs leading-relaxed text-mineral">
          Descreve o caminho de cada serviço, não avalia preço nem qualidade. Mobilidade ainda não tem
          cadeia descrita aqui; a conectividade está no painel Conectividade, com a internet de cada município.
        </p>
      </ModeloDidatico>
  );
}

/** Método e fontes da entrada de Energia e Infraestrutura. */
export function MetodoEnergia() {
  return (
    <>
      <p>
        Luz: geração verificada e armazenamento do ONS, tarifas homologadas pela ANEEL (mediana das distribuidoras, sem
        tributos) e Tarifa Social do sistema de subvenções da ANEEL. Gás: produção, aproveitamento e preços levantados pela
        ANP; importação pela ANP e pelo Comex Stat. Água e esgoto: Censo Demográfico 2022 do IBGE e SINISA do Ministério das
        Cidades, declarado por prestadores e municípios.
      </p>
      <p>
        Os números são lidos das mesmas bases dos painéis na publicação do site; quando uma base não pode ser lida, o número
        aparece como indisponível, nunca como zero.
      </p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        <li><Link href="/setor-eletrico/metodologia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Setor Elétrico: método</Link></li>
        <li><Link href="/gas-natural/metodologia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Gás Natural: método</Link></li>
        <li><Link href="/saneamento/metodologia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Saneamento: método</Link></li>
        <li><Link href="/perguntas/energia-e-infraestrutura" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Resumo aberto do observatório</Link></li>
      </ul>
    </>
  );
}
