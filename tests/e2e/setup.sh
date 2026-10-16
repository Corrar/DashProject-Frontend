#!/usr/bin/env bash
# Baixa do registro npm as libs que o index.html carrega do unpkg/sheetjs; o
# harness serve essas cópias locais (a rede do ambiente pode bloquear o unpkg).
# Gera também a base de 150 mil linhas (grande demais para o Git).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p cdn shots
get(){ # nome-do-pacote versão pasta-destino
  local url="https://registry.npmjs.org/$1/-/$(basename "$1")-$2.tgz"
  [ -d "cdn/$3" ] && return 0
  mkdir -p "cdn/$3" && curl -fsSL "$url" | tar -xz -C "cdn/$3"
}
get react 18.3.1 react-18.3.1
get react-dom 18.3.1 react-dom-18.3.1
get @babel/standalone 7.29.0 babel-standalone-7.29.0
get html-to-image 1.11.11 hti
get xlsx 0.18.5 xlsx-0.18.5
[ -f files/enorme_150k.csv ] || node -e '
  const fs=require("fs"); const out=["data,produto,valor"]; const d0=Date.UTC(2024,0,1);
  for(let i=0;i<150000;i++){ out.push(new Date(d0+(i%700)*864e5).toISOString().slice(0,10)+",P"+(i%5)+","+(100+i%1000)); }
  fs.writeFileSync("files/enorme_150k.csv", out.join("\n")+"\n");'
echo "ok: cdn/ e files/ prontos"
