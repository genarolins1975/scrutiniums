# Maquete visual da inicial de Crédito

> Registro histórico: as artes abaixo foram substituídas pela [harmonização em gravura editorial de 13/10/2026](../observatorios/HARMONIZACAO_FIGURAS.md).
Direção aprovada pelo proprietário em 11/10/2026, após a publicação da inicial do setor elétrico. Escopo: página Mapa do Observatório. Preserva menu lateral, sete etapas, rotas, catálogo, trilhas, fontes, definições e cálculos.

## Arte

Duas ilustrações conceituais geradas por IA, sem dados incorporados. Produção com gerador integrado; conversão WebP qualidade 84 via Sharp, sem dependência de aplicação adicionada.

- `public/obs/arte/economia-v1.webp`: 1774 × 887, 232.276 bytes. Prompt: maquete arquitetônica de instituições, moradias, comércio e indústria brasileira, fundo marfim com espaço superior esquerdo para título HTML, luz natural, sem texto, logos, números ou gráficos.
- `public/obs/arte/etapas-v1.webp`: 1774 × 887, 159.140 bytes. Prompt: oito miniaturas em grade 4 × 2, fundo petróleo: documentos de captação, banco, contrato, moradias/comércio, calendário/lupa, documentos e negociação, regras, carteira de pastas em vidro. Sem valores ou textos. A grade é exibida em recortes CSS, sem editar a ilustração.

Total 391.416 bytes. Arte secundária reutilizada; nenhuma fonte ou biblioteca visual adicionada. A interface informa que a arte é conceitual e gerada por IA.

## Comportamento

- Maquete seleciona etapa e move foco para seu botão. Instituições abre etapa 2; demais recortes da economia abrem Pessoas e territórios, etapa 4.
- Sete botões nativos, seleção por toque, Tab/Enter e setas, Home/End; todos os links originais preservados.
- Conceitos detalhados em expansão nativa; ressalva didática e ausência de proporções visíveis.
- Dados derivados dos mesmos metadados; nenhuma modificação na gold. Laboratório mantém equação, escalas fixas, referência e limites originais.
- Desktop: quatro artefatos na primeira linha e três centralizados na segunda. Mobile: duas colunas, pontos de navegação abaixo da maquete.
- Navegação lateral existente preservada para continuidade nas 41 páginas, em vez de duplicá-la num novo menu horizontal.

## Validação

52 testes das três suítes de crédito/integração pública passaram. Syntax check e diff check passaram. Exercício DOM offline com LinkeDOM (dependência apenas no diretório temporário de QA, não na aplicação): título único, sete etapas e destinos preservados, seleção, atualização da perda de 1,80 para 3,60 milhões ao dobrar PD e idempotência da camada editorial.

Inspeção visual da implementação em navegador ainda pendente. A prévia anterior de Energia exigiu login na Vercel; não reutilizar essa validação para Crédito. Não afirmar revisão de 320/390/768/1440 px ou zoom 200% sem observação.
