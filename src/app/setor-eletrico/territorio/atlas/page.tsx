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
import s from "@/components/energia/LeiturasIntegradas.module.css";

export const dynamic = "force-static";
export async function generateMetadata(_props: unknown, anterior: ResolvingMetadata): Promise<Metadata> {
  return metadadosEnergia("/setor-eletrico/territorio/atlas", { title: "Atlas da geração e dos projetos por estado", alternates: { canonical: "/setor-eletrico/territorio/atlas" } }, anterior);
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
  return <><CabecalhoEnergia atual="territorio" /><main id="conteudo" tabIndex={-1} className="ed-pagina"><header className={s.section}><Link className={s.link} href="/setor-eletrico/territorio">← Minha região</Link><p className={s.eyebrow}>Território · capacidade · expansão</p><h1 className={s.title}>Onde estão a geração e os novos projetos?</h1><p className={s.intro}>Compare escala e distribuição territorial. Separe usinas em operação, projetos em construção e geração distribuída antes de interpretar a cor do mapa.</p></header>
    {geo ? <AtlasInvestimento linhas={linhas} geometria={geo} dataSiga={integra(g) ? g.capacidade_instalada.data_referencia : "sem período"} dataMmgd={integra(t) ? t.mmgd.data_cadastro : "sem período"} anoPop={integra(t) ? t.mmgd.ano_populacao : null} /> : <p className={s.bridge}>A geometria oficial não está disponível nesta publicação. Os módulos de origem continuam acessíveis nos links abaixo.</p>}
    <section className={s.section}><h2 className={s.title}>Como conferir cada camada?</h2><div className={s.grid}><article className={s.panel}><h3>SIGA · ANEEL</h3><p>Potência fiscalizada para operação; potência outorgada para construção. As contagens e os cronogramas completos estão no módulo Expansão.</p><Link className={s.link} href="/setor-eletrico/expansao">Dados e ressalvas da expansão →</Link><a className={s.link} href="/energia/gold/expansao.json" download>Baixar base de expansão</a></article><article className={s.panel}><h3>MMGD · ANEEL e população IBGE</h3><p>Estoque cadastrado e indicador por habitante já calculados na base de Transição. Há estados com registros de potência ausente; a nota do mapa identifica somas parciais.</p><Link className={s.link} href="/setor-eletrico/transicao/mmgd">Séries, população e mapas municipais →</Link><a className={s.link} href="/energia/gold/transicao.json" download>Baixar base de transição</a></article></div><p className={s.note}>Malha territorial: IBGE, com a mesma projeção e simplificação do restante do observatório. As tabelas equivalentes e a busca por região estão no mapa.</p></section>
  </main></>;
}
