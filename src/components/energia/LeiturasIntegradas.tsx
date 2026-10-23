import Link from "@/components/energia/LinkSemPrefetch";
import { tx } from "@/lib/energia/idioma";
import s from "./LeiturasIntegradas.module.css";

export function AtalhoLeitura({ href, titulo, texto }: { href: string; titulo: string; texto: string }) {
  return <aside className={s.jump}><div><strong>{titulo}</strong><p>{texto}</p></div><Link className={s.link} href={href}>{tx("Explorar a leitura →","Explore the analysis →")}</Link></aside>;
}

export function LeiturasIntegradas() {
  return <section id="leituras-integradas" className={s.section} aria-labelledby="leituras-integradas-titulo"><p className={`rotulo ${s.eyebrow}`}>{tx("Conecte os temas","Connect the themes")}</p><h2 id="leituras-integradas-titulo" className={s.title}>{tx("Das perguntas simples às análises completas.","From simple questions to complete analyses.")}</h2><div className={s.questions}>
    <article className={s.question}><span className={s.status}>{tx("Empresas e controle","Companies and control")}</span><h3>{tx("Quem é dono e onde ganha dinheiro?","Who owns what, and where is the money made?")}</h3><p>{tx("Cruze estrutura societária, lucro, caixa e dívida. Estudos com fontes primárias mostram investimento e resultado por segmento.","Cross-reference ownership structure, profit, cash and debt. Studies based on primary sources show investment and results by segment.")}</p><Link className={s.link} href="/setor-eletrico/empresas/analise">{tx("Ler as empresas por dentro →","Look inside the companies →")}</Link></article>
    <article className={s.question}><span className={s.status}>{tx("Mapas e investimento","Maps and investment")}</span><h3>{tx("Onde estão os ativos e os projetos?","Where are the assets and the projects?")}</h3><p>{tx("Compare geração em operação, construção e geração distribuída. Alterne escala total e potência por habitante com a referência entre estados.","Compare generation in operation, under construction and distributed generation. Switch between total scale and capacity per inhabitant, with the reference across states.")}</p><Link className={s.link} href="/setor-eletrico/territorio/atlas">{tx("Explorar o atlas →","Explore the atlas →")}</Link></article>
    <article className={s.question}><span className={s.status}>{tx("Riscos e transformação","Risks and transformation")}</span><h3>{tx("O que muda com clima e novas tecnologias?","What changes with climate and new technologies?")}</h3><p>{tx("Entenda curtailment, data centers, baterias e descentralização. Experimente cenários e veja quais evidências permitem avaliar o impacto econômico.","Understand curtailment, data centers, batteries and decentralization. Try scenarios and see which evidence allows the economic impact to be assessed.")}</p><Link className={s.link} href="/setor-eletrico/transicao/riscos">{tx("Explorar riscos e laboratórios →","Explore risks and labs →")}</Link></article>
  </div></section>;
}
