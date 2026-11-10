"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TabelaDados } from "@/components/painel/TabelaDados";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { MapaMunicipios } from "@/components/familias/MapaMunicipios";
import { campo as campoUrl, tiposUrl } from "@/lib/painel/estadoUrl";
import { NAO_SE_APLICA, type ValorClassificavel } from "@/lib/painel/escalas";
import { CONFIABILIDADE, dinheiro, n0, pc, reais0 } from "./formato";

/** Uma linha de moradia_mun.json (chaves curtas da gold). */
type Municipio = {
  c: string;
  n: string;
  uf: string;
  reg: string;
  dt: number;
  dpg?: number | null;
  dpp?: number | null;
  da?: number | null;
  dc?: number | null;
  pgp?: number | null;
  alp?: number | null;
  s?: number | null;
  pp?: number | null;
  ni?: number | null;
  i1?: number | null;
  i1p?: number | null;
  hhi?: number | null;
  rpc?: number | null;
  urb?: number | null;
  sel: string;
  sdom?: number | null;
  pesp?: number | null;
  sesp?: number | null;
  sfx?: [number, number] | null;
  gd?: number | null;
  gs?: number | null;
};

type Metrica = "pgp" | "alp" | "sdom" | "gd";

const METRICAS: Record<Metrica, { rotulo: string; natureza: string; unidade: string; casas: number; fmt: (m: Municipio) => string }> = {
  pgp: { rotulo: "Domicílios ainda sendo pagos", natureza: "observado", unidade: "% dos domicílios", casas: 1, fmt: (m) => pc(m.pgp) },
  alp: { rotulo: "Domicílios alugados", natureza: "observado", unidade: "% dos domicílios", casas: 1, fmt: (m) => pc(m.alp) },
  sdom: { rotulo: "Saldo do verbete 169 por domicílio", natureza: "calculado", unidade: "R$ por domicílio", casas: 0, fmt: (m) => reais0(m.sdom) },
  gd: { rotulo: "Lacuna de penetração", natureza: "estimado", unidade: "domicílios", casas: 0, fmt: (m) => n0(m.gd) },
};
const IDS_METRICAS = Object.keys(METRICAS) as Metrica[];
const REGIOES = ["todas", "Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"] as const;
/** Medida e região do mapa no endereço: o link copiado reabre o mesmo recorte e o voltar do navegador desfaz a escolha. */
const ESQUEMA = { medida: campoUrl(tiposUrl.opcao(IDS_METRICAS), "pgp"), regiao: campoUrl(tiposUrl.opcao(REGIOES), "todas") };

/** Valor do município no mapa: número, ausência (hachura) ou "não se aplica" (sem lacuna estimada). Ausência nunca vira zero. */
function valorNoMapa(m: Municipio, k: Metrica): ValorClassificavel {
  const v = m[k];
  if (typeof v === "number") return v;
  return k === "gd" && typeof m.pesp === "number" ? NAO_SE_APLICA : null;
}

/** O que o estado do município quer dizer na medida escolhida, para a dica e a leitura do mapa. */
function detalheNoMapa(m: Municipio, k: Metrica): string | null {
  if (typeof m[k] === "number") return k === "sdom" ? `confiabilidade do saldo: ${CONFIABILIDADE[m.sel] ?? m.sel}` : null;
  if (k === "sdom") return "nenhuma dependência bancária reporta saldo imobiliário aqui; ausência, não zero";
  if (k === "gd") return typeof m.pesp === "number" ? "na mediana dos municípios comparáveis ou acima dela: sem lacuna estimada" : "grupo de comparação pequeno demais para estimar";
  return "o Censo não publica esta parte dos domicílios para o município";
}

