# Rubrica de avaliação do módulo Saúde nas capitais (OBEE)

Documento compartilhado entre executor e avaliadores. Escopo: o módulo `/eficiencia-estatal/saude-capitais` (Panorama, Gastos, Rede e atenção primária, Atendimento e resultados, Comparar capitais, Dados e métodos) e a página de entrada `/eficiencia-estatal`. Educação, Energia e Crédito ficam fora, exceto componentes compartilhados afetados.

## Papéis

* **Executor**: constrói e corrige. Não atribui as notas que valem.
* **Avaliador independente**: inspeciona, testa tarefas, identifica problemas e atribui notas com evidências. **Não implementa correções** que depois avaliará: não altera `src/`, `scripts/`, `public/`, `pipeline/` nem testes. Escreve apenas relatórios e evidências em `docs/obee/saude/avaliacao/rodada-N/` e arquivos temporários na pasta de rascunho.
* A separação real é por agentes distintos, em contexto limpo, sem acesso às conclusões do executor. Segunda passagem do mesmo agente não é revisão independente.
* Esta avaliação é interna, feita por agentes. Não há validação por pessoas, por usuários reais nem por especialistas externos, e nenhuma nota deve ser apresentada como tal.

## Princípio editorial

O observatório apresenta indicadores, referências, diferenças, evolução e limitações. **O leitor tira suas conclusões.** Não se classificam governos ou redes de saúde como bons, ruins, eficientes ou ineficientes; gasto elevado não é desperdício, gasto reduzido não é eficiência, internação por condição sensível à atenção primária não é falha da prefeitura. As notas são privadas e dizem respeito à qualidade do módulo, não das administrações.

## Escala

* 0 a 2: inutilizável, ausente ou enganoso.
* 3 a 4: falhas graves.
* 5 a 6: funcional, mas exige esforço excessivo ou tem lacunas importantes.
* 7 a 8: bom, com limitações relevantes.
* 9 a 9,4: excelente, com requisitos demonstrados e apenas problemas menores.
* 9,5 a 10: excepcional, com validação adicional que sustente a nota.

Cada nota exige: (1) evidência observável, com rota, estado e captura ou referência ao código; (2) requisitos atendidos; (3) limitações remanescentes; (4) justificativa para não receber nota inferior; (5) identificação de quem avaliou. "Não verificado" é registrado quando faltar evidência e nunca vira nota alta. "Não aplicável" não elimina uma dimensão inteira: adapta-se a aplicação (rastreabilidade de uma página de entrada significa acesso claro às fontes e correspondência com o módulo de origem). Simulações feitas por agentes são inspeções heurísticas, não testes com usuários reais: não se inventam participantes, depoimentos, tempos ou taxas de sucesso. Medições declaram ambiente e protocolo e distinguem laboratório de experiência real.

## Critérios (cada um de 0 a 10, separadamente, por página)

**A. Layout e hierarquia visual.** Mostra rapidamente a pergunta, o recorte e a informação principal; a primeira tela a 1440 por 900 traz um visual principal; distingue informação central, comparação e detalhe; tipografia, alinhamento e cores consistentes; sem cartões redundantes, títulos excessivos ou paredes de texto; gráficos, valores e referências legíveis; no celular, nada essencial fica escondido.

**B. Didática e compreensão.** Explica conceitos antes de exigir seu uso; traduz siglas (SUS, SIOPS, CNES, APS, ASPS, ICSAP, RIPSA, UBS, eSF, eAP); unidade, período, universo e referência perto do indicador; deixa claro o que o número mede e o que não mede; distingue gasto, oferta (estrutura), atendimento e resultado; distingue os três perímetros (recursos executados pelo município, serviços localizados no território, população residente). Teste: o leitor consegue explicar o indicador com as próprias palavras.

**C. Utilidade para análise e tomada de decisão.** Permite responder: quanto a capital liquidou em Saúde, no total e por habitante, em reais correntes e constantes; como se divide por subfunção e natureza; que percentual informa aplicar em ASPS; que estrutura de atenção primária o cadastro registra; que internações por ICSAP ocorrem entre os moradores; como se compara com pares comparáveis; onde há lacunas que impedem comparação; que informação adicional seria necessária. Apoia investigação sem prescrever conclusões nem atribuir causalidade.

**D. Relevância e potencial de impacto social.** Aborda questões relevantes para cidadãos, conselhos de saúde, imprensa, gestores e pesquisadores; dá visibilidade a cobertura, acesso e resultados quando os dados permitem; permite compartilhar recortes com contexto; utilizável sem formação especializada; torna visíveis as limitações e ausências socialmente relevantes. Avalia potencial e mecanismos; não se inventa impacto realizado.

**E. Indicadores, referências e comparabilidade.** Referências que ajudam a interpretar magnitude (história própria, mediana, extremos, distribuição, razão agregada, grupos por região, mínimo legal, referência nacional quando o conceito é o mesmo); universo e número de observações elegíveis identificados; distingue média simples, mediana e razão agregada; preserva empates e exclusões. Referência internacional exige compatibilidade de conceito, perímetro, moeda e período; sem ela, contexto separado ou impossibilidade registrada. A ausência de um benchmark inadequado não reduz a nota; uma comparação enganosa reduz.

