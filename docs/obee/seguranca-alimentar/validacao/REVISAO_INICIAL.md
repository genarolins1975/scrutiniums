# Primeira revisão visual e funcional independente

Estado: **não aprovado ainda; sem notas finais**. Seis rotas inspecionadas em 320, 390, 768 e 1440 px, com capturas completas e verificação DOM. Nenhuma rolagem horizontal global encontrada; controles visíveis medidos não ficaram abaixo de 40 px. Três estados inicialmente capturados durante carregamento foram refeitos após presença do conteúdo final.

## Correções solicitadas

1. Alimentação escolar: a série liga 2025 completo a 2026 parcial, aparentando queda anual comparável. A condição parcial deve aparecer junto à figura, ponto/segmento e tabela, inclusive quando 2025 está selecionado. A variação do KPI de 2026 contra ano completo deve ser bloqueada. Mostrar reais nominais junto à série.
2. Preços: uma série selecionada deixa oito medidas disponíveis escondidas no seletor. Acrescentar comparação das quatro categorias no mesmo mês/janela, com tabela e CSV, e diferença alimentos–índice geral sem convertê-la em orçamento familiar. Valores principais devem preservar duas casas decimais da fonte, mantendo ticks simplificados.
3. Saúde: KPI “Não disponível” e bloco de evolução de um ponto ocupam espaço sem análise. Apresentar as quantidades e coberturas reais das cinco fases em visuais separados, tabela unificada e exportação; preservar a ausência do denominador detalhado, exclusão de gestantes e preliminaridade. Não criar evolução inexistente.
4. Desigualdades: identificar a dimensão da pessoa responsável junto ao KPI e às figuras, em vez de apenas “Mulheres” ou “Homens”. A ressalva no fim da tela não basta para interpretação imediata.

## Tarefas observadas

Navegação mobile para Desigualdades funcionou. Mudança de Mulheres para Homens atualizou a URL `?grp=Homens` e o KPI para 20,1%; tabela equivalente revelou 23,2% em 2023 e 20,1% em 2024, com estado Calculado. Composição EBIA mantém quatro categorias e percentual arredondado distinto de contagem. A apresentação não inferiu CV da razão. O foco após a mudança de grupo foi observado no resumo do recorte; será retestado por teclado na versão estabilizada.

As primeiras capturas ocorreram durante alterações HMR. A duplicação inicial de navegação desktop/mobile e o KPI abaixo da primeira tela foram corrigidos durante a rodada. Esta evidência registra diagnóstico; não demonstra versão final nem publicação. Restam acessibilidade, CSV efetivamente recebido, estados extremos, demais seis rotas e integração OBEE.
