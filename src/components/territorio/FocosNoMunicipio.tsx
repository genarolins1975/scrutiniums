"use client";

import { useState } from "react";
import { BuscaMunicipio } from "@/components/saneamento/BuscaMunicipio";
import type { ItemIndice } from "@/lib/saneamento/municipios";
import { municipiosDeFocos, URL_QUEIMADAS_MUNICIPIOS, type FocosMunicipio, type GoldQueimadasMunicipios } from "@/lib/territorio/queimadasMunicipios";

/**
 * Busca do município com o retrato do fogo nele: focos do último ano completo, posição no
 * país, densidade por área e o ano em curso contra os mesmos meses do ano anterior. A
 * gold municipal é baixada só quando alguém escolhe um município. Município fora da gold
 * não teve foco detectado pelo satélite de referência nos períodos disponíveis.
 */
type Carga = { lista: FocosMunicipio[]; posicao: Map<string, number>; comFoco: number; g: GoldQueimadasMunicipios };

let promessa: Promise<Carga> | null = null;
function carregar(): Promise<Carga> {
  promessa ??= fetch(URL_QUEIMADAS_MUNICIPIOS)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<GoldQueimadasMunicipios>;
    })
    .then((g) => {
      const lista = municipiosDeFocos(g);
      const ordenada = lista.filter((m) => (m.focos.ultimoAnoCompleto ?? 0) > 0);
      // a gold já vem ordenada pelo último ano completo; empates dividem a mesma posição
      const posicao = new Map<string, number>();
      ordenada.forEach((m, i) => {
        const anterior = ordenada[i - 1];
        posicao.set(m.id, anterior && anterior.focos.ultimoAnoCompleto === m.focos.ultimoAnoCompleto ? posicao.get(anterior.id)! : i + 1);
      });
      return { lista, posicao, comFoco: ordenada.length, g };
    })
    .catch((e: unknown) => {
      promessa = null;
      throw e;
    });
  return promessa;
}

const fmt = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;

export function FocosNoMunicipio({ ano }: Readonly<{ ano: number }>) {
  const [escolhido, setEscolhido] = useState<ItemIndice | null>(null);
  const [carga, setCarga] = useState<Carga | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const escolher = (it: ItemIndice) => {
    setEscolhido(it);
    setErro(null);
    carregar().then(setCarga, (e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  };

  return (
    <div className="border border-linha bg-papel p-5 md:p-6">
      <BuscaMunicipio rotulo="Quantos focos de calor houve no meu município?" aoEscolher={escolher} />
      <div aria-live="polite" className="mt-5">
        {escolhido && erro && (
          <p className="text-sm text-carvao">
            Não foi possível carregar os dados municipais ({erro}).{" "}
            <button type="button" onClick={() => escolher(escolhido)} className="min-h-[44px] underline decoration-linha underline-offset-4">Tentar de novo</button>
          </p>
        )}
        {escolhido && !erro && !carga && <p className="text-sm text-carvao-muted">Carregando os dados de {escolhido[1]}…</p>}
        {escolhido && carga && <Retrato it={escolhido} carga={carga} ano={ano} />}
      </div>
    </div>
  );
}

function Retrato({ it, carga, ano }: Readonly<{ it: ItemIndice; carga: Carga; ano: number }>) {
  const m = carga.lista.find((x) => x.id === it[0]);
  const { periodos } = carga.g;
  const acum = periodos.acumuladoAnoCorrente;
  const mesmo = periodos.mesmoPeriodoAnoAnterior;
  const titulo = `${it[1]} (${it[2]})`;
  if (!m && carga.g.semCoberturaNaFonte.ids.includes(it[0])) {
    return (
      <div>
        <p className="font-serif text-xl text-carvao">{titulo}</p>
        <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao">Indisponível. {carga.g.semCoberturaNaFonte.motivo}</p>
      </div>
    );
  }
  if (!m && !periodos.ultimoAnoCompleto) {
    return <p className="text-sm text-carvao">{titulo}: a contagem por município de {ano} está indisponível nesta publicação.</p>;
  }
  if (!m) {
    return (
      <div>
        <p className="font-serif text-xl text-carvao">{titulo}</p>
        <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao">
          Nenhum foco de calor detectado pelo satélite de referência em {ano}
          {acum ? ` nem de ${mesAno(acum.periodo.inicio)} a ${mesAno(acum.periodo.fim)}` : ""}. Isso não quer dizer que não houve fogo: queimadas pequenas,
          rasteiras ou sob nuvem não aparecem para o satélite.
        </p>
      </div>
    );
  }
  const f = m.focos;
  const pos = carga.posicao.get(m.id);
  return (
    <div>
      <p className="font-serif text-xl text-carvao">{titulo}</p>
      <dl className="mt-4 grid gap-px border border-linha bg-linha sm:grid-cols-3">
        <div className="bg-marfim p-4">
          <dt className="text-sm text-carvao-muted">Focos em {ano}</dt>
          <dd className="mt-1 font-label text-[1.6rem] leading-none tabular-nums text-carvao">{fmt(f.ultimoAnoCompleto ?? 0)}</dd>
          <dd className="mt-2 text-xs text-mineral">
            {pos ? `${fmt(pos)}º entre ${fmt(carga.comFoco)} municípios com foco` : "Nenhum foco no ano"}
          </dd>
        </div>
        <div className="bg-marfim p-4">
          <dt className="text-sm text-carvao-muted">Por 1.000 km² em {ano}</dt>
          <dd className="mt-1 font-label text-[1.6rem] leading-none tabular-nums text-carvao">{m.porMilKm2 == null ? "Indisponível" : fmt(m.porMilKm2, 1)}</dd>
          <dd className="mt-2 text-xs text-mineral">Área de {fmt(m.areaKm2, 0)} km² (Censo 2022)</dd>
        </div>
        <div className="bg-marfim p-4">
          <dt className="text-sm text-carvao-muted">{acum ? `${mesAno(acum.periodo.inicio)} a ${mesAno(acum.periodo.fim)}` : "Ano em curso"}</dt>
          <dd className="mt-1 font-label text-[1.6rem] leading-none tabular-nums text-carvao">{f.acumuladoAnoCorrente == null ? "Indisponível" : fmt(f.acumuladoAnoCorrente)}</dd>
          <dd className="mt-2 text-xs text-mineral">
            {f.acumuladoAnoCorrente == null || f.mesmoPeriodoAnoAnterior == null || !mesmo
              ? "Comparação indisponível"
              : `${fmt(f.mesmoPeriodoAnoAnterior)} nos mesmos meses de ${mesmo.periodo.inicio.slice(0, 4)}`}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-mineral">
        Satélite de referência {carga.g.sateliteReferencia}, contagem de focos (não é área queimada). O ano em curso é preliminar.
      </p>
    </div>
  );
}
