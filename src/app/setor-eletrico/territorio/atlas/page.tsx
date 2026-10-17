import type { Metadata, ResolvingMetadata } from "next";
import { metadadosEnergia } from "@/lib/energia/metadados-idioma";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "@/components/energia/LinkSemPrefetch";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { AtlasInvestimento, type LinhaAtlas } from "@/components/energia/AtlasInvestimento";
import { integra, lerGold } from "@/lib/energia/gold";
import type { ExpansaoGold } from "@/lib/energia/tipos-expansao";
import type { BlocoMmgd } from "@/lib/energia/tipos-transicao";
import type { CamadaGeo } from "@/lib/energia/geo";
import { tx } from "@/lib/energia/idioma";
import s from "@/components/energia/LeiturasIntegradas.module.css";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/territorio/atlas", { title: tx("Atlas da geração e dos projetos por estado", "Atlas of generation and projects by state"), alternates: { canonical: "/setor-eletrico/territorio/atlas" } }, anterior);
}
export default function Atlas() {
  const g = lerGold<ExpansaoGold>("expansao.json");
  const t = lerGold<{ disponivel: boolean; mmgd: BlocoMmgd }>("transicao.json");
  let geo: CamadaGeo | null = null;
  try { geo = JSON.parse(readFileSync(join(process.cwd(), "public/energia/geo/uf.json"), "utf8")); } catch { /* Sem mapa substituto. */ }
  const linhas: LinhaAtlas[] = (geo?.features ?? []).map(f => {
    const m = integra(t) ? t.mmgd.ufs.find(x => x.uf === f.uf) : null;
    return { id: f.id, uf: f.uf, nome: f.nome,
      operacao: integra(g) ? g.capacidade_instalada.por_uf.find(x => x.uf === f.uf)?.mw_fiscalizado ?? null : null,
      construcao: integra(g) ? g.estagios.por_uf.find(x => x.uf === f.uf)?.construcao_mw_outorgado ?? null : null,
      mmgd: m?.potencia_mw ?? null, whab: m?.w_por_habitante ?? null, parcial: (m?.unidades_sem_potencia ?? 0) > 0,
    };
  });
  return <><CabecalhoEnergia atual="territorio" /><main id="conteudo" tabIndex={-1} className="ed-pagina"><header className={s.section}><Link className={s.link} href="/setor-eletrico/territorio">{tx("← Minha região", "← My region")}</Link><p className={s.eyebrow}>{tx("Território · capacidade · expansão", "Territory · capacity · expansion")}</p><h1 className={s.title}>{tx("Onde estão a geração e os novos projetos?", "Where are generation and the new projects?")}</h1><p className={s.intro}>{tx("Compare escala e distribuição territorial. Separe usinas em operação, projetos em construção e geração distribuída antes de interpretar a cor do mapa.", "Compare scale and territorial distribution. Separate plants in operation, projects under construction and distributed generation before interpreting the color of the map.")}</p></header>
    {geo ? <AtlasInvestimento linhas={linhas} geometria={geo} dataSiga={integra(g) ? g.capacidade_instalada.data_referencia : tx("sem período", "no period")} dataMmgd={integra(t) ? t.mmgd.data_cadastro : tx("sem período", "no period")} anoPop={integra(t) ? t.mmgd.ano_populacao : null} /> : <p className={s.bridge}>{tx("A geometria oficial não está disponível nesta publicação. Os módulos de origem continuam acessíveis nos links abaixo.", "The official geometry is not available in this release. The source modules remain accessible through the links below.")}</p>}
    <section className={s.section}><h2 className={s.title}>{tx("Como conferir cada camada?", "How to check each layer?")}</h2><div className={s.grid}><article className={s.panel}><h3>SIGA · ANEEL</h3><p>{tx("Potência fiscalizada para operação; potência outorgada para construção. As contagens e os cronogramas completos estão no módulo Expansão.", "Inspected capacity for operation; granted capacity for construction. The complete counts and schedules are in the Expansion module.")}</p><Link className={s.link} href="/setor-eletrico/expansao">{tx("Dados e ressalvas da expansão →", "Expansion data and caveats →")}</Link><a className={s.link} href="/energia/gold/expansao.json" download>{tx("Baixar base de expansão", "Download the expansion dataset")}</a></article><article className={s.panel}><h3>{tx("MMGD · ANEEL e população IBGE", "MMGD · ANEEL and IBGE population")}</h3><p>{tx("Estoque cadastrado e indicador por habitante já calculados na base de Transição. Há estados com registros de potência ausente; a nota do mapa identifica somas parciais.", "Registered stock and per-inhabitant indicator already calculated in the Transition dataset. Some states have records with missing capacity; the map note identifies partial sums.")}</p><Link className={s.link} href="/setor-eletrico/transicao/mmgd">{tx("Séries, população e mapas municipais →", "Series, population and municipal maps →")}</Link><a className={s.link} href="/energia/gold/transicao.json" download>{tx("Baixar base de transição", "Download the transition dataset")}</a></article></div><p className={s.note}>{tx("Malha territorial: IBGE, com a mesma projeção e simplificação do restante do observatório. As tabelas equivalentes e a busca por região estão no mapa.", "Territorial map: IBGE, with the same projection and simplification as the rest of the observatory. The equivalent tables and the search by region are on the map.")}</p></section>
  </main></>;
}
