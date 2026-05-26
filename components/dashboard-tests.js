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
  var fns = ["dashParseNumber","dashParseDate","dashInferSchema","dashResolveColumns"];
  var missing = fns.filter(function(f){ return typeof W[f] !== "function"; });
  if(missing.length){
    console.error("[dashboard-tests] missing on window: " + missing.join(", ") +
      ". Open Dash.html first so dashboard.jsx has loaded.");
    return;
  }
  var dashParseNumber = W.dashParseNumber, dashParseDate = W.dashParseDate,
      dashInferSchema = W.dashInferSchema, dashResolveColumns = W.dashResolveColumns;

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

  console.log("\n" + pass + " passaram, " + fail + " falharam");
  return { pass: pass, fail: fail };
})();
