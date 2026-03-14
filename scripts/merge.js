#!/usr/bin/env node
/**
 * 合并脚本：将 powerfullz/override-rules 的 convert.js 与 Lanlan13-14/Rules 的 configfull.yaml 合并
 * 保留 convert.js 的 Telegram 策略组（不修改）
 * 数据源：自动从 GitHub 拉取最新
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const SOURCES = {
  convertJs:
    "https://raw.githubusercontent.com/powerfullz/override-rules/main/convert.js",
  configfull:
    "https://raw.githubusercontent.com/Lanlan13-14/Rules/main/configfull.yaml",
};

// convert.js 已有的，不重复添加
const CONVERT_PROVIDERS = new Set([
  "ADBlock", "SogouInput", "StaticResources", "CDNResources", "TikTok",
  "EHentai", "SteamFix", "GoogleFCM", "AdditionalFilter", "AdditionalCDNResources", "Crypto",
]);

// configfull 组名 -> convert 组名（Clash Party 等客户端可能未识别注入的策略组，统一映射到已有组）
const GROUP_MAP = {
  "节点选择": "选择代理",
  "全球直连": "直连",
  "隐私拦截": "广告拦截",
  "哔哩哔哩": "Bilibili",
  "巴哈姆特": "Bahamut",
  "Final": "选择代理",
  NETFLIX: "Netflix",
  Meta: "选择代理",
  Discord: "选择代理",
  LINE: "选择代理",
  Signal: "选择代理",
  Talkatone: "选择代理",
  FCM: "直连",
  GoogleVPN: "选择代理",
  DisneyPlus: "选择代理",
  HBO: "选择代理",
  Primevideo: "选择代理",
  AppleTV: "选择代理",
  Apple: "直连",
  Emby: "选择代理",
  "哔哩东南亚": "Bilibili",
  "国内媒体": "直连",
  "Global-TV": "选择代理",
  "Global-Medial": "选择代理",
  "游戏平台": "选择代理",
  Speedtest: "选择代理",
  PayPal: "选择代理",
  Wise: "选择代理",
  "国外电商": "选择代理",
  STEAM: "选择代理",
  GitHub: "选择代理",
  "自建家宽节点": "选择代理",
  "欧洲节点": "选择代理",
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Substore-Merge/1.0" } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

// 部分客户端不识别含 ! 的 provider 名，映射为安全名（避免与已有重名）
const PROVIDER_SAFE_MAP = {
  "ai!cn_domain": "ai_notcn_domain",
  "tencent!cn_domain": "tencent_notcn_domain",
  "media!cn_domain": "media_notcn_domain",
  "geolocation-!cn": "geolocation_notcn",
};
function safeProviderName(name) {
  return PROVIDER_SAFE_MAP[name] || (name + "").replace(/!/g, "_");
}

function toJsProvider(name, obj) {
  const safeName = safeProviderName(name);
  const t = obj.type || "http";
  const b = obj.behavior || "domain";
  const f = obj.format || "mrs";
  const i = obj.interval || 86400;
  const u = obj.url || "";
  const pathName = safeName.replace(/[^a-zA-Z0-9_]/g, "_");
  return `    ${JSON.stringify(safeName)}: {
        type: ${JSON.stringify(t)},
        behavior: ${JSON.stringify(b)},
        format: ${JSON.stringify(f)},
        interval: ${i},
        url: ${JSON.stringify(u)},
        path: "./ruleset/${pathName}.mrs",
    }`;
}

async function main() {
  console.log("📥 拉取 convert.js...");
  const convertJs = await fetchUrl(SOURCES.convertJs);
  console.log("📥 拉取 configfull.yaml...");
  const configfullRaw = await fetchUrl(SOURCES.configfull);

  const config = yaml.load(configfullRaw);
  const rp = config["rule-providers"] || {};
  const rules = config.rules || [];

  const anchors = config["rule-anchor"] || {};
  const domainBase = anchors.domain || { type: "http", interval: 86400, behavior: "domain", format: "mrs" };
  const ipBase = anchors.ip || { type: "http", interval: 86400, behavior: "ipcidr", format: "mrs" };

  const expandProvider = (name, val) => {
    const base = (val.behavior === "ipcidr" ? ipBase : domainBase);
    return { ...base, ...val };
  };

  // 1. 额外 rule-providers（使用 safe 名避免客户端解析问题）
  const extraProviders = [];
  const seenKeys = new Set();
  for (const [name, val] of Object.entries(rp)) {
    if (CONVERT_PROVIDERS.has(name)) continue;
    const key = safeProviderName(name);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    extraProviders.push(toJsProvider(name, expandProvider(name, val)));
  }

  // 2. 额外规则（仅引用新 provider 的，provider 名做 safeProviderName 以匹配）
  const extraRules = [];
  for (const r of rules) {
    const parts = r.split(",").map((s) => s.trim());
    if (parts.length < 3 || parts[0] !== "RULE-SET") continue;
    const [, provider, group] = parts;
    const safeProvider = safeProviderName(provider);
    const noResolve = parts.includes("no-resolve") ? ",no-resolve" : "";
    const mapped = GROUP_MAP[group] || group;
    if (!CONVERT_PROVIDERS.has(provider) && rp[provider]) {
      extraRules.push(`\`RULE-SET,${safeProvider},${mapped}${noResolve}\``);
    }
  }

  // 3. 不注入额外策略组，避免 Substore/Clash Party/Clash Verge Rev 解析或校验失败
  // 所有规则已通过 GROUP_MAP 映射到 convert 原生组
  let out = convertJs;

  // 注入 rule-providers（注意 $1 已含尾部逗号，不要重复加）
  if (extraProviders.length) {
    out = out.replace(
      /(Crypto: \{[^}]+},)\s*\};/s,
      `$1\n${extraProviders.join(",\n")}\n};`
    );
  }

  // 注入规则
  if (extraRules.length) {
    out = out.replace(
      /("DST-PORT,22,SSH\(22端口\)",)\s*(`MATCH)/,
      `$1\n    ${extraRules.join(",\n    ")},\n    $2`
    );
  }

  const outPath = path.join(__dirname, "..", "merged-convert.js");
  fs.writeFileSync(outPath, out, "utf8");
  console.log("✅ 已生成 merged-convert.js");
}

main().catch((e) => {
  console.error("❌ 合并失败:", e.message);
  process.exit(1);
});
