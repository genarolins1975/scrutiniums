"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Histograma } from "@/components/energia/Histograma";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { URL_GEO } from "@/lib/energia/geo";
import { NAO_SE_APLICA, quebrasFixas, type ValorClassificavel } from "@/lib/energia/escalas";
import { montaHistograma, percentilDe } from "@/lib/energia/distribuicao";
import { FONTE_ROTULO, MEDIDAS, agregarMedida, formatarValor, valorMedida, type Medida, type Variante } from "@/lib/saneamento/medidas";
import type { MapaReferencias } from "@/lib/saneamento/referencias";
import { ROTA } from "@/lib/saneamento/capitulos";
import type { Municipio } from "@/lib/saneamento/tipos";
import { classePorte, ROTULO_PORTE, mediana } from "@/lib/saneamento/pares";
import { baixarCsv } from "@/lib/saneamento/csv";
import { inteiro } from "@/lib/saneamento/formato";
import { useMunicipios } from "./useMunicipios";

const CORES_SEQ = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
const CORES_DIV = ["var(--san-div-neg-2)", "var(--san-div-neg-1)", "var(--san-div-centro)", "var(--san-div-pos-1)", "var(--san-div-pos-2)"];
const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"] as const;
const LIMIAR_PROPORCAO = 10_000;

const controle = "mt-1 min-h-[44px] w-full min-w-0 border border-mineral bg-superficie px-3 py-2 text-sm text-carvao";

