"""Conferência agendada das Contas Públicas Estaduais contra o Siconfi (stdlib, sem credenciais).

Executar: python3 -m pipeline.contas_estaduais.conferir [--destino DIR]

A base publicada (src/lib/contas-estaduais/primarios.json) é reproduzida só a partir das respostas
arquivadas em consolidar.RAW, e a promoção de captura nova é uma alteração de dados revisada
(docs/contas-publicas-estaduais/FASE_1.md, passo 3; coletar.py não aprova indicador). Por isso a
atualização agendada deste domínio NÃO publica: ela confere e avisa.

1. Retificação: refaz cada consulta arquivada e compara a lista `items` com a resposta guardada.
   Item diferente significa que o Siconfi passou a servir outro conteúdo para o mesmo demonstrativo
   (retificação pelo ente, homologação nova ou mudança do serviço).
2. Período novo: consulta, para as 27 UFs, os quadrimestres do RGF Anexo 02 ainda não integrados do
   exercício parcial e o RREO Anexo 01 do 6º bimestre desse exercício. UF com registro = período
   disponível para captura e revisão.

Contrato (o mesmo de scripts/vigilancia.py): saída 0 = nada a fazer; saída 3 = o stdout é o corpo da
issue; outra saída = a própria conferência quebrou ou não conseguiu conferir nenhuma resposta. Consulta
que falha vira linha "não verificado", nunca silêncio: conferência cega é pior que alerta falso.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode

from pipeline.contas_estaduais import consolidar
from pipeline.contas_estaduais.coletar import API, UFS, parametros, requisitar

LIMITE_LINHAS = 40


def _itens(bruto):
    pagina = json.loads(bruto)
    if not isinstance(pagina, dict) or not isinstance(pagina.get("items"), list):
        raise ValueError("resposta sem lista items")
    return pagina["items"]


def _canon(itens):
    return json.dumps(itens, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def manifestos(raw=None):
    raw = raw or consolidar.RAW
    saida = []
    for nome in ("anual", "parcial"):
        pasta = raw / nome
        for registro in json.loads((pasta / "manifesto.json").read_text())["registros"]:
            saida.append((pasta, registro))
    return saida


def conferir_arquivadas(registros, buscar=requisitar, destino=None):
    """Devolve (divergentes, nao_verificadas, conferidas)."""
    divergentes, nao_verificadas, conferidas = [], [], 0
    for pasta, registro in registros:
        rotulo = f"{registro['uf']} {registro['fonte'].upper()} {registro['ano']} período {registro['parametros']['nr_periodo']}"
        for pagina in registro.get("paginas", []):
            arquivado = (pasta / (registro["uf"] + "-" + registro["fonte"]) / pagina["arquivo"]).read_bytes()
            try:
                bruto = buscar(pagina["url"])
                novos = _itens(bruto)
            except Exception as erro:  # noqa: BLE001 - toda falha vira "não verificado"
                nao_verificadas.append(f"{rotulo}: {str(erro)[:160]}")
                continue
            if destino is not None:
                destino.mkdir(parents=True, exist_ok=True)
                (destino / (hashlib.sha256(bruto).hexdigest() + ".json")).write_bytes(bruto)
            conferidas += 1
            antigos = _itens(arquivado)
            if _canon(novos) != _canon(antigos):
                divergentes.append(f"{rotulo}: {len(antigos)} linhas arquivadas, {len(novos)} servidas hoje, conteúdo diferente")
    return divergentes, nao_verificadas, conferidas


def periodos_publicados(registros):
    pub = {}
    for _, r in registros:
        pub.setdefault((r["fonte"], r["ano"]), set()).add(r["parametros"]["nr_periodo"])
    return pub


def candidatos(registros, hoje=None):
    """Períodos ainda não integrados que já podem existir no Siconfi."""
    hoje = hoje or dt.date.today()
    pub = periodos_publicados(registros)
    anos = sorted({ano for _, ano in pub})
    parcial = max(anos)
    saida = []
    rgf = pub.get(("rgf", parcial), set())
    for q in range((max(rgf) if rgf else 0) + 1, 4):
        saida.append(("rgf", parcial, q))
    if 6 not in pub.get(("rreo", parcial), set()):
        saida.append(("rreo", parcial, 6))
    # exercício seguinte ao parcial, quando o calendário já permite o 1º quadrimestre
    if hoje.year > parcial:
        saida.append(("rgf", parcial + 1, 1))
    return [c for c in saida if c[1] <= hoje.year]


def sondar(cands, buscar=requisitar, ufs=None):
    """Para cada período candidato: UFs com registro, UFs sem registro e consultas que falharam."""
    ufs = ufs or sorted(UFS)
    saida = []
    for fonte, ano, periodo in cands:
        com, sem, falhas = [], [], []
        for uf in ufs:
            params = parametros(uf, ano, fonte, periodo if fonte == "rgf" else None)
            url = API + fonte + "?" + urlencode({**params, "offset": 0})
            try:
                (com if _itens(buscar(url)) else sem).append(uf)
            except Exception as erro:  # noqa: BLE001
                falhas.append(f"{uf}: {str(erro)[:120]}")
        saida.append({"fonte": fonte, "ano": ano, "periodo": periodo, "com_registro": com, "sem_registro": sem, "falhas": falhas})
    return saida


def corpo(divergentes, nao_verificadas, conferidas, sondagem):
    novos = [s for s in sondagem if s["com_registro"]]
    falhas_sonda = [f"{s['fonte'].upper()} {s['ano']} período {s['periodo']}: {f}" for s in sondagem for f in s["falhas"]]
    if not (divergentes or nao_verificadas or novos or falhas_sonda):
        return None
    linhas = ["## Conferência agendada das Contas Públicas Estaduais", ""]
    linhas.append(f"{conferidas} respostas arquivadas conferidas contra o Siconfi em "
                  f"{dt.datetime.now(dt.timezone.utc):%d/%m/%Y %H:%M} UTC. A base publicada não mudou: "
                  "promover captura nova é uma alteração de dados revisada (FASE_1.md, passo 3).")
    if divergentes:
        linhas += ["", f"### O Siconfi serve conteúdo diferente do arquivado ({len(divergentes)})", ""]
        linhas += [f"- {d}" for d in divergentes[:LIMITE_LINHAS]]
        linhas.append("")
        linhas.append("O que fazer: capturar de novo (`python3 -m pipeline.contas_estaduais.coletar`), revisar a "
                      "diferença e, se for retificação, promover numa nova pasta de evidências com consolidar.")
    if novos:
        linhas += ["", "### Período novo disponível no Siconfi", ""]
        for s in novos:
            linhas.append(f"- {s['fonte'].upper()} {s['ano']}, período {s['periodo']}: {len(s['com_registro'])} de "
                          f"{len(s['com_registro']) + len(s['sem_registro']) + len(s['falhas'])} UFs com registro "
                          f"({', '.join(s['com_registro'][:27])})")
        linhas.append("")
        linhas.append("O que fazer: capturar o período, revisar contra o demonstrativo e decidir a promoção. "
                      "A página continua mostrando os períodos integrados, com a data de captura.")
    if nao_verificadas or falhas_sonda:
        linhas += ["", f"### Não verificado ({len(nao_verificadas) + len(falhas_sonda)})", ""]
        linhas += [f"- {x}" for x in (nao_verificadas + falhas_sonda)[:LIMITE_LINHAS]]
    # mesma situação no mês seguinte não gera comentário novo (scripts/issue_dedup.sh); falha de
    # consulta muda a assinatura de propósito, para não esconder conferência cega
    chave = json.dumps([sorted(divergentes), [(s["fonte"], s["ano"], s["periodo"], s["com_registro"]) for s in novos],
                        len(nao_verificadas) + len(falhas_sonda)], ensure_ascii=False)
    linhas += ["", f"Assinatura: {hashlib.sha256(chave.encode()).hexdigest()[:16]}"]
    return "\n".join(linhas) + "\n"


def main(argv=None, buscar=requisitar, hoje=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--destino", type=Path, help="pasta para guardar as respostas de hoje (evidência)")
    ap.add_argument("--resumo", type=Path, help="grava o resumo em JSON")
    a = ap.parse_args(argv)
    registros = manifestos()
    divergentes, nao_verificadas, conferidas = conferir_arquivadas(registros, buscar, a.destino)
    sondagem = sondar(candidatos(registros, hoje), buscar)
    if a.resumo:
        a.resumo.parent.mkdir(parents=True, exist_ok=True)
        a.resumo.write_text(json.dumps({"conferidas": conferidas, "divergentes": divergentes,
                                        "nao_verificadas": nao_verificadas, "sondagem": sondagem},
                                       ensure_ascii=False, indent=2) + "\n")
    if conferidas == 0:
        print("Nenhuma resposta arquivada pôde ser conferida (Siconfi inacessível?): conferência cega.")
        print("\n".join(nao_verificadas[:LIMITE_LINHAS]))
        return 1
    texto = corpo(divergentes, nao_verificadas, conferidas, sondagem)
    if texto is None:
        print(f"{conferidas} respostas conferidas, sem divergência; nenhum período novo no Siconfi.")
        return 0
    print(texto)
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
