# PROMPT MESTRE PARA CLAUDE — OBSERVATÓRIO BRASILEIRO DO SETOR ELÉTRICO

## Instrução de uso

Execute este prompt no Claude Code, dentro do repositório do Scrutiniums. Este arquivo é uma especificação de produto, conteúdo, dados, experiência, engenharia e aceite. Seu conteúdo é suficiente para orientar o trabalho mesmo sem os anexos de diagnóstico; quando disponíveis, leia também `PAINEL_SETOR_ELETRICO_PARA_CRITICA.md` e `Revisao_Paineis_Setor_Eletrico.html`.

Não responda apenas com um plano. Inspecione a aplicação, implemente, integre dados, valide os cálculos, teste a experiência, corrija as falhas e produza a entrega verificável. Faça escolhas técnicas reversíveis autonomamente e registre suas decisões. Respeite as instruções e autorizações válidas do ambiente.

---

## 1. Missão e resultado esperado

Quero transformar o Observatório Brasileiro do Setor Elétrico, dentro do Scrutiniums, em uma referência internacional de compreensão do setor elétrico brasileiro, construída com fontes públicas e execução sustentável por uma pessoa com apoio de IA.

Seja extremamente ambicioso em cinco dimensões simultâneas:

1. **Didatismo:** uma pessoa inteligente sem formação no setor consegue entender os conceitos, interpretar os indicadores e fazer boas perguntas.
2. **Beleza:** apresentação sóbria, refinada e consistente, com qualidade editorial e visual comparável aos melhores produtos de dados do mundo.
3. **Profundidade:** pesquisadores, investidores, professores e analistas encontram séries, comparações, recortes e documentação realmente úteis.
4. **Acurácia:** unidades, fórmulas, períodos, denominadores, agregações, correspondências e interpretações tecnicamente corretos, com testes e conferência nas fontes.
5. **Rastreabilidade:** o visitante consegue partir de um número da tela e chegar ao arquivo de origem, à transformação e à versão que o produziu.

**Não quero nenhum painel incompleto.** A ambição é executar e concluir todo o escopo obrigatório deste prompt. Não entregue uma coleção de telas bonitas parcialmente preenchidas. Não declare um módulo concluído se houver painéis obrigatórios ainda sem conteúdo, integrações inexistentes, interações decorativas ou validações críticas pendentes.

**A página inicial deve ser o MAPA GERAL DIDÁTICO DO OBSERVATÓRIO.** Ela deve ensinar para que o observatório serve, para que serve cada um dos demais painéis, qual pergunta cada painel responde e como os temas se conectam. Isso tem precedência sobre qualquer recomendação anterior de transformar a rota inicial em um resumo numérico do dia.

O observatório deve permitir compreender tanto o funcionamento do sistema quanto seus efeitos na vida das pessoas: conta de luz, perdas, qualidade do serviço, acesso, benefícios, desigualdade territorial e transição energética.

---

## 2. O que significa concluir — e o que não pode ser usado para simular conclusão

### 2.1 Entrega integral

Ao final, cada painel obrigatório deverá ter:

- Uma pergunta útil e efetivamente respondida.
- Dados reais, calculados com método verificável, ou conteúdo factual apropriado à sua função quando for uma página editorial/de navegação.
- Gráfico, mapa, tabela ou explicação interativa adequada ao problema.
- Contexto histórico ou comparativo quando pertinente.
- Fonte exata e período de referência visíveis.
- Método, cobertura, limitações materiais e natureza do dado identificados.
- Interações funcionando com coerência entre as visualizações.
- Exportação e evidência acessíveis quando houver dados numéricos.
- Estados de seleção, carregamento, atualização e erro resolvidos.
- Verificação de cálculos e inspeção visual em desktop e celular.
- Critério de aceite atendido e evidência associada.

### 2.2 Práticas proibidas

- Números inventados, aleatórios, sintéticos ou fixados no código para simular integração em produção.
- Gráficos meramente ilustrativos apresentados como dados observados.
- “Em breve”, “em integração”, “em construção” ou “indisponível” como entrega final de um painel obrigatório.
- Transformar campos nulos em zero, carregar valores de outra região ou repetir o último valor sem rótulo.
- Substituir uma integração por um link externo e declarar o painel implementado.
- Considerar uma página de metodologia um substituto da análise que a página temática prometeu.
- Esconder, excluir, renomear ou rebaixar itens para melhorar artificialmente a taxa de conclusão.
- Usar uma tabela cheia de travessões como evidência de painel preenchido.
- Afirmar “auditado” apenas porque existe URL de fonte, hash ou teste que reproduz o próprio código.
- Dar a todos os itens nota alta sem evidência, inspeção ou correção dos problemas.
- Tratar resultados de pesquisa ou uma referência ingênua como previsão operacional aprovada.
- Desativar testes, tolerâncias, regras ou etapas de aprovação para fazer a entrega passar.

### 2.3 Ausência legítima da fonte não pode virar fabricação

Não confunda a exigência de completude com autorização para criar dados que não existem.

Para resolver uma lacuna, procure nesta ordem: recurso oficial estruturado; outro recurso oficial equivalente; publicação oficial em planilha; publicação oficial em PDF com extração conferida; série histórica oficial disponível com data claramente indicada; cálculo defensável a partir de insumos públicos, rotulado de acordo com sua natureza.

Se uma granularidade prometida não for sustentada por fonte pública, entregue a análise real na granularidade correta e mantenha explícita a limitação. Não invente uma taxa municipal a partir de uma taxa de distribuidora. Não chame uma proxy de medida direta. Uma alternativa metodológica muda a pergunta que pode ser respondida e deve ser registrada, sem apagar a obrigação original.

Se persistir um bloqueio externo incontornável, prossiga com todo o trabalho executável e documente exatamente a parte não atendida, a evidência do bloqueio, as alternativas tentadas e a dependência necessária. **Nesse caso, não declare a entrega integral concluída.** Um estado de bloqueio transparente é necessário para honestidade, mas não recebe o status de painel finalizado.

Durante uma falha transitória após a implantação, conservar a última publicação validada com data e aviso pode ser o comportamento correto. Isso é diferente de lançar um painel que nunca teve dados.

---

## 3. Contexto existente e inspeção inicial obrigatória

O diagnóstico de referência é de 30/09/2026 e descreve o repositório `genarolins1975/scrutiniums`, commit `d95d8f8b4`. Isso é uma fotografia histórica, não instrução para voltar a esse commit. O código atual, as instruções vigentes e os arquivos atuais prevalecem para constatar o estado de implementação.

A descrição informa:

- Rota raiz `/setor-eletrico`.
- Publicação estática baseada em arquivos `public/energia/gold/*.json`.
- Pipeline em `pipeline/energia/`.
- Atualização operacional diária, descrita como 20h40 de Brasília.
- Navegação em `src/lib/energia/navegacao.ts`.
- Componentes de evidência e modos Entender, Analisar e Auditar.
- Sete conjuntos em uso naquele momento: PLD horário, EAR, ENA, carga, balanço energético, intercâmbios e CMO semanal.
- Quatro módulos sem dados: Mercado, Empresas, Expansão e Regulação.
- Previsões sem publicação numérica, com validações pendentes.
- Um catálogo de fontes maior que a quantidade efetivamente integrada.

Antes de editar:

1. Leia `AGENTS.md` e demais instruções aplicáveis, identifique o framework, bibliotecas, versões instaladas e comandos reais de build, tipos e testes.
2. Verifique a branch, o estado do Git e alterações existentes. Preserve trabalho alheio e não faça reset destrutivo.
3. Inspecione todas as rotas existentes, seus componentes e dados. Procure módulos e integrações já implementados após o diagnóstico.
4. Execute a aplicação e faça um inventário visual do estado atual, quando o ambiente permitir. Se não conseguir executá-la, não afirme ter inspecionado sua aparência.
5. Leia coletores, transformações, dicionários, metadados, vintages, testes, configurações de modelos e regras de publicação.
6. Produza uma matriz inicial com cada rota, painel, pergunta, fonte, status real, riscos, prioridade e critério de aceite.
7. Preserve os demais observatórios do Scrutiniums e as interfaces compartilhadas. Refatore a área de energia com cuidado para não introduzir regressões no restante da plataforma.
8. Não reescreva a aplicação inteira nem troque a stack sem um problema concreto que justifique o custo.

Não trate “fonte catalogada” como “fonte integrada”, nem “pipeline executado” como “número correto”.

---

## 4. Pesquisa de benchmarks e tradução para o Brasil

Estude as referências em seu estado atual, com data de consulta. Analise a experiência em desktop e celular quando possível. Registre os padrões úteis, as limitações e sua aplicação concreta. Não copie textos, identidade visual ou dados proprietários.

| Referência | Endereço | O que estudar | Como adaptar |
|---|---|---|---|
| DiscoverWater | https://discoverwater.co.uk | Entrada por perguntas do cidadão; explicações; comparações de empresas; metas; contas; perdas; atendimento | Consumidor e território, comparador de distribuidoras, didática do mapa de perdas |
| DiscoverWater — perdas | https://www.discoverwater.co.uk/leaking-pipes | Magnitude, normalização, histórico e meta | Diferentes perspectivas sobre perdas elétricas, com os denominadores adequados ao setor |
| VaasaETT | https://vaasaett.com/services/energy-cost-insights-forecast/ | Custo total de energia e escopo das análises | Separar preço atacadista, preço contratual, tarifa e conta final |
| HEPI | https://www.energypriceindex.com/ | Comparabilidade de preços residenciais | Comparação de perfis equivalentes e tratamento explícito dos componentes |
| SMARD | https://www.smard.de/en | Geração, consumo, preços, intercâmbios e previsões | Filtros coerentes, séries ligadas e visão integrada de operação e mercado |
| EIA | https://www.eia.gov/electricity/data/ | Exploração de séries e dados detalhados | Alternância gráfico/tabela, recortes e exportação reproduzível |
| Open Power System Data | https://data.open-power-system-data.org/ | Pacotes, scripts, metadados e documentação | Reprodutibilidade e organização dos dados; conferir a atualidade de cada pacote |

As referências definem ambição e padrões de comparação, não concedem certificação ao nosso produto. Páginas comerciais não comprovam a acurácia de seus modelos. Não adote promessas genéricas de “99% de acurácia” como métrica de previsão do PLD.

Produza um registro curto de benchmark: padrão observado, evidência, decisão adotada, componente/página onde foi aplicado e forma de verificar a melhoria. O objetivo é traduzir padrões em implementação, não produzir um relatório de referências sem consequência no produto.

---

## 5. Arquitetura de informação

### 5.1 Navegação principal

Agrupe a navegação para reduzir a carga cognitiva, preservando os caminhos e links já existentes quando possível:

1. **Comece aqui:** mapa didático inicial e visão geral.
2. **Operação do sistema:** água e clima, geração, carga e rede.
3. **Preços e mercado:** PLD, previsões/modelos e mercado.
4. **Consumidor e território:** conta de luz, perdas, qualidade e inclusão energética.
5. **Empresas e futuro:** empresas, expansão e transição/ambiente.
6. **Conhecimento e evidência:** regulação, aprenda, dados e metodologia.

Os grupos organizam os destinos; não escondem os temas sociais em submenus difíceis de descobrir. “Perdas” deve estar acessível pela página inicial, pela navegação e pelo perfil de uma distribuidora.

Não force um único filtro geográfico global para fenômenos com unidades incompatíveis. Submercado, subsistema, UF, município, área de concessão, conjunto elétrico, bacia, REE e usina não são intercambiáveis. Preserve uma seleção entre páginas apenas quando existir correspondência tecnicamente válida.

### 5.2 Rotas

Preserve, se existentes:

```text
/setor-eletrico
/setor-eletrico/visao-geral
/setor-eletrico/pld
/setor-eletrico/pld/modelos
/setor-eletrico/pld/modelos/[modelo]
/setor-eletrico/pld/previsoes
/setor-eletrico/agua-e-clima
/setor-eletrico/geracao
/setor-eletrico/carga
/setor-eletrico/rede
/setor-eletrico/mercado
/setor-eletrico/empresas
/setor-eletrico/expansao
/setor-eletrico/regulacao
/setor-eletrico/aprenda
/setor-eletrico/aprenda/[conceito]
/setor-eletrico/dados
/setor-eletrico/dados/[dataset]
/setor-eletrico/metodologia
```

Crie destinos explícitos para conta de luz, perdas, qualidade, inclusão energética e transição/ambiente. Sugestão de slugs: `conta-de-luz`, `perdas`, `qualidade`, `inclusao-energetica`, `transicao`. Verifique convenções do projeto antes de decidir. Crie perfis de entidades quando úteis, com URLs estáveis e identificação inequívoca.

Use filtros compartilháveis pela URL. Restaurar uma URL deve restaurar o mesmo estado de consulta, inclusive a versão dos dados quando a intenção for reproduzir uma publicação histórica. Deixe claros os links de “dados atuais” e de “snapshot histórico”.

---

## 6. Página inicial: mapa geral didático — requisito prioritário e obrigatório

### 6.1 Função da página inicial

A rota `/setor-eletrico` deve orientar e ensinar. O visitante precisa entender:

- O que é este observatório.
- Por que os temas importam.
- O que ele pode descobrir aqui.
- Onde encontrar a resposta a cada pergunta.
- Como os painéis se conectam.
- Como verificar as informações.

A Visão Geral, em sua própria rota, responde “O que está acontecendo agora?”. A página inicial responde “Como compreender e explorar o setor usando este observatório?”. Não substitua uma pela outra. Pode haver uma chamada discreta para a situação atual, mas ela não domina a abertura.

### 6.2 Estrutura editorial e visual da página inicial

Implemente as sete seções abaixo com conteúdo completo.

**Seção A — Propósito em uma tela.**

- Título claro, por exemplo: “Entenda a energia que move o Brasil”.
- Subtítulo curto: explique que o observatório conecta operação, preços, empresas e impacto na sociedade por meio de dados públicos verificáveis.
- Duas ações principais: “Explorar por pergunta” e “Ver a situação do sistema”.
- Busca por pergunta, conceito, painel e entidade, limitada a conteúdo realmente existente.
- Sem carrossel automático, fotografia decorativa gigante, excesso de métricas, contagem de datasets como proposta principal ou siglas sem explicação.

