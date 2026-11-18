# 部署说明

## 自动部署(推荐,需要一次性授权)

`github-pages.yml` 是 GitHub Actions 工作流,推送到 main 后会自动构建并发布到 Pages。

因为推送工作流文件需要 `workflow` 权限,第一次要先授权:

```bash
gh auth refresh -s workflow
mkdir -p .github/workflows
git mv deploy/github-pages.yml .github/workflows/deploy.yml
git commit -m "ci: enable Pages deploy" && git push
```

然后在仓库 Settings → Pages → Source 选 **GitHub Actions**。

## 手动部署(现在用的方式)

双击根目录的 `deploy.bat`:它会把 `dist` 推到一个叫 `gh-pages` 的分支,Pages 直接从那个分支取文件。
