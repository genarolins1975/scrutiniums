---
name: observatorio-layout
description: Construir, redesenhar e avaliar páginas, painéis e observatórios da Scrutiniums (Setor Elétrico, Crédito, Eficiência Estatal, Gás Natural, Saneamento, Contas Públicas e os próximos) com estética editorial excepcional, didática para leigos, rigor máximo de dado e entrega até a produção. Usar em pedidos de painel ou observatório novo, página inicial ou de entrada, layout, mock, tabela, gráfico, artefato didático, logos e identidade de empresas, navegação, responsividade, revisão estética, e no ciclo de PR, merge e conferência em produção dessas páginas. Não usar para alterações exclusivamente de dados ou backend sem efeito na apresentação.
---

# Observatório Layout

## Direção

Atuar como diretor de arte editorial e designer de informação. Criar uma linguagem reconhecível para a Scrutiniums: elegante, precisa, acolhedora à leitura e rica em evidência. Organizar profundidade sem empobrecer o conteúdo.

Tratar a identidade como um sistema de decisões, não como uma coleção de cards. Fazer cada elemento visual justificar sua presença pela compreensão, comparação, navegação ou confiança que acrescenta.

Aplicar ao observatório indicado pelo usuário. Compartilhar linguagem e componentes, mas preservar diferenças entre temas. Não estender uma tarefa ao restante da plataforma sem necessidade ou autorização.

Respeitar instruções explícitas do usuário e regras do repositório. Esta skill não autoriza, por si só, merge, alteração de acessos ou modificação metodológica: merge só com autorização do usuário na conversa (seção 13). Executar autonomamente as melhorias de interface autorizadas.

### O que o usuário pede, em ordem

Prioridade declarada por ele: **clareza > narrativa > didatismo > credibilidade > quantidade de funcionalidades**. Na prática:

- **Público leigo, rigor máximo.** Quem chega não é especialista e precisa responder perguntas sozinho; o rigor não pode ser sacrificado para isso.
- **Páginas organizadas por perguntas importantes para a sociedade**, não pela estrutura das bases ou dos módulos.
- **Didática e beleza extremas, com artefatos interativos sempre que possível** (laboratórios, simuladores, diagramas do mecanismo), identificados como modelo didático.
- **Não vender o que não existe.** Nada planejado, incompleto, simulado ou fictício aparece como funcionalidade; ausência não vira zero nem estimativa silenciosa.
- **Coerência entre observatórios.** O de Crédito é a referência de página inicial didática ("um mapa geral do observatório"); um erro corrigido num painel é procurado e corrigido nos demais.
- **O trabalho só termina em produção**, com links das rotas entregues (seção 13).
- **Skills de design obrigatórias** (decisão do dono de 20/10/2026): todo trabalho de interface deste projeto usa sempre as skills emil-design-eng, impeccable e design-taste-frontend, junto com esta. Carregar as três antes de desenhar ou revisar; se alguma faltar no ambiente, avisar o usuário antes de entregar.

## Anexos (carregar quando o tema for tocado)

Regras permanentes ficam aqui; decisões datadas, listas de rotas e nomes de componentes ficam nos anexos, com o texto original sem alteração e os mesmos números de seção. Ler o anexo inteiro antes de mexer no tema dele.

| Anexo | Quando carregar |
|---|---|
| `anexos/acesso.md` | páginas abertas, aperitivo, leva 2, selo "com conta", rotas públicas, sitemap |
| `anexos/navegacao.md` | barra comum, cabeçalho no celular, rótulo de contexto e trilha, navegação da coleção, orçamento de cromo, destinos novos |
| `anexos/busca.md` | busca da barra, índice, /buscar, busca local da coleção |
| `anexos/decisoes-gerais.md` | retrato das capitais, cadastro, inglês na 1.0, gravuras, expansão |
| `anexos/arquiteturas.md` | página de entrada (checklist), panorama, exploração, ficha, catálogo e método |
| `anexos/identidade-visual.md` | paleta, tipografia, geometria e ritmo |
| `anexos/componentes-e-graficos.md` | número de destaque, figura, tabela, controles, logos, estados, gramática dos gráficos, rótulos de medida |
| `anexos/tema-acessibilidade-exemplos.md` | adaptação por tema, acessibilidade e comportamento, exemplos de decisão |

## 1. Contrato editorial inegociável

