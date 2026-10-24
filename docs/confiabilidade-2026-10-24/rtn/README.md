# RTN e IPCA: verificação da edição sem falso positivo

Base: main `7d4c2ee77282c0d6c22fd3902869b9d2ac82cd7f`, auditoria de 24/10/2026. A referência integrada continua 2026-07. A [issue 304](https://github.com/genarolins1975/scrutiniums/issues/304) registra agosto disponível; setembro é candidato pela data, não edição confirmada nesta auditoria.

## Evidência e correções

O vigia anterior classificou como edições de agosto **e setembro** uma resposta sintética HTTP 200 com `<title>Access denied</title>Captcha`. Agora exige identificação do RTN e do período no título da página (title/h1), sem tomar os menus do portal como prova da edição; resposta vazia, genérica ou bloqueada entra em “não verificado”. Ausência de confirmação retorna código 4, distinto do código 3 de edição nova. O workflow conserva o diagnóstico no alerta.

O importador do IPCA tinha o fim da sequência fixado em julho/2026. Passa a derivar o fim do manifesto de cada edição, exigindo todos os meses desde janeiro/2023, hash, unidade, território e índices positivos finitos. `--origem` e `--destino` permitem homologar um pacote novo em diretório separado. A transformação e a fórmula permanecem idênticas. O pacote vigente reproduz exatamente o snapshot publicado, inclusive metodologia e números.

## Validação

`python -m unittest pipeline.tests.test_vigiar_rtn pipeline.tests.test_ipca_edicao pipeline.tests.test_atualizacao_por_grupo` e `python scripts/contas-publicas/importar-ipca.py --verificar`. O log está em [testes.txt](testes.txt). Os casos de edição posterior são sintéticos e explicitamente identificados; não são apresentados como IPCA de agosto coletado.

## Homologação contra a fonte real (24/10/2026, 10:33 a 10:42 UTC)

O bloqueio de rede da primeira auditoria deixou de valer nesta sessão: Tesouro Transparente, CDN do Tesouro e SIDRA responderam. Nada foi publicado; os importadores rodaram em diretórios isolados, fora dos arquivos versionados.

**Evidência**

- Edição mais recente: **agosto/2026**, publicada em 29/09/2026. Página oficial `.../boletim-resultado-do-tesouro-nacional-rtn/2026/8`, HTTP 200 às 10:34 UTC, título `Boletim Resultado do Tesouro Nacional (RTN) - 2026 - Agosto`. A de setembro (`.../2026/9`) respondeu 404 às 10:35 UTC.
- Planilha `serie_historica_ago26.xlsx` (anexo 29326 da página oficial), 4.316.738 bytes, SHA256 `0b4c8bbd6d5ea7fb2cadf306f0ed2c659c611056bf07d0ced7b8c57805583d45`. O recurso CKAN da série histórica continua apontando para `seriehistoricajul26.xlsx` (última modificação 27/08/2026), com o mesmo SHA256 do snapshot vigente. Hashes em [homologacao-sha256.txt](homologacao-sha256.txt).
- O vigia deste PR, rodado duas vezes contra a fonte, saiu com código 4 (inconclusivo) com agosto já publicado: o padrão de período não aceitava a forma real "2026 - Agosto", e o sinal do CKAN não dispara porque o Tesouro não atualizou o recurso. **Corrigido neste commit**: o título real passa a confirmar a própria edição, sem confirmar setembro nem a página de listagem do ano. A regressão usa o título capturado e falhou antes da correção; a função, alimentada com a página oficial capturada, devolve agosto/2026.
- Importador do RTN com a planilha de agosto: 80 meses e 6 anos validados. Resíduo zero nas quatro identidades (receita total menos transferências, receita líquida menos despesa, componentes da despesa, soma mensal contra anual). Agosto/2026: receita líquida R$ 187.878,3 milhões, despesa R$ 201.463,2 milhões, deficit primário R$ 13.584,9 milhões (boletim: R$ 13,6 bilhões). Com a planilha de julho, o snapshot vigente é reproduzido byte a byte nos campos de dados.
- IPCA (IBGE, tabela 1737, Brasil): `--verificar` do pacote vigente aprovado (43 meses). O endereço usado pelo importador (`servicodados.ibge.gov.br`) fechou a conexão nas quatro tentativas. Pelo SIDRA oficial (`apisidra`, 10:38 UTC): agosto/2026 = 7.633,23 (variação de 0,32% negativa no mês); os 43 meses anteriores são idênticos ao pacote vigente. Convertido sem alterar valores, o importador deste PR aprovou os 44 meses em diretório isolado. Com esse IPCA, a receita líquida real cresce 3,47% e a despesa 1,87% contra agosto/2025 (boletim: 3,5% e 1,9%).
- Retificações da edição de agosto sobre a de julho, só na despesa de 2026 e acima de R$ 10 mil apenas em maio, junho e julho; a principal é pessoal de julho/2026, de R$ 43.232,86 para R$ 43.212,75 milhões, elevando o superavit de julho de R$ 10.783,43 para R$ 10.803,55 milhões. Nenhum ano fechado e nenhuma receita integrada mudou. Lista em [retificacoes-jul26-ago26.json](retificacoes-jul26-ago26.json) (grupo, mês, linha, valor de julho, valor de agosto).

**Inferência**

O snapshot pode ser atualizado para agosto/2026 sem quebra de identidade. A retificação de julho é pequena (0,009% da despesa do mês), mas muda um número já exibido e precisa constar no texto da atualização. Fechamentos de conexão do Tesouro Transparente em requisições próximas tornam o código 4 frequente; ele é honesto, não um falso alerta.

**Pendências para a atualização dos dados (fora deste PR)**

1. `scripts/contas-publicas/importar.py` fixa a URL do CKAN de julho: rodado com agosto, grava `fonteRTN` de julho com hash de agosto. Parametrizar a URL da edição antes de importar.
2. Decisão do dono: aceitar o SIDRA (`apisidra`) como origem do pacote IPCA, com conversão versionada, ou capturar no formato v3 de um ambiente que alcance `servicodados`.
3. Atualizar o que fixa julho/2026 (`src/tests/contas-publicas-ipca.test.ts`, limiar de `AvisoAtualidadeRTN.tsx`, `pipeline/previdencia/seed/rtn.json`, referências do Agro) e declarar a retificação de julho.

Testes desta etapa: 28 Python focados e `--verificar` do IPCA aprovados ([log](testes-homologacao.txt)).

## Bloqueio externo original (primeira auditoria)

O proxy do ambiente recusou CONNECT ao Tesouro antes de a requisição chegar à instituição. Não foi possível reconfirmar a edição mais recente, capturar a planilha nem homologar os números novos com o IPCA correspondente. O domínio oficial foi incluído no rascunho de rede, que precisa ser publicado. Nenhuma URL de planilha foi adivinhada, nenhum snapshot foi substituído e nenhum valor histórico foi modificado.

Após liberar acesso: consultar o recurso oficial CKAN, arquivar a planilha com SHA256 e a edição anterior; conferir receitas menos transferências, receita líquida menos despesas, componentes da despesa e soma mensal/anual usando as identidades existentes; capturar e homologar o IPCA da mesma edição; comparar retificações históricas; só então preparar a atualização dos dados para revisão. Este PR corrige a detecção e a preparação da homologação, mas **não resolve ainda a defasagem do RTN**.

27 testes Python focados aprovados e 43 meses do IPCA vigente reproduzidos. `npm run verificar:rapido` aprovado ([log](rapido.txt)).
