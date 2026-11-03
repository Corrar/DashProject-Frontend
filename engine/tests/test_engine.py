"""Testes do motor pandas (rodam em CPython; o mesmo código roda no Pyodide).

    python -m pytest engine/tests -q
"""
import csv
import io
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import dash_engine as E  # noqa: E402


def matrix(text, sep=None):
    if sep is None:
        first = text.splitlines()[0]
        sep = ";" if first.count(";") > first.count(",") else ("\t" if "\t" in first else ",")
    return [row for row in csv.reader(io.StringIO(text), delimiter=sep)]


def run_matrix(text, sep=None):
    out = json.loads(E.run(json.dumps({"kind": "matrix", "matrix": matrix(text, sep)})))
    assert out["ok"], out
    return out


def prof(out, name):
    return next(p for p in out["profiles"] if p["name"] == name)


def schema(out, name):
    return next(s for s in out["schema"] if s["name"] == name)


# ── números ────────────────────────────────────────────────────────────

def test_brazilian_numbers_and_currency():
    out = run_matrix("data;produto;receita\n01/02/2025;A;R$ 1.234,56\n02/02/2025;B;\"R$ 99,90\"\n03/02/2025;C;(10,00)\n")
    assert out["columns"]["receita"] == [1234.56, 99.9, -10.0]
    assert prof(out, "receita")["pattern"] == "monetary"
    assert out["roles"]["value"] == "receita"


def test_three_decimal_column_decided_per_column():
    # "2,500" com "1,75" na mesma coluna: a vírgula é decimal → 2.5 (não 2500).
    out = run_matrix("item;peso_kg\na;2,500\nb;1,75\nc;3,125\nd;0,5\n")
    assert out["columns"]["peso_kg"] == [2.5, 1.75, 3.125, 0.5]
    out = run_matrix("item,litros\na,1.250\nb,2.5\nc,0.75\n")
    assert out["columns"]["litros"] == [1.25, 2.5, 0.75]


def test_ambiguous_column_uses_file_tendency():
    # Arquivo brasileiro (outra coluna com 12,50): "2,500" é decimal.
    out = run_matrix("item;preco;peso\na;12,50;2,500\nb;7,25;1,250\nc;3,10;4,000\n")
    assert out["columns"]["peso"] == [2.5, 1.25, 4.0]
    # Sem pista nenhuma: "1.500" é milhar (padrão de exports brasileiros).
    out = run_matrix("item;estoque\na;1.500\nb;2.300\nc;12\n")
    assert out["columns"]["estoque"] == [1500.0, 2300.0, 12.0]


def test_us_numbers():
    out = run_matrix("date,revenue\n2025-01-01,\"1,234.50\"\n2025-01-02,99.9\n2025-01-03,\"12,000.00\"\n")
    assert out["columns"]["revenue"] == [1234.5, 99.9, 12000.0]


# ── datas ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("vals,expected", [
    (["15-03-2025", "01-04-2025", "30-12-2025"], ["2025-03-15", "2025-04-01", "2025-12-30"]),
    (["03/2025", "04/2025", "12/2025"], ["2025-03-01", "2025-04-01", "2025-12-01"]),
    (["2025/03/15", "2025/04/01", "2025/12/30"], ["2025-03-15", "2025-04-01", "2025-12-30"]),
    (["jan/25", "fev/25", "mar/25"], ["2025-01-01", "2025-02-01", "2025-03-01"]),
    (["15 de março de 2025", "1 de abril de 2025", "2 de maio de 2025"], ["2025-03-15", "2025-04-01", "2025-05-02"]),
    (["2025-01-05T10:00:00Z", "2025-01-06 08:00", "2025-01-07"], ["2025-01-05", "2025-01-06", "2025-01-07"]),
])
def test_date_formats(vals, expected):
    text = "data,valor\n" + "\n".join(f"{v},10" for v in vals)
    out = run_matrix(text, ",")
    assert prof(out, "data")["pattern"] == "datetime"
    assert out["columns"]["data"] == expected


