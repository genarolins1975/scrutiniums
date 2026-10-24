# Verificação adicional: Origin do POST de continuidade

Revisão sem edição no checkout, Next14.2.35, build `tnEt0wD5K5bo3Ayunr8ee`.

Conclusão: não há evidência de incompatibilidade no caminho padrão do launcher Vercel com `trustHostHeader=true`. Há incompatibilidade reproduzida ao executar `next start` atrás de proxy com domínio público: o novo endpoint usa a origem interna de `req.url` e devolve403. O endpoint antigo aceita a origem canônica nesse mesmo ensaio. São cenários distintos; o ensaio local não prova falha em Vercel.

## Evidência local real

Script externo `/tmp/pr365-origem-proxy.mjs`, fixture oficial de servidor/banco/sessão temporários. Resultados em `/tmp/pr365-origem-proxy.json`.

| Entrada simulada | Novo POST | POST antigo |
|---|---:|---:|
| Origin local igual ao endereço do servidor |204|303|
| Host/Origin HTTP não canônico app.example.test |403|403|
| Host scrutiniums.com, Origin https://scrutiniums.com, forwarded host/proto públicos |403|303|
| Host interno, Origin canônica HTTPS, forwarded host/proto públicos |403|303|
| Origin externa evil.example.test |403|403|

O POST antigo redirecionou para `https://localhost:<porta>/setor-eletrico` no ensaio de proxy TLS: sua validação de origem tem compatibilidade maior, mas a construção do redirecionamento também depende de req.url. Não se declara o endpoint antigo integralmente correto sob essa implantação a partir deste teste.

## Por que ocorre

- `node_modules/next/dist/server/next-server.js:1162`: quando há hostname/porta, `initURL` é montado com esses valores internos e protocolo de x-forwarded-proto. Sem hostname/porta e com trustHostHeader, usa `https://${headers.host}`.
- `node_modules/next/dist/server/web/spec-extension/adapters/next-request.js:84`: o Route Handler recebe NextRequest cuja URL absoluta usa esse initURL.
- `node_modules/next/dist/build/index.js:716`: manifesto de servidor define `trustHostHeader: hasNextSupport`.
- `node_modules/next/dist/telemetry/ci-info.js:34`: hasNextSupport deriva de NOW_BUILDER nesta versão.
- Manifesto local examinado: trustHostHeader=false.

O padrão existente em `src/app/app/(foco)/observatorios/entrar/route.ts:19` admite scrutiniums.com/www, Host direto e, apenas com VERCEL=1 ou TRUST_PROXY=1, x-forwarded-host. O novo POST não reaproveita essa política; exige Origin exatamente igual a req.url, inclusive protocolo.

## Vercel

Fontes públicas atuais consultadas, preservadas em `/tmp/pr365-vercel-*`:

- https://github.com/vercel/vercel/blob/main/packages/next/src/server-launcher.ts — NextServer com minimalMode=true, sem hostname/porta.
- https://github.com/vercel/vercel/blob/main/packages/next/src/server-build.ts — configuração do manifesto required-server-files é incorporada ao launcher.

Ensaio diretamente com attachRequestMeta e NextRequestAdapter instalados, sem alterar fontes: `/tmp/pr365-origem-adapter.json`. Sem hostname/porta e trustHostHeader=true, req.url=`https://scrutiniums.com/api/conta/ultimo-acesso` e a comparação de Origin passa. Com trustHostHeader=false, o fallback é `http://n/...` e falha. Esse ensaio valida o mecanismo, não substitui acesso ao manifesto de um deployment concreto da Vercel. O manifesto de produção não foi inspecionado.

## Consequência para o PR

Se o ambiente suportado é exclusivamente o launcher padrão da Vercel com o manifesto esperado, não há defeito demonstrado nesse destino. Se também é suportado next start/standalone atrás de proxy, o caso canônico403 é um defeito real de continuidade nessa topologia; convém alinhar a verificação à política de origem já existente, sem confiar indiscriminadamente em forwarded headers. Não foi feita alteração de autenticação, política, código ou configuração durante a revisão.
