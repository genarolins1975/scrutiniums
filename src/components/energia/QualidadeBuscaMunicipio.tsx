"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import LinkSemPrefetch from "@/components/energia/LinkSemPrefetch";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { buscarRegioes } from "@/lib/energia/mapa-coropletico";
import { CAMPO_MUN, carregarMunicipios, orientacaoSemDado, regiaoDoMunicipio, resumoMunicipio, type MunicipioQualidade } from "@/lib/energia/qualidade";

/**
 * Busca do município na primeira tela. A tarefa de quem chega aqui é achar a própria área, e o mapa que a resolve fica a vários
 * quadros de rolagem: este campo escolhe o município (o mesmo `?mun=` do mapa, da tabela e da ficha) e já diz, ali mesmo, o intervalo
 * de DEC e de FEC dos conjuntos que o atendem, com o caminho para a ficha completa. A lista de municípios (o CSV que o mapa também usa,
 * 600 KB) só é baixada quando o campo recebe o foco, ou na hora, quando o link já traz um município; a página não carrega 5.571 nomes
 * para quem não procura nenhum. Combobox com lista: setas percorrem, Enter escolhe, Esc fecha.
 */

const ESQUEMA = { mun: CAMPO_MUN };
const LIMITE_LISTA = 8;

type Carga = { estado: "parado" } | { estado: "carregando" } | { estado: "pronto"; municipios: MunicipioQualidade[] } | { estado: "erro"; erro: string };

const BOTAO =
  "inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

