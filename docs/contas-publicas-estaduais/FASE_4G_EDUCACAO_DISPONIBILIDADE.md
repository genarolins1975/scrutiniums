# Fase 4G — disponibilidade educacional na ficha estadual

## Entrega e limites
A ficha recebe um capítulo de educação, ligado ao roteiro local, com UF, ano, rede estadual e três etapas regulares: anos iniciais, anos finais e ensino médio. O leitor identifica a condição necessária para cada evidência — despesa, matrículas, aprendizagem, metas e entregas — e pode baixar esse registro em CSV ou JSON.

A seleção da etapa é preservada em `etapa_educacao` na URL e restaurada no histórico. A seleção de UF e ano continua pertencendo à ficha existente. Os demais filtros são preservados.

Não foram incorporados novos dados educacionais. As exportações são registros de disponibilidade, com observações vazias, razões nulas e pareamento inelegível. Não há aumento dos sete indicadores nem das 216 observações fiscais. A indisponibilidade no observatório não é ausência de publicação pelo Inep, zero ou avaliação do governo.

## Evidências
- O registro preservado de captura de 2025, em 12/10/2026, documenta falhas de conexão e certificado. Link fixado no commit c64a31c50174550ab00c580f307816c7e0234fc7; não depende da versão futura de main.
- Páginas oficiais identificadas: https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados e https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/educacao-basica.
- As páginas informam publicações de 2025. A identificação do catálogo não autentica os bytes dos pacotes nem confere suas células. Nenhum número foi extraído de notícia, resultado de busca ou dado de capitais para substituir a fonte estadual.
- Despesa e metas permanecem sem documento de conciliação ou acompanhamento incorporado. Não se atribui uma fonte específica a um estado antes de obtê-la.
- O levantamento de 2025 não é aplicado a outros anos. Não se inventa Ideb anual, meta, participação ou resultado.

## Implementação
Os registros de disponibilidade são separados dos dados fiscais. CE-34 e CE-35 permanecem não publicados. O CSV não contém coluna de valor ou nota. As rotas rejeitam UF, ano e etapa inválidos; não substituem recortes inválidos na exportação. A tabela admite rolagem horizontal local, tem região focável, cabeçalhos semânticos e resumo acessível.

A interface explica por que despesa da função Educação não pode ser dividida automaticamente por matrículas de uma etapa; por que matrícula não significa pessoa única; e por que uma associação entre gasto e Ideb não demonstra causalidade. Metas físicas têm evidência própria, separada do Ideb.

## Verificação
Quatro testes de contrato cobrem as 81 combinações UF/etapa em 2025, ausência em outros anos, parâmetros inválidos e exportações sem números imputados. A execução local não foi possível porque o ambiente se desconectou. A validação será realizada pelo CI do PR e seu resultado registrado no PR.

O navegador também se desconectou durante a tentativa de revisão móvel. Não houve inspeção visual da nova seção nesta etapa, nem aprovação de responsividade ou acessibilidade integral. A revisão permanece pendente antes de produção.

Foram preservadas as fases 4D, 4E e 4F encontradas na mesma branch. Sem merge nem publicação em produção.
