"use client";

import { useEffect, useMemo, useState } from "react";
import { MapaCoropletico, type CamadaGeo } from "@/components/energia/MapaCoropletico";
import { AlternarVista } from "@/components/territorio/AlternarVista";
import { carregarFocosMunicipios } from "@/components/territorio/FocosNoMunicipio";
import { quebrasFixas, type ValorClassificavel } from "@/lib/energia/escalas";
import { URL_GEO, validaCamada } from "@/lib/energia/geo";
import { CORTES_FOCOS_AREA } from "@/lib/territorio/queimadasMunicipios";

/** Paleta sequencial neutra da plataforma (um só matiz, do claro ao escuro): mais escuro é mais focos por área, sem juízo de valor. */
const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
const UNIDADE = "focos por 1.000 km²";

export type UfFocosArea = { codigo: string; sigla: string; nome: string; focos: number; areaKm2: number };

const fmt = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Focos de calor por 1.000 km² no último ano completo, na malha oficial do IBGE (a mesma do Setor Elétrico, via MapaCoropletico):
 * por estado, com valores montados no servidor (focos da UF sobre a área somada dos seus municípios no Censo 2022), ou por
 * município, sob pedido. A malha municipal (1,3 MB) e a gold municipal (a mesma que a busca de município baixa) só vêm quando o
 * leitor escolhe "Municípios". Município sem área oficial nesta referência é sem dado (hachura), nunca zero; município sem foco
 * detectado é zero, e zero focos não prova ausência de fogo.
 */
export function MapaFocosArea({ ano, ufs, semCobertura }: Readonly<{ ano: number; ufs: readonly UfFocosArea[]; semCobertura: readonly string[] }>) {
  return (
    <AlternarVista
      legenda="Ver por"
      opcoes={[
        { id: "uf", rotulo: "Estados" },
        { id: "municipio", rotulo: "Municípios" },
      ]}
      vistas={[<MapaUfs key="uf" ano={ano} ufs={ufs} />, <MapaMunicipios key="municipio" ano={ano} semCobertura={semCobertura} />]}
    />
  );
}

function MapaUfs({ ano, ufs }: Readonly<{ ano: number; ufs: readonly UfFocosArea[] }>) {
  const { valores, porCodigo } = useMemo(() => {
    const v: Record<string, ValorClassificavel> = {};
    const p = new Map<string, UfFocosArea>();
    for (const u of ufs) {
      v[u.codigo] = (1000 * u.focos) / u.areaKm2;
      p.set(u.codigo, u);
    }
    return { valores: v, porCodigo: p };
  }, [ufs]);
  const classificacao = useMemo(() => quebrasFixas(CORTES_FOCOS_AREA, Object.values(valores), { casas: 0 }), [valores]);
  return (
    <MapaCoropletico
      semTabela
      titulo={`Focos de calor por 1.000 km², por estado, ${ano}`}
      fonteGeometria={URL_GEO.uf}
      valores={valores}
      cores={CORES}
      classificacao={classificacao}
      unidade={UNIDADE}
      casas={1}
      rotuloRegiao={{ singular: "estado", plural: "estados" }}
      rotulos
      periodo={String(ano)}
      altura={460}
      alturaCelular={340}
      detalheRegiao={(id) => {
        const u = porCodigo.get(id);
        return u ? `${fmt(u.focos)} focos em ${fmt(u.areaKm2)} km²` : null;
      }}
    />
  );
}

type CargaMun =
  | { estado: "carregando" }
  | { estado: "erro"; erro: string }
  | { estado: "pronto"; geo: CamadaGeo; valores: Record<string, ValorClassificavel>; detalhe: Map<string, string> };

let promessaMalha: Promise<CamadaGeo> | null = null;
function carregarMalhaMunicipal(): Promise<CamadaGeo> {
  promessaMalha ??= fetch(URL_GEO.municipios)
    .then(async (r) => {
      if (!r.ok) throw new Error(`resposta ${r.status}`);
      const j: unknown = await r.json();
      const erros = validaCamada(j);
      if (erros.length) throw new Error(erros.slice(0, 3).join("; "));
      return j as CamadaGeo;
    })
    .catch((e: unknown) => {
      promessaMalha = null;
      throw e;
    });
  return promessaMalha;
}

function MapaMunicipios({ ano, semCobertura }: Readonly<{ ano: number; semCobertura: readonly string[] }>) {
  const [carga, setCarga] = useState<CargaMun>({ estado: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCarga({ estado: "carregando" });
    Promise.all([carregarMalhaMunicipal(), carregarFocosMunicipios()]).then(
      ([geo, focos]) => {
        if (!vivo) return;
        const porId = new Map(focos.lista.map((m) => [m.id, m]));
        const sem = new Set(semCobertura);
        const valores: Record<string, ValorClassificavel> = {};
        const detalhe = new Map<string, string>();
        for (const f of geo.features) {
          const m = porId.get(f.id);
          if (sem.has(f.id)) {
            valores[f.id] = null;
            detalhe.set(f.id, "instalado depois do Censo 2022, sem área oficial nesta referência");
          } else if (m) {
            valores[f.id] = m.porMilKm2;
            detalhe.set(f.id, `${fmt(m.focos.ultimoAnoCompleto ?? 0)} focos em ${fmt(m.areaKm2)} km²`);
          } else {
            // fora da gold: nenhum foco detectado pelo satélite de referência no ano (zero é valor, não prova ausência de fogo)
            valores[f.id] = 0;
            detalhe.set(f.id, "nenhum foco detectado pelo satélite de referência");
          }
        }
        setCarga({ estado: "pronto", geo, valores, detalhe });
      },
      (e: unknown) => vivo && setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [semCobertura, tentativa]);
  const classificacao = useMemo(
    () => (carga.estado === "pronto" ? quebrasFixas(CORTES_FOCOS_AREA, Object.values(carga.valores), { casas: 0 }) : undefined),
    [carga],
  );

  if (carga.estado !== "pronto" || !classificacao) {
    return (
      <div className="flex h-[340px] items-center justify-center border border-linha bg-superficie px-6 text-center text-sm sm:h-[560px]" data-estado={carga.estado}>
        {carga.estado === "erro" ? (
          <p role="alert" className="text-carvao">
            Não foi possível carregar o mapa municipal ({carga.erro}). Os estados e as listas de municípios continuam nesta página.{" "}
            <button type="button" onClick={() => setTentativa((t) => t + 1)} className="min-h-[44px] underline decoration-linha underline-offset-4">
              Tentar de novo
            </button>
          </p>
        ) : (
          <p role="status" className="text-carvao-muted">
            Carregando a malha dos 5.571 municípios do IBGE e os focos de {ano}.
          </p>
        )}
      </div>
    );
  }
  return (
    <MapaCoropletico
      semTabela
      titulo={`Focos de calor por 1.000 km², por município, ${ano}`}
      geometria={carga.geo}
      valores={carga.valores}
      cores={CORES}
      classificacao={classificacao}
      unidade={UNIDADE}
      casas={1}
      rotuloRegiao={{ singular: "município", plural: "municípios" }}
      contornos
      periodo={String(ano)}
      altura={560}
      alturaCelular={380}
      detalheRegiao={(id) => carga.detalhe.get(id) ?? null}
    />
  );
}
