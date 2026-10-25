# Revisão independente de código — Educação PR3

2026-10-25. Protótipos em `/tmp/educacao-pr3`, incluindo consumidores compartilhados e teste novo. Somente leitura; sem executar testes/build/navegador e sem escrever no repositório. Contratos consultados no pedido Educação. Não atribuo notas visuais antes do build.

## Achados concretos

### 1. Elos descartam motivos e ressalvas materiais (P1)

Referências: `src/components/eficiencia/LaboratoriosCapitais.tsx:33` e `src/components/observatorios/RecursoResultado.tsx:36`, dentro do protótipo; implementação compartilhada existente `src/components/observatorios/NumeroEscala.tsx:10`.

O laboratório passa `p.motivo ?? p.nota` como `numero.nota`. A nova sequência renderiza somente `NumeroEscala`, que não renderiza `nota` nem estado. Logo, ausências diferentes viram apenas “Indisponível nesta publicação” e valores existentes porém não elegíveis perdem a ressalva que explica sua restrição. A própria consulta define `notaMaterial` como informação que precisa aparecer junto do dado. Este é um defeito de preservação do contexto, não mera preferência de redação.

Correção: exibir nota junto de cada elo e distinguir ausência/estado de comparação, preservando o valor oficial quando permitido com sua ressalva. A forma mais limitada é no ramo novo de `RecursoResultado` ou em seus dados, sem mudar todos os consumidores de `NumeroEscala`. O ramo antigo de `RecursoResultado` já possui renderização própria de nota, que não cobre a sequência nova.

O teste novo com nota “Não divulgado” deve detectar esse defeito; não foi executado por mim.

### 2. Capital sem dado selecionada no gráfico não recebe destaque nem estado acessível (P2)

Referência: `src/components/eficiencia/PanoramaInterativo.tsx:218`.

Os itens do novo gráfico incluem `r.semDado` e são selecionáveis. Entretanto `selecionado={sel?.id ?? null}` usa `sel`, encontrado apenas em `r.pontos`. Ao selecionar capital excluída/ausente, a URL muda e o laboratório pode mostrar essa capital, mas a linha do gráfico recebe seleção nula: perde destaque e `aria-pressed`. A mesma inconsistência ocorre quando uma capital selecionada tem dado em uma medida e ausência em outra.

Correção: propagar o ID selecionado validado contra a lista completa, inclusive ausências. Verificar clique/Enter numa capital ausente e troca de medida com a seleção preservada.

### 3. Motivos existentes são apagados na tabela equivalente do panorama (P2)

Referência: `src/components/eficiencia/PanoramaInterativo.tsx:138` (`linhas`) e `:94` (`NotaCapital`).

`r.semDado` possui `motivo`, mas as linhas da tabela usam apenas “Sem dado comparável”. Ao mesmo tempo a nota afirma que “a tabela mostra o motivo”. O gráfico de26capitais passa essas entradas como valor nulo e não oferece o motivo por outro campo. Assim, a explicação disponível na consulta não chega ao leitor e a promessa da interface é falsa.

Essa omissão já existia na tabela anterior; não atribuo sua origem ao PR3. Ela permanece relevante no redesenho que agora expõe as26capitais, sobretudo para distinguir ausência de dado de exclusão da comparação. Correção limitada: adicionar motivo/estado à tabela equivalente (ou à célula de ausência) e manter o texto de seleção compatível com a informação real.

### 4. Teste SSR não seleciona Recife pelo mock atual (P2, evidência de teste)

Referência: `src/tests/educacao-capitais-artefatos.test.ts:45` e `src/components/eficiencia/LaboratoriosCapitais.tsx:22`.

O teste usa `renderToStaticMarkup` e simula `next/navigation.useSearchParams` com `cap=recife`. Porém `useEstadoUrl` não lê esse hook: no servidor inicia pelo argumento `buscaInicial`, cujo padrão é vazio; o laboratório não o fornece. Efeitos de leitura de `window.location` não rodam no SSR. Portanto a renderização entra no ramo “Escolha uma capital” e não gera `laboratorio-ponte`/`recurso-educacao`, que o teste espera.

Correção: controlar o hook no teste de renderização, ou fornecer explicitamente estado inicial a um componente testável, e testar sincronização real da URL no navegador. Não eliminar a asserção: ela verifica um objetivo válido, mas o mock não exerce o caminho esperado.

### 5. Unidades serão duplicadas em três elos (P3)

Referência: `src/components/eficiencia/LaboratoriosCapitais.tsx:16` e `:33`.

`formata('despesa_hab'/'despesa_mat', ...)` já inclui “R$”; `formata('aprovacao', ...)` inclui “%”. `NumeroEscala` acrescenta a unidade informada. O resultado é “R$ [valor] R$ correntes por habitante” e “[valor]% % dos alunos da etapa”.