const NOTA_DO_MAPA: Record<Metrica, string> = {
  pgp: "Observado. Parte dos domicílios próprios ainda sendo pagos, de qualquer forma de pagamento, não só financiamento bancário.",
  alp: "Observado. Parte dos domicílios alugados no total de domicílios particulares permanentes ocupados.",
  sdom: "Calculado. O saldo mostra onde a agência escritura o crédito, não onde mora quem o tomou. Hachura: município sem dependência bancária que reporte saldo; ausência, não zero.",
  gd: "Estimado. Diferença para a mediana de municípios comparáveis; não é demanda comprovada. Em cinza liso, rotulados “não se aplica”: municípios na mediana do grupo ou acima dela. Hachura: grupo pequeno demais para estimar.",
};

const EXPLICA_CONFIABILIDADE: Record<string, string> = {
  sem_dependencia: "Nenhuma dependência bancária reporta saldo imobiliário neste município. Ausência de saldo não é ausência de crédito: é ausência de agência que o contabilize.",
  baixa: "Confiabilidade baixa: o saldo por domicílio é muito superior à mediana nacional ou a série mensal apresenta salto de reclassificação. Fora dos rankings e da amostra do modelo.",
  media: "Confiabilidade média: uma única instituição contabiliza aqui, ou o saldo por domicílio está acima do triplo da mediana nacional.",
  alta: "Confiabilidade alta: saldo por domicílio dentro da faixa esperada, série estável e mais de uma instituição contabilizando.",
};

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const botao = (ativo: boolean) => `min-h-[44px] border px-3 text-sm ${ativo ? "border-carvao bg-carvao text-superficie" : "border-linha bg-superficie text-carvao-muted hover:text-carvao"}`;
const campo = "mt-1 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-base text-carvao focus:border-bronze focus:outline-none focus:ring-2 focus:ring-bronze/30";
const nomeBotao = "min-h-[44px] text-left text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao";

function linhasDoPerfil(m: Municipio): [string, string, string][] {
  const parte = (v: number | null | undefined) => (typeof v === "number" ? `${n0(v)} (${pc((100 * v) / m.dt)})` : "sem dado");
  return [
    ["Domicílios particulares permanentes ocupados", n0(m.dt), "observado"],
    ["Próprios já pagos, herdados ou ganhos", parte(m.dpg), "observado"],
    ["Próprios ainda sendo pagos", typeof m.dpp === "number" ? `${n0(m.dpp)} (${pc(m.pgp)})` : "sem dado", "observado"],
    ["Alugados", typeof m.da === "number" ? `${n0(m.da)} (${pc(m.alp)})` : "sem dado", "observado"],
    ["Cedidos ou emprestados", n0(m.dc), "observado"],
    ["Renda domiciliar por pessoa", reais0(m.rpc), "observado"],
    ["Urbanização", pc(m.urb), "observado"],
    ["Saldo do verbete 169 contabilizado", typeof m.s === "number" ? dinheiro(m.s) : "sem dependência bancária", "observado"],
    ["Depósitos de poupança contabilizados", dinheiro(m.pp), "observado"],
    ["Saldo por domicílio", reais0(m.sdom), "calculado"],
    ["Instituições contabilizando", typeof m.ni === "number" ? n0(m.ni) : "nenhuma", "observado"],
    ["Concentração entre instituições (índice HHI)", n0(m.hhi), "calculado"],
    ["Proporção esperada de domicílios pagando", typeof m.pesp === "number" ? pc(m.pesp) : "grupo pequeno demais", "estimado"],
    ["Lacuna de penetração", typeof m.gd === "number" ? `${n0(m.gd)} domicílios` : "acima ou na mediana do grupo", "estimado"],
    ["Saldo esperado pelo modelo", typeof m.sesp === "number" ? dinheiro(m.sesp) : "fora da amostra do modelo", "estimado"],
    ["Faixa de um desvio", m.sfx ? `${dinheiro(m.sfx[0])} a ${dinheiro(m.sfx[1])}` : "sem dado", "estimado"],
    ["Lacuna de saldo", typeof m.gs === "number" ? dinheiro(m.gs) : "acima ou na referência", "estimado"],
  ];
}

