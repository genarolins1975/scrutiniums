import {converterEscala,denominador,ESCALA} from '@/lib/contas-publicas/escala';
import {moeda,numero} from '@/lib/contas-publicas/formato';
import {dataFonte} from '@/lib/contas-publicas/dados';

export function FonteEscala({anos}:{anos:number[]}) {
  return <details className="cp-scale-source"><summary>Denominadores e fontes do IBGE</summary>
    {anos.map(ano=>{const d=denominador(ano);return d?<p key={ano}><strong>{ano}:</strong> população estimada em 1º de julho: {numero(d.populacao,0)} pessoas; PIB anual: R$ {numero(d.pibMilhoes,0)} milhões correntes, soma dos quatro trimestres, sem ajuste sazonal.</p>:null;})}
    <p><a href={ESCALA.fontes.populacao.tabela}>IBGE · população, tabela 6579 ↗</a> · <a href={ESCALA.fontes.pib.tabela}>IBGE · PIB, tabela 1846 ↗</a></p>
    <p>Captura: {dataFonte(ESCALA.captura)}. Datas de publicação não identificadas nas respostas da API. Estimativas sujeitas a revisão. Numerador: edição indicada no painel.</p>
    <a href="/contas-publicas/escala.json">Baixar denominadores, trimestres e proveniência · JSON ↓</a>
  </details>;
}

export function EscalaDoAgregado({valorMilhoes,ano,mes=12,titulo,ressalva,saldoMilhoes}:{valorMilhoes:number;ano:number;mes?:number;titulo:string;ressalva:string;saldoMilhoes?:number}) {
  const d=denominador(ano,mes);
  if(!d) return <p className="cp-note cp-scale-unavailable">Escala por habitante e PIB disponível para anos completos de 2024 e 2025. O recorte de {ano} não foi anualizado.</p>;
  return <aside className="cp-human-scale" aria-label={titulo}>
    <div><p className="rotulo cp-eyebrow">O tamanho do valor · {ano}</p><h3>{titulo}</h3><p>Mesmo agregado, duas referências.</p></div>
    <dl><div><dt>Por habitante no ano</dt><dd>{moeda(converterEscala(valorMilhoes,ano,mes,'habitante'),'reais')}</dd></div><div><dt>Em relação ao PIB do ano</dt><dd>{numero(converterEscala(valorMilhoes,ano,mes,'pib'),2)}%</dd></div></dl>
    <div className="cp-scale-explanation">
      {saldoMilhoes!==undefined&&<p><strong>Saldo primário: {numero(converterEscala(saldoMilhoes,ano,mes,'pib'),2)}% do PIB.</strong> Resultado acima da linha; não é a apuração da meta fiscal.</p>}
      <p>{ressalva} O valor por habitante divide o agregado pela população: não é um benefício individual. A razão ao PIB dimensiona o valor; não mede contribuição para a produção ou eficiência.</p>
      <FonteEscala anos={[ano]}/>
    </div>
  </aside>;
}
