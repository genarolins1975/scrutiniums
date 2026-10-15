# Plano de entregas bilíngues

Base do diagnóstico: `38afb8e6e`, merge do PR #196. Este primeiro PR documenta a proposta; não declara a fase 0 concluída nem introduz traduções, rotas ou geradores. As decisões técnicas estão em [ARQUITETURA.md](ARQUITETURA.md).

## Inventário inicial

| Área | Evidência na base |
| --- | --- |
| App Router | 210 arquivos `page.tsx`; a contagem não representa todas as URLs dinâmicas |
| Setor Elétrico | 74 arquivos `page.tsx` |
| Gás Natural | 12 arquivos `page.tsx` |
| Saneamento | 24 arquivos `page.tsx` |
| Eficiência Estatal | 65 arquivos `page.tsx` |
| Contas Públicas Federais | 5 arquivos em `src/app/contas-publicas` |
| Contas Públicas Estaduais | 1 arquivo em `src/app/contas-publicas-estaduais` |
| Plataforma e conta | 29 arquivos `page.tsx`, incluindo a apresentação pública do Crédito |
| Crédito | SPA de 13.847 linhas em `public/obs/app.js`, além dos arquivos auxiliares e do route handler |
| Idioma fixo | 417 ocorrências textuais de `pt-BR` em `src`, das quais 343 fora de `src/tests`; não são todas chamadas de formatação |
| Dados | Gold em `public` e snapshots em `src/lib`; o inventário deve incluir ambos |
| Cadastro | `cpf` e `phone_e164` são únicos e aceitam nulo no schema atual; validar também migrações e fluxo |

Contagens reproduzíveis: `rg --files src/app -g 'page.tsx'`, `wc -l public/obs/app.js`, `rg -o 'pt-BR' src` e a última busca com `-g '!**/tests/**'`. O relatório futuro precisa contar rotas concretas, chaves e campos, sem tratar essas contagens de arquivos como cobertura de tradução.

## Fase 0: série de PRs

Cada linha delimita uma entrega; migrações extensas podem ser subdivididas sem misturar observatórios. O CI do PR anterior precisa estar verde antes de iniciar a próxima entrega.

| Ordem | Entrega | Critério de conclusão |
| --- | --- | --- |
| 0.1 | Arquitetura e plano, sem mover páginas | Alternativa de roteamento e contratos registrados; CI verde |
| 0.2 | Glossário inicial, inventário e script de cobertura | Fontes verificadas para termos traduzidos; estados e pendências explícitos; saída versionada conferida no CI |
| 0.3 | Tipos, dicionários e formatador com idioma | Português preservado; ausência de chave inglesa reprova `tsc`; testes de números, moedas e datas nos dois idiomas |
| 0.4 | Migração das chamadas de formatação | Nenhuma chamada fixa proibida fora do formatador; verificações portuguesas existentes intactas |
| 0.5 | Rotas, metadados, acesso e sitemap | Irmãs `/en` com a mesma política de conta; estáticas onde já eram; URLs e HTML português preservados |
| 0.6 | Seletores e home como prova de conceito | Cookie sem redirecionamento automático; mesma página no outro idioma; testes de HTML e acessibilidade |
| 0.7 | Preparação da SPA e fechamento da infraestrutura | Prefixo, dicionário, embeds e permalinks preservam idioma; `DATA_BASE` permanece igual; cobertura completa da fase |

Na fase 0, páginas ainda não traduzidas continuam em português com marcador visível `Portuguese only` e `lang="pt-BR"`. A home é a única página cujo conteúdo é traduzido nessa fase. Infraestrutura de navegação e marcador não autorizam antecipar traduções dos observatórios.

O roteamento usa `src/app/en` literal, preservando páginas e layouts portugueses. A série começa por helpers de URL e contratos, sem publicar rotas; segue por uma primeira irmã pública com fallback, documento e metadados corretos; depois amplia plataforma/conta e cada observatório separadamente. Parâmetros, layouts aninhados, redirects, portais e handlers exigem seus próprios adaptadores e verificações. Seletores e alternates só anunciam inglês em páginas com tradução publicada; fallback integral não é tradução. Formatos e rotas podem avançar em recortes intercalados dentro da fase 0, sempre com o CI anterior verde; a fase só fecha depois da migração completa, da guarda contra locale fixo e da paridade integral.

O primeiro par é `/sobre` e `/en/sobre`: corpo português preservado e marcado na irmã inglesa, sem antecipar a tradução institucional da fase 1. Ele inaugura documento por idioma e registro estrutural. A irmã sem tradução recebe `noindex`, fica fora do sitemap e não é anunciada por alternates. As demais irmãs, os seletores, a home traduzida, o JSON-LD e a infraestrutura da SPA continuam pendentes; esse recorte não encerra a fase 0.

A ampliação institucional acrescenta `/sobre/erros` e `/sobre/governanca`, também estáticas e inteiramente em português marcado sob `/en`. O teste de HTML passa a percorrer todos os pares declarados e exige página compilada, entrada de prerender e HTML físico; um par sem prova estática falha até receber verificação adequada. Isso não conclui a tradução da Constituição, prevista para a fase 1, nem a paridade global.

Imprensa e a vitrine pública do Crédito acrescentam dois pares estáticos com português marcado. O recorte preserva os metadados próprios das duas folhas e verifica a hidratação do selo e dos destinos de entrada, sem ampliar o acesso à SPA ou a seus arquivos. São cinco pares declarados, quatro da plataforma e um do Crédito; não representam cinco páginas traduzidas. As rotas dinâmicas exigirão prova HTTP e de DOM concluído, sem converter páginas com sessão para `force-static`.

