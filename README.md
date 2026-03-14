# Substore 合并规则

自动合并 [powerfullz/override-rules](https://github.com/powerfullz/override-rules) 的 convert.js 与 [Lanlan13-14/Rules](https://github.com/Lanlan13-14/Rules) 的 configfull.yaml，**保留 convert.js 的 Telegram 策略组**。

## 引用链接

在 Substore 中创建 Mihomo 配置时，将「脚本」设置为以下链接：

```
https://raw.githubusercontent.com/YOUR_USERNAME/substore-merged-rules/main/merged-convert.js
```

将 `YOUR_USERNAME` 替换为你的 GitHub 用户名。

## 特性

- 像 convert.js 一样直接引用，**无需手动填写机场订阅地址**（在 Substore 订阅里配置即可）
- 保留 powerfullz convert.js 的 **Telegram 策略组**
- 融合 Lanlan13-14 configfull 的额外规则与策略组（Discord、LINE、Meta、DisneyPlus 等）
- 每日自动从两位作者仓库拉取最新规则并合并
- 支持手动触发更新（Actions → 自动合并规则 → Run workflow）

## 部署步骤

1. 点击右上角 **Fork** 本仓库到你的 GitHub 账号
2. 首次运行：进入 **Actions** → 选择「自动合并规则」→ **Run workflow** 生成 `merged-convert.js`
3. 在 Substore 中引用：`https://raw.githubusercontent.com/你的用户名/substore-merged-rules/main/merged-convert.js`

## 来源

- convert.js: [powerfullz/override-rules](https://github.com/powerfullz/override-rules)
- configfull.yaml: [Lanlan13-14/Rules](https://github.com/Lanlan13-14/Rules)