**Seção B — Mapa conceitual navegável.**

Mostre a relação entre recursos naturais, geração, rede, demanda, operação/preço, contratos/tarifa e vida das pessoas. Empresas, expansão, regulação e dados atravessam essas relações.

- Use poucos grupos de cada vez, com hierarquia legível e expansão sob interação.
- Cada nó leva ao destino correspondente e tem uma explicação acessível por foco, toque e clique.
- Classifique as ligações relevantes: fluxo físico, decisão de operação, regra de mercado, componente de custo ou associação analítica.
- Não desenhe uma cadeia que sugira que chuva determina diretamente a conta de luz, que PLD é tarifa ou que toda diferença de preço prova congestionamento.
- Se a melhor solução for uma sequência editorial de cartões conectados, prefira-a a uma rede de dezenas de setas ilegíveis.
- No celular, a estrutura deve virar uma sequência clara de tópicos e caminhos, mantendo o mesmo conteúdo e relações.
- Ofereça alternativa textual equivalente ao mapa.

**Seção C — Para que serve cada painel.**

Todos os destinos devem aparecer em uma coleção organizada por tema. Cada cartão deve informar, no mínimo:

1. Nome em linguagem simples.
2. Pergunta central que o painel responde.
3. Para que essa resposta é útil.
4. O que o visitante encontrará: dois ou três indicadores ou recursos concretos.
5. Tipo de recorte disponível, sem prometer geografia inexistente.
6. Link direto para explorar e link curto para entender um conceito central, quando útil.

Use o quadro abaixo como conteúdo mínimo. Melhore a redação sem mudar o sentido e confirme que cada promessa existe no destino.

| Destino | Pergunta a comunicar | Para que serve | Exemplos de conteúdo |
|---|---|---|---|
| Visão geral | O que está acontecendo no sistema elétrico? | Obter contexto rapidamente e saber onde aprofundar | Preço, água, geração, demanda e fatos relevantes |
| Água e clima | Quanta energia está armazenada e como a água e o clima estão evoluindo? | Entender condições hidrológicas e contexto climático | EAR, ENA, chuva e padrões sazonais |
| Geração | De onde vem a eletricidade e quais fontes estão sendo usadas? | Entender produção, composição e restrições | Fontes, térmicas, capacidade e cortes de renováveis |
| Carga | Quanto e quando o sistema demanda energia? | Analisar consumo sistêmico, perfis e variações | Carga, pico, sazonalidade e MMGD |
| Rede | Como a energia circula entre regiões e que restrições são documentadas? | Compreender intercâmbios e limitações observadas | Fluxos, exterior, programa e evidências de restrição |
| PLD | Como funciona e como varia o preço de curto prazo? | Entender preço, volatilidade e diferenças regionais | Curva horária, distribuição, limites e CMO |
| Previsões e modelos | O que se projeta para o PLD e como a previsão tem se saído? | Examinar cenários probabilísticos e qualidade preditiva | Horizonte, intervalos, histórico de emissões e erros |
| Mercado | Como a energia é contratada, alocada e liquidada? | Compreender os mecanismos comerciais | ACL/ACR, agentes, MRE/GSF e encargos públicos |
| Conta de luz | Quanto custa a energia ao consumidor e o que compõe a conta? | Comparar perfis e entender mudanças de custo | Tarifas, componentes, bandeiras e simulação |
| Perdas | Onde a energia se perde? | Comparar desempenho e dimensionar o problema | Técnicas, não técnicas, percentual técnico regulatório e custo na tarifa |
| Qualidade | Com que frequência e por quanto tempo falta energia? | Comparar o serviço recebido e sua evolução | DEC, FEC, limites, parcelas e compensações |
| Inclusão energética | Quem tem acesso adequado e para quem a energia pesa mais? | Examinar acesso, benefícios e desigualdade | Tarifa Social, universalização e orçamento familiar |
| Empresas | Quem participa do setor e como atua? | Relacionar agentes, ativos e resultados públicos | Cadastro, portfólio, distribuidoras e finanças |
| Expansão | O que está sendo construído e quando pode entrar? | Acompanhar oferta, rede, prazos e riscos de execução | Projetos, estágios, cronogramas e revisões |
| Transição e ambiente | Como a transformação do setor se distribui e afeta as emissões? | Compreender mudanças tecnológicas e territoriais | MMGD, intensidade de emissões e contexto |
| Regulação | Quais regras mudaram e desde quando valem? | Situar decisões, indicadores e mudanças de regime | Atos, vigências, consultas e efeitos declarados |
| Aprenda | O que significam os conceitos e como se ligam aos números? | Aprender progressivamente com exemplos | Glossário, trilhas e explicações interativas |
| Dados | De onde vêm os números e como reutilizá-los? | Localizar, baixar e reproduzir a informação | Catálogo, cobertura, revisões e downloads |
| Metodologia | Como calculamos e quais são os limites da análise? | Avaliar o que uma medida permite concluir | Fórmulas, definições, validação e versões |

Evite repetir a mesma descrição genérica em todos os cartões. Não mostre “dados atualizados” sem data ou período. O cartão não precisa exibir números se isso distrair de sua função de orientação.

**Seção D — Explore pela sua pergunta.**

Inclua perguntas reais, com destinos específicos e contexto selecionado quando tecnicamente adequado:

- “Minha distribuidora perde muita energia?” → Perdas.
- “O serviço da minha distribuidora melhorou?” → Qualidade.
- “Por que a conta de luz subiu?” → Conta de luz, sem atribuição causal automática.
- “O preço de curto prazo está alto para esta época?” → PLD.
- “A água nos reservatórios está acima do normal?” → Água e clima.
- “Por que há corte de geração renovável?” → Geração/Rede, com categorias oficiais.
- “Onde estão as novas usinas?” → Expansão.
- “Quem recebe os benefícios e onde pode haver falta de cobertura?” → Inclusão, com denominadores válidos.
- “Quero baixar a série e reproduzir o gráfico.” → Dados/Auditar.

**Seção E — Trilhas por interesse.**

Ofereça percursos curtos e claros: “Estou começando”, “Sou consumidor”, “Analiso o setor” e “Ensino ou pesquiso”. Indique a sequência e o que se aprende em cada etapa. Tempo de leitura pode ser estimado editorialmente e identificado como estimativa; não invente estatísticas de uso.

**Seção F — Como confiar e como ler.**

Explique, em linguagem simples, a diferença entre dado medido, estimativa, cálculo, previsão e cenário; datas diferentes; dados revisados; fonte e comprovação. Use um exemplo real verificável. Detalhes técnicos ficam na metodologia.

**Seção G — Onde aprofundar e atualidade.**

Forneça acesso ao catálogo, à metodologia, à Visão Geral e ao estado de atualização das principais fontes. Mostre “último período disponível” por fonte; não prometa tempo real para dados mensais/anuais.

### 6.3 Aceite específico da página inicial

- Todos os módulos e páginas de referência estão representados, sem links quebrados.
- Cada cartão responde “para que serve?” e “qual pergunta responde?”.
- O visitante encontra os temas sociais sem precisar saber a sigla do indicador.
- O mapa conceitual é útil e compreensível em celular, teclado e leitor de tela.
- Não há promessa na abertura sem recurso correspondente implementado.
- Um usuário iniciante consegue escolher onde ir a partir de uma pergunta cotidiana.
- Nenhum número de exemplo é confundido com observação oficial.
- A Visão Geral permanece uma página separada e acessível.

---

## 7. Contrato de experiência de todos os painéis

### 7.1 Três profundidades sobre a mesma informação

Preserve e aperfeiçoe Entender, Analisar e Auditar. Eles não podem ter cálculos contraditórios nem filtros independentes escondidos.

**Entender:** pergunta em linguagem simples; resposta curta e datada; visual principal; por que importa; interpretação; limitação material. Use até quatro números de destaque por contexto, salvo necessidade demonstrada.

**Analisar:** séries, pares, distribuição, composição, filtros, comparações e tabelas. Ofereça caminhos de aprofundamento sem despejar todos os controles na abertura.

**Auditar:** fonte, recurso, versão, cobertura, unidade, fórmula, pesos, linhas/chaves de origem, testes, revisões, exportação e modo de reprodução.

Mantenha visíveis as limitações que alteram a interpretação: período parcial, defasagem, dado estimado, mudança metodológica, recorte incompleto e comparação incompatível. Hashes e detalhes de processamento não precisam ocupar a leitura inicial.

### 7.2 Anatomia de um painel numérico

1. Pergunta como título.
2. Resposta factual curta derivada da consulta atual.
3. Período, território/universo e unidade.
4. Gráfico ou mapa com referência de comparação.
5. Tabela equivalente.
6. Interações locais pertinentes.
7. “Como ler” e “O que não permite concluir”, de forma proporcional.
8. “Comprove este número”.
9. Download e link compartilhável.
10. Próxima pergunta sugerida com ligação ao painel relacionado.

Não aplique esse molde mecanicamente a páginas editoriais, glossários ou navegação. Elas precisam de conteúdo completo e evidência apropriada, não de um KPI artificial.

### 7.3 Gráficos e interações obrigatórias onde fizerem sentido

- Alternância gráfico/tabela usando exatamente os mesmos dados.
- Seleção por intervalo, período e entidade.
- Cursor sincronizado entre séries temporais compatíveis.
- Comparação de até quatro entidades, com limite que preserve a leitura.
- Seleção no mapa sincronizada com tabela e histórico.
- Legendas interativas sem apagar a explicação da unidade.
- Zoom e restauração do intervalo em séries longas.
- Marcas de revisão tarifária, norma, mudança metodológica e eventos com evidência.
- Tooltip por toque/foco, sem depender só de hover.
- Ordenação de tabela com estados acessíveis e tratamento correto de nulos.
- Busca de entidade, colunas pertinentes e exportação filtrada.
- Filtros visíveis em forma resumida e ação clara para removê-los.
- URLs reproduzíveis e funcionamento do voltar/avançar do navegador.

Não adicione controles sem necessidade nem interatividade ornamental. Toda interação deve ajudar a responder uma pergunta concreta.

### 7.4 Sínteses e explicações

Os textos automáticos sobre números devem ser gerados por regras determinísticas e testáveis. Se houver uso de LLM na produção editorial, nenhum fato ou número novo pode ser introduzido sem fonte e revisão.

Uma associação estatística não deve ser apresentada como causalidade. “A carga cresceu” é observação; “o crescimento foi causado pela atividade econômica” requer evidência adicional. Diferencie resultado de modelo, hipótese e evidência causal.

---

## 8. Direção de design: precisão, calma e sofisticação

### 8.1 Sistema visual

Crie ou consolide tokens de tipografia, espaço, cor, borda, estados, gráficos e mapas. Use a identidade do Scrutiniums quando disponível; eleve a consistência sem criar uma aplicação visualmente desconectada.

- Tipografia sem serifa, limpa, com excelente legibilidade em português.
- Escala editorial clara, títulos curtos e parágrafos bem espaçados.
- Fundo neutro, superfícies claras, poucos acentos e hierarquia por tamanho, peso e espaço.
- Números com algarismos tabulares, alinhamento correto e casas decimais justificadas.
- Visualizações dominam a página; caixas e decorações não competem com o conteúdo.
- Evite excesso de cartões, gradientes, sombras, ícones, cores sem significado, velocímetros e gráficos 3D.
- Use cor para codificar informação, seleção e estado, com consistência entre páginas.
- Fontes energéticas mantêm a mesma identidade visual em todos os gráficos.
- Cor não é o único portador de significado: associe rótulos, padrões, formas ou traços.
- Faça uma experiência clara no tema principal; modo escuro só conta como entregue se também estiver revisado.

### 8.2 Gramática de gráficos

- Tempo: linhas e pequenos múltiplos; componentes podem usar áreas quando a soma for interpretável.
- Comparação: pontos e barras com escala coerente; barras normalmente partem de zero.
- Realizado versus referência: pontos pareados ou marca de referência, com diferença explícita.
- Composição: barras empilhadas; evitar pizza com muitas categorias.
- Distribuição: histogramas, quantis, boxplots ou densidades quando o público puder interpretá-los com apoio.
- Incerteza: bandas ou intervalos com significado, cobertura nominal e base metodológica.
- Perfil horário: curvas e mapas hora × dia, com unidade e legenda.
- Geografia: polígonos oficiais e indicadores compatíveis; mapa acompanhado de tabela.
- Relações: dispersão e medidas estatísticas com amostra, período e limites; sem causalidade implícita.
- Cronogramas: eventos e etapas com datas previstas/conhecidas e realizadas separadas.

Não use dois eixos verticais para sugerir associação sem justificativa. Prefira painéis alinhados. Não suavize séries de forma que esconda eventos sem oferecer os valores originais.

### 8.3 Geografia e mapas

Use malhas oficiais, com fonte e vigência. Nunca desenhe um “mapa do Brasil” aproximado como se fosse uma camada analítica.

- Escala de cores e classes com interpretação explícita.
- Comparações entre anos usam escala fixa por padrão ou alertam claramente a mudança.
- Ausência de dado aparece distinta de zero e de não aplicável.
- Seleção de território não altera silenciosamente o universo.
- Mapas por concessão não viram mapas municipais por replicação de taxas.
- Mapas de fluxo têm sentido, magnitude, unidade, período e natureza do fluxo.
- Geometrias grandes são simplificadas sem destruir identidade territorial; mantenha dados completos para análise/download quando apropriado.

### 8.4 Acessibilidade e desempenho

Adote WCAG 2.2 AA como meta a verificar na documentação oficial e na implementação, incluindo contraste, navegação por teclado, foco, semântica, alternativas aos gráficos e respeito à preferência de movimento reduzido.

Verifique ao menos larguras de 360, 390, 768 e 1440 px; inclua zoom de texto. Não considere responsividade apenas “encolher tudo”. Tabelas podem rolar horizontalmente quando inevitável, sem fazer a página inteira transbordar.

Metas de produto, não resultados presumidos: LCP até 2,5 s, INP até 200 ms e CLS até 0,1 no percentil 75 quando houver dados de campo representativos. Em laboratório, registre dispositivo, rede e limites da medição. Não chame uma execução de Lighthouse de prova de desempenho real em produção.