**F. Rigor metodológico.** Numeradores e denominadores compatíveis; despesa do município na função Saúde não é gasto total em saúde no território; estágio da despesa (liquidado), preços correntes e constantes e deflator explícitos; ausência, zero, quebra de série (população de 2021 anterior ao Censo 2022) e cobertura parcial tratados; elegibilidade consistente em gráfico, tabela, resumo e download; cobertura potencial da APS apresentada como capacidade teórica e não como pessoas atendidas; ICSAP por município de residência, taxa bruta e AIH como unidade; nenhuma razão despesa por atendimento; sem rateio ou imputação silenciosa. Precisão aparente não substitui validade.

**G. Rastreabilidade e reprodutibilidade.** Reconstruir o número: fonte, arquivo e versão, transformação, fórmula, indicador, apresentação. Exige fonte e referência temporal, data de captura, versão metodológica, fórmula e variáveis, regras de elegibilidade, meios de reprodução, histórico de revisões e exportações compreensíveis fora do site. Link genérico para a página de um órgão não basta.

**H. Qualidade das visualizações.** Gráfico escolhido pela pergunta; escalas, eixos e unidades corretos; distingue composição, evolução e distribuição; extremos visíveis; sem mapas decorativos, eixos duplos enganosos ou cores moralizantes; tabela equivalente acessível; não depende exclusivamente de hover.

**I. Navegação e interação.** Organização previsível; preserva filtros e recortes (URL compartilhável); efeito de cada seleção claro; números, gráficos, referências e exportações sincronizados; permite comparar, ordenar, limpar e voltar; estados vazios com explicação útil; a entrada `/eficiencia-estatal` leva efetivamente a Educação e a Saúde.

**J. Acessibilidade e responsividade.** Teclado; foco visível, rótulos e estrutura semântica; contraste; não usa só cor; alternativas textuais; ampliação a 200% e movimento reduzido; alvos de toque confortáveis; funciona em 320, 390, 768 e 1440 px sem rolagem horizontal da página. Verificações automáticas e manuais; não se declara conformidade completa só porque uma ferramenta automática não achou violações.

**K. Confiabilidade técnica e desempenho.** Sem erros de cálculo, navegação ou console; estabilidade visual; conteúdo principal sem atrasos desnecessários; sem transferir dados e código sem utilidade; testes adequados aos riscos; bloqueio de publicação de dados que falhem em validações materiais; valores preservados ao alternar apresentações. Medições declaram ambiente e protocolo.

## Bloqueios de aprovação

Independentemente da média, o módulo não é aprovado se houver: valor incorreto; comparação materialmente incompatível; despesa do município apresentada como gasto total em saúde; razão despesa por atendimento ou por usuário publicada; ausência tratada como zero; exclusão aplicada ao gráfico mas não ao resumo ou CSV; ressalva essencial escondida; afirmação causal ou julgamento de eficiência sem suporte; nota, ranking de gestão, semáforo, DEA ou SFA, estimativa de desperdício ou recomendação de corte; Distrito Federal misturado às capitais municipais ou sem motivo visível; dado pessoal; barreira que impeça uma tarefa essencial.

## Regra de aprovação

**Nota mínima 9,0 em cada critério, em cada página**, sem bloqueios e com evidências registradas. Média alta não compensa critério insuficiente. Estética não compensa erro metodológico. Prioridade das correções: validade e integridade dos dados, depois comparabilidade e utilidade, depois hierarquia, didática e interação, por fim refinamentos estéticos. Nota não se negocia: se uma página fica abaixo de 9,0, o resultado é registrado e a correção segue, com reavaliação localizada.

## Testes orientados a tarefas

Perfis: cidadão ou conselheiro de saúde; jornalista; gestor; pesquisador. Tarefas:

1. Localizar a despesa em Saúde por habitante de uma capital em 2025 e saber se ela entra na comparação.
2. Compará-la com a mediana das capitais e identificar o grupo de referência usado.
3. Interpretar a diferença entre reais correntes e reais de 2025, e entender por que 2021 não é comparável por habitante.
4. Entender por que Campo Grande 2021 ou Macapá 2025 ficam fora da comparação.
5. Distinguir recursos executados pelo município, serviços no território e população residente.
6. Localizar estrutura de atenção primária e resultado (ICSAP) sem confundir seus períodos, e entender o que a cobertura potencial não é.
7. Exportar um recorte e reconhecer suas limitações fora do site.
8. Reproduzir um indicador a partir da documentação (exemplo: ICSAP de São Paulo em 2024).

Registrar sucesso, erros, obstáculos e intervenções necessárias, no navegador.

## Formato da matriz

Uma linha por página e critério: **página | critério | nota | justificativa | evidência | correção necessária**, com a identificação do avaliador. Notas com uma casa decimal.
