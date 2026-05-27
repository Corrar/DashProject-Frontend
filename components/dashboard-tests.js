/* Data-pipeline parser tests — run in the browser DevTools console.
 *
 * Not loaded by Dash.html (it's a dev tool, not app code). To run it:
 *   1. Open Dash.html in the browser.
 *   2. Paste this file's contents into the console, OR run:
 *        var s=document.createElement('script');
 *        s.src='components/dashboard-tests.js';
 *        document.body.appendChild(s);
 *
 * It exercises dashParseNumber / dashParseDate / dashInferSchema /
 * dashResolveColumns against the known-bad inputs from the data-pipeline bug
 * report (BR currency, date-as-number, type inference, value-column choice,
 * unique-order ticket médio). Prints a PASS/FAIL line per case and a summary.
 */
(function(){
  var W = (typeof window !== "undefined") ? window : globalThis;
  var fns = ["dashParseNumber","dashParseDate","dashInferSchema","dashResolveColumns",
    "dashProfileColumn","dashProfileColumns","dashSuggestMetrics","dashGenerateBlocks","dashPresetCompat"];
  var missing = fns.filter(function(f){ return typeof W[f] !== "function"; });
  if(missing.length){
    console.error("[dashboard-tests] missing on window: " + missing.join(", ") +
      ". Open Dash.html first so dashboard.jsx + dashboard-discovery.jsx have loaded.");
    return;
  }
  var dashParseNumber = W.dashParseNumber, dashParseDate = W.dashParseDate,
      dashInferSchema = W.dashInferSchema, dashResolveColumns = W.dashResolveColumns;
  var dashProfileColumn = W.dashProfileColumn, dashProfileColumns = W.dashProfileColumns,
      dashSuggestMetrics = W.dashSuggestMetrics, dashGenerateBlocks = W.dashGenerateBlocks,
      dashPresetCompat = W.dashPresetCompat;

  var pass = 0, fail = 0;
  function eq(a, b){
    return a === b || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9);
  }
  function t(label, got, want){
    var ok = eq(got, want);
    console.log((ok ? "PASS" : "FAIL") + " | " + label + " => " + JSON.stringify(got) +
      (ok ? "" : "  (esperado " + JSON.stringify(want) + ")"));
    ok ? pass++ : fail++;
  }
  function tIn(label, got, arr){
    var ok = arr.indexOf(got) >= 0;
    console.log((ok ? "PASS" : "FAIL") + " | " + label + " => " + JSON.stringify(got) +
      (ok ? "" : "  (esperado um de " + JSON.stringify(arr) + ")"));
    ok ? pass++ : fail++;
  }
  // Build a column value array from a generator (n rows).
  function col(n, gen){ var a = []; for(var i=0;i<n;i++) a.push(gen(i)); return a; }
  // header + array-of-arrays → array of row objects (for dashGenerateBlocks).
  function objs(header, rows){ return rows.map(function(r){ var o={}; header.forEach(function(h,i){ o[h]=r[i]; }); return o; }); }
  function patternOf(name, values){ return dashProfileColumn(name, values).pattern; }

  console.log("=== dashParseNumber ===");
  t("'01/01/2025' (data não é número)", dashParseNumber("01/01/2025"), null);
  t("'R$ 1.500' (milhar BR)",           dashParseNumber("R$ 1.500"), 1500);
  t("'R$ 1.234,56' (decimal BR)",       dashParseNumber("R$ 1.234,56"), 1234.56);
  t("'1,000.50' (decimal US)",          dashParseNumber("1,000.50"), 1000.5);
  t("'-R$ 500' (sinal)",                dashParseNumber("-R$ 500"), -500);
  t("'(500)' (contábil)",               dashParseNumber("(500)"), -500);
  t("'abc' (texto puro)",               dashParseNumber("abc"), null);
  t("'12abc' (texto misto)",            dashParseNumber("12abc"), null);
  t("'' (vazio)",                       dashParseNumber(""), null);
  t("null",                             dashParseNumber(null), null);
  t("'1,5' (decimal BR curto)",         dashParseNumber("1,5"), 1.5);
  t("'1.5' (decimal US curto)",         dashParseNumber("1.5"), 1.5);
  t("'1.234.567' (milhar BR)",          dashParseNumber("1.234.567"), 1234567);
  t("'50%' (percentual)",               dashParseNumber("50%"), 50);
  t("'2025-01-01' (data ISO → null)",   dashParseNumber("2025-01-01"), null);

  console.log("=== dashParseDate ===");
  t("'01/01/2025' válida", dashParseDate("01/01/2025") instanceof Date && !isNaN(dashParseDate("01/01/2025")), true);
  t("'-' inválida",        dashParseDate("-"), null);
  t("'' vazia",            dashParseDate(""), null);

  console.log("=== dashInferSchema ===");
  var dateRows = []; for(var i=0;i<99;i++) dateRows.push(["0"+((i%9)+1)+"/01/2025"]); dateRows.push(["-"]);
  t("99% datas + 1 '-' → date", dashInferSchema(["Data"], dateRows)[0].type, "date");
  var numRows = []; for(var j=0;j<90;j++) numRows.push(["R$ "+(1000+j)]); for(var k=0;k<10;k++) numRows.push(["-"]);
  t("90% números + 10 '-' → measure", dashInferSchema(["Valor"], numRows)[0].type, "measure");
  t("coluna de datas ISO → date (não measure)",
    dashInferSchema(["Dia"], [["2025-01-01"],["2025-01-02"],["2025-02-15"]])[0].type, "date");

  console.log("=== dashResolveColumns ===");
  t("Quantidade vs ValorBruto → ValorBruto",
    dashResolveColumns([{name:"Data",type:"date"},{name:"Quantidade",type:"measure"},{name:"ValorBruto",type:"measure"}]).value, "ValorBruto");
  t("'Vlr_Total' casa por conter 'total'",
    dashResolveColumns([{name:"Vlr_Total",type:"measure"},{name:"Qtd",type:"measure"}]).value, "Vlr_Total");
  t("'num_venda' excluído, 'Receita' vence",
    dashResolveColumns([{name:"num_venda",type:"measure"},{name:"Quantidade",type:"measure"},{name:"Receita",type:"measure"}]).value, "Receita");
  t("coluna de pedido detectada",
    dashResolveColumns([{name:"Pedido",type:"dimension"},{name:"Receita",type:"measure"}]).order, "Pedido");

  console.log("=== Ticket Médio (denominador = pedidos únicos) ===");
  // 6 itens em 2 pedidos, total R$ 12.000 → por pedido R$ 6.000, por linha R$ 2.000.
  var items = [
    {Pedido:"A", Valor:3000},{Pedido:"A", Valor:1000},{Pedido:"A", Valor:2000},
    {Pedido:"B", Valor:4000},{Pedido:"B", Valor:1000},{Pedido:"B", Valor:1000}
  ];
  function ticketMedioOf(rows, valueKey, orderKey){
    var total = rows.reduce(function(s,r){ return s + (typeof r[valueKey]==="number"? r[valueKey]:0); }, 0);
    var denom = orderKey
      ? new Set(rows.map(function(r){ return r[orderKey]; }).filter(function(v){ return v!=null && v!==""; })).size
      : rows.length;
    return denom ? total/denom : 0;
  }
  t("item-level com pedido → R$ 6.000/pedido", ticketMedioOf(items,"Valor","Pedido"), 6000);
  t("sem coluna pedido → R$ 2.000/linha",      ticketMedioOf(items,"Valor",null), 2000);

  console.log("=== dashProfileColumn (1 por pattern) ===");
  t("datetime: datas ISO",
    patternOf("Data", ["2025-01-01","2025-02-02","2025-03-03","2025-04-04","2025-05-05"]), "datetime");
  t("boolean: sim/não",
    patternOf("Aprovado", ["sim","não","sim","sim","não","sim"]), "boolean");
  t("boolean: true/false",
    patternOf("Flag", ["true","false","true","false","true"]), "boolean");
  t("identifier: códigos únicos (A001…)",
    patternOf("Pedido", ["A001","A002","A003","A004","A005","A006","A007","A008","A009","A010"]), "identifier");
  t("scale: nota 1-5",
    patternOf("Nota", [1,2,3,4,5,4,3,2,1,5,4,3].map(String)), "scale");
  t("percent: células com %",
    patternOf("Taxa", ["12%","8%","15%","20%","5%","11%"]), "percent");
  t("monetary: R$ BR",
    patternOf("Receita", ["R$ 1.500,00","R$ 2.300,50","R$ 980,00","R$ 4.200,75","R$ 760,20"]), "monetary");
  t("continuous: medidas numéricas",
    patternOf("Peso", ["1200","3400","250","8900","430","1750","620"]), "continuous");
  t("multi_value: listas com vírgula",
    patternOf("Modalidades", ["Online, Presencial","Presencial","Online, Híbrido","Online, Presencial, Híbrido","Híbrido"]), "multi_value");
  t("category_low: 2-20 únicos",
    patternOf("Curso", col(48, function(i){ return ["Engenharia","Medicina","Direito","Administração"][i%4]; })), "category_low");
  t("category_high: 20-100 únicos",
    patternOf("Cidade", col(80, function(i){ return "Cidade" + (i%45); })), "category_high");
  t("freetext: textos longos e únicos",
    patternOf("Comentario", col(30, function(i){ return "Comentário detalhado e único de número " + i + " com bastante texto para passar dos cinquenta caracteres."; })), "freetext");

  console.log("=== Cenário 1: CSV de vendas ===");
  (function(){
    var header = ["Data","Pedido","Produto","Receita"];
    var produtos = ["Esteira","Pesagem","Bandeja","Climatização"];
    var rows = col(24, function(i){
      var mes = String((i%6)+1).padStart(2,"0");
      return ["2026-"+mes+"-"+String((i%27)+1).padStart(2,"0"), "PD"+String(1000+i),
              produtos[i%4], "R$ " + (1500 + i*137) + ",00"];
    });
    var profs = dashProfileColumns(header, rows);
    t("vendas · Data → datetime",      profs[0].pattern, "datetime");
    t("vendas · Pedido → identifier",  profs[1].pattern, "identifier");
    t("vendas · Produto → category_low", profs[2].pattern, "category_low");
    t("vendas · Receita → monetary",   profs[3].pattern, "monetary");
    var mets = dashSuggestMetrics(profs, objs(header, rows));
    t("vendas · métrica top = sum (prio 100)", mets[0].kind === "sum" && mets[0].priority === 100, true);
    t("vendas · existe trend (date+monetary)", mets.some(function(m){ return m.kind === "trend"; }), true);
    var blk = dashGenerateBlocks(profs, mets, objs(header, rows));
    t("vendas · gera KPIs",            blk.kpis.length > 0, true);
    t("vendas · KPI schema válido",    blk.kpis[0].kind === "kpi" && typeof blk.kpis[0].props.value === "number", true);
    t("vendas · gera charts",          blk.charts.length > 0, true);
    t("vendas · confidence > 0.7 (usa novo pipeline)", blk.overallConfidence > 0.7, true);
    t("vendas · salesShape compatível", dashPresetCompat(profs).salesShape, true);
  })();

  console.log("=== Cenário 2: CSV de pesquisa (Google Forms) ===");
  (function(){
    var header = ["Carimbo","Curso","Nota","Modalidades","EquipeMista"];
    var cursos = ["Engenharia","Medicina","Direito"];
    var mods = ["Online, Presencial","Presencial","Online, Híbrido","Online, Presencial, Híbrido"];
    var rows = col(40, function(i){
      var mes = String((i%6)+1).padStart(2,"0");
      return ["2026-"+mes+"-"+String((i%27)+1).padStart(2,"0"), cursos[i%3],
              String((i%5)+1), mods[i%4], (i%2===0?"sim":"não")];
    });
    var profs = dashProfileColumns(header, rows);
    t("pesquisa · Carimbo → datetime",    profs[0].pattern, "datetime");
    t("pesquisa · Curso → category_low",  profs[1].pattern, "category_low");
    t("pesquisa · Nota → scale",          profs[2].pattern, "scale");
    t("pesquisa · Modalidades → multi_value", profs[3].pattern, "multi_value");
    t("pesquisa · EquipeMista → boolean", profs[4].pattern, "boolean");
    var mets = dashSuggestMetrics(profs, objs(header, rows));
    t("pesquisa · sugere avg da escala",  mets.some(function(m){ return m.kind === "avg"; }), true);
    t("pesquisa · sugere percent_positive", mets.some(function(m){ return m.kind === "percent_positive"; }), true);
    t("pesquisa · sugere frequency_by_item", mets.some(function(m){ return m.kind === "frequency_by_item"; }), true);
    t("pesquisa · NÃO é salesShape",      dashPresetCompat(profs).salesShape, false);
  })();

  console.log("=== Cenário 3: CSV de inventário ===");
  (function(){
    var header = ["SKU","Produto","Estoque","Categoria"];
    var prod = ["Parafuso","Porca","Arruela","Cabo","Conector"];
    var cat = ["Fixação","Elétrica","Hidráulica"];
    var rows = col(30, function(i){
      return ["SKU-" + (1000+i), prod[i%5], String(10 + (i*7)%480), cat[i%3]];
    });
    var profs = dashProfileColumns(header, rows);
    t("inventário · SKU → identifier",     profs[0].pattern, "identifier");
    t("inventário · Produto → category_low", profs[1].pattern, "category_low");
    t("inventário · Estoque → continuous", profs[2].pattern, "continuous");
    t("inventário · Categoria → category_low", profs[3].pattern, "category_low");
    var mets = dashSuggestMetrics(profs, objs(header, rows));
    t("inventário · sugere top_n",         mets.some(function(m){ return m.kind === "top_n"; }), true);
    t("inventário · sugere count_unique",  mets.some(function(m){ return m.kind === "count_unique"; }), true);
  })();

  console.log("=== Cenário 4: CSV genérico/desconhecido ===");
  (function(){
    var header = ["ID","Nome","Valor"];
    var rows = col(30, function(i){
      return [String(i+1),
              "Registro descritivo e único de número " + i + " com texto livre suficiente para ultrapassar cinquenta caracteres.",
              String((12.5 + i*3.1).toFixed(1))];
    });
    var profs = dashProfileColumns(header, rows);
    t("genérico · ID → identifier",   profs[0].pattern, "identifier");
    tIn("genérico · Nome → texto livre", profs[1].pattern, ["freetext","category_high"]);
    t("genérico · Valor → continuous", profs[2].pattern, "continuous");
    var mets = dashSuggestMetrics(profs, objs(header, rows));
    t("genérico · sempre tem count de registros", mets.some(function(m){ return m.kind === "count"; }), true);
    var blk = dashGenerateBlocks(profs, mets, objs(header, rows));
    t("genérico · gera ao menos 1 KPI", blk.kpis.length > 0, true);
    t("genérico · confidence > 0.7 (entra no novo pipeline)", blk.overallConfidence > 0.7, true);
  })();

  console.log("=== dashSuggestMetrics (ordenação por priority) ===");
  (function(){
    var profs = [
      { name:"Data", pattern:"datetime", confidence:0.95, stats:{nullRatio:0}, hints:{} },
      { name:"Receita", pattern:"monetary", confidence:0.9, stats:{nullRatio:0}, hints:{} },
      { name:"Cliente", pattern:"identifier", confidence:0.8, stats:{nullRatio:0}, hints:{} }
    ];
    var mets = dashSuggestMetrics(profs, []);
    var sorted = mets.every(function(m,i){ return i === 0 || mets[i-1].priority >= m.priority; });
    t("ordenado desc por priority", sorted, true);
    t("primeiro = sum monetary (100)", mets[0].priority, 100);
    t("último = count de registros (50)", mets[mets.length-1].kind, "count");
  })();

  console.log("\n" + pass + " passaram, " + fail + " falharam");
  return { pass: pass, fail: fail };
})();