Evite carregar todas as séries, mapas e bibliotecas na abertura. Use agregação/segmentação de dados, carregamento progressivo e componentes gráficos adequados ao volume.

---

## 9. Especificações dos módulos temáticos

As exigências desta seção e do Anexo A são cumulativas. O Anexo A detalha 71 unidades de implementação. “P2” indica ordem posterior de execução, não item facultativo nem autorização para omissão da entrega final.

Prioridades de execução: **P0** reúne fundamentos, correções críticas e a orientação inicial; **P1** reúne integrações e experiências centrais; **P2** reúne aprofundamentos executados depois do núcleo validado. Todos integram o escopo obrigatório.

### 9.1 Visão geral

Construa uma síntese enxuta da situação atual com preço, água, geração, carga, rede e dimensão social. Cada destaque liga ao painel e à evidência. Diferencie data de referência por indicador e evite sugerir simultaneidade inexistente. Regras de destaque devem ter materialidade, duração e condição de normalização; não alarme o usuário por ruído.

### 9.2 PLD

Conclua os capítulos de conceito, formação, situação atual, diferenças regionais e previsão. Mostre curva horária, janelas, distribuição e permanência nos limites oficiais. Separar média temporal e média ponderada por consumo. Incorporar sazonalidade, regimes de limites, empates no piso e moeda constante como perspectiva histórica adicional.

Compare CMO e PLD com modelo, deck/configuração, versão, período de entrega e resolução identificados. CMO semanal DECOMP, CMO semi-horário operacional do ONS e base da precificação CCEE não são séries automaticamente equivalentes. Agregar meias horas por duração é apenas parte do alinhamento; configurações e restrições também importam.

Não use o menor valor observado como substituto do piso regulatório. Integre limites mínimos, máximos horários e máximos estruturais em campos separados, associados aos atos e às vigências.

### 9.3 Água e clima

Além de EAR e ENA, entregue variáveis climáticas efetivas. Ofereça subsistema e os recortes por REE/bacia/reservatório que as fontes sustentarem. Use faixas sazonais com tamanho amostral, período histórico e regra de cálculo. Separe observações meteorológicas, previsões e cenários.

Documente as mudanças de capacidade de armazenamento e a referência da MLT. Não explique a mudança de reservatório apenas pela ENA. Um balanço exige outras entradas, saídas e conversões compatíveis.

### 9.4 Geração

Separe composição da geração de capacidade instalada. Detalhe térmicas por combustível e motivo de despacho quando houver base. Identifique nuclear, biomassa e demais fontes corretamente. Integre cortes/restrições de eólicas e solares, com causas oficiais, universo coberto e revisões. Não equipare restrição, indisponibilidade e ausência de recurso natural.

Faça a MMGD ter conceito e tratamento consistentes com Carga e Transição. Resolva a quebra metodológica de 2023 usando documentação da fonte; não permaneça com uma hipótese sem investigar.

### 9.5 Carga

Entregue nível, crescimento, perfil horário, pico e contexto climático/calendário. Compare períodos equivalentes. Separe séries brutas de ajustes/modelos. Mostre a contribuição da MMGD estimada quando identificável. Evite atribuir crescimento da carga à atividade econômica por inferência automática.

Uma decomposição estatística precisa de estimação, validação, incerteza e resíduos; não invente percentuais explicados por clima.

### 9.6 Rede

Entregue fluxos, exterior, programado versus verificado, balanços e restrições documentadas. Sincronize PLD e fluxo na mesma data/hora quando forem relacionados no visual. Fluxo líquido pode esconder reversões e fluxos brutos; ofereça as perspectivas pertinentes.

Investigue os limites operativos reais e suas vigências. Capacidade nominal de linha não substitui limite de transferência entre regiões. Sem essa base, “a rede está congestionada” não é uma conclusão demonstrada. Mantenha a pergunta que os dados conseguem responder e a pendência original registrada; não fabrique utilização da rede.

### 9.7 Mercado

Saia da catalogação genérica da CCEE para conjuntos específicos. Entregue participação ACL/ACR, consumo, agentes e movimentos de entrada/saída, MRE/GSF e encargos/contabilização pública. Distinga agente, perfil e unidade consumidora.

Regras de comercialização devem sustentar as explicações. Não prometa contratos individuais, preços privados de PPAs ou curvas a termo sem fonte pública adequada. Não apresente PLD como preço contratual do mercado livre. Trabalhe com universos públicos identificados e seus limites.

### 9.8 Empresas

Implemente cadastro de entidades, ativos, perfil operacional de distribuidoras e dados financeiros públicos. Use CNPJ, CEG, códigos ANEEL e CVM com validade temporal. Comece por pessoa jurídica/ativo e acrescente grupo econômico com vínculos comprovados. Não bloqueie tudo por falta de consolidação societária perfeita.

Separe capacidade bruta do ativo, capacidade proporcional à participação e capacidade sob controle. Evite dupla contagem de controladora e subsidiária. Demonstrações individuais, consolidadas e regulatórias não podem ser misturadas. Relacione distribuidoras aos módulos de tarifa, perdas e qualidade pela mesma definição de entidade.

### 9.9 Expansão

Entregue carteira por estágio, potência, localização, cronograma, revisões, entrada real e atraso. Integre SIGA/RALIE e bases públicas de transmissão/leilões. Preserve snapshots para comparar o que era previsto com o que aconteceu.

Outorga não é obra concluída; estoque de projetos não é projeção de entrada. MW de capacidade não é energia firme. Mostre os cenários do PDE como cenários de uma edição específica, separados do realizado e do cronograma reportado pelos projetos.

### 9.10 Regulação

Entregue limites PLD, linha do tempo de mudanças, atos/vigências e consultas/agenda. Separe data de publicação de entrada em vigor. Cite o dispositivo que sustenta cada mudança. “Efeito declarado” por regulador e “impacto estimado” pelo observatório recebem tratamentos diferentes.

Comece pelos atos que destravam interpretações dos demais painéis. Resumos de IA precisam de conferência; uma notícia sobre ato não substitui o ato.

### 9.11 Conta de luz

Entregue comparação por perfil equivalente, evolução, componentes, reajustes, bandeiras e simulador. Use tarifas de aplicação por distribuidora, classe, modalidade, posto e vigência. Distinguir tarifa homologada, tarifa média de fornecimento e conta simulada.

Inclua tributos, descontos, bandeiras, custo de disponibilidade e iluminação pública somente com tratamento e fonte adequados. Se faltar componente, mostre subtotal ou estimativa com exclusões explícitas; não chame de conta final exata. Não duplique componentes já contidos em TE/TUSD.

Compare perfis de consumo transparentes. Um perfil de referência definido pelo produto não é “consumo médio brasileiro” sem fonte. Não use PLD × consumo residencial como cálculo da conta de luz.

### 9.12 Qualidade do serviço

Entregue DEC/FEC, histórico, limites, distribuição dos conjuntos e compensações efetivamente publicadas. Mostre a experiência reportada e as parcelas regulatórias com suas diferenças. Não transforme uma média de distribuidora em tempo sem energia experimentado por cada pessoa.

Integre satisfação/reclamações e eventos/resiliência quando as bases permitirem. Normalize reclamações por exposição apropriada e informe o período. Compensação individual não pode ser calculada a partir de DEC/FEC agregado sem a regra e os dados necessários.

### 9.13 Perdas — detalhamento obrigatório na seção 10

Faça desse tema uma vitrine do observatório: didática, comparação justa, cartografia correta, volume, taxa, trajetória, referência regulatória e dimensão econômica.

### 9.14 Inclusão energética

Entregue Tarifa Social, benefícios, acesso/universalização, sistemas isolados e peso da energia no orçamento. Verifique as bases atuais; a série antiga de beneficiários da Tarifa Social foi identificada como descontinuada no diagnóstico externo. Valide a substituição e a finalidade de SCS/CDE antes de integrar.

Contagem de unidades consumidoras, famílias, pessoas e benefícios não é a mesma coisa. Cadastro social total não equivale ao universo elegível. Não publique uma “lacuna de atendimento” com denominador inválido. Onde só houver proxy, chame-a de proxy e explique suas condições.

Use POF e outras pesquisas com pesos, estratos, precisão e domínios amostrais suportados. Não crie um mapa municipal de pobreza energética “observada” a partir de uma pesquisa que não o permite. Renda média territorial e conta de referência podem gerar um cenário de esforço financeiro, não uma medida direta da experiência de cada família. Limiares de comprometimento devem ser justificados e submetidos a sensibilidade, sem serem apresentados como definição universal.

Não exponha dados pessoais dos beneficiários. A utilidade do painel social vem dos agregados, da cobertura e do contexto.

### 9.15 Transição e ambiente

Entregue a distribuição territorial da MMGD e evolução da intensidade de emissões com fonte apropriada. Integre a narrativa de expansão e restrição renovável por links e medidas consistentes.

Fator médio de emissões não é fator marginal. Diferencie CO2 de CO2e, geração de consumo e emissões operacionais de ciclo de vida. Não invente uma intensidade municipal/horária a partir de um fator nacional mensal. Estimativas próprias precisam de metodologia e selo correspondente.

### 9.16 Aprenda

Conclua os verbetes e crie trilhas conectadas aos dados reais. Cada conceito terá definição simples, exemplo, unidade quando pertinente, o que não significa, relação com outros conceitos, fonte e data de revisão. Inclua as siglas do núcleo operacional e os temas de consumo, perdas, qualidade e inclusão.

Use pequenas interações que ensinem, sem confundir exemplo com observação. Uma simulação pedagógica deve ter rótulo persistente e não alimentar os indicadores do observatório.

### 9.17 Dados e metodologia

Entregue catálogo recurso a recurso, saúde das fontes, versões/revisões, dicionários, download e reprodução. Corrija afirmações sobre bases supostamente catalogadas/integradas que não existam de fato. As regras metodológicas devem refletir o código executado.

O usuário deve conseguir localizar o que está validado, o que é antigo, o que foi revisado e qual cobertura a análise tem. Indicadores de saúde não podem ser um conjunto de selos verdes sem critérios.

---

## 10. Especificação aprofundada do mapa de perdas

### 10.1 Perguntas

- Onde estão as maiores perdas em volume e em taxa?
- Como cada distribuidora evoluiu?
- Qual parcela é técnica e qual é não técnica, segundo as definições disponíveis?
- Como o realizado se compara à referência regulatória correspondente?
- Qual custo foi reconhecido no processo tarifário?
- Que características territoriais aparecem associadas aos resultados, sem inferência causal automática?

### 10.2 Composição da tela

1. Abertura com pergunta e uma explicação curta da medida selecionada.
2. Seletores de período, medida e entidade/área.
3. Mapa dominante por área oficial correspondente ao dado.
4. Legenda com unidade, escala e tratamento de ausência.
5. Painel de seleção com nome, referência temporal, medida e ligação para o perfil da distribuidora.
6. Série histórica com referência regulatória compatível, quando aplicável.
7. Comparador de até quatro empresas.
8. Tabela ordenável que permita examinar todas as entidades disponíveis.
9. Decomposição técnica/não técnica com definições e denominadores.
10. Dimensão econômica com origem no processo tarifário e separação entre observado/reconhecido/estimado.
11. Contexto social, com cobertura territorial e limitações visíveis.
12. Fonte, método, evidência e download.

### 10.3 Medidas

| Medida | Apresentação | Regra |
|---|---|---|
| Perda total em energia | MWh/GWh | Reconciliar entradas e saídas dentro do perímetro oficial |
| Taxa de perdas totais | % | Informar a base energética usada no denominador |
| Técnica | Energia e taxa conforme fonte | Identificar metodologia de estimação/cálculo |
| Não técnica | Energia e taxa conforme fonte | Não resumir automaticamente a furto; preservar definição |
| Referência regulatória | Valor e vigência | Diferenciar valor reconhecido, parâmetro e realizado |
| Diferença para referência | p.p. ou energia | Só se bases, períodos e universos forem comparáveis |
| Custo reconhecido | R$ do período, com opção real se útil | Fonte tarifária e método, sem monetização arbitrária |
| Evolução | Variação absoluta e relativa | Ajustar mudanças de concessão/universo ou sinalizá-las |

### 10.4 Regras espaciais e comparativas

- Concessão/área de atuação precisa de geometria oficial e vigência.
- Empresas podem atender múltiplas áreas/UFs e municípios podem ter mais de uma situação de atendimento.
- Não rateie volume nem taxa por área geográfica sem base defensável.
- O agregado de taxas deve usar numeradores e denominadores compatíveis: 100 × soma dos numeradores / soma das bases.
- Não some porcentagens que usam bases diferentes.
- Apresente nível, trajetória e distância à referência; evite uma classificação moralizante única.
- Se usar pares estruturais, explique critérios, dados e sensibilidade. A escolha de pares não elimina diferenças não observadas.
- Não crie um índice composto opaco de “melhor distribuidora”.
- Não atribua às famílias de uma área a responsabilidade por perdas não técnicas.
- Não afirme que toda perda técnica pode ser eliminada a custo zero.

### 10.5 Testes de aceite específicos

Selecione pelo menos casos que cubram distribuidora grande, pequena, multiestadual, mudança societária, valor extremo e dado ausente. A seleção é para testar robustez; não constitui amostra estatística de certificação.

Para cada caso, confira: entidade, período, geometria, numerador, denominador, taxa, referência regulatória, fórmula, arredondamento e comparação histórica. Teste seleção por mouse, toque e teclado; confirme equivalência entre mapa, tabela e exportação.

O mapa só recebe status concluído quando a cartografia e os indicadores estiverem ligados corretamente. Um comparador/tabulação é uma entrega útil durante a construção, mas não substitui silenciosamente o mapa obrigatório.

---

## 11. Dados, métodos e rastreabilidade

### 11.1 Política de fontes

Priorize ONS, CCEE, ANEEL, EPE, MME, ANA, INMET, IBGE, CVM e MCTI, conforme o tema. Use fontes secundárias para localizar ou contextualizar; números centrais devem ser sustentados por origem primária ou por cálculo próprio explicitamente documentado.

Verifique licenças, condições públicas de acesso e frequência. Não contorne autenticação, bloqueios ou restrições; use recursos públicos autorizados. Não assuma que uma URL de portal é a URL do recurso.

