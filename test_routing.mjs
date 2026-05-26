// 路由决策单元测试 —— 验证「直连泄漏」修复
// 运行: node test_routing.mjs
// 目标: 应走代理链路() 在配置了 PROXYIP/链式代理(启用反代兜底=false)时，
//       禁止裸直连真实目标，强制走反代链路(connecttoPry)，杜绝出口 IP 泄漏。
import { 应走代理链路 } from "./_worker.js";

let pass = 0,
  fail = 0;
function check(label, ok) {
  if (ok) {
    pass++;
    console.log("  ✅", label);
  } else {
    fail++;
    console.log("  ❌", label);
  }
}

// 默认: 无任何代理配置、反代兜底开启
const base = {
  启用SOCKS5反代: null,
  启用SOCKS5全局反代: false,
  命中SOCKS5白名单: false,
  落地代理有效: false,
  启用反代兜底: true,
};
const 走 = (o) => 应走代理链路({ ...base, ...o });

console.log("========== 路由决策单元测试 ==========\n");

console.log("--- 回归: 默认/直连场景 ---");
check("默认无配置(兜底开) → 直连优先(false)", 走({}) === false);
check(
  "SOCKS5反代设置但非全局非白名单(兜底开) → 直连优先(false)",
  走({ 启用SOCKS5反代: "socks5" }) === false,
);

console.log("\n--- Bug A: 反代兜底泄漏 ---");
check(
  "[Bug A] 配置PROXYIP(兜底=false)/无socks5/无落地 → 强制走代理链路(true)",
  走({ 启用反代兜底: false }) === true,
);

console.log("\n--- Bug B: 落地代理泄漏(命中黑名单仍不得裸直连) ---");
check(
  "[Bug B] 落地启用+命中黑名单(落地有效=false)+PROXYIP(兜底=false) → 走代理链路(true)",
  走({ 落地代理有效: false, 启用反代兜底: false }) === true,
);

console.log("\n--- 落地代理正常链路 ---");
check("落地代理有效 → 走代理链路(true)", 走({ 落地代理有效: true }) === true);
check(
  "落地代理有效(即使兜底开) → 走代理链路(true)",
  走({ 落地代理有效: true, 启用反代兜底: true }) === true,
);

console.log("\n--- SOCKS5/HTTP 全局或白名单 ---");
check(
  "SOCKS5全局反代 → 走代理链路(true)",
  走({ 启用SOCKS5反代: "socks5", 启用SOCKS5全局反代: true }) === true,
);
check(
  "SOCKS5反代+命中白名单 → 走代理链路(true)",
  走({ 启用SOCKS5反代: "socks5", 命中SOCKS5白名单: true }) === true,
);

console.log("\n--- 合理放行: 黑名单本意绕过落地、且无 PROXYIP ---");
check(
  "落地+命中黑名单+无PROXYIP(兜底开) → 直连优先(false)",
  走({ 落地代理有效: false, 启用反代兜底: true }) === false,
);

console.log(`\n========== 结果: ${pass} 通过, ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
