"""Timeline regulatória transversal do mercado de crédito — gold regulacao.json.

Camada 100% curada (pipeline/curated/timeline_regulatoria.json): marcos com
norma, data, URL oficial verificada e os painéis do Observatório que cada um
afeta. A régua é editorial — marcos que explicam quebras visíveis nas NOSSAS
séries — e nunca um censo normativo; a leitura publicada declara isso.

`serie_x` é o mês em que o marco vira marcador vertical nos gráficos do
painel (a VIGÊNCIA, quando difere da publicação — ex.: Res. 4.966 publicada
em 2021 marca 2025-01; o teto do rotativo da Lei 14.690 marca 2024-01)."""
import json
from pathlib import Path

from pipeline import common

CURADO = Path(__file__).resolve().parent / "curated" / "timeline_regulatoria.json"


def build(con=None, cfg=None):
    cur = json.loads(CURADO.read_text())
    marcos = sorted(cur["marcos"], key=lambda m: m["data"], reverse=True)
    paineis = sorted({p for m in marcos for p in m.get("paineis", [])})
    g = {
        "disponivel": True,
        "gerado_em": common.now_utc(),
        "titulo": "Regulação do mercado de crédito",
        "marcos": marcos,
        "paineis": paineis,
        "leitura": cur["leitura"],
        "timelines_tematicas": cur.get("timelines_tematicas", []),
        "fonte": {"nome": "Curadoria do Observatório sobre normas oficiais (Planalto, BCB/CMN)",
                  "nivel": "A",
                  "nota": "cada marco linka o texto oficial da norma; nenhum link é inferido"},
    }
    common.write_gold("regulacao.json", g)
    return {"ok": True, "marcos": len(marcos)}
