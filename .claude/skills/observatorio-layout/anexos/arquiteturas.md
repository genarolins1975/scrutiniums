# Observatório Layout, anexo: Arquiteturas de página

Carregar quando a tarefa tocar página de entrada (checklist), panorama, exploração, ficha, catálogo e método. Texto movido sem alteração do SKILL.md de 22/10/2026; os números de seção são os do original.

## 4. Arquiteturas de página

### Página de entrada (observatório ou módulo)

É a página mais criticada pelo usuário ("confusa", "péssima", "pouco objetiva", "fator UAU da Apple"). Antes de entregar, conferir cada item:

1. **Primeira tela responde ao leitor, não ao método.** Título com a pergunta, uma frase do que a página mostra e no máximo quatro números de escala do tema, cada um com fonte e data. Siglas de base, contagens de cadastro, CNPJ e taxas de vínculo ficam nos painéis ou no método, não na abertura.
2. **O destino mais procurado está a um clique**, à vista logo depois dos números, com cartões que já mostram algo útil (ex.: as companhias listadas com logo, papel e o que controlam; não só uma aba no menu). Toda subpágina do módulo é alcançável em um clique da entrada.
3. **Um artefato didático do mecanismo** (ex.: "Da usina à tomada": o que cada elo faz, como é remunerado, quantos agentes, com link para o painel), distinguindo fluxo físico, contratual e financeiro.
4. **Busca e caminhos por pergunta** depois disso, em cartões com a resposta curta e um número com prova.
5. **Método, elos, recorte e downloads recolhidos no fim**, sem sumir do HTML (auditabilidade e testes).
6. **Imagens finais**: nenhuma gravura provisória; ilustração estilizada só quando acrescenta reconhecimento (ex.: a capital, o tema), nunca fotografia decorativa.
7. **Home e cards atualizados** quando um painel novo entra: a página não logada, os cards da home e o mapa do observatório citam o painel novo.

**Molde único (Iniciativa 4 do parecer de UX de 21/10/2026).** Toda entrada de observatório e de coleção, e toda versão aperitivo, é `EntradaColecao` (`src/components/observatorios/EntradaColecao.tsx`), renderizada no servidor, com as fatias nesta ordem (cada uma marcada `data-fatia`, conferida por `src/tests/entrada-molde.test.ts`):

1. **Abertura**: `RotuloContexto`, H1 pergunta com até 60 caracteres (duas linhas a 1440, três a 390) e uma frase com até 220. Nada mais antes dos números.
2. **Escala**: de um a quatro números com `NumeroEscala` (`src/components/observatorios/NumeroEscala.tsx`), cada um com rótulo, valor, unidade, período, fonte, nota opcional e "Ver no painel"; o topo do primeiro número abaixo de 900 px a 1440. Valor ausente é "Indisponível nesta publicação", nunca zero. Não criar outro componente de número (a Iniciativa 6 funde este no kit).
3. **ParaVoce**.
4. **Destinos**: as coleções (entrada de observatório) ou os destinos de primeiro nível de `navegacaoDaColecao` (entrada de coleção, `DestinosColecao`), cada um com a pergunta que responde e, quando há, o número lido da mesma base; até oito à vista e o resto em "Mais destinos".
5. **Artefato**: um modelo didático, sempre no envelope `ModeloDidatico` (`src/components/observatorios/ModeloDidatico.tsx`): rótulo fixo "Modelo didático", título, corpo e a lista obrigatória "O que este modelo deixa de fora" (o tipo exige a lista). "Laboratório ilustrativo", "cenário hipotético" e afins vêm nesse envelope.
6. **Caminhos**: "Perguntas para começar", cada uma com resposta curta e, quando o destino tem número, o número lido dele (regra do `paraVoce.ts`: nunca escrito à mão).
7. **Método**: um único `<details>` no fim, com método, fontes, downloads (`SeloComConta` na versão aberta, `ExportacaoComConta` para exportação do navegador) e `FaixaFrescor` variante método.

Entre os destinos e o artefato cabe **uma** seção própria da coleção (`secaoPropria`: o percurso da Energia, a régua das capitais). O resto do conteúdo vai para `Recolhido` (`src/components/observatorios/Recolhido.tsx`, o único jeito de recolher seção longa: título e resumo de uma linha no `<summary>`, conteúdo inteiro no HTML) ou para a página "Visão geral" da coleção; nunca é apagado. A versão aperitivo (`tipo="aperitivo"`) usa abertura, a consulta do leitor no lugar da escala, `ConviteAperitivo` e método.

**Estados de prontidão** têm forma única, `SeloProntidao` (`src/components/observatorios/SeloProntidao.tsx`): glifo e texto, nunca só cor, em quatro valores (publicado, cobertura parcial, em preparação, piloto). Destino em preparação nunca é link. Nada de "Versão em desenvolvimento", "Em desenvolvimento", "(previsto)" ou "Estados · Piloto" escritos à mão; o teste do molde reprova as formas antigas no código.

**Orçamento de comprimento** (medido por `scripts/ux-medidas.mjs`): entrada de observatório e de coleção até 6.500 px a 1440 e 11.000 a 390; página aperitivo até 2.500 e 4.500; porta `/perguntas/*` até 3.500 e 7.000; página aberta do Crédito até 3.500 e 7.000. Acima disso, recolher, nunca apagar.
Na entrada de um observatório inteiro, combinar: identidade e promessa curta → explicação visual do tema → amostra equilibrada de indicadores com referências → caminhos por perguntas → índice temático completo → fontes e atualidade acessíveis.

Garantir informação substantiva cedo. Evitar hero de marketing que consuma a primeira tela, fotografia decorativa, manifesto longo e mosaico interminável de KPI.

Usar o diagrama do sistema para ensinar relações reais. Diferenciar fluxos físicos, relações institucionais, financeiras e associações. Não desenhar uma seta causal onde existe apenas conexão temática.

Oferecer uma navegação principal e busca funcional quando houver índice confiável. Não repetir os mesmos destinos em quatro menus e conjuntos de cards.

### Panorama temático

Organizar: pergunta → recorte → medida com referência → visual principal → análises complementares visíveis → conexões úteis → aprofundamento e método.

Escolher a densidade conforme a pergunta. Não impor limite universal de três indicadores ou um gráfico. Mostrar evolução, distribuição, composição e território quando acrescentarem entendimento; não apenas links com esses nomes.

### Exploração e comparação

Priorizar área analítica, controles locais, estado da seleção, resumo do universo e referências recalculadas. Usar duas colunas quando as medidas precisarem ser vistas juntas e uma quando a figura exigir largura.

Preservar filtros na URL quando o projeto suportar. Permitir compartilhar o recorte. Evitar filtros globais que pareçam sincronizar indicadores com calendários incompatíveis.

### Ficha de entidade

Dar identidade, perímetro e cobertura à entidade antes de comparar. Organizar dimensões em capítulos. Não inventar nota composta para sintetizar indicadores heterogêneos.

### Catálogo e metodologia

Dar prioridade à busca, classificação e reprodução. Evitar hero alto, indicadores ornamentais e documentação integral antes do primeiro recurso útil. Manter datas de referência, captura e publicação distintas.