Para cada fonte, registre:

- Órgão e conjunto/recurso exatos.
- URL e método de obtenção.
- Dicionário e versão do esquema.
- Licença e atribuição.
- Período, entidades e geografia cobertos.
- Unidade original e convertida.
- Frequência declarada e comportamento observado.
- Revisões e quebras metodológicas.
- Situação de acesso e integração.
- Rotas, métricas e modelos que dependem dela.

### 11.2 Catálogo de métricas como fonte única

Implemente um contrato central de métricas, adaptando à stack existente. Não replique fórmulas em componentes diferentes. Exemplo conceitual de campos, a ajustar ao domínio real:

```ts
type MetricDefinition = {
  id: string;
  title: string;
  question: string;
  definition: string;
  unit: string;
  geographicGrain: string;
  temporalGrain: string;
  sourceResources: string[];
  numerator?: string;
  denominator?: string;
  aggregationRule: string;
  formulaVersion: string;
  sourceNature: string;
  transformationNature: string;
  supportedDimensions: string[];
  comparabilityRules: string[];
  coverageRule: string;
  missingValuePolicy: string;
  validationRules: string[];
  materialLimitations: string[];
};
```

Isso ilustra o contrato desejado, não impõe uma biblioteca ou um desenho de tipos inferior ao existente.

### 11.3 Natureza e validação são eixos diferentes

Classifique separadamente:

- **Origem/natureza:** medido; estimado pela fonte; calculado pelo observatório; estimado pelo observatório; previsto; cenário.
- **Situação da validação:** reconciliação externa aprovada; controles internos aprovados; ressalva; divergência; pendência.

“Publicado pelo ONS” não garante que todo componente tenha sido medido diretamente. Um agregado oficial com MMGD estimada precisa preservar essa informação. “Calculado” não quer dizer “menos confiável”, e “observado” não quer dizer “livre de erro”.

### 11.4 Tempo e versões

Mantenha separados, conforme aplicabilidade:

- Início/fim do período de referência.
- Fuso e convenção do intervalo.
- Data/hora da publicação na fonte, quando conhecida.
- Primeira captura observada pelo sistema.
- Última captura e processamento.
- Data/hora de validação.
- Vigência de regra, tarifa, entidade e geometria.
- Versão do dado, transformação e publicação.

Não invente timestamp de publicação. Não use data de captura como substituto da data do dado. Conserve originais e versões relevantes para reprodução e avaliação preditiva.

### 11.5 “Comprove este número”

O usuário deve conseguir abrir a evidência a partir de um KPI, célula ou agregado de gráfico e ver:

1. Valor exibido e valor de cálculo antes do arredondamento.
2. Unidade, período, entidade, universo e filtros.
3. Fonte/recurso e arquivo utilizado.
4. Chaves ou referência das observações de origem.
5. Fórmula, numerador, denominador, pesos e exclusões.
6. Cobertura e tratamento de ausências.
7. Versão e revisões relevantes.
8. Testes executados e resultado da reconciliação.
9. Download dos dados e instrução/rotina de reprodução.
10. Referência para citação acadêmica.

Para extração de PDF, inclua documento, edição, página/tabela e conferência da extração. Para um agregado composto de muitos registros, forneça consulta e manifesto em vez de despejar milhares de linhas na interface.

Hash prova identidade de arquivo. Acurácia exige verificar extração, definição, transformação e reconciliação.

### 11.6 Regras numéricas essenciais

- MW mede potência; MWh mede energia; MWmed exige período. Converta pela duração correta de cada intervalo.
- Preserve fuso e datas; o histórico pode conter convenções que mudaram, inclusive horário de verão.
- EAR agregada usa energia e capacidade compatíveis; não média simples de percentuais regionais.
- ENA/MLT em janela usa somas/ponderações compatíveis com a referência; documente a MLT e sua versão.
- PLD diário/mensal temporal não é preço ponderado pela carga; identifique qual está exibido.
- Participações de geração usam energia do mesmo perímetro; não misture capacidade cadastrada e geração verificada.
- Fator de capacidade considera a potência operacional ao longo do tempo; informe como trata entrada/saída de unidades.
- DEC/FEC seguem os pesos e critérios oficiais. Centésimos de hora não são minutos.
- Números anuais parciais não competem com anos completos em rankings sem ajuste e aviso.
- Ausência, zero, não aplicável e valor suprimido devem ser estados distintos.
- Reconciliações têm tolerâncias específicas justificadas por unidade, precisão e método; nada de um percentual universal arbitrário para tudo.
- Nulos não são interpolados ou preenchidos para produzir um gráfico contínuo sem identificação.
- Revisões podem alterar interpretações; publique magnitude e alcance, além da contagem de linhas alteradas.

### 11.7 Controles automatizados

Implemente controles relevantes para:

- Esquema, tipos, domínios e unidades.
- Chaves únicas e duplicidades.
- Registros esperados por entidade/intervalo.
- Datas futuras indevidas e ordenação temporal.
- Limites físicos/regulatórios quando aplicáveis.
- Identidades de agregação e composição.
- Correspondências de entidades e geometrias.
- Quebras de regime, longas sequências repetidas e extremos.
- Drift de esquema de fontes e recursos descontinuados.
- Atualidade por frequência da fonte.
- Equivalência entre gráfico, tabela e exportação.
- Consistência dos textos derivados dos dados.

Valores atípicos não são descartados automaticamente. Verifique no arquivo original; uma sequência de zero pode ser real, mas também pode resultar de extração defeituosa. Nunca use plausibilidade como substituto de comprovação.

---

## 12. Previsão de PLD: produto completo e estatisticamente honesto

O módulo de previsão é obrigatório. Conclua a implementação e as validações necessárias em vez de retirar o módulo do escopo. Preserve os controles existentes e investigue seu estado atual.

O desenho descrito no diagnóstico possui quatro modelos — B0, C1, C2-P e C2-H — e horizontes W1–W4/M1–M3 nos quatro submercados. Os resultados estavam retidos por pendências de validação, incluindo G4 e registro G23-R1. Verifique os arquivos atuais; não assuma que continuam pendentes nem que já foram resolvidos.

### 12.1 Alvo, horizonte e rotina

- Defina o alvo exato e o cálculo do realizado por submercado.
- Defina semanas com limites inequívocos. Exemplo: sábado 00h até sábado seguinte 00h, excluindo o instante final. Evite “sábado a sábado” sem esclarecer a inclusão dos extremos.
- Meses civis e tratamento de períodos parcialmente conhecidos precisam estar explícitos.
- Separe o PLD já publicado para horas futuras do resultado ainda desconhecido que exige previsão.
- Preserve o compromisso operacional descrito: corte às 07h e publicação até 08h, `America/Sao_Paulo`, todos os dias.
- Use coleta noturna como pré-carga, com verificação/retentativa antes do corte. Emitir às 20h40 como se fosse uma rodada cortada às 07h altera o conjunto de informação e é incorreto.
- Registre horário real da emissão, atraso, falha e versão. Rotina definida no código não é rotina comprovadamente executada.

### 12.2 Conteúdo público

Entregue previsão atual, faixas/quantis quando sustentados, histórico de emissões, revisão entre rodadas para a mesma entrega, realizado e desempenho. As fichas dos modelos devem mostrar entradas, transformações, configurações, pesos quando pertinentes, versão, hipóteses, aprovação e limitações.

Não invente bandas de incerteza para um modelo de persistência que só emite um ponto. Para produzir intervalos, implemente e valide o método. Não publique quantis cruzados, probabilidades incoerentes ou restrições de preço ignoradas.

### 12.3 Validação

- Avaliação fora da amostra com janelas temporais e treinamento somente no passado.
- Baselines de persistência e referência sazonal bem definidos.
- MAE e viés em R$/MWh, por horizonte e submercado.
- Perda quantílica ou CRPS conforme a representação probabilística disponível.
- Cobertura, largura e calibração dos intervalos, não apenas erro pontual.
- Desempenho por regimes hidrológicos/de preço e em extremos, com amostra suficiente ou limitação explícita.
- Separação entre escolha/ajuste de modelos e avaliação final; não selecionar o vencedor no mesmo período usado como teste final sem reconhecer a contaminação.
- Consideração de dependência entre erros de horizontes sobrepostos na inferência de ganho.
- Dados e configurações disponíveis no instante de cada previsão; nenhuma revisão posterior entra retrospectivamente.
- Se a publicação histórica da fonte não for conhecida, o backtest sob LAT1D é uma reconstrução por hipótese. Publique sensibilidade a atrasos e separe do teste prospectivo com capturas observadas.

Um modelo não recebe aprovação porque seu gráfico é bonito ou porque tem R² elevado. Um histórico prospectivo ainda curto continua curto: não fabrique observações para completar amostra. Registre o início da operação e o que ainda não pode ser concluído sobre desempenho.

### 12.4 Aprovação e limites

Finalize as etapas de revisão existentes com evidência. Não se autoatribua a autorização de um responsável externo quando ela for exigida por uma regra aplicável. Faça todo o trabalho necessário para uma decisão concreta e revisável; não peça confirmação repetida sobre escolhas técnicas já autorizadas.

B0 pode ser uma referência experimental claramente identificada quando seu cálculo e sua disponibilidade temporal estiverem validados. Publicá-lo não quita, por si só, as obrigações dos outros modelos nem autoriza reclassificá-lo como previsão operacional aprovada.

---

## 13. Engenharia para operar com confiabilidade e baixo custo

Preserve o que já funciona. Prefira arquitetura simples, modular e inspecionável, com componentes compartilhados e dados publicados de forma eficiente.

### 13.1 Pipeline

- Coletores separados por fonte, com configuração e registro de tentativas.
- Download original preservado, parser, normalização, validação e publicação como etapas distinguíveis.
- Processamento idempotente, incremental e reexecutável.
- Retentativas com espera progressiva, cache e limites de requisição compatíveis com a fonte.
- Atualização diária, mensal ou anual conforme a natureza do conjunto, sem recalcular tudo inutilmente.
- Quarentena de dados com erro crítico; conservação da última versão válida com data correta.
- Publicação consistente: um manifesto/versionamento impede que KPIs e gráficos misturem versões incompatíveis.
- Observabilidade de atualização, cobertura, duração, falha, revisão e dependências afetadas.

### 13.2 Dados e aplicação

- Grandes originais e séries em armazenamento adequado; não inflar o bundle ou repositório sem necessidade.
- Publicar agregados pequenos por página, período e recorte; disponibilizar o detalhe para consulta/exportação.
- Mesma camada semântica para KPI, gráfico, tabela, texto e arquivo exportado.
- Identidades e correspondências versionadas, com cobertura mensurável.
- Componentes reutilizáveis para série temporal, mapa, comparador, tabela e evidência.
- Conteúdo essencial acessível de forma resiliente; quando possível, renderização inicial útil sem depender de carregar todo o JavaScript.
- Sem credenciais no cliente, contratos de dados privados ou custos externos assumidos sem autorização aplicável.
- Sem sistema de login obrigatório para consulta pública, salvo requisito vigente do projeto.

### 13.3 Manutenção

Priorize atualização automática de regras já validadas e revisão humana para mudanças de definição, fórmulas novas, vínculos de entidades, extrações ambíguas e divergências materiais. Documente o que precisa de atenção e por quê. Uma operação individual não pode depender de inspeção manual diária de dezenas de gráficos para detectar falhas básicas.

---

## 14. Plano de execução obrigatório

O trabalho deve avançar até o escopo estar concluído e verificado, respeitando limitações reais de acesso e de autorização. Não encerre ao produzir um plano, uma homepage, um protótipo ou um conjunto de componentes.

### Etapa 1 — Descoberta e matriz de escopo

Inventarie estado atual, fontes, painéis e testes; revise benchmarks; registre achados e riscos. Dê IDs estáveis aos itens e expanda as 71 unidades do Anexo A nos componentes concretos que o código exigir. Contar unidades agrupadas não deve esconder gráficos obrigatórios faltantes.

### Etapa 2 — Contratos de dados e correções críticas

Resolva definições, unidades, datas, entidades, revisão, compatibilidade CMO/PLD, tratamento MMGD, limites e balanços. Monte os controles que impedirão que erros se espalhem para novas páginas.

### Etapa 3 — Design e página inicial

Implemente o sistema visual, os padrões comuns e o mapa didático inicial completo. Teste sua compreensão e navegação. A página inicial deve evoluir junto com os destinos; no resultado final, nenhuma promessa fica sem implementação.

### Etapa 4 — Consumidor e território

Entregue perdas, conta de luz, qualidade e inclusão. O mapa de perdas recebe prioridade real, não sobra para depois do acabamento dos módulos profissionais. Desenvolva a cartografia e o comparador com fontes e regras corretas.

### Etapa 5 — Completar módulos existentes

Feche Mercado, Empresas, Expansão e Regulação. Complete água/clima, geração, carga e rede. Reuse integrações entre módulos; não faça cópias divergentes da mesma métrica.

### Etapa 6 — Previsão e aprofundamentos

Conclua as validações e a rotina de previsão; implemente histórico e desempenho. Finalize transição, ambiente, orçamento familiar e análises mais avançadas com dados e métodos apropriados. P2 é etapa posterior desta entrega, não promessa de uma fase futura sem execução.

### Etapa 7 — Auditoria e correção

Inspecione todas as rotas e estados relevantes. Faça reconciliações, testes de interação e revisão editorial/visual. Corrija o que falhar; repita apenas o necessário para resolver o risco e os critérios afetados.

### Etapa 8 — Entrega demonstrável

Gere matriz final de aceite, evidências, documentação de operação, lista de fontes e instruções de reprodução. Prepare release conforme o fluxo e as autorizações existentes no projeto. Só declare publicado após evidência do deploy e verificação do ambiente publicado; branch/build local não são publicação.

Mantenha um registro de continuidade para retomar o trabalho entre sessões sem perder decisões nem reiniciar etapas concluídas.

---

## 15. Verificação e critérios de excelência

### 15.1 Metas de avaliação

Use dez dimensões por página, com notas baseadas em evidência. A escala é uma ferramenta de revisão, não uma certificação externa. Meta de produto: todas as dimensões pelo menos 9/10, didatismo e apresentação visual pelo menos 9,5/10, e nenhum defeito crítico conhecido de dados, segurança, navegação ou operação.

