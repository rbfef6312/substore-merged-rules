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

// convert.js 已有的策略组，不重复注入
const CONVERT_GROUPS = new Set([
  "选择代理", "直连", "广告拦截", "静态资源", "AI", "Crypto", "Google", "Microsoft",
  "YouTube", "Bilibili", "Bahamut", "Netflix", "TikTok", "Spotify", "E-Hentai",
  "Telegram", "Truth Social", "OneDrive", "PikPak", "搜狗输入法", "GLOBAL",
  "手动选择", "故障转移", "落地节点", "前置代理", "低倍率节点",
]);
// 规则中 configfull 组名 -> 实际组名（自建/家宽节点 -> 自建家宽节点）
const RULE_GROUP_NORMALIZE = { "自建/家宽节点": "自建家宽节点" };

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

  // 2. 额外规则（使用注入后的策略组名）
  const extraRules = [];
  for (const r of rules) {
    const parts = r.split(",").map((s) => s.trim());
    if (parts.length < 3 || parts[0] !== "RULE-SET") continue;
    const [, provider, group] = parts;
    const safeProvider = safeProviderName(provider);
    const noResolve = parts.includes("no-resolve") ? ",no-resolve" : "";
    const groupName = RULE_GROUP_NORMALIZE[group] || group;
    if (!CONVERT_PROVIDERS.has(provider) && rp[provider]) {
      extraRules.push(`\`RULE-SET,${safeProvider},${groupName}${noResolve}\``);
    }
  }

  // 3. 解析 configfull 策略组，注入 convert 中不存在的
  const proxyGroups = config["proxy-groups"] || [];
  const iconBase = "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev";
  const iconMap = {
    select: `${iconBase}/select.png`, youtube: `${iconBase}/youtube.png`, fcm: `${iconBase}/fcm.png`,
    googlevpn: `${iconBase}/googlevpn.png`, google: `${iconBase}/google.png`, meta: `${iconBase}/meta.png`,
    ai: `${iconBase}/ai.png`, github: `${iconBase}/github.png`, onedrive: `${iconBase}/onedrive.png`,
    microsoft: `${iconBase}/microsoft.png`, telegram: `${iconBase}/telegram.png`, discord: `${iconBase}/discord.png`,
    talkatone: `${iconBase}/talkatone.png`, line: `${iconBase}/line.png`, signal: `${iconBase}/signal.png`,
    tiktok: `${iconBase}/tiktok.png`, netflix: `${iconBase}/netflix.png`, disney: `${iconBase}/disney.png`,
    hbo: `${iconBase}/hbo.png`, primevideo: `${iconBase}/primevideo.png`, appletv: `${iconBase}/appletv.png`,
    apple: `${iconBase}/apple.png`, emby: `${iconBase}/emby.png`, bilibili: `${iconBase}/bilibili.png`,
    bilibilit: `${iconBase}/bilibilit.png`, bahamut: `${iconBase}/bahamut.png`, spotify: `${iconBase}/spotify.png`,
    Chinese_media: `${iconBase}/Chinese_media.png`, global_tv: `${iconBase}/global_tv.png`,
    global_media: `${iconBase}/global_media.png`, game: `${iconBase}/game.png`, speedtest: `${iconBase}/speedtest.png`,
    paypal: `${iconBase}/paypal.png`, wise: `${iconBase}/wise.png`, shopping: `${iconBase}/shopping.png`,
    steam: `${iconBase}/steam.png`, direct: `${iconBase}/direct.png`, block: `${iconBase}/block.png`,
    final: `${iconBase}/final.png`, private_node: `${iconBase}/private_node.png`,
  };
  const selectIcon = (name) => iconMap[name?.toLowerCase?.()?.replace(/[- ]/g, "_")?.replace("哔哩东南亚", "bilibilit")?.replace("国内媒体", "chinese_media")?.replace("global-tv", "global_tv")?.replace("global-medial", "global_media")?.replace("国外电商", "shopping")] || iconMap.select;
  const proxyFirstProxies = "[PROXY_GROUPS.SELECT, \"欧洲节点\", \"自建家宽节点\", PROXY_GROUPS.DIRECT]";
  const directFirstProxies = "[PROXY_GROUPS.DIRECT, PROXY_GROUPS.SELECT]";
  const includeAllProxies = "[PROXY_GROUPS.SELECT, \"欧洲节点\", \"自建家宽节点\", PROXY_GROUPS.DIRECT]";

  const extraGroupDefs = [];
  const nameToProxies = {};
  for (const g of proxyGroups) {
    const name = typeof g.name === "string" ? g.name.trim() : "";
    if (!name || CONVERT_GROUPS.has(name)) continue;
    const safeName = name.replace("/", ""); // 自建/家宽节点 -> 自建家宽节点
    if (safeName !== name && CONVERT_GROUPS.has(safeName)) continue;
    const displayName = safeName;
    if (nameToProxies[displayName]) continue;
    nameToProxies[displayName] = true;

    const icon = selectIcon(name);
    if (displayName === "欧洲节点") {
      extraGroupDefs.push(`        {
            name: "欧洲节点",
            icon: "https://pub-8feead0908f649a8b94397f152fb9cba.r2.dev/European.png",
            type: "select",
            "include-all": true,
            filter: "(?=.*(?i)(🇦🇱|🇦🇩|🇦🇹|🇧🇾|🇧🇪|🇧🇦|🇧🇬|🇭🇷|🇨🇾|🇨🇿|🇩🇰|🇪🇪|🇫🇮|🇫🇷|🇩🇪|🇬🇷|🇭🇺|🇮🇸|🇮🇪|🇮🇹|🇽🇰|🇱🇻|🇱🇮|🇱🇹|🇱🇺|🇲🇹|🇲🇩|🇲🇨|🇲🇪|🇳🇱|🇲🇰|🇳🇴|🇵🇱|🇵🇹|🇷🇴|🇷🇺|🇸🇲|🇷🇸|🇸🇰|🇸🇮|🇪🇸|🇸🇪|🇨🇭|🇹🇷|🇺🇦|🇬🇧|🇻🇦))",
            proxies: [PROXY_GROUPS.SELECT, PROXY_GROUPS.DIRECT],
        }`);
    } else if (displayName === "自建家宽节点") {
      extraGroupDefs.push(`        {
            name: "自建家宽节点",
            icon: "${iconBase}/private_node.png",
            type: "select",
            "include-all": true,
            filter: "(?=.*(?i)(自建|CF|The_house|private|home|家宽|hgc|HKT|HKBN|icable|Hinet|att))",
            "exclude-filter": "(?=.*(?i)(Seattle))",
            proxies: [PROXY_GROUPS.SELECT, PROXY_GROUPS.DIRECT],
        }`);
    } else {
      const isDirect = ["Apple", "哔哩哔哩", "国内媒体"].some((k) => displayName === k);
      const isIncludeAll = ["AI", "Emby", "哔哩东南亚", "Global-TV", "Global-Medial", "Speedtest", "STEAM"].includes(displayName);
      let proxies = proxyFirstProxies;
      if (isDirect) proxies = directFirstProxies;
      else if (displayName === "哔哩东南亚") proxies = "[PROXY_GROUPS.DIRECT, \"Bilibili\", PROXY_GROUPS.SELECT]";
      else if (isIncludeAll) proxies = `[PROXY_GROUPS.SELECT, "欧洲节点", "自建家宽节点", PROXY_GROUPS.DIRECT]`;
      if (displayName === "FCM") proxies = directFirstProxies;
      extraGroupDefs.push(`        {
            name: ${JSON.stringify(displayName)},
            icon: ${JSON.stringify(icon)},
            type: "select",
            proxies: ${proxies},
        }`);
    }
  }
  // 确保 欧洲节点、自建家宽节点 先注入
  const sorted = [];
  const priority = ["欧洲节点", "自建家宽节点"];
  for (const p of priority) if (nameToProxies[p]) {
    const idx = extraGroupDefs.findIndex((s) => s.includes(`name: "${p}"`));
    if (idx >= 0) { sorted.push(extraGroupDefs[idx]); extraGroupDefs.splice(idx, 1); }
  }
  const finalGroupDefs = [...sorted, ...extraGroupDefs];

  let out = convertJs;

  // 注入 rule-providers（注意 $1 已含尾部逗号，不要重复加）
  if (extraProviders.length) {
    out = out.replace(
      /(Crypto: \{[^}]+},)\s*\};/s,
      `$1\n${extraProviders.join(",\n")}\n};`
    );
  }

  // 注入策略组（在 广告拦截 后、lowCostNodes 前）
  if (finalGroupDefs.length) {
    out = out.replace(
      /(name: "广告拦截",[^}]+},\s*)(lowCostNodes\.length)/,
      `$1\n${finalGroupDefs.join(",\n")},\n        $2`
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
