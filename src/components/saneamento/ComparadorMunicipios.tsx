"use client";

import Link from "next/link";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { baixarCsv } from "@/lib/saneamento/csv";
import { FONTE_ROTULO, MEDIDAS_GERAIS, formatarValor } from "@/lib/saneamento/medidas";
import { inteiro } from "@/lib/saneamento/formato";
import type { Municipio } from "@/lib/saneamento/tipos";
import { BuscaMunicipio } from "./BuscaMunicipio";
import { useMunicipios } from "./useMunicipios";

/**
 * Até quatro municípios lado a lado, com as medidas do catálogo (cada uma com
 * sua fonte e seu período) e o arranjo institucional declarado. Estado na URL
 * (?m=codigo1,codigo2): o link reproduz a comparação.
 */
const MAX = 4;
const ESQUEMA = { m: campo(tiposUrl.lista(tiposUrl.texto({ max: 7 }), { max: MAX }), [] as string[]) };

type LinhaTexto = { rotulo: string; fonte: string; valor: (m: Municipio) => string | number | null; formato?: "inteiro" };

const ARRANJO: LinhaTexto[] = [
  { rotulo: "Moradores (Censo 2022)", fonte: "IBGE, Censo 2022", valor: (m) => m.pop22, formato: "inteiro" },
  { rotulo: "População estimada 2024", fonte: "IBGE, estimativa 2024", valor: (m) => m.pop24, formato: "inteiro" },
  { rotulo: "Natureza do prestador de água", fonte: "SINISA 2024", valor: (m) => m.nat_ag },
  { rotulo: "Natureza do prestador de esgoto", fonte: "SINISA 2024", valor: (m) => m.nat_es },
  { rotulo: "Regulador declarado para água", fonte: "SINISA 2024, Gestão Municipal", valor: (m) => m.reg_ag },
  { rotulo: "Plano municipal de saneamento", fonte: "SINISA 2024, Gestão Municipal", valor: (m) => (m.plano ? `${m.plano}${m.plano_ano ? ` (${m.plano_ano})` : ""}` : null) },
];

function texto(l: LinhaTexto, m: Municipio): string {
  const v = l.valor(m);
  if (v == null || v === "") return "sem dado";
  return l.formato === "inteiro" && typeof v === "number" ? inteiro(v) : String(v);
}

export function ComparadorMunicipios({ sugestoes }: { sugestoes: { ids: string; rotulo: string }[] }) {
  const [s, set] = useEstadoUrl(ESQUEMA);
  const carga = useMunicipios();
  const porId = new Map((carga.estado === "pronto" ? carga.lista : []).map((m) => [m.id, m]));
  const escolhidos = s.m.map((id) => porId.get(id)).filter((m): m is Municipio => !!m);

  const adicionar = (id: string) => {
    if (s.m.includes(id) || s.m.length >= MAX) return;
    set({ m: [...s.m, id] });
  };
  const remover = (id: string) => set({ m: s.m.filter((x) => x !== id) });

  const exportar = () =>
    baixarCsv(
      "saneamento-comparacao-municipios.csv",
      ["medida", "fonte", "periodo", "unidade", ...escolhidos.map((m) => `${m.nome} (${m.uf}) ${m.id}`)],
      [
        ...MEDIDAS_GERAIS.map((med) => [med.titulo, FONTE_ROTULO[med.fonte], med.periodo, med.unidadePct, ...escolhidos.map((m) => med.pct(m))]),
        ...ARRANJO.map((l) => [l.rotulo, l.fonte, "", "", ...escolhidos.map((m) => l.valor(m))]),
      ],
    );

  return (
    <div>
      <div className="border border-linha bg-superficie p-4">
        {s.m.length < MAX ? (
          <BuscaMunicipio rotulo={`Adicionar município (${escolhidos.length} de ${MAX})`} aoEscolher={(it) => adicionar(it[0])} />
        ) : (
          <p className="text-sm text-carvao-muted">Limite de {MAX} municípios. Remova um para trocar.</p>
        )}
        {s.m.length === 0 && (
          <div className="mt-3 text-sm text-carvao-muted">
            <p>Ou comece por um grupo sugerido:</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {sugestoes.map((g) => (
                <li key={g.ids}>
                  <button
                    type="button"
                    onClick={() => set({ m: g.ids.split(",") })}
                    className="inline-flex min-h-[44px] items-center border border-obee px-3 text-sm text-obee-dark hover:bg-obee-fundo"
                  >
                    {g.rotulo}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {escolhidos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Municípios escolhidos">
            {escolhidos.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => remover(m.id)}
                  className="inline-flex min-h-[44px] items-center gap-2 border border-carvao px-3 text-sm text-carvao hover:bg-obee-fundo"
                  aria-label={`Remover ${m.nome}`}
                >
                  {m.nome} ({m.uf}) <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {carga.estado === "erro" && (
        <div className="mt-6 border border-dashed border-linha p-5 text-sm text-carvao-muted">
          <p className="font-medium text-carvao">Não foi possível carregar a tabela municipal ({carga.erro}).</p>
          <button type="button" onClick={carga.tentar} className="mt-3 inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm">
            Tentar de novo
          </button>
        </div>
      )}
      {carga.estado === "carregando" && s.m.length > 0 && (
        <p className="mt-6 text-sm text-carvao-muted" aria-live="polite">
          Carregando dados municipais.
        </p>
      )}

      {escolhidos.length > 0 && (
        <>
          <div className="tabela-scroll mt-6" tabIndex={0} role="region" aria-label="Comparação de municípios (rolável)">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">Medidas dos municípios escolhidos, com fonte e período</caption>
              <thead>
                <tr className="border-b border-carvao align-bottom">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Medida</th>
                  {escolhidos.map((m) => (
                    <th key={m.id} scope="col" className="py-2 pr-4 text-right font-medium">
                      <Link href={`/saneamento/municipio/${m.id}`} className="underline underline-offset-2">
                        {m.nome}
                      </Link>
                      <span className="block text-xs font-normal text-carvao-muted">{m.uf}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MEDIDAS_GERAIS.map((med) => (
                  <tr key={med.id} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                      {med.titulo}
                      <span className="block text-xs text-carvao-muted">
                        {FONTE_ROTULO[med.fonte]}, {med.periodo}
                      </span>
                    </th>
                    {escolhidos.map((m) => {
                      const v = med.pct(m);
                      return (
                        <td key={m.id} className={`py-2 pr-4 text-right tabular-nums ${v == null ? "text-carvao-muted" : "text-carvao"}`}>
                          {formatarValor(med, v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {ARRANJO.map((l) => (
                  <tr key={l.rotulo} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">
                      {l.rotulo}
                      <span className="block text-xs text-carvao-muted">{l.fonte}</span>
                    </th>
                    {escolhidos.map((m) => (
                      <td key={m.id} className={`py-2 pr-4 text-right ${l.valor(m) == null ? "text-carvao-muted" : "text-carvao"}`}>
                        {texto(l, m)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="button" onClick={exportar} className="inline-flex min-h-[44px] items-center border border-obee px-4 text-sm font-medium text-obee-dark hover:bg-obee-fundo">
              Baixar CSV da comparação
            </button>
            <p className="text-xs text-carvao-muted">O endereço da página guarda os municípios escolhidos; copie o link para compartilhar.</p>
          </div>
        </>
      )}
    </div>
  );
}
