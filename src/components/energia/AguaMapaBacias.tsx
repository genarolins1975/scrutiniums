"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import type { Classificacao, ValorClassificavel } from "@/lib/energia/escalas";
import { carimbo, num, plural } from "@/lib/energia/formato";
import { URL_GEO, comFolga, lerViewBox, textoViewBox, validaCamada, type CamadaGeo } from "@/lib/energia/geo";
import { descreveRegiao, preenchimento, validaCores } from "@/lib/energia/mapa-coropletico";

/**
 * Mapa das bacias hidroenergéticas do ONS (contornos do próprio ONS, publicados pelo
 * módulo em public/energia/series/agua_bacias_geo.json, na mesma projeção e na mesma
 * grade da malha de UF do IBGE, desenhada por baixo só para orientação). Uma cor por
 * classe de quebras fixas (a mesma escala em todos os períodos, seção 8.3); sem dado é
 * hachura; a legenda diz a unidade e as classes.
 *
 * Por que não o MapaCoropletico: ele descreve a malha como "malha territorial do IBGE",
 * e esta camada é do ONS; o rodapé daqui diz a fonte certa. A lógica de classe, cor e
 * descrição é a mesma (escalas.ts e mapa-coropletico.ts).
 *
 * Composição: a partir de 1024 px o mapa fica à direita e à esquerda ficam o título, a leitura da bacia, a legenda e as notas (o mapa de
 * um país não precisa da largura inteira); abaixo disso, tudo em coluna, na ordem título, mapa, legenda.
 *
 * Interação: clique, toque, Enter ou Espaço numa bacia selecionam (a seleção é
 * controlada pela página e sincroniza a tabela, a resposta e o histórico da bacia);
 * cada bacia é um alvo de Tab com nome e valor no rótulo acessível, e a leitura da
 * bacia em foco ou sob o ponteiro aparece abaixo do mapa e numa região aria-live. A
 * geometria é buscada no cliente (cerca de 140 KB com a de UF); até lá, e se falhar, a
 * tabela equivalente da página traz os mesmos valores.
 */
export type AguaMapaBaciasProps = {
  titulo: string;
  fonteGeometria: string;
  valores: Readonly<Record<string, number | null>>;
  classificacao: Classificacao;
  cores: readonly string[];
  unidade: string;
  casas: number;
  nomes: Readonly<Record<string, string>>;
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
  periodo: string;
  nota?: string;
};

type Carga = { estado: "carregando" | "pronto" | "erro"; bacias: CamadaGeo | null; uf: CamadaGeo | null; erro: string };

async function busca(url: string): Promise<CamadaGeo> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`resposta ${r.status}`);
  const j: unknown = await r.json();
  const erros = validaCamada(j);
  if (erros.length) throw new Error(erros.slice(0, 2).join("; "));
  return j as CamadaGeo;
}

const LARGURA_REF = 700;

/** "ONS, Contornos das Bacias Hidrográficas (Bacias_Hidrograficas_SIN.zip)": o nome da fonte para o leitor, sem o nome do arquivo. */
function fonteSemArquivo(fonte: string): string {
  return fonte.replace(/\s*\([^()]*\.(?:zip|csv|json|parquet)\)/i, "");
}
function arquivoDaFonte(fonte: string): string | null {
  return /\(([^()]*\.(?:zip|csv|json|parquet))\)/i.exec(fonte)?.[1] ?? null;
}

