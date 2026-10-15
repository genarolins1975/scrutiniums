"use client";
import Link from "@/components/energia/LinkSemPrefetch";
import { formatadorNumero } from "@/lib/format";
import type { Idioma } from "@/lib/idioma";
import { MapaCoropletico } from "./MapaCoropletico";
import { useEstadoUrl } from "./useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { CamadaGeo } from "@/lib/energia/geo";
import { dataBR } from "@/lib/energia/formato";
import s from "./LeiturasIntegradas.module.css";

export type LinhaAtlas = { id: string; uf: string; nome: string; operacao: number | null; construcao: number | null; mmgd: number | null; whab: number | null; parcial: boolean };
const medidas = {
  operacao: { titulo: "Geração em operação", unidade: "MW", nota: "Potência fiscalizada no SIGA; exclui micro e minigeração distribuída. Local da usina, não destino do consumo." },
  construcao: { titulo: "Geração em construção", unidade: "MW outorgados", nota: "Potência outorgada de empreendimentos em construção. Não é capacidade já disponível, investimento em reais ou garantia de entrada em operação." },
  mmgd: { titulo: "Micro e minigeração distribuída", unidade: "MW cadastrados", nota: "Estoque de potência cadastrada na ANEEL. Potência cadastrada não é energia gerada ou vendida." },
  whab: { titulo: "Geração distribuída por habitante", unidade: "W/habitante", nota: "Potência cadastrada dividida pela população de referência. Não mede acesso à rede, qualidade do serviço ou benefício recebido por cada pessoa." },
} as const;
type Medida = keyof typeof medidas;
const esquema = { medida: campo(tiposUrl.opcao(Object.keys(medidas) as Medida[]), "whab" as Medida), uf: campo(tiposUrl.texto({max:2}), "") };
const cores = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

export function AtlasInvestimento({ linhas, geometria, dataSiga, dataMmgd, anoPop, idioma = "pt" }: { linhas: LinhaAtlas[]; geometria: CamadaGeo; dataSiga: string; dataMmgd: string; anoPop: number | null; idioma?: Idioma }) {
  const n = (x: number | null) => x === null ? "Sem dado" : formatadorNumero(idioma, { maximumFractionDigits: 1 }).format(x);
  const [v, definir] = useEstadoUrl(esquema);
  const m = medidas[v.medida];
  const data = v.medida === "mmgd" || v.medida === "whab" ? dataMmgd : dataSiga;
  const valores = Object.fromEntries(linhas.map(x => [x.id, x[v.medida]]));
  const validos = linhas.map(x => x[v.medida]).filter((x): x is number => x !== null && Number.isFinite(x)).sort((a,b) => a-b);
  const mediana = !validos.length ? null : (validos[Math.floor((validos.length-1)/2)] + validos[Math.ceil((validos.length-1)/2)]) / 2;
  const escolhido = linhas.find(x => x.uf === v.uf);
  return <section className={s.section} aria-labelledby="atlas-investimento-titulo"><h2 className={s.title} id="atlas-investimento-titulo">A mesma geografia, perguntas diferentes.</h2>
    <div className={s.controls}><label>O que comparar?<select value={v.medida} onChange={e => definir({ medida: e.target.value as Medida })}>{Object.entries(medidas).map(([k,x]) => <option key={k} value={k}>{x.titulo}</option>)}</select></label><label>Estado ou Distrito Federal<select value={v.uf} onChange={e => definir({uf:e.target.value})}><option value="">Todas as UFs</option>{linhas.map(x => <option key={x.id} value={x.uf}>{x.nome}</option>)}</select></label></div>
    <div className={s.grid}><MapaCoropletico titulo={m.titulo} geometria={geometria} valores={valores} cores={cores} unidade={m.unidade} casas={1} rotulos altura={420} alturaCelular={360} selecionado={escolhido?.id ?? null} onSelecionar={id => definir({uf:linhas.find(x => x.id === id)?.uf ?? ""})} periodo={dataBR(data)} nota={m.nota} detalheRegiao={id => (v.medida === "mmgd" || v.medida === "whab") && linhas.find(x=>x.id===id)?.parcial ? "Soma parcial: há unidades com potência ausente" : null} />
      <div><p className={s.eyebrow}>{escolhido?.nome ?? "Referência entre UFs"}</p><dl className={s.metrics}><div><dt>{escolhido ? "Valor selecionado" : "Mediana das UFs"}</dt><dd>{n(escolhido ? escolhido[v.medida] : mediana)}</dd><small>{m.unidade} · {dataBR(data)}</small></div></dl><p className={s.note}>Mediana: {n(mediana)} {m.unidade}. Cada UF com dado tem o mesmo peso; {validos.length} de {linhas.length} disponíveis. A mediana descreve a distribuição, não uma meta. Para MMGD, população de referência: {anoPop ?? "não informado"}.</p><div className={s.bridge}>{m.nota}</div><p className={s.note}>As classes de cor são calculadas separadamente para cada medida. Uma mesma cor em duas camadas não representa o mesmo valor. Potência em construção e em operação não deve ser somada como oferta atual.</p><Link className={s.link} href="/setor-eletrico/expansao">Conferir cronogramas e viabilidade dos projetos →</Link></div>
    </div><div className={s.links}><Link className={s.link} href="/setor-eletrico/perdas#painel-mapa">Mapa de perdas por distribuidora →</Link><Link className={s.link} href="/setor-eletrico/conta-de-luz#tarifa">Comparar tarifas por distribuidora →</Link><Link className={s.link} href="/setor-eletrico/qualidade">Continuidade e limites do serviço →</Link><Link className={s.link} href="/setor-eletrico/inclusao-energetica/acesso">Quem ainda não tem acesso →</Link></div><p className={s.note}>Tarifas, perdas e continuidade respeitam a unidade da fonte. Uma distribuidora pode atender vários municípios e mais de uma UF: não se atribui sua média a cada residência.</p>
  </section>;
}
