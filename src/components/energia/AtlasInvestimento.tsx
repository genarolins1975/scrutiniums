"use client";
import Link from "@/components/energia/LinkSemPrefetch";
import { MapaCoropletico } from "./MapaCoropletico";
import { useEstadoUrl } from "./useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { CamadaGeo } from "@/lib/energia/geo";
import { dataBR } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { useIdioma } from "@/lib/energia/useIdioma";
import type { Idioma } from "@/lib/idioma";
import s from "./LeiturasIntegradas.module.css";

export type LinhaAtlas = { id: string; uf: string; nome: string; operacao: number | null; construcao: number | null; mmgd: number | null; whab: number | null; parcial: boolean };
const MEDIDAS = ["operacao", "construcao", "mmgd", "whab"] as const;
type Medida = (typeof MEDIDAS)[number];
/** Medidas do atlas no idioma: título, unidade e nota. */
function medidasAtlas(idioma: Idioma): Record<Medida, { titulo: string; unidade: string; nota: string }> {
  return {
    operacao: {
      titulo: tx("Geração em operação", "Generation in operation", idioma),
      unidade: "MW",
      nota: tx(
        "Potência fiscalizada no SIGA; exclui micro e minigeração distribuída. Local da usina, não destino do consumo.",
        "Inspected capacity in SIGA; excludes distributed micro and mini generation. Location of the plant, not where the energy is consumed.",
        idioma,
      ),
    },
    construcao: {
      titulo: tx("Geração em construção", "Generation under construction", idioma),
      unidade: tx("MW outorgados", "granted MW", idioma),
      nota: tx(
        "Potência outorgada de empreendimentos em construção. Não é capacidade já disponível, investimento em reais ou garantia de entrada em operação.",
        "Granted capacity of projects under construction. It is not capacity already available, investment in reais or a guarantee of entering operation.",
        idioma,
      ),
    },
    mmgd: {
      titulo: tx("Micro e minigeração distribuída", "Distributed micro and mini generation", idioma),
      unidade: tx("MW cadastrados", "registered MW", idioma),
      nota: tx(
        "Estoque de potência cadastrada na ANEEL. Potência cadastrada não é energia gerada ou vendida.",
        "Stock of capacity registered with ANEEL. Registered capacity is not energy generated or sold.",
        idioma,
      ),
    },
    whab: {
      titulo: tx("Geração distribuída por habitante", "Distributed generation per inhabitant", idioma),
      unidade: tx("W/habitante", "W/inhabitant", idioma),
      nota: tx(
        "Potência cadastrada dividida pela população de referência. Não mede acesso à rede, qualidade do serviço ou benefício recebido por cada pessoa.",
        "Registered capacity divided by the reference population. It does not measure grid access, service quality or the benefit received by each person.",
        idioma,
      ),
    },
  };
}
const esquema = { medida: campo(tiposUrl.opcao([...MEDIDAS]), "whab" as Medida), uf: campo(tiposUrl.texto({max:2}), "") };
const cores = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];
const formatar = (x: number | null, idioma: Idioma) =>
  x === null ? tx("Sem dado", "No data", idioma) : x.toLocaleString(tx("pt-BR", "en-US", idioma), { maximumFractionDigits: 1 }); // i18n: dado (locale)