def test_day_month_order_decided_by_column():
    out = run_matrix("data,v\n03/15/2025,1\n04/01/2025,2\n12/30/2025,3\n")  # americano
    assert out["columns"]["data"] == ["2025-03-15", "2025-04-01", "2025-12-30"]
    out = run_matrix("data,v\n15/03/2025,1\n01/04/2025,2\n02/05/2025,3\n")  # brasileiro
    assert out["columns"]["data"] == ["2025-03-15", "2025-04-01", "2025-05-02"]
    out = run_matrix("data,v\n01/02/2025,1\n03/04/2025,2\n05/06/2025,3\n")  # ambíguo → BR
    assert out["columns"]["data"] == ["2025-02-01", "2025-04-03", "2025-06-05"]


def test_invalid_dates_are_counted_not_overflowed():
    out = run_matrix("data,v\n30/02/2025,1\n01/03/2025,2\n02/03/2025,3\n03/03/2025,4\n04/03/2025,5\n05/03/2025,6\n06/03/2025,7\n")
    assert out["columns"]["data"][0] is None
    assert prof(out, "data")["coerced"] == 1


# ── estrutura ──────────────────────────────────────────────────────────

def test_title_rows_above_header():
    text = "Relatório de Vendas 2025;;\nEmitido em 10/01/2026;;\n;;\ndata;produto;receita\n01/01/2025;A;10,00\n02/01/2025;B;20,00\n"
    out = run_matrix(text, ";")
    assert out["header"] == ["data", "produto", "receita"]
    assert out["quality"]["titleRowsSkipped"] == 2  # a linha vazia já sai antes
    assert sum(out["columns"]["receita"]) == 30.0


def test_sep_line_is_skipped():
    out = run_matrix("sep=;\ndata;receita\n01/01/2025;10\n02/01/2025;20\n", ";")
    assert out["header"] == ["data", "receita"]


def test_total_row_removed():
    text = "produto;receita\nA;100,00\nB;200,00\nC;300,00\nTotal;600,00\n"
    out = run_matrix(text, ";")
    assert out["rows"] == 3
    assert sum(out["columns"]["receita"]) == 600.0
    assert out["quality"]["totalRowsRemoved"] == 1


def test_unlabeled_total_row_at_end():
    text = "data;produto;receita\n01/01/2025;A;100,00\n02/01/2025;B;200,00\n03/01/2025;C;300,00\n;;600,00\n"
    out = run_matrix(text, ";")
    assert out["rows"] == 3


def test_duplicate_and_empty_headers():
    out = run_matrix("valor,valor,,regiao\n10,20,x,Sul\n30,40,y,Norte\n")
    assert out["header"] == ["valor", "valor (2)", "coluna_3", "regiao"]
    assert out["columns"]["valor (2)"] == [20.0, 40.0]


def test_null_tokens_and_excel_errors():
    out = run_matrix("cidade,vendas\nSP,10\nRJ,N/A\nBH,#N/D\nPOA,-\nREC,40\nSSA,50\nFOR,60\n")
    assert out["columns"]["vendas"] == [10.0, None, None, None, 40.0, 50.0, 60.0]
    assert prof(out, "vendas")["stats"]["nullCount"] == 3


def test_repeated_header_rows_removed():
    out = run_matrix("produto,receita\nA,10\nproduto,receita\nB,20\n")
    assert out["rows"] == 2


# ── semântica ──────────────────────────────────────────────────────────

def test_preco_before_receita_picks_receita():
    rows = "\n".join(f"2025-01-{d:02d},P{d % 3},{q},{p:.2f},{q * p:.2f}" for d, q, p in
                     [(i, 1 + i % 4, 10 + i * 3.5) for i in range(1, 25)])
    out = run_matrix("data,produto,quantidade,preco,receita\n" + rows, ",")
    assert out["roles"]["value"] == "receita"
    assert prof(out, "preco")["additive"] is False
    assert prof(out, "receita")["semantic"] == "total"
    assert schema(out, "receita")["isValue"] is True


def test_json_preco_first():
    recs = [{"data": f"2025-01-{i:02d}", "produto": f"P{i % 3}", "preco": 10.5 + i, "quantidade": 2, "receita": (10.5 + i) * 2} for i in range(1, 20)]
    out = json.loads(E.run(json.dumps({"kind": "json", "text": json.dumps(recs)})))
    assert out["ok"] and out["roles"]["value"] == "receita"


