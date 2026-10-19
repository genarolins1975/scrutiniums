# Medição de uso agregada

Pacote Q3 da Onda 2 (`docs/BANCA_2026-10-19.md`, achado A16). Critério de aceite: medição de uso agregada e sem dado pessoal, inclusive de visitantes sem sessão, com base legal LGPD documentada; painel em `/app/admin` com uso por observatório e por página nos últimos 30 dias.

Estado em 19/10/2026:

| Parte | Estado |
|---|---|
| Contagem de visitas com conta | Ligada |
| Contagem de visitas sem conta | Pronta e **desligada**, até o dono decidir a base legal (seção 6) |
| Painel em `/app/admin` | Seção 03, "Uso por observatório e por página, últimos 30 dias" |
| Política de privacidade | **Não alterada**. Texto proposto na seção 7 |
| Retenção | Proposta na seção 5, ainda sem expurgo automático |

## 1. O que é contado

Uma visita é uma abertura de página Next do site, inclusive a navegação interna entre páginas. Cada visita soma 1 a um contador na tabela `uso_paginas_dia`:

| Coluna | Conteúdo |
|---|---|
| `dia` | Dia civil no fuso de Brasília (AAAA-MM-DD) |
| `rota` | Modelo da rota, como está nas pastas de `src/app`: `/saneamento/municipio/[id]`, nunca `/saneamento/municipio/4314902` |
| `observatorio` | Dono da rota no registro (`src/lib/observatorios/registro.ts`) na data da visita; `plataforma` para home, camada aberta, entrada, cadastro, conta e institucionais |
| `com_conta` | Verdadeiro se o pedido trouxe sessão válida, falso se não |
| `visitas` | Número de aberturas no dia, rota e presença de conta |

Chave primária: `(dia, rota, com_conta)`. O incremento é um upsert (`INSERT ... ON CONFLICT DO UPDATE SET visitas = visitas + 1`). A migração é idempotente (`CREATE TABLE IF NOT EXISTS` em `src/lib/db.ts`).

A unidade é **abertura de página**, não pessoa nem sessão: a mesma pessoa que abre a mesma página três vezes conta três. Não há como contar pessoas distintas sem identificador, e essa é a escolha.

## 2. O que nunca é contado nem gravado

- Nenhum identificador de pessoa ou de conta: sem `user_id`, e-mail, CPF ou telefone.
- Nenhum IP, nem em hash, no banco ou em log.
- Nenhum user agent, idioma do navegador, resolução, referência de origem ou fuso.
- Nenhum cookie novo e nada em `localStorage` ou `sessionStorage`.
- Nenhuma consulta (`?uf=SP`), fragmento (`#topo`) ou valor de parâmetro de rota (código do município, distribuidora, conceito).
- Nenhum caminho fora da lista fechada.
- Nada de navegador que envia **Do Not Track** (`DNT: 1`, `navigator.doNotTrack`) ou **Global Privacy Control** (`Sec-GPC: 1`, `navigator.globalPrivacyControl`): o componente não envia e o servidor descarta, com ou sem conta.

## 3. Como funciona

1. `src/components/telemetria/MedeUso.tsx`, montado uma vez no layout raiz (`src/app/layout.tsx`), lê o caminho com `usePathname` e envia `{ "rota": "<caminho>" }` para `POST /api/uso` por `navigator.sendBeacon` (reserva: `fetch` com `keepalive`). Uma chamada por navegação; falha silenciosa; nada enviado com DNT ou GPC.
2. `src/app/api/uso/route.ts`, nesta ordem:
   1. DNT ou GPC no cabeçalho: responde 204 sem consultar a sessão.
   2. Consulta a sessão (cookie já existente `scrutiniums_session`) só para saber se há conta. O resultado vira um booleano; o id da conta não sai dessa linha.
   3. Sem conta e `USO_ANONIMO_ATIVO` diferente de `1`: responde 204 sem ler o IP nem o corpo.
   4. Limite de taxa por IP só em memória (`POLICIES.usoPorIp`, 60 por minuto): a chave é um hash SHA-256 do IP com um sal aleatório que nasce com o processo e nunca sai da memória (`chaveDeTaxa` em `src/lib/uso/coleta.ts`). Nada é gravado.
   5. Normaliza o caminho para o modelo da rota (`src/lib/uso/rotas.ts`); fora da lista fechada, descarta.
   6. Upsert do contador. Resposta sempre 204 sem corpo (429 só no limite de taxa).
