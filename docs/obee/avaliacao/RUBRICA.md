# Rubrica de avaliação dos painéis de educação do OBEE

Documento compartilhado entre executor e avaliadores. Vale para todas as rodadas. Escopo: o OBEE e seus painéis de educação (rede municipal das 26 capitais estaduais). Energia e crédito ficam fora, exceto componentes compartilhados afetados por alguma correção.

## Papéis

* **Executor**: examina o projeto e implementa melhorias. Não atribui as notas que valem.
* **Avaliador independente**: inspeciona os painéis, testa tarefas, identifica problemas e atribui notas com evidências. **Não implementa correções** que depois avaliará: não altera `src/`, `scripts/`, `public/`, `pipeline/` nem testes. Escreve apenas relatórios e evidências em `docs/obee/avaliacao/rodada-N/` e arquivos temporários na pasta de rascunho.
* A separação real é por agentes distintos, em contexto limpo, sem acesso às conclusões do executor. Uma segunda passagem do mesmo agente não é revisão independente.

## Princípio editorial

O observatório apresenta indicadores, referências, diferenças, evolução e limitações. **O leitor tira suas conclusões.** Não se classificam governos como bons, ruins, eficientes, ineficientes ou inchados; gasto elevado não é desperdício, gasto reduzido não é eficiência, resultado educacional não é efeito causal da gestão. As notas são privadas e dizem respeito à qualidade dos painéis, não das administrações.

## Escala

* 0 a 2: inutilizável, ausente ou enganoso.
* 3 a 4: falhas graves.
* 5 a 6: funcional, mas exige esforço excessivo ou tem lacunas importantes.
* 7 a 8: bom, com limitações relevantes.
* 9 a 9,4: excelente, com requisitos demonstrados e apenas problemas menores.
* 9,5 a 10: excepcional, com validação adicional que sustente a nota.

Cada nota exige: (1) evidência observável, com rota, estado e captura ou referência ao código; (2) requisitos atendidos; (3) limitações remanescentes; (4) justificativa para não receber nota inferior; (5) identificação de quem avaliou. "Não verificado" é registrado quando faltar evidência e nunca vira nota alta. "Não aplicável" não elimina uma dimensão inteira: adapta-se a aplicação (rastreabilidade de uma página de entrada significa acesso claro às fontes e correspondência com os módulos de origem). Simulações feitas por agentes são inspeções heurísticas, não testes com usuários reais: não se inventam participantes, depoimentos, tempos ou taxas de sucesso. Medições declaram ambiente e protocolo e distinguem laboratório de experiência real.

## Critérios (cada um de 0 a 10, separadamente, por painel)

**A. Layout e hierarquia visual.** Mostra rapidamente a pergunta, o recorte e a informação principal; distingue informação central, comparação e detalhe; combina densidade e espaço de leitura; tipografia, alinhamento e cores consistentes; sem cartões redundantes, títulos excessivos ou paredes de texto; legibilidade de gráficos, valores e referências; funciona no celular sem esconder informação essencial. Beleza não é quantidade de elementos nem espaço vazio: é organização que facilita compreender e comparar.

**B. Didática e compreensão.** Explica conceitos antes de exigir seu uso; traduz siglas e termos técnicos; unidade, período, universo e referência perto do indicador; exemplos e explicações visuais quando ajudam; deixa claro o que o número mede e o que não mede; distingue gasto, oferta, atendimento e resultado; permite aprofundar sem começar pela metodologia. Teste: o leitor consegue explicar o indicador com as próprias palavras.

**C. Utilidade para análise e tomada de decisão.** Permite responder: quanto a capital gastou no total, por habitante e por matrícula; como mudou em termos reais; qual a posição diante de pares comparáveis; quais etapas e populações são atendidas; quais resultados são observados e em quais anos; onde há lacunas que impedem comparação; que informação adicional seria necessária antes de decidir. Apoia investigação sem prescrever conclusões políticas nem atribuir causalidade. Tabela extensa que não responde a essas perguntas não merece nota alta.

**D. Relevância e potencial de impacto social.** Aborda questões relevantes para famílias, educadores, gestores, conselhos e pesquisadores; dá visibilidade a acesso, cobertura, desigualdades e qualidade, quando os dados permitem; permite comunicar e compartilhar recortes com contexto; utilizável sem formação especializada; torna visíveis limitações e ausências socialmente relevantes; facilita controle social e reprodução. Avalia potencial e mecanismos; não se inventa impacto realizado.

