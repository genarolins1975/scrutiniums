# Rubrica de avaliação dos painéis do Observatório do Setor Elétrico

Documento de trabalho do redesenho. Define como cada painel é avaliado, por quem e com que evidência. Vale para a matriz inicial (HEAD antes do redesenho) e para a matriz final.

## 1. Meta e regra de aprovação

Cada painel precisa de nota igual ou superior a 9,0 em cada um dos doze critérios (A a L). A média não aprova. Um painel excelente no visual e insuficiente no método está reprovado, e o inverso também.

Painel, neste trabalho, é a página (rota) avaliada. Cada rota informa os painéis da matriz de painéis (P001 a P071) que ela hospeda. As 94 rotas de `docs/observatorios/energia/avaliacao/rotas.txt` são a amostra de avaliação do projeto e incluem amostras de cada gabarito (fichas de conjunto de dados, fichas de empresa, verbetes). Páginas geradas pelo mesmo gabarito herdam a avaliação do gabarito, e essa herança não equivale a verificação individual.

As notas avaliam a qualidade dos painéis. Não são notas de agentes, regiões, empresas, distribuidoras ou fontes de energia.

## 2. Papéis

| Papel | Quem | Critérios que pontua | O que não pode fazer |
| --- | --- | --- | --- |
| Executor | Agente que implementa o redesenho | Nenhum | Atribuir nota |
| Avaliador de produto e comunicação de dados | Agente em contexto limpo, sem acesso ao plano de implementação | A, B, C, D, I, J, K | Editar arquivos do repositório |
| Avaliador técnico do setor elétrico | Agente em contexto limpo, sem acesso ao plano de implementação | E, F, G, H, L | Editar arquivos do repositório |

Limitação declarada: os avaliadores são agentes do mesmo modelo que o executor, em instâncias distintas. Isso dá separação de contexto e de papel, não independência institucional. A avaliação por agentes não substitui teste com usuários nem revisão humana especializada. Todo resultado desta rubrica é inspeção heurística.

O executor pode contestar um achado com evidência. O avaliador reconsidera quando a evidência justificar e mantém a nota quando não justificar. Nota não é negociada para encerrar a tarefa, e uma nova rodada não sobe nota por si.

## 3. Princípios editoriais que o avaliador aplica

O observatório apresenta fatos, indicadores, comparações, evolução e limitações. O leitor tira as conclusões. É permitido e desejável descrever a diferença em relação à mediana, a variação no período, a posição na distribuição, a comparação com o limite aplicável, a cobertura e a ausência de dados.

Não é permitido emitir julgamento automático sobre qualidade de governos, eficiência de empresas, conveniência de investimento, superioridade de fontes, causa de variação de preço ou segurança do suprimento. Não é permitido usar cor de aprovação ou reprovação para aumento ou queda, nota composta, ranking de qualidade ou recomendação de investimento. Ordenação por uma medida, com critério explícito, é permitida, e extremos são extremos observados.

## 4. Escala

| Faixa | Significado |
| --- | --- |
| 0 a 2 | Ausente, inutilizável ou enganoso |
| 3 a 4 | Falhas graves |
| 5 a 6 | Funcional, com lacunas importantes |
| 7 a 8 | Bom, com limitações relevantes |
| 9 a 9,4 | Excelente, demonstrado por evidências |
| 9,5 a 10 | Excepcional, com validação adicional |

Passos de 0,5. Nunca arredondar para cima. "Não verificado" substitui a nota quando faltar evidência, e essa marca nunca vale como nota alta nem é convertida em número.

Toda nota traz: (1) evidência, (2) requisitos atendidos, (3) problemas remanescentes, (4) justificativa, (5) avaliador responsável. Nota abaixo de 9 exige pelo menos um problema listado que a explique. Nota de 9 ou mais exige evidência verificável de cada requisito do nível 9 que se aplica à função da página. Os critérios são adaptados à função da página (um catálogo, por exemplo, não precisa de gráfico artificial), sem eliminar dimensões inteiras, e a adaptação é justificada por escrito.

## 5. Critérios e requisitos do nível 9

