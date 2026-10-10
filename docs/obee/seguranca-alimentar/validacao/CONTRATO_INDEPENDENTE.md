# Contrato de validação independente — Segurança Alimentar

Estado: preparação, sem telas ou dados aprovados. O avaliador não implementa o produto e não altera observações. Notas serão atribuídas por evidência, em cada um dos oito critérios de cada rota. O limiar solicitado é **acima de 9**, sem compensação pela média. “Não verificado” não equivale a aprovação.

## Regra científica

A PNAD/EBIA classifica a condição dos domicílios; moradores em domicílios classificados são outro universo e exigem denominador próprio. As pesquisas amostrais não autorizam estimativas municipais por interpolação. [IBGE, Segurança Alimentar 2024](https://www.ibge.gov.br/comunicados/44778-inclusao-da-variavel-sd17001-nos-microdados-da-pnad-continua-seguranca-alimentar-2024).

CadInsan estima risco de insegurança alimentar grave entre famílias inscritas no Cadastro Único. Não é a prevalência EBIA da população municipal. [MDS, CadInsan](https://www.gov.br/mds/pt-br/Sisan/vigilancia-do-sisan/CADinsan/).

SISVAN reúne informações da população atendida na Atenção Primária à Saúde. Prevalência entre acompanhados não representa automaticamente toda a população; é necessário declarar ciclo da vida, critério antropométrico, recorte e cobertura. [Ministério da Saúde, SISVAN](https://www.gov.br/saude/pt-br/composicao/saps/vigilancia-alimentar-e-nutricional/sisvan).

Preços ao consumidor, índices de inflação, preço de cesta e atacado têm universos distintos. Repasses PNAE não serão rotulados como despesa total, refeições servidas ou efeito nutricional. Cadastro de equipamento não demonstra funcionamento. Compras previstas não demonstram entregas. Indicadores de resultado não demonstram causalidade da política. Cada contrato deverá identificar a evidência oficial específica antes do aceite.

## Rotas e tarefas mínimas

- `panorama` — Orientar perguntas e mostrar evidência substantiva cedo, distinguindo as fontes.
- `inseguranca-alimentar` — Explorar níveis EBIA, domicílios versus moradores, períodos e incerteza disponível.
- `desigualdades` — Comparar subgrupos com denominadores próprios; composição não é prevalência.
- `territorios` — Explorar somente grãos disponíveis, distinguindo EBIA amostral de risco cadastral municipal.
- `precos-poder-de-compra` — Distinguir índices, preços absolutos, cesta e rendimento; consumidor versus atacado.
- `alimentacao-escolar` — Distinguir repasses PNAE, gasto executado, cobertura, matrículas e refeições.
- `equipamentos-atendimento` — Distinguir cadastro de equipamentos, funcionamento, capacidade e atendimentos realizados.
- `aquisicao-abastecimento` — Distinguir compras, entregas, execução financeira, produtores e beneficiários.
- `alimentacao-saude` — Mostrar universo SISVAN acompanhado e avaliação nutricional sem inferir população geral.
- `gestao-recursos` — Explicitar função/subfunção/programa, ente executor, transferências e execução sem dupla contagem.
- `comparar` — Bloquear combinação de universos/períodos incompatíveis e apresentar referências recalculadas.
- `metodos` — Reproduzir definição, universo, fonte, período, captura, cálculo, ausência e limitações.

## Oito critérios

1. Direção de arte: identidade editorial OBEE, tokens coerentes, estados sem decoração gratuita.
2. Hierarquia: pergunta, medida, referência e recorte reconhecíveis, prioridade analítica cedo.
3. Tipografia e acabamento: números alinhados, nomes longos legíveis, rótulos sem cortes e formato brasileiro.
4. Densidade e profundidade: análises reais de evolução, composição, distribuição ou território conforme contrato; não aceitar links ou placeholders como painel concluído.
5. Didática visual: unidade e universo junto à figura, gráficos apropriados, ressalvas materiais visíveis.
6. Comparabilidade: denominadores, escala, janela e elegibilidade coerentes; ausência, zero e inelegibilidade distintos.
7. Interação e acessibilidade: recortes, limpar, compartilhar, tabelas, CSV e teclado funcionam; nomes acessíveis/foco/contraste verificados.
8. Responsividade: tarefas preservadas em 320, 390, 768 e 1440 px, sem overflow global ou ocultação silenciosa; zoom/reflow quando viável.

Vetos: dado enganoso, metodologia sem fonte, comparação incompatível, ressalva essencial escondida, ausência convertida em zero, valor ilegível, sobreposição, tarefa essencial inacessível, perda de conteúdo ou CSV incompleto. Notas são julgamento editorial das telas, não avaliação de eficiência dos territórios nem certificação integral de acessibilidade.

## Provas a produzir

- Dados: confrontar observações com respostas brutas oficiais; verificar hashes, símbolos, unidades, numerador/denominador, duplicidades e categorias. Não somar percentuais de universos distintos.
- CSV: confrontar o arquivo efetivamente recebido com o recorte, os valores, a precisão e o universo completo; declarar amostras visuais. Verificar delimitador, escape, cabeçalho, ausência e fonte/período.
- HTTP: conferir as 12 rotas no build final e distinguir esse teste da inspeção visual e da publicação real.
- UI: CUA como controle exclusivo de navegador, após reserva com root; 48 estados de largura, capturas completas e começo/meio/fim. Teclado, filtros extremos, ausência, vazio, erro e quebra de série quando presentes.
- Acessibilidade: contraste verificável e auditoria automática quando viável, além de teclado e semântica. Leitor de tela e zoom nativo só serão declarados se realmente executados.
- Independência: registrar bloqueio concreto, enviar ao implementador, retestar apenas mudanças e dependências; não inflar notas para encerrar. A matriz inicia sem notas.

## Entrega e limites

Cada nota deverá citar rota, estado, evidência, defeitos corrigidos e limite remanescente. Painéis sem fonte suficiente terão limite ou pendência explícita, sem preencher dados artificialmente. Produção será verificada separadamente do build local. A integração à entrada OBEE deverá receber sua própria avaliação, além das 12 rotas.