| Dimensão | Peso | Evidência exigida |
|---|---:|---|
| Didatismo | 15% | Pergunta respondida, linguagem, exemplo, interpretação e ligação entre conceitos |
| Qualidade visual | 12% | Capturas inspecionadas, hierarquia, tipografia, densidade e consistência |
| Navegação e usabilidade | 10% | Jornadas executadas, descoberta de conteúdo e restauração de estado |
| Interatividade | 8% | Controles funcionais e coerência das seleções |
| Acessibilidade | 7% | Teclado, foco, contraste, semântica, alternativas e mobile |
| Completude | 12% | Todos os itens e recortes obrigatórios com conteúdo válido |
| Correção técnica e metodológica | 15% | Fórmulas, universos, unidades, reconciliações e limites de inferência |
| Rastreabilidade | 10% | Fonte, transformação, versão e reprodução do número |
| Atualidade e confiabilidade operacional | 6% | Atualização, revisão, falha e recuperação verificadas |
| Desempenho e manutenção | 5% | Medição, volume de dados, simplicidade e documentação |

Não arredonde uma nota inferior para cumprir a meta. Não dê 10 em acurácia para representar certeza absoluta sobre a fonte; descreva o que foi verificado e o que permanece limitado. Quando uma dimensão não tiver sido testada, registre “não avaliada”, que não satisfaz o aceite correspondente.

### 15.2 Jornada real de usuário

Execute, pelo menos:

1. Iniciante parte da home, entende PLD versus tarifa e encontra dados de ambos.
2. Consumidor localiza sua distribuidora e compara perdas e qualidade.
3. Analista identifica uma variação de preço, examina contexto e acessa a evidência sem confundir períodos.
4. Pesquisador filtra uma série, exporta e reproduz um agregado.
5. Professor encontra conceito, exemplo e gráfico real adequado para explicar em aula.
6. Usuário de celular seleciona uma região, lê detalhe, compara e remove o filtro sem perda de contexto.
7. Usuário por teclado navega pelo mapa ou sua alternativa e acessa os mesmos dados.
8. Usuário abre um link compartilhado e encontra o mesmo recorte.
9. Usuário entende uma ausência legítima ou uma fonte defasada sem confundi-la com zero.
10. Usuário inspeciona uma previsão passada e seu resultado, sem reescrita do histórico.

Se houver teste com pessoas, documente amostra, tarefas e resultados. Uma revisão feita pelo próprio implementador não pode ser descrita como teste com usuários reais.

### 15.3 Testes de dados e software

- Testes relevantes de agregação, unidade, nulo/zero, vigência, correspondência e revisão.
- Reconciliação com fontes primárias e verificação de casos extremos.
- Verificação independente do caminho principal de cálculo quando possível; não apenas repetir sua fórmula em um teste.
- Testes das interações principais, filtros, URLs e exportações.
- Navegação por todas as rotas; nenhum destino obrigatório vazio.
- Verificação de console, rede e carregamento de dados.
- Inspeção visual real em tamanhos de tela diferentes; capturas precisam ser abertas e examinadas.
- Regressões nos componentes compartilhados e demais áreas afetadas.
- Build, tipos e testes exigidos pelo repositório.
- Simulação de falha de fonte, dado revisado, atualização parcial e recuperação.

Busque testes que detectem erros concretos. Não infle o número de testes com verificações que apenas espelham a implementação, nem use cobertura de linhas como substituto de validade do indicador.

---

## 16. Documentação e artefatos de entrega no repositório

Adapte os caminhos às convenções existentes, evitando duplicações de documentos equivalentes. Conteúdo mínimo sugerido:

```text
docs/observatorios/energia/
  VISAO_PRODUTO.md
  MAPA_DIDATICO_HOME.md
  BENCHMARKS.md
  MATRIZ_PAINEIS.md
  CATALOGO_METRICAS.md
  FONTES_E_COBERTURA.md
  REGRAS_METODOLOGICAS.md
  MAPA_PERDAS.md
  VALIDACAO_DADOS.md
  VALIDACAO_PREVISOES.md
  AVALIACAO_PAGINAS.md
  EVIDENCIAS_ACEITE.md
  OPERACAO_E_RECUPERACAO.md
  DECISOES_E_LIMITACOES.md
  CONTINUIDADE.md
```

Além dos documentos, entregue:

- Código integrado e organizado.
- Coletores e transformações executáveis.
- Dados reais necessários para exibir todos os painéis.
- Manifesto da publicação e referências dos arquivos de origem.
- Testes e resultados reproduzíveis.
- Capturas de todas as páginas e dos estados críticos inspecionados.
- Instruções de execução e atualização.
- Matriz com ID, rota, painel, fonte, cobertura, critério, status e evidência.

Não guarde credenciais, informações pessoais indevidas nem enormes arquivos transitórios em documentação. A referência ao original precisa permitir reprodução sem expor segredos.

---

## 17. Definição final de pronto

Só declare a implementação integral pronta quando:

- [ ] A home é o mapa didático do observatório, com propósito, perguntas, utilidade e conexão de todos os destinos.
- [ ] Todos os módulos obrigatórios existem e têm conteúdo real e útil.
- [ ] Todos os painéis obrigatórios foram concluídos, incluindo os itens de execução posterior do Anexo A.
- [ ] Mercado, Empresas, Expansão e Regulação deixaram de ser módulos vazios.
- [ ] Conta de luz, Perdas, Qualidade, Inclusão e Transição estão plenamente integrados à experiência.
- [ ] O mapa de perdas funciona com geografia, indicadores e referências corretos.
- [ ] Os conceitos pendentes foram tratados e as fontes conferidas.
- [ ] Não há números de demonstração no caminho de produção.
- [ ] As comparações não misturam datas, universos ou denominadores incompatíveis.
- [ ] Gráfico, tabela, texto e exportação derivam da mesma consulta e versão.
- [ ] O usuário consegue comprovar números e reproduzir agregados.
- [ ] Todas as interações prometidas foram executadas em teste.
- [ ] As telas foram inspecionadas em desktop e celular, inclusive estados extremos e vazios legítimos.
- [ ] A atualização e o tratamento de falhas foram testados.
- [ ] O módulo de previsão cumpre as etapas aplicáveis de validação e publicação, sem contorná-las.
- [ ] Backtest, prospectivo, observado, estimado e cenário estão corretamente separados.
- [ ] Avaliação por página e evidências estão registradas, sem notas inventadas.
- [ ] Não há regressão conhecida nas áreas afetadas do Scrutiniums.
- [ ] Build e verificações exigidas passaram.
- [ ] Qualquer limitação externa remanescente está descrita sem ser apresentada como cumprimento integral.

Completude deve ser calculada sobre o escopo fixado e seus IDs. Se um item for dividido, preserve a relação com o requisito original. Não altere o denominador para apresentar 100%.

---

## 18. Forma de trabalhar e comunicar

Trabalhe como um responsável por entregar o produto completo. Use raciocínio técnico, bom julgamento e cuidado editorial. Não me devolva listas genéricas de sugestões quando o trabalho autorizado é implementar.

Informe progresso com fatos: o que foi entregue, que evidência passou, que risco foi resolvido e o que falta. Evite mensagens repetitivas de intenção. Não peça confirmação painel a painel nem para escolhas reversíveis de implementação.

Quando surgir uma ambiguidade, investigue código, dados, documentos e fontes. Faça a escolha mais coerente com este prompt e registre-a. Peça esclarecimento apenas se uma informação essencial não puder ser inferida com segurança ou se uma autorização realmente necessária não existir.

Não prometa prazo arbitrário nem reduza silenciosamente o escopo por limite de sessão. Atualize `CONTINUIDADE.md` para retomar com estado exato: arquivos, decisões, comandos úteis, testes, itens concluídos e próximos bloqueios.

Na resposta final, apresente:

1. O que foi implementado e onde acessar.
2. Quantidade de módulos e painéis concluídos, com o denominador original.
3. Como a home ensina a explorar o observatório.
4. Quais fontes e períodos estão realmente integrados.
5. Como os números podem ser comprovados.
6. Resultados de validação de dados, interação, visual e previsão.
7. Estado real de publicação: local, branch, preview ou produção.
8. Limitações remanescentes, se houver, sem chamar uma entrega parcial de integral.

**Comece inspecionando o estado atual e execute até entregar o observatório completo, didático, belo e verificável.**

---

## Anexo A — Matriz obrigatória de painéis e critérios de aceite

Esta matriz consolida as 71 unidades de implementação definidas na revisão. Algumas unidades agrupam gráficos que compartilham uma função e uma fonte; expanda-as em subtarefas sem perder qualquer obrigação. O estado indicado é histórico, conforme o diagnóstico de 30/09/2026, e deve ser confirmado no código atual. Prioridades organizam a execução; todos os itens são obrigatórios para a entrega integral.

Os IDs abaixo são estáveis para acompanhar cobertura. As fontes são resolvidas no Anexo B. Onde a fonte é apenas candidata ou catalogada, localizar o recurso, validar o dicionário e comprovar a integração faz parte da tarefa.

### P001 — Mapa / Página inicial como mapa geral didático

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: índice. Confirmar no código atual.
- **Pergunta:** Para que serve o observatório e onde encontro a resposta à minha pergunta?
- **Visualização principal:** Mapa conceitual navegável, cartões explicativos, busca e trilhas.
- **Implementação exigida:** Manter a home em /setor-eletrico como mapa didático, implementar integralmente as sete seções da seção 6 e apresentar todos os destinos com pergunta, utilidade e conteúdo. A Visão Geral permanece separada.
- **Fontes de partida:** D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Navegação; revisão editorial.
- **Critério específico de aceite:** Todas as promessas correspondem a destinos implementados; todos os módulos têm pergunta e utilidade explícitas; navegação testada com perfis e em celular.

### P002 — Mapa / Mapa geográfico transversal

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: índice. Confirmar no código atual.
- **Pergunta:** O que acontece na minha região?
- **Visualização principal:** Mapa com camadas e tabela.
- **Implementação exigida:** Separar camadas de submercado, concessão, município e usina; seleção persistente apenas quando compatível. O mapa geográfico é complementar e não substitui o mapa conceitual/didático obrigatório da página inicial.
- **Fontes de partida:** S14, S16, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Geometria oficial por vigência.
- **Critério específico de aceite:** Nenhum indicador atribuído a uma granularidade inferior à de origem.

### P003 — Mapa / Trilhas e atualidade

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: índice. Confirmar no código atual.
- **Pergunta:** Que dado posso usar hoje?
- **Visualização principal:** Trilhas por perfil e quadro de datas.
- **Implementação exigida:** Manter iniciante, analista e pesquisador; acrescentar consumidor; mostrar período real por fonte.
- **Fontes de partida:** D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por conjunto.
- **Critério específico de aceite:** Data da captura nunca apresentada como referência do dado.

### P004 — Visão geral / O sistema em 60 segundos

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** O que mudou e merece atenção?
- **Visualização principal:** Síntese com links e indicadores.
- **Implementação exigida:** Manter regras determinísticas; incluir qualidade do dado; separar fatos de hipóteses; limitar destaques.
- **Fontes de partida:** D0, S1, S21. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Diário; datas por indicador.
- **Critério específico de aceite:** Todas as frases reproduzíveis a partir dos números exibidos e de suas versões.

### P005 — Visão geral / Preço, água, geração, carga e rede

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** Como estão os principais determinantes?
- **Visualização principal:** Pequenos gráficos alinhados.
- **Implementação exigida:** Reutilizar o catálogo de métricas; datas diferentes explicitadas; rede sem alegação de congestionamento.
- **Fontes de partida:** S1, S3, S21. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Diário/horário.
- **Critério específico de aceite:** Mesmos números dos módulos de origem; eixos, universo e datas consistentes.

### P006 — Visão geral / Energia e sociedade

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Como custo e qualidade chegam ao consumidor?
- **Visualização principal:** Indicadores com referência temporal.
- **Implementação exigida:** Adicionar tarifa de referência, continuidade, perdas e alcance de benefícios, com acesso aos respectivos módulos.
- **Fontes de partida:** S5, S6, S8, S9, S10. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal/anual conforme fonte.
- **Critério específico de aceite:** Não apresentar séries anuais como situação do dia; cobertura explícita.

### P007 — Visão geral / O que observar

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: regras. Confirmar no código atual.
- **Pergunta:** Quais alterações são relevantes?
- **Visualização principal:** Lista de eventos e anomalias.
- **Implementação exigida:** Adicionar piso/teto, restrição renovável e revisões; definir limiar, duração e retorno à normalidade.
- **Fontes de partida:** D0, S4, S20. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por disponibilidade.
- **Critério específico de aceite:** Alerta não implica causalidade; frequência de falsos alarmes monitorada.

### P008 — PLD / Entenda o preço

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** O que o PLD remunera e como é formado?
- **Visualização principal:** Explicação curta e diagrama navegável.
- **Implementação exigida:** Concluir conceitos nas regras CCEE e documentos dos modelos; exemplo de liquidação com suas simplificações.
- **Fontes de partida:** D0, S2. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Editorial por vigência.
- **Critério específico de aceite:** Toda ligação conceitual validada; exemplo não se passa por contabilização real.

### P009 — PLD / CMO e formação de preço

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** Qual a relação entre custo e preço?
- **Visualização principal:** Séries em painéis alinhados.
- **Implementação exigida:** Separar DECOMP semanal de DESSEM; alinhar entrega, granularidade e configuração; documentar diferenças ONS/CCEE.
- **Fontes de partida:** S3, S2. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Semi-horário/horário/semanal.
- **Critério específico de aceite:** Não comparar valores de semanas e dias distintos como se fossem o mesmo produto.

### P010 — PLD / Limites, piso e tetos

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: dados. Confirmar no código atual.
- **Pergunta:** Quando o preço encosta nos limites?
- **Visualização principal:** Calendário e barras de permanência.
- **Implementação exigida:** Integrar atos anuais, vigência, mínimo, teto estrutural e horário; usar tolerância monetária documentada.
- **Fontes de partida:** S20, S2. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Horário; regime anual.
- **Critério específico de aceite:** Conferência no ato primário; não inferir limite pelo mínimo observado.

