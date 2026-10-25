# Revisão independente do protótipo — Educação PR2

2026-10-25. Diretório `/tmp/educacao-pr2`. Revisão estática de pipeline, validações, testes, tipos, leitura de dados e componentes React/CSS; leitura dos contratos no pedido original. Nenhum teste/build/servidor executado, nenhuma implementação alterada e nenhum arquivo escrito no repositório. Apenas este relatório em `/tmp`. Os protótipos ainda não estão integrados; ausências de integração são identificadas como pendências, não regressões em produção.

## Achados pendentes

### 1. Validação de publicação não cobre o novo mapa e suas contagens (P2)

Arquivos: `/tmp/educacao-pr2/pipeline/educacao/gold.py:189`, `/tmp/educacao-pr2/pipeline/educacao/run.py:69`, `/tmp/educacao-pr2/pipeline/educacao/validacoes.py:243`.

`mapa_compacto` deriva resultado municipal, ausência e cobertura de BR/27UFs; `run.saidas` serializa seu retorno diretamente. `validar_analises` roda dentro de `construir`, antes de o mapa existir, e não recebe esse objeto. Portanto não existe retenção de publicação por cobertura incoerente, município duplicado/omitido, motivo divergente ou resultado deslocado no mapa. O teste novo lê IDs e equivalência null/motivo, mas não reconcilia as contagens por UF/etapa/motivo nem cada resultado com o município de origem.

O algoritmo atual parece correto por inspeção; o defeito concreto é a ausência da validação exigida pelo contrato “toda derivação nova ... com validação em validacoes.py”. Sugestão: validador do mapa antes da serialização, reconciliando IDs,UF,resultados,motivos e total=comIdeb+motivos em BR e cadaUF; caso de corrupção que demonstre retenção. Não basta testar apenas o caminho feliz.

### 2. Auditoria descarta os hashes anteriores (P2)

Arquivo: `/tmp/educacao-pr2/conferir.py:15–26` (referência inicial linha15).

O script compara os campos anteriores com os novos e calcula hashes das27UFs, mas a variável `hashes` não vai para o relatório. Também não registra o hash do arquivo principal anterior, sua versão ou seu `hash_dados`. `auditoria-inicial.json` contém somente a versão nova, o hash novo e a alegação de preservação. Isso dificulta reproduzir contra qual snapshot os28 arquivos foram comparados e não materializa a exigência de conferir/documentar o hash anterior.

Sugestão: incluir hashes/versão anterior e nova no artefato de auditoria, além da comparação campo a campo já presente. Não recomendo remover essa comparação: ela fornece evidência mais específica do que apenas ver hashes diferentes após acrescentar derivações.

### 3. Placar da ficha não segue a “linha de oito edições” mesmo em tela larga (P3, contrato de apresentação)

Arquivo: `/tmp/educacao-pr2/educacao-extra.css:7`.

A grade de metas usa quatro colunas em todas as telas acima640px e duas abaixo, tanto para cobertura nacional quanto para a ficha. As oito edições da ficha serão duas linhas também no desktop, em vez da linha de oito pedida. Não é falha matemática ou acessível, e a adaptação móvel em várias linhas é razoável.

Sugestão: classe específica da ficha com oito colunas em largura suficiente, mantendo agrupamento responsivo sem reduzir texto. Confirmar depois do build se os rótulos cabem; não atribuo nota visual nesta revisão.

## Achados comunicados e corrigidos durante a revisão

- **Teste na classe errada:** a primeira leitura tinha `TestGold.test_limiar_decimal_exato_nao_depende_do_erro_binario` chamando `self.serie`, helper existente apenas em `TestAnalisesDidaticas`. O agente principal informou que removeu a cópia incorreta mantendo a correta. Não executei a suíte.
- **Ausência histórica apagada quando também não havia meta:** `analise_serie` retornava motivo apenas no estado `sem_ideb`, tornando sem motivo os casos classificados `sem_meta`. Exemplos reais lidos da gold anterior: Jandaíra/BA2917904, anos finais2009; Igaratá/SP3520202, anos finais2021; Natividade/TO1714203, anos finais2021 — todos sem meta/Ideb e marcaND. Na releitura, `gold.py:155` já preservava `motivo_historico` sem condicioná-lo ao estado, e `validacoes.py:263` verificava motivo sempre que faltava Ideb. O agente principal informou também a correção do cartão e novo caso de teste. Não tratar como achado pendente.

