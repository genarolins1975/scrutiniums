"""Vigília do arcabouço operacional — cinco cheques, todos viram issue quando acusam.

Uso:
    python3 scripts/vigilancia.py frescor   # o gold publicado envelheceu?
    python3 scripts/vigilancia.py fontes    # saiu documento novo nas fontes manuais?
    python3 scripts/vigilancia.py pane      # fonte essencial parada com o gold íntegro?
    python3 scripts/vigilancia.py saneamento  # as fontes do saneamento mudaram desde a coleta?
    python3 scripts/vigilancia.py dominios  # algum observatório passou do limiar de frescor? (uma issue por domínio)

Contrato com o workflow: saída 0 = nada a fazer (silêncio); saída 3 = o texto
impresso em stdout é o corpo da issue a abrir. Qualquer outra saída é erro do
próprio cheque — e também deve virar issue, porque vigia quebrado é pior que
alerta falso.

**frescor** lê o meta.json publicado no próprio main (via raw.githubusercontent).
Um `gerado_em` com LIMITE_DIAS ou mais acusa, e cobre o caso em que o workflow
diário "conclui" sem publicar, que o alerta de falha não vê. Também compara o
gold da produção com o do main: deploy que não concluiu acusa.

**fontes** cobre o que o pipeline não alcança: fontes SEM API cuja atualização
é manual e documentada (FONTES_BETS.md §7). Hoje, a página de apresentações da
SPA/MF — o Panorama do 1S2026 é esperado para o fim de agosto, e é o gatilho
da maior atualização manual do painel de bets. O snapshot versionado em
pipeline/watch/ é a memória do que já foi visto: href novo acusa; incorporado o
documento, o curador atualiza o snapshot no mesmo commit da curadoria, e a
vigília volta ao silêncio.

**saneamento** compara SINISA, SISAGUA e CadÚnico com o que public/saneamento/gold/meta.json
registra (scripts/vigilancia_saneamento.py descreve o que é e o que não é vigiado). É semanal:
o saneamento não tem coleta diária, e sem este cheque uma retificação ou edição nova passa
em silêncio.
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
# Limiar da cadência diária na fonte única de limiares (a mesma da faixa de
# frescor das páginas e do selo do Crédito): src/lib/frescor/limiares.json.
LIMITE_DIAS = json.loads((RAIZ / "src" / "lib" / "frescor" / "limiares.json").read_text(encoding="utf-8"))["cadencias"]["diaria"]["limite"]
# O que a Vercel serve. Até 13/10/2026 nada conferia que a produção servia o mesmo
# gold do main (OPERACOES.md, pontos únicos de falha).
META_PRODUCAO = "https://scrutiniums.com/obs/data/gold/meta.json"
# folga para o deploy da Vercel depois do push do pipeline
DEPLOY_FOLGA_HORAS = 3
ISSUE_RETENCAO = "Testes de conteúdo reprovaram a gold do dia: publicação retida"

PAGINA_SPA = ("https://www.gov.br/fazenda/pt-br/composicao/orgaos/"
              "secretaria-de-premios-e-apostas/apresentacoes")
SNAPSHOT_SPA = RAIZ / "pipeline" / "watch" / "spa_apresentacoes.txt"

ACUSA = 3


def _baixa(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "ObservatorioBrasileiroDeCredito vigilancia"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _instante(iso):
    d = datetime.fromisoformat(iso)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def frescor():
    meta = json.loads(_baixa(META_PUBLICADO))
    gerado = _instante(meta["gerado_em"])
    agora = datetime.now(timezone.utc)
    idade = (agora - gerado).days
    acusacoes = []
    if idade >= LIMITE_DIAS:
        acusacoes.append(
            f"O gold publicado no main foi gerado em **{meta['gerado_em'][:16]}** UTC, há {idade} dias "
            f"(limite: {LIMITE_DIAS}). As páginas /resumo e /dados exibem ao leitor o aviso de atraso.\n\n"
            "Causa mais provável, pela ordem do histórico: a gold do dia reprovada nos testes de conteúdo "
            f"(issue \"{ISSUE_RETENCAO}\", que lista os testes reprovados de cada execução); depois, "
            "execução interrompida (issue \"Pipeline diário interrompido\"). Atenção: até 13/10/2026 a "
            "execução retida terminava VERDE na aba Actions.")
    # produção ≠ main: deploy que não concluiu ou cache servindo versão antiga
    try:
        prod = json.loads(_baixa(META_PRODUCAO))
        gerado_prod = _instante(prod["gerado_em"])
        if gerado_prod < gerado and (agora - gerado).total_seconds() > DEPLOY_FOLGA_HORAS * 3600:
            acusacoes.append(
                f"A produção ({META_PRODUCAO}) serve o gold de **{prod['gerado_em'][:16]}** UTC, mais antigo que "
                f"o do main (**{meta['gerado_em'][:16]}** UTC) há mais de {DEPLOY_FOLGA_HORAS} h: conferir o "
                "último deploy da Vercel (falha de build ou deploy pausado).")
    except Exception as e:  # produção fora do ar também é achado
        acusacoes.append(f"Não foi possível ler o gold da produção ({META_PRODUCAO}): `{str(e)[:160]}`.")
    if not acusacoes:
        return 0
    print("\n\n".join(acusacoes))
    print("\nVintages no gold publicado:\n")
    for k, v in sorted((meta.get("vintages") or {}).items()):
        print(f"- `{k}`: {v}")
    return ACUSA


# Coletores cuja pane fica invisível no gold (o build sai íntegro com a última
# coleta boa) e o prazo, em dias, que a data-base de cada vintage pode ficar
# parada antes de acusar: periodicidade da fonte + a defasagem normal de
# publicação + folga. Um 404 isolado é o mês ainda não publicado, não pane.
COLETORES_ESSENCIAIS = ["bcb_sgs", "scr_data", "ifdata", "txjuros", "datajud", "djen",
                        "pix_bcb", "estban", "b3_market", "desenrola", "operacional", "sicor"]
PRAZO_VINTAGE_DIAS = {"sgs": 75, "scr": 75, "ifdata": 135, "txjuros": 45, "susep": 120, "sadipem": 60, "siconfi": 200, "tesouro_garantias": 200, "datajud": 75,
                      "b3": 15, "trends": 120, "sicor": 75, "cvm_ofertas": 45, "securit": 90, "bndes": 200, "focus": 14, "sfn_cadastro": 7, "bcb_pas": 60, "cvm_pas": 45, "caged": 45, "cda": 60, "consorcios": 135, "cobranca": 150,
                      # seis fontes sem prazo até 06/09/2026 (achado D4): mensal + defasagem + folga
                      "fidc": 75, "pix": 60, "estban": 90, "openfinance": 45, "pgfn": 135, "desenrola": 75}
# gold mantido no ar pela sentinela (build regredido) por mais que isto acusa
RESTAURADO_MAX_DIAS = 2


def _fim_do_mes(vintage):
    """'2026-07' → último dia de julho de 2026 (a data-base é o mês inteiro)."""
    ano, mes = int(vintage[:4]), int(vintage[5:7])
    if mes == 12:
        return datetime(ano + 1, 1, 1, tzinfo=timezone.utc)
    return datetime(ano, mes + 1, 1, tzinfo=timezone.utc)


def pane():
    """Fonte silenciosamente parada: coletor essencial com zero chaves ok e
    falhas que não são o 404 do mês ainda não publicado, ou vintage que não
    avança além do prazo da fonte — tudo com o gold íntegro e o frescor em dia.
    É o buraco entre as duas vigílias anteriores (avaliação de 05/09/2026)."""
    meta = json.loads(_baixa(META_PUBLICADO))
    status = meta.get("fontes_status") or {}
    hoje = datetime.now(timezone.utc)
    acusacoes = []
    for k in COLETORES_ESSENCIAIS:
        st = status.get(k)
        if not isinstance(st, dict):
            continue
        falhas = st.get("falhas") or []
        reais = [f for f in falhas if "404" not in str(f.get("erro", ""))]
        if (st.get("ok") or 0) == 0 and reais:
            acusacoes.append(f"- coletor `{k}`: 0 chaves ok, {len(falhas)} falha(s). "
                             f"Primeira: `{str(reais[0].get('erro', ''))[:160]}`")
    for k, prazo in PRAZO_VINTAGE_DIAS.items():
        v = (meta.get("vintages") or {}).get(k)
        if not v or len(str(v)) < 7:
            continue
        idade = (hoje - _fim_do_mes(str(v))).days
        if idade > prazo:
            acusacoes.append(f"- vintage `{k}` parado em **{v}** há {idade} dias após o fim da data-base "
                             f"(prazo da fonte: {prazo}).")
    # builder quebrado: stub gravado nesta execução (meta.builders_falhos) ou gold
    # mantido pela sentinela há mais de RESTAURADO_MAX_DIAS (meta.restaurados)
    for f in meta.get("builders_falhos") or []:
        acusacoes.append(f"- builder `{f.get('gold')}` falhou na última execução: `{str(f.get('erro', ''))[:160]}`")
    for nome, r in (meta.get("restaurados") or {}).items():
        dias = r.get("dias")
        if dias is None or dias > RESTAURADO_MAX_DIAS:
            acusacoes.append(f"- gold `{nome}` está no ar por RESTAURAÇÃO da sentinela "
                             f"({r.get('motivo')}), build íntegro pela última vez em {str(r.get('gerado_em_publicado', ''))[:10]} "
                             f"({'há ' + str(dias) + ' dias' if dias is not None else 'idade desconhecida'}).")
    if not acusacoes:
        return 0
    print(f"O gold publicado em **{meta.get('gerado_em', '')[:16]}** está íntegro e em dia, mas "
          "fontes essenciais estão em pane ou com a data-base parada:\n")
    print("\n".join(acusacoes))
    print("\nO builder retém a última coleta boa (as abas seguem no ar com a data-base declarada), "
          "e a faixa 'fonte em pane' avisa o leitor. Conferir o log da coleta na aba Actions: "
          "bloqueio por User-Agent/origem (403), mudança de esquema do CSV, download cortado "
          "(IncompleteRead) ou fonte fora do ar.")
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


def saneamento():
    sys.path.insert(0, str(RAIZ / "scripts"))
    import vigilancia_saneamento as v
    linhas = v.verificar()
    if not linhas:
        return 0
    print(v.corpo(linhas))
    return ACUSA


def main():
    modo = sys.argv[1] if len(sys.argv) > 1 else ""
    if modo == "frescor":
        return frescor()
    if modo == "fontes":
        return fontes()
    if modo == "pane":
        return pane()
    if modo == "saneamento":
        return saneamento()
    if modo == "dominios":
        # Abre, comenta ou fecha uma issue por domínio pelo gh (scripts/vigilancia_frescor.py);
        # saída 0 mesmo com issues abertas: o workflow não abre a issue genérica do cheque.
        sys.path.insert(0, str(RAIZ / "scripts"))
        import vigilancia_frescor
        return vigilancia_frescor.main(sys.argv[2:])
    if modo == "semear-saneamento":
        sys.path.insert(0, str(RAIZ / "scripts"))
        import vigilancia_saneamento as v
        v.semear()
        return 0
    if modo == "semear":
        # uso local: grava o snapshot inicial com o estado corrente da página
        html = _baixa(PAGINA_SPA).decode("utf-8", errors="replace")
        hrefs = sorted({h for h in re.findall(r'href="([^"]+\.pdf)"', html, re.I)})
        SNAPSHOT_SPA.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT_SPA.write_text("\n".join(hrefs) + "\n")
        print(f"snapshot com {len(hrefs)} hrefs gravado em {SNAPSHOT_SPA}")
        return 0
    print("uso: vigilancia.py [frescor|fontes|pane|saneamento|dominios|semear|semear-saneamento]", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
