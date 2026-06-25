"""LLM JSON 提取工具测试。"""

from __future__ import annotations

import pytest

from app.services.llm.json_extract import extract_first_json_object
from app.services.llm.provider import LlmError


def test_extract_json_with_brace_inside_body_string() -> None:
    raw = (
        '{"title_options":["标题1"],"body":"支持 {变量} 与 } 符号","hashtags":["#开源"]}'
    )
    data = extract_first_json_object(raw)
    assert data["body"] == "支持 {变量} 与 } 符号"
    assert data["hashtags"] == ["#开源"]


def test_extract_json_from_markdown_fence() -> None:
    raw = """```json
{
  "title_options": ["A"],
  "body": "hello"
}
```"""
    data = extract_first_json_object(raw)
    assert data["body"] == "hello"


def test_extract_json_with_trailing_commas() -> None:
    raw = '{"title_options":["A",],"body":"x","hashtags":[],}'
    data = extract_first_json_object(raw)
    assert data["body"] == "x"


def test_extract_json_rejects_invalid_payload() -> None:
    with pytest.raises(LlmError, match="未找到 JSON"):
        extract_first_json_object("not json at all")


def test_extract_json_after_think_block() -> None:
    think_open = "<" + "think" + ">"
    think_close = "</" + "think" + ">"
    raw = (
        f"{think_open}分析配色…{think_close}\n"
        '{"name": "杂志风", "prompt_prefix": "1242x1660", '
        '"prompt_template": "Cover {project_name}", "negative_prompt": "bad"}'
    )
    data = extract_first_json_object(raw)
    assert data["name"] == "杂志风"


def test_extract_json_with_unquoted_keys() -> None:
    raw = '{name: "杂志风", prompt_prefix: "1242x1660", prompt_template: "x", negative_prompt: ""}'
    data = extract_first_json_object(raw)
    assert data["name"] == "杂志风"


def test_extract_json_with_single_quoted_python_dict() -> None:
    raw = "{'name': '杂志风', 'prompt_prefix': '1242x1660', 'prompt_template': 'x', 'negative_prompt': ''}"
    data = extract_first_json_object(raw)
    assert data["name"] == "杂志风"
