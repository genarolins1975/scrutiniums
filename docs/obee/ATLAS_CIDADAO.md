# Atlas do cidadão — implementação da entrada

A entrada passa a apresentar território, comparação de medida real, mapa dos 16 capítulos e metodologia. Preserva as fichas de cobertura, acessos dos capítulos, fontes e o componente existente de escores em uma seção expansível.

## Dados e comportamento

- Cidades: português no Saeb 2023, anos iniciais da rede municipal, universo das 26 capitais da base. Não representa toda a educação nem nota OBEE.
- Regiões: domicílios em segurança alimentar, PNADC 2024, cinco Grandes Regiões. O agregado Brasil permanece no resumo para rastreabilidade, fora do seletor de comparação entre regiões.
- Valores ausentes ou inelegíveis permanecem indisponíveis. Sem ranking composto, tendência ou nota simulada.
- O círculo é um mapa temático explicitamente rotulado, não um gráfico de desempenho.
- Filtros territoriais persistem na URL e respondem ao histórico. A busca e o grupo filtram a navegação de capítulos. Os capítulos abrem seus recortes próprios, conforme aviso visível.
- Gráfico e tabela usam os mesmos valores. Downloads são das bases completas e isso é informado.
- Referências internacionais permanecem indisponíveis até a harmonização de fontes.

O resumo versionado é pequeno e reproduzível; o browser não recebe as bases integrais. Atualizações das fontes exigem executar `python3 scripts/eficiencia/gerar-atlas.py` e revisar os hashes. Não há atualização automática ou alteração dos hooks de build nesta entrega.

## Verificação

`python3 scripts/eficiencia/test_atlas.py -v`: três testes aprovados, conferindo todos os valores municipais, recortes regionais, períodos e hashes das bases.

Transpilação TSX via TypeScript 5.9.3 aprovada. Renderização estática React 18 aprovada, com conferência dos valores de Recife e Curitiba, capítulos e estado sem escore. Isso não substitui verificação completa de tipos, build Next ou interação no navegador.

Prévia inspecionada em 320, 390, 768 e 1440 pixels sem overflow horizontal. Conferidos troca de cidade, comparação regional, retorno no histórico, busca sem acentos, estado vazio, seleção por Enter, abertura da metodologia e download do CSV. Nenhum erro de console capturado. Zoom de 200%, leitor de tela e auditoria integral de acessibilidade permanecem pendentes.

Lint, tipos e build Next aprovados remotamente. Auditoria de interface aprovada na segunda execução. A suíte geral teve 4.505 testes aprovados, um ignorado e uma falha por cores literais no novo componente. As cores foram centralizadas nos tokens globais, preservando a composição visual; nova execução necessária para aceite final.

## Limite de aceite

A etapa 3 entrega a interface e a comparação de medidas existentes. O perfil radial quantitativo, ranking agregado e evolução dependem de notas reais validadas. A implementação não cria valores para preencher essas funções. O PR deve permanecer em rascunho até concluir CI e inspeção visual.

## Integração com a fundação de escores

A página agora consome diretamente as 15 fichas versionadas da etapa 2, no servidor. A seção expansível apresenta evidência existente, bloqueios e próximo passo por pilar. O diagnóstico metodológico é global e não muda ao selecionar uma cidade; essa distinção aparece antes das fichas. Os cinco capítulos da cesta não são confundidos com os 16 temas do observatório. A metodologia de cálculo existente permanece acessível em uma expansão própria.

A revisão anterior do Atlas (ec7b481) passou em todos os checks remotos. Na integração, os nove testes da fundação passaram e a renderização estática confirmou cinco capítulos e 15 componentes. A nova execução remota e inspeção da prévia devem fechar o aceite desta revisão.
