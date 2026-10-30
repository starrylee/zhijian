# 与 requirements.txt 中 playwright==1.49.1 严格同版本，浏览器已内置，运行期无需出网
# 该镜像为多架构镜像（linux/amd64 + linux/arm64），构建时按 --platform 自动取用
FROM mcr.microsoft.com/playwright/python:v1.49.1-noble

WORKDIR /app

# 先装依赖（利用层缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 再拷代码
COPY behave.ini environment.py pyproject.toml ./
COPY core/ core/
COPY factories/ factories/
COPY features/ features/
COPY pages/ pages/
COPY services/ services/
COPY steps/ steps/

# reports 目录运行时挂载，不烧进镜像
ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["behave"]
