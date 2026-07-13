# 部署清单

## GitHub Pages

在仓库 Settings → Secrets and variables → Actions → Variables 中添加：

- `VITE_API_BASE_URL`：Cloudflare Worker 的公开 URL，例如 `https://scp-archive-contributor.example.workers.dev`

Pages 工作流会在 `main` 分支更新时构建并发布站点。

## Cloudflare Worker

1. 在 `worker/wrangler.toml` 中把 `database_id` 替换为真实的 D1 数据库 ID。
2. 在 GitHub Actions Secrets 中添加：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. 在 Cloudflare Worker Secrets/Vars 中配置：
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `SESSION_ENCRYPTION_KEY`
4. GitHub OAuth App 的 callback URL 必须指向：
   - `https://<worker-domain>/auth/callback`
5. GitHub Actions 会先执行 `worker/schema.sql`，再部署 Worker。

## 本地检查

```bash
npm ci
npm run validate:content
npm run build
```

如果本地使用编辑器，需要先提供 `VITE_API_BASE_URL`。不要把 OAuth secret、Cloudflare token 或 session key 写入仓库。