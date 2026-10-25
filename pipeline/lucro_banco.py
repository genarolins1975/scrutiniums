"""Contratos analíticos do futuro painel de lucro (ainda não publicado).

Não é um coletor nem um mapeamento validado do IF.data. O catálogo conserva
a hierarquia do template; a seleção das rubricas depende de conferência dos
originais em três conglomerados e duas datas-base. Testes usam dados sintéticos.
Valores monetários são Decimal em reais, com sinal contábil preservado.
"""
from decimal import Decimal, InvalidOperation, ROUND_DOWN, localcontext
import re


def numero(valor):
    """Ausência continua ausente; booleanos e números não finitos são inválidos."""
    if valor is None:
        return None
    if isinstance(valor, bool):
        raise ValueError("Booleano não é medida monetária")
    try:
        n = Decimal(str(valor))
    except InvalidOperation as exc:
        raise ValueError("Medida inválida") from exc
    if not n.is_finite():
        raise ValueError("Medida não finita")
    return n


def periodo(anomes):
    """DRE acumulada no semestre, sem anualização e sem inferir meses inválidos."""
    texto = str(anomes)
    if not re.fullmatch(r"[1-9][0-9]{3}(03|06|09|12)", texto):
        raise ValueError("Data-base deve ser AAAAMM de fechamento trimestral")
    ano, mes = int(texto[:4]), int(texto[4:])
    return {"data_base": texto, "inicio": f"{ano}{'01' if mes <= 6 else '07'}",
            "meses": 3 if mes in (3, 9) else 6,
            "plano": "res_4966" if ano >= 2025 else "anterior_2025"}


def doze_meses(series, data_base, rubricas):
    """Dois semestres fechados contíguos; não cruza a mudança de plano de 2025.

    Não usa trimestre aberto, substitui falta por zero ou procura um semestre
    mais antigo para tapar lacuna. Rubricas ausentes permanecem nulas.
    """
    p = periodo(data_base)
    ano, mes = int(p["data_base"][:4]), int(p["data_base"][4:])
    if mes not in (6, 12):
        return {"disponivel": False, "motivo": "semestre_aberto"}
    anterior = f"{ano - 1}12" if mes == 6 else f"{ano}06"
    if periodo(anterior)["plano"] != p["plano"]:
        return {"disponivel": False, "motivo": "quebra_plano_2025"}
    componentes = [anterior, p["data_base"]]
    if any(d not in series for d in componentes):
        return {"disponivel": False, "motivo": "semestre_ausente",
                "componentes": componentes}
    valores = {}
    for chave in rubricas:
        partes = [numero(series[d].get(chave)) for d in componentes]
        valores[chave] = None if None in partes else sum(partes, Decimal(0))
    return {"disponivel": True, "meses": 12, "data_base": p["data_base"],
            "componentes": componentes, "plano": p["plano"], "valores": valores}


def catalogar_rubricas(template, info, relatorio):
    """Resolve ifd→lid do template sem adivinhar IDs ou achatar a hierarquia.

    Subtotais e filhos coexistem: o catálogo NÃO pode ser somado como uma DRE.
    Referência quebrada ou id duplicado é erro de contrato, não ausência contábil.
    A interpretação dos nomes/sinais precisa de validação empírica posterior.
    """
    por_id = {}
    for item in info:
        chave = item["id"]
        if chave in por_id:
            raise ValueError(f"info duplicado: {chave}")
        por_id[chave] = item
    saida = []

    def visitar(colunas, caminho):
        for coluna in colunas:
            ifd = coluna.get("ifd")
            if ifd not in por_id:
                raise ValueError(f"ifd ausente no info: {ifd}")
            meta = por_id[ifd]
            nome = " ".join((meta.get("n") or "").split())
            trilha = caminho + [nome]
            filhos = coluna.get("sc") or []
            lid = meta.get("lid")
            if isinstance(lid, int) and not isinstance(lid, bool) and lid > 0:
                saida.append({"relatorio": relatorio, "ifd": ifd, "lid": lid,
                              "nome": nome, "caminho": trilha,
                              "tem_subcolunas": bool(filhos)})
            visitar(filhos, trilha)

    visitar(template.get("c", []), [])
    return saida


def reconciliar(degraus, lucro_publicado, tolerancia_brl="1.00"):
    """Soma apenas degraus aditivos, nunca margem/subtotal ou lucro novamente.

    Tolerância absoluta explícita em R$ (padrão R$ 1,00); não cresce com o banco.
    Nunca inventa uma rubrica residual para forçar fechamento. O consumidor só
    desenha cascata se reconciliado=True; nos demais casos conserva a tabela.
    """
    tol = numero(tolerancia_brl)
    if tol is None or tol < 0:
        raise ValueError("Tolerância deve ser não negativa")
    valores = {k: numero(v) for k, v in degraus.items()}
    lucro = numero(lucro_publicado)
    ausentes = [k for k, v in valores.items() if v is None]
    if lucro is None:
        ausentes.append("lucro_liquido")
    if not valores or ausentes:
        return {"reconciliado": False, "motivo": "rubrica_ausente",
                "ausentes": ausentes, "soma": None, "diferenca": None,
                "tolerancia_brl": tol}
    soma = sum(valores.values(), Decimal(0))
    diferenca = soma - lucro
    fecha = abs(diferenca) <= tol
    return {"reconciliado": fecha, "motivo": None if fecha else "divergencia",
            "soma": soma, "diferenca": diferenca, "tolerancia_brl": tol}


