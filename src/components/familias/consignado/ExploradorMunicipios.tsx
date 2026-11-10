"use client";

import { useMemo, useRef, useState } from "react";
import { ExportacaoComConta } from "@/components/acesso/ExportacaoComConta";
import { Controles, TabelaDados } from "@/components/painel";
import {
  CAMADAS,
  COLUNAS_SENSIBILIDADE,
  IDS_CAMADAS,
  RECORTE_PADRAO,
  REGIOES,
  ROTULO_CONFIABILIDADE,
  corDaEscala,
  faixasDependencia,
  fontesDaCamada,
  limitesDaEscala,
  linhaSensibilidade,
  linhasDoPerfil,
  maioresDaCamada,
  maioresSensibilidade,
  n,
  noRecorte,
  valorDaCamada,
  type IdCamada,
  type Municipio,
  type Recorte,
} from "./camadas";

type Malha = { viewBox: string; transform: string; paths: Record<string, string> };
type Carga = { municipios: Municipio[]; malha: Malha | null; ufs: Malha | null };
type Estado = { fase: "parado" | "carregando" | "erro" } | ({ fase: "pronto" } & Carga);

const GOLD = "/obs/data/gold";
const POR_PAGINA = 50;
const MAX_PERFIS = 5;
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const botao = "inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao transition-colors duration-150 hover:border-carvao disabled:cursor-not-allowed disabled:text-mineral disabled:hover:border-linha";
const campo = "block min-h-[44px] w-full border border-linha bg-superficie px-2 text-sm text-carvao";
const linkBotao = "min-h-[44px] text-left text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao";