O seletor público usa somente pares com tradução publicada: links presentes no HTML inicial, preservação de query/fragmento na interação e cookie de preferência sem redirecionamento automático. Os cinco pares com fallback integral não oferecem inglês. Seus rótulos ainda são portugueses, como o cabeçalho inteiro no fallback. A entrega não amplia o registro de rotas nem conclui os seletores dos sete observatórios. Provas de SSR e handlers são separadas das verificações de hidratação, histórico, teclado e cookies no navegador.

## Fases seguintes

| Fase | Série de entregas, sempre com CI verde entre PRs |
| --- | --- |
| 1 | Vitrine: home, Sobre, erros e governança; glossário e imprensa; termos e privacidade; métodos; entrada, cadastro e páginas de erro |
| 2 | Países e política de SMS; CPF conforme telefone verificado; limites por país/prefixo; idioma na conta; tradução das áreas de conta e administração da plataforma; comunicações; privacidade internacional |
| 3 | Setor Elétrico |
| 4 | Gás Natural |
| 5 | Saneamento |
| 6 | Eficiência Estatal |
| 7 | Contas Públicas Federais |
| 8 | Contas Públicas Estaduais |
| 9 | SPA do Crédito |

Cada fase de observatório divide a interface por módulos, adiciona textos ingleses determinísticos do pipeline conforme o contrato de arquivos paralelos e conclui exportações CSV, XLSX, PNG e citações. Nenhum PR mistura dois observatórios. Testes novos confrontam os valores e os campos portugueses sem editar expectativas dos testes existentes. A cobertura de uma fase precisa estar atualizada antes de iniciar a seguinte.

## Estados da cobertura

O relatório versionado agrupa fontes de código da plataforma e de cada observatório. Campos textuais da gold são inspecionados separadamente pelo diagnóstico não versionado `--gold`. As saídas têm ordenação estável e não incluem horário corrente.

- `traduzido`: chave ou campo catalogado, tradução disponível e validada; conta como inglês disponível.
- `portugues_marcado`: fallback efetivamente apresentado com marcador e idioma; conta como pendência, nunca como tradução.
- `sem_traducao`: item catalogado sem inglês, ainda sem comprovação do fallback; deve impedir sua exposição sem marcador em `/en`.
- `nao_catalogado`: texto candidato encontrado fora do inventário; fica separado do denominador de chaves conhecidas, com localização e quantidade explícitas.
- `preservado`: nome próprio registrado no glossário; contabilizado separadamente, com explicação inglesa onde exigida.

Campos técnicos como IDs, códigos, datas de máquina e valores não são traduções; a classificação precisa justificar sua exclusão. Uma área não catalogada não pode aparecer como 100% traduzida. Rotas têm estado próprio de existência, acesso e tradução, incluindo rotas dinâmicas e a SPA. O CI deve rejeitar diferença entre `docs/i18n/cobertura.json` e a saída atual do script.

## Pendências e condições de avanço

- Glossário: pesquisar fontes oficiais em inglês antes de propor equivalentes para “saneamento”, “eficiência estatal”, “contas públicas”, “inadimplência”, “encargos” e “economia” como unidade de saneamento. Registrar ambiguidades por contexto; termo sem entrada fica em português e vai ao PR para decisão do dono.
- Nomes próprios e séries oficiais: inventariar nomes e primeira explicação inglesa. Não traduzir silenciosamente Tarifa Social, Desenrola, Bolsa Família, Pix, SINISA, SISAGUA, Siconfi, ESTBAN, IF.data e siglas de órgãos.
- Governança: tradução de cortesia em arquivo separado, aviso de prevalência do português e teste de quantidade de artigos/itens. Não alterar `docs/CONSTITUICAO.md` nem escrever em `notas/`.
- Cadastro internacional: confirmar regra pelo telefone E.164 verificado, não pelo idioma ou país escolhido no formulário. Variável `SMS_PAISES_PERMITIDOS` vazia mantém só Brasil; mudanças jurídicas primeiro em português, pendentes de validação do dono.
- Ações externas da fase 2: dono libera os países no Twilio Verify, define `SMS_PAISES_PERMITIDOS` e valida privacidade. Registrar no PR; não declarar essas ações concluídas pelo código.
- Configuração institucional: campos vazios, listas vazias e nulos permanecem assim. Tradução não constitui decisão nova do mantenedor.
- Acessibilidade: `npm run wcag` hoje inicia servidor estático e imprime um procedimento; não é evidência automática de aprovação das páginas Next. Acrescentar auditoria das páginas inglesas e registrar resultados, inclusive navegação por teclado e trechos com idioma próprio.
- Antes de cada push: `node scripts/minify-obs.mjs`, `npm run lint`, `npx tsc --noEmit`, `npm test` e os `unittest` do domínio alterado. Acrescentar build e verificação de HTML quando afetados; CI continua exigindo build, `EXIGIR_BUILD_HTML=1` e árvore limpa.
- Cada PR informa tradução entregue, termos/fontes propostos, pendências do dono, trecho de cobertura alterado e resultados reais dos comandos. Inviabilidade da especificação é documentada com alternativa no PR antes de prosseguir; teste existente não é relaxado.

## Revisão do contrato de cobertura

O relatório versionado e o `--check` dependem somente de fontes de código: interface, dicionários, glossário, inventário de rotas e modelos de frase. A situação da gold é calculada por `--gold`, em relatório não versionado. A publicação diária de dados não depende da cobertura i18n; os quatro workflows de dados permanecem iguais aos da main. Esta regra substitui o contrato anterior que incluía hashes e contagens da gold no arquivo versionado.