3. O painel lê com `getUsoDoPeriodo` (`src/lib/uso/painel.ts`).

### Lista fechada de rotas

`src/lib/uso/rotas-do-app.json` é gerada das pastas de `src/app` por `node scripts/rotas-do-app.mjs` (regras do App Router: grupos `(nome)` saem do endereço; pastas `_privadas`, slots `@nome`, rotas interceptadas e a pasta `/api` ficam fora; só pastas com `page.tsx` entram). O teste `src/tests/uso-paginas.test.ts` reprova a lista quando ela difere do sistema de arquivos: **página nova, movida ou apagada exige rodar o gerador**. Em 19/10/2026 são 339 páginas.

Exceção deliberada: as entradas com conta dos observatórios (`/observatorios/familias` e as demais do registro) contam pelo endereço concreto, porque o modelo `/observatorios/[id]` juntaria os seis numa linha só.

Precedência igual à do Next: segmento fixo vence parâmetro, que vence o resto (`[...x]`, `[[...x]]`).

## 4. Cobertura e limites declarados

- **Fora nesta etapa: a aplicação de página única do Crédito** (`/observatorio`, servida por `src/app/observatorio/[[...rota]]/route.ts` com `public/obs/app.js`). Ela não usa o layout raiz. Para quem tem conta, as abas continuam medidas pela telemetria antiga (`product_events`, seção "Seções mais visitadas" do painel). Levar a medição agregada para a SPA é tarefa própria, junto com a migração das vistas mais usadas (Onda 3).
- Outras respostas HTML que não são páginas Next (ex.: `/eficiencia-estatal/laboratorio-cesta`, `route.ts`) também ficam fora.
- Endereço com parâmetro inexistente (ex.: `/agronegocio/capitulo-que-nao-existe`, que responde 404) conta no modelo da rota. O identificador não é gravado, mas a contagem do modelo pode incluir essas aberturas.
- Robôs que executam JavaScript são contados; não há filtro de robôs nesta etapa. Quem envia POST direto para `/api/uso` também pode inflar a contagem, limitado pelo teto por IP.
- Bloqueadores de conteúdo podem barrar o envio; a contagem é piso, não censo.
- Pré-carregamento de links (`prefetch`) não conta: só a página efetivamente aberta.
- Em desenvolvimento, o modo estrito do React repete efeitos; o componente ignora a repetição do mesmo caminho.
- Sem conta, só são visitáveis as rotas abertas (`src/lib/rotasPublicas.ts`); quem tenta um painel fechado é levado a `/entrar`, que não é contado.
- **Fora por decisão: as páginas de autenticação** (`/entrar`, `/entrar/sms`, `/entrar/sms/verificar`, `/cadastro` e as irmãs `/en`). Nelas nenhuma requisição além do próprio formulário sai do navegador (testes `i18n-auth-browser` e `i18n-sms-browser`), e o funil de cadastro já tem seção própria no painel (`FORA_DA_MEDICAO` em `src/components/telemetria/MedeUso.tsx`).

## 5. Retenção proposta

**Proposta: 13 meses de contadores diários**, para comparar o mesmo mês do ano anterior; depois disso, apagar as linhas (`DELETE FROM uso_paginas_dia WHERE dia < current_date - interval '13 months'`) ou consolidá-las por mês sem a coluna `com_conta`, se o dono quiser série longa. O expurgo ainda **não** está automatizado: pendência para a atualização agendada, depois da decisão do dono.

Nada transitório é retido: o hash do IP vive só no mapa em memória do limite de taxa, desaparece com o processo e não é comparável entre processos.

## 6. Base legal na LGPD (decisão do dono)

Separação entre evidência, inferência e recomendação. Esta análise não é parecer jurídico; a decisão final é do dono, e um advogado pode revisar o texto antes de publicar.

### Evidência (o que o código faz)

