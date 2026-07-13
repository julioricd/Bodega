#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   ⚡ ANTENA DO JARVIS — servidor local de apoio
   · Node puro (http, https, tls) — ZERO dependências, zero npm install
   · Escuta SOMENTE em 127.0.0.1 — só o SEU navegador alcança
   · Rotas:
       GET  /ping             → teste de vida
       GET  /proxy?url=...    → busca agenda (.ics) e notícias (RSS) com CORS liberado
       POST /emails           → busca e-mails via IMAP (somente leitura, BODY.PEEK)
   · Rode com:  node server.js   (e deixe o terminal aberto)
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* import() dinâmico funciona tanto em CommonJS quanto em ES Modules —
   assim a antena roda em qualquer pasta, com ou sem package.json por perto. */
(async () => {

const { default: http } = await import("node:http");
const { default: https } = await import("node:https");
const { default: tls } = await import("node:tls");

const HOST = "127.0.0.1";
const PORT = 4242;
const PROXY_ALLOW = ["calendar.google.com", "news.google.com"]; // qualquer outro domínio → 403
const IMAP_ALLOW = ["imap.gmail.com"];                          // hosts IMAP permitidos
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/* nos logs, credenciais e links secretos são SEMPRE mascarados */
function mask(s){ return s ? String(s).slice(0, 3) + "***" : "?"; }

function corsHeaders(extra){
  return Object.assign({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Private-Network": "true"
  }, extra || {});
}
function sendJSON(res, code, obj){
  res.writeHead(code, corsHeaders({ "Content-Type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(obj));
}
function sendText(res, code, txt){
  res.writeHead(code, corsHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
  res.end(txt);
}

/* ─────────── PROXY HTTPS (agenda .ics + RSS de notícias) ─────────── */
function allowedProxy(host){
  return PROXY_ALLOW.some(a => host === a || host.endsWith("." + a));
}
function fetchURL(urlStr, hops, cb){
  let u;
  try{ u = new URL(urlStr); }catch(e){ return cb(new Error("URL inválida")); }
  if(u.protocol !== "https:") return cb(new Error("só https é permitido"));
  const req = https.get(u, { headers: { "User-Agent": UA, "Accept": "*/*" } }, r => {
    if(r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && hops < 3){
      r.resume();
      let next;
      try{ next = new URL(r.headers.location, u); }catch(e){ return cb(new Error("redirect inválido")); }
      if(!next.hostname.endsWith("google.com") && !allowedProxy(next.hostname))
        return cb(new Error("redirect bloqueado"));
      return fetchURL(next.toString(), hops + 1, cb);
    }
    if(r.statusCode !== 200){ r.resume(); return cb(new Error("HTTP " + r.statusCode)); }
    const chunks = [];
    r.on("data", c => chunks.push(c));
    r.on("end", () => cb(null, Buffer.concat(chunks).toString("utf8")));
  });
  req.on("error", cb);
  req.setTimeout(20000, () => req.destroy(new Error("timeout")));
}

/* ─────────── decodificadores MIME ─────────── */
function bufToStr(buf, charset){
  charset = (charset || "utf-8").toLowerCase();
  if(charset.includes("8859") || charset.includes("latin") || charset.includes("1252")) return buf.toString("latin1");
  return buf.toString("utf8");
}
function decodeWords(s){ // assuntos/remetentes em =?UTF-8?B?...?= e =?UTF-8?Q?...?=
  if(!s) return "";
  s = s.replace(/\?=\s+=\?/g, "?==?"); // encoded-words adjacentes
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (all, cs, enc, data) => {
    try{
      let buf;
      if(enc.toUpperCase() === "B") buf = Buffer.from(data, "base64");
      else buf = Buffer.from(data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))), "latin1");
      return bufToStr(buf, cs);
    }catch(e){ return all; }
  });
}
function decodeQP(s){ // quoted-printable
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
}
function stripHTML(s){
  return s.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#\d+;/g, " ");
}
function headerMap(raw){
  const map = {};
  raw.replace(/\r\n[ \t]/g, " ").split(/\r\n/).forEach(l => {
    const i = l.indexOf(":");
    if(i > 0) map[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
  });
  return map;
}
function decodePart(bodyLatin1, cte, charset, isHtml){
  let s;
  cte = (cte || "").toLowerCase();
  if(cte.includes("base64")){
    try{ s = bufToStr(Buffer.from(bodyLatin1.replace(/[^A-Za-z0-9+/=]/g, ""), "base64"), charset); }
    catch(e){ s = bodyLatin1; }
  } else if(cte.includes("quoted-printable")){
    s = bufToStr(Buffer.from(decodeQP(bodyLatin1), "latin1"), charset);
  } else {
    s = bufToStr(Buffer.from(bodyLatin1, "latin1"), charset);
  }
  if(isHtml) s = stripHTML(s);
  return s.replace(/\s+/g, " ").trim().slice(0, 500);
}
function charsetOf(ct){ const m = (ct || "").match(/charset="?([^";\s]+)"?/i); return m ? m[1] : null; }
function extractSnippet(bodyLatin1, contentType, cte){
  const ct = (contentType || "").toLowerCase();
  const bm = (contentType || "").match(/boundary="?([^";]+)"?/i);
  if(ct.includes("multipart") && bm){
    const parts = bodyLatin1.split("--" + bm[1]);
    let html = null;
    for(const p of parts){
      const sep = p.indexOf("\r\n\r\n");
      if(sep < 0) continue;
      const ph = headerMap(p.slice(0, sep));
      const pct = (ph["content-type"] || "text/plain").toLowerCase();
      const pbody = p.slice(sep + 4);
      if(pct.includes("multipart")){
        const inner = extractSnippet(pbody, ph["content-type"], ph["content-transfer-encoding"]);
        if(inner) return inner;
        continue;
      }
      if(pct.includes("text/plain"))
        return decodePart(pbody, ph["content-transfer-encoding"], charsetOf(ph["content-type"]), false);
      if(pct.includes("text/html") && html === null)
        html = decodePart(pbody, ph["content-transfer-encoding"], charsetOf(ph["content-type"]), true);
    }
    return html || "";
  }
  return decodePart(bodyLatin1, cte, charsetOf(contentType), ct.includes("text/html"));
}

/* ─────────── cliente IMAP mínimo (tls nativo, porta 993) ───────────
   CRÍTICO: usa BODY.PEEK — NENHUM e-mail é marcado como lido. */
function imapFetch(opts, cb){
  const host = opts.host;
  const quantidade = Math.min(Math.max(parseInt(opts.quantidade, 10) || 20, 1), 50);
  let buf = "", tagN = 0, done = false, step = 0, curTag = null, exists = 0;
  const sock = tls.connect(993, host, { servername: host }, () => {});
  const finish = (err, emails) => {
    if(done) return; done = true;
    try{ sock.end(); sock.destroy(); }catch(e){}
    cb(err, emails);
  };
  sock.setTimeout(25000, () => finish(new Error("timeout")));
  sock.on("error", e => finish(e));
  const q = s => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  const send = cmd => { curTag = "A" + (++tagN); sock.write(curTag + " " + cmd + "\r\n"); };

  // varre o buffer respeitando literais {n} do IMAP
  function scanForTag(){
    let i = 0;
    while(i < buf.length){
      const nl = buf.indexOf("\r\n", i);
      if(nl === -1) return null;
      const line = buf.slice(i, nl);
      const lit = line.match(/\{(\d+)\}$/);
      if(lit){
        const need = nl + 2 + parseInt(lit[1], 10);
        if(buf.length < need) return null; // literal ainda incompleto
        i = need; continue;
      }
      if(curTag && line.startsWith(curTag + " ")){
        const out = { data: buf.slice(0, i), status: line.slice(curTag.length + 1).split(" ")[0] };
        buf = buf.slice(nl + 2);
        return out;
      }
      i = nl + 2;
    }
    return null;
  }

  sock.on("data", d => {
    buf += d.toString("latin1");
    if(step === 0){ // saudação do servidor
      const nl = buf.indexOf("\r\n");
      if(nl === -1) return;
      buf = buf.slice(nl + 2);
      step = 1;
      send("LOGIN " + q(opts.usuario) + " " + q(opts.senhaApp));
      return;
    }
    let r;
    while((r = scanForTag()) !== null){
      if(step === 1){
        if(r.status !== "OK") return finish(new Error("auth"));
        step = 2; send("EXAMINE INBOX"); // EXAMINE = modo somente leitura
      } else if(step === 2){
        if(r.status !== "OK") return finish(new Error("caixa de entrada inacessível"));
        const m = r.data.match(/\* (\d+) EXISTS/);
        exists = m ? parseInt(m[1], 10) : 0;
        if(!exists) return finish(null, []);
        const from = Math.max(1, exists - quantidade + 1);
        step = 3;
        send("FETCH " + from + ":" + exists +
          " (FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] BODY.PEEK[TEXT]<0.8192>)");
      } else if(step === 3){
        const emails = r.status === "OK" ? parseFetch(r.data) : [];
        finish(null, emails);
      }
    }
  });
}
function parseFetch(data){
  const msgs = [];
  let cur = null, i = 0;
  while(i < data.length){
    const nl = data.indexOf("\r\n", i);
    if(nl === -1) break;
    const line = data.slice(i, nl);
    if(/^\* \d+ FETCH /.test(line)) { cur = { headers:"", body:"", seen:false }; msgs.push(cur); }
    if(cur && /\\Seen/.test(line)) cur.seen = true;
    let marker = null;
    if(/BODY\[HEADER/i.test(line)) marker = "headers";
    else if(/BODY\[TEXT\]/i.test(line)) marker = "body";
    const lit = line.match(/\{(\d+)\}$/);
    if(lit){
      const n = parseInt(lit[1], 10);
      if(cur && marker) cur[marker] = data.slice(nl + 2, nl + 2 + n);
      i = nl + 2 + n;
      continue;
    }
    i = nl + 2;
  }
  return msgs.map(m => {
    const h = headerMap(m.headers);
    const fromRaw = decodeWords(h.from || "");
    return {
      id: h["message-id"] || ((h.date || "") + "|" + (h.subject || "")),
      remetente: (fromRaw.replace(/\s*<[^>]*>/g, "").replace(/^["']|["']$/g, "").trim()) || fromRaw,
      assunto: decodeWords(h.subject || "") || "(sem assunto)",
      data: h.date || "",
      trecho: extractSnippet(m.body, h["content-type"], h["content-transfer-encoding"]),
      lido: m.seen
    };
  }).reverse(); // mais recentes primeiro
}

/* ─────────── servidor HTTP ─────────── */
const server = http.createServer((req, res) => {
  if(req.method === "OPTIONS"){ res.writeHead(204, corsHeaders()); return res.end(); } // preflight CORS

  let u;
  try{ u = new URL(req.url, "http://127.0.0.1"); }catch(e){ return sendJSON(res, 400, { ok:false, error:"url" }); }

  if(req.method === "GET" && u.pathname === "/ping")
    return sendJSON(res, 200, { ok:true, antena:"jarvis", porta:PORT });

  if(req.method === "GET" && u.pathname === "/proxy"){
    const target = u.searchParams.get("url") || "";
    let host = "";
    try{ host = new URL(target).hostname; }catch(e){}
    if(!allowedProxy(host)) return sendJSON(res, 403, { ok:false, error:"dominio_bloqueado" });
    console.log("🌐 proxy → " + host); // só o domínio — o link secreto nunca é logado
    return fetchURL(target, 0, (err, body) => {
      if(err) return sendJSON(res, 502, { ok:false, error:String(err.message || err) });
      sendText(res, 200, body);
    });
  }

  if(req.method === "POST" && u.pathname === "/emails"){
    let raw = "";
    req.on("data", c => { raw += c; if(raw.length > 65536) req.destroy(); });
    req.on("end", () => {
      let p;
      try{ p = JSON.parse(raw); }catch(e){ return sendJSON(res, 400, { ok:false, error:"json" }); }
      const host = String(p.host || "imap.gmail.com").toLowerCase().trim();
      if(!IMAP_ALLOW.includes(host)) return sendJSON(res, 403, { ok:false, error:"host_bloqueado" });
      if(!p.usuario || !p.senhaApp) return sendJSON(res, 400, { ok:false, error:"faltando_credenciais" });
      console.log("📧 IMAP " + host + " · " + mask(p.usuario)); // senha JAMAIS aparece no log
      imapFetch(p, (err, emails) => {
        if(err) return sendJSON(res, 200, { ok:false, error: err.message === "auth" ? "auth" : "conexao", detalhe: String(err.message || err) });
        console.log("   ↳ " + emails.length + " e-mails entregues (nenhum marcado como lido)");
        sendJSON(res, 200, { ok:true, emails });
      });
    });
    return;
  }

  sendJSON(res, 404, { ok:false, error:"rota_desconhecida" });
});

server.on("error", e => {
  if(e.code === "EADDRINUSE"){
    console.log("");
    console.log("  ❌ A porta " + PORT + " já está em uso.");
    console.log("     Provavelmente já existe uma antena rodando em outro terminal.");
    console.log("     Feche a outra (Ctrl+C) e rode 'node server.js' de novo.");
    console.log("");
  } else {
    console.log("❌ Erro ao iniciar a antena: " + e.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  ⚡ ANTENA DO JARVIS ONLINE — porta " + PORT + ". Pode abrir o jarvis.html.");
  console.log("  📡 escutando só em 127.0.0.1 · Ctrl+C para desligar · deixe este terminal aberto");
  console.log("");
});

})();