def test_age_is_not_additive_and_salary_average_by_department():
    rows = "\n".join(f"P{i},{['TI', 'RH', 'Fin'][i % 3]},{3000 + (i % 3) * 4000 + i},{25 + i % 30}" for i in range(60))
    out = run_matrix("nome,departamento,salario,idade\n" + rows, ",")
    assert prof(out, "idade")["additive"] is False
    assert out["roles"]["value"] is None  # salário não é "receita"
    assert out["salesShape"] is False
    assert any(it["tag"] == "Média" and "departamento" in it["t"] for it in out["insights"])


def test_value_with_same_digit_integers_is_not_identifier():
    rows = "\n".join(f"2025-01-{i:02d},{1000 + i * 37}" for i in range(1, 29))
    out = run_matrix("data,receita\n" + rows, ",")
    assert prof(out, "receita")["pattern"] != "identifier"
    assert out["roles"]["value"] == "receita"


def test_cep_with_leading_zeros_kept_as_text():
    out = run_matrix("cep,valor\n01310100,10\n04538132,20\n20040002,30\n")
    assert out["columns"]["cep"] == ["01310100", "04538132", "20040002"]
    assert schema(out, "cep")["type"] == "dimension"


def test_year_column_is_dimension():
    out = run_matrix("ano,vendas\n2022,10\n2023,20\n2024,30\n")
    assert schema(out, "ano")["type"] == "dimension"


def test_expenses_with_date_are_not_sales_shape():
    rows = "\n".join(f"2025-0{1 + i % 6}-1{i % 9},{['Aluguel', 'Luz', 'Internet'][i % 3]},R$ {100 + i},00" for i in range(30))
    out = run_matrix("data;categoria;valor\n" + rows.replace(",", ";", 2), ";")
    assert out["salesShape"] is False


# ── JSON ───────────────────────────────────────────────────────────────

def test_nested_json_is_flattened():
    recs = [{"pedido": i, "valor": 10.0 * i, "cliente": {"nome": f"C{i}", "endereco": {"uf": ["SP", "RJ"][i % 2]}}} for i in range(1, 11)]
    out = json.loads(E.run(json.dumps({"kind": "json", "text": json.dumps(recs)})))
    assert "cliente.endereco.uf" in out["header"]
    assert prof(out, "cliente.endereco.uf")["pattern"] == "category_low"


def test_ndjson_inside_json_file():
    text = "\n".join(json.dumps({"a": i, "b": "x"}) for i in range(5))
    out = json.loads(E.run(json.dumps({"kind": "json", "text": text})))
    assert out["ok"] and out["rows"] == 5


def test_json_floats_with_three_decimals_are_exact():
    recs = [{"peso": 12.345, "v": 1}, {"peso": 1.5, "v": 2}, {"peso": 2.0, "v": 3}]
    out = json.loads(E.run(json.dumps({"kind": "json", "text": json.dumps(recs)})))
    assert out["columns"]["peso"] == [12.345, 1.5, 2.0]


# ── insights / contrato ────────────────────────────────────────────────

def _sales_text(n=300):
    import random
    rnd = random.Random(3)
    lines = ["data;produto;regiao;canal;quantidade;receita"]
    for i in range(n):
        d = f"{1 + i % 28:02d}/{1 + (i * 7) % 12:02d}/2025"
        q = rnd.randint(1, 5)
        prod = rnd.choice(["Notebook", "Mouse", "Teclado", "Monitor", "Cadeira"])
        price = {"Notebook": 4000, "Mouse": 80, "Teclado": 150, "Monitor": 1200, "Cadeira": 900}[prod]
        lines.append(f"{d};{prod};{rnd.choice(['Sul', 'Norte', 'Sudeste'])};{rnd.choice(['Site', 'Loja'])};{q};{q * price:.2f}".replace(".", ","))
    return "\n".join(lines)


