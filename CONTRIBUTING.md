# 贡献 SCP 档案

欢迎提交原创档案。你可以：

1. 访问站点的 `/editor` 在线编辑器并使用 GitHub 登录。
2. 填写档案内容并提交，系统会自动创建分支和 Pull Request。
3. 或者 Fork 本仓库，直接修改 `content/archives/` 下的 JSON 文件并提交 PR。

所有档案都必须是原创内容或拥有明确的使用许可。维护者会检查内容质量、版权、JSON 格式和页面构建结果。PR 合并后，GitHub Actions 会自动发布到 GitHub Pages。

## 本地检查

```bash
npm ci
npm run validate:content
npm run build
```