### A. Layout e hierarquia visual (produto)
- Pergunta e informação principal reconhecíveis rapidamente, na primeira tela.
- Hierarquia entre síntese, comparação e aprofundamento.
- Densidade informativa bem organizada; tipografia e espaçamento consistentes.
- Números, unidades e referências legíveis; gráficos com espaço adequado.
- Sem repetição desnecessária de títulos, cartões e explicações.
- Celular que preserva a informação essencial.
- Beleza não se confunde com espaço vazio nem com quantidade de elementos.

### B. Didática e compreensão do sistema (produto)
- Conceitos explicados antes de serem necessários; siglas traduzidas.
- Exemplos visuais úteis.
- Distinção entre potência, energia, capacidade, preço e tarifa.
- Conexão do tema com o restante do sistema; separação entre caminho físico, operação, contratos e pagamentos.
- Compreensão possível sem leitura prévia de documentação técnica.
- A abertura responde: (1) o que estou vendo, (2) por que a medida importa, (3) com o que posso compará-la, (4) o que ela não permite concluir, (5) onde aprofundar.
- A inicial ajuda a entender o sistema e a escolher o caminho.

### C. Utilidade para análise e tomada de decisão (produto)
- Tarefas concretas bem atendidas, listadas no inventário de público e tarefa da página.
- Muitos números que não respondem a pergunta útil não pontuam alto.

### D. Relevância e potencial de impacto social (produto)
- Atenção a custo, continuidade, acesso, desigualdades e benefícios, quando pertinentes ao tema.
- Recortes territoriais pertinentes; compreensão por leitor não especializado.
- Meios de compartilhar e exportar com contexto; lacunas relevantes visíveis.
- Utilidade para consumidores, conselhos, jornalistas, pesquisadores e gestores.
- Potencial de impacto não se confunde com impacto comprovado. Não inventar audiência, resultado social nem relato de usuário.

### E. Profundidade e cobertura analítica (técnico)
- Dimensões necessárias ao tema preservadas: nível atual, evolução, distribuição, composição, diferenças territoriais, referências, relações com outros temas, limitações e cobertura.
- Nem todas em toda página; a seleção é justificada pela pergunta.
- Média não substitui distribuição; saldo não substitui fluxos nos dois sentidos; mapa não substitui série; índice de capítulos não substitui análise visível.

### F. Indicadores, benchmarks e comparabilidade (técnico)
- Referências apropriadas: história da série, sazonalidade, média e mediana do grupo elegível, quartis, percentis e extremos quando úteis, pares comparáveis, limites regulatórios aplicáveis, referências nacionais e internacionais compatíveis.
- Distinção entre média simples, ponderada, razão entre agregados, média temporal e mediana entre entidades.
- Universo, cobertura, elegibilidade e ponderação visíveis.
- Sem mínimo, média e máximo aplicados mecanicamente.
- Benchmark internacional só com conceitos, unidades, período, impostos, moeda, poder de compra, cobertura e metodologia verificados. Referência incompatível aparece como contexto separado, sem sugerir ranking válido.
- A ausência de benchmark inadequado não reduz a nota. O uso enganoso reduz.

### G. Rigor metodológico e precisão setorial (técnico)
- Respeito às diferenças entre MW, MWmed, MWh e demais unidades; potência instalada, outorgada e fiscalizada; geração medida e estimada; carga e consumo faturado; SIN, sistemas isolados e outros universos; geração centralizada e MMGD; preço horário e médias de janelas diferentes; PLD, CMO, tarifa e fatura; fluxo bruto e líquido; estoque, adição e entrada em operação; observado, calculado, estimado, previsto e cenário.
- Sem soma de universos sobrepostos e sem divisão de quantidades incompatíveis.
- Ausência, zero, cobertura parcial, revisão e quebra de série com tratamento explícito.

### H. Rastreabilidade e reprodutibilidade (técnico)
- Reconstrução do número: fonte, arquivo e versão, transformação, cálculo, indicador, apresentação.
- Disponíveis: fonte específica, período de referência, captura e atualização, fórmula, variáveis e unidades, filtros e exclusões, versão metodológica, arquivo ou procedimento reproduzível, histórico de revisões, limitações.
- Gráfico, tabela, texto, resumo e CSV com o mesmo contrato.
- Link genérico para o órgão não basta.

