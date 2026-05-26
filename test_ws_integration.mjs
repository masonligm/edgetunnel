// WS 集成测试客户端：向本地 wrangler dev 发一个合法 VLESS 帧，
// 触发 forwardataTCP，再从 wrangler 日志观察 [TCP转发决策] 的 走代理链路 判定。
// 用法: node test_ws_integration.mjs <target-host> [port]
const UUID = "12345678-1234-4234-8234-1234567890ab";
const host = process.argv[2] || "leak-probe.example.com";
const port = parseInt(process.argv[3] || "80", 10);

function uuidBytes(u) {
  const hex = u.replace(/-/g, "");
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
}
function buildVless(uuid, host, port) {
  const hostBytes = new TextEncoder().encode(host);
  const a = [];
  a.push(0); // version
  for (const x of uuidBytes(uuid)) a.push(x); // 16B UUID
  a.push(0); // optLen
  a.push(1); // cmd = TCP
  a.push((port >> 8) & 0xff, port & 0xff); // port (big-endian)
  a.push(2); // addressType = domain
  a.push(hostBytes.length);
  for (const x of hostBytes) a.push(x);
  return new Uint8Array(a);
}

const frame = buildVless(UUID, host, port);
console.log(`[client] 目标=${host}:${port}, VLESS 帧 ${frame.length}B`);

const ws = new WebSocket("ws://127.0.0.1:8787/");
ws.binaryType = "arraybuffer";
ws.onopen = () => {
  console.log("[client] WS 已连接，发送 VLESS 首包");
  ws.send(frame);
  setTimeout(() => {
    try { ws.close(); } catch {}
  }, 1500);
};
ws.onmessage = (e) => {
  const len = e.data?.byteLength ?? (e.data?.length || 0);
  console.log(`[client] 收到响应 ${len}B`);
};
ws.onerror = (e) => console.log("[client] WS error:", e.message || String(e));
ws.onclose = () => { console.log("[client] WS 关闭"); process.exit(0); };
setTimeout(() => { console.log("[client] 超时退出"); process.exit(0); }, 5000);
