function base64SecretEncode(plaintext, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const key = encoder.encode(secret);
  const mixed = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    mixed[i] = data[i] ^ key[i % key.length];
  }
  let binary = "";
  for (let i = 0; i < mixed.length; i++) {
    binary += String.fromCharCode(mixed[i]);
  }
  return btoa(binary);
}

function base64SecretDecode(encoded, secret) {
  const key = new TextEncoder().encode(secret);
  const binary = atob(encoded);
  const mixed = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    mixed[i] = binary.charCodeAt(i);
  }
  const data = new Uint8Array(mixed.length);
  for (let i = 0; i < mixed.length; i++) {
    data[i] = mixed[i] ^ key[i % key.length];
  }
  return new TextDecoder().decode(data);
}

const uuid = "test-uuid-12345";
let pass = 0, fail = 0;
function check(label, ok) { if (ok) { pass++; console.log("  ✅", label); } else { fail++; console.log("  ❌", label); } }

console.log("========== 修复后测试 ==========\n");

// 场景A: 纯代理路径
console.log("--- 场景A: 纯代理路径 ---");
let pathA = "/socks5://6bcOdYUxgNaP:WgXGT3R80hdN@207.45.13.90:41739";
pathA = pathA.replace(
  /\/(socks5|http|https|turn|sstp):\/\/[^/?&\s]+/i,
  (m) => "/ep/" + base64SecretEncode(m.slice(1), uuid)
);
console.log("  加密后:", pathA);
check("无查询参数重复", !pathA.includes("??"));
const mA = /\/ep\/([^/?&\s]+)/i.exec(pathA);
check("解密正确", mA && "/" + base64SecretDecode(mA[1], uuid) === "/socks5://6bcOdYUxgNaP:WgXGT3R80hdN@207.45.13.90:41739");

// 场景B: 带 ?ed=2560
console.log("\n--- 场景B: 带 ?ed=2560 ---");
let pathB = "/socks5://6bcOdYUxgNaP:WgXGT3R80hdN@207.45.13.90:41739?ed=2560";
pathB = pathB.replace(
  /\/(socks5|http|https|turn|sstp):\/\/[^/?&\s]+/i,
  (m) => "/ep/" + base64SecretEncode(m.slice(1), uuid)
);
console.log("  加密后:", pathB);
const qCountB = (pathB.match(/\?/g) || []).length;
check("? 只出现1次", qCountB === 1);
check("ed=2560保留", pathB.includes("?ed=2560"));
const mB = /\/ep\/([^/?&\s]+)/i.exec(pathB);
check("解密正确", mB && "/" + base64SecretDecode(mB[1], uuid) === "/socks5://6bcOdYUxgNaP:WgXGT3R80hdN@207.45.13.90:41739");

// 场景D: 先加落地参数，再加密（完整流程）
console.log("\n--- 场景D: 完整流程（先加落地参数，再加密）---");
let pathD = "/socks5://6bcOdYUxgNaP:WgXGT3R80hdN@207.45.13.90:41739";
const 订阅落地代理 = "socks5://landing:pass@1.2.3.4:1080";
const 加密落地代理 = base64SecretEncode(订阅落地代理, uuid);
const 落地参数 = `&lp=${加密落地代理}`;
pathD = pathD.includes("?") ? pathD + 落地参数 : pathD + "?" + 落地参数.slice(1);
pathD = pathD.replace(
  /\/(socks5|http|https|turn|sstp):\/\/[^/?&\s]+/i,
  (m) => "/ep/" + base64SecretEncode(m.slice(1), uuid)
);
console.log("  加密后:", pathD);
const qCountD = (pathD.match(/\?/g) || []).length;
check("? 只出现1次", qCountD === 1);
check("lp参数保留", pathD.includes("&lp="));
const mD = /\/ep\/([^/?&\s]+)/i.exec(pathD);
check("解密正确", mD && "/" + base64SecretDecode(mD[1], uuid) === "/socks5://6bcOdYUxgNaP:WgXGT3R80hdN@207.45.13.90:41739");

// 场景E: HTTP代理
console.log("\n--- 场景E: HTTP代理 ---");
let pathE = "/http://admin:secret@proxy.example.com:8080?ed=2560";
pathE = pathE.replace(
  /\/(socks5|http|https|turn|sstp):\/\/[^/?&\s]+/i,
  (m) => "/ep/" + base64SecretEncode(m.slice(1), uuid)
);
console.log("  加密后:", pathE);
const mE = /\/ep\/([^/?&\s]+)/i.exec(pathE);
check("HTTP代理解密正确", mE && "/" + base64SecretDecode(mE[1], uuid) === "/http://admin:secret@proxy.example.com:8080");
check("ed=2560保留", pathE.includes("?ed=2560"));

// 场景F: 向后兼容 - 明文路径
console.log("\n--- 场景F: 向后兼容 ---");
const plain = "/socks5://user:pass@host:443";
check("明文不匹配 /ep/", !/\/ep\//.test(plain));
check("明文仍可匹配原正则", /\/(socks5|http|https):\/\//.test(plain));

console.log(`\n========== 结果: ${pass} 通过, ${fail} 失败 ==========`);
if (fail > 0) process.exit(1);