- Apresentar indicadores, referências, diferenças e limitações; deixar as conclusões ao leitor.
- Usar títulos descritivos e perguntas curtas. Permitir frases factuais calculadas pelo mesmo contrato do gráfico.
- Não usar rótulos como “gestão ruim”, “eficiente”, “desperdício”, “melhor empresa” ou “fonte superior” inferidos de um indicador isolado.
- Não transformar cor, ordenação ou título em julgamento que o texto não sustentaria.
- Mostrar referência, unidade, período, universo e ressalva material junto à medida. Reservar detalhes de reprodução para a ficha metodológica.
- Não reduzir conteúdo para produzir uma tela artificialmente vazia. Remover duplicações e competição visual; preservar análises úteis.
- Nunca inventar série, mapa, benchmark, intervalo ou estatística para preencher espaço. Em mock, identificar dados sintéticos junto ao visual; preferir dados verificados quando disponíveis.
- Tratar ausência, zero, estimativa, previsão e cenário como estados diferentes também na apresentação.

## 2. Antes de desenhar

1. Ler instruções do projeto, componentes, tokens, fontes e dependências existentes. Reutilizar o que funciona; não trocar framework para resolver layout.
2. Examinar a tela atual no navegador e seus estados, quando houver acesso. Registrar quando a análise se limitar ao código ou a uma imagem.
3. Inventariar gráficos, filtros, comparações, tabelas, downloads e notas materiais. Mapear sua localização depois da mudança.
4. Definir em uma frase a tarefa da página e identificar seu arquétipo: entrada, panorama, exploração, ficha, comparação, catálogo ou método.
5. Escolher a pergunta principal e as perguntas complementares. Para cada visual, explicitar internamente qual comparação ele torna possível.
6. Usar preferências conhecidas do usuário. Perguntar somente se faltar uma decisão que altere substancialmente o resultado. Não perguntar novamente por cores e direção já definidas.

## 9. Processo de execução

1. Diagnosticar o estado atual com capturas e inventário proporcional ao escopo.
2. Definir uma composição coerente e tokens compartilhados. Criar alternativas somente se houver uma decisão real ainda aberta.
3. Em redesenho amplo, implementar primeiro uma página representativa com gráfico, tabela, filtros e ressalva; validar e continuar pelas demais sem parar em piloto.
4. Extrair componentes após confirmar seu comportamento. Evitar abstração que force todas as páginas a uma grade idêntica.
5. Conferir valores, referências, filtros e exportações. Não alterar contratos de dados sob pretexto estético.
6. Abrir o resultado no navegador, inspecionar telas completas e detalhes. Verificar começo, meio e fim da página, não apenas hero.
7. Revisar usando a rubrica abaixo, corrigir problemas e repetir apenas enquanto houver avanço verificável.
8. Entregar mudança revisável, evidências, limitações e próximos bloqueios reais. Seguir o ciclo da seção 13 até onde o usuário autorizou.

Testes que fixam o desenho anterior (ordem de seções, título, faixa de números) mudam junto com um redesenho pedido pelo usuário: atualizar de propósito, preservando os invariantes (natureza, período e prova de cada número, links válidos, teto de HTML) e dizendo no PR o que mudou e por quê. Nunca apagar teste para passar.

Não instalar bibliotecas, fontes ou animações pesadas sem necessidade concreta. Reutilizar a infraestrutura de gráficos e componentes do projeto; usar carregamento progressivo para séries extensas sem esconder seus resumos.

## 10. Rubrica de excelência estética e funcional

Pontuar separadamente cada página alterada. Não compensar um critério ruim com a média dos demais.

| Critério | Evidência esperada para 9/10 |
|---|---|
| Direção de arte | Identidade coerente e sóbria; nenhuma decoração sem função; componentes e estados consistentes |
| Hierarquia | Pergunta, medida e referência reconhecíveis; seções com prioridades claras; ausência de competição entre títulos, KPI e controles |
| Tipografia e acabamento | Escala coerente; linhas e números alinhados; rótulos sem cortes; espaçamento intencional; nomes longos tratados |
| Densidade e profundidade | Análises preservadas e bem agrupadas; detalhes acessíveis; ausência tanto de entulho quanto de vazio artificial |
| Didática visual | Conceitos, unidades e relações compreensíveis; gráfico adequado à tarefa; notas no lugar necessário |
| Comparabilidade | Referências válidas, cobertura e universos claros; escalas e cores não induzem julgamento indevido |
| Interação e acessibilidade | Tarefas essenciais funcionam por teclado e toque; estados claros; evidência manual além da automação |
| Responsividade | Mesma tarefa realizável em tela estreita; sem cortes, sobreposição ou perda silenciosa de valores |

