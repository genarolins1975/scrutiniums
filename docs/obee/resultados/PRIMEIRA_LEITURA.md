# Primeira leitura e navegação da entrada

12/10/2026. Rota `/eficiencia-estatal`.

## Problema e solução

Composição, decomposição da diferença e estabilidade ampliaram o piloto a ponto de antecederem o panorama com várias telas de aprofundamento. A entrada agora oferece navegação por tarefa e divulgação progressiva.

- Índice “Nesta página”: panorama territorial, escore experimental (apenas no ambiente elegível e em cidades) e 16 temas. Regiões oferecem comparação regional e temas; não apontam para escore inexistente.
- Removido o atalho isolado da barra de filtros, substituído pelo índice. Hero, mapa temático, evidências e catálogo preservados.
- Escore, distribuição das capitais, tabela selecionável, cobertura, interpretação, resumo de estabilidade e download continuam disponíveis na primeira leitura.
- “Composição e testes do escore” reúne os cinco indicadores e fontes, contribuições à diferença, três famílias de estabilidade, hipóteses completas, faixas individuais, auditoria de Saúde e método.
- Aviso de inversão/empate permanece fora da expansão, calculado a partir das mesmas famílias do componente detalhado. Ressalvas sobre referência 2022, compensação e incerteza não propagada permanecem visíveis.

## Comportamento

Expansão nativa `details/summary`, inicialmente fechada; Enter abre e fecha. O link “Entender a composição” abre antes de navegar. Links diretos para `pilot-composition`, `pilot-gap-title` e `pilot-stability-title` abrem o aprofundamento após a montagem, inclusive em nova carga. A expansão não apaga a seleção territorial ou os parâmetros existentes.

Nenhum valor, peso, fórmula, estado de elegibilidade ou bloqueio de produção foi alterado.

## Verificação

21 testes focados existentes e TypeScript passaram. Não foram adicionados testes unitários que apenas reproduzam a nova marcação.

Montagem local: quatro larguras 320/390/768/1440 sem overflow horizontal; índice chegou ao panorama e catálogo com seus títulos visíveis; recorte regional removeu corretamente o atalho de escore; Enter fechou a expansão; recarga do endereço `#pilot-composition` abriu novamente e posicionou o destino a 24 px do topo. Escore, cobertura e resumo de estabilidade foram conferidos com a expansão fechada.

No desktop observado, seção do piloto fechada: 1.086 px. O aprofundamento mede 83 px fechado e 2.957 px aberto, diferença de 2.874 px antes do panorama. Não é métrica de desempenho, validação com usuários ou medida para todas as larguras.

A estabilidade da entrega anterior foi conferida também na prévia Next: Recife × Curitiba mantém a ordem nas três famílias, com diferenças pareadas apresentadas. CI de interface do anterior 441d4cd aprovado; suíte geral ainda em andamento na conferência. Nova navegação depende do CI e implantação próprios.

## Avaliação e limites

Autoavaliação da alteração: direção de arte 8; hierarquia 9; tipografia 8; densidade 9; didática 9; comparabilidade 9; interação/acessibilidade 8; responsividade 8. Evidências: atalhos válidos, notas materiais fora da expansão, comportamento nativo e quatro larguras sem overflow. Limites: inspeção da nova versão em montagem local; leitor de tela, zoom nativo 200%, compreensão por usuários e revisão independente pendentes.

Próxima etapa: conferir CI e a navegação no Next integrado; realizar revisão final da jornada comparar → entender → consultar fonte. Publicação oficial continua dependente de decisão metodológica explícita.
