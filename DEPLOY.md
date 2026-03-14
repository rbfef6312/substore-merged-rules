# 部署到 GitHub 步骤

按以下步骤将本项目上传到你的 GitHub，即可获得可引用的链接。

## 方法一：网页上传（最简单）

1. 打开 https://github.com/new
2. 仓库名填：`substore-merged-rules`
3. 选择 Public，点击 **Create repository**
4. 在新建的仓库页面，点击 **uploading an existing file**
5. 将本文件夹 **内的文件和子文件夹** 拖入（注意：把 .github、scripts 等整个拖进去，不要只拖 substore-merged-rules 文件夹本身，否则路径会错）：
   - 整个 `.github` 文件夹（内含 workflows/merge-rules.yml）
   - 整个 `scripts` 文件夹（内含 merge.js）
   - `merged-convert.js`
   - `package.json`
   - `README.md`
   - `package-lock.json`（如有）
   - 不要包含 `node_modules`
6. 点击 **Commit changes**

## 方法二：命令行

```bash
cd "C:\Users\Administrator\Desktop\规则 (2)\substore-merged-rules"

git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/substore-merged-rules.git
git push -u origin main
```

## 获取引用链接

部署完成后，你的引用链接为：

```
https://raw.githubusercontent.com/你的用户名/substore-merged-rules/main/merged-convert.js
```

在 Substore 中创建 Mihomo 配置 → 来源选择组合订阅 → 添加脚本 → 填入上述链接。

## 自动更新

- 每天 UTC 0:00（北京时间 8:00）自动拉取两位作者最新规则并合并
- 或手动：仓库 → Actions → 自动合并规则 → Run workflow
