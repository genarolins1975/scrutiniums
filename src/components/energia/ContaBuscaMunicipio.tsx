"use client";

import { useId, useMemo, useState } from "react";
import { buscarMunicipios, prepararBuscaMunicipios, type IndiceMunicipios, type MunicipioEncontrado } from "@/lib/energia/conta";

/**
 * Busca da distribuidora pelo município: quem não sabe a sigla da sua distribuidora digita o município e escolhe na lista. O índice
 * (5.571 municípios e as distribuidoras de cada um, pela relação oficial da ANEEL) é um arquivo estático gerado no build
 * (/setor-eletrico/conta-de-luz/municipios.json) e só é baixado quando o leitor foca o campo, para a página não carregar os nomes de
 * todos os municípios. Combobox com lista: setas percorrem, Enter escolhe, Esc fecha; o resultado vai a quem chama (`aoEscolher`), que
 * destaca a distribuidora e diz o que achou.
 */

const URL_INDICE = "/setor-eletrico/conta-de-luz/municipios.json";
let carga: Promise<IndiceMunicipios> | null = null;

function carregar(): Promise<IndiceMunicipios> {
  if (!carga) {
    carga = fetch(URL_INDICE)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<IndiceMunicipios>;
      })
      .catch((e: unknown) => {
        carga = null;
        throw e;
      });
  }
  return carga;
}

type Situacao = "ocioso" | "carregando" | "pronto" | "erro";

export function ContaBuscaMunicipio({ aoEscolher }: { aoEscolher: (m: MunicipioEncontrado) => void }) {
  const uid = useId();
  const [termo, setTermo] = useState("");
  const [indice, setIndice] = useState<IndiceMunicipios | null>(null);
  const [situacao, setSituacao] = useState<Situacao>("ocioso");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  // texto do município escolhido na lista: enquanto o campo mostra esse texto ("Nome (UF)"), não há "nenhum município" a avisar
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const preparado = useMemo(() => (indice ? prepararBuscaMunicipios(indice) : []), [indice]);
  const resultados = useMemo(() => (indice ? buscarMunicipios(indice, preparado, termo) : []), [indice, preparado, termo]);
  const mostrando = aberto && resultados.length > 0;

  const iniciar = () => {
    if (situacao === "carregando" || situacao === "pronto") return;
    setSituacao("carregando");
    carregar()
      .then((i) => {
        setIndice(i);
        setSituacao(i.m.length ? "pronto" : "erro");
      })
      .catch(() => setSituacao("erro"));
  };

  const escolher = (m: MunicipioEncontrado) => {
    const texto = `${m.nome} (${m.uf})`;
    setTermo(texto);
    setEscolhido(texto);
    setAberto(false);
    aoEscolher(m);
  };

  const aviso =
    situacao === "carregando"
      ? "Carregando a lista de municípios."
      : situacao === "erro"
        ? "A lista de municípios não carregou. Escolha a distribuidora na lista ao lado."
        : situacao === "pronto" && termo.trim().length >= 2 && !resultados.length && termo !== escolhido
          ? "Nenhum município com esse nome."
          : "";

  return (
    <div className="relative w-full min-w-0 sm:w-72" data-busca-municipio="">
      <label htmlFor={`${uid}-campo`} className="rotulo block text-mineral">
        Buscar pelo município
      </label>
      <input
        id={`${uid}-campo`}
        type="text"
        role="combobox"
        aria-expanded={mostrando}
        aria-controls={`${uid}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={mostrando ? `${uid}-op-${ativo}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="Digite o nome do município"
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
          if (e.key === "ArrowDown" && resultados.length) {
            e.preventDefault();
            setAberto(true);
            setAtivo((a) => Math.min(a + 1, resultados.length - 1));
          } else if (e.key === "ArrowUp" && resultados.length) {
            e.preventDefault();
            setAtivo((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && mostrando) {
            e.preventDefault();
            escolher(resultados[ativo] ?? resultados[0]);
          } else if (e.key === "Escape") {
            setAberto(false);
          }
        }}
        onBlur={() => setAberto(false)}
        className="mt-1 min-h-[44px] w-full border border-linha bg-superficie px-2 text-sm text-carvao placeholder:text-mineral focus:outline focus:outline-2 focus:outline-energia"
      />
      {mostrando && (
        <ul id={`${uid}-lista`} role="listbox" aria-label="Municípios encontrados" className="absolute left-0 z-20 mt-0.5 w-full border border-linha bg-superficie shadow-sm">
          {resultados.map((m, i) => (
            <li
              key={`${m.nome}|${m.uf}`}
              id={`${uid}-op-${i}`}
              role="option"
              aria-selected={i === ativo}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(m);
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
      <p role="status" aria-live="polite" className={aviso ? "mt-1 text-xs text-carvao-muted" : "sr-only"}>
        {aviso}
      </p>
    </div>
  );
}
