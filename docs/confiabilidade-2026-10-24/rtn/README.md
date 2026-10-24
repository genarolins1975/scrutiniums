# RTN e IPCA: verificação da edição sem falso positivo

Base: main `7d4c2ee77282c0d6c22fd3902869b9d2ac82cd7f`, auditoria de 24/10/2026. A referência integrada continua 2026-07. A [issue 304](https://github.com/genarolins1975/scrutiniums/issues/304) registra agosto disponível; setembro é candidato pela data, não edição confirmada nesta auditoria.

## Evidência e correções

O vigia anterior classificou como edições de agosto **e setembro** uma resposta sintética HTTP 200 com `<title>Access denied</title>Captcha`. Agora exige identificação do RTN e do período no título da página (title/h1), sem tomar os menus do portal como prova da edição; resposta vazia, genérica ou bloqueada entra em “não verificado”. Ausência de confirmação retorna código 4, distinto do código 3 de edição nova. O workflow conserva o diagnóstico no alerta.

O importador do IPCA tinha o fim da sequência fixado em julho/2026. Passa a derivar o fim do manifesto de cada edição, exigindo todos os meses desde janeiro/2023, hash, unidade, território e índices positivos finitos. `--origem` e `--destino` permitem homologar um pacote novo em diretório separado. A transformação e a fórmula permanecem idênticas. O pacote vigente reproduz exatamente o snapshot publicado, inclusive metodologia e números.

## Validação

`python -m unittest pipeline.tests.test_vigiar_rtn pipeline.tests.test_ipca_edicao pipeline.tests.test_atualizacao_por_grupo` e `python scripts/contas-publicas/importar-ipca.py --verificar`. O log está em [testes.txt](testes.txt). Os casos de edição posterior são sintéticos e explicitamente identificados; não são apresentados como IPCA de agosto coletado.

## Bloqueio externo e próxima ação

O proxy do ambiente recusou CONNECT ao Tesouro antes de a requisição chegar à instituição. Não foi possível reconfirmar a edição mais recente, capturar a planilha nem homologar os números novos com o IPCA correspondente. O domínio oficial foi incluído no rascunho de rede, que precisa ser publicado. Nenhuma URL de planilha foi adivinhada, nenhum snapshot foi substituído e nenhum valor histórico foi modificado.

Após liberar acesso: consultar o recurso oficial CKAN, arquivar a planilha com SHA256 e a edição anterior; conferir receitas menos transferências, receita líquida menos despesas, componentes da despesa e soma mensal/anual usando as identidades existentes; capturar e homologar o IPCA da mesma edição; comparar retificações históricas; só então preparar a atualização dos dados para revisão. Este PR corrige a detecção e a preparação da homologação, mas **não resolve ainda a defasagem do RTN**.

27 testes Python focados aprovados e 43 meses do IPCA vigente reproduzidos. `npm run verificar:rapido` aprovado ([log](rapido.txt)).
