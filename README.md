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

### 环境安装指引

以下按工具逐一说明安装方式（macOS / Windows / Linux），已安装的可直接跳过，装完后可用[环境检查清单](#环境检查清单)统一验证。

#### Java

后端要求 **JDK 21**（`server/pom.xml` 指定 `java.version=21`），推荐 Temurin（Eclipse Adoptium）发行版。

```bash
# macOS（Homebrew）
brew install --cask temurin@21
# 让 JAVA_HOME 指向 21（写入 ~/.zshrc 后重开终端生效）
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 21)' >> ~/.zshrc
```

```bash
# macOS / Linux：SDKMAN（适合多版本共存）
curl -s "https://get.sdkman.io" | bash   # 安装后重开终端
sdk install java 21-tem
```

```powershell
# Windows
winget install --id EclipseAdoptium.Temurin.21.JDK
```

```bash
# Linux（Debian/Ubuntu）
sudo apt install openjdk-21-jdk
```

> Windows 也可从 [Adoptium 官网](https://adoptium.net/) 下载 `.msi` 安装包，安装时勾选 "Set JAVA_HOME"。

验证：`java -version` 输出 `21.x`。

#### mvn

后端构建要求 **Maven 3.6+**。

```bash
# macOS（Homebrew）
brew install maven
```

```bash
# macOS / Linux：SDKMAN
sdk install maven
```

```powershell
# Windows
winget install --id Apache.Maven
```

```bash
# Linux（Debian/Ubuntu）
sudo apt install maven
```

> Windows 手动安装：从[官网](https://maven.apache.org/download.cgi)下载二进制包解压，将 `bin` 目录加入 `PATH`。

验证：`mvn -version` 正常输出，且 **Java version 一行指向 21**（否则检查 `JAVA_HOME` 是否配置正确）。

#### node

前端要求 **Node.js ≥ 20.19**（Vite 8 要求），建议安装 **22 LTS**。

```bash
# macOS / Linux：nvm（推荐，方便切换版本）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# 重开终端后，安装并启用最新 LTS：
nvm install --lts
nvm use --lts
```

```bash
# macOS（Homebrew）
brew install node@22
```

```powershell
# Windows
winget install --id OpenJS.NodeJS.LTS
```

> Windows 也可从 [Node.js 官网](https://nodejs.org/) 下载 LTS 安装包。

验证：`node -v` 输出 ≥ `v20.19`。

#### pnpm

前端包管理要求 **pnpm 9+**（仓库使用 `pnpm-lock.yaml`），以下方式任选其一：

```bash
corepack enable              # 方式一：Node 自带（≥ 16.13），推荐
npm install -g pnpm          # 方式二：npm 全局安装
brew install pnpm            # 方式三：macOS（Homebrew）
```

> Windows 下运行 `corepack enable` 需要管理员权限的终端。

验证：`pnpm -v` 正常输出。

#### python3

自动化测试要求 **Python ≥ 3.10**。

```bash
# macOS（Homebrew；系统自带版本可能过旧）
brew install python@3.12
```

```powershell
# Windows
winget install --id Python.Python.3.12
```

```bash
# Linux（Debian/Ubuntu）
sudo apt install python3 python3-venv python3-pip
```

> - Windows 从 [Python 官网](https://www.python.org/downloads/) 下载安装包时，务必勾选 **Add python.exe to PATH**。
> - Ubuntu/Debian 中 `python3-venv` 必须单独安装（虚拟环境被拆成独立包），否则第 3 步的 `python3 -m venv` 会失败。

验证：`python3 --version` 输出 ≥ 3.10。

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
