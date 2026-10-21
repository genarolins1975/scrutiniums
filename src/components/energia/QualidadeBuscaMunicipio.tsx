"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import LinkSemPrefetch from "@/components/energia/LinkSemPrefetch";
import { QualidadeConjuntosDoMunicipio } from "@/components/energia/QualidadeConjuntosDoMunicipio";
import { Nome } from "@/components/i18n/Nome";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { buscarRegioes } from "@/lib/energia/mapa-coropletico";
import { num } from "@/lib/energia/formato";
import {
  CAMPO_MUN,
  ROTA_COMPARAR_DISTRIBUIDORAS,
  carregarMunicipios,
  horasEMinutos,
  notaValoresMunicipio,
  orientacaoSemDado,
  regiaoDoMunicipio,
  resumoMunicipio,
  type MunicipioQualidade,
} from "@/lib/energia/qualidade";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";

/**
 * Busca do município, a primeira ação da entrada de Qualidade (diagnóstico de layout de 20/10/2026, item 6). Quem chega aqui quer saber
 * da própria cidade: o campo fica logo abaixo do título, e a resposta vem antes dos números do Brasil. Ela diz quanto tempo e quantas
 * vezes faltou luz nos conjuntos que atendem o município (DEC e FEC, do menor ao maior deles, nunca uma média municipal), com o Brasil do
 * mesmo ano ao lado, a tabela de conjuntos com o limite de cada um e os dois caminhos: comparar a distribuidora com as outras (página
 * própria, com a escolha em `?dist=`) e ver o município no mapa, com o histórico da distribuidora. O `?mun=` é o mesmo do mapa e da tabela.
 * A lista de municípios (o CSV que o mapa também usa, 600 KB) só é baixada quando o campo recebe o foco, ou na hora, quando o link já
 * traz um município. Combobox com lista: setas percorrem, Enter escolhe, Esc fecha.
 */

const ESQUEMA = { mun: CAMPO_MUN };
const LIMITE_LISTA = 8;

type Carga = { estado: "parado" } | { estado: "carregando" } | { estado: "pronto"; municipios: MunicipioQualidade[] } | { estado: "erro"; erro: string };

const BOTAO =
  "inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia focus:outline-none focus-visible:ring-2 focus-visible:ring-energia";