export function AtlasMunicipal({
  ids,
  referencias,
  nomesUf,
  titulo,
}: {
  ids: string[];
  referencias: MapaReferencias;
  nomesUf: Record<string, string>;
  titulo: string;
}) {
  const medidas = useMemo(() => MEDIDAS.filter((m) => ids.includes(m.id)), [ids]);
  const esquema = useMemo(
    () => ({
      medida: campo(tiposUrl.opcao(medidas.map((m) => m.id)), medidas[0].id),
      unidade: campo(tiposUrl.opcao(["pct", "pessoas"] as const), "pct"),
      uf: campo(tiposUrl.opcao(["BR", ...UFS] as const), "BR"),
      m: campo(tiposUrl.texto({ max: 7 }), "", { historico: "replace" }),
    }),
    [medidas],
  );
  const [s, set] = useEstadoUrl(esquema);
  const med = medidas.find((x) => x.id === s.medida) ?? medidas[0];
  const variante: Variante = s.unidade === "pessoas" && med.contagem ? "pessoas" : "pct";
  const carga = useMunicipios();

  const lista = useMemo(() => (carga.estado === "pronto" ? carga.lista : []), [carga]);
  const doRecorte = useMemo(() => (s.uf === "BR" ? lista : lista.filter((m) => m.uf === s.uf)), [lista, s.uf]);
  const valores = useMemo(() => {
    const out: Record<string, ValorClassificavel> = {};
    for (const m of lista) out[m.id] = s.uf !== "BR" && m.uf !== s.uf ? NAO_SE_APLICA : valorMedida(med, m, variante);
    return out;
  }, [lista, med, variante, s.uf]);
  const unidade = variante === "pessoas" ? med.unidadeContagem ?? "" : med.unidadePct;
  const casas = variante === "pessoas" ? 0 : med.casas;
  const cortes = variante === "pessoas" ? med.cortesContagem ?? med.cortesPct : med.cortesPct;
  const classificacao = useMemo(
    () => quebrasFixas(cortes, Object.values(valores), { casas }),
    [cortes, valores, casas],
  );
  const selecionado = s.m && lista.some((m) => m.id === s.m) ? s.m : null;
  const sel = selecionado ? lista.find((m) => m.id === selecionado) ?? null : null;

  const ref = referencias[med.id];
  const refTerritorio = ref?.[s.uf] ?? null;
  const refBrasil = ref?.BR ?? null;
  const resumoRecorte = useMemo(() => agregarMedida(med, doRecorte), [med, doRecorte]);
  const comValor = doRecorte.filter((m) => valorMedida(med, m, "pct") != null).length;

  const rankingPessoas = useMemo(() => {
    if (!med.contagem) return [];
    return doRecorte
      .map((m) => ({ id: m.id, rotulo: `${m.nome} (${m.uf})`, v: med.contagem!(m), pct: med.pct(m) }))
      .filter((r) => r.v != null)
      .sort((a, b) => (b.v ?? 0) - (a.v ?? 0) || a.rotulo.localeCompare(b.rotulo, "pt-BR"))
      .slice(0, 15);
  }, [doRecorte, med]);
  const rankingPct = useMemo(
    () =>
      doRecorte
        .filter((m) => (m.pop22 ?? 0) >= LIMIAR_PROPORCAO)
        .map((m) => ({ id: m.id, rotulo: `${m.nome} (${m.uf})`, v: med.pct(m) }))
        .filter((r) => r.v != null)
        .sort((a, b) => (b.v ?? 0) - (a.v ?? 0) || a.rotulo.localeCompare(b.rotulo, "pt-BR"))
        .slice(0, 15),
    [doRecorte, med],
  );

  const pctRecorte = useMemo(() => doRecorte.map((m) => med.pct(m)), [doRecorte, med]);
  const histograma = useMemo(() => {
    const vs = pctRecorte.filter((v): v is number => v != null);
    if (vs.length < 5) return null;
    const lim = med.paleta === "divergente" ? divergentes(vs) : [...(med.limitesHistograma ?? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])];
    const max = Math.max(...vs);
    const teto = lim[lim.length - 1];
    // Medidas com limites próprios: a cauda acima do último limite fica fora das classes (contada, não descartada) para não esmagar a distribuição.
    if (med.limitesHistograma) return { dist: montaHistograma(vs, { limites: lim }), teto };
    if (med.paleta !== "divergente" && max > teto) lim.push(Math.ceil(max / 10) * 10);
    return { dist: montaHistograma(vs, { limites: lim }), teto: undefined };
  }, [pctRecorte, med]);

  const pares = useMemo(() => {
    if (!sel) return null;
    const porte = classePorte(sel.pop22);
    if (porte == null) return null;
    const grupo = lista.filter((m) => m.regiao === sel.regiao && classePorte(m.pop22) === porte && m.id !== sel.id);
    const vs = grupo.map((m) => med.pct(m)).filter((v): v is number => v != null);
    return { porte, n: vs.length, total: grupo.length, mediana: mediana(vs) };
  }, [sel, lista, med]);

  const exportar = () => {
    const cab = ["codigo_ibge", "municipio", "uf", "medida", "fonte", "periodo", "valor_percentual", "contagem", "universo", "unidade_percentual"];
    const linhas = doRecorte.map((m) => [m.id, m.nome, m.uf, med.titulo, FONTE_ROTULO[med.fonte], med.periodo, med.pct(m), med.contagem ? med.contagem(m) : null, med.universo, med.unidadePct]);
    baixarCsv(`saneamento-${med.id}-${s.uf}.csv`, cab, linhas);
  };

  const nomeRecorte = s.uf === "BR" ? "Brasil" : nomesUf[s.uf] ?? s.uf;
  const textoRef = (r: { pct: number | null; contagem: number | null } | null) =>
    r == null
      ? "sem dado"
      : `${formatarValor(med, r.pct)}${med.paleta !== "divergente" && med.unidadeContagem && r.contagem != null ? ` (${inteiro(r.contagem)} ${med.unidadeContagem})` : ""}`;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 border border-linha bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <label className="min-w-0 text-sm text-carvao">
          Medida
          <select aria-label="Medida" className={controle} value={med.id} onChange={(e) => set({ medida: e.target.value })}>
            {medidas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.titulo} · {m.fonte === "sinisa2024" ? "SINISA 2024" : m.fonte === "censo2022" ? "Censo 2022" : m.fonte === "nr8_sinisa2024" ? "NR 8 / SINISA 2024" : m.fonte === "sinisa_cadunico2024" ? "SINISA e CadÚnico 2024" : "Censos 2010 e 2022"}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="min-w-0 text-sm text-carvao">
          <legend>Mostrar</legend>
          <div className="mt-1 flex min-h-[44px] flex-wrap items-center gap-x-4 gap-y-1">
            <label className="inline-flex min-h-[44px] items-center gap-2">
              <input type="radio" name="atlas-unidade" checked={variante === "pct"} onChange={() => set({ unidade: "pct" })} />
              {med.paleta === "divergente" ? "Pontos percentuais" : med.unidadePct === "%" ? "Proporção" : med.unidadePct.charAt(0).toUpperCase() + med.unidadePct.slice(1)}
            </label>
            <label className={`inline-flex min-h-[44px] items-center gap-2 ${med.contagem ? "" : "text-carvao-muted"}`}>
              <input type="radio" name="atlas-unidade" checked={variante === "pessoas"} disabled={!med.contagem} onChange={() => set({ unidade: "pessoas" })} />
              {med.contagem && med.unidadeContagem && med.unidadeContagem !== "moradores" && med.unidadeContagem !== "pessoas"
                ? med.unidadeContagem.charAt(0).toUpperCase() + med.unidadeContagem.slice(1)
                : "Pessoas"}
            </label>
          </div>
          {!med.contagem && <p className="text-xs text-carvao-muted">Esta medida não tem contagem de pessoas.</p>}
        </fieldset>
        <label className="min-w-0 text-sm text-carvao">
          Território
          <select aria-label="Território" className={controle} value={s.uf} onChange={(e) => set({ uf: e.target.value as typeof s.uf, m: "" })}>
            <option value="BR">Brasil, todos os municípios</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {nomesUf[u] ?? u}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-2 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <p className="max-w-prose2 text-[0.95rem] leading-relaxed text-carvao">{med.pergunta}</p>
          <p className="mt-2 text-sm leading-relaxed text-carvao-muted">
            {nomeRecorte}: <strong className="font-medium text-carvao">{textoRef(refTerritorio)}</strong>
            {s.uf !== "BR" && <> · Brasil: {textoRef(refBrasil)}</>} · {FONTE_ROTULO[med.fonte]}, {med.periodo}. Universo: {med.universo.toLowerCase()}.
          </p>
          {carga.estado === "pronto" && (
            <p className="mt-1 text-xs text-carvao-muted">
              {inteiro(comValor)} de {inteiro(doRecorte.length)} municípios com valor no recorte. {med.ausencia}
            </p>
          )}
        </div>
      </div>

      {carga.estado === "erro" ? (
        <div className="mt-6 border border-dashed border-linha p-5 text-sm text-carvao-muted">
          <p className="font-medium text-carvao">Não foi possível carregar a tabela municipal ({carga.erro}).</p>
          <p className="mt-1">As referências acima vêm do servidor e continuam válidas.</p>
          <button type="button" onClick={carga.tentar} className="mt-3 inline-flex min-h-[44px] items-center border border-carvao px-4 text-sm">
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <MapaCoropletico
              titulo={`${med.titulo} (${med.periodo})`}
              fonteGeometria={URL_GEO.municipios}
              valores={carga.estado === "pronto" ? valores : {}}
              cores={med.paleta === "divergente" ? CORES_DIV : CORES_SEQ}
              classificacao={classificacao}
              unidade={unidade}
              casas={casas}
              rotuloRegiao={{ singular: "município", plural: "municípios" }}
              selecionado={selecionado}
              onSelecionar={(id) => set({ m: id ?? "" })}
              altura={560}
              alturaCelular={400}
              periodo={med.periodo}
              nota={`Classes fixas, iguais em todos os recortes. ${s.uf !== "BR" ? "Municípios de outras UFs aparecem em cinza (não se aplica ao recorte)." : ""}`}
            />
          </div>
          <aside aria-label="Município selecionado" className="min-w-0 border-t border-linha pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {sel ? (
              <PainelSelecao m={sel} med={med} refUf={ref?.[sel.uf] ?? null} refBr={refBrasil} pares={pares} nomeUf={nomesUf[sel.uf] ?? sel.uf} />
            ) : (
              <p className="text-sm leading-relaxed text-carvao-muted">
                Toque ou clique num município, ou use a busca do mapa, para ver o valor ao lado da UF, do Brasil e de municípios de porte
                semelhante na mesma região.
              </p>
            )}
          </aside>
        </div>
      )}

      {carga.estado === "pronto" && (
        <>
          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
            {med.contagem && rankingPessoas.length > 0 && (
              <GraficoBarras
                titulo={`Onde há mais ${med.unidadeContagem && med.unidadeContagem !== "moradores" ? med.unidadeContagem : "pessoas"}: ${med.titulo.toLowerCase()} (${nomeRecorte})`}
                dados={rankingPessoas.map((r) => ({ id: r.id, rotulo: r.rotulo, v: r.v }))}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[{ id: "v", rotulo: med.unidadeContagem ?? "pessoas", cor: "var(--cor-obee)" }]}
                unidade={med.unidadeContagem ?? ""}
                casas={0}
                orientacao="horizontal"
                rotulosValor
                selecionado={selecionado}
                onSelecionar={(id) => set({ m: id ?? "" })}
              />
            )}
            {rankingPct.length > 0 && (
              <GraficoBarras
                titulo={`Maiores ${med.paleta === "divergente" ? "variações" : med.unidadePct === "%" ? "proporções" : "valores"} entre municípios com ${inteiro(LIMIAR_PROPORCAO)} moradores ou mais (${nomeRecorte})`}
                dados={rankingPct.map((r) => ({ id: r.id, rotulo: r.rotulo, v: r.v }))}
                chaveCategoria="id"
                chaveRotulo="rotulo"
                series={[{ id: "v", rotulo: med.unidadePct, cor: "var(--escala-seq-4)" }]}
                unidade={med.unidadePct}
                casas={med.casas}
                orientacao="horizontal"
                rotulosValor
                selecionado={selecionado}
                onSelecionar={(id) => set({ m: id ?? "" })}
              />
            )}
          </div>
          <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
            Os dois rankings respondem a perguntas diferentes: onde está o maior número de pessoas e onde a proporção é maior. O corte de{" "}
            {inteiro(LIMIAR_PROPORCAO)} moradores evita que municípios muito pequenos ocupem a lista por poucas pessoas; a tabela do mapa traz
            todos.
          </p>

          {histograma && (
            <div className="mt-10">
              <Histograma
                titulo={`Distribuição dos municípios: ${med.titulo.toLowerCase()} (${nomeRecorte})`}
                dados={histograma.dist}
                tetoEixo={histograma.teto}
                rotuloX={med.titulo}
                unidade={med.unidadePct}
                casas={med.casas}
                contagem={{ singular: "município", plural: "municípios" }}
                periodo={med.periodo}
                valorAtual={
                  sel && med.pct(sel) != null
                    ? { valor: med.pct(sel), rotulo: `${sel.nome} (${sel.uf})`, percentil: percentilDe(med.pct(sel), pctRecorte) }
                    : undefined
                }
                nota="Cada município conta uma vez, qualquer que seja a população. A referência territorial acima soma pessoas, não percentuais."
              />
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button type="button" onClick={exportar} className="inline-flex min-h-[44px] items-center border border-obee px-4 text-sm font-medium text-obee-dark hover:bg-obee-fundo">
              Baixar CSV do recorte ({inteiro(doRecorte.length)} municípios)
            </button>
            <p className="text-xs text-carvao-muted">
              Recorte total: {resumoRecorte.municipios ? `${inteiro(resumoRecorte.municipios)} municípios somados` : "sem soma aplicável"}. Endereço da
              página guarda medida, unidade, território e município.
            </p>
          </div>
        </>
      )}
      <span className="sr-only" aria-live="polite">{carga.estado === "carregando" ? "Carregando dados municipais" : ""}</span>
      <p className="sr-only">{titulo}</p>
    </div>
  );
}

