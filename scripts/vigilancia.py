"""Vigília do arcabouço operacional — dois cheques, ambos viram issue quando acusam.

Uso:
    python3 scripts/vigilancia.py frescor   # o gold publicado envelheceu?
    python3 scripts/vigilancia.py fontes    # saiu documento novo nas fontes manuais?

Contrato com o workflow: saída 0 = nada a fazer (silêncio); saída 3 = o texto
impresso em stdout é o corpo da issue a abrir. Qualquer outra saída é erro do
próprio cheque — e também deve virar issue, porque vigia quebrado é pior que
alerta falso.

**frescor** lê o meta.json publicado no próprio main (via raw.githubusercontent,
o que dispensa saber o domínio do site: a Vercel publica o que está no main).
Um `gerado_em` com mais de LIMITE_DIAS acusa — cobre o caso em que o workflow
diário "conclui" sem publicar, que o alerta de falha não vê.

**fontes** cobre o que o pipeline não alcança: fontes SEM API cuja atualização
é manual e documentada (FONTES_BETS.md §7). Hoje, a página de apresentações da
SPA/MF — o Panorama do 1S2026 é esperado para o fim de agosto, e é o gatilho
da maior atualização manual do painel de bets. O snapshot versionado em
pipeline/watch/ é a memória do que já foi visto: href novo acusa; incorporado o
documento, o curador atualiza o snapshot no mesmo commit da curadoria, e a
vigília volta ao silêncio.
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

META_PUBLICADO = ("https://raw.githubusercontent.com/genarolins1975/scrutiniums/"
                  "main/public/obs/data/gold/meta.json")
LIMITE_DIAS = 2

PAGINA_SPA = ("https://www.gov.br/fazenda/pt-br/composicao/orgaos/"
              "secretaria-de-premios-e-apostas/apresentacoes")
SNAPSHOT_SPA = RAIZ / "pipeline" / "watch" / "spa_apresentacoes.txt"

ACUSA = 3


def _baixa(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "ObservatorioBrasileiroDeCredito vigilancia"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def frescor():
    meta = json.loads(_baixa(META_PUBLICADO))
    gerado = datetime.fromisoformat(meta["gerado_em"])
    if gerado.tzinfo is None:
        gerado = gerado.replace(tzinfo=timezone.utc)
    idade = (datetime.now(timezone.utc) - gerado).days
    if idade < LIMITE_DIAS:
        return 0
    print(f"O gold publicado no main foi gerado em **{meta['gerado_em'][:16]}** — "
          f"há {idade} dias (limite: {LIMITE_DIAS}).\n")
    print("O pipeline diário pode estar concluindo sem publicar (push pulado ou "
          "rejeitado), ou as execuções estão falhando — conferir a aba Actions "
          "e a issue de falha do pipeline, se houver.\n")
    print("Vintages no gold publicado:\n")
    for k, v in sorted((meta.get("vintages") or {}).items()):
        print(f"- `{k}`: {v}")
    return ACUSA


def fontes():
    html = _baixa(PAGINA_SPA).decode("utf-8", errors="replace")
    hrefs = sorted({h for h in re.findall(r'href="([^"]+\.pdf)"', html, re.I)})
    if not hrefs:
        # página mudou de formato: vigia cego é pior que alerta falso
        print(f"A página de apresentações da SPA ({PAGINA_SPA}) não devolveu "
              "nenhum link de PDF — o formato pode ter mudado e a vigília está cega. "
              "Conferir manualmente e ajustar scripts/vigilancia.py.")
        return ACUSA
    conhecidos = set()
    if SNAPSHOT_SPA.exists():
        conhecidos = {l.strip() for l in SNAPSHOT_SPA.read_text().splitlines() if l.strip()}
    novos = [h for h in hrefs if h not in conhecidos]
    if not novos:
        return 0
    print("A SPA/MF publicou documento(s) que o painel de bets ainda não viu:\n")
    for h in novos:
        print(f"- {h}")
    print(f"\nPágina: {PAGINA_SPA}")
    print("\nSe for o Panorama do 1S2026, o processo manual está em FONTES_BETS.md §7: "
          "baixar o PDF, atualizar `pipeline/curated/bets.json` (séries, síntese e corte), "
          "rodar os testes e **incluir os novos hrefs em pipeline/watch/spa_apresentacoes.txt "
          "no mesmo commit** — é isso que silencia esta vigília.")
    return ACUSA


def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else ""
    if modo == "frescor":
        return frescor()
    if modo == "fontes":
        return fontes()
    if modo == "semear":
        # uso local: grava o snapshot inicial com o estado corrente da página
        html = _baixa(PAGINA_SPA).decode("utf-8", errors="replace")
        hrefs = sorted({h for h in re.findall(r'href="([^"]+\.pdf)"', html, re.I)})
        SNAPSHOT_SPA.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT_SPA.write_text("\n".join(hrefs) + "\n")
        print(f"snapshot com {len(hrefs)} hrefs gravado em {SNAPSHOT_SPA}")
        return 0
    print("uso: vigilancia.py [frescor|fontes|semear]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
