# Parecer independente de UX e ratificação de origem — PR #365

**Metas de UX ratificadas; caso comprovado de proxy corrigido e validado.** Nenhuma pendência visual bloqueante identificada nas configurações examinadas. Este parecer não autoriza merge ou publicação e não substitui a homologação técnica integral.

- Commit examinado: `00f9a3838221be975718c3e1af67ef95fc096e48`.
- Build examinado: `TTwbz4-734bV6VVI1HyWJ`.
- Revisão independente da implementação, sem edição no checkout.
- Diferença desde `472746bfa16a938e1c6cc8a9ae11f97b04c952fb`: somente endpoint de continuidade e seus testes. Interface preservada.

## Notas ratificadas

| Dimensão | Anterior | Atual | Meta | Evidência |
|---|---:|---:|---:|---|
| Direção de arte |8|8|8|Papel, serifas, filetes e acentos coerentes com Crédito, Energia e Eficiência Estatal.|
| Hierarquia visual |8|9|9|Título, busca e seis destinos visíveis na primeira tela das duas contas; histórico secundário. H1 recorrente passou de633→134px em390 e479→183px em1440.|
| Tipografia |7|8|8|Escala consistente, piso12px, leitura preservada nas expansões; metadados pequenos justificam manter8.|
| Densidade informacional |8|8|8|28 coleções organizadas em seis seções; páginas/fontes expansíveis e índice evitam percurso obrigatório pelas recomendações.|
| Didática |7|8|8|Perguntas, recomendações e títulos das páginas orientam os destinos; método explica disponibilidade, parcialidade, previsão e limites de atualização.|
| Comparabilidade |8|8|8|Mesma estrutura de estado, contagem e data nas seis seções, com ausência de fonte única declarada.|
| Interação e acessibilidade |8|9|9|Foco/teclado, busca, persistência e continuidade verificados; alvos≥44×44px, piso12px, axe0 nos estados medidos.|
| Responsividade |8|9|9|Quatro configurações sem overflow; índice móvel mantém setas junto aos rótulos e seis destinos na primeira tela; expansões preservam legibilidade.|

As notas são julgamento profissional apoiado em evidências, não uma pontuação produzida por axe. Aplicam-se às configurações e tarefas verificadas. Copy nova por coleção não é bloqueio para a meta8 de didática; não foram inventadas descrições ou ampliado escopo editorial.

## Quatro configurações recapturadas

Executados no build acima:

```sh
npm run evidencias -- --rotas /app/observatorios --saida /tmp/pr365-publicacao/nova --larguras 390,1440 --modos com --conta nova
npm run evidencias -- --rotas /app/observatorios --saida /tmp/pr365-publicacao/volta --larguras 390,1440 --modos com --conta volta
```

As quatro primeiras telas foram inspecionadas diretamente. Todos os registros: HTTP200, axe0, console0, nenhum login inesperado, nenhuma rolagem horizontal. Há primeira tela e página inteira para cada configuração.

Além da inspeção, as oito imagens JPEG foram comparadas por SHA256 às capturas já examinadas do build `tnEt0wD5K5bo3Ayunr8ee`: **8/8 idênticas byte a byte**, incluindo as quatro páginas inteiras. Registro em `/tmp/pr365-publicacao/comparacao-capturas.json`. Assim, os achados visuais completos e a correção do índice390 permanecem válidos neste build.

As três referências atuais de Crédito (`/observatorio`), Energia (`/setor-eletrico`) e Eficiência Estatal (`/eficiencia-estatal`),1440px, foram capturadas e inspecionadas no build `tnEt0wD5K5bo3Ayunr8ee`, em `/tmp/pr365-definitivo/referencias`. Não foram recapturadas nesta rodada: o diff não altera suas interfaces. Os sete registros daquela rodada, incluindo quatro configurações do mapa, eram HTTP200/axe0/console0/overflow0. Fontes históricas mais antigas permanecem apenas contexto, não evidência deste build.

## Prova HTTP do proxy:13/13 aprovados

Comando executado independentemente:

```sh
node /tmp/pr365-origem-proxy-ratificacao.mjs /tmp/pr365-publicacao/proxy
```

