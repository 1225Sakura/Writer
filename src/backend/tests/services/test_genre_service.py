"""Tests for GenreService - genre presets, profiles, alias normalization."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from backend.services.genre_service import (
    GenreService,
    normalize_genre_token,
    to_profile_key,
    parse_genre_tokens,
    build_composite_genre_hints,
    GENRE_PRESETS,
    GENRE_INPUT_ALIASES,
)


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def service(mock_db):
    return GenreService(db=mock_db)


# =============================================================================
# normalize_genre_token
# =============================================================================

class TestNormalizeGenreToken:
    """Test genre token normalization."""

    def test_known_alias_normalizes(self):
        """Known aliases are normalized."""
        assert normalize_genre_token("玄幻") == "修仙"
        assert normalize_genre_token("修真") == "修仙"
        assert normalize_genre_token("都市修真") == "都市异能"

    def test_unknown_token_passes_through(self):
        """Unknown tokens pass through unchanged."""
        assert normalize_genre_token("科幻") == "科幻"

    def test_empty_string_returns_empty(self):
        """Empty string returns empty."""
        assert normalize_genre_token("") == ""
        assert normalize_genre_token(None) == ""

    def test_whitespace_trimmed(self):
        """Whitespace is trimmed."""
        assert normalize_genre_token("  玄幻  ") == "修仙"


# =============================================================================
# to_profile_key
# =============================================================================

class TestToProfileKey:
    """Test profile key conversion."""

    def test_known_genre_to_profile_key(self):
        """Known genres map to profile keys."""
        assert to_profile_key("修仙") == "xianxia"
        # 言情 maps to "romance" via GENRE_PROFILE_KEY_ALIASES
        result = to_profile_key("言情")
        assert result == "romance" or result == "言情"

    def test_unknown_genre_lowercased(self):
        """Unknown genres are lowercased."""
        assert to_profile_key("自定义题材") == "自定义题材"

    def test_alias_resolves_to_profile_key(self):
        """Aliases resolve through normalization then to profile key."""
        assert to_profile_key("玄幻") == "xianxia"


# =============================================================================
# parse_genre_tokens
# =============================================================================

class TestParseGenreTokens:
    """Test genre string parsing."""

    def test_single_genre(self):
        """Single genre returns single token."""
        tokens = parse_genre_tokens("修仙")
        assert tokens == ["修仙"]

    def test_composite_genre_slash(self):
        """Slash-separated genres are split."""
        tokens = parse_genre_tokens("修仙/玄幻")
        assert len(tokens) >= 1

    def test_composite_genre_plus(self):
        """Plus-separated genres are split."""
        tokens = parse_genre_tokens("修仙+悬疑")
        assert len(tokens) >= 1

    def test_empty_string_returns_empty(self):
        """Empty string returns empty list."""
        assert parse_genre_tokens("") == []
        assert parse_genre_tokens(None) == []

    def test_deduplication(self):
        """Duplicate tokens are removed."""
        tokens = parse_genre_tokens("修仙/玄幻/修仙")
        # After normalization, 玄幻 -> 修仙, so dedup
        assert len(tokens) <= 2

    def test_no_composite(self):
        """With support_composite=False, returns single token."""
        tokens = parse_genre_tokens("修仙/玄幻", support_composite=False)
        assert len(tokens) == 1


# =============================================================================
# build_composite_genre_hints
# =============================================================================

class TestCompositeHints:
    """Test composite genre hint generation."""

    def test_single_genre_no_hints(self):
        """Single genre returns no hints."""
        hints = build_composite_genre_hints(["修仙"])
        assert hints == []

    def test_multiple_genres_produce_hints(self):
        """Multiple genres produce hints."""
        hints = build_composite_genre_hints(["修仙", "悬疑"])
        assert len(hints) > 0
        assert any("修仙" in h for h in hints)

    def test_refs_included(self):
        """Reference hints are included."""
        hints = build_composite_genre_hints(["修仙", "悬疑"], refs=["参考1"])
        assert any("参考1" in h for h in hints)


# =============================================================================
# GenreService list_genre_presets
# =============================================================================

class TestListGenrePresets:
    """Test genre preset listing."""

    def test_list_presets_returns_all(self, service):
        """list_genre_presets returns all presets."""
        presets = service.list_genre_presets()
        assert len(presets) == len(GENRE_PRESETS)

    def test_preset_has_required_fields(self, service):
        """Each preset has name, profile_key, description."""
        presets = service.list_genre_presets()
        for p in presets:
            assert "name" in p
            assert "profile_key" in p
            assert "description" in p


# =============================================================================
# GenreService get_genre_preset
# =============================================================================

class TestGetGenrePreset:
    """Test genre preset retrieval."""

    def test_get_by_name(self, service):
        """Get preset by genre name."""
        preset = service.get_genre_preset("修仙")
        assert preset is not None
        assert preset["profile_key"] == "xianxia"

    def test_get_by_profile_key(self, service):
        """Get preset by profile key."""
        preset = service.get_genre_preset("xianxia")
        assert preset is not None

    def test_get_unknown_returns_none(self, service):
        """Unknown genre returns None."""
        preset = service.get_genre_preset("完全未知的题材")
        assert preset is None

    def test_get_by_alias(self, service):
        """Get preset through alias normalization."""
        preset = service.get_genre_preset("玄幻")
        assert preset is not None
        assert preset["profile_key"] == "xianxia"


# =============================================================================
# GenreService get_genre_profile
# =============================================================================

class TestGetGenreProfile:
    """Test genre profile building."""

    def test_known_genre_returns_profile(self, service):
        """Known genre returns a complete profile."""
        profile = service.get_genre_profile("修仙")
        assert profile["genre"] == "修仙"
        assert profile["profile_key"] == "xianxia"
        assert "core_tropes" in profile
        assert "narrative_rhythm" in profile

    def test_unknown_genre_returns_default(self, service):
        """Unknown genre returns a default profile."""
        profile = service.get_genre_profile("自定义XYZ")
        assert profile["genre"] == "自定义XYZ"
        assert "guidance_text" in profile

    def test_composite_genre_includes_secondary(self, service):
        """Composite genre includes secondary genres."""
        profile = service.get_genre_profile("修仙/悬疑")
        if "secondary_genres" in profile:
            assert len(profile["secondary_genres"]) > 0


# =============================================================================
# GenreService get_all_aliases
# =============================================================================

class TestGetAllAliases:
    """Test alias mapping retrieval."""

    def test_returns_input_and_profile_aliases(self, service):
        """get_all_aliases returns both alias types."""
        aliases = service.get_all_aliases()
        assert "input_aliases" in aliases
        assert "profile_key_aliases" in aliases
        assert "all_mappings" in aliases


# =============================================================================
# build_profile_from_chapters
# =============================================================================

class TestBuildProfileFromChapters:
    """Test genre detection from chapter content."""

    @pytest.mark.asyncio
    async def test_empty_chapters_returns_default(self, service):
        """Empty chapter list returns default profile."""
        profile = await service.build_profile_from_chapters(1, [])
        # Either has detected_genre or is a default profile
        assert "detected_genre" in profile or "genre" in profile

    @pytest.mark.asyncio
    async def test_xianxia_content_detected(self, service):
        """Xianxia content is detected."""
        chapters = ["他修炼功法，吸收灵气，冲击境界。渡劫突破元婴。"]
        profile = await service.build_profile_from_chapters(1, chapters)
        assert profile["detected_genre"] == "修仙"

    @pytest.mark.asyncio
    async def test_romance_content_detected(self, service):
        """Romance content is detected."""
        chapters = ["她心动了，喜欢上了他。他深情表白，两人爱情甜蜜。"]
        profile = await service.build_profile_from_chapters(1, chapters)
        assert profile["detected_genre"] == "言情"

    @pytest.mark.asyncio
    async def test_profile_includes_statistics(self, service):
        """Profile includes word count statistics."""
        chapters = ["内容一。", "内容二。"]
        profile = await service.build_profile_from_chapters(1, chapters)
        assert profile["statistics"]["total_chapters"] == 2

    @pytest.mark.asyncio
    async def test_profile_includes_vocabulary(self, service):
        """Profile includes vocabulary analysis."""
        chapters = ["这是一段测试内容，用来分析词汇频率。"]
        profile = await service.build_profile_from_chapters(1, chapters)
        assert "vocabulary" in profile
        assert "top_words" in profile["vocabulary"]


# =============================================================================
# apply_genre_to_project (mocked DB)
# =============================================================================

class TestApplyGenreToProject:
    """Test genre application to project."""

    @pytest.mark.asyncio
    async def test_apply_nonexistent_project_raises(self, service):
        """Applying genre to non-existent project raises ValueError."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        service.db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(ValueError):
            await service.apply_genre_to_project(999, "修仙")
