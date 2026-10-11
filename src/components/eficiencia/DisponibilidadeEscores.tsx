import fichas from '../../../pipeline/eficiencia_escores/fichas.json';

const pilares: Record<string, string> = {access: 'Acesso', response: 'Resposta', quality: 'Qualidade'};
const estados: Record<string, string> = {
  COBERTURA_INSUFICIENTE: 'Cobertura insuficiente',
  REFERENCIA_PENDENTE: 'Referência pendente',
};

/** Inventário metodológico; não calcula notas nem atribui diagnóstico nacional a uma cidade. */
export function DisponibilidadeEscores() {
  const referencias = fichas.cards.filter(f => f.reference.validated).length;
  return <section aria-labelledby="disponibilidade-titulo" className="py-6">
    <p className="rotulo text-obee">Da evidência à nota</p>
    <h2 id="disponibilidade-titulo" className="mt-2 font-serif text-2xl">O que falta para calcular o escore?</h2>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-carvao-muted">
      A cesta experimental reúne {fichas.basket.length} capítulos e {fichas.cards.length} componentes.
      {' '}{referencias} de {fichas.cards.length} referências de pontuação estão validadas.
      Este é o diagnóstico da metodologia, não uma avaliação do território selecionado.
      Os demais capítulos continuam disponíveis para exploração, fora desta cesta experimental.
    </p>
    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-carvao-muted">
      Dado publicado, referência validada e nota calculável são etapas diferentes.
      Uma ausência impede o cálculo; não recebe zero e não transfere peso aos outros componentes.
    </p>
    <div className="mt-6 border-t border-linha">
      {fichas.basket.map(chapter => {
        const cards = fichas.cards.filter(f => f.chapter === chapter);
        return <details key={chapter} className="border-b border-linha py-2">
          <summary className="flex min-h-[44px] cursor-pointer flex-wrap items-center justify-between gap-2 py-2 font-serif text-lg">
            <span>{cards[0].chapter_name}</span>
            <span className="font-sans text-sm text-carvao-muted">Ver {cards.length} componentes +</span>
          </summary>
          <div className="grid gap-6 py-4 lg:grid-cols-3">
            {cards.map(card => <article key={card.id} aria-labelledby={'ficha-'+card.id} className="min-w-0 border-t border-linha pt-4">
              <p className="rotulo text-obee">{pilares[card.pillar]}</p>
              <h3 id={'ficha-'+card.id} className="mt-2 font-serif text-xl">{card.indicator_candidate}</h3>
              <p className="mt-2 text-sm font-medium">{estados[card.status] ?? 'Revisão necessária'}</p>
              <dl className="mt-4 space-y-4 text-sm leading-relaxed">
                <div><dt className="font-semibold">Evidência disponível</dt><dd className="mt-1 text-carvao-muted">{card.available_evidence}. {card.available_scope_period}.</dd></div>
                <div><dt className="font-semibold">Por que ainda não pontua</dt><dd><ul className="mt-1 list-disc space-y-2 pl-5 text-carvao-muted">{card.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></dd></div>
                <div><dt className="font-semibold">Próximo passo</dt><dd className="mt-1 text-carvao-muted">{card.next_action}</dd></div>
              </dl>
              <a className="mt-3 inline-flex min-h-[44px] items-center text-sm text-obee underline underline-offset-4" href={'https://github.com/genarolins1975/scrutiniums/blob/'+card.source_commit+'/'+card.source_path}>Documentação da evidência ↗</a>
            </article>)}
          </div>
        </details>;
      })}
    </div>
    <p className="mt-4 max-w-3xl text-xs leading-relaxed text-carvao-muted">Diagnóstico baseado nas evidências publicadas no repositório; não substitui uma nova auditoria das fontes oficiais. Indicadores candidatos e fórmulas ainda dependem de validação metodológica.</p>
  </section>;
}
