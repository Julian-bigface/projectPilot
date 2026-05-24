# API 契约（OpenAPI）

| 文件 | 说明 |
|------|------|
| [`openapi.json`](openapi.json) | 与当前 `backend` 中 FastAPI 应用 `app.openapi()` 一致的可提交快照。 |

## 更新时机

**只要修改了会改变 OpenAPI 的后端代码**（路由、路径、方法、Pydantic 模型/响应体等），在提交前必须重新生成并**随代码一同提交**本文件。

## 如何重新生成

在仓库**根目录**执行（需已 `cd backend` 并 `pip install -e ".[dev]"` 过，或确保能 `import app`）：

```powershell
python scripts/export_openapi.py
```

不启动 `uvicorn` 也可生成；生成结果应与运行中服务在 `GET /openapi.json` 下的内容一致（同一 `app` 对象）。

## 与运行中服务对账（可选）

启动后端后，可人工对比：

- 文件：[`contracts/openapi.json`](openapi.json)
- 服务：`http://127.0.0.1:8000/openapi.json`

两者应一致；若不一致，以**重新执行 `export_openapi.py` 后的 `contracts/openapi.json`** 为准提交。