def _distribuir(total, bases, casas=2):
    if total is None or not bases or sum(bases, Decimal(0)) <= 0:
        return None
    denominador = sum(bases, Decimal(0))
    # Trunca em centavos (ou na precisão original se maior). O resíduo vai
    # à maior base. Isso evita que frações periódicas violem a soma exata,
    # inclusive em carteiras numerosas; zero nunca recebe sobra de arredondamento.
    quantum = Decimal(1).scaleb(min(-casas, total.as_tuple().exponent))
    with localcontext() as ctx:
        ctx.prec = max(50, len(total.as_tuple().digits) + casas + 20)
        valores = [(total * base / denominador).quantize(quantum, rounding=ROUND_DOWN) for base in bases]
        maior = max(range(len(bases)), key=bases.__getitem__)
        valores[maior] += total - sum(valores, Decimal(0))
    return valores


def ratear_pdd(linhas, provisao, despesa):
    """Modelo, não informação publicada por modalidade.

    Estoque de provisão >=0; fluxo = despesa assinada (reversão pode ser positiva).
    Os dois pesos usam o MESMO universo: modalidades com saldo e vencido >=15d
    publicados. Linha sem vencido não recebe nem o método de sensibilidade.
    Se houver exclusões, o rateio é condicional ao universo elegível; isso é
    exposto, não apresentado como cobertura integral da carteira. Total sem
    denominador permanece não alocado, inclusive se for zero.
    """
    estoque, fluxo = numero(provisao), numero(despesa)
    if estoque is not None and estoque < 0:
        raise ValueError("Estoque de provisão deve ser magnitude não negativa")
    ids, todas, elegiveis = set(), [], []
    for linha in linhas:
        chave = linha["id"]
        if chave in ids:
            raise ValueError("Modalidade duplicada")
        ids.add(chave)
        saldo, vencido = numero(linha.get("saldo")), numero(linha.get("vencido15"))
        if any(v is not None and v < 0 for v in (saldo, vencido)):
            raise ValueError("Saldo e vencido devem ser não negativos")
        if saldo is not None and vencido is not None and vencido > saldo:
            raise ValueError("Vencido não pode exceder saldo")
        registro = {"id": chave, "saldo": saldo, "vencido15": vencido,
                    "estado": "sem_base", "estimativa_de_modelo": True,
                    "provisao": None, "despesa": None, "cobertura": None,
                    "participacao_pdd": None, "participacao_carteira": None}
        todas.append(registro)
        if saldo is not None and vencido is not None:
            elegiveis.append(registro)
    bases_v = [r["vencido15"] for r in elegiveis]
    bases_s = [r["saldo"] for r in elegiveis]
    metodos = {"vencido15": bases_v, "saldo": bases_s}
    distribuidos = {m: {"provisao": _distribuir(estoque, b),
                        "despesa": _distribuir(fluxo, b),
                        "peso": _distribuir(Decimal(1), b, casas=18)} for m, b in metodos.items()}
    saldo_total = (sum((r["saldo"] for r in todas), Decimal(0))
                   if todas and all(r["saldo"] is not None for r in todas) else None)
    for i, registro in enumerate(elegiveis):
        registro["estado"] = "estimativa" if all(distribuidos[m]["peso"] is not None for m in metodos) else "base_insuficiente"
        for medida in ("provisao", "despesa"):
            valores = {m: d[medida][i] if d[medida] is not None else None
                       for m, d in distribuidos.items()}
            registro[medida] = {**valores, "faixa": sorted(valores.values()) if None not in valores.values() else None}
        registro["cobertura"] = {m: (registro["provisao"][m] / registro["vencido15"]
                                      if registro["provisao"][m] is not None and registro["vencido15"] > 0 else None)
                                   for m in metodos}
        registro["participacao_pdd"] = {m: d["peso"][i] if d["peso"] is not None else None
                                       for m, d in distribuidos.items()}
        registro["participacao_carteira"] = registro["saldo"] / saldo_total if saldo_total else None
    return {"natureza": "estimativa de modelo", "linhas": todas,
            "universo_condicional": len(elegiveis) != len(todas),
            "sem_base": [r["id"] for r in todas if r["estado"] == "sem_base"],
            "total_provisao": estoque, "total_despesa": fluxo,
            "nao_alocado": {m: {k: total if d[k] is None else Decimal(0)
                                 for k, total in (("provisao", estoque), ("despesa", fluxo))}
                            for m, d in distribuidos.items()}}


def simular_perda(lucro, despesa_linha, vencido_linha, novo_vencido, saldo_linha):
    """Hipótese linear: despesa/vencido constante, demais rubricas e tributos fixos.

    Não prevê inadimplência nem altera os publicados. Sem despesa negativa e
    vencido positivo não há base para extrapolar perda (reversão não é custo).
    """
    lucro, despesa, vencido, novo, saldo = map(numero, (lucro, despesa_linha, vencido_linha, novo_vencido, saldo_linha))
    if None in (lucro, despesa, vencido, novo, saldo):
        return {"disponivel": False, "motivo": "sem_base"}
    if saldo < 0 or novo < 0 or novo > saldo or vencido < 0 or vencido > saldo:
        raise ValueError("Vencido deve estar entre zero e o saldo da modalidade")
    if vencido == 0 or despesa >= 0:
        return {"disponivel": False, "motivo": "sem_base_de_perda"}
    delta = despesa * (novo - vencido) / vencido
    return {"disponivel": True, "natureza": "simulação",
            "impacto_lucro": delta, "lucro_simulado": lucro + delta,
            "hipotese": "Despesa/vencido constante; demais rubricas e tributos fixos."}
