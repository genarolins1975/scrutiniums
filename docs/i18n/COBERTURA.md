# Inventário inicial de cobertura

`cobertura.json` é a saída determinística de `scripts/cobertura-i18n.mjs`. Nesta entrega, ele inventaria fontes e pendências, ainda sem catalogar traduções. Não conclui a fase 0 nem declara paridade de URLs, fallback verificado ou ausência de vazamento de idioma.

## Gerar e conferir

Usar Node 22 e as dependências existentes do projeto. Em clone limpo, preparar os mesmos recortes canônicos utilizados pelo build:

```sh
npm ci
node scripts/materializar-assistencia.mjs
node scripts/materializar-seguranca-alimentar.mjs
node scripts/minify-obs.mjs
node scripts/cobertura-i18n.mjs
node scripts/cobertura-i18n.mjs --check
```

O minificador também materializa Trabalho e Renda. O comando sem argumento grava somente `docs/i18n/cobertura.json`; `--check` compara os bytes e falha se divergirem, sem corrigir o arquivo; `--stdout` imprime o relatório. O scanner não executa código do aplicativo, não materializa dados e não escreve nas fontes. Usa TypeScript e parse5, já presentes no projeto.

O portão obrigatório do CI será ativado no PR seguinte, junto da regeneração do relatório nos workflows que publicam dados. Ativá-lo isoladamente deixaria a próxima coleta automática com cobertura desatualizada: o relatório assina os bytes da gold, mesmo quando apenas os valores mudam. Essa integração também precisa regenerar o relatório depois de trazer mudanças concorrentes de `main`, sem resolver automaticamente conflitos de dados. Esta subdivisão mantém pequeno o PR do inventário; a obrigação de conferência contínua da fase 0 permanece pendente.

## O que cada contagem significa

- Interface: ocorrências sintáticas em código e HTML. Texto JSX, atributos, props, literais, templates, chaves de objetos e expressões não resolvidas têm contadores separados. Não são chaves de tradução; incluem códigos e outros conteúdos que exigem classificação.
- Gold: todas as strings JSON são candidatas, inclusive vazios, nomes, datas e códigos. `ocorrencias_textuais` conta valores string; `campos_candidatos_nao_catalogados` conta JSON Pointers distintos por arquivo, agrupando apenas índices de arrays como `*`. Chaves de objetos permanecem intactas.
- Conteúdo adicional: Constituição, configuração institucional, contrato da API e documentos HTML publicados entram explicitamente. Markdown conta linhas não vazias, sem afirmar equivalência a frases ou chaves. Scripts embutidos no HTML permanecem pendentes.
- Rotas: conta arquivos `page` e `route`, inclusive templates com parâmetros. Não enumera URLs nem comprova sua política de acesso. A apresentação pública do Crédito pertence ao domínio Crédito; por isso a plataforma tem 28 páginas, além dessa página que constava entre as 29 páginas gerais do diagnóstico inicial.
- Chaves e campos catalogados: todos permanecem zero, pois o catálogo ainda não existe. Isso não significa que estejam traduzidos ou corretamente marcados. O percentual é `null` e `cobertura_completa` é `false` em todos os domínios.

Não há detecção de idioma por aproximação, tradução automática ou inferência de que strings em inglês já estejam aprovadas. A presença futura dos caminhos previstos para dicionários, arquivos paralelos ingleses ou páginas `/en` reprova este scanner inicial até que o catálogo seja integrado. Esse bloqueio é transitório: não substitui a futura verificação semântica de cobertura.

## Fontes e integridade

`config/i18n-inventario.json` declara raízes, domínios, conteúdos adicionais, exclusões e materializações esperadas. O domínio é o prefixo mais específico. A descoberta inclui arquivos versionados e arquivos novos não ignorados pelo Git; uma fonte nova não exige editar uma lista manual de arquivos. Arquivos textuais sem extrator em raízes observadas aparecem em `nao_classificadas`, com caminho e motivo. Exclusões também são listadas individualmente.

Arquivos gerados e ignorados só entram quando declarados nas materializações. SUAS e Segurança Alimentar têm hash do seed conferido, saídas esperadas presentes e JSON parseável; isso **não** comprova equivalência de cada saída com seu gerador. Trabalho e Renda também compara os bytes publicados ao payload canônico descomprimido. O relatório identifica a modalidade de verificação. Os quatro CSV materializados permanecem entre os arquivos sem extrator. A assinatura do gerador torna sua alteração visível, mas ainda é necessário atualizar o inventário quando ele acrescentar saídas ignoradas pelo Git.

Assinaturas SHA-256 identificam manifesto, bytes das fontes analisadas, arquivos pendentes e geradores. O relatório não contém horário corrente ou caminho absoluto da máquina. Saída obrigatória ausente, hash incompatível, caminho fora do repositório, domínio ambíguo, fonte duplicada e sintaxe de código inválida causam erro.

Raízes futuras, exportações, comunicações e campos textuais ainda exigem inventário semântico. Evidências brutas e séries excluídas não são declaradas traduzidas. Os testes de vazamento de português/inglês, marcadores acessíveis, paridade e hashes dos textos traduzidos serão acrescentados com a infraestrutura correspondente.

## Atualização prevista

1. Integrar regeneração nas publicações automáticas e exigir `--check` no CI.
2. Catalogar chaves e campos com referências ao glossário, fontes e estado de tradução.
3. Conferir o uso dos marcadores no HTML e no DOM da SPA, associando-o ao catálogo.
4. Medir rotas concretas e exportações, incluindo parâmetros e política de acesso.

Nenhum desses passos autoriza alterar a gold portuguesa, números publicados, a Constituição original, notas editoriais ou decisões institucionais.