- O que fica gravado é um contador por dia, modelo de rota e booleano de conta. Não há coluna que ligue a linha a uma pessoa (o teste confere as cinco colunas).
- Para produzir o contador, o servidor **recebe** o IP e o cookie de sessão, como em qualquer requisição HTTP, e os **usa transitoriamente**: o cookie para saber se há conta; o IP, em hash salgado na memória, para o limite de taxa. Nada disso é gravado pela aplicação.
- A hospedagem (Vercel) mantém os próprios registros de requisição, com IP e caminho, independentemente desta medição. Esse tratamento já existe hoje para toda página e não é criado por esta entrega.

### Inferência (enquadramento)

1. **O contador agregado tende a não ser dado pessoal.** A LGPD define dado pessoal como informação relacionada a pessoa natural identificada ou identificável (art. 5º, I) e diz que dado anonimizado não é dado pessoal, salvo quando a anonimização puder ser revertida com esforços razoáveis (art. 12). Um número de aberturas por dia e rota, sem identificador, não permite chegar a ninguém por esforço razoável. Ressalva: contagens muito pequenas em rotas raras (ex.: 1 visita sem conta a uma página pouco vista), cruzadas com os registros da hospedagem, reduzem essa distância; por isso a tabela não guarda hora, só o dia.
2. **O tratamento transitório é tratamento de dado pessoal.** "Tratamento" inclui recepção, processamento e eliminação (art. 5º, X). Ler o IP para o limite de taxa e o cookie para saber se há conta precisa de base legal, ainda que nada seja gravado.
3. **Opções de base legal:**

| Opção | Base | Prós | Contras |
|---|---|---|---|
| A | Contador como dado anonimizado (art. 12) e tratamento transitório por legítimo interesse de segurança (art. 7º, IX) | Coerente com o desenho; nenhuma interação com o visitante | Depende de sustentar a anonimização; não dispensa transparência sobre o tratamento transitório |
| B | **Legítimo interesse** para toda a medição (art. 7º, IX, e art. 10), com teste de balanceamento documentado | Base usual para estatística agregada de audiência; robusta mesmo que se discorde da anonimização | Exige registro do teste, transparência na política e atenção a pedido de relatório de impacto pela ANPD (art. 10, § 3º) |
| C | **Consentimento** (art. 7º, I, e art. 8º) | Máxima deferência ao visitante | Exige aviso com aceite e prova do consentimento, guardar a escolha (o que pediria cookie ou armazenamento novo), medição só de quem aceita e com viés; desproporcional para um contador sem identificação |

**Teste de balanceamento da opção B** (roteiro do art. 10 e do guia da ANPD sobre legítimo interesse):

- *Finalidade legítima e concreta:* saber quais observatórios e páginas são usados, para decidir onde investir, o que manter e o que retirar, e prestar contas do uso de dados públicos (achado A16 da banca).
- *Necessidade e minimização:* só contador diário por modelo de rota; nenhum identificador, IP, navegador, consulta ou parâmetro; IP só em memória, em hash, para conter abuso.
- *Expectativa do titular:* contagem de audiência agregada é prática comum e esperada em sites públicos; não há perfilamento, publicidade nem compartilhamento.
- *Direitos e liberdades:* impacto residual baixo; não há decisão sobre a pessoa; não há transferência a terceiros além da hospedagem.
- *Salvaguardas:* Do Not Track e Global Privacy Control respeitados como manifestação de oposição, sem exigir pedido ao controlador; sem cookie novo; retenção limitada (seção 5); transparência na política (seção 7); lista fechada de rotas; contagem anônima atrás de interruptor.

### Recomendação

Adotar a **opção B** (legítimo interesse), com o argumento da opção A como reforço, registrar este teste de balanceamento, publicar o texto da seção 7 numa nova versão da política (`PRIVACY_VERSION` em `src/lib/versoesPoliticas.ts`) e só então ligar a contagem sem conta (seção 8).

Achado lateral, para a mesma revisão da política: a seção 06 da política vigente diz que o uso é medido "com eventos de produto que não contêm dados pessoais", mas `product_events` grava o id interno da conta em cada visita da área logada (exceto Agro). Id interno é dado pseudonimizado (definição do art. 13, § 4º) e continua sendo dado pessoal, porque a associação pode ser refeita por quem detém a tabela de contas. O texto da política deve dizer isso, ou a telemetria antiga deve deixar de gravar o id quando a medição agregada a substituir. Também seguem pendentes, de rodada anterior, CPF, UF e perfil de uso na política.

