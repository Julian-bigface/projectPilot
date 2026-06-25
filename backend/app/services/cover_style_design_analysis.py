"""内容工厂 — 封面风格视觉解构（10 维 design_analysis）。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TypographyStrategy(BaseModel):
    title_ratio: str = ""
    weight: str = ""
    hierarchy_levels: str = ""


class LayoutSystem(BaseModel):
    structure: str = ""
    alignment: str = ""


class ColorStrategy(BaseModel):
    main_color: str = ""
    accent_color: str = ""
    background_note: str = ""


class CoverStyleDesignAnalysis(BaseModel):
    design_category: str = ""
    design_system: str = ""
    typography_strategy: TypographyStrategy = Field(default_factory=TypographyStrategy)
    layout_system: LayoutSystem = Field(default_factory=LayoutSystem)
    color_strategy: ColorStrategy = Field(default_factory=ColorStrategy)
    information_density: str = ""
    whitespace_usage: str = ""
    visual_components: list[str] = Field(default_factory=list)
    overall_mood: str = ""
    unique_memory_point: str = ""


def parse_design_analysis(raw: dict | None) -> CoverStyleDesignAnalysis | None:
    if not raw:
        return None
    try:
        return CoverStyleDesignAnalysis.model_validate(raw)
    except Exception:
        return None


def design_analysis_has_content(analysis: CoverStyleDesignAnalysis | None) -> bool:
    if analysis is None:
        return False
    if any(
        (
            analysis.design_category.strip(),
            analysis.design_system.strip(),
            analysis.information_density.strip(),
            analysis.whitespace_usage.strip(),
            analysis.overall_mood.strip(),
            analysis.unique_memory_point.strip(),
        )
    ):
        return True
    ts = analysis.typography_strategy
    if any((ts.title_ratio.strip(), ts.weight.strip(), ts.hierarchy_levels.strip())):
        return True
    ls = analysis.layout_system
    if any((ls.structure.strip(), ls.alignment.strip())):
        return True
    cs = analysis.color_strategy
    if any((cs.main_color.strip(), cs.accent_color.strip(), cs.background_note.strip())):
        return True
    return bool(analysis.visual_components)


def format_design_analysis_for_image_prompt(analysis: CoverStyleDesignAnalysis | None) -> str:
    """将 design_analysis 压缩为出图 prompt 段落（供 build_cover_prompt 使用）。"""
    if not design_analysis_has_content(analysis):
        return ""
    assert analysis is not None
    parts: list[str] = []
    if analysis.design_category.strip():
        parts.append(f"Design category: {analysis.design_category.strip()}.")
    if analysis.design_system.strip():
        parts.append(f"Design system: {analysis.design_system.strip()}.")
    ts = analysis.typography_strategy
    typo_bits = [
        bit
        for bit in (
            f"title ratio {ts.title_ratio.strip()}" if ts.title_ratio.strip() else "",
            f"weight {ts.weight.strip()}" if ts.weight.strip() else "",
            f"{ts.hierarchy_levels.strip()} hierarchy levels" if ts.hierarchy_levels.strip() else "",
        )
        if bit
    ]
    if typo_bits:
        parts.append("Typography: " + ", ".join(typo_bits) + ".")
    ls = analysis.layout_system
    layout_bits = [
        bit
        for bit in (
            ls.structure.strip() if ls.structure.strip() else "",
            f"alignment {ls.alignment.strip()}" if ls.alignment.strip() else "",
        )
        if bit
    ]
    if layout_bits:
        parts.append("Layout: " + ", ".join(layout_bits) + ".")
    cs = analysis.color_strategy
    color_bits = [
        bit
        for bit in (
            f"main {cs.main_color.strip()}" if cs.main_color.strip() else "",
            f"accent {cs.accent_color.strip()}" if cs.accent_color.strip() else "",
            cs.background_note.strip() if cs.background_note.strip() else "",
        )
        if bit
    ]
    if color_bits:
        parts.append("Color strategy: " + ", ".join(color_bits) + ".")
    if analysis.information_density.strip():
        parts.append(f"Information density: {analysis.information_density.strip()}.")
    if analysis.whitespace_usage.strip():
        parts.append(f"Whitespace: {analysis.whitespace_usage.strip()}.")
    if analysis.visual_components:
        components = ", ".join(c.strip() for c in analysis.visual_components if c.strip())
        if components:
            parts.append(f"Visual components: {components}.")
    if analysis.overall_mood.strip():
        parts.append(f"Mood: {analysis.overall_mood.strip()}.")
    if analysis.unique_memory_point.strip():
        parts.append(f"Distinctive cue: {analysis.unique_memory_point.strip()}.")
    return "Design analysis: " + " ".join(parts)