function divergentes(vs: number[]): number[] {
  const m = Math.max(5, Math.ceil(Math.max(...vs.map(Math.abs)) / 5) * 5);
  const out: number[] = [];
  for (let x = -m; x <= m; x += 5) out.push(x);
  return out;
}

function PainelSelecao({
  m,
  med,
  refUf,
  refBr,
  pares,
  nomeUf,
}: {
  m: Municipio;
  med: Medida;
  refUf: { pct: number | null; contagem: number | null } | null;
  refBr: { pct: number | null; contagem: number | null } | null;
  pares: { porte: number; n: number; total: number; mediana: number | null } | null;
  nomeUf: string;
}) {
  const v = med.pct(m);
  const c = med.contagem ? med.contagem(m) : null;
  const fmt = (x: number | null | undefined) => formatarValor(med, x);
  return (
    <div>
      <p className="rotulo text-mineral">Município selecionado</p>
      <h3 className="mt-2 font-serif text-2xl leading-snug text-carvao">
        {m.nome} <span className="text-base text-carvao-muted">({m.uf})</span>
      </h3>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-carvao-muted">{med.titulo}</dt>
          <dd className="font-serif text-3xl tabular-nums text-carvao">{fmt(v)}</dd>
          {c != null && (
            <dd className="text-carvao-muted">
              {inteiro(c)} {med.unidadeContagem}
            </dd>
          )}
          {v == null && <dd className="text-xs text-carvao-muted">{med.ausencia}</dd>}
        </div>
        <div className="border-t border-linha pt-3">
          <dt className="text-carvao-muted">{nomeUf}</dt>
          <dd className="tabular-nums text-carvao">{fmt(refUf?.pct)}</dd>
        </div>
        <div className="border-t border-linha pt-3">
          <dt className="text-carvao-muted">Brasil</dt>
          <dd className="tabular-nums text-carvao">{fmt(refBr?.pct)}</dd>
        </div>
        {pares && (
          <div className="border-t border-linha pt-3">
            <dt className="text-carvao-muted">
              Mediana de municípios da mesma região com {ROTULO_PORTE[pares.porte]}
            </dt>
            <dd className="tabular-nums text-carvao">{fmt(pares.mediana)}</dd>
            <dd className="text-xs text-carvao-muted">
              {inteiro(pares.n)} municípios com valor, de {inteiro(pares.total)} no grupo. Porte pelos moradores do Censo 2022.
            </dd>
          </div>
        )}
      </dl>
      <Link href={`${ROTA}/municipio/${m.id}`} className="mt-5 inline-flex min-h-[44px] items-center text-sm font-medium text-obee-dark underline underline-offset-4">
        Ficha completa de {m.nome}
      </Link>
    </div>
  );
}
