"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TabelaDados } from "@/components/painel/TabelaDados";
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

const METRICAS: Record<Metrica, { rotulo: string; natureza: string; fmt: (m: Municipio) => string }> = {
  pgp: { rotulo: "Domicílios ainda sendo pagos", natureza: "observado", fmt: (m) => pc(m.pgp) },
  alp: { rotulo: "Domicílios alugados", natureza: "observado", fmt: (m) => pc(m.alp) },
  sdom: { rotulo: "Saldo do verbete 169 por domicílio", natureza: "calculado", fmt: (m) => reais0(m.sdom) },
  gd: { rotulo: "Lacuna de penetração", natureza: "estimado", fmt: (m) => n0(m.gd) },
};
const REGIOES = ["todas", "Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

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
 * Consulta por município do painel Crédito imobiliário e moradia: os 25 maiores municípios numa medida, por região, e o perfil de um
 * município (o que a vista antiga mostrava no mapa, na lista ao lado e no perfil). O arquivo dos 5.570 municípios (2,5 MB) não entra no
 * HTML: é pedido quando o bloco se aproxima da tela, ou de imediato quando o endereço já traz `?municipio=`. Nada é calculado além da
 * ordenação e das partes do total de domicílios que a vista antiga já mostrava.
 */
export function ConsultaMunicipal({ arquivo, nomesInstituicoes, censoAno, baseEstban }: { arquivo: string; nomesInstituicoes: string[]; censoAno: number; baseEstban: string }) {
  const id = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const perfil = useRef<HTMLDivElement>(null);
  const parametros = useSearchParams();
  const pedido = parametros?.get("municipio") ?? null;
  const [estado, setEstado] = useState<"espera" | "carregando" | "pronto" | "erro">("espera");
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [metrica, setMetrica] = useState<Metrica>("pgp");
  const [regiao, setRegiao] = useState("todas");
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
      window.history.replaceState(null, "", `?municipio=${c}#municipios`);
    } catch {
      // o endereço é conveniência; a escolha vale mesmo sem ele
    }
    requestAnimationFrame(() => perfil.current?.focus());
  };

  const recorte = useMemo(() => municipios.filter((m) => regiao === "todas" || m.reg === regiao), [municipios, regiao]);
  const M = METRICAS[metrica];
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
            <p className="t-corpo max-w-prose2 text-carvao-muted">Carregando os dados dos 5.570 municípios (arquivo de 2,5 MB, pedido só quando esta parte da página é aberta).</p>
          )}
        </div>
      ) : (
        <>
          <div role="group" aria-label="Recorte da lista de municípios" className="flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-linha py-3">
            <div>
              <p className="text-sm text-carvao-muted">Medida</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(Object.keys(METRICAS) as Metrica[]).map((k) => (
                  <button key={k} type="button" aria-pressed={k === metrica} onClick={() => setMetrica(k)} className={botao(k === metrica)}>
                    {METRICAS[k].rotulo}
                  </button>
                ))}
              </div>
            </div>
            <label htmlFor={`${id}-regiao`} className="block text-sm text-carvao-muted">
              Região
              <select id={`${id}-regiao`} value={regiao} onChange={(e) => setRegiao(e.target.value)} className={campo}>
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
          <div className="mt-6 grid gap-x-10 gap-y-8 lg:grid-cols-2">
            <div>
              <h3 className="t-h3 text-carvao">Os 25 maiores em {M.rotulo.toLowerCase()}</h3>
              <TabelaDados
                titulo={`Os 25 municípios com maior valor em ${M.rotulo.toLowerCase()}${regiao === "todas" ? "" : `, região ${regiao}`}`}
                colunas={["Município", "UF", M.rotulo]}
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
            <div>
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
                  <p className="t-meta max-w-prose2 text-carvao-muted">Escolha um município na lista ao lado, na busca ou nas tabelas de lacuna estimada, mais abaixo.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
