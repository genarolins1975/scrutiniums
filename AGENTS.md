# Scrutiniums: instruções para agentes (Codex e outros)

Leia e siga **`CLAUDE.md`** na raiz deste repositório; ele vale para qualquer agente, não só para o Claude.

Antes de qualquer teste, rode `bash scripts/preparar-sessao.sh` (idempotente): instala as dependências se faltarem, materializa os derivados, aponta um Chromium compatível com o Playwright do projeto e ajusta o heap do Node.

Regra principal: todo trabalho em página, painel, observatório, gráfico, tabela, texto exibido, navegação, logos de empresas, artefato didático, PR, merge ou conferência em produção segue a skill **`.claude/skills/observatorio-layout/SKILL.md`**. Leia o arquivo inteiro antes de começar. A pasta `.claude/` está no `.gitignore`, mas este arquivo é versionado e está no repositório.

Antes de empurrar: `npm run verificar:rapido` (filtro de poucos minutos) e, para reproduzir o CI na máquina, `npm run verificar:pr`. Detalhes na seção "Comandos do repositório" do `CLAUDE.md`.