Correção: formatar apenas o número ou remover a duplicação na unidade, mantendo explícitos moeda corrente, denominador e período. Verificar nos cinco elos após renderização.

## Fórmulas, contratos e consumidores compartilhados

- O laboratório consulta as mesmas medidas/etapas/componentes do explorador e reutiliza `PonteDaRazao`; não recalcula nem inventa numerador por matrícula. O texto explicita que a despesa por habitante usa funçãoEducação total e por matrícula usa aplicação direta, com denominadores diferentes. A posição conta valores estritamente maiores +1, preservando empate e excluindo não comparáveis pela função existente. Não identifiquei fórmula nova incorreta.
- Cada elo usa o último ano da sua família de dados ou exercício financeiro escolhido; fonte, período e universo vêm das fichas. Há ressalva fixa de não causalidade. Não se deve apresentar esses anos diferentes como contemporaneidade causal.
- `GraficoPontos` preserva o comportamento antigo quando `limitesEixo` não é passado. O novo parâmetro acrescenta extremos ao cálculo de domínio, sem acrescentar observações. Seu nome sugere limites exatos, mas a implementação garante inclusão no domínio “bonito”, não clamp; para Ideb0–10 isso atende ao caso pretendido. Não identifiquei regressão concreta nos consumidores existentes.
- Ordenação inicial dos pontos é por nome, valor só por escolha; os26itens incluem ausências. Valores e mediana ficam na mesma escala. O array de capitais é o universo de origem, portanto não encontrei evidência atual de falha no `find(...)!.id`, embora a identidade explícita no registro de ausência seja menos frágil que recuperar ID por nome/UF.
- `RecursoResultado` mantém o ramo anterior quando não recebe `sequencia`. `EscoresServicos` mantém o comportamento anterior quando `preparacao=false`; no novo modo não oferece links e usa `SeloProntidao`. A remoção do componente do layout retira os escores de todas as páginas filhas, e a inclusão explícita os mantém apenas no método, coerente com o destino solicitado. A confirmação do dono no PR continua exigida pelo pedido; não a considero concedida pelo protótipo.
- Convite do aperitivo não está entre os protótiposPR3: atualizar na integração para os novos recursos, preservando a camada aberta sem gráficos/laboratórios/CSV.

## Verificações posteriores, sem afirmar aprovação

Navegador ainda necessário para foco/teclado e rolagem das26linhas, seleção sincronizada entre gráfico/controle/laboratório, URL e voltar/avançar, mudança de período/etapa e contraste da paleta Educação. Testar uma capital com dado, uma com ausência e uma excluída da comparação. Confirmar os demais consumidores dos três componentes compartilhados. A revisão é de código; não certifica estado visual, aprovação das suítes ou acessoHTTP.

## Adendo — correções durante a revisão

Releitura após atualização do agente principal confirmou resolução dos itens1,2e4 no protótipo: sequência renderiza nota localmente; laboratório reúne status legível, inelegibilidade, motivo e nota sem descartar informação distinta; gráfico recebe `cap || null`, incluindo ausências; teste injeta `buscaInicial:"cap=recife"` no hook real via mock do reexport, conservando os demais padrões. Não executei testes. Permanecem os itens3 (motivo omitido na tabela) e5 (unidades duplicadas) na última leitura.

## Adendo — integração em `/workspace/educacao-3`

Revisão somente leitura das últimas correções, sem executar testes/build ou editar a árvore:

- **Item3 resolvido:** `PanoramaInterativo.tsx:138` agora inclui `x.motivo` na célula “Sem dado comparável”. A promessa da nota de seleção passa a corresponder à tabela equivalente.
- **Item5 resolvido:** `LaboratoriosCapitais.tsx:16` usa “correntes por habitante”, “correntes por matrícula” e “dos alunos da etapa”. Como o formatador já produz R$/%, o texto concatenado não duplica as unidades.
- **Convite atualizado:** `src/lib/educacao/convite.ts` obtém a quantidade real de capitais da gold e anuncia gasto, alunos, aprovação, Ideb e ponte por matrícula. Apenas acrescenta texto à lista; não introduz gráfico, tabela ou laboratório na camada aberta. Se a gold de capitais não estiver disponível, não promete a contagem. Conferir comprimento dos aperitivos no build integrado, pois o item novo aumenta sua altura.

Todos os cinco achados desta revisão de código estão resolvidos por inspeção. O agente principal informou239 testes novos+OBEE Educação aprovados; não executei nem auditei a saída dessa execução. Build/capturas, tarefas por teclado/toque, proteçãoHTTP e confirmação editorial no PR sobre transferência dos escores para o método continuam fora desta evidência.
