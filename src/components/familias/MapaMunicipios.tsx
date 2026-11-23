"use client";

import { useEffect, useMemo, useState } from "react";
import { MapaCoropletico } from "@/components/energia/MapaCoropletico";
import { URL_GEO, caixaDeFeatures, comFolga, textoViewBox, validaCamada, type CamadaGeo } from "@/lib/energia/geo";
import { quebrasQuantis, type ValorClassificavel } from "@/lib/painel/escalas";

/** Cinco classes, da menor para a maior: a rampa sequencial da plataforma (fria) e a do bronze (quente), só por token. */
const RAMPAS = {
  fria: [1, 2, 3, 4, 5].map((i) => `var(--escala-seq-${i})`),
  quente: [14, 32, 52, 74, 96].map((p) => `color-mix(in srgb, var(--cor-bronze) ${p}%, var(--cor-superficie))`),
} as const;
/** "Não se aplica" na rampa quente: cinza frio, para não se confundir com as classes claras do bronze (o padrão do mapa é um bege). */
const NAO_SE_APLICA_QUENTE = "color-mix(in srgb, var(--cor-mineral) 38%, var(--cor-superficie))";

let malha: Promise<CamadaGeo> | null = null;
/** A malha municipal do IBGE (1,3 MB) é pedida uma vez por página e só quando um mapa aparece; falha não fica em cache. */
function carregarMalha(): Promise<CamadaGeo> {
  malha ??= fetch(URL_GEO.municipios)
    .then(async (r) => {
      if (!r.ok) throw new Error("malha indisponível");
      const j: unknown = await r.json();
      if (validaCamada(j).length) throw new Error("malha inválida");
      return j as CamadaGeo;
    })
    .catch((e) => {
      malha = null;
      throw e;
    });
  return malha;
}

export type MapaMunicipiosProps = {
  titulo: string;
  /** Códigos IBGE dos municípios do recorte: o mapa desenha só eles e se ajusta ao conjunto (uma região, por exemplo). */
  ids: readonly string[];
  /** O recorte é o país: a malha entra inteira, e município da malha que a publicação não traz fica em hachura (sem dado), não em branco. */
  paisInteiro?: boolean;
  /** Valor por código: número (zero inclusive), null = sem dado (hachura), NAO_SE_APLICA = cinza liso. */
  valores: Readonly<Record<string, ValorClassificavel>>;
  unidade: string;
  casas: number;
  periodo: string;
  nota?: string;
  paleta?: keyof typeof RAMPAS;
  selecionado: string | null;
  onSelecionar: (id: string | null) => void;
  detalheRegiao?: (id: string) => string | null | undefined;
  /** Muda quando o recorte muda de território, para o mapa voltar ao enquadramento inteiro. */
  chave: string;
};

/**
 * Mapa municipal dos painéis das Famílias (consignado e crédito imobiliário) sobre o mapa coroplético da plataforma: malha oficial do
 * IBGE, cinco classes por quantis com o método escrito na legenda, hachura para município sem dado (nunca zero) e cinza liso para
 * "não se aplica". A busca por nome, o teclado, a aproximação e a dica são os do componente comum. Substitui o sombreado contínuo entre
 * os percentis 5 e 95 das vistas antigas (public/obs/app.js, penEscala e cgEscala): mesma finalidade, com classes que o leitor consegue
 * nomear. A altura é reservada antes da carga, para a página não saltar.
 */
export function MapaMunicipios({ titulo, ids, valores, unidade, casas, periodo, nota, paleta = "fria", selecionado, onSelecionar, detalheRegiao, chave, paisInteiro = false }: MapaMunicipiosProps) {
  const [geo, setGeo] = useState<CamadaGeo | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    carregarMalha().then(
      (g) => vivo && setGeo(g),
      () => vivo && setErro(true),
    );
    return () => {
      vivo = false;
    };
  }, []);

  const geometria = useMemo(() => {
    if (!geo) return null;
    if (paisInteiro) return geo;
    const dentro = new Set(ids);
    const features = geo.features.filter((f) => dentro.has(f.id));
    const caixa = caixaDeFeatures(features);
    if (!caixa) return geo;
    const ufs = new Set(features.map((f) => f.uf));
    return { ...geo, features, viewBox: textoViewBox(comFolga(caixa)), contornos: { uf: geo.contornos?.uf.filter((c) => ufs.has(c.uf)) ?? [] }, contagem: { ...geo.contagem, features: features.length } };
  }, [geo, ids, paisInteiro]);
  const classificacao = useMemo(() => quebrasQuantis((geometria?.features ?? []).map((f) => valores[f.id]), 5, { casas }), [geometria, valores, casas]);

  // município da malha oficial que a publicação não traz (criado depois do Censo, por exemplo): fica em hachura e a nota diz quantos são
  const foraDaPublicacao = geometria ? geometria.features.filter((f) => !(f.id in valores)).length : 0;
  const notaCompleta = [nota, foraDaPublicacao > 0 ? `A malha do IBGE traz ${foraDaPublicacao === 1 ? "1 município que esta publicação não tem; ele fica" : `${foraDaPublicacao} municípios que esta publicação não tem; eles ficam`} em hachura, como sem dado.` : null].filter(Boolean).join(" ");

  return (
    <div data-grafico="mapa-municipios" data-mapa-municipios={geometria ? "pronto" : erro ? "erro" : "carregando"} className="min-w-0">
      {geometria ? (
        <MapaCoropletico
          key={chave}
          titulo={titulo}
          geometria={geometria}
          valores={valores}
          cores={RAMPAS[paleta]}
          corNaoSeAplica={paleta === "quente" ? NAO_SE_APLICA_QUENTE : undefined}
          classificacao={classificacao}
          unidade={unidade}
          casas={casas}
          periodo={periodo}
          nota={notaCompleta || undefined}
          selecionado={selecionado}
          onSelecionar={onSelecionar}
          detalheRegiao={detalheRegiao}
          semTabela
          contornos
          altura={560}
          alturaCelular={400}
        />
      ) : (
        <p role="status" className="t-meta flex min-h-[400px] items-center border border-linha bg-superficie p-5 text-carvao sm:min-h-[560px]">
          {erro ? "A malha municipal não pôde ser carregada. A lista e a tabela trazem os mesmos municípios e valores." : "Carregando a malha municipal do IBGE…"}
        </p>
      )}
    </div>
  );
}
