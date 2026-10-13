import type { Metadata } from "next";
import Link from "@/components/energia/LinkSemPrefetch";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { DuasCamadasEnergia, LaboratorioContratos } from "@/components/energia/ComercializacaoDidatica";
import s from "@/components/energia/LeiturasIntegradas.module.css";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Comercialização: da energia física ao resultado financeiro", alternates: { canonical: "/setor-eletrico/mercado/comercializacao" } };
export default function Comercializacao() {
  return <><CabecalhoEnergia atual="mercado" /><main id="conteudo" tabIndex={-1} className="ed-pagina">
    <header className={s.section}><Link className={s.link} href="/setor-eletrico/mercado">← Mercado de energia</Link><p className={s.eyebrow}>Entender → experimentar → conferir</p><h1 className={s.title}>Quem entrega energia, quem vende e quem assume o risco?</h1><p className={s.intro}>A operação física e os compromissos comerciais se encontram na medição e na contabilização. Entenda essa ligação antes de comparar preços ou resultados das empresas.</p></header>
    <DuasCamadasEnergia /><LaboratorioContratos />
    <section className={s.section} aria-labelledby="custos-distintos"><h2 id="custos-distintos" className={s.title}>Três preços, três perguntas.</h2><div className={s.triple}>
      <article className={s.panel}><h3>Preço do contrato</h3><p>Quanto foi pactuado para comprar ou vender energia? Prazo, volume, flexibilidade, sazonalização, modulação e garantias mudam a exposição.</p></article>
      <article className={s.panel}><h3>PLD</h3><p>A que preço as diferenças são valoradas no mercado de curto prazo? Cada hora e submercado tem sua referência. O preço de um contrato não pode ser deduzido do PLD.</p></article>
      <article className={s.panel}><h3>Tarifa e fatura</h3><p>Quanto custa o serviço ao consumidor? A fatura depende de energia, uso da rede e componentes aplicáveis. Consumidores livres continuam usando e remunerando a rede.</p><Link className={s.link} href="/setor-eletrico/conta-de-luz">Abrir a conta de luz →</Link></article>
    </div></section>
    <section className={s.section}><h2 className={s.title}>Onde aparecem os riscos?</h2><div className={s.grid}>
      <article className={s.topic}><h3>Volume, perfil e submercado</h3><p>Produzir ou consumir menos do que o contratado muda a posição. Mesmo com volumes totais iguais, diferenças horárias e de submercado podem gerar exposição. O MRE altera a energia alocada a participantes; geração própria e energia contabilizada não são sempre iguais.</p><Link className={s.link} href="/setor-eletrico/mercado/mre-e-gsf">Entender o compartilhamento hidrológico →</Link></article>
      <article className={s.topic}><h3>Contraparte e liquidez</h3><p>Uma empresa pode ter posição econômica protegida e ainda precisar de caixa para garantias ou descasamentos de pagamento. Receita, volume negociado e número de clientes não medem sozinhos solvência.</p><Link className={s.link} href="/setor-eletrico/empresas/analise">Ler resultado, caixa e dívida em conjunto →</Link></article>
    </div><div className={s.sources}><p>Base conceitual: <a href="https://www.ccee.org.br/glossario-da-energia">Glossário da CCEE</a> e <a href="https://www.ccee.org.br/mercado/regras-de-comercializacao">Regras de Comercialização — medição, contratos e balanço energético</a>. Consulte a versão vigente no período analisado.</p></div></section>
  </main></>;
}
