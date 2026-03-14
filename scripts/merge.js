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

// configfull 组名 -> convert.js 组名
const GROUP_MAP = {
  "节点选择": "选择代理",
  "全球直连": "直连",
  "隐私拦截": "广告拦截",
  "哔哩哔哩": "Bilibili",
  "巴哈姆特": "Bahamut",
  "Final": "选择代理",
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

function toJsProvider(name, obj) {
  const t = obj.type || "http";
  const b = obj.behavior || "domain";
  const f = obj.format || "mrs";
  const i = obj.interval || 86400;
  const u = obj.url || "";
  const pathName = (name + "").replace(/[!@%]/g, "_");
  return `    ${JSON.stringify(name)}: {
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

  // 1. 额外 rule-providers
  const extraProviders = [];
  for (const [name, val] of Object.entries(rp)) {
    if (CONVERT_PROVIDERS.has(name)) continue;
    extraProviders.push(toJsProvider(name, expandProvider(name, val)));
  }

  // 2. 额外规则（仅引用新 provider 的）
  const extraRules = [];
  for (const r of rules) {
    const parts = r.split(",").map((s) => s.trim());
    if (parts.length < 3 || parts[0] !== "RULE-SET") continue;
    const [, provider, group] = parts;
    const noResolve = parts.includes("no-resolve") ? ",no-resolve" : "";
    const mapped = GROUP_MAP[group] || group;
    if (!CONVERT_PROVIDERS.has(provider) && rp[provider]) {
      extraRules.push(`\`RULE-SET,${provider},${mapped}${noResolve}\``);
    }
  }

  // 3. 额外策略组（configfull 有而 convert 没有的，使用 defaultProxies）
  const CONVERT_GROUPS = new Set([
    "选择代理", "手动选择", "故障转移", "直连", "落地节点", "低倍率节点",
    "静态资源", "AI", "Crypto", "Google", "Microsoft", "YouTube", "Bilibili",
    "Bahamut", "Netflix", "TikTok", "Spotify", "E-Hentai", "Telegram", "Truth Social",
    "OneDrive", "PikPak", "SSH(22端口)", "搜狗输入法", "DIRECT", "广告拦截", "GLOBAL",
  ]);
  const CF_EXTRA_GROUPS = [
    { name: "Discord", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/discord.png" },
    { name: "LINE", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/line.png" },
    { name: "Signal", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/signal.png" },
    { name: "Meta", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/meta.png" },
    { name: "GitHub", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/github.png" },
    { name: "DisneyPlus", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/disney.png" },
    { name: "HBO", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/hbo.png" },
    { name: "Primevideo", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/primevideo.png" },
    { name: "AppleTV", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/appletv.png" },
    { name: "STEAM", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/steam.png" },
    { name: "PayPal", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/paypal.png" },
    { name: "Wise", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/wise.png" },
    { name: "Emby", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/emby.png" },
    { name: "Speedtest", icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/speedtest.png" },
  ];
  const extraGroups = CF_EXTRA_GROUPS.filter((g) => !CONVERT_GROUPS.has(g.name));

  let out = convertJs;

  // 注入 rule-providers
  if (extraProviders.length) {
    out = out.replace(
      /(Crypto: \{[^}]+},)\s*\};/s,
      `$1,\n${extraProviders.join(",\n")}\n};`
    );
  }

  // 注入规则
  if (extraRules.length) {
    out = out.replace(
      /("DST-PORT,22,SSH\(22端口\)",)\s*(`MATCH)/,
      `$1\n    ${extraRules.join(",\n    ")},\n    $2`
    );
  }

  // 注入策略组：在 广告拦截 之后、lowCostNodes 之前
  if (extraGroups.length) {
    const groupStr = extraGroups
      .map(
        (g) => `        {
            name: "${g.name}",
            icon: "${g.icon}",
            type: "select",
            proxies: defaultProxies,
        }`
      )
      .join(",\n");
    out = out.replace(
      /(name: "广告拦截",[\s\S]*?proxies: \["REJECT", "REJECT-DROP", PROXY_GROUPS\.DIRECT\],\s*\},)\s*(lowCostNodes\.length > 0)/,
      `$1,\n${groupStr}\n        $2`
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
