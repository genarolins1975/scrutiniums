# Acesso à Justiça — OBEE

Seis páginas sob `/eficiencia-estatal/acesso-justica`: panorama, cobertura, tempo-resposta, conciliacao, recursos e dados. Integração no panorama do OBEE, no mapa de serviços e no sitemap.

## Dados e limites

- Pesquisa Nacional da Defensoria Pública 2025: original XLSX obtido em 10/10/2026. Aba Comarcas com 2.563 registros, cobertura em 24/04/2025 e população estimada em 2024; 1.334 regulares, 200 parciais, 1.029 sem atendimento. População da base: 212.583.750.
- Relatório Administrativo: recorte de 108 UF/ano (27 UFs, 2021–2024); a interface compara 2024. Colunas D, S, T, AC, AD e AT. DPU excluída do agregado estadual. Execução de 2024: R$ 9.049.781.922,47. Não há reconciliação de estágio contábil com Siconfi.
- CNJ, Justiça em Números 2026, obtido da Biblioteca Digital oficial: ano-base 2025. Figura 285, p. 333, para 27 tribunais; quadros p. 22–24; conciliação p. 232–234. Todas as durações permanecem na precisão publicada (meses).
- Originais identificados por URL e SHA-256 em `public/eficiencia/justica/fontes.json`. O recorte inclui localizadores por linha. O texto extraído dos quadros CNJ está preservado na semente para conferência.
- Pará e São Paulo: acordos extrajudiciais não informados. Roraima: zero informado. Minas Gerais: 1.335.367 acordos preservados, com ressalva visível; não corrigidos nem excluídos por serem elevados.
- Não se somam acordos extrajudiciais e judiciais; não se divide acordos por atendimentos como taxa de sucesso; cobertura territorial não é cobertura individual.
- Sem escore agregado, satisfação, demanda reprimida estimada ou conclusão causal.

## Reprodução

```bash
python3 -m pipeline.justica.capturar --reproduzir
python3 -m unittest pipeline.tests.test_justica
npx vitest run src/tests/obee-justica.test.ts
```

Para uma nova captura, baixar o XLSX da pesquisa e o PDF da biblioteca do CNJ, extrair com `pdftotext -layout` e executar:

```bash
python3 -m pipeline.justica.capturar --xlsx /caminho/base.xlsx --cnj-text /caminho/cnj.txt --cnj-pdf /caminho/cnj.pdf
```

A captura atual fixa a edição e páginas do CNJ e inclui transcrição explícita dos quadros nacionais, conferida visualmente. Não é um coletor genérico para edições futuras: atualizar localizadores e conferir os números antes de promover. A semente determinística reproduz a publicação sem rede. JSON e CSV publicados são versionados, portanto o build não depende dos portais externos nem de leitura de arquivos em função serverless.

## Comportamento

Filtros e ordenação persistem na URL pelo hook compartilhado do projeto. Gráficos têm tabelas equivalentes; cobertura alterna comarcas/população sem confundir os denominadores. Consulta de comarcas pagina a tela (25 linhas) e exporta todo o recorte. Comparadores exportam todas as entidades com valor nulo preservado. Os downloads integrais mantêm linhas de origem, fonte e ano no snapshot e no manifesto.

## Verificação dos dados

Leitor de XLSX da coleta usa XML/ZIP da biblioteca padrão. Conferência separada com openpyxl comparou todas as 2.563 comarcas e as 108 UF/ano com o original: nenhum desvio. Figura 285 e série total da figura 190 conferidas visualmente no PDF oficial. Testes de regressão verificam contagens, soma populacional, ausência versus zero, duplicatas, divisão inválida, durações e igualdade da publicação com a semente.

A avaliação visual e o estado de publicação estão em `VALIDACAO.md`.