export function QualidadeBuscaMunicipio({
  ano,
  urlMunicipios,
  idMapa = "mapa-municipios",
  brasil = null,
  distribuidoras = [],
  fonteConjuntos = "ANEEL",
  tamanhoConjuntos,
}: {
  ano: number;
  urlMunicipios: string;
  /** `id` da seção do mapa: o botão leva ao mapa, com o município aceso e, logo abaixo dele, o histórico da distribuidora. */
  idMapa?: string;
  /** DEC e FEC do Brasil, ao lado da resposta só quando o ano é o mesmo do mapa. */
  brasil?: { ano: number; dec: number | null; fec: number | null } | null;
  /** Nome de exibição de cada distribuidora, pelo CNPJ. */
  distribuidoras?: { cnpj: string; rotulo: string }[];
  fonteConjuntos?: string;
  tamanhoConjuntos?: string;
}) {
  const uid = useId();
  const idioma = useIdioma();
  const tx = useTx();
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
      ? tx("Carregando a lista de municípios.", "Loading the list of municipalities.")
      : carga.estado === "erro"
        ? tx(
            `A lista de municípios não carregou (${carga.erro}). Use o mapa ou a tabela mais abaixo.`,
            `The list of municipalities did not load (${carga.erro}). Use the map or the table further down.`,
          )
        : carga.estado === "pronto" && termo.trim().length >= 2 && !resultados.total && termo !== escolhido
          ? tx("Nenhum município com esse nome.", "No municipality with that name.")
          : "";
  const orientacao = selecionado ? orientacaoSemDado(selecionado, idioma) : "";

  const nomes = new Map(distribuidoras.map((d) => [d.cnpj, d.rotulo]));
  const brasilDoAno = brasil && brasil.ano === ano ? brasil : null;
  const n2 = (x: number | null) => num(x, 2, idioma);
  const intervalo = (a: string, b: string) => (a === b ? b : tx(`de ${a} a ${b}`, `from ${a} to ${b}`));
  const cnpjsSel = selecionado ? selecionado.cnpjs.slice(0, LIMITE_COMPARACAO) : [];
  const temValor = !!selecionado && selecionado.dec_max !== null;

  return (
    <section aria-labelledby={`${uid}-titulo`} id="busca-municipio" data-busca-municipio-topo="" className="scroll-mt-28 border-y border-linha py-4">
      <label id={`${uid}-titulo`} htmlFor={`${uid}-campo`} className="block font-serif text-xl leading-snug text-carvao sm:text-2xl">
        {tx("Como foi no seu município?", "How was it in your municipality?")}
      </label>
      <p className="mt-1 max-w-prose2 text-sm leading-snug text-carvao-muted">
        {tx(
          `Quanto tempo e quantas vezes faltou luz em ${ano} nos conjuntos elétricos que atendem o município, com o limite de cada um.`,
          `How long and how often the power was cut in ${ano} in the consumer sets serving the municipality, with the limit of each one.`,
        )}
      </p>
      <div className="relative mt-3 w-full min-w-0 md:max-w-md">
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
          placeholder={tx("Digite o nome, por exemplo Caxias do Sul", "Type the name, for example Caxias do Sul")}
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
          className="min-h-[48px] w-full border border-carvao-muted bg-superficie px-3 text-base text-carvao placeholder:text-mineral focus:outline focus:outline-2 focus:outline-energia"
        />
        {mostrando && (
          <ul id={`${uid}-lista`} role="listbox" aria-label={tx("Municípios encontrados", "Municipalities found")} className="absolute left-0 z-20 mt-0.5 max-h-80 w-full overflow-y-auto border border-linha bg-superficie shadow-sm">
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
                <span>
                  <Nome>{m.nome}</Nome>
                </span>
                <span className="text-carvao-muted">{m.uf}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p role="status" aria-live="polite" className={aviso ? "mt-2 text-sm text-carvao-muted" : "sr-only"}>
        {aviso}
      </p>
      {selecionado && (
        <div className="mt-5 space-y-4" data-resposta="municipio-topo" aria-live="polite">
          <h2 className="font-serif text-2xl leading-tight text-carvao">
            <Nome>{selecionado.nome}</Nome> ({selecionado.uf}), {ano}
          </h2>
          {temValor ? (
            <>
              <dl className="grid max-w-4xl gap-x-10 gap-y-5 md:grid-cols-2" data-numeros="municipio">
                <div>
                  <dt className="text-sm leading-snug text-carvao-muted">
                    {tx("Tempo sem luz no ano, em média por unidade consumidora (DEC)", "Time without power in the year, on average per consumer unit (DEC)")}
                  </dt>
                  <dd className="mt-1.5 font-serif text-[1.625rem] leading-tight tabular-nums text-carvao lg:text-[1.875rem]">
                    {intervalo(horasEMinutos(selecionado.dec_min, idioma), horasEMinutos(selecionado.dec_max, idioma))}
                  </dd>
                  {brasilDoAno && brasilDoAno.dec !== null && (
                    <dd className="mt-1 text-sm text-carvao-muted">{tx(`Brasil em ${ano}: ${horasEMinutos(brasilDoAno.dec, idioma)}`, `Brazil in ${ano}: ${horasEMinutos(brasilDoAno.dec, idioma)}`)}</dd>
                  )}
                </div>
                <div>
                  <dt className="text-sm leading-snug text-carvao-muted">
                    {tx("Vezes que a luz faltou no ano, em média, por 3 minutos ou mais (FEC)", "Times the power went out in the year, on average, for 3 minutes or more (FEC)")}
                  </dt>
                  <dd className="mt-1.5 font-serif text-[1.625rem] leading-tight tabular-nums text-carvao lg:text-[1.875rem]">
                    {selecionado.fec_max === null ? tx("sem dado", "no data") : tx(`${intervalo(n2(selecionado.fec_min), n2(selecionado.fec_max))} vezes`, `${intervalo(n2(selecionado.fec_min), n2(selecionado.fec_max))} times`)}
                  </dd>
                  {brasilDoAno && brasilDoAno.fec !== null && (
                    <dd className="mt-1 text-sm text-carvao-muted">{tx(`Brasil em ${ano}: ${n2(brasilDoAno.fec)} vezes`, `Brazil in ${ano}: ${n2(brasilDoAno.fec)} times`)}</dd>
                  )}
                </div>
              </dl>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-nota="valores-municipio">
                {notaValoresMunicipio(selecionado, idioma)}
              </p>
            </>
          ) : (
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao">{resumoMunicipio(selecionado, ano, idioma)}</p>
          )}
          {orientacao && (
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-orientacao="sem-dado">
              {orientacao}{" "}
              <LinkSemPrefetch href="/setor-eletrico/conta-de-luz" className="text-energia-dark underline underline-offset-4">
                {tx("Abrir a Conta de luz", "Open the Electricity bill page")}
              </LinkSemPrefetch>
              .
            </p>
          )}
          {selecionado.cnpjs.length > 0 && (
            <p className="text-sm text-carvao">
              <span className="text-carvao-muted">{selecionado.cnpjs.length === 1 ? tx("Distribuidora: ", "Distribution utility: ") : tx("Distribuidoras: ", "Distribution utilities: ")}</span>
              {selecionado.cnpjs.map((c) => nomes.get(c) ?? `CNPJ ${c}`).join(", ")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {cnpjsSel.length > 0 && (
              <LinkSemPrefetch href={`${ROTA_COMPARAR_DISTRIBUIDORAS}?dist=${cnpjsSel.join(",")}#comparar-distribuidoras`} className={BOTAO} data-comparar-distribuidoras="">
                {cnpjsSel.length === 1
                  ? tx("Comparar esta distribuidora com as outras", "Compare this distribution utility with the others")
                  : tx("Comparar estas distribuidoras com as outras", "Compare these distribution utilities with the others")}
              </LinkSemPrefetch>
            )}
            {selecionado.cnpjs.length > 0 && (
              <a href={`#${idMapa}`} className={BOTAO}>
                {tx("Ver no mapa, com o histórico da distribuidora", "See it on the map, with the distribution utility's history")}
              </a>
            )}
            <button type="button" className={BOTAO} onClick={limpar}>
              {tx("Limpar município", "Clear municipality")}
            </button>
          </div>
          <QualidadeConjuntosDoMunicipio
            ano={ano}
            codigoMunicipio={selecionado.cod}
            municipio={`${selecionado.nome} (${selecionado.uf})`}
            codigos={selecionado.conjuntos}
            fonte={fonteConjuntos}
            tamanho={tamanhoConjuntos}
            nivelTitulo={3}
          />
        </div>
      )}
    </section>
  );
}