def test_sales_insights_and_contract():
    out = run_matrix(_sales_text(), ";")
    assert out["salesShape"] is True
    assert out["roles"]["value"] == "receita"
    cats = {it["cat"] for it in out["insights"]}
    assert {"comparison", "trend"} <= cats
    assert len(out["highlights"]) == 4
    assert out["summary"].startswith("A base tem 300 linhas")
    for it in out["insights"]:
        assert set(it) >= {"cat", "t", "d", "tag", "ev", "conf"}
        if "chart" in it:
            assert it["chart"]["data"] and all({"l", "v"} <= set(p) for p in it["chart"]["data"])
    # JSON estrito (sem NaN) e colunas do mesmo tamanho.
    json.loads(json.dumps(out, allow_nan=False))
    assert {len(v) for v in out["columns"].values()} == {out["rows"]}
    assert "undefined" not in json.dumps(out) and "NaN" not in json.dumps(out)


def test_survey_only_categories():
    rows = "\n".join(f"{i},{['Bom', 'Ruim', 'Ótimo'][i % 3]},{['Sim', 'Não'][i % 2]},{i % 11}" for i in range(1, 61))
    out = run_matrix("id,avaliacao,recomendaria,nota\n" + rows, ",")
    assert prof(out, "recomendaria")["pattern"] == "boolean"
    assert prof(out, "nota")["pattern"] == "scale"
    assert any("NPS" in it["d"] for it in out["insights"])


def test_bad_input_returns_error_not_exception():
    out = json.loads(E.run(json.dumps({"kind": "matrix", "matrix": [["só cabeçalho"]]})))
    assert out["ok"] is False and out["kind"] == "input"
    out = json.loads(E.run(json.dumps({"kind": "json", "text": "{oops"})))
    assert out["ok"] is False


def test_fixture_files_end_to_end():
    fx = os.environ.get("DASH_FIXTURES")
    if not fx:
        pytest.skip("DASH_FIXTURES não definido")
    for name in sorted(os.listdir(fx)):
        path = os.path.join(fx, name)
        if name.endswith(".csv"):
            raw = open(path, "rb").read()
            try:
                text = raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = raw.decode("cp1252")
            out = run_matrix(text)
        elif name.endswith(".json") and not name.startswith("expected"):
            out = json.loads(E.run(json.dumps({"kind": "json", "text": open(path, encoding="utf-8").read()})))
        else:
            continue
        assert out["ok"], (name, out)


# ── técnicas dos repositórios de referência ────────────────────────────

def test_pii_columns_never_reach_insights_or_facts():
    rows = "\n".join(f"cliente{i}@mail.com,{['Sul', 'Norte'][i % 2]},{100 + i}" for i in range(40))
    out = run_matrix("email,regiao,valor\n" + rows, ",")
    assert prof(out, "email")["pii"] is True
    assert out["quality"]["piiColumns"] == ["email"]
    blob = json.dumps(out["insights"]) + json.dumps(out["facts"]) + out["summary"]
    assert "@" not in blob
    rows = "\n".join(f"{i:03d}.456.789-{i % 100:02d},{100 + i}" for i in range(30))
    out = run_matrix("cpf,valor\n" + rows, ",")
    assert prof(out, "cpf")["pattern"] == "identifier"


def test_spelling_variants_are_merged():
    vals = ["SP", "sp ", "Sp", "RJ", "rj", "MG"] * 5
    out = run_matrix("uf,vendas\n" + "\n".join(f"{v},{i}" for i, v in enumerate(vals)), ",")
    assert sorted(set(out["columns"]["uf"])) == ["MG", "RJ", "SP"]
    assert out["quality"]["mergedVariants"]["uf"] == 3


def test_mixed_case_boolean_and_numeric_flag():
    out = run_matrix("cliente,respondeu\n" + "\n".join(f"c{i},{['Sim', 'sim', 'NÃO', 'nao'][i % 4]}" for i in range(20)), ",")
    assert prof(out, "respondeu")["pattern"] == "boolean"
    out = run_matrix("cliente,pago\n" + "\n".join(f"c{i},{i % 2}" for i in range(20)), ",")
    assert prof(out, "pago")["pattern"] == "boolean"


def test_top_k_other_keeps_total():
    rows = "\n".join(f"2025-01-{1 + i % 28:02d},P{i % 15},{10 + i % 7}" for i in range(300))
    out = run_matrix("data,produto,receita\n" + rows, ",")
    lead = next(it for it in out["insights"] if it["t"].endswith("lidera em produto"))
    assert lead["chart"]["data"][-1]["l"] == "Outros"
    assert abs(sum(p["v"] for p in lead["chart"]["data"]) - sum(out["columns"]["receita"])) < 1e-6


