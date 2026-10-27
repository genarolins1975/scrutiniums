# Parecer independente residual — recuperar e compartilhar a análise

27/10/2026. Candidato examinado: `29708ebdb690c35d9d0bba22c507d75f0df0915b`.

Avaliação realizada por agente separado da implementação, com leitura direta das capturas e execução própria das jornadas. O agente não editou o checkout. As imagens finais nesta pasta pertencem a este candidato; a linha de base examinada está em `/workspace/analise-baseline`, correspondente ao main `3e6ca25`.

## Resultado

O fluxo examinado preserva e recupera Pernambuco e 60 litros. O resumo legível resolve a dificuldade de reconhecer o recorte que existia na versão inicial; a URL completa permanece acessível por detalhes. Copiar diretamente na conta, a alternativa à área de transferência e o foco reduzem passos e falhas silenciosas. Não observei cortes ou sobreposições nas superfícies testadas com texto normal.

**Há uma falha residual de legibilidade com texto ampliado a 200% no celular:** “Ver endereço e parâmetros” fica cortado horizontalmente no painel de Salvar a 390 px. A página não apresenta rolagem horizontal global, mas isso não impede o corte interno. Evidência: `texto-200-390.png`. Causa localizada em `public/observatorios.css:35`: `.bp .bp-linha details > summary { white-space:nowrap; }` alcança também os novos detalhes do recorte. Recomenda-se sobreposição específica de regra para esse summary, permitindo quebra e limitando sua largura, sem alterar seletores do cabeçalho. Classificação P2; a verificação de texto ampliado não está aprovada neste candidato.

## Comparação observada

| Antes | Candidato | Por quê |
|---|---|---|
| PE e 60 litros visíveis, mas URL somente com UF | Link e salvamento recuperam PE e 60 litros | A simulação volta com os parâmetros escolhidos |
| Caminho técnico como principal descrição do recorte | “Pernambuco · 60 litros”, endereço completo recolhido | O leitor reconhece a consulta sem decifrar parâmetros |
| Compartilhar exigia retornar ao painel | Copiar link na própria lista | A ação fica junto do recorte salvo |
| Recusa da área de transferência sem alternativa | Endereço selecionável, mensagem e foco | Há saída útil quando a cópia automática falha |
| Data de salvamento sem explicação sobre atualização | Aviso informa uso dos dados disponíveis ao reabrir | Não promete arquivo histórico |

## O que executei

- Chromium local, sessão e banco sintéticos isolados, preferência por movimento reduzido.
- Larguras 320, 390, 768 e 1440 px: painel Salvar e lista Meus recortes, com cópia automática recusada propositalmente.
- Resumo idêntico no painel e na lista; detalhes fechados inicialmente, abertos por Enter e fechados por Espaço.
- Foco no título ao abrir Salvar; foco e seleção na alternativa manual; Escape devolvendo foco a botão.
- Salvamento pela API real local, com 201 na primeira criação e 200 nas repetições do mesmo endereço; deduplicação preservada.
- Link recuperado em outra página com UF PE e 60 litros após hidratação.
- Medição de largura global: 320/320, 390/390, 768/768 e 1440/1440 px, respectivamente.
- Ampliação de texto por duplicação dos tamanhos calculados, em 390 e 1440 px, no painel Salvar. É ensaio de texto ampliado, não zoom nativo do navegador. Corte do rótulo identificado visualmente a 390 px.

A primeira execução do roteiro residual foi interrompida por uma expectativa inadequada do próprio harness: tentava localizar título novo para endereço já salvo, mas a deduplicação preservava o título anterior. O harness passou a usar um título comum; nenhuma alteração no produto ou em seus testes foi feita para obter o resultado. `jornada.json` contém a execução completa corrigida.

## Oito dimensões, sem compensação por média

As notas abaixo são restritas às duas superfícies examinadas, não a todas as páginas da plataforma.

| Dimensão | Salvar recorte | Meus recortes | Fundamento |
|---|---:|---:|---|
| Direção de arte | 8,5 | 8,5 | Tipografia e componentes existentes preservados, sem identidade paralela |
| Hierarquia | 8,5 | 8,5 | Resumo legível e detalhe técnico separados; ações reconhecíveis |
| Tipografia e acabamento | 8 | 8,5 | Bom em tamanho normal; corte do summary ampliado no painel |
| Densidade e profundidade | 8 | 8 | Informações preservadas; explicações introdutórias ainda longas no celular |
| Didática visual | 8,5 | 8,5 | Recorte reconhecível e limite histórico explícito |
| Comparabilidade/identificação | 8,5 | 8,5 | UF e volume coincidem entre consulta, painel e lista |
| Interação e acessibilidade | 8 | 8,5 | Fluxo por teclado e alternativa manual funcionam; legibilidade ampliada pendente |
| Responsividade | 7,5 | 8,5 | Quatro larguras normais aprovadas; texto200% corta rótulo no painel; texto200% da lista não verificado nesta rodada |

## Limites

Não executei leitor de tela, dispositivos físicos, zoom nativo de 200%, produção, auditoria integral de todos os painéis ou nova medição automática de contraste. A sessão autenticada é sintética e local. Não transformo esta verificação em declaração de WCAG integral. As versões antigas das capturas não representam o candidato final.

Decisão: fluxo funcional examinado aprovado em tamanho normal; homologação de texto ampliado reprovada pelo achado P2; excelência de 9 em todas as dimensões não demonstrada. Após ajuste localizado, basta repetir a superfície afetada e completar o ensaio de texto ampliado da lista.
