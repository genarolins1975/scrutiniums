# Pedidos de mudança compartilhada: família Qualidade do serviço

Rota `/setor-eletrico/qualidade`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum deles bloqueia a página: ela segue com a melhor solução local, descrita em cada item.

## 0. Arquivo sem uso para apagar no fim (regra do coordenador: não apagar componente com o servidor no ar)

- `src/components/energia/QualidadeLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel passou a usar o `SeguirPainel` compartilhado, com o mesmo botão "Copiar link deste painel", o mesmo endereço e a mesma mensagem de cópia. O arquivo chegou a ser apagado durante a migração, antes da regra, e foi restaurado com o conteúdo original (56 linhas); nenhum teste depende dele.

## 1. Âncoras que apontam para o painel errado (defeito já existente, achado na migração)

Os painéis da página são P051 (duração e frequência), P052 (limites), P053 (compensações) e P054 (atendimento). Três arquivos compartilhados citam as âncoras `#p051` a `#p054` com os nomes trocados em uma casa:

- `src/lib/energia/conteudo/evidencias-verbetes.ts`, linhas 146, 153, 160 e 167: DEC e FEC apontam para `#p052` (deveria ser `#p051`); "conjunto elétrico" aponta para `#p053` (deveria ser `#p052`); "compensação" aponta para `#p054` (deveria ser `#p053`). Quem clica em "Ver no painel" no Aprenda chega ao painel vizinho.
- `src/lib/energia/mapa.ts`, linhas 392 a 395 (cartão de Qualidade da inicial): "Quanto as regras tiram do tempo apurado" aponta para `#p053`, que é o painel de compensações. A seção que responde a essa pergunta agora tem âncora própria: use `#expurgos`. "Compensações e atendimento" junta dois painéis em `#p054`; se for dividido, `#p053` e `#p054`.

Local: nada a fazer na página, as âncoras `p051` a `p054`, `duracao`, `limites`, `compensacoes` e `atendimento` continuam, e foi acrescentada `expurgos`.

## 2. Links que levam um parâmetro de URL sem levar o leitor ao bloco que reage a ele

O parâmetro `?dist=` (CNPJ da distribuidora) e o `?mun=` (código IBGE do município) já funcionam na página: o primeiro marca a distribuidora no gráfico de limites e preenche a comparação lado a lado, o segundo acende o município no mapa. Os links de outras famílias chegam ao topo da página, onde nenhum dos dois aparece:

- `src/app/setor-eletrico/page.tsx`, linha 449 (`EscolhaDistribuidora`, `ancora="p051"`): trocar por `comparar-distribuidoras`.
- `src/lib/energia/territorio.ts`, linhas 1096 e 1104: acrescentar `#comparar-distribuidoras` ao link com `?dist=` e `#mapa-municipios` ao link com `?mun=`.
- `src/lib/energia/empresas.ts`, linha 892: acrescentar `#comparar-distribuidoras` ao link com `?dist=`.

Local: as âncoras existem e estão visíveis em Entender (a seção de comparação, `comparar-distribuidoras`, e a do mapa, `mapa-municipios`), então o pedido é só trocar o destino do link. O teste `energia-territorio.test.ts` (linha 531) confere o início do endereço (`/setor-eletrico/qualidade?dist=`); a âncora entra depois do parâmetro e não o quebra.

## 3. `NavegacaoLocal variante="capitulos"` com título cria um `h2` dentro do painel

Com `titulo`, o componente escreve um `h2`. Dentro de um `PainelEvidencia` (que já é `h2`), os títulos de seção que vêm depois (`h3`) passam a parecer filhos do bloco de capítulos na lista de títulos do leitor de tela. A página de Água tem o mesmo desenho. Proposta: aceitar `nivelTitulo` (ou trocar por um rótulo em texto). Local: a página Qualidade não passa `titulo` e escreve o rótulo "Nesta página, as outras perguntas" como texto (`QualidadeCapitulos`).

## 4. Legenda interativa do `GraficoLinhas` gasta cerca de 90 px acima da figura

Com `legendaInterativa`, cada linha da legenda tem 44 px e há mais uma linha de estado (`data-estado-grafico`) com 28 px. Para duas figuras lado a lado na primeira tela, isso empurra o início do traçado para perto da dobra. Proposta: uma variante compacta (botões de 32 px com ponteiro fino, 44 px no toque, e a unidade na mesma linha). Local: os rótulos das séries foram encurtados ("Todas as distribuidoras", "Só concessionárias", "Limite agregado do ano"); o que explica "só concessionárias" (o universo do número que a ANEEL divulga) está no Universo logo abaixo da figura.

## 5. A regra de `globals.css` que põe `[data-resposta]` primeiro em todo `space-y-*`

`[class*="space-y-"] > [data-resposta] { order: -1; ... }` garante a resposta antes da figura, o que serve a todos os painéis. No P051 a faixa de métricas logo acima já traz os mesmos números (DEC, FEC e a comparação com o ano anterior), e a resposta antes das figuras empurrava o começo do gráfico para fora da primeira tela. A página envolve a resposta do P051 em um `div` (que escapa da regra) e a coloca logo depois das duas figuras. Proposta: um atributo de exceção explícita (por exemplo `data-resposta-depois`) em vez de depender da estrutura do contêiner.