def test_eta2_picks_dimension_that_explains_the_measure():
    import random
    rnd = random.Random(0)
    lines = []
    for i in range(200):
        reg = ["Sul", "Norte"][i % 2]
        cor = rnd.choice(["azul", "verde", "roxo"])
        lines.append(f"{cor},{reg},{(100 if reg == 'Sul' else 200) + rnd.uniform(-5, 5):.2f}")
    out = run_matrix("cor,regiao,ticket_medio\n" + "\n".join(lines), ",")
    media = [it for it in out["insights"] if it["tag"] == "Média"]
    assert media and "por regiao" in media[0]["t"]
    assert E._eta2_adj(pd_df(out), "cor", "ticket_medio") < 0.05


def pd_df(out):
    import pandas as pd
    return pd.DataFrame(out["columns"])


def test_alias_and_hierarchy_dimensions_deduplicated():
    city_state = {"Campinas": "SP", "Santos": "SP", "Niterói": "RJ", "Petrópolis": "RJ", "Contagem": "MG"}
    rows = []
    for i in range(100):
        c = list(city_state)[i % 5]
        rows.append(f"{c},{city_state[c]},{100 + i}")
    out = run_matrix("cidade,estado,receita\n" + "\n".join(rows), ",")
    leaders = [it for it in out["insights"] if "lidera em" in it["t"]]
    assert len(leaders) == 1
    assert out["quality"]["dimensionRelations"][0]["type"] == "hierarchy"


def test_inverse_polarity_for_costs():
    rows = []
    for m in range(1, 13):
        for cat, base in (("Aluguel", 1000), ("Energia", 300 + m * 80)):
            rows.append(f"2025-{m:02d}-10,{cat},{base}")
    out = run_matrix("data,categoria,despesa_total\n" + "\n".join(rows), ",")
    alta = next(h for h in out["highlights"] if h["l"] == "Maior alta")
    assert alta["c"] == "#c9234a"
    rise = next(it for it in out["insights"] if "maior alta" in it["t"])
    assert rise.get("risk") is True


def test_mix_shift_reported():
    rows = []
    for m in range(1, 13):
        online = 20 if m <= 6 else 60
        rows += [f"2025-{m:02d}-05,Online,{online}", f"2025-{m:02d}-05,Loja,{80 - (online - 20) // 2}"]
    out = run_matrix("data,canal,receita\n" + "\n".join(rows), ",")
    mix = [it for it in out["insights"] if it["tag"] == "Mix"]
    assert mix and "Online" in mix[0]["d"]


def test_skewed_value_prefers_median():
    import random
    rnd = random.Random(0)
    rows = "\n".join(f"2025-01-{1 + i % 28:02d},{rnd.lognormvariate(5, 1.2):.2f}" for i in range(400))
    out = run_matrix("data,receita\n" + rows, ",")
    assert any(it["tag"] == "Distribuição" for it in out["insights"])
    st = prof(out, "receita")["stats"]
    assert st["p05"] < st["median"] < st["p95"] and st["skew"] > 1


def test_identical_columns_flagged():
    rows = "\n".join(f"{i},{i * 3},{i * 3}" for i in range(30))
    out = run_matrix("id_linha,valor_a,valor_b\n" + rows, ",")
    assert any("idênticas" in it["t"] for it in out["insights"])


def test_variant_canonical_prefers_careful_spelling():
    vals = ["feijão"] * 6 + ["Feijão"] * 2 + ["sao paulo"] * 3 + ["São Paulo"]
    out = run_matrix("produto,v\n" + "\n".join(f"{v},1" for v in vals), ",")
    assert set(out["columns"]["produto"]) == {"Feijão", "São Paulo"}


# ── correções da revisão independente ──────────────────────────────────

def run_rows(rows):
    out = json.loads(E.run(json.dumps({"kind": "matrix", "matrix": rows})))
    assert out["ok"], out
    return out


