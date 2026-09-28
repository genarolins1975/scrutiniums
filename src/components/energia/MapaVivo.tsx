"use client";

import Link from "next/link";
import type { Submercado } from "@/lib/energia/tipos";
import { IconeSetor, type TipoIcone } from "@/components/energia/IconeSetor";
import { MapaBrasil, type FluxoMapa, type TomMapa, type ValorRegiao } from "@/components/energia/MapaBrasil";
import { umDe, useEstadoUrl } from "@/lib/energia/useEstadoUrl";

/**
 * Mapa vivo: o mesmo mapa se transforma ao alternar a camada (Preço, Água,
 * Geração, Carga, Rede). Cada camada traz os valores por região, a legenda do
 * que a intensidade significa, a data de referência e, ao clicar numa região,
 * o detalhe com o caminho para o módulo. A camada fica na URL (?camada=).
 */
export type CamadaMapa = {
  id: string;
  rotulo: string;
  icone: TipoIcone;
  tom: TomMapa;
  titulo: string;
  valores: Partial<Record<Submercado, ValorRegiao>>;
  fluxos?: FluxoMapa[];
  legenda: string;
  referencia: string;
  href: string;
  hrefRotulo: string;
  detalhes: Partial<Record<Submercado, string[]>>;
};

export function MapaVivo({ camadas, chaveUrl = "camada" }: { camadas: CamadaMapa[]; chaveUrl?: string }) {
  const ids = camadas.map((c) => c.id);
  const [id, setId] = useEstadoUrl<string>(chaveUrl, ids[0], umDe(ids));
  const c = camadas.find((x) => x.id === id) ?? camadas[0];
  return (
    <div>
      <div role="tablist" aria-label="Camada do mapa" className="flex flex-wrap gap-1 border-b border-linha">
        {camadas.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === c.id}
            onClick={() => setId(x.id)}
            className={`rotulo inline-flex min-h-[44px] items-center gap-2 border-b-2 px-3 ${x.id === c.id ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"}`}
          >
            <IconeSetor tipo={x.icone} tamanho={15} className={x.id === c.id ? "text-energia-dark" : "text-mineral"} />
            {x.rotulo}
          </button>
        ))}
      </div>
      <div className="mt-4" role="tabpanel" aria-label={c.titulo}>
        <p className="font-serif text-lg leading-snug text-carvao md:text-xl">{c.titulo}</p>
        <p className="mt-1 text-xs text-mineral">{c.referencia}</p>
        <div className="mt-3">
          <MapaBrasil
            titulo={c.titulo}
            valores={c.valores}
            tom={c.tom}
            fluxos={c.fluxos}
            legenda={c.legenda}
            detalhes={Object.fromEntries(
              (Object.keys(c.detalhes) as Submercado[]).map((sm) => [
                sm,
                <div key={sm}>
                  <ul className="space-y-1">
                    {(c.detalhes[sm] ?? ["Sem detalhe nesta publicação."]).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                  <Link href={c.href} className="mt-2 inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                    {c.hrefRotulo} <span aria-hidden="true" className="ml-1">→</span>
                  </Link>
                </div>,
              ]),
            )}
          />
        </div>
      </div>
    </div>
  );
}