### I. Qualidade das visualizações (produto)
- Gráfico escolhido pela tarefa; escalas e eixos corretos; referências visíveis; séries comparáveis em escalas coerentes.
- Composição com categorias completas; observações relevantes preservadas.
- Mapas com geometria e unidade territorial corretas.
- Alternativas textuais e tabelas; interação além do hover.
- Evitar eixo duplo que sugira associação, gráfico decorativo, mapa que atribua dado de distribuidora a município sem relação válida, cor que transforme comparação descritiva em julgamento, curva ou intervalo inventado.

### J. Navegação e interação (produto)
- Organização previsível; busca funcional quando proposta; filtros claros.
- Sincronização de todos os elementos do recorte (gráfico, KPI, frase, universo, referência, exportação).
- Comparação de entidades; retorno e limpeza de seleção; estado preservado quando apropriado; downloads úteis.
- Estados vazios e bloqueados compreensíveis.
- Sem navegações duplicadas nem menus sucessivos que escondam a profundidade.

### K. Acessibilidade e responsividade (produto)
- Teclado e foco visível; semântica e rótulos; contraste; alternativas à cor.
- Legibilidade com ampliação; movimento reduzido; alvos de toque confortáveis.
- Leitura em 320, 390, 768 e 1440 px, sem perda de informação no celular.
- Verificações automáticas e manuais combinadas. Aprovação no axe não comprova acessibilidade completa. Leitor de tela real: declarar "não testado" quando não houve.

### L. Confiabilidade técnica e desempenho (técnico)
- Cálculos e interações corretos; sem erros materiais no console; estabilidade visual.
- Carregamento proporcional à tarefa; séries detalhadas carregadas com eficiência.
- Testes orientados aos riscos; bloqueio de publicação de dados inválidos; protocolos de medição documentados.
- Desempenho de laboratório distinto de experiência real. Build e CI aprovados não bastam.

## 6. Verificações específicas por família

O avaliador aplica as verificações da família da página, além dos critérios gerais.

- Água e clima: EAR percentual e absoluta com leituras próprias; comparações sazonais com referência temporal apropriada; mudanças de capacidade, REE e perímetro tratadas; ENA, armazenamento, chuva e temperatura não equivalentes; indicador isolado não vira diagnóstico de segurança do suprimento.
- Geração e carga: composição e total coerentes; estimativas de MMGD identificadas; mudança de cobertura não vira variação econômica aparente; carga comparada com calendário e período compatíveis; comparação descritiva não isola clima nem atividade econômica.
- Rede: saldo não esconde reversões; sentidos, sinais e fronteiras consistentes; fluxos e preços relacionados em intervalos compatíveis; fluxo elevado não significa proximidade de limite sem evidência; perímetro explícito em relações internacionais e balanços.
- PLD: média diária não substitui perfil horário e dispersão; regiões com referência comparável; limites na vigência correta; PLD não é tarifa; formação de preço sem causalidade simplista.
- Modelos e previsões: corte, origem, emissão e entrega separados; semanas e meses com avaliação própria; sem vazamento de informação futura; candidatos comparados com referências simples; erro fora da amostra; intervalo só com método e avaliação adequados; pesquisa, previsão experimental e produto aprovado diferenciados; rodadas e revisões auditáveis.
- Conta de luz: comparação por classe, modalidade, consumo e componentes equivalentes; TE, TUSD, tributos, bandeiras e iluminação pública diferenciados; tarifa homologada não é fatura final; séries nominais e reais com deflator e data base; simulador com hipóteses e exclusões claras.
- Perdas: taxas com denominador; técnicas e não técnicas não confundidas; não técnicas não equiparadas a furto; referência regulatória com perímetro compatível; cobertura e estimativas visíveis; distribuição e história complementam o agregado.
- Qualidade: DEC e FEC separados; limites do ente e do período corretos; expurgos e apurados diferenciados; médias sem esconder dispersão entre conjuntos; compensações não tratadas como medida suficiente; agregações com pesos e cobertura.
- Inclusão: UC, fatura, família, domicílio e pessoa não intercambiáveis; proxies identificadas; razão entre bases distintas não vira taxa exata de atendimento; pesquisa de orçamento com referência temporal; acesso e sistemas isolados com tratamento adequado.
- Empresas: propriedade direta e controle separados; capacidade proporcional distinta de capacidade sob controle; CNPJs, ativos e grupos com vínculos documentados; revisões contábeis e períodos tratados; comparações financeiras com perímetro e natureza do negócio.
- Expansão e transição: outorga, construção e operação como etapas distintas; carteira não é previsão de entrada; cronogramas por coortes adequadas; cenários condicionais; potência, energia e participação na carga separadas; CO₂, CO₂e e fator médio sem confusão; associação entre séries sem efeito causal.
- Regulação, Aprenda, Dados e Metodologia: publicação e vigência diferenciadas; conceitos e atos com fontes verificadas; estados catalogado, verificado e publicado claros; etapas cumulativas não somadas como categorias exclusivas; exemplos didáticos identificados; documentação que permite reproduzir indicadores reais.