### P011 — PLD / Histórico e distribuição

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: dados. Confirmar no código atual.
- **Pergunta:** O preço está alto para esta época?
- **Visualização principal:** Linha, mapa hora × dia e distribuição.
- **Implementação exigida:** Manter janelas; incorporar percentis sazonais/regime, preços reais opcionais e tratamento de empates.
- **Fontes de partida:** S1, S2, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Horário até mensal.
- **Critério específico de aceite:** Média temporal e ponderada identificadas; períodos parciais sinalizados.

### P012 — PLD / Diferenças regionais

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** Quando e quanto os preços se separam?
- **Visualização principal:** Pequenos múltiplos e matriz de diferenças.
- **Implementação exigida:** Exibir amplitude horária, frequência e pares; sincronizar mapa com intercâmbios; evitar diagnóstico causal automático.
- **Fontes de partida:** S1, S21. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Hora comum.
- **Critério específico de aceite:** Todas as diferenças calculadas entre mesmos intervalos e versões compatíveis.

### P013 — Previsões e modelos / Previsão atual

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem números. Confirmar no código atual.
- **Pergunta:** Quais os preços possíveis nos próximos períodos?
- **Visualização principal:** Faixas de previsão e tabela 4 × 7.
- **Implementação exigida:** Concluir as pendências de validação; preservar W1–W4/M1–M3; B0 apenas como referência aprovada e identificada.
- **Fontes de partida:** D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Rodada diária 07h/08h Brasília.
- **Critério específico de aceite:** Valores reais do modelo, alvo e emissão preservados; bandas só com método documentado.

### P014 — Previsões e modelos / Registro de modelos

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** Como cada previsão foi calculada?
- **Visualização principal:** Fichas comparáveis.
- **Implementação exigida:** Publicar entradas, pesos/configuração C1, corte, limitações, versões, horizontes e aprovação.
- **Fontes de partida:** D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por versão.
- **Critério específico de aceite:** Reexecução reproduz a previsão arquivada dentro da tolerância definida.

### P015 — Previsões e modelos / Arquivo de emissões

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: vazio. Confirmar no código atual.
- **Pergunta:** O que foi previsto antes do resultado?
- **Visualização principal:** Tabela filtrável imutável.
- **Implementação exigida:** Guardar emissão, entrega, quantis, versão, falha e realizado; evitar sobrescrita por revisão posterior.
- **Fontes de partida:** D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Diário, apuração por entrega.
- **Critério específico de aceite:** Nenhuma previsão registrada retroativamente como se fosse original.

### P016 — Previsões e modelos / Desempenho e calibração

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Integrar. Confirmar no código atual.
- **Pergunta:** O modelo supera referências simples?
- **Visualização principal:** Erro por horizonte e gráfico de cobertura.
- **Implementação exigida:** Publicar MAE, viés, escores probabilísticos, cobertura, largura e baselines; separar backtest e prospectivo.
- **Fontes de partida:** D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal após alvos maturarem.
- **Critério específico de aceite:** Teste fora da amostra e sem dado posterior ao corte; incerteza e tamanho amostral explícitos.

### P017 — Água e clima / Armazenamento

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: dados. Confirmar no código atual.
- **Pergunta:** Quanta energia está armazenada?
- **Visualização principal:** Faixa sazonal e pequenos múltiplos.
- **Implementação exigida:** Manter SIN/subsistemas e longo prazo; conferir pesos por capacidade e regime; incluir energia absoluta.
- **Fontes de partida:** S21, D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Diário; subsistema/REE/bacia quando disponível.
- **Critério específico de aceite:** Agregado reproduzível; amostra e mudanças de capacidade documentadas.

### P018 — Água e clima / Afluência

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: dados. Confirmar no código atual.
- **Pergunta:** A água que chega está acima do normal?
- **Visualização principal:** Linha ENA/MLT e tabela.
- **Implementação exigida:** Manter janelas de 30 dias; calcular razão de somas compatíveis; investigar versão da MLT.
- **Fontes de partida:** S21, D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Diário; subsistema/REE/bacia.
- **Critério específico de aceite:** Unidades e períodos do numerador e denominador compatíveis; sem média simples de percentuais.

### P019 — Água e clima / Chuva, temperatura e clima

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Integrar. Confirmar no código atual.
- **Pergunta:** Como o clima se relaciona com água e demanda?
- **Visualização principal:** Mapas de anomalia e séries.
- **Implementação exigida:** Integrar precipitação e temperatura de fonte pública; separar observação, previsão meteorológica e cenário.
- **Fontes de partida:** S21, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Diário/mensal; estações ou bacias.
- **Critério específico de aceite:** Cobertura de estações/grades e agregação espacial publicadas.

### P020 — Água e clima / Reservatórios e balanço

- **Prioridade de execução:** P2; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Integrar. Confirmar no código atual.
- **Pergunta:** Por que o armazenamento mudou?
- **Visualização principal:** Séries por reservatório e componentes.
- **Implementação exigida:** Incluir reservatórios/REE com perímetro; mostrar afluência, geração e vertimentos quando comparáveis; resíduos explícitos.
- **Fontes de partida:** S21, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Diário.
- **Critério específico de aceite:** Não explicar variação de EAR apenas pela ENA; nenhum balanço fecha por ajuste arbitrário.

### P021 — Geração / Matriz efetiva

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: dados. Confirmar no código atual.
- **Pergunta:** Quais fontes atenderam a carga?
- **Visualização principal:** Áreas por energia e barras de participação.
- **Implementação exigida:** Conferir MMGD e quebra de 2023; separar gás, carvão, óleo, biomassa e nuclear onde a fonte permitir.
- **Fontes de partida:** S21, S14. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Horário/diário; SIN e subsistemas.
- **Critério específico de aceite:** Energia e participação reconciliadas; categorias desconhecidas permanecem explícitas.

### P022 — Geração / Despacho térmico

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** Quanto gerou e por que foi acionado?
- **Visualização principal:** Barras por combustível e motivo.
- **Implementação exigida:** Integrar geração por motivo de despacho e CVU com vigência; evitar inferir motivo somente do PLD.
- **Fontes de partida:** S21, D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Usina/hora ou resolução da fonte.
- **Critério específico de aceite:** Combustível e motivo são dimensões separadas; soma consistente com universo divulgado.

### P023 — Geração / Renováveis restringidas

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Integrar. Confirmar no código atual.
- **Pergunta:** Quanta geração foi restringida?
- **Visualização principal:** Mapa de usinas, histórico e causas.
- **Implementação exigida:** Integrar eólica e solar; distinguir potência restringida de energia não gerada; respeitar categorias oficiais e revisões.
- **Fontes de partida:** S4, S21. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Usina/semi-hora conforme recurso.
- **Critério específico de aceite:** Denominador da taxa documentado; corte não confundido com indisponibilidade ou falta de vento.

### P024 — Geração / Capacidade e utilização

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Integrar. Confirmar no código atual.
- **Pergunta:** Quanto está instalado e quanto produz?
- **Visualização principal:** Barras e distribuição por usina.
- **Implementação exigida:** Combinar SIGA, MMGD e geração com correspondência temporal; fator de capacidade usa potência operacional ao longo do período.
- **Fontes de partida:** S14, S21, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Usina/fonte; mensal.
- **Critério específico de aceite:** Sem dupla contagem MMGD; não usar capacidade final para todo o histórico sem ressalva.

### P025 — Carga / Nível e crescimento

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: dados. Confirmar no código atual.
- **Pergunta:** Quanto o sistema está consumindo?
- **Visualização principal:** Histórico e comparação sazonal.
- **Implementação exigida:** Preservar séries por região; mostrar bruto, calendário e revisão; comparações mensais parciais compatíveis.
- **Fontes de partida:** S21, D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Diário; SIN/subsistema.
- **Critério específico de aceite:** Não interpretar +10,5% como atividade econômica sem evidência adicional.

### P026 — Carga / MMGD e perfil horário

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Integrar. Confirmar no código atual.
- **Pergunta:** Qual parcela é estimada e quando ocorre o pico?
- **Visualização principal:** Curvas horárias e decomposição.
- **Implementação exigida:** Separar carga, MMGD e carga líquida somente com definições compatíveis; marcar que MMGD pode ser estimativa da fonte.
- **Fontes de partida:** S21, D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Horário.
- **Critério específico de aceite:** Nenhuma dupla contagem; tipo de carga e conceito de líquido declarados.

### P027 — Carga / Clima e calendário

- **Prioridade de execução:** P2; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Quanto da variação é compatível com clima e calendário?
- **Visualização principal:** Contribuições de modelo e resíduos.
- **Implementação exigida:** Estimar temperatura e feriados fora da amostra; publicar intervalo e resíduo; chamar de decomposição estatística.
- **Fontes de partida:** S21, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Diário.
- **Critério específico de aceite:** Resultado não apresentado como causal; backtest e sensibilidade publicados.

### P028 — Rede / Circulação de energia

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** Como a energia circula entre regiões?
- **Visualização principal:** Mapa de fluxos e tabela.
- **Implementação exigida:** Mudar pergunta; alinhar PLD e fluxo; mostrar sentidos, programado/verificado e fluxos brutos versus líquidos.
- **Fontes de partida:** S21, D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Horário/diário.
- **Critério específico de aceite:** Não inferir saturação pela espessura da seta ou pela diferença de preço.

### P029 — Rede / Balanço e exterior

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** De onde vem a diferença de energia?
- **Visualização principal:** Balanço reconciliado e resíduos.
- **Implementação exigida:** Conferir dicionário de intercâmbio SIN; integrar exterior; documentar perdas e sinais somente se comprovados.
- **Fontes de partida:** S21, D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Intervalo comum.
- **Critério específico de aceite:** Resíduo explicado no perímetro correto ou sinalizado; não forçar soma zero.

### P030 — Rede / Restrições e capacidade

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Integrar. Confirmar no código atual.
- **Pergunta:** Quando há evidência de limitação da rede?
- **Visualização principal:** Eventos e fluxo versus limite.
- **Implementação exigida:** Localizar limites operativos e vigências; quando indisponíveis, manter painel de eventos/restrições publicados com pergunta própria.
- **Fontes de partida:** S21, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Restrição/intervalo; fonte a localizar.
- **Critério específico de aceite:** Sem percentual de utilização calculado com limite nominal de linha usado como limite regional.

### P031 — Rede / Planejado e realizado

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** Quanto o fluxo divergiu do programa?
- **Visualização principal:** Faixa de desvios e tabela.
- **Implementação exigida:** Destacar grandes desvios com materialidade; comparar programa da versão correta com operação realizada.
- **Fontes de partida:** S21, D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Horário/diário.
- **Critério específico de aceite:** Desvio não automaticamente chamado de falha; programa e revisão identificados.

### P032 — Mercado / Livre e regulado

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Como se distribui o consumo?
- **Visualização principal:** Barras empilhadas e tabela.
- **Implementação exigida:** Catalogar recursos CCEE por tema; publicar ACL/ACR, unidades e consumo onde públicos; conferir universo contra fonte.
- **Fontes de partida:** S2. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal; schema a confirmar.
- **Critério específico de aceite:** ACL+ACR reconcilia com o universo escolhido, sem igualar automaticamente à carga do ONS.

### P033 — Mercado / Agentes e migração

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Quem participa e como a composição mudou?
- **Visualização principal:** Entradas/saídas e séries.
- **Implementação exigida:** Separar agente, perfil e unidade consumidora; mostrar estoque e fluxo com identificadores oficiais.
- **Fontes de partida:** S2, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal.
- **Critério específico de aceite:** Sem chamar novos perfis de novas empresas; cancelamentos e migrações definidos.

### P034 — Mercado / MRE e GSF

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Como foi o ajuste da garantia física?
- **Visualização principal:** Série com referência e tabela.
- **Implementação exigida:** Integrar fatores oficiais e definições; explicar alocação de risco e regimes; não inferir exposição financeira individual.
- **Fontes de partida:** S2. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal; schema a confirmar.
- **Critério específico de aceite:** GSF reconciliado à publicação oficial; garantia física e geração não misturadas.

### P035 — Mercado / Encargos e contabilização

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Quais custos públicos aparecem na liquidação?
- **Visualização principal:** Barras por tipo e histórico.
- **Implementação exigida:** Integrar agregados de ESS e outros mecanismos disponíveis; distinguir competência, pagamento e reprocessamento.
- **Fontes de partida:** S2, S6. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal; schema a confirmar.
- **Critério específico de aceite:** Nenhuma série inventada de PPA ou curva a termo; preços privados permanecem fora do escopo aberto.

### P036 — Empresas / Cadastro e ativos

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Quem opera quais ativos?
- **Visualização principal:** Tabela de entidades e mapa de ativos.
- **Implementação exigida:** Começar por CNPJ/CEG/código ANEEL; publicar vínculos provados e percentual de cobertura; grupo econômico como camada posterior.
- **Fontes de partida:** S14, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por vigência cadastral.
- **Critério específico de aceite:** Zero vínculo por mera semelhança de nome; ativo sem vínculo permanece identificado.

### P037 — Empresas / Perfil da distribuidora

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Como a empresa atende sua área?
- **Visualização principal:** Ficha e comparador.
- **Implementação exigida:** Reutilizar tarifa, perdas, continuidade e qualidade; comparar pares e evolução própria.
- **Fontes de partida:** S5, S8, S9, S16. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal/anual.
- **Critério específico de aceite:** Mesma consulta dos módulos de origem; conjunto elétrico e área oficial preservados.

### P038 — Empresas / Finanças e investimentos

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Como evoluem os fundamentos reportados?
- **Visualização principal:** Séries e tabelas de demonstrações.
- **Implementação exigida:** Integrar dados públicos ANEEL/CVM; separar consolidado, individual e regulatório; normalizar períodos e revisões.
- **Fontes de partida:** S6, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Trimestral/anual.
- **Critério específico de aceite:** Sem somar subsidiária e controladora; cobertura de listadas não apresentada como setor inteiro.

### P039 — Empresas / Controle e concentração

