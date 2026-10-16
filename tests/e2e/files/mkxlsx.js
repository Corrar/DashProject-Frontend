const XLSX = require(process.argv[2]);
const aoa = [["data","produto","valor","taxa"]];
for (let i = 0; i < 30; i++) aoa.push([46083 + i, "P" + (i % 3), 12.345 + i, 0.048]);
const ws = XLSX.utils.aoa_to_sheet(aoa);
for (let i = 0; i < 30; i++) { const c = ws[XLSX.utils.encode_cell({ r: i + 1, c: 0 })]; c.t = 'n'; c.z = 'm/d/yy'; }
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "P1");
XLSX.writeFile(wb, process.argv[3]);