## 7. Bloqueios de aprovação

Independentemente da nota, impedem a aprovação do painel:

1. valor incorreto;
2. unidade ou denominador incompatível;
3. benchmark enganoso;
4. dado fictício apresentado como real;
5. ausência tratada como zero;
6. estimativa apresentada como medição;
7. previsão apresentada como observação;
8. cenário apresentado como compromisso;
9. ressalva essencial escondida;
10. divergência entre gráfico, tabela e exportação;
11. perda funcional relevante;
12. barreira em tarefa essencial;
13. conclusão causal ou normativa sem suporte.

Um painel incompleto não se torna excelente por explicar que está incompleto. Quando houver dado público adequado e integração viável, a solução é implementar. Quando não houver, registra-se o bloqueio e a avaliação segue honesta.

## 8. Tarefas e perfis

Cinco perfis: consumidor; jornalista ou professor; pesquisador; analista de empresas; gestor público ou conselho. Doze tarefas mínimas:

| N | Tarefa | Família principal |
| --- | --- | --- |
| T1 | Entender o caminho da geração ao consumo | Inicial, Aprenda |
| T2 | Comparar tarifa para consumo equivalente | Conta de luz |
| T3 | Localizar continuidade e limite da área atendida | Qualidade, Território |
| T4 | Interpretar perdas com o denominador correto | Perdas |
| T5 | Comparar armazenamento com referência sazonal | Água e clima |
| T6 | Entender composição e evolução da geração | Geração |
| T7 | Comparar carga com calendário compatível | Carga |
| T8 | Distinguir saldo e fluxos brutos | Rede |
| T9 | Localizar dispersão horária e diferenças regionais do PLD | PLD |
| T10 | Verificar corte, horizonte e desempenho de uma previsão | Previsões, Modelos |
| T11 | Distinguir obras, capacidade em operação e cenário | Expansão |
| T12 | Exportar e reproduzir um indicador | Dados, Metodologia |

Cada execução registra sucesso, obstáculos, erros e intervenções necessárias. São inspeções heurísticas por agentes. Não há participantes, tempos medidos nem depoimentos.

## 9. Formato do relatório de cada avaliador

Um arquivo JSON por avaliador, com esta forma:

```json
{
  "avaliador": "identificador",
  "papel": "produto | tecnico",
  "rodada": "inicial | final | reavaliacao N",
  "versao_avaliada": "SHA ou descrição",
  "paginas": {
    "/setor-eletrico/exemplo": {
      "paineis": ["P017"],
      "criterios": {
        "A": {"nota": 7.5, "evidencia": ["onde e o que foi visto"], "atendidos": ["..."], "problemas": ["..."], "justificativa": "..."},
        "B": {"nota": "nao_verificado", "evidencia": [], "atendidos": [], "problemas": [], "justificativa": "por que não foi possível verificar"}
      },
      "bloqueios": [{"tipo": "valor incorreto", "descricao": "...", "evidencia": "..."}],
      "achados": [{"id": "curto e único", "gravidade": "alta | media | baixa", "criterios": ["B", "I"], "onde": "bloco, trecho ou componente", "descricao": "...", "sugestao": "..."}],
      "nao_verificado": ["o que não foi possível checar"]
    }
  },
  "achados_entre_paginas": ["problemas que se repetem"],
  "limites_da_avaliacao": "o que este avaliador não conseguiu ou não pôde fazer"
}
```

Cada avaliador pontua só os critérios do seu papel e marca como "nao_verificado" o que não conseguiu comprovar.