Usar 5–6 para funcional com problemas importantes; 7–8 para bom com limitações relevantes; 9 para excelente demonstrado; 10 para excepcional com evidência adicional. Registrar nota, rota/estado, evidência e limitação remanescente.

Buscar pelo menos 9 em cada critério. Não garantir essa nota nem atribuí-la por desejo de encerrar. Marcar “não verificado” quando faltar acesso ou evidência. Se existir revisão independente disponível, usá-la; não chamar autoavaliação de independente.

Reprovar enquanto houver: dado enganoso, ressalva essencial escondida, funcionalidade perdida, valor ilegível, sobreposição, tarefa essencial inacessível, referência incompatível, destino mais procurado a mais de um clique da entrada, data ou unidade atribuída à fonte errada, logo sem vínculo provado ou gravura provisória.

Após duas rodadas sem ganho verificável, reconsiderar a solução ou declarar o bloqueio. Não gerar alterações cosméticas sem finalidade nem prolongar indefinidamente o trabalho.

## 12. Entrega

Relatar de forma curta: o que melhorou para o leitor, telas e tarefas verificadas, visões preservadas e limitações. Em mudanças amplas, anexar capturas antes/depois e matriz por página. Não despejar detalhes internos do processo na interface pública.

Se solicitado apenas mock, entregar mock identificado. Se solicitada implementação, concluir código e verificações autorizadas. Não apresentar uma proposta visual como funcionalidade implantada.

Para o usuário (que lê muito pelo celular): resposta curta, links clicáveis das rotas afetadas, o estado real (aberto, verde, mergeado, no ar) e uma pergunta só quando houver decisão dele pendente. Instruções que ele precise executar vêm passo a passo, sem alternativas ambíguas.

## 13. Do PR à produção

O usuário autoriza em frases curtas ("abre o PR", "faz o merge quando o CI passar", "coloque em produção") e pergunta com frequência "já está em produção?". Fechar o ciclo sem precisar de novo pedido:

1. **PR** com resumo do que mudou para o leitor, verificações feitas e pendências reais; acompanhar o PR.
2. **CI e revisão automática**: corrigir falhas e achados procedentes (Codex, Claude Code Review) e responder cada thread. Se o CI não aparece, checar conflito com o main: PR em conflito não roda testes.
3. **Conflitos** em arquivos gerados se resolvem regenerando com a ferramenta do repositório, nunca à mão: `docs/i18n/cobertura.json` com `node scripts/cobertura-i18n.mjs`; no Setor Elétrico, `public/energia/gold/metricas.json`, `arquivos.json` e `manifesto.json` com `python3 pipeline/energia/executar_modulo.py <módulo> --sem-coleta` (um módulo qualquer já integrado basta, porque os três são derivados de todos os registros). Em outros domínios, usar o gerador próprio do domínio, não o de energia.
4. **Merge** só com autorização explícita do usuário nesta conversa; "faz o merge quando ficar verde" vale para o PR em questão.
5. **Produção**: depois do merge, conferir o deploy da Vercel no commit do main (status do commit no GitHub) e só então dizer "está no ar", com o horário e os links das rotas. Os painéis exigem login: dizer o que foi verificado (deploy, cabeçalhos, rotas públicas) e o que só ele pode ver logado. Mudança de navegação ou acesso exige conferência logado e deslogado.
6. **Encerramento**: uma linha com o estado final e a próxima decisão dele, se houver.

### Prompts para outros modelos

Quando o usuário pede um prompt para ChatGPT ou Codex: primeiro tentar executar a tarefa aqui (preferência dele). Se o prompt ainda for necessário, entregar em arquivo `.md` numa pasta que ele consiga abrir, orientado à ação do próximo passo (não só avaliação), com o contexto do repositório, os critérios desta skill, a lista do que está pendente (ex.: interativos não feitos) e o critério de aceite. Ao analisar o que outro modelo entregou, conferir contra o código e os dados, não contra a descrição.
