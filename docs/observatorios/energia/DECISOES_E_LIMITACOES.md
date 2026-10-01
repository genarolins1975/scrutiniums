# Decisões e limitações do Observatório do Setor Elétrico

Registro das escolhas técnicas e editoriais reversíveis feitas na execução da especificação (`ESPECIFICACAO.md`), com o motivo e a forma de reverter. Limitações externas ficam na segunda parte, com evidência.

## Decisões

| ID | Data | Decisão | Motivo | Como reverter |
| --- | --- | --- | --- | --- |
| D01 | 30/09/2026 | Manter a stack (Next.js 14 App Router, páginas `force-static` lendo golds JSON no build, pipeline Python) | A arquitetura atual já separa bronze, silver com vintages e gold com proveniência; trocar de stack não resolve problema concreto (seção 3.8 da especificação) | não se aplica |
| D02 | 30/09/2026 | Módulos temáticos descobertos automaticamente em `pipeline/energia/modulos/` (REGISTRO + `coletar` + `construir`), sem editar `run.py` por módulo | Permite desenvolver módulos em paralelo sem conflito e mantém a sentinela de regressão igual para todas as golds | registrar os builders manualmente no `run.py` |
| D03 | 30/09/2026 | Silver por família de fontes (`data/energia/silver/<familia>.db`), com o mesmo esquema do silver principal; cópia durável das famílias num segundo asset da release `energia-estado` | Evita disputa de escrita entre coletores e mantém cada banco num tamanho que o cache do Actions comporta; o `energia.db` original (ONS e CCEE) continua intacto | unificar os bancos com `ATTACH` e cópia das tabelas |
| D04 | 30/09/2026 | Tabela `registros` no silver para cadastros, cronogramas e atos (texto), com a mesma semântica de revisão das observações numéricas | O histórico de previsões de entrada em operação (RALIE), de cadastro (SIGA) e de atos precisa ser reconstituível por data; o bronze sozinho fica só no cache e pode ser despejado | nenhuma: tabela aditiva |
| D05 | 30/09/2026 | `pyarrow` como única dependência Python além da biblioteca padrão no pipeline de energia (`pipeline/energia/requirements.txt`), instalada no workflow de energia e no CI | A ANEEL publica Parquet oficial equivalente ao CSV, de 10 a 20 vezes menor (compensações de continuidade: CSV de ~1 GB, Parquet de ~58 MB) | ler os CSV em fluxo com `csv` da biblioteca padrão |
| D06 | 30/09/2026 | Catálogo único de métricas em `pipeline/energia/metricas/` publicado em `metricas.json`; a interface nunca reimplementa fórmula | Seção 11.2: uma definição, várias superfícies (KPI, gráfico, tabela, texto, exportação e documentação) | não se aplica |
| D07 | 30/09/2026 | Chave canônica de pessoa jurídica = CNPJ de 14 dígitos (`pipeline/energia/entidades.py`); vínculo por nome proibido | SAMP, continuidade, tarifas, SIGA e CVM trazem CNPJ; a mesma definição de distribuidora liga Perdas, Qualidade, Conta de luz e Empresas (seção 9.8) | não se aplica |
| D08 | 30/09/2026 | Títulos em serifa da identidade Scrutiniums; texto, rótulos e números em sem serifa (Inter e Archivo Narrow) | A especificação pede tipografia sem serifa legível e também preservar a identidade do Scrutiniums (seção 8.1); a serifa fica restrita a títulos, e todo texto corrido, dado e controle é sem serifa | trocar `font-serif` por `font-sans` nos títulos do domínio |
| D09 | 30/09/2026 | Verbetes de módulo em `src/lib/energia/conteudo/conceitos-<modulo>.ts`, com substituição por slug de verbete base pendente | Permite que o módulo que conferiu a fonte primária publique o verbete sem conflito de edição | reunir num arquivo só |
| D10 | 30/09/2026 | Conjuntos integrados pelos módulos entram no catálogo e na página Dados a partir do REGISTRO do módulo (`catalogo.json` → `DATASETS_INTEGRADOS`) | Uma só declaração por conjunto; a lista da interface não é mais mantida à mão para os módulos novos | voltar à lista estática em `datasets.ts` |
| D11 | 30/09/2026 | Inspeção visual e de acessibilidade por `scripts/energia-inspecao.mjs` (Chromium headless, axe-core, larguras 360, 390, 768 e 1440 px, links internos, rolagem horizontal, erros de console) | Evidência reproduzível de inspeção; é medida de laboratório, não de campo | não se aplica |

## Limitações externas (com evidência)

| ID | Limitação | Evidência | Alternativas tentadas | Efeito |
| --- | --- | --- | --- | --- |
| L01 | Portal de dados abertos da CCEE e site da CCEE recusam acesso automatizado a partir do ambiente de construção | 30/09/2026 21:3x UTC: `https://dadosabertos.ccee.org.br/api/3/action/package_list` e `https://www.ccee.org.br/` → HTTP 403 com página "Acesso bloqueado" do WAF da origem | Nenhuma tentativa de contorno (proibido pela seção 11.1); a coleta direta roda no GitHub Actions, onde já funcionou para o PLD | Conjuntos exclusivos da CCEE dependem da coleta no Actions |
| L02 | INMET (portal e API) sem resposta a partir do ambiente de construção | 30/09/2026: `https://portal.inmet.gov.br/` e `https://apitempo.inmet.gov.br/` sem resposta em 25 s | ver documento do módulo Água e clima | Fonte de clima escolhida com evidência no módulo |
| L03 | SIGEL (geoinformação da ANEEL) sem resposta a partir do ambiente de construção | 30/09/2026: `https://sigel.aneel.gov.br/` com túnel encerrado após 11 s | ver documento do módulo Perdas | Geometria das áreas de concessão decidida no módulo |