export function QualidadeBuscaMunicipio({ ano, urlMunicipios, idFicha = "municipio-escolhido" }: { ano: number; urlMunicipios: string; /** `id` da ficha do município, no mapa. */ idFicha?: string }) {
  const uid = useId();
  const campo = useRef<HTMLInputElement>(null);
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const [carga, setCarga] = useState<Carga>({ estado: "parado" });
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  // texto do município escolhido na lista: enquanto o campo mostra esse texto, não há "nenhum município" a avisar
  const [escolhido, setEscolhido] = useState<string | null>(null);

  const iniciar = () => {
    if (carga.estado === "carregando" || carga.estado === "pronto") return;
    setCarga({ estado: "carregando" });
    carregarMunicipios(urlMunicipios).then(
      (municipios) => setCarga({ estado: "pronto", municipios }),
      (e: unknown) => setCarga({ estado: "erro", erro: e instanceof Error ? e.message : String(e) }),
    );
  };

  // link com município (compartilhado ou vindo do mapa): carrega já, para o resumo aparecer sem o leitor tocar no campo
  useEffect(() => {
    if (v.mun && carga.estado === "parado") iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.mun, carga.estado]);

  const municipios = carga.estado === "pronto" ? carga.municipios : null;
  const regioes = useMemo(() => (municipios ? municipios.map(regiaoDoMunicipio) : []), [municipios]);
  const porCodigo = useMemo(() => new Map((municipios ?? []).map((m) => [m.cod, m])), [municipios]);
  const selecionado = v.mun ? (porCodigo.get(v.mun) ?? null) : null;
  const resultados = useMemo(() => (termo.trim().length >= 2 ? buscarRegioes(regioes, termo, LIMITE_LISTA) : { itens: [], total: 0 }), [regioes, termo]);
  const mostrando = aberto && resultados.itens.length > 0;

  // o município escolhido em outro lugar (mapa, tabela, link) aparece no campo, sem apagar o que a pessoa está digitando nele
  useEffect(() => {
    if (typeof document !== "undefined" && document.activeElement === campo.current) return;
    if (selecionado) {
      const texto = `${selecionado.nome} (${selecionado.uf})`;
      setTermo(texto);
      setEscolhido(texto);
    } else if (!v.mun && escolhido !== null) {
      setTermo("");
      setEscolhido(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado, v.mun]);

  const escolher = (id: string) => {
    const m = porCodigo.get(id);
    if (!m) return;
    const texto = `${m.nome} (${m.uf})`;
    setTermo(texto);
    setEscolhido(texto);
    setAberto(false);
    definir({ mun: m.cod });
  };

  const limpar = () => {
    setTermo("");
    setEscolhido(null);
    setAberto(false);
    definir({ mun: "" });
  };

  const aviso =
    carga.estado === "carregando"
      ? "Carregando a lista de municípios."
      : carga.estado === "erro"
        ? `A lista de municípios não carregou (${carga.erro}). Use o mapa ou a tabela mais abaixo.`
        : carga.estado === "pronto" && termo.trim().length >= 2 && !resultados.total && termo !== escolhido
          ? "Nenhum município com esse nome."
          : "";
  const orientacao = selecionado ? orientacaoSemDado(selecionado) : "";

  return (
    <section aria-label="Buscar o meu município" data-busca-municipio-topo="" className="border-y border-linha py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <label htmlFor={`${uid}-campo`} className="rotulo shrink-0 text-mineral">
          Procure o seu município
        </label>
        <div className="relative w-full min-w-0 md:max-w-sm">
          <input
            ref={campo}
            id={`${uid}-campo`}
            type="text"
            role="combobox"
            aria-expanded={mostrando}
            aria-controls={`${uid}-lista`}
            aria-autocomplete="list"
            aria-activedescendant={mostrando ? `${uid}-op-${ativo}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="Digite o nome, por exemplo Caxias do Sul"
            value={termo}
            onFocus={iniciar}
            onChange={(e) => {
              setTermo(e.target.value);
              setEscolhido(null);
              setAberto(true);
              setAtivo(0);
              iniciar();
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && resultados.itens.length) {
                e.preventDefault();
                setAberto(true);
                setAtivo((a) => Math.min(a + 1, resultados.itens.length - 1));
              } else if (e.key === "ArrowUp" && resultados.itens.length) {
                e.preventDefault();
                setAtivo((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && mostrando) {
                e.preventDefault();
                escolher((resultados.itens[ativo] ?? resultados.itens[0]).id);
              } else if (e.key === "Escape") {
                setAberto(false);
              }
            }}
            onBlur={() => setAberto(false)}
            className="min-h-[44px] w-full border border-linha bg-superficie px-3 text-sm text-carvao placeholder:text-mineral focus:outline focus:outline-2 focus:outline-energia"
          />
          {mostrando && (
            <ul id={`${uid}-lista`} role="listbox" aria-label="Municípios encontrados" className="absolute left-0 z-20 mt-0.5 max-h-80 w-full overflow-y-auto border border-linha bg-superficie shadow-sm">
              {resultados.itens.map((m, i) => (
                <li
                  key={m.id}
                  id={`${uid}-op-${i}`}
                  role="option"
                  aria-selected={i === ativo}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    escolher(m.id);
                  }}
                  onMouseEnter={() => setAtivo(i)}
                  className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-3 py-1 text-sm text-carvao ${i === ativo ? "bg-energia-fundo" : ""}`}
                >
                  <span>{m.nome}</span>
                  <span className="text-carvao-muted">{m.uf}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-sm leading-snug text-carvao-muted md:min-w-0 md:flex-1">DEC e FEC dos conjuntos que atendem o município, com o limite de cada um.</p>
      </div>
      <p role="status" aria-live="polite" className={aviso ? "mt-2 text-sm text-carvao-muted" : "sr-only"}>
        {aviso}
      </p>
      {selecionado && (
        <div className="mt-3 space-y-2" data-resposta="municipio-topo" aria-live="polite">
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{resumoMunicipio(selecionado, ano)}</p>
          {orientacao && (
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-orientacao="sem-dado">
              {orientacao}{" "}
              <LinkSemPrefetch href="/setor-eletrico/conta-de-luz" className="text-energia-dark underline underline-offset-4">
                Abrir a Conta de luz
              </LinkSemPrefetch>
              .
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {selecionado.conjuntos.length > 0 && (
              <a href={`#${idFicha}`} className={BOTAO}>
                Ver os conjuntos, o limite de cada um e o histórico
              </a>
            )}
            <button type="button" className={BOTAO} onClick={limpar}>
              Limpar município
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
