import Link from "@/components/energia/LinkSemPrefetch";
import s from "./LeiturasIntegradas.module.css";

export function AtalhoLeitura({ href, titulo, texto }: { href: string; titulo: string; texto: string }) {
  return <aside className={s.jump}><div><strong>{titulo}</strong><p>{texto}</p></div><Link className={s.link} href={href}>Explorar a leitura →</Link></aside>;
}

export function LeiturasIntegradas() {
  return <section id="leituras-integradas" className={s.section} aria-labelledby="leituras-integradas-titulo"><p className={s.eyebrow}>Conecte os temas</p><h2 id="leituras-integradas-titulo" className={s.title}>Das perguntas simples às análises completas.</h2><div className={s.questions}>
    <article className={s.question}><span className={s.status}>Empresas e controle</span><h3>Quem é dono e onde ganha dinheiro?</h3><p>Cruze estrutura societária, lucro, caixa e dívida. Estudos com fontes primárias mostram investimento e resultado por segmento.</p><Link className={s.link} href="/setor-eletrico/empresas/analise">Ler as empresas por dentro →</Link></article>
    <article className={s.question}><span className={s.status}>Mapas e investimento</span><h3>Onde estão os ativos e os projetos?</h3><p>Compare geração em operação, construção e geração distribuída. Alterne escala total e potência por habitante com a referência entre estados.</p><Link className={s.link} href="/setor-eletrico/territorio/atlas">Explorar o atlas →</Link></article>
    <article className={s.question}><span className={s.status}>Riscos e transformação</span><h3>O que muda com clima e novas tecnologias?</h3><p>Entenda curtailment, data centers, baterias e descentralização. Experimente cenários e veja quais evidências permitem avaliar o impacto econômico.</p><Link className={s.link} href="/setor-eletrico/transicao/riscos">Explorar riscos e laboratórios →</Link></article>
  </div></section>;
}