**E. Indicadores, referências e comparabilidade.** Referências que ajudam a interpretar magnitude; média, mediana, extremos, distribuição ou razão agregada conforme a pergunta; universo e número de observações elegíveis identificados; distingue média simples, média ponderada e razão agregada; preserva empates e exclusões; pares pertinentes com critérios explícitos; referências nacionais e internacionais quando compatíveis. Não se exige todos os resumos em todos os gráficos. Benchmark internacional exige compatibilidade de conceito, nível, rede, período, moeda, poder de compra e composição do gasto; sem compatibilidade, contexto separado ou impossibilidade registrada. A ausência de um benchmark inadequado não reduz a nota; uma comparação enganosa reduz.

**F. Rigor metodológico.** Numeradores e denominadores compatíveis; distingue despesa municipal em Educação de despesa estritamente atribuível à rede municipal; não chama gasto por matrícula de custo por aluno sem contrato que sustente; explicita estágios da despesa, preços correntes e constantes e deflator; trata ausência, zero, quebra de série e cobertura parcial; elegibilidade consistente em gráfico, tabela, resumo e download; sem alinhamentos artificiais entre gasto anual e resultados de outra periodicidade; ressalvas materiais e bloqueios preservados; sem rateios ou imputações silenciosas. Precisão aparente não substitui validade.

**G. Rastreabilidade e reprodutibilidade.** Reconstruir o número: fonte, arquivo e versão, transformação, fórmula, indicador, apresentação. Exige fonte e referência temporal, data de captura quando pertinente, versão metodológica, fórmula e variáveis, regras de elegibilidade, arquivos ou meios de reprodução, histórico de revisões e exportações compreensíveis fora do site. Link genérico para a página de um órgão não basta.

**H. Qualidade das visualizações.** Gráfico escolhido pela pergunta; escalas, eixos e unidades corretos; comparar sem esforço desnecessário; distingue composição, evolução e distribuição; observações relevantes e extremos visíveis; sem mapas decorativos, eixos duplos enganosos ou cores moralizantes; tabela equivalente acessível; não depende exclusivamente de hover. Mais gráficos só melhoram a nota se acrescentam compreensão.

**I. Navegação e interação.** Organização previsível; preserva filtros e recortes quando apropriado; efeito de cada seleção claro; sincroniza números, gráficos, referências e exportações; permite comparar, ordenar, limpar filtros e voltar; estados vazios com explicação útil; não depende de instruções externas.

**J. Acessibilidade e responsividade.** Teclado; foco visível, rótulos e estrutura semântica; contraste e legibilidade; não usa só cor; alternativas textuais; ampliação e movimento reduzido; controles de toque confortáveis; funciona em 320, 390, 768 e 1440 px. Verificações automáticas e manuais; leitor de tela real quando disponível; não se declara conformidade completa só porque o axe não achou violações.

**K. Confiabilidade técnica e desempenho.** Sem erros de cálculo, navegação ou console; estabilidade visual; conteúdo principal sem atrasos desnecessários; sem transferir dados e código sem utilidade imediata; testes adequados aos riscos; bloqueio de publicação de dados que falhem em validações materiais; valores preservados ao alternar apresentações. Medições declaram ambiente e protocolo.

## Bloqueios de aprovação

Independentemente da média, o painel não é aprovado se houver: valores incorretos; comparação materialmente incompatível; gasto por matrícula com denominador inadequado; ausência tratada como zero; exclusão aplicada ao gráfico mas não ao resumo ou CSV; ressalva essencial escondida; afirmação causal ou julgamento de eficiência sem suporte; perda funcional relevante não justificada; barreira que impeça uma tarefa essencial.

## Regra de aprovação

**Nota mínima 9,0 em cada critério, em cada painel**, sem bloqueios e com evidências registradas. Média alta não compensa critério insuficiente. Estética não compensa erro metodológico. Prioridade das correções: validade e integridade dos dados, depois comparabilidade e utilidade, depois hierarquia, didática e interação, por fim refinamentos estéticos.

## Testes orientados a tarefas

Perfis: familiar ou cidadão; professor ou jornalista; gestor ou conselho de educação; pesquisador. Tarefas representativas:

1. Localizar gasto por habitante e por matrícula de uma capital.
2. Compará-la com um grupo elegível e identificar a referência utilizada.
3. Interpretar uma mudança em reais constantes.
4. Entender por que uma observação foi excluída.
5. Distinguir rede municipal, função Educação e população residente.
6. Localizar atendimento e resultado sem confundir seus períodos.
7. Exportar o recorte e reconhecer suas limitações fora do site.
8. Reproduzir um indicador a partir da documentação.

Registrar sucesso, erros, obstáculos e intervenções necessárias, no navegador.

## Formato da matriz

Uma linha por painel e critério: **painel | critério | nota | justificativa | evidência | correção necessária**, com a identificação do avaliador. Notas com decimais permitidas (uma casa).