async function json<T>(caminho: string): Promise<T> {
  const r = await fetch(caminho);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/**
 * Explorador municipal do painel "Consignado e aposentados": o mapa por camada, os filtros de região e de confiabilidade, a lista dos 25
 * maiores, a tabela paginada com busca e arquivo, a distribuição por faixa de dependência, a sensibilidade na região e o perfil de até
 * cinco municípios lado a lado. A gold municipal (6,8 MB) e a malha (1,4 MB) só são pedidas quando o leitor aciona o botão: nada disso
 * entra no HTML. Antes da carga, o resumo do recorte padrão vem do servidor (a tabela equivalente da figura).
 */
export function ExploradorMunicipios({ ano, scr, total, faixasPadrao, basePadrao }: { ano: number; scr: string; total: number; faixasPadrao: { rotulo: string; n: number }[]; basePadrao: number }) {
  const [estado, setEstado] = useState<Estado>({ fase: "parado" });
  const [cam, setCam] = useState<IdCamada>("p60");
  const [recorte, setRecorte] = useState<Recorte>(RECORTE_PADRAO);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [perfis, setPerfis] = useState<string[]>([]);
  const refPerfil = useRef<HTMLHeadingElement>(null);
  const refBusca = useRef<HTMLInputElement>(null);

  async function carregar() {
    setEstado({ fase: "carregando" });
    try {
      const [mun, malha, ufs] = await Promise.all([
        json<{ municipios: Municipio[] }>(`${GOLD}/consignado_mun.json`),
        json<Malha>(`${GOLD}/penetracao_malha.json`).catch(() => null),
        json<Malha>("/obs/geo/uf.json").catch(() => null),
      ]);
      setEstado({ fase: "pronto", municipios: mun.municipios, malha, ufs });
    } catch {
      setEstado({ fase: "erro" });
    }
  }

  const municipios = estado.fase === "pronto" ? estado.municipios : null;
  const base = useMemo(() => (municipios ?? []).filter((m) => noRecorte(m, recorte)), [municipios, recorte]);
  const porCodigo = useMemo(() => new Map(base.map((m) => [m.c, m])), [base]);
  const limites = useMemo(() => limitesDaEscala(base, cam), [base, cam]);
  const maiores = useMemo(() => maioresDaCamada(base, cam), [base, cam]);
  const filtrados = useMemo(() => {
    const q = semAcento(busca.trim());
    return q ? base.filter((m) => semAcento(`${m.n} ${m.uf}`).includes(q)) : base;
  }, [base, busca]);
  const C = CAMADAS[cam];
  const fontes = fontesDaCamada(cam, { ano, scr });

  function abrirPerfil(codigo: string) {
    setPerfis((p) => [codigo, ...p.filter((c) => c !== codigo)].slice(0, MAX_PERFIS));
    // o foco vai ao título do perfil: quem escolheu pelo teclado ou leitor de tela chega ao resultado
    requestAnimationFrame(() => refPerfil.current?.focus());
  }

  if (estado.fase !== "pronto") {
    return (
      <div data-mapa-legado="" data-explorador-municipios={estado.fase} className="border border-linha bg-superficie p-5">
        <p className="t-corpo max-w-prose2 text-carvao">
          O mapa, a busca por nome e o perfil de cada um dos {n(total)} municípios usam um arquivo de cerca de 8 MB, que só é baixado quando você pede.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4" aria-label="Municípios por faixa de peso dos benefícios na renda domiciliar, recorte padrão">
          {faixasPadrao.map((f) => (
            <div key={f.rotulo}>
              <dd className="numero-p text-carvao">{n(f.n)}</dd>
              <dt className="t-meta text-carvao-muted">{f.rotulo}</dt>
            </div>
          ))}
        </dl>
        <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
          Municípios por faixa do peso dos benefícios líquidos na renda domiciliar, calculado, entre os {n(basePadrao)} municípios sem confiabilidade baixa. É uma razão entre bases agregadas, não o orçamento de cada domicílio.
        </p>
        <button type="button" onClick={carregar} disabled={estado.fase === "carregando"} className={`${botao} mt-4 active:scale-[0.98]`}>
          {estado.fase === "carregando" ? "Carregando os municípios…" : "Abrir o mapa e a busca de municípios"}
        </button>
        <p role="status" className="t-meta mt-2 text-carvao">
          {estado.fase === "erro" ? "Não foi possível carregar os municípios agora. A tabela dos 25 maiores, logo abaixo, continua disponível. Tente de novo." : ""}
        </p>
      </div>
    );
  }

  const { malha, ufs } = estado;
  const ultima = Math.max(0, Math.ceil(filtrados.length / POR_PAGINA) - 1);
  const pag = Math.min(pagina, ultima);
  const daPagina = filtrados.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA);
  const faixas = faixasDependencia(base);
  const selecionados = perfis.map((c) => estado.municipios.find((m) => m.c === c)).filter((m): m is Municipio => Boolean(m));
  const sensiveis = recorte.regiao === "todas" ? [] : maioresSensibilidade(base);
  const legenda = limites ? [limites.lo, (limites.lo + limites.hi) / 2, limites.hi] : [];

  function baixarCsv() {
    const cab = [
      `# ${C.rotulo}`, `# Natureza: ${C.natureza.toLowerCase()}`, `# Fonte e referência: ${fontes}`, `# Unidade: ${C.unidade}`,
      ...(C.ressalva ? [`# Ressalva: ${C.ressalva}`] : []),
      `# Região: ${recorte.regiao}; confiabilidade: ${recorte.conf === "todas" ? "todas" : "sem confiabilidade baixa"}; busca: ${busca}`,
      "# Valores sem saturação por percentis; célula vazia indica medida indisponível.",
      "municipio;uf;valor;unidade;confiabilidade",
    ];
    const esc = (t: string) => (/[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
    const linhas = filtrados.map((m) => [m.n, m.uf, m[cam] === null || m[cam] === undefined ? "" : String(m[cam]).replace(".", ","), C.unidade, ROTULO_CONFIABILIDADE[m.sel]].map(esc).join(";"));
    const url = URL.createObjectURL(new Blob([`﻿${[...cab, ...linhas].join("\n")}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `consignado_municipios_${cam}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div data-mapa-legado="" data-explorador-municipios="pronto" className="space-y-6">
      <Controles
        rotulo="Recorte do mapa e da tabela de municípios"
        resumo={`${n(base.length)} municípios no recorte`}
      >
        <label className="block min-w-0 text-sm text-carvao">
          Medida
          <select value={cam} onChange={(e) => { setCam(e.target.value as IdCamada); setPagina(0); }} className={campo}>
            {IDS_CAMADAS.map((id) => (
              <option key={id} value={id}>{CAMADAS[id].rotulo}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-carvao">
          Região
          <select value={recorte.regiao} onChange={(e) => { setRecorte({ ...recorte, regiao: e.target.value }); setPagina(0); }} className={campo}>
            <option value="todas">Todas</option>
            {REGIOES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-carvao">
          Confiabilidade
          <select value={recorte.conf} onChange={(e) => { setRecorte({ ...recorte, conf: e.target.value as Recorte["conf"] }); setPagina(0); }} className={campo}>
            <option value="exclui_baixa">Sem confiabilidade baixa</option>
            <option value="todas">Incluir todas</option>
          </select>
        </label>
      </Controles>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {malha ? (
            <svg viewBox={malha.viewBox} role="group" aria-label={`Mapa municipal: ${C.rotulo}`} className="block h-auto w-full">
              <g transform={malha.transform}>
                {Object.entries(malha.paths).map(([cod, d]) => {
                  const m = porCodigo.get(cod);
                  if (!m) return <path key={cod} d={d} fill="var(--cor-papel)" />;
                  const marcado = perfis.includes(cod);
                  return (
                    <path key={cod} d={d} fill={corDaEscala(m[cam], limites, C.paleta)} stroke={marcado ? "var(--cor-carvao)" : undefined} strokeWidth={marcado ? 1200 : undefined} className="cursor-pointer" onClick={() => abrirPerfil(cod)}>
                      <title>{`${m.n} (${m.uf}): ${valorDaCamada(m, cam)}. Confiabilidade ${ROTULO_CONFIABILIDADE[m.sel]}.`}</title>
                    </path>
                  );
                })}
                {ufs && Object.entries(ufs.paths).map(([uf, d]) => <path key={uf} d={d} fill="none" stroke="var(--cor-carvao)" strokeOpacity={0.45} strokeWidth={500} pointerEvents="none" />)}
              </g>
            </svg>
          ) : (
            <p className="t-meta text-carvao">A malha municipal não pôde ser carregada. A lista e a tabela abaixo trazem os mesmos municípios e valores.</p>
          )}
          <p className="t-meta mt-2 text-carvao-muted">
            {C.rotulo} · {C.unidade} · {C.natureza.toLowerCase()} · {fontes}. Escala contínua, saturada nos percentis 5 e 95 do recorte.
          </p>
          <ul className="t-meta mt-1 flex flex-wrap gap-x-5 gap-y-1 text-carvao" aria-label="Referências numéricas da escala de cor">
            {legenda.length === 0 && <li>Sem dados no recorte</li>}
            {legenda.map((v, i) => (
              <li key={i} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-3 w-5 border border-linha" style={{ background: corDaEscala(v, limites, C.paleta) }} />
                {i === 0 ? "Até " : i === 2 ? "A partir de " : ""}
                {valorDaCamada({ [cam]: v } as Pick<Municipio, IdCamada>, cam)}
              </li>
            ))}
          </ul>
          <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
            Azul petróleo para envelhecimento e Previdência, bronze para exposição estimada ao consignado: envelhecer não é risco, e a cor não deve sugerir que seja. Toque ou clique num município para abrir o perfil; pelo teclado, use a lista ao lado ou a tabela.
          </p>
        </div>
        <div className="min-w-0">
          <h3 className="t-h3 text-carvao">Os 25 maiores valores no recorte</h3>
          <p className="t-meta text-carvao-muted">{C.rotulo}</p>
          <ol className="mt-2 max-h-[30rem] overflow-y-auto border-t border-linha" tabIndex={0} aria-label={`Os 25 maiores valores: ${C.rotulo}`}>
            {maiores.map((m) => (
              <li key={m.c} className="border-b border-linha">
                <button type="button" onClick={() => abrirPerfil(m.c)} className="flex min-h-[44px] w-full items-center justify-between gap-3 px-1 text-left text-sm text-carvao hover:bg-contexto" aria-label={`Abrir perfil de ${m.n} (${m.uf}): ${valorDaCamada(m, cam)}`}>
                  <span className="min-w-0">{m.n} <span className="text-mineral">{m.uf}</span></span>
                  <span className="tabular-nums">{valorDaCamada(m, cam)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div>
        <h3 className="t-h3 text-carvao">Municípios por faixa de dependência no recorte</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {faixas.map((f) => (
            <div key={f.rotulo}>
              <dd className="numero-p text-carvao">{n(f.n)}</dd>
              <dt className="t-meta text-carvao-muted">{f.rotulo}</dt>
            </div>
          ))}
        </dl>
        <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
          Calculado: razão entre o valor líquido de benefícios emitidos e a renda domiciliar do Censo, ambos a preços de 2022. É uma razão entre bases agregadas, não uma decomposição contábil de cada domicílio.
        </p>
      </div>

      <details className="border-t border-linha pt-3" data-tabela-municipios="">
        <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-carvao-muted underline underline-offset-4 hover:text-carvao">
          Dados do mapa: {n(base.length)} municípios no recorte
        </summary>
        <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
          {C.ressalva ? `${C.ressalva} ` : ""}Mesma medida e mesmos filtros do mapa. Busque município ou UF e escolha o nome para abrir o perfil. A cor satura nos percentis 5 e 95; os valores da tabela e do arquivo não são limitados.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block min-w-[14rem] flex-1 text-sm text-carvao">
            Buscar município ou UF
            <input ref={refBusca} type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} className={campo} />
          </label>
          <button type="button" className={botao} disabled={pag === 0} onClick={() => setPagina(pag - 1)}>Página anterior</button>
          <button type="button" className={botao} disabled={pag >= ultima} onClick={() => setPagina(pag + 1)}>Próxima página</button>
          <ExportacaoComConta rotulo="Baixar CSV deste recorte">
            <button type="button" className={botao} onClick={baixarCsv}>Baixar CSV deste recorte</button>
          </ExportacaoComConta>
        </div>
        <p role="status" aria-live="polite" className="t-meta mt-2 text-carvao">
          {filtrados.length ? `${n(pag * POR_PAGINA + 1)} a ${n(Math.min(filtrados.length, (pag + 1) * POR_PAGINA))} de ${n(filtrados.length)} municípios. Página ${pag + 1} de ${ultima + 1}.` : "Nenhum município corresponde à busca neste recorte. Altere a busca ou os filtros."}
        </p>
        {daPagina.length > 0 && (
          <TabelaDados
            recolhida={false}
            titulo={`${C.rotulo} · ${C.unidade} · ${C.natureza.toLowerCase()} · ${fontes} · municípios do recorte, em páginas de ${POR_PAGINA}`}
            colunas={["Município", "UF", C.rotulo, "Confiabilidade"]}
            linhas={daPagina.map((m) => [
              <button key={m.c} type="button" className={linkBotao} onClick={() => abrirPerfil(m.c)} aria-label={`Abrir perfil de ${m.n} (${m.uf})`}>{m.n}</button>,
              m.uf,
              valorDaCamada(m, cam),
              ROTULO_CONFIABILIDADE[m.sel],
            ])}
            limite={POR_PAGINA}
            idioma="pt"
          />
        )}
      </details>

      {sensiveis.length > 0 && (
        <TabelaDados
          recolhida={false}
          titulo={`Sensibilidade social e regulatória na região ${recorte.regiao}: os 15 maiores índices`}
          colunas={COLUNAS_SENSIBILIDADE}
          linhas={sensiveis.map(linhaSensibilidade)}
          casas={[null, null, 0, 0, 0, 0]}
          limite={15}
          idioma="pt"
          nota={`Estimado. Os 15 maiores índices de sensibilidade na região ${recorte.regiao}, entre municípios de 20 mil habitantes ou mais e sem confiabilidade baixa. Mede a sensibilidade do contexto, não a conduta de ninguém.`}
        />
      )}

      <section aria-labelledby="perfil-municipal-titulo" className="border-t border-linha pt-5">
        <h3 id="perfil-municipal-titulo" ref={refPerfil} tabIndex={-1} className="t-h3 scroll-mt-28 text-carvao outline-none">
          Perfil municipal{selecionados.length > 0 ? `: ${selecionados.length === 1 ? "1 município" : `${selecionados.length} municípios em comparação`}` : ""}
        </h3>
        {selecionados.length === 0 ? (
          <p className="t-corpo mt-2 max-w-prose2 text-carvao-muted">Escolha um município no mapa, na lista dos 25 maiores ou pelo nome na tabela para abrir o perfil. É possível comparar até cinco municípios lado a lado.</p>
        ) : (
          <>
            <ul className="mt-3 flex flex-wrap items-center gap-2">
              {selecionados.map((m) => (
                <li key={m.c}>
                  <button type="button" className={botao} onClick={() => setPerfis((p) => p.filter((c) => c !== m.c))} aria-label={`Remover ${m.n} (${m.uf}) da comparação`}>
                    {m.n} <span className="ml-1 text-mineral">{m.uf}</span> <span aria-hidden="true" className="ml-2">×</span>
                  </button>
                </li>
              ))}
              {selecionados.length > 1 && (
                <li><button type="button" className={botao} onClick={() => setPerfis([])}>Limpar comparação</button></li>
              )}
              <li><button type="button" className={botao} onClick={() => { const d = refBusca.current?.closest("details"); if (d) d.open = true; refBusca.current?.focus(); }}>Voltar à busca de municípios</button></li>
            </ul>
            <TabelaDados
              recolhida={false}
              titulo="Comparação de indicadores dos municípios selecionados"
              colunas={["Indicador", ...selecionados.map((m) => `${m.n} (${m.uf})`), "Natureza do dado"]}
              linhas={linhasDoPerfil(selecionados[0]).map((l, i) => [l.indicador, ...selecionados.map((m) => linhasDoPerfil(m)[i].valor), l.natureza])}
              limite={40}
              fixarPrimeiraColuna
              idioma="pt"
              nota={`Confiabilidade: ${selecionados.map((m) => `${m.n}, ${ROTULO_CONFIABILIDADE[m.sel]}`).join("; ")}. Censo 2022, Previdência em dezembro de ${ano} e SCR de ${scr}. Exposição, faixa e saturação são estimativas por alocação do saldo estadual; o serviço da dívida é cenário de 84 meses.`}
            />
            {selecionados.some((m) => m.incoerente) && (
              <p className="t-meta mt-3 max-w-prose2 border-l border-carvao pl-4 text-carvao">
                Ao menos um dos municípios selecionados reprova no teste de coerência: o peso calculado supera o teto que o Censo dá para rendas que não vêm do trabalho. A causa conhecida é o município do órgão pagador, e por isso ele fica fora dos rankings e das classificações de saturação.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