export function AguaMapaBacias({
  titulo,
  fonteGeometria,
  valores,
  classificacao,
  cores,
  unidade,
  casas,
  nomes,
  selecionado,
  onSelecionar,
  periodo,
  nota,
}: AguaMapaBaciasProps) {
  const uid = useId().replace(/:/g, "");
  const [carga, setCarga] = useState<Carga>({ estado: "carregando", bacias: null, uf: null, erro: "" });
  const [tentativa, setTentativa] = useState(0);
  const [ativo, setAtivo] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarga((c) => ({ ...c, estado: "carregando" }));
    Promise.all([busca(fonteGeometria), busca(URL_GEO.uf).catch(() => null)])
      .then(([bacias, uf]) => vivo && setCarga({ estado: "pronto", bacias, uf, erro: "" }))
      .catch((e: unknown) => vivo && setCarga({ estado: "erro", bacias: null, uf: null, erro: e instanceof Error ? e.message : String(e) }));
    return () => {
      vivo = false;
    };
  }, [fonteGeometria, tentativa]);

  const errosCor = validaCores(cores, classificacao.classes.length);
  if (errosCor.length) throw new Error(`AguaMapaBacias: ${errosCor.join("; ")}`);

  const hachura = `${uid}-sem-dado`;
  const geo = carga.bacias;
  const vb = useMemo(() => {
    const base = lerViewBox((carga.uf ?? geo)?.viewBox ?? "");
    return base ? comFolga(base, 0.01) : null;
  }, [carga.uf, geo]);
  const upx = vb ? vb.largura / LARGURA_REF : 1;
  const fills = useMemo(
    () =>
      Object.fromEntries(
        (geo?.features ?? []).map((f) => [f.id, preenchimento(valores[f.id] as ValorClassificavel, classificacao, { classes: cores, semDado: `url(#${hachura})`, naoSeAplica: "var(--mapa-nao-se-aplica)" })]),
      ),
    [geo, valores, classificacao, cores, hachura],
  );
  const descricao = (id: string) => descreveRegiao(valores[id] as ValorClassificavel, classificacao, casas, unidade);
  const foco = ativo ?? selecionado;
  const focoDesc = foco ? descricao(foco) : null;
  const selFeature = geo?.features.find((f) => f.id === selecionado) ?? null;
  const ativoFeature = ativo && ativo !== selecionado ? (geo?.features.find((f) => f.id === ativo) ?? null) : null;
  const semPoligono = Object.keys(valores).filter((id) => geo && !geo.features.some((f) => f.id === id));
  const comValor = Object.values(valores).filter((v) => v !== null && Number.isFinite(v)).length;

  const teclar = (ev: KeyboardEvent<SVGPathElement>, id: string) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onSelecionar(id);
    } else if (ev.key === "Escape") {
      setAtivo(null);
    }
  };

  return (
    <figure className="grid gap-x-8 gap-y-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]" aria-labelledby={`${uid}-t`}>
      <figcaption id={`${uid}-t`} className="font-serif text-base text-carvao lg:col-start-1 lg:row-start-1">
        {titulo} <span className="font-sans text-sm text-mineral">({periodo})</span>
      </figcaption>

      <div className="relative h-[380px] w-full border border-linha bg-superficie sm:h-[460px] lg:col-start-2 lg:row-span-2 lg:row-start-1" data-estado={carga.estado}>
        {carga.estado === "carregando" && (
          <div role="status" className="flex h-full items-center justify-center px-6 text-center text-sm text-carvao-muted">
            Carregando os contornos das bacias do ONS. Os valores já estão na tabela abaixo.
          </div>
        )}
        {carga.estado === "erro" && (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-carvao">
            <p>Não foi possível carregar os contornos das bacias ({carga.erro}). Os valores continuam na tabela abaixo.</p>
            <button
              type="button"
              className="rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-4 text-energia-dark hover:border-carvao"
              onClick={() => setTentativa((t) => t + 1)}
            >
              Tentar de novo
            </button>
          </div>
        )}
        {carga.estado === "pronto" && geo && vb && (
          <svg
            width="100%"
            height="100%"
            viewBox={textoViewBox(vb)}
            preserveAspectRatio="xMidYMid meet"
            role="group"
            aria-label={`${titulo}: ${plural(geo.features.length, "bacia", "bacias")}. Cada bacia é um botão; a tabela abaixo traz os mesmos valores.`}
            className="block h-full w-full select-none"
            onPointerLeave={() => setAtivo(null)}
          >
            <defs>
              <pattern id={hachura} patternUnits="userSpaceOnUse" width={6 * upx} height={6 * upx} patternTransform="rotate(45)">
                <rect width={6 * upx} height={6 * upx} fill="var(--cor-superficie)" />
                <rect width={1.2 * upx} height={6 * upx} fill="var(--cor-mineral)" />
              </pattern>
            </defs>
            {carga.uf && (
              <g fill="var(--cor-papel)" stroke="var(--cor-linha)" strokeWidth={1} aria-hidden="true" pointerEvents="none">
                {carga.uf.features.map((f) => (
                  <path key={f.id} d={f.d} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
                ))}
              </g>
            )}
            <g stroke="var(--cor-superficie)" strokeWidth={0.75}>
              {geo.features.map((f) => {
                const d = descricao(f.id);
                return (
                  <path
                    key={f.id}
                    d={f.d}
                    data-id={f.id}
                    fill={fills[f.id]}
                    fillRule="evenodd"
                    vectorEffect="non-scaling-stroke"
                    role="button"
                    tabIndex={0}
                    aria-pressed={f.id === selecionado}
                    aria-label={`${nomes[f.id] ?? f.nome}: ${d.valor}${d.classe ? `, classe ${d.classe}` : ""}`}
                    className="cursor-pointer focus:outline-none"
                    onClick={() => onSelecionar(f.id)}
                    onPointerEnter={() => setAtivo(f.id)}
                    onFocus={() => setAtivo(f.id)}
                    onBlur={() => setAtivo((a) => (a === f.id ? null : a))}
                    onKeyDown={(ev) => teclar(ev, f.id)}
                  />
                );
              })}
            </g>
            {ativoFeature && (
              <path d={ativoFeature.d} fill="none" fillRule="evenodd" stroke="var(--cor-energia)" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            )}
            {selFeature && (
              <g fill="none" fillRule="evenodd" strokeLinejoin="round" pointerEvents="none" data-selecionado={selFeature.id}>
                <path d={selFeature.d} stroke="var(--cor-superficie)" strokeWidth={5} vectorEffect="non-scaling-stroke" />
                <path d={selFeature.d} stroke="var(--cor-carvao)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </svg>
        )}
      </div>

      <div className="space-y-3 lg:col-start-1 lg:row-start-2">
        <p className="min-h-[44px] border-b border-linha pb-2 text-sm text-carvao" aria-live="polite" data-selecao={selecionado ?? ""}>
          {foco && focoDesc ? (
            <>
              <span className="rotulo mr-2 text-mineral">{foco === selecionado && !ativoFeature ? "Seleção" : "Em foco"}</span>
              <strong className="font-medium">{nomes[foco] ?? foco}</strong>: <span className="tabular-nums">{focoDesc.valor}</span>
              {focoDesc.classe && <span className="text-carvao-muted">, classe {focoDesc.classe}</span>}
            </>
          ) : (
            <span className="text-carvao-muted">Sem seleção. Clique, toque ou use Tab e Enter numa bacia, ou escolha na lista.</span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-carvao" aria-label={`Legenda: ${unidade}`}>
          <span className="rotulo text-mineral">{unidade}</span>
          {classificacao.classes.map((c, i) => (
            <span key={c.indice} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-3.5 w-5 border border-linha" style={{ background: cores[i] }} />
              {c.rotulo} <span className="text-carvao-muted">({c.contagem})</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3.5 w-5 border border-linha"
              style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, var(--cor-superficie) 1px 5px)" }}
            />
            sem dado ({classificacao.semDado})
          </span>
        </div>

        <div className="space-y-1 text-xs leading-relaxed text-carvao-muted">
          <p className="tabular-nums">
            {plural(Object.keys(valores).length, "bacia", "bacias")} com estimativa: {num(comValor, 0)} com valor e {num(Object.keys(valores).length - comValor, 0)} sem dado (hachura).
            Classes por quebras fixas, as mesmas em todos os períodos: a cor de um mês compara com a de outro.
          </p>
          {geo && semPoligono.length > 0 && <p>Sem polígono nesta camada: {semPoligono.map((id) => nomes[id] ?? id).join(", ")}.</p>}
          {geo && (
            <p>
              {fonteSemArquivo(geo.fonte)}
              {arquivoDaFonte(geo.fonte) && <span data-nivel="analisar"> (arquivo {arquivoDaFonte(geo.fonte)})</span>}, capturado em {carimbo(geo.capturado_em)}; projeção {geo.projecao.nome}, simplificação de{" "}
              {num(geo.simplificacao.tolerancia_m / 1000, 0)} km. Divisas de UF
              {carga.uf ? ` da malha do IBGE (${carga.uf.malha.revisao ? `revisão de ${carga.uf.malha.revisao}` : "revisão sem registro"})` : " indisponíveis nesta carga"}, só para
              orientação.
            </p>
          )}
          {nota && <p>{nota}</p>}
        </div>
      </div>
    </figure>
  );
}
