"""从 LLM 回复中提取并解析 JSON object（容忍 markdown 围栏与常见格式瑕疵）。"""

from __future__ import annotations

import json
import re

from app.services.llm.provider import LlmError

_THINK_BLOCK = re.compile(
    r"<\s*think(?:ing)?\s*>[\s\S]*?<\s*/\s*think(?:ing)?\s*>",
    re.IGNORECASE,
)
_REDACTED_BLOCK = re.compile(
    r"<\s*redacted_reasoning\s*>[\s\S]*?<\s*/\s*redacted_reasoning\s*>",
    re.IGNORECASE,
)


def strip_markdown_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def strip_reasoning_blocks(text: str) -> str:
    """移除 MiniMax 等模型在正文前附带的思考块。"""
    stripped = _THINK_BLOCK.sub("", text.strip())
    stripped = _REDACTED_BLOCK.sub("", stripped)
    return stripped.strip()


def repair_loose_json_keys(text: str) -> str:
    """将 `{name: "x"}` 这类未加引号的 key 修复为合法 JSON。"""
    return re.sub(
        r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:",
        r'\1"\2":',
        text,
    )


def repair_json_text(text: str) -> str:
    repaired = text.replace("\u201c", '"').replace("\u201d", '"')
    repaired = repaired.replace("\u2018", "'").replace("\u2019", "'")
    repaired = re.sub(r",\s*}", "}", repaired)
    repaired = re.sub(r",\s*]", "]", repaired)
    return repaired


def _parse_json_object_candidate(text: str) -> dict | None:
    attempts = (
        text,
        repair_json_text(text),
        repair_loose_json_keys(text),
        repair_loose_json_keys(repair_json_text(text)),
    )
    for candidate in attempts:
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
        try:
            import ast

            data = ast.literal_eval(candidate)
            if isinstance(data, dict):
                return data
        except (SyntaxError, ValueError):
            pass
    return None


def extract_first_json_object(text: str) -> dict:
    """从 LLM 回复中提取第一个完整 JSON object（字符串内花括号安全）。"""
    text = strip_reasoning_blocks(strip_markdown_fence(text.strip()))
    parsed = _parse_json_object_candidate(text)
    if parsed is not None:
        return parsed

    start = text.find("{")
    if start < 0:
        raise LlmError("LLM 返回中未找到 JSON 对象。")

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                snippet = text[start : i + 1]
                parsed = _parse_json_object_candidate(snippet)
                if parsed is not None:
                    return parsed
                try:
                    json.loads(snippet)
                except json.JSONDecodeError as err:
                    raise LlmError(f"LLM JSON 无效：{err}") from err
                raise LlmError("LLM JSON 根节点须为 object。")

    raise LlmError("LLM 返回 JSON 不完整（可能被截断）。")
