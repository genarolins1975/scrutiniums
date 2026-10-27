# Iniciativa 3 — publicação estática e personalização independente

Implementação de 27/10/2026, sobre as iniciativas 1 e 2. Checkout baseado em `bd7a6fd0cda885308940553fe3b33b7abe149629`.

## Alterações

| Antes | Depois | Motivo |
|---|---|---|
| A home consultava sessão e renderizava a cada visita | `/` e `/en` são artefatos estáticos; cookies assinados são validados antes do redirecionamento HTTP | Permitir cache do conteúdo público sem compartilhar conteúdo personalizado |
| Sínteses exigiam leitura de golds grandes no servidor | Manifesto de 89.478 bytes, materializado por `npm run preparar` e incluído no build | Tirar leitura e transformação das bases do caminho inicial |
| Layouts e página consultavam a mesma sessão | Memoização do React limitada à renderização RSC | Evitar consultas repetidas sem cache global de usuários |
| Recortes e avisos bloqueavam o mapa | Bloco independente com Suspense, após autorização | Entregar título, busca e diretório antes da retomada |
| Cabeçalho e selos tinham caches de sessão separados | Consulta compartilhada, renovada na navegação e na volta à aba | Eliminar consulta duplicada e atualizar o estado após entrar ou sair |

A assinatura do cookie só seleciona a validação adicional; o middleware consulta o endpoint existente `/api/auth/estado`, que verifica revogação, expiração e onboarding no banco antes do redirecionamento. O redirecionamento é privado e sem cache. Cookies ausentes ou inválidos não exigem essa chamada interna; sessão revogada, expirada ou incompleta recebe o mesmo artefato público. Falha no serviço de sessão retorna 503 sem cache, em vez de fingir uma conta válida. Há uma chamada HTTP interna adicional no caminho da home com cookie assinado; o ganho desse caminho depende da topologia de produção e não foi estimado. A home tem também uma verificação no cliente para a volta pelo cache do App Router após entrar; ela usa a mesma consulta de sessão dos links e selos. A API expõe apenas dois booleanos, sem dado pessoal.

O manifesto contém números, fontes, períodos, vitrines, diretório e datas-base extraídos das funções existentes. É derivado gitignorado, regenerado pelos hooks de desenvolvimento, build e testes, e distribuído junto da publicação. A equivalência com as fontes é testada. Atrasos são recalculados a partir das datas-base: não são congelados no JSON. Não há cache global de conteúdo da conta.

A composição editorial e os destinos foram preservados. A retomada continua na mesma posição quando chega. Falha em avisos não elimina recortes; nenhuma informação pessoal entra no manifesto ou na home estática.

## Método e limites

Build de produção local, Chromium/Playwright, usuário fictício e PGlite. A medição comparativa de LCP desta iniciativa não foi concluída; não se atribui ganho percentual de LCP a esta alteração.

Leituras de arquivos e consultas de sessão são instrumentadas separadamente da medição do navegador. O teste de streaming atrasa somente as consultas de recortes e avisos, mantendo a autorização normal. O atraso artificial demonstra independência do diretório; não é uma estimativa de latência do banco real.

Cache HIT do Next local comprova o artefato estático. Cache da CDN, região do banco, conexões, cold starts e comportamento de usuários reais continuam sem validação em produção. Não houve mudança de infraestrutura.


## Evidências locais

- Home PT/EN: cache HIT; nenhuma leitura de JSON público nem validação de sessão no banco quando não há cookie.
- Diretório autenticado: nenhuma leitura de JSON público; uma validação de sessão por renderização.
- Home com conta completa: HTTP 307 privado, sem cache, com uma validação de sessão.
- No diagnóstico, a primeira home observada leu 12,97 MB de JSON e as seguintes 0,87 MB; no diretório foram 16,63 MB e 0,12 MB, respectivamente.
- Com atraso artificial de 1.500 ms somente em recortes/avisos, o diretório chegou em 781 ms na primeira visita e 77 ms na seguinte; o corpo terminou em 2.226 ms e 1.548 ms. Isso prova independência, não latência do banco real.
- Telas de 320, 390, 768 e 1440 px verificadas sem erros de JavaScript ou transbordamento horizontal.

O instrumento cobre leituras síncronas de JSON sob public/, não todas as operações de I/O. As primeiras visitas compartilham a instância e não representam cold starts isolados. Os arquivos de evidência foram coletados antes da integração das atualizações posteriores do main.


## Validação da versão integrada

Em 27/10/2026, após integrar main b3af9e7cf: build de produção aprovado (1.218 páginas), lint, tipos e cobertura bilíngue aprovados. A execução completa de verificar:rapido teve 9.690 testes aprovados, 12 ignorados, 1 todo e 1 timeout de navegação em Educação nas capitais (390 px). O timeout repetiu no primeiro reteste isolado. A inspeção de requisições não encontrou operação presa, a navegação local abriu em cerca de 2 s e os três cenários passaram com instrumentação. O reteste final do arquivo original, sem mudanças de asserções ou timeout, passou nos 3 testes. A causa da intermitência não foi determinada; o CI ainda precisa confirmar a versão.

Os testes antigos de home dinâmica foram atualizados para a publicação estática. A proteção de sessão passou a ser verificada nos testes de middleware e navegador, incluindo pendência, revogação, expiração e erro de validação. Nenhum teste foi desativado para liberar a entrega.
