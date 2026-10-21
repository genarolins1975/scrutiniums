# Fase 4E — navegação da ficha estadual

A ficha concentra dívida, execução, saldos, despesas e receitas. O roteiro local oferece acesso direto às cinco análises, preservando UF, ano e filtros na URL. Cada destino recebe foco ao navegar por teclado. Há retorno aos filtros e acesso ao comparador ao final da ficha.

Nos anos sem execução conferida, o roteiro mantém dívida e cobertura da execução; não oferece atalhos para seções ausentes. A cobertura de 2025 fica explícita. Os números, contratos, gráficos, tabelas e downloads existentes foram preservados.

## Verificação em 12/10/2026

- Tipos e lint dos cinco componentes existentes e do novo roteiro aprovados.
- PE/2025: cinco destinos existentes; navegação até despesas conferida, com foco no destino.
- PE/2026: dois destinos e aviso de cobertura; nenhuma composição de 2025 reaproveitada.
- SP/2025: roteiro atualizado; Enter em Receitas preserva UF e ano e leva a financiamento. Retorno aos filtros conferido.
- Larguras efetivas 320, 391, 768 e 1440 px: largura do documento igual à viewport. Composição em uma coluna no celular e duas no tablet/desktop. A escala do navegador exigiu compensar as dimensões solicitadas; não declarar teste exato de 390 px.
- Captura desktop revisada: índice legível, hierarquia preservada e destinos claros. As capturas com viewport sobrescrita apresentaram áreas vazias; a verificação estreita se limita à geometria DOM e ao comportamento, não à revisão visual completa.
- Zoom 200% e leitor de tela não verificados. Autoavaliação: hierarquia 9, preservação de conteúdo 9, comparabilidade 9; responsividade visual e acessibilidade integral não verificadas.

## Etapa anterior

Commit 04695cf548019e6b0e4dc83ab9cf461d050c0d34: contratos e recaptura fiscal aprovados no workflow 38273778181; o job educacional falhou. CI geral 38273778182 acompanhado separadamente. Nenhuma falha de fonte foi ocultada.
