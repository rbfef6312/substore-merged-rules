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

// configfull 组名 -> convert 组名（仅用于 convert 已有的组，新增组保持原名）
const GROUP_MAP = {
  "节点选择": "选择代理",
  "全球直连": "直连",
  "隐私拦截": "广告拦截",
  "哔哩哔哩": "Bilibili",
  "巴哈姆特": "Bahamut",
  "Final": "选择代理",
  NETFLIX: "Netflix",
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

  // 3. 注入 configfull 策略组（在 广告拦截 之后、lowCostNodes 之前），Telegram 保留 convert 的
  const ICON_BASE = "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev";
  const EXTRA_GROUPS = [
    { name: "FCM", proxies: "defaultProxiesDirect", icon: `${ICON_BASE}/fcm.png` },
    { name: "GoogleVPN", proxies: "defaultProxies", icon: `${ICON_BASE}/googlevpn.png` },
    { name: "Discord", proxies: "defaultProxies", icon: `${ICON_BASE}/discord.png` },
    { name: "Talkatone", proxies: "defaultProxies", icon: `${ICON_BASE}/talkatone.png` },
    { name: "LINE", proxies: "defaultProxies", icon: `${ICON_BASE}/line.png` },
    { name: "Signal", proxies: "defaultProxies", icon: `${ICON_BASE}/signal.png` },
    { name: "DisneyPlus", proxies: "defaultProxies", icon: `${ICON_BASE}/disney.png` },
    { name: "HBO", proxies: "defaultProxies", icon: `${ICON_BASE}/hbo.png` },
    { name: "Primevideo", proxies: "defaultProxies", icon: `${ICON_BASE}/primevideo.png` },
    { name: "AppleTV", proxies: "defaultProxies", icon: `${ICON_BASE}/appletv.png` },
    { name: "Apple", proxies: "defaultProxiesDirect", icon: `${ICON_BASE}/apple.png` },
    { name: "Emby", proxies: "defaultProxies", icon: `${ICON_BASE}/emby.png` },
    { name: "哔哩东南亚", proxies: "defaultProxies", icon: `${ICON_BASE}/bilibilit.png` },
    { name: "国内媒体", proxies: "defaultProxiesDirect", icon: `${ICON_BASE}/Chinese_media.png` },
    { name: "Global-TV", proxies: "defaultProxies", icon: `${ICON_BASE}/global_tv.png` },
    { name: "Global-Medial", proxies: "defaultProxies", icon: `${ICON_BASE}/global_media.png` },
    { name: "游戏平台", proxies: "defaultProxies", icon: `${ICON_BASE}/game.png` },
    { name: "Speedtest", proxies: "defaultProxies", icon: `${ICON_BASE}/speedtest.png` },
    { name: "PayPal", proxies: "defaultProxies", icon: `${ICON_BASE}/paypal.png` },
    { name: "Wise", proxies: "defaultProxies", icon: `${ICON_BASE}/wise.png` },
    { name: "国外电商", proxies: "defaultProxies", icon: `${ICON_BASE}/shopping.png` },
    { name: "STEAM", proxies: "defaultProxies", icon: `${ICON_BASE}/steam.png` },
    { name: "GitHub", proxies: "defaultProxies", icon: `${ICON_BASE}/github.png` },
    {
      name: "自建/家宽节点",
      type: "select",
      "include-all": true,
      filter: "(?i)自建|家宽|CF|The_house|private|home|hgc|HKT|HKBN|icable|Hinet|att",
      "exclude-filter": "(?i)Seattle",
      icon: `${ICON_BASE}/private_node.png`,
    },
    {
      name: "欧洲节点",
      type: "select",
      "include-all": true,
      filter: "(?i)英国|德国|法国|荷兰|意大利|西班牙|UK|DE|FR|NL|IT|ES|Germany|France|Europe|欧洲",
      icon: `${ICON_BASE}/European.png`,
    },
  ];

  const groupLines = EXTRA_GROUPS.map((g) => {
    if (g["include-all"]) {
      const excl = g["exclude-filter"] ? `\n            "exclude-filter": "${g["exclude-filter"]}",` : "";
      return `        {
            name: "${g.name}",
            icon: "${g.icon}",
            type: "select",
            "include-all": true,
            filter: "${g.filter}",${excl}
        },`;
    }
    const prox = g.proxies === "defaultProxiesDirect" ? "defaultProxiesDirect" : "defaultProxies";
    return `        {
            name: "${g.name}",
            icon: "${g.icon}",
            type: "select",
            proxies: ${prox},
        },`;
  }).join("\n");

  let out = convertJs;

  // 注入策略组
  out = out.replace(
    /(name: "广告拦截",[\s\S]*?proxies: \["REJECT", "REJECT-DROP", PROXY_GROUPS\.DIRECT\],\s*\},)\s*(lowCostNodes\.length > 0)/,
    `$1\n${groupLines}\n        $2`
  );

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
