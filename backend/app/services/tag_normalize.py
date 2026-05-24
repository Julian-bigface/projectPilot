"""标签名称规范化（与 GitHub topic 同步、POST /tags 等共用）。"""


def normalize_tag_name(name: str) -> str:
    return " ".join(name.strip().split())