def test_total_label_in_date_column_with_footer():
    rows = [[f"{d:02d}/03/2024", "AB"[d % 2], f"{100 + d},00"] for d in range(1, 21)]
    tot = sum(100 + d for d in range(1, 21))
    out = run_rows([["Data", "Produto", "Valor"]] + rows + [["TOTAL", None, f"{tot},00"], ["Emitido por: Sistema XYZ", None, None]])
    assert out["rows"] == 20
    assert out["quality"]["totalRowsRemoved"] == 1 and out["quality"]["footerRowsRemoved"] == 1
    assert prof(out, "Data")["pattern"] == "datetime"
    assert abs(prof(out, "Valor")["stats"]["sum"] - tot) < 0.01


def test_product_named_total_is_kept():
    out = run_rows([["Produto", "Valor"], ["Total Flex", "100"], ["Mouse", "50"], ["Teclado", "70"], ["Total Flex", "90"]])
    assert out["rows"] == 4 and out["quality"]["totalRowsRemoved"] == 0


def test_subtotals_removed_before_typing():
    rows = []
    for w in range(4):
        rows += [[f"{w * 7 + d:02d}/03/2024", "AB"[d % 2], f"{100 + d},00"] for d in range(1, 6)]
        rows.append([f"Subtotal semana {w + 1}", None, "515,00"])
    out = run_rows([["Data", "Produto", "Valor"]] + rows)
    assert out["rows"] == 20 and out["quality"]["totalRowsRemoved"] == 4
    assert prof(out, "Data")["pattern"] == "datetime"
    assert prof(out, "Produto")["stats"]["nullCount"] == 0
    assert not any(it["t"].startswith(("Dados faltando", "Valores ilegíveis")) for it in out["insights"])


def test_coordinates_do_not_flip_thousands():
    rows = [[f"Loja {i}", "SP", f"-23.{3471 + i}", f"-46.{7468 + i}", f"{85 - i}.000"] for i in range(10)]
    out = run_rows([["Loja", "Cidade", "Latitude", "Longitude", "Faturamento"]] + rows)
    assert out["columns"]["Faturamento"][0] == 85000.0


def test_partial_last_month_is_not_a_drop():
    import datetime as dt
    start = dt.date(2024, 1, 1)
    rows = [[(start + dt.timedelta(days=i)).strftime("%d/%m/%Y"), "100,00"] for i in range(96)]   # até 05/04
    out = run_rows([["Data", "Valor"]] + rows)
    trend = next(it for it in out["insights"] if it["tag"] == "Tendência")
    assert "estabilidade" in trend["t"]
    assert not any(it.get("risk") and it["tag"] == "Tendência" for it in out["insights"])


@pytest.mark.parametrize("name", ["Quantidade", "Unidades", "Capacidade", "Valor da Nota", "Preço Total"])
def test_quantity_and_invoice_names_are_additive(name):
    rows = [[f"{1 + i % 28:02d}/01/2024", "AB"[i % 2], str(30 + i * 7)] for i in range(40)]
    out = run_rows([["Data", "Produto", name]] + rows)
    assert prof(out, name)["additive"] is True


def test_age_and_unit_price_stay_non_additive():
    rows = [[str(20 + i % 40), f"{10 + i % 9},50", "AB"[i % 2]] for i in range(40)]
    out = run_rows([["Idade", "Preço Unitário", "Grupo"]] + rows)
    assert prof(out, "Idade")["additive"] is False and prof(out, "Preço Unitário")["additive"] is False


def test_repeating_ids_are_identifiers_and_metrics_are_not():
    rows = [[f"{1 + i % 28:02d}/01/2024", str(100 + i % 7), str(5000 + i % 5), f"{100 + i},00"] for i in range(60)]
    out = run_rows([["Data", "ID Cliente", "Código do Produto", "Valor"]] + rows)
    assert prof(out, "ID Cliente")["pattern"] == "identifier"
    assert prof(out, "Código do Produto")["pattern"] == "identifier"
    rows = [[f"{i:02d}/2024", str(120000 + i * 1371), f"{13 + i}.{700 + i}"] for i in range(1, 10)]
    out = run_rows([["Mês", "Impressões", "Total"]] + rows)
    assert prof(out, "Impressões")["pattern"] == "continuous"
    assert out["roles"]["value"] == "Total"