- **Prioridade de execução:** P2; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Integrar. Confirmar no código atual.
- **Pergunta:** Quem controla e qual a concentração?
- **Visualização principal:** Árvore societária e participação.
- **Implementação exigida:** Participação proporcional versus capacidade controlada como métricas distintas; vigência dos vínculos e dupla contagem controladas.
- **Fontes de partida:** S14, S22, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por evento/ano.
- **Critério específico de aceite:** Sem consolidação onde faltar participação; fronteira de mercado explícita para índices de concentração.

### P040 — Expansão / Carteira de projetos

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** O que está planejado e em construção?
- **Visualização principal:** Mapa, tabela e etapas.
- **Implementação exigida:** Integrar SIGA/RALIE; separar outorgado, obras, operação, revogado; registrar potência por unidade.
- **Fontes de partida:** S14, S15. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Snapshot periódico.
- **Critério específico de aceite:** Outorga não contada como capacidade que certamente entrará.

### P041 — Expansão / Cronograma e atrasos

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Quando deve entrar e o que atrasou?
- **Visualização principal:** Cronograma e revisões.
- **Implementação exigida:** Comparar datas previstas em snapshots históricos com entrada real; estoque atual não reconstrói promessas antigas.
- **Fontes de partida:** S15. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Usina/unidade; mensal.
- **Critério específico de aceite:** Data da previsão conhecida e preservada; atraso sem data-base não publicado.

### P042 — Expansão / Geração e transmissão

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** A expansão vem acompanhada de rede?
- **Visualização principal:** Mapa e séries em painéis separados.
- **Implementação exigida:** Integrar leilões e obras de transmissão; ligação temporal e territorial sem prometer capacidade firme por MW nominal.
- **Fontes de partida:** S14, S15, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Projeto/ano.
- **Critério específico de aceite:** km, MVA, MW e investimento separados; nenhuma soma de unidades incompatíveis.

### P043 — Expansão / Cenários oficiais

- **Prioridade de execução:** P2; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Como o planejamento enxerga a matriz?
- **Visualização principal:** Cenários e realizado.
- **Implementação exigida:** Integrar edição específica do PDE/BEN; comparar realizado, carteira e cenário em camadas distintas.
- **Fontes de partida:** S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por edição.
- **Critério específico de aceite:** Selo CENÁRIO; data-base, hipóteses e universo declarados.

### P044 — Regulação / Limites e regras de preço

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Quais regras valem em cada período?
- **Visualização principal:** Tabela de vigências.
- **Implementação exigida:** Começar por limites PLD e metodologias; ato primário, vigência, alterações e revogações; resolver pendências do PLD.
- **Fontes de partida:** S20, S2. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por ato/ano.
- **Critério específico de aceite:** Publicação não confundida com vigência; teto estrutural e horário em campos separados.

### P045 — Regulação / Linha do tempo

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** O que mudou e quem é afetado?
- **Visualização principal:** Linha do tempo filtrável.
- **Implementação exigida:** Resumo editorial com dispositivo de origem; separar efeito declarado pelo regulador de impacto estimado.
- **Fontes de partida:** S6, S16, S2. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por evento.
- **Critério específico de aceite:** Sem inferir causalidade por coincidência entre norma e gráfico.

### P046 — Regulação / Consultas e agenda

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: sem dados. Confirmar no código atual.
- **Pergunta:** Quais decisões estão abertas ou próximas?
- **Visualização principal:** Agenda e tabela.
- **Implementação exigida:** Integrar consultas públicas e datas de atualização; status aberto, encerrado e decisão; link oficial.
- **Fontes de partida:** S16, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por evento.
- **Critério específico de aceite:** Prazo e situação verificados; não manter consulta vencida como aberta.

### P047 — Conta de luz / Tarifa e comparação

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Quanto custa um perfil comparável?
- **Visualização principal:** Ranking filtrável e histórico.
- **Implementação exigida:** Usar TE/TUSD de aplicação por classe, modalidade e vigência; perfis de consumo definidos; apresentar itens incluídos.
- **Fontes de partida:** S9, S6. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Distribuidora/vigência.
- **Critério específico de aceite:** Comparar a mesma modalidade; distinguir tarifa homologada, tarifa média e conta simulada.

### P048 — Conta de luz / Composição

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Para onde vai o valor da conta?
- **Visualização principal:** Barras empilhadas e tabela.
- **Implementação exigida:** Energia, rede, encargos e demais itens com bases conciliadas; tributos e iluminação em campos próprios quando disponíveis.
- **Fontes de partida:** S6, S9. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Distribuidora/vigência.
- **Critério específico de aceite:** Componentes fecham com o total; sem dupla contagem TE/TUSD.

### P049 — Conta de luz / Simulador de consumo

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Como minha conta varia com consumo e perfil?
- **Visualização principal:** Simulação e tabela explicada.
- **Implementação exigida:** Permitir kWh e classe; usar vigência correta; tratar bandeira, descontos, tributos e custo de disponibilidade conforme regras verificadas.
- **Fontes de partida:** S9, S6, S10. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Cenário por vigência.
- **Critério específico de aceite:** Resultado rotulado como estimativa quando faltar item; memória de cálculo visível.

### P050 — Conta de luz / Reajustes, bandeiras e subsídios

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** O que mudou e quem financia benefícios?
- **Visualização principal:** Histórico e decomposição.
- **Implementação exigida:** Reajuste versus inflação com períodos comparáveis; bandeiras por vigência; categorias de subsídio com definições.
- **Fontes de partida:** S6, S13, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal/anual.
- **Critério específico de aceite:** Não apresentar diferença PLD–tarifa como margem da distribuidora.

### P051 — Qualidade do serviço / Duração e frequência

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Por quanto tempo e quantas vezes faltou luz?
- **Visualização principal:** Mapa e pequenos múltiplos.
- **Implementação exigida:** Integrar DEC/FEC por conjunto e distribuidora; metas e período comum; explicar unidade e expurgos.
- **Fontes de partida:** S8, S16. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Conjunto elétrico; mensal.
- **Critério específico de aceite:** Agregação ponderada e referência regulatória corretas; não converter centésimos de hora em minutos por leitura literal.

### P052 — Qualidade do serviço / Realizado e limites

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** O serviço cumpriu o padrão?
- **Visualização principal:** Gráfico de pontos realizado × limite.
- **Implementação exigida:** Histórico da distância ao limite e distribuição dos conjuntos; mostrar também magnitude absoluta.
- **Fontes de partida:** S8. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Conjunto/ano.
- **Critério específico de aceite:** Realizado e limite da mesma vigência e cobertura; médias não escondem caudas.

### P053 — Qualidade do serviço / Compensações

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Quais compensações foram pagas?
- **Visualização principal:** Séries, distribuição e tabela.
- **Implementação exigida:** Usar recursos de compensação publicados; separar valor, quantidade, competência e pagamento quando informados.
- **Fontes de partida:** S8. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal.
- **Critério específico de aceite:** Não estimar crédito individual a partir de DEC/FEC agregado.

### P054 — Qualidade do serviço / Atendimento e resiliência

- **Prioridade de execução:** P2; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Como o consumidor é atendido e como a rede se recupera?
- **Visualização principal:** Reclamações, pesquisa e eventos.
- **Implementação exigida:** Adicionar IASC, reclamações normalizadas por clientes e eventos de interrupção quando públicos; escopos separados.
- **Fontes de partida:** S16, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal/anual/evento.
- **Critério específico de aceite:** Número de reclamações não comparado sem população exposta; pesquisa exibe amostra.

### P055 — Perdas / Mapa e comparação

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Onde estão as perdas e como evoluíram?
- **Visualização principal:** Mapa de concessões e tabela.
- **Implementação exigida:** Publicar volume, taxa e histórico com seleção; geometrias e distribuidoras com vigência.
- **Fontes de partida:** S5, S6, S7, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Distribuidora; anual/mensal conforme série.
- **Critério específico de aceite:** Geografia não mais fina que o dado; sem dado separado de zero; taxa agregada ponderada pela base.

### P056 — Perdas / Técnicas e não técnicas

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Qual a composição das perdas?
- **Visualização principal:** Barras e histórico por componente.
- **Implementação exigida:** Separar conceitos, natureza estimada e denominadores; registrar resíduos e não comparáveis.
- **Fontes de partida:** S5, S6, S7. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Distribuidora/ano.
- **Critério específico de aceite:** Não somar percentuais com denominadores diferentes; totais conciliados quando compatíveis.

### P057 — Perdas / Realizado e regulatório

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Quanto diverge da referência reconhecida?
- **Visualização principal:** Pontos pareados e ranking de diferença.
- **Implementação exigida:** Comparar valores do mesmo processo/vigência; oferecer nível, evolução e diferença.
- **Fontes de partida:** S6. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Distribuidora/ciclo.
- **Critério específico de aceite:** Parâmetro regulatório não confundido com perda realizada nem obrigação de perda zero.

### P058 — Perdas / Custo e contexto social

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Qual é a dimensão econômica e territorial?
- **Visualização principal:** Tabela de custo e dispersão.
- **Implementação exigida:** Usar custo reconhecido no processo; contexto socioeconômico agregado; separar descrição de causalidade.
- **Fontes de partida:** S6, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Período/território compatível.
- **Critério específico de aceite:** Sem monetizar por tarifa cheia ou atribuir fraude à população de uma área.

### P059 — Inclusão energética / Tarifa Social

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Onde e quanto o benefício alcança?
- **Visualização principal:** Mapa agregado e evolução.
- **Implementação exigida:** Integrar SCS e fontes atuais; validar recorte de beneficiários, UC e famílias; não depender da base antiga descontinuada.
- **Fontes de partida:** S10, S11, S12. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal; granularidade confirmada.
- **Critério específico de aceite:** Contagens e unidades corretas; nenhuma exposição de beneficiários individuais.

### P060 — Inclusão energética / Cobertura potencial

- **Prioridade de execução:** P2; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Quem pode estar ficando de fora?
- **Visualização principal:** Comparação de cobertura e intervalos.
- **Implementação exigida:** Cruzar apenas universos compatíveis de elegibilidade e beneficiários; cadastro total não equivale a elegível.
- **Fontes de partida:** S10, S11, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Agregado; regras por vigência.
- **Critério específico de aceite:** Lacuna de cobertura só publicada com denominador elegível validado; proxy recebe rótulo próprio.

### P061 — Inclusão energética / Peso no orçamento

- **Prioridade de execução:** P2; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Para quem a energia pesa mais?
- **Visualização principal:** Distribuição por faixa de renda.
- **Implementação exigida:** Usar POF com pesos, estratos e incerteza; distinguir estatística histórica de atualização modelada; limiares como análise de sensibilidade.
- **Fontes de partida:** S18. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Domínios amostrais suportados.
- **Critério específico de aceite:** Sem mapa municipal observado derivado indevidamente de amostra; razão de médias não substitui média de razões.

### P062 — Inclusão energética / Acesso e sistemas isolados

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Quem ainda precisa de acesso adequado?
- **Visualização principal:** Mapa e histórico de atendimento.
- **Implementação exigida:** Integrar resultados públicos de universalização e sistemas isolados; domicílio conectado e serviço confiável são dimensões distintas.
- **Fontes de partida:** S17, S16, S23. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Programa/território; periodicidade da fonte.
- **Critério específico de aceite:** Não usar carga do SIN como medida de acesso para todo o Brasil.

### P063 — Transição e ambiente / MMGD e distribuição territorial

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Onde a geração distribuída cresce?
- **Visualização principal:** Mapa e histórico.
- **Implementação exigida:** Integrar cadastro MMGD, capacidade e unidades; relacionar território sem inferir renda do beneficiário individual.
- **Fontes de partida:** S14, S22. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Município/ano conforme fonte.
- **Critério específico de aceite:** Capacidade cadastrada não apresentada como energia gerada; revisão e duplicidade controladas.

### P064 — Transição e ambiente / Emissões

- **Prioridade de execução:** P2; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Novo. Confirmar no código atual.
- **Pergunta:** Como varia a intensidade de emissões?
- **Visualização principal:** Série de fator médio e tabela.
- **Implementação exigida:** Usar fator oficial MCTI; separar geração/consumo e fronteira; emissões horárias próprias somente como estimativa metodológica.
- **Fontes de partida:** S19, S21. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Mensal/anual.
- **Critério específico de aceite:** Fator médio não apresentado como marginal; unidades CO2 e CO2e preservadas.

### P065 — Aprenda / Glossário completo

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** O que significam os conceitos?
- **Visualização principal:** Verbetes e exemplos ligados aos gráficos.
- **Implementação exigida:** Concluir oito pendências do inventário; acrescentar tarifa, perdas, DEC/FEC, inclusão e emissões.
- **Fontes de partida:** D0, S5, S8, S9, S2. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por conceito e vigência.
- **Critério específico de aceite:** Definição clara, exemplo, não confundir com, fonte primária e data de revisão.

### P066 — Aprenda / Trilhas e exemplos

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: referência. Confirmar no código atual.
- **Pergunta:** Como ligar conceitos aos números?
- **Visualização principal:** Percursos e exemplos interativos.
- **Implementação exigida:** Explicar água→operação→preço e custo→tarifa→orçamento com relações tipificadas; exemplos sintéticos rotulados.
- **Fontes de partida:** D0, S2, S5, S8. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Editorial.
- **Critério específico de aceite:** Usuário chega do conceito à evidência e retorna ao contexto.

### P067 — Dados / Catálogo utilizável

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: catálogo. Confirmar no código atual.
- **Pergunta:** Quais dados estão de fato validados?
- **Visualização principal:** Tabela com filtros e status.
- **Implementação exigida:** Separar catalogado, recurso verificado, integrado, validado e publicado; granularidade CCEE recurso a recurso.
- **Fontes de partida:** D0, S2. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por conjunto.
- **Critério específico de aceite:** Nenhum salto de catalogado para utilizado oculta validação; descontinuados identificados.

### P068 — Dados / Saúde e revisões

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: parcial. Confirmar no código atual.
- **Pergunta:** O que atrasou ou mudou?
- **Visualização principal:** Calendário de atualização e mudanças.
- **Implementação exigida:** Mostrar completude, último período, captura, falha e magnitude de revisões; SLA por frequência da fonte.
- **Fontes de partida:** D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por execução/conjunto.
- **Critério específico de aceite:** Falha nunca renova artificialmente a data do dado; versão anterior preservada.

