"""Sentinela de regressão do gold — o painel não sai do ar em silêncio.

Roda no workflow diário entre o build e a publicação. A lição de 08/08/2026:
o build do Pix estourou, o gold virou stub de erro ({"disponivel": false}),
o pix_mun.json nem chegou a ser escrito — e o workflow terminou VERDE. O
alerta de falha só vê término anormal; a vigília de frescor só vê data. Um
painel inteiro ficou fora do ar sem nenhum vigia acusar.

O contrato deste cheque:
- compara cada *.json do topo de data/gold (o build novo) com o homólogo em
  public/obs/data/gold (a última publicação, presente no checkout);
- REGRESSÃO = arquivo que era íntegro e virou stub de erro, ou que era
  publicado e o build novo não escreveu (o rsync --delete o apagaria);
- em regressão, restaura a última publicação em data/gold — o leitor segue
  vendo o dado íntegro anterior, com a posição que ele declara — e acusa;
- a lista de regressões sai em stdout e em `regressoes` no GITHUB_OUTPUT,
  onde o passo seguinte do workflow abre/comenta a issue;
- degradação em estado estável (stub ontem E hoje, ex.: desenrola sem fonte)
  não é regressão: já foi acusada quando aconteceu.

Sempre sai com código 0: a publicação do restante continua — o alerta é a
issue, não a falha do workflow (falhar aqui esconderia os painéis saudáveis).
"""
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
NOVO = RAIZ / "data" / "gold"
PUBLICADO = RAIZ / "public" / "obs" / "data" / "gold"


def _stub(path: Path):
    """True se o arquivo é um stub de erro; None se ilegível/inexistente."""
    try:
        d = json.loads(path.read_text())
    except Exception:
        return None
    if not isinstance(d, dict):
        return False
    return d.get("disponivel") is False or d.get("ok") is False


def _declara_restaurados(regressoes):
    """Escreve em data/gold/meta.json quais golds estão no ar por restauração e há
    quantos dias o build deles não sai íntegro (idade do `gerado_em` da cópia
    restaurada). Sem isto a sentinela vira mascaramento permanente: Comparar
    e Consignado ficaram três semanas restaurados sem que nada acusasse
    (auditoria de 06/09/2026, achado D3). A vigília de pane lê `restaurados`."""
    meta_path = NOVO / "meta.json"
    try:
        meta = json.loads(meta_path.read_text())
    except Exception:
        return
    agora = datetime.now(timezone.utc)
    restaurados = {}
    for r in regressoes:
        nome = r.split(" ")[0]
        try:
            pub = json.loads((PUBLICADO / nome).read_text())
        except Exception:
            pub = {}
        gerado = pub.get("gerado_em") if isinstance(pub, dict) else None
        dias = None
        if gerado:
            try:
                g = datetime.fromisoformat(str(gerado).replace("Z", "+00:00"))
                if g.tzinfo is None:
                    g = g.replace(tzinfo=timezone.utc)
                dias = (agora - g).days
            except Exception:
                dias = None
        restaurados[nome] = {"motivo": r[len(nome):].strip(" ()"), "gerado_em_publicado": gerado, "dias": dias}
    meta["restaurados"] = restaurados
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print("  restaurados declarados em meta.json:", ", ".join(f"{k} (há {v['dias']} d)" for k, v in restaurados.items()))


def main():
    if not NOVO.is_dir() or not PUBLICADO.is_dir():
        print("sanidade_gold: diretórios ausentes — nada a comparar.")
        return 0
    regressoes = []
    for pub in sorted(PUBLICADO.glob("*.json")):
        novo = NOVO / pub.name
        era_stub = _stub(pub)
        if era_stub is not False:
            continue  # publicado já era stub (ou ilegível): não há o que proteger
        if not novo.exists():
            regressoes.append(f"{pub.name} (não gerado)")
            shutil.copy2(pub, novo)
        elif _stub(novo) is True:
            regressoes.append(f"{pub.name} (stub de erro)")
            shutil.copy2(pub, novo)
    if regressoes:
        print("REGRESSÃO DE GOLD — última publicação mantida para:")
        for r in regressoes:
            print(f"  - {r}")
        _declara_restaurados(regressoes)
    else:
        print("sanidade_gold: nenhuma regressão.")
    saida = os.environ.get("GITHUB_OUTPUT")
    if saida:
        with open(saida, "a") as f:
            f.write("regressoes=" + "; ".join(regressoes) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
