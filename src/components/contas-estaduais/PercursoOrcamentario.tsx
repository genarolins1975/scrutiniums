"use client";
import { useState } from 'react';

const etapas = [
  { titulo: 'Planejar', pergunta: 'O que foi autorizado?', palavra: 'Orçamento', descricao: 'A dotação fixa o limite de despesa. Créditos adicionais podem alterar esse limite durante o exercício.', evidencia: 'Compare dotação inicial e atualizada; depois investigue o motivo da revisão.', destino: '#execucao-estadual', link: 'Explorar a execução' },
  { titulo: 'Executar', pergunta: 'Em qual estágio está a despesa?', palavra: 'Execução', descricao: 'Empenhar é assumir uma obrigação. Liquidar é verificar o direito do credor. Pagar é realizar o desembolso.', evidencia: 'Empenho, liquidação e pagamento não são sinônimos. Observe o exercício e os restos a pagar.', destino: '#execucao-estadual', link: 'Conferir os estágios' },
  { titulo: 'Entregar', pergunta: 'O serviço previsto foi entregue?', palavra: 'Eficácia', descricao: 'Compare a entrega observada com a meta física formal, na mesma unidade, no mesmo universo e dentro do prazo.', evidencia: 'Gastar todo o orçamento não prova que todas as metas foram cumpridas.', destino: '#educacao-estadual', link: 'Ver evidências de educação' },
  { titulo: 'Avaliar', pergunta: 'Que resultado chegou à população?', palavra: 'Resultados', descricao: 'Relacione recursos, serviços e resultados com qualidade e contexto comparáveis. Uma associação não demonstra causalidade.', evidencia: 'Eficiência exige recursos por entrega comparável. Efetividade exige examinar resultados e sua atribuição.', destino: '#provas', link: 'Examinar os contextos' },
] as const;

export default function PercursoOrcamentario() {
  const [atual, setAtual] = useState(0);
  const etapa = etapas[atual];
  return <section className="ce-journey" aria-labelledby="ce-journey-title">
    <div className="ce-journey-intro"><p className="rotulo ce-kicker">Guia de leitura / quatro perguntas</p><h2 id="ce-journey-title">O dinheiro percorre etapas.<br/>A análise também.</h2><p>Explore o caminho entre a autorização do gasto e os resultados dos serviços públicos.</p></div>
    <div className="ce-journey-grid"><ol className="ce-journey-steps" aria-label="Etapas da análise">{etapas.map((e, i) => <li key={e.titulo}><button type="button" aria-pressed={atual === i} aria-controls="ce-journey-answer" onClick={() => setAtual(i)}><span className="ce-step-number">0{i + 1}</span><span><strong>{e.titulo}</strong><small>{e.pergunta}</small></span><span aria-hidden="true">↗</span></button></li>)}</ol>
      <div className="ce-journey-answer" id="ce-journey-answer"><p className="rotulo ce-kicker">0{atual + 1} / {etapa.palavra}</p><h3>{etapa.pergunta}</h3><p>{etapa.descricao}</p><div className="ce-journey-evidence"><span>O que procurar na evidência</span><p>{etapa.evidencia}</p></div><a href={etapa.destino}>{etapa.link} ↓</a></div>
    </div><p className="ce-journey-note">Percurso conceitual, não fluxo financeiro medido. Qualidade, equidade e sustentabilidade atravessam todas as etapas.</p>
  </section>;
}
