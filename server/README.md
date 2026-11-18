# 在线排行榜(可选)

游戏本身是纯静态的,所以"所有人一张榜"需要一个很小的后端。这里给的是一份 **Cloudflare Worker** 实现,免费额度足够用,数据存在 KV 里。

## 为什么不能纯前端

分数由浏览器上报,任何懂技术的人都能伪造请求。所以必须有服务端做:

- 分数和爆头数一致性校验(`score === headshots * 100`)
- 上限截断(超过 400 爆头直接拒绝)
- 名字长度/字符清洗
- 只允许你的站点跨域提交(`ALLOWED_ORIGIN`)

即便如此,这仍然是**弱防作弊**——真要严格就得上账号体系或 Turnstile 人机验证。

## 部署步骤

```bash
cd server
npm i -g wrangler        # 或者 npx wrangler
wrangler login
wrangler kv namespace create BOARD
# 把输出的 id 填进 wrangler.toml
wrangler deploy
```

部署完会得到一个地址,形如:

```
https://onlyheads-board.<你的子域>.workers.dev
```

## 打开前端开关

在项目根目录创建 `.env.production`:

```
VITE_BOARD_URL=https://onlyheads-board.<你的子域>.workers.dev
```

然后重新构建并部署:

```bash
deploy.bat
```

菜单里的 **GLOBAL** 区块就会开始拉取线上榜单,每局结束也会自动提交。

## 不配置会怎样

- `VITE_BOARD_URL` 没设 → 在线榜功能完全关闭,界面不显示
- 本地排行榜不受影响,照常工作

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/scores` | 返回前 50 名 |
| POST | `/scores` | 提交 `{ name, score, tier, headshots, at }` |