## 7. Texto proposto para a política de privacidade

Substitui a seção 06 ("Analytics") da página `/privacidade`. **Não publicado**; a página não foi alterada.

> **Medição de uso**
>
> Contamos quantas vezes cada página do site é aberta, por dia, para saber quais observatórios e páginas são usados e decidir onde investir. O que guardamos é só um contador: o dia, o modelo da página (por exemplo, "ficha de município", sem dizer qual município), o observatório a que ela pertence, se a visita veio de alguém com conta ou sem conta e o número de aberturas. Não guardamos quem visitou, nem endereço IP, navegador, cookies novos ou o que foi buscado na página.
>
> Para produzir esse contador, nossos servidores leem por instantes o endereço IP da requisição, apenas para conter excesso de envios, e o cookie de sessão já existente, apenas para saber se há conta. Nada disso é gravado. A base legal é o legítimo interesse em conhecer o uso da plataforma de forma agregada (art. 7º, IX, da LGPD).
>
> Se o seu navegador enviar o sinal Do Not Track ou Global Privacy Control, a visita não é contada. Os contadores são mantidos por 13 meses.
>
> Na área com conta, também registramos a abertura de seções associada ao identificador interno da conta, nunca ao e-mail ou ao telefone, para medir o uso dos painéis e a atividade da conta. Telefone, e-mail e códigos de verificação nunca são enviados a ferramentas de medição.

## 8. Como ligar a contagem de visitantes sem conta

Depois da decisão do dono e da política publicada:

1. Na Vercel, projeto Scrutiniums, **Settings → Environment Variables**: criar `USO_ANONIMO_ATIVO` com valor `1` no ambiente **Production**.
2. Fazer novo deploy do main (a variável vale a partir do deploy seguinte).
3. Abrir `/app/admin`, seção 03: a linha "Visitas sem conta" deve dizer "Contagem ligada no servidor (USO_ANONIMO_ATIVO=1)". A coluna "Visitas sem conta" passa de "não medido" a números a partir do dia em que foi ligada.

Para desligar, apagar a variável (ou trocar para `0`) e fazer novo deploy. Os números sem conta já gravados continuam no painel, com a nota de que são do trecho em que a contagem esteve ligada.

## 9. O painel

`/app/admin`, seção 03, mostra:

- o período exato (30 dias civis no fuso de Brasília, hoje incluído) e, quando a medição começou dentro dele, a data de início, com a nota de que os dias anteriores não têm registro (o que não equivale a zero);
- o estado das duas contagens (com conta ligada; sem conta ligada ou desligada);
- totais por observatório (os seis do registro e "Fora dos observatórios"): páginas visitadas, visitas com conta e visitas sem conta;
- a tabela por página: modelo da rota, observatório, visitas com conta e visitas sem conta.

Com a contagem sem conta desligada e sem registro anterior, a coluna sem conta mostra "não medido", nunca zero. Sem nenhum registro no período, a seção declara a ausência em vez de mostrar tabela de zeros.

## 10. Arquivos

| Arquivo | Papel |
|---|---|
| `src/components/telemetria/MedeUso.tsx` | Coleta no navegador (layout raiz) |
| `src/app/api/uso/route.ts` | Recebe a visita e decide |
| `src/lib/uso/sinais.ts` | Do Not Track e Global Privacy Control |
| `src/lib/uso/coleta.ts` | Interruptor, decisão, upsert, chave do limite de taxa |
| `src/lib/uso/rotas.ts` | Lista fechada, normalização e atribuição ao observatório |
| `src/lib/uso/varredura.ts`, `scripts/rotas-do-app.mjs`, `src/lib/uso/rotas-do-app.json` | Geração e versão da lista de páginas |
| `src/lib/uso/painel.ts`, `src/components/admin/UsoPaginas.tsx` | Leitura e seção do painel |
| `src/tests/uso-paginas.test.ts` | Testes |