## Matemática e dados: resultados da inspeção

- Decomposição implementa a fórmula pedida com N/P da gold, sem arredondamento adicional; P é o residual, de modo que as contribuições fecham a diferença do produto. Pares exigem Ideb,N,P presentes. Componentes zero impedem logaritmo e são explicitados. Limiar0,05 usa Decimal construído da representação da gold, evitando classificação binária incorreta no limite. Não encontrei erro matemático concreto nessa fórmula.
- Seletores só oferecem pares válidos; a escolha inicial aproxima2019/2025 e há aviso quando não existem duas edições completas. N/P, produtos e parcelas têm unidades/precisão declaradas. Envelope explicita não causalidade, dependência entre N/P e mudança de alunos.
- Metas usam Ideb publicado e projeção da edição, não produto calculado, e contagens nacionais excluem do denominador quem não tem ambos. Texto distingue2023/2025 sem meta e usa a linguagem solicitada.
- As barras de atendimento não fabricam a separação federal/estadual por etapa. A gold atual só tem essas quatro dependências para educação básica total; anos iniciais/finais permitem municipal+outras públicas+privada; creche/pré só municipal+demais. A implementação explica essa limitação. Isso é uma diferença em relação ao pedido literal de quatro dependências “por etapa”, a ser declarada na entrega; não é matematicamente legítimo inventar a separação. Não requer outra coleta dentro do escopo de dados existentes.
- Li os arquivos da gold e geometria existentes, sem executar o pipeline: ambos têm5571IDs; nenhum ID municipal da gold está ausente na geometria. Assim, não identifiquei perda territorial na reutilização da malha.
- Brasil/UF usam os histogramas20faixas já publicados, com mediana/quartis/n e marca da faixa da cidade. Séries estaduais são ordenadas por nome e explicitam rede pública, nacional municipal. Unidades e linha2021 são passadas ao componente.

## Acessibilidade: evidência estática e limites

Não encontrei bloqueio inequívoco de teclado por inspeção: controles são selects/botões nativos com rótulos; tabelas oferecem seleção municipal alternativa ao SVG; mudança da decomposição tem `aria-live`; barras decorativas ocultas possuem totais e partes textuais equivalentes. Cores do mapa são sequenciais, ausências delegam hachura ao componente compartilhado e a lista de motivos tem contagens.

Isto não comprova comportamento no navegador. Verificar depois da integração: seleção e troca deUF/etapa pelo teclado, foco ao selecionar cidade, anúncio da seleção, rolagem da tabela longa, valores e botões da decomposição após mudar ambas as edições, tabelas expandidas, contraste real dos20tons e legibilidade das legendas. O bloco `aria-live` da cidade só é montado na primeira seleção; conferir anúncio real por leitor de tela, pois região criada já com conteúdo nem sempre é anunciada. Sem evidência de leitor de tela, trato como ponto de verificação, não defeito confirmado.

## Pendências próprias da integração

- Incluir o destino mapa na navegação da coleção, conforme pedido; essa alteração não está no conjunto de protótipos revisado.
- Incorporar CSS e gold nova em conjunto; tipos não são retrocompatíveis com a gold sem `analises`/`composicao_matriculas`.
- Confirmar fechamento HTTP sem sessão do novo `/educacao/gold/mapa.json` e acesso com conta à rota. A página estática por si só não prova proteção; depende da camada compartilhada de acesso.
- Documentar a versão1.1.0 e a auditoria completa, validar a geração e então testar navegador. Nenhum resultado de teste novo é atribuído a esta revisão.

## Adendo — correções verificadas por leitura

Confirmei as três correções pendentes: `validar_mapa` reconcilia registros/resultados/motivos e coberturaBR/UF com a gold de origem e é chamado em `run.saidas` antes da serialização; testes novos alteram uma contagem e um valor para verificar rejeição. `conferir.py` agora registra hashes dos28 arquivos anteriores e versão/hash de dados anterior. A classe específica `.edm-placar-cidade` recebe oito colunas a partir de1100px. Esses achados estão resolvidos no protótipo. O agente principal informou cinco testes aprovados; não os executei. Integração, acessoHTTP e navegador continuam fora da evidência desta revisão.
