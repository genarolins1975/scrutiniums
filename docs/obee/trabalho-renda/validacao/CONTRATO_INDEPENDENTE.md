# Contrato de validação independente — Trabalho e Renda

Avaliador separado da implementação. Este documento define critérios antes da revisão; não é atestado de aprovação. Usuário pede nota acima de 9 em todas as telas: limite de aceite 9,1/10 por critério e por rota, sem média compensatória. Nota 10 exige evidência excepcional adicional. Ausência de evidência recebe “não verificado”.

## Escopo esperado

Entrada e 12 painéis: panorama, acesso ao trabalho, emprego formal, qualidade do trabalho, ocupações e oportunidades, renda familiar, desigualdade e vulnerabilidade, poder de compra, proteção da renda, qualificação e intermediação, recursos e entregas públicas, trajetórias e mobilidade. Incluir métodos e acessos na entrada OBEE. Rotas definitivas serão registradas na revisão.

Cada painel tem pergunta própria, informação substantiva, visual adequado ou estado de ausência honesto, tabela equivalente, fonte, período e universo. Estrutura repetida não substitui análise distinta. Painéis sem dados reconciliados não podem receber aprovação de funcionalidade completa nem ser anunciados como publicação de indicadores.

## Critérios (aplicados individualmente)

| Critério | Evidência necessária |
|---|---|
| Direção de arte | Identidade editorial OBEE, tokens e estados coerentes, decoração funcional |
| Hierarquia | Pergunta, recorte, medida e referência claros na primeira leitura |
| Tipografia e acabamento | Títulos e rótulos completos, alinhamento, número brasileiro, texto confortável |
| Densidade e profundidade | Tarefa analítica completa; evolução/distribuição/composição conforme pergunta; detalhes acessíveis |
| Didática visual | Unidade, interpretação, gráfico adequado e ressalva material no ponto de leitura |
| Comparabilidade | Universo, território, janela, denominador e cobertura compatíveis; ausência de julgamento causal implícito |
| Interação e acessibilidade | Fluxos essenciais por teclado/toque, foco visível, estados de erro/ausência, alternativa tabular |
| Responsividade | 320, 390, 768, 1440 px; início/meio/fim; zoom 200%; sem rolagem horizontal da página ou perda de informação |

## Bloqueios sem compensação

Dado inventado ou enganoso; referência incompatível; confusão entre vínculos e pessoas, localização do estabelecimento e residência, mês e trimestre móvel, renda nominal e real, total e per capita; causalidade atribuída sem desenho de avaliação; mistura de períodos apresentada como recorte único; limite material escondido; valor cortado; fluxo essencial inacessível; fonte ou exportação indisponível anunciada como disponível.

## Procedimento

1. Revisão do contrato de dados e cálculo: rastrear amostra por fonte e reexecutar transformações quando disponíveis. Conferir referências e limitações.
2. Revisão do código de páginas e estados, sem alterar produto.
3. Navegação independente no servidor informado pela implementação; coordenar browser para evitar colisão. Capturar início/meio/fim desktop e mobile em cada rota; checar demais larguras e zoom.
4. Testar filtros, limpeza, URLs, expansão, navegação, tabela/visual e exportação presentes. Conferir exemplos de valores visual ↔ tabela ↔ arquivo.
5. Automação de acessibilidade como apoio, acompanhada de teclado e inspeção visual. Registrar explicitamente leitor de tela não executado se não disponível.
6. Matriz por rota/estado: nota, fundamento, evidência, limitações e decisão. Rodada de correções enviada ao construtor e reavaliação apenas dos pontos alterados e regressões relacionadas.
7. Aceite só após fechamento dos bloqueios e cumprimento do padrão. Publicação e nota estética são decisões separadas; não atestar implantação sem verificação do alvo.

## Estado inicial

Implementação ainda não disponível para revisão. Nenhuma tela recebe nota ou aceite neste momento.