Resultado em `/tmp/pr365-publicacao/proxy/resultado.json`, com commit/build explícitos. Usa servidor oficial local, banco e sessão temporários; nenhum acesso ou alteração de dados de produção.

| Casos | Resultado |
|---|---|
| Local autenticado; proxy TLS canônico; proxy com Host interno e Origin canônica; www canônico |4/4 HTTP204|
| Origin externa; forwarded externo não confiável; Origin ausente/null/com caminho/com credenciais/FTP |7/7 HTTP403|
| Origem válida sem sessão |HTTP401|
| Caminho fora do catálogo |HTTP400|

Respostas204 verificadas com cookie existente `scrutiniums_observatorio`, Secure, HttpOnly, SameSite=Lax e Cache-Control:no-store. Respostas recusadas não emitiram cookie.

A correção alinha os hosts permitidos à rota legada: canônicos e Host direto; forwarded somente quando VERCEL=1 ou TRUST_PROXY=1. Mantém Origin obrigatório, estritamente no formato de origem HTTP/HTTPS, e sessão obrigatória. O teste HTTP desta rodada não ativa o modo de proxy confiável; a ramificação com forwarded confiável é coberta pelos testes do endpoint, fora deste ensaio independente.

O defeito anterior foi reproduzido em `next start` atrás de proxy: Origin pública confrontada com req.url interna produzia403. **Não foi demonstrada falha no deployment padrão da Vercel.** A inspeção do Next14 e do launcher mostra que, com trustHostHeader e sem hostname/porta internos, req.url usa a origem pública. O ensaio de proxy não deve ser descrito como teste ou falha de produção na Vercel. A correção cobre a topologia local comprovada e preserva as restrições de sessão/origem.

## Funcionalidade no novo build

Inspecionado `/tmp/pr365-publicacao/funcional/resultado.json`, executado pelo implementador com script versionado: duas larguras,179 destinos, nenhum erro; alvos menores vazios, piso12px, axe0, console0 e sem overflow. Inclui recarga, retorno de página expandida com q/abertos preservados, voltar/avançar, Next sem documento extra/prefetch neutro/retorno e SPA Crédito/Pix/voltar/avançar/retorno.

Inspecionado `/tmp/pr365-publicacao/rede-lenta/resultado.json`, reexecutado pelo implementador com script independente agora versionado: cinco casos aprovados no build atual, sem pageerror. POST1000ms da SPA saiu em974ms com Pagamentos; resposta retida6000ms não bloqueou a saída, que ocorreu em2420ms. Respostas antigas não sobrescreveram o cookie de Gás após novo documento, tanto em Next quanto na SPA.

Inspecionado `/tmp/pr365-publicacao/navegacao/resultado.json`: navegação real34/34 aprovada também no build atual. Os28 links de coleções e seis observatórios responderam HTTP200, exibiram H1 e não apresentaram erro de console/pageerror, login inesperado ou rolagem horizontal. Houve33 caminhos preservados; `/observatorio` terminou em `/observatorio/map`, dentro da própria coleção. Não permanece pendência dessa verificação.

## Limitações mantidas

- Falha ou timeout do POST auxiliar pode preservar a coleção anterior em Continuar em; a saída segue disponível. Não se garante gravação offline.
- Chromium,390/1440 e fixtures oficiais constituem o escopo observado; axe não substitui testes completos com tecnologias assistivas reais.
- A rajada sintética anterior atingiu429 na telemetria existente. Navegação normal passou com5s entre casos, sem mudar a política; não se trata de teste de carga aprovado.
- Python/Vitest/Judiciário, situação remota de merge e atualização do PR pertencem à homologação técnica consolidada. Este revisor não declara esses comandos executados por si.

**Situação desta revisão: UX aprovada nas metas e compatibilidade do endpoint com o proxy ensaiado ratificada.** Nenhum pedido de mudança visual adicional. Decisão final de merge continua dependendo da homologação completa e da autorização explícita do usuário.

## Localização permanente

Os artefatos de `pr365-publicacao` estão em [depois](depois/). A referência editorial de `pr365-definitivo/referencias` está em [referencias](depois/referencias/), com seu build de origem preservado. A baseline está em [antes](antes/), e a rodada intermediária em [historico](historico/). [Relatório técnico consolidado](README.md). Os comandos mantêm os argumentos efetivamente executados.