### P069 — Dados / Download e reprodução

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: referência. Confirmar no código atual.
- **Pergunta:** Consigo reproduzir este gráfico?
- **Visualização principal:** Pacote por consulta e versão.
- **Implementação exigida:** Oferecer CSV/XLSX de consulta e formato colunar para séries maiores; dicionário, filtros, fórmula e versão.
- **Fontes de partida:** D0, B7. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por publicação.
- **Critério específico de aceite:** Pacote gera o mesmo agregado e não depende de links temporários para existir.

### P070 — Metodologia / Regras e limites

- **Prioridade de execução:** P0; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: referência. Confirmar no código atual.
- **Pergunta:** Quais interpretações são permitidas?
- **Visualização principal:** Regras por indicador.
- **Implementação exigida:** Corrigir afirmação sobre limites de intercâmbio catalogados; documentação de unidades, recortes, revisão e cálculo.
- **Fontes de partida:** D0, S3, S5, S8. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por versão.
- **Critério específico de aceite:** Cada afirmação de fonte integrada corresponde a recurso realmente verificado.

### P071 — Metodologia / Avaliação dos painéis

- **Prioridade de execução:** P1; obrigatório na entrega integral.
- **Estado no diagnóstico histórico:** Atual: governança pendente. Confirmar no código atual.
- **Pergunta:** Como demonstrar que a qualidade evoluiu?
- **Visualização principal:** Matriz de aceite e evidência.
- **Implementação exigida:** Criar o arquivo de avaliação previsto; avaliar didática, visual, navegação, interatividade, acessibilidade, cobertura, correção, proveniência, atualidade e operação.
- **Fontes de partida:** D0. Consultar o Anexo B e verificar o recurso específico.
- **Recorte e frequência:** Por entrega.
- **Critério específico de aceite:** Notas só após inspeção e testes; não atribuir nota estética com base apenas em descrição.

---

## Anexo B — Fontes, referências e estado da verificação

Os estados abaixo descrevem a pesquisa externa realizada em 30/09/2026. Não significam que o Claude já baixou, integrou ou auditou todos os registros. Revalide recursos, dicionários, vigência, acesso, licença e cobertura na implementação. Metadados verificados não são uma certificação dos números.

### D0 — Documento do projeto

- **Referência:** Documento anexado: PAINEL_SETOR_ELETRICO_PARA_CRITICA.md
- **Situação na pesquisa de referência:** documento fornecido pelo responsável.
- **Observação:** Inventário e regras declarados; código não inspecionado.

### B1 — DiscoverWater — perdas

- **Endereço:** https://www.discoverwater.co.uk/leaking-pipes
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Didática, métricas de comparação e metas.

### B2 — DiscoverWater — governança

- **Endereço:** https://www.discoverwater.co.uk/about
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Origem e revisão dos dados.

### B3 — VaasaETT

- **Endereço:** https://vaasaett.com/services/energy-cost-insights-forecast/
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Escopo comercial; metodologia e desempenho não auditados.

### B4 — HEPI

- **Endereço:** https://www.energypriceindex.com/
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Comparabilidade de preços residenciais.

### B5 — SMARD

- **Endereço:** https://www.smard.de/en
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Integração dos temas operacionais e previsões.

### B6 — EIA — guia de dados

- **Endereço:** https://www.eia.gov/electricity/data/guide/pdf/guide.pdf
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Explorador de dados e mapas.

### B7 — Open Power System Data

- **Endereço:** https://data.open-power-system-data.org/
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Pacotes, documentação, scripts e fontes.

### S1 — CCEE — PLD diário

- **Endereço:** https://www.ccee.org.br/?trk=public_profile_project-title
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Quatro médias de 30/09/2026 conferidas com o anexo.

### S2 — CCEE — dados abertos

- **Endereço:** https://dadosabertos.ccee.org.br/
- **Situação na pesquisa de referência:** portal verificado.
- **Observação:** Schemas específicos de ACL/ACR, MRE/GSF e encargos a confirmar.

### S3 — ONS — CMO semi-horário

- **Endereço:** https://dados.ons.org.br/dataset/cmo-semi-horario
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** CMO DESSEM por subsistema, agregado de barras ponderado por carga.

### S4 — ONS — restrições de eólicas

- **Endereço:** https://dados.ons.org.br/dataset/restricao_coff_eolica_usi
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** Universo de usinas especificado pela fonte e dados sujeitos a revisão.

### S5 — ANEEL — conceito de perdas

- **Endereço:** https://www.gov.br/aneel/pt-br/assuntos/distribuicao/perdas-de-energia/perdas-de-energia
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Perdas técnicas, comerciais e tratamento regulatório.

### S6 — ANEEL — tarifas, perdas e informações econômicas

- **Endereço:** https://www.gov.br/aneel/pt-br/centrais-de-conteudos/relatorios-e-indicadores/tarifas-e-informacoes-economico-financeiras
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Página oficial de acesso aos relatórios; extração de cada relatório a implementar.

### S7 — ANEEL — SAMP Balanço

- **Endereço:** https://dadosabertos.aneel.gov.br/dataset/samp-balanco
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** CSV/Parquet; balanço energético mensal de distribuidoras.

### S8 — ANEEL — continuidade DEC/FEC

- **Endereço:** https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** Valores, limites, parcelas, compensações e atributos de conjuntos.

### S9 — ANEEL — tarifas de aplicação

- **Endereço:** https://dadosabertos.aneel.gov.br/pt_BR/dataset/tarifas-distribuidoras-energia-eletrica
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** TE, TUSD e vigências; verificar unidade e modalidade em cada linha.

### S10 — ANEEL — SCS

- **Endereço:** https://dadosabertos.aneel.gov.br/dataset/scs-sistema-de-controle-de-subvencoes-e-programas-sociais
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** Informação agregada sobre descontos e subvenções; schema a integrar.

### S11 — ANEEL — beneficiários CDE

- **Endereço:** https://dadosabertos.aneel.gov.br/dataset/beneficiarios-da-cde
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** Base revisável. Publicar agregados necessários ao tema social.

### S12 — ANEEL — série antiga Tarifa Social

- **Endereço:** https://dadosabertos.aneel.gov.br/dataset/tarifa-social-de-energia-eletrica-beneficiarios
- **Situação na pesquisa de referência:** descontinuado.
- **Observação:** O catálogo informa substituição pela base de beneficiários CDE.

### S13 — ANEEL — subsídios tarifários

- **Endereço:** https://dadosabertos.aneel.gov.br/pt_BR/dataset/subsidios-tarifarios
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** Histórico de subsídios; não confundir categorias com transferências a famílias.

### S14 — ANEEL — SIGA

- **Endereço:** https://dadosabertos.aneel.gov.br/pt_BR/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** Empreendimentos de geração e fases.

### S15 — ANEEL — RALIE

- **Endereço:** https://dadosabertos.aneel.gov.br/pt_BR/dataset/ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica
- **Situação na pesquisa de referência:** recurso verificado.
- **Observação:** Recursos por usina, unidade geradora e leilão.

### S16 — ANEEL — distribuição

- **Endereço:** https://www.gov.br/aneel/pt-br/centrais-de-conteudos/relatorios-e-indicadores/distribuicao
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Ponto de acesso para qualidade, distribuidoras e sistemas isolados.

### S17 — MME — informações analíticas

- **Endereço:** https://www.gov.br/mme/pt-br/assuntos/observatorio-de-minas-e-energia/energia-eletrica/outras-informacoes-analiticas
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Localização de informações de universalização; recursos específicos a integrar.

### S18 — IBGE — POF

- **Endereço:** https://www.ibge.gov.br/estatisticas/sociais/saude/24786-pof-2017-2018.html
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Pesquisa amostral; base histórica não representa automaticamente 2026.

### S19 — MCTI — fatores de emissão

- **Endereço:** https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/dados-e-ferramentas/fatores-de-emissao
- **Situação na pesquisa de referência:** verificado.
- **Observação:** Distinguir fator médio para inventários de fatores marginais.

### S20 — CCEE — InfoPLD de 09/04/2026

- **Endereço:** https://www.ccee.org.br/documents/80415/31116705/InfoPLD_Diario09042026.pdf/b4ba9472-d164-91fd-51f6-4e97b968cc13
- **Situação na pesquisa de referência:** publicação localizada.
- **Observação:** Publicação com limites usados na projeção; não substitui conferência dos atos anuais da ANEEL.

### S21 — ONS / demais integrações

- **Endereço:** https://dados.ons.org.br/
- **Situação na pesquisa de referência:** catálogo do projeto.
- **Observação:** EAR, ENA, carga, balanço, geração térmica, internacional, reservatórios: recursos específicos descritos no anexo.

### S22 — ANEEL / geometria e cadastro

- **Endereço:** https://dadosabertos.aneel.gov.br/
- **Situação na pesquisa de referência:** a confirmar.
- **Observação:** Malha oficial de concessões, vínculos municipais e histórico societário: verificar recursos e vigência.

### S23 — EPE / CVM / ANA / INMET / IBGE

- **Situação na pesquisa de referência:** catálogo do projeto.
- **Observação:** Fontes candidatas para cenários, finanças, clima e contexto; verificar o recurso exato antes de publicar.

---

## Anexo C — Achados históricos que exigem fechamento explícito

Investigue estes achados no estado atual. Os números e pendências abaixo pertencem ao diagnóstico de 30/09/2026 e não devem ser fixados na interface nem tratados como condições atuais sem nova leitura. Para cada item, registre evidência de resolução ou bloqueio real.

### A01 — CMO do Norte versus PLD

O documento aproximava CMO semanal de diferentes semanas e PLD diário, com linguagem de multiplicador. Corrigir a comparação antes de explicar economicamente a diferença; verificar tempo de entrega, DECOMP/DESSEM, decks e restrições.

### A02 — Sequência de CMO igual a zero

O diagnóstico descrevia 61 semanas consecutivas, entre 30/12/2022 e 23/02/2024, com zeros. Verificar origem, publicação, campos e extração; se confirmada, preservar os zeros reais e explicar a comparação com preço, sem inventar causalidade.

### A03 — Unidade do CMO

Havia ambiguidade de unidade entre média e patamares no dicionário. Documentar a confirmação técnica; não corrigir silenciosamente nem assumir que toda indicação R$/MW é equivalente a R$/MWh.

### A04 — Limites regulatórios do PLD

A interface mostrava mínimo observado como referência provisória. Integrar atos anuais e vigências, distinguindo piso, teto horário e teto estrutural; tratar revisões e regras de aplicação.

### A05 — Balanço dos intercâmbios

O inventário relatava dias em que os saldos por subsistema não fechavam no SIN. Verificar perímetro, sinais, exterior e campos; não atribuir o resíduo ao exterior ou a perdas apenas por hipótese.

### A06 — Fonte de limites de intercâmbio

A metodologia afirmava que os limites estavam catalogados, sem conjunto correspondente identificado. Localizar o recurso efetivo e a vigência, ou corrigir a afirmação e registrar a dependência não resolvida.

### A07 — Carga, revisão e MMGD

A variação de +10,5% em sete dias e revisões da série exigiam rastreamento. Reproduzir o cálculo com as datas, a versão e o calendário corretos; investigar MMGD e clima sem usar explicação improvisada.

### A08 — Rodada inicial de previsão

A rodada de 27/09/2026 tinha 28 células sem número e emissão fora do horário pretendido. Corrigir coleta, elegibilidade dos dados, corte e agendamento; confirmar uma rodada real válida antes de declarar rotina operacional.

### A09 — Publicação histórica do PLD

O campo publicado_pela_fonte_em estava ausente e a publicação era marcada como não confiável. Manter a distinção entre primeira captura observada e publicação efetiva; documentar a hipótese LAT1D e seu impacto nos backtests.

### A10 — Governança não materializada

O plano previa avaliação por página e o arquivo não estava presente no diagnóstico. Criar/atualizar o registro real, ligando cada nota e cada aceite à evidência, sem notas automáticas de conveniência.

### A11 — Quebra metodológica na geração

O salto da solar em 29/04/2023 era interpretado como inclusão de MMGD sem conferência primária. Confirmar metodologia e aplicar o tratamento consistente a comparações, agregados, rótulos e textos.

### A12 — Módulos vazios e conceitos pendentes

Mercado, Empresas, Expansão e Regulação estavam sem números, e oito verbetes ainda pendiam. Usar esta lista como rastreamento de dívida histórica; verificar quais itens já evoluíram e concluir os demais.

---

## Anexo D — Verificação rápida de cobertura da entrega

| Grupo de implementação | IDs do Anexo A | Quantidade |
|---|---|---:|
| Mapa | P001, P002, P003 | 3 |
| Visão geral | P004, P005, P006, P007 | 4 |
| PLD | P008, P009, P010, P011, P012 | 5 |
| Previsões e modelos | P013, P014, P015, P016 | 4 |
| Água e clima | P017, P018, P019, P020 | 4 |
| Geração | P021, P022, P023, P024 | 4 |
| Carga | P025, P026, P027 | 3 |
| Rede | P028, P029, P030, P031 | 4 |
| Mercado | P032, P033, P034, P035 | 4 |
| Empresas | P036, P037, P038, P039 | 4 |
| Expansão | P040, P041, P042, P043 | 4 |
| Regulação | P044, P045, P046 | 3 |
| Conta de luz | P047, P048, P049, P050 | 4 |
| Qualidade do serviço | P051, P052, P053, P054 | 4 |
| Perdas | P055, P056, P057, P058 | 4 |
| Inclusão energética | P059, P060, P061, P062 | 4 |
| Transição e ambiente | P063, P064 | 2 |
| Aprenda | P065, P066 | 2 |
| Dados | P067, P068, P069 | 3 |
| Metodologia | P070, P071 | 2 |
| **Total** | **P001 a P071** | **71** |

Os 20 grupos desta matriz são uma organização de execução. Eles não precisam virar 20 itens de navegação de primeiro nível. A arquitetura proposta os organiza em seis grupos, preservando todos os destinos e requisitos.

**Reforço final:** a primeira página deve ensinar a usar o observatório inteiro. Todos os painéis obrigatórios precisam estar completos, bonitos, didáticos, funcionais e rastreáveis. Não troque completude por aparência, nem rigor por números de preenchimento. Execute o trabalho e comprove a entrega.
