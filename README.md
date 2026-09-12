# knithub-workshop

织友（编织爱好者）专属 Web 站点 —— 项目建档 + 极简打卡 + 看板可视化 + 展示型广场，用来陪伴织友把想织的东西织完。

## 文档导航

- 产品全景（零基础友好）：[docs/织友web站点_产品介绍.md](./docs/织友web站点_产品介绍.md)
- 需求规格摘要（MVP）：[docs/织友web站点_需求规格摘要.md](./docs/织友web站点_需求规格摘要.md)
- MVP 技术方案：[docs/织友web站点_MVP技术方案.md](./docs/织友web站点_MVP技术方案.md)
- Feature 划分与依赖：[docs/织友web站点_Feature总览索引.md](./docs/织友web站点_Feature总览索引.md)

## 仓库结构

| 目录 | 说明 | 技术栈 |
|---|---|---|
| `server/` | 后端 API（端口 8080） | Java 21 · Spring Boot 3.5 · Maven · JSON 文件持久化 |
| `web-ui/` | 前端（端口 5174） | React 19 · TypeScript · Vite 8 · Tailwind v4 · pnpm |
| `test-automation/` | BDD 自动化测试 | Python · behave · Playwright |
| `docs/` | 产品与需求文档 | — |

---

## 开发者环境准备

### 前置要求

| 工具 | 版本要求 | 用于 |
|---|---|---|
| JDK | 21 | 后端（`pom.xml` 指定 `java.version=21`） |
| Maven | 3.6+ | 后端构建 |
| Node.js | ≥ 20.19（建议 22 LTS） | 前端（Vite 8 要求） |
| pnpm | 9+（任意现代版本即可） | 前端包管理（仓库使用 `pnpm-lock.yaml`） |
| Python | ≥ 3.10 | 自动化测试 |

> 无需安装任何数据库。后端使用 JSON 文件持久化（`server/data/`，首次启动自动创建），数据模型按 PG 兼容设计。

安装 pnpm（任选其一）：

```bash
corepack enable            # Node 自带，推荐
# 或
npm install -g pnpm
```

### 1. 启动后端（server/）

```bash
cd server
mvn spring-boot:run
```

- 服务地址：`http://localhost:8080`，API 前缀 `/api/v1`
- 数据文件：`server/data/`（首次启动自动创建，可直接打开查看数据）
- 健康检查：`curl http://localhost:8080/api/health`
- 运行后端测试：

```bash
cd server
mvn test
```

### 2. 启动前端（web-ui/）

```bash
cd web-ui
pnpm install
pnpm dev
```

- 访问地址：`http://localhost:5174`
- 联调无需任何 CORS 配置：开发服务器已将 `/api` 请求代理到 `http://localhost:8080`（见 `vite.config.ts`），**请先启动后端再启动前端**
- 端口 5174 为固定端口（`strictPort: true`），被占用时启动会直接失败，请先释放端口或通过 `PORT` 环境变量指定其他端口
- 其它命令：`pnpm build`（构建）、`pnpm format`（格式化）

### 3. 配置自动化测试（test-automation/）

```bash
cd test-automation
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium      # 安装浏览器内核
cp .env.example .env             # 按需修改配置（超时、浏览器、无头模式等）
```

运行测试（前置条件：后端 8080 与前端 5174 均已启动）：

```bash
behave                           # 全量运行（behave.ini 已配置 features 路径）
behave features/api              # 仅 API 测试（不依赖前端）
behave features/ui               # 仅 UI 测试
```

### 环境检查清单

克隆仓库后，按以下顺序验证环境是否就绪：

1. `java -version` → 输出 `21.x`
2. `mvn -version` → 正常输出且 Java 版本指向 21
3. `node -v` → ≥ 20.19
4. `pnpm -v` → 正常输出
5. `python3 --version` → ≥ 3.10
6. `curl http://localhost:8080/api/health` → 后端已启动
7. 浏览器打开 `http://localhost:5174` → 页面正常渲染

### 常见问题

| 现象 | 原因与处理 |
|---|---|
| 前端启动报端口占用 | 5174 被占用（固定端口）。`lsof -i :5174` 找到进程后释放，或 `PORT=5175 pnpm dev` |
| 页面请求接口 404 / 代理错误 | 后端未启动，先 `cd server && mvn spring-boot:run` |
| UI 测试浏览器启动失败 | 未安装浏览器内核，执行 `playwright install chromium` |
| `mvn` 编译报版本错误 | JDK 版本低于 21，检查 `JAVA_HOME` 指向 |