def test_json_big_ids_keep_precision():
    data = [{"codigo": 123456789012345678 + i, "cliente": {"id": 7 + i}, "valor": 10.5 * i} for i in range(4)]
    data[2]["codigo"] = None
    out = json.loads(E.run(json.dumps({"kind": "json", "text": json.dumps(data)})))
    assert out["columns"]["codigo"][0] == "123456789012345678"
    assert prof(out, "cliente.id")["pattern"] == "identifier"


def test_negative_ledger_has_no_negative_share():
    import random
    rnd = random.Random(3)
    rows = []
    for m in range(1, 7):
        rows.append([f"10/{m:02d}/2024", "Vendas", f"{rnd.randint(900, 1100)},00"])
        for cat in ("Aluguel", "Salários", "Energia"):
            rows.append([f"15/{m:02d}/2024", cat, f"-{rnd.randint(200, 400)},00"])
    out = run_rows([["Data", "Categoria", "Valor"]] + rows)
    assert not any("Responde por -" in it["d"] for it in out["insights"])
    assert not any(it["t"].startswith("Aproveitar o crescimento") and "Sal" in it["t"] for it in out["insights"])
    assert not any(h["l"] == "Concentração" and h["v"].startswith("-") for h in out["highlights"])


def test_unit_price_not_total_when_qty_is_one():
    rows = [[f"{1 + i % 28:02d}/01/2024", str(2 if i % 12 == 0 else 1), f"{20 + i % 9},00",
             f"{(2 if i % 12 == 0 else 1) * (20 + i % 9)},00"] for i in range(50)]
    out = run_rows([["Data", "Qtd", "Preço Unitário", "Valor Total"]] + rows)
    assert prof(out, "Preço Unitário")["additive"] is False
    assert out["quality"]["relations"] == [{"total": "Valor Total", "a": "Qtd", "b": "Preço Unitário"}]


def test_pii_by_name_even_with_low_cardinality():
    rows = [[f"{1 + i % 28:02d}/01/2024", "CONSUMIDOR FINAL" if i % 5 < 3 else ["123.456.789-09", "111.222.333-44"][i % 2],
             f"{100 + i},00"] for i in range(60)]
    out = run_rows([["Data", "CPF/CNPJ Destinatário", "Valor Total"]] + rows)
    assert "CPF/CNPJ Destinatário" in out["quality"]["piiColumns"]
    assert not any("123.456" in f for f in out["facts"])


def test_mixed_email_column_is_pii_and_facts_are_redacted():
    names = ["Loja Alfa", "Mercado Beta", "ana.silva@gmail.com", "joao@empresa.com.br", "Atacado Gama"]
    rows = [[f"{1 + i % 28:02d}/01/2024", names[i % 5], f"{100 + i * 3},00"] for i in range(80)]
    out = run_rows([["Data", "cliente", "valor"]] + rows)
    assert "cliente" in out["quality"]["piiColumns"]
    assert E._redact("Líder: ana@x.com.br e 123.456.789-09") == "Líder: [dado pessoal] e [dado pessoal]"
    assert not any("@" in f for f in out["facts"])


def test_month_words_inside_names_are_not_dates():
    out = run_rows([["Setor", "Valor"]] + [[f"Setor {1 + i % 8:02d}", f"{100 + i},00"] for i in range(30)])
    assert prof(out, "Setor")["pattern"] == "category_low"


def test_low_outliers_described_as_below():
    rows = [[f"{1 + i % 28:02d}/01/2024", f"{-900 if i in (5, 17) else 100 + i % 40},00"] for i in range(40)]
    out = run_rows([["Data", "Valor"]] + rows)
    o = next(it for it in out["insights"] if it["tag"] == "Outlier")
    assert "abaixo de" in o["d"] and "acima de" not in o["d"]


def test_absurd_numbers_are_unreadable_not_infinite():
    rows = [[f"{d:02d}/01/2024", "1e308" if d in (2, 3) else f"{d * 10},00"] for d in range(1, 25)]
    out = run_rows([["Data", "Valor"]] + rows)
    assert "inf" not in out["summary"] and prof(out, "Valor")["coerced"] == 2