export function AtlasInvestimento({ linhas, geometria, dataSiga, dataMmgd, anoPop }: { linhas: LinhaAtlas[]; geometria: CamadaGeo; dataSiga: string; dataMmgd: string; anoPop: number | null }) {
  const idioma = useIdioma();
  const medidas = medidasAtlas(idioma);
  const n = (x: number | null) => formatar(x, idioma);
  const nomeProprio = idioma === "en" ? { lang: "pt-BR", translate: "no" as const, "data-i18n-nome": "" } : {};
  const [v, definir] = useEstadoUrl(esquema);
  const m = medidas[v.medida];
  const data = v.medida === "mmgd" || v.medida === "whab" ? dataMmgd : dataSiga;
  const valores = Object.fromEntries(linhas.map(x => [x.id, x[v.medida]]));
  const validos = linhas.map(x => x[v.medida]).filter((x): x is number => x !== null && Number.isFinite(x)).sort((a,b) => a-b);
  const mediana = !validos.length ? null : (validos[Math.floor((validos.length-1)/2)] + validos[Math.ceil((validos.length-1)/2)]) / 2;
  const escolhido = linhas.find(x => x.uf === v.uf);
  const parcial = tx("Soma parcial: há unidades com potência ausente", "Partial sum: there are units with missing capacity", idioma);
  return <section className={s.section} aria-labelledby="atlas-investimento-titulo"><h2 className={s.title} id="atlas-investimento-titulo">{tx("A mesma geografia, perguntas diferentes.", "The same geography, different questions.", idioma)}</h2>
    <div className={s.controls}><label>{tx("O que comparar?", "What to compare?", idioma)}<select value={v.medida} onChange={e => definir({ medida: e.target.value as Medida })}>{MEDIDAS.map((k) => <option key={k} value={k}>{medidas[k].titulo}</option>)}</select></label><label>{tx("Estado ou Distrito Federal", "State or Federal District", idioma)}<select value={v.uf} onChange={e => definir({uf:e.target.value})}><option value="">{tx("Todas as UFs", "All states", idioma)}</option>{linhas.map(x => <option key={x.id} value={x.uf} {...nomeProprio}>{x.nome}</option>)}</select></label></div>
    <div className={s.grid}><MapaCoropletico titulo={m.titulo} geometria={geometria} valores={valores} cores={cores} unidade={m.unidade} casas={1} rotulos altura={420} alturaCelular={360} selecionado={escolhido?.id ?? null} onSelecionar={id => definir({uf:linhas.find(x => x.id === id)?.uf ?? ""})} periodo={dataBR(data, idioma)} nota={m.nota} detalheRegiao={id => (v.medida === "mmgd" || v.medida === "whab") && linhas.find(x=>x.id===id)?.parcial ? parcial : null} />
      <div><p className={s.eyebrow}>{escolhido ? <span {...nomeProprio}>{escolhido.nome}</span> : tx("Referência entre UFs", "Reference across states", idioma)}</p><dl className={s.metrics}><div><dt>{escolhido ? tx("Valor selecionado", "Selected value", idioma) : tx("Mediana das UFs", "Median of the states", idioma)}</dt><dd>{n(escolhido ? escolhido[v.medida] : mediana)}</dd><small>{m.unidade} · {dataBR(data, idioma)}</small></div></dl><p className={s.note}>{tx(
        <>Mediana: {n(mediana)} {m.unidade}. Cada UF com dado tem o mesmo peso; {validos.length} de {linhas.length} disponíveis. A mediana descreve a distribuição, não uma meta. Para MMGD, população de referência: {anoPop ?? "não informado"}.</>,
        <>Median: {n(mediana)} {m.unidade}. Each state with data has the same weight; {validos.length} of {linhas.length} available. The median describes the distribution, not a target. For MMGD, reference population: {anoPop ?? "not reported"}.</>,
        idioma,
      )}</p><div className={s.bridge}>{m.nota}</div><p className={s.note}>{tx(
        "As classes de cor são calculadas separadamente para cada medida. Uma mesma cor em duas camadas não representa o mesmo valor. Potência em construção e em operação não deve ser somada como oferta atual.",
        "The color classes are calculated separately for each measure. The same color in two layers does not represent the same value. Capacity under construction and in operation should not be added up as current supply.",
        idioma,
      )}</p><Link className={s.link} href="/setor-eletrico/expansao">{tx("Conferir cronogramas e viabilidade dos projetos →", "Check the schedules and feasibility of the projects →", idioma)}</Link></div>
    </div><div className={s.links}><Link className={s.link} href="/setor-eletrico/perdas#painel-mapa">{tx("Mapa de perdas por distribuidora →", "Map of losses by distribution utility →", idioma)}</Link><Link className={s.link} href="/setor-eletrico/conta-de-luz#tarifa">{tx("Comparar tarifas por distribuidora →", "Compare tariffs by distribution utility →", idioma)}</Link><Link className={s.link} href="/setor-eletrico/qualidade">{tx("Continuidade e limites do serviço →", "Continuity and service limits →", idioma)}</Link><Link className={s.link} href="/setor-eletrico/inclusao-energetica/acesso">{tx("Quem ainda não tem acesso →", "Who still has no access →", idioma)}</Link></div><p className={s.note}>{tx(
      "Tarifas, perdas e continuidade respeitam a unidade da fonte. Uma distribuidora pode atender vários municípios e mais de uma UF: não se atribui sua média a cada residência.",
      "Tariffs, losses and continuity respect the source's unit. A distribution utility can serve several municipalities and more than one state: its average is not attributed to each home.",
      idioma,
    )}</p>
  </section>;
}