/**
 * Consulta por município do painel Crédito imobiliário e moradia: o mapa municipal em quatro medidas, com filtro de região, os 25
 * maiores municípios na medida e o perfil de um município (o mapa, a lista ao lado e o perfil da vista antiga, morMapa e morPerfil em
 * public/obs/app.js). O arquivo dos 5.570 municípios (2,5 MB) e a malha do IBGE (1,3 MB) não entram no HTML: são pedidos quando o bloco
 * se aproxima da tela, ou de imediato quando o endereço já traz `?municipio=`. Medida, região e município ficam no endereço. Nada é
 * calculado além da ordenação, das classes do mapa e das partes do total de domicílios que a vista antiga já mostrava.
 */
export function ConsultaMunicipal({ arquivo, nomesInstituicoes, censoAno, baseEstban }: { arquivo: string; nomesInstituicoes: string[]; censoAno: number; baseEstban: string }) {
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const perfil = useRef<HTMLDivElement>(null);
  const parametros = useSearchParams();
  const pedido = parametros?.get("municipio") ?? null;
  const [estado, setEstado] = useState<"espera" | "carregando" | "pronto" | "erro">("espera");
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [url, setUrl] = useEstadoUrl(ESQUEMA);
  const metrica: Metrica = url.medida;
  const regiao = url.regiao;
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(pedido);

  const carregar = () => {
    setEstado("carregando");
    fetch(arquivo)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { municipios?: Municipio[] }) => {
        if (!Array.isArray(j.municipios)) throw new Error("formato");
        setMunicipios(j.municipios);
        setEstado("pronto");
      })
      .catch(() => setEstado("erro"));
  };

  // sob demanda: quando o bloco chega perto da tela, ou já, se o endereço pede um município
  useEffect(() => {
    if (estado !== "espera") return;
    if (pedido || typeof IntersectionObserver === "undefined" || !raiz.current) {
      carregar();
      return;
    }
    const o = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          o.disconnect();
          carregar();
        }
      },
      { rootMargin: "600px" },
    );
    o.observe(raiz.current);
    return () => o.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez
  }, [estado, pedido]);

  // o endereço manda quando muda (link de um ranking da página)
  useEffect(() => {
    if (pedido) setSel(pedido);
  }, [pedido]);

  const escolher = (c: string) => {
    setSel(c);
    setBusca("");
    try {
      // os demais parâmetros (medida, região) ficam como estão
      const u = new URL(window.location.href);
      u.searchParams.set("municipio", c);
      u.hash = "municipios";
      window.history.replaceState(window.history.state, "", u);
    } catch {
      // o endereço é conveniência; a escolha vale mesmo sem ele
    }
    requestAnimationFrame(() => perfil.current?.focus());
  };

  // "Limpar seleção" e o segundo clique no polígono: o mapa é controlado, então o estado e o endereço precisam esquecer o município
  const limpar = () => {
    setSel(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("municipio");
      window.history.replaceState(window.history.state, "", u);
    } catch {
      // o endereço é conveniência
    }
  };

  const recorte = useMemo(() => municipios.filter((m) => regiao === "todas" || m.reg === regiao), [municipios, regiao]);
  const M = METRICAS[metrica];
  const idsDoMapa = useMemo(() => recorte.map((x) => x.c), [recorte]);
  const porCodigo = useMemo(() => new Map(recorte.map((x) => [x.c, x])), [recorte]);
  const valoresDoMapa = useMemo(() => Object.fromEntries(recorte.map((x) => [x.c, valorNoMapa(x, metrica)])), [recorte, metrica]);
  const fonteDaMedida = metrica === "pgp" || metrica === "alp" ? `IBGE, Censo ${censoAno}` : metrica === "sdom" ? `Banco Central, ESTBAN, ${baseEstban}, e IBGE, Censo ${censoAno}` : `estimativa sobre o Censo ${censoAno}`;
  const maiores = useMemo(() => recorte.filter((m) => typeof m[metrica] === "number").sort((a, b) => (b[metrica] as number) - (a[metrica] as number)).slice(0, 25), [recorte, metrica]);
  const achados = useMemo(() => {
    const q = semAcento(busca.trim());
    if (q.length < 2) return [];
    const comeca = municipios.filter((m) => semAcento(m.n).startsWith(q));
    const contem = municipios.filter((m) => !semAcento(m.n).startsWith(q) && semAcento(m.n).includes(q));
    return [...comeca, ...contem].slice(0, 8);
  }, [busca, municipios]);
  const m = sel ? municipios.find((x) => x.c === sel) ?? null : null;
  const maior = m && typeof m.i1 === "number" ? nomesInstituicoes[m.i1] : null;

  return (
    <div ref={raiz} data-consulta-municipal={estado}>
      {estado !== "pronto" ? (
        <div role="status" className="border-y border-linha py-4">
          {estado === "erro" ? (
            <>
              <p className="t-corpo max-w-prose2 text-carvao" data-ausencia="">
                Não foi possível carregar o arquivo dos municípios. Os números do país e dos estados, no restante da página, não dependem dele.
              </p>
              <button type="button" onClick={carregar} className={`${botao(false)} mt-3`}>
                Tentar de novo
              </button>
            </>
          ) : (
            <p className="t-corpo flex min-h-[400px] max-w-prose2 items-center text-carvao-muted">Carregando os dados dos 5.570 municípios e o mapa (arquivos de 2,5 MB e 1,3 MB, pedidos só quando esta parte da página é aberta).</p>
          )}
        </div>
      ) : (
        <>
          <div role="group" aria-label="Recorte do mapa e da lista de municípios" className="flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-linha py-3">
            <div>
              <p className="text-sm text-carvao-muted">Medida</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {IDS_METRICAS.map((k) => (
                  <button key={k} type="button" aria-pressed={k === metrica} onClick={() => setUrl({ medida: k })} className={botao(k === metrica)}>
                    {METRICAS[k].rotulo}
                  </button>
                ))}
              </div>
            </div>
            <label htmlFor={`${id}-regiao`} className="block text-sm text-carvao-muted">
              Região
              <select id={`${id}-regiao`} value={regiao} onChange={(e) => setUrl({ regiao: e.target.value as typeof regiao })} className={campo}>
                {REGIOES.map((r) => (
                  <option key={r} value={r}>
                    {r === "todas" ? "Todas" : r}
                  </option>
                ))}
              </select>
            </label>
            <p role="status" className="t-meta text-carvao-muted">
              {n0(recorte.length)} municípios no recorte
            </p>
          </div>
          <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0" data-mapa-moradia={metrica}>
              <h3 className="t-h3 text-carvao">{M.rotulo}, por município</h3>
              <p className="t-meta mb-3 mt-1 max-w-prose2 text-carvao-muted">
                {regiao === "todas" ? "Brasil" : `Região ${regiao}`}, {n0(recorte.length)} municípios. Toque ou clique num município para abrir o perfil dele, logo abaixo; pelo teclado, use a busca do mapa ou a lista ao lado.
              </p>
              <MapaMunicipios
                chave={regiao}
                paisInteiro={regiao === "todas"}
                titulo={`${M.rotulo}, por município`}
                ids={idsDoMapa}
                valores={valoresDoMapa}
                unidade={M.unidade}
                casas={M.casas}
                periodo={fonteDaMedida}
                nota={NOTA_DO_MAPA[metrica]}
                selecionado={sel && porCodigo.has(sel) ? sel : null}
                onSelecionar={(c) => { if (c) escolher(c); else limpar(); }}
                detalheRegiao={(c) => { const x = porCodigo.get(c); return x ? detalheNoMapa(x, metrica) : null; }}
              />
            </div>
            <div className="min-w-0">
              <h3 className="t-h3 text-carvao">Os 25 maiores em {M.rotulo.toLowerCase()}</h3>
              <TabelaDados
                titulo={`Os 25 municípios com maior valor em ${M.rotulo.toLowerCase()}${regiao === "todas" ? "" : `, região ${regiao}`}`}
                colunas={["Município", "UF", M.unidade.charAt(0).toUpperCase() + M.unidade.slice(1)]}
                linhas={maiores.map((x) => [
                  <button key={x.c} type="button" onClick={() => escolher(x.c)} className={nomeBotao} aria-current={x.c === sel ? "true" : undefined}>
                    {x.n}
                  </button>,
                  x.uf,
                  M.fmt(x),
                ])}
                limite={25}
                recolhida={false}
                idioma="pt"
                nota={`Natureza: ${M.natureza}. ${metrica === "pgp" || metrica === "alp" ? `Fonte: IBGE, Censo ${censoAno}.` : metrica === "sdom" ? `Fonte: Banco Central, ESTBAN, ${baseEstban}, e IBGE, Censo ${censoAno}.` : `Estimativa sobre o Censo ${censoAno}: diferença para municípios comparáveis, não demanda comprovada.`} O nome abre o perfil do município.`}
              />
            </div>
          </div>
          <div className="mt-8 border-t border-linha pt-6">
            <div className="max-w-3xl">
              <h3 className="t-h3 text-carvao">Perfil de um município</h3>
              <label htmlFor={`${id}-busca`} className="mt-2 block text-sm text-carvao-muted">
                Buscar município pelo nome
                <input id={`${id}-busca`} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={campo} autoComplete="off" />
              </label>
              {busca.trim().length >= 2 && (
                <ul className="mt-2 border-b border-linha" aria-label="Municípios encontrados">
                  {achados.length === 0 && <li className="t-meta py-3 text-carvao-muted">Nenhum município com esse nome.</li>}
                  {achados.map((x) => (
                    <li key={x.c} className="border-t border-linha">
                      <button type="button" onClick={() => escolher(x.c)} className={`${nomeBotao} w-full`}>
                        {x.n} <span className="text-carvao-muted">({x.uf})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div ref={perfil} tabIndex={-1} className="mt-4 scroll-mt-28 focus:outline-none" data-perfil-municipal={m?.c ?? ""}>
                {m ? (
                  <>
                    <p className="t-corpo text-carvao">
                      <span className="font-medium">{m.n}</span> <span className="text-carvao-muted">({m.uf}, região {m.reg})</span>
                    </p>
                    <p className="t-meta mt-1 text-carvao-muted">Confiabilidade do saldo contabilizado: {CONFIABILIDADE[m.sel] ?? m.sel}.</p>
                    <TabelaDados
                      titulo={`Perfil de moradia e crédito imobiliário: ${m.n} (${m.uf})`}
                      colunas={["Indicador", "Valor", "Natureza"]}
                      linhas={linhasDoPerfil(m)}
                      limite={30}
                      recolhida={false}
                      idioma="pt"
                    />
                    {maior && (
                      <p className="t-meta mt-3 max-w-prose2 text-carvao-muted">
                        Maior participação no saldo contabilizado: {maior}, com {pc(m.i1p)} do saldo do verbete 169 no município. Isso mede escrituração contábil, não clientes
                        atendidos.
                      </p>
                    )}
                    <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">{EXPLICA_CONFIABILIDADE[m.sel] ?? ""}</p>
                    <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
                      Domicílios e renda: IBGE, Censo {censoAno}. Saldo, poupança e instituições: Banco Central, ESTBAN, {baseEstban}. Valores esperados e lacunas são estimativas
                      desta publicação, não demanda comprovada.
                    </p>
                  </>
                ) : sel ? (
                  <p className="t-corpo text-carvao" data-ausencia="">
                    O endereço pede um município que não consta da publicação atual. Busque pelo nome.
                  </p>
                ) : (
                  <p className="t-meta max-w-prose2 text-carvao-muted">Escolha um município no mapa, na lista dos 25 maiores, na busca ou nas tabelas de lacuna estimada, mais abaixo.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
