# Proposta editorial para registrar revisões assistidas por IA

13/10/2026. Proposta não implementada. `revisao_v3.py`, `revisao-v3-pareceres.json` e `revisao-v3-status.json` permanecem intactos. Este documento não cadastra parecer, não autentica o modelo citado no anexo e não preenche `independence_declared`.

## Natureza e vínculo documental

Uma revisão por modelo de IA é **análise automatizada complementar**, com potencial para reproduzir cálculos, localizar inconsistências e sugerir verificações. Não é um parecer humano independente, assinatura profissional, declaração de ausência de conflitos nem aprovação editorial. Usar outro modelo ou fornecedor não demonstra independência humana: contexto, fontes, treinamento, operador e instruções podem ser compartilhados.

Propor um registro próprio, separado dos `records` de pareceres humanos, vinculado ao SHA-256 do pacote efetivamente examinado. Não adaptar artificialmente a saída do modelo ao contrato humano atual. Se a análise cobrir complementos externos ao pacote, identificar seus arquivos e hashes separadamente.

| Campo proposto | Conteúdo e regra |
|---|---|
| `analysis_id`, `schema_version` | Identificador único e versão do contrato de análises automatizadas |
| `nature` | Valor específico `analise_automatizada_ia`, sem equivalência a parecer humano |
| `packet_sha256`, `repository_commit` | Identidade exata dos insumos examinados; divergência impede associação |
| `supplementary_inputs` | Caminhos, hashes, referência temporal e proveniência dos complementos |
| `provider`, `model_label`, `model_version` | Metadados efetivamente disponíveis; ausentes ficam explicitamente não obtidos. Nome declarado pelo próprio texto não autentica o modelo |
| `run_started_at`, `run_finished_at`, `operator` | Datas com fuso e responsável pela execução, se documentados; não inferir identidade ou horário |
| `prompt_path`, `prompt_sha256`, `context_manifest` | Instruções e contexto preservados em artefatos permitidos, incluindo fontes fornecidas e restrições; não publicar credenciais ou dados pessoais desnecessários |
| `tools_and_execution` | Ferramentas, ambiente, comandos e logs verificáveis; distinguir cálculo executado de afirmação do modelo |
| `output_path`, `output_sha256` | Saída original preservada, inclusive ressalvas; correções posteriores em nova versão |
| `findings` | Identificador do achado, critério afetado, severidade sugerida, alegação, evidência localizada, reprodução e limites |
| `verification_state` por achado | Proposto: não conferido, reproduzido, não reproduzido ou dependente de decisão humana; acompanhado da evidência de verificação |
| `limitations` | Cobertura, fontes inacessíveis, dados ausentes, execução parcial, incerteza e possibilidade de erro do modelo |
| `human_disposition` | Registro separado e inicialmente ausente; eventual decisão humana explícita, identidade verificada, data e justificativa, sem preenchimento automático |

Não incluir `independence_declared` nesse esquema de IA. O modelo não pode declarar independência humana, e atribuir-lhe o campo para satisfazer o validador seria semanticamente incorreto. Recomendações do modelo devem permanecer recomendações; não emitir valores `approve` como se fossem decisões humanas do protocolo vigente.

## Fluxo proposto

1. Preservar a saída e verificar seus hashes e insumos. Registrar como não obtida qualquer informação de proveniência que falte. O relatório fornecido pelo usuário pode ser lido e usado para orientar correções sem ser incorporado como parecer independente.
2. Reproduzir cada achado testável e registrar qual evidência confirma ou refuta a alegação. Atribuição a um modelo não é prova do achado; a reprodução também não decide questões normativas.
3. Apresentar ao editor os achados e as decisões abertas. Uma pessoa pode usar assistência de IA e ainda produzir um parecer próprio, mas deve assumir responsabilidade, declarar a assistência e cumprir os requisitos humanos de identidade, competência e conflitos do protocolo aprovado. Não converter automaticamente a análise em assinatura dessa pessoa.
4. Se aprovado editorialmente, desenvolver esse registro em nova versão compatível com as regras de congelamento. Validadores futuros devem rejeitar análises de IA inseridas no conjunto de pareceres humanos e testar que elas não completam critérios pendentes, não alteram `publication_ready` e não mudam travas.

Decisões pendentes do editor: aceitar ou não esse tipo de registro, definir sua nomenclatura pública, o nível de proveniência exigido e como apresentar a assistência em pareceres humanos. Nenhuma delas foi tomada por este documento.
