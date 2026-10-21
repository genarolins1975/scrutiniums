import s from './Agro.module.css';

/** Exemplos de mecanismo sem estatísticas ou valores fictícios. */
export function FiguraGlossarioAgro() {
  return <figure className={s.mechanism}>
    <figcaption><p className={s.eyebrow}>Explicação conceitual</p><h2 className={s.blockTitle}>Três contas. Três perguntas.</h2></figcaption>
    <div className={s.conceptGrid}>
      <article><h3>Quanto foi vendido?</h3><p className={s.formula}>Quantidade vendida × preço<span style={{display:'block'}} aria-hidden="true">↓</span><strong>Receita bruta</strong></p><p className={s.note}>Por exemplo, a venda de grãos gera receita. Isso ainda não subtrai os custos da atividade.</p></article>
      <article><h3>O que sobra no escopo?</h3><p className={s.formula}>Receita − custos incluídos<span style={{display:'block'}} aria-hidden="true">↓</span><strong>Margem do escopo</strong></p><p className={s.note}>Custos variáveis, operacionais e econômicos têm perímetros diferentes. Uma margem não é automaticamente lucro líquido.</p></article>
      <article><h3>Quando o dinheiro entra?</h3><p className={s.formula}>Recebimentos − desembolsos<span style={{display:'block'}} aria-hidden="true">↓</span><strong>Fluxo de caixa</strong></p><p className={s.note}>Receber uma venda depois de pagar os insumos muda o caixa de cada mês, mesmo sem mudar a margem calculada.</p></article>
    </div>
    <p className={s.note}>Mesma unidade e período são necessários em cada conta. Os exemplos explicam os conceitos; não medem resultado de uma propriedade.</p>
  </figure>;
}
