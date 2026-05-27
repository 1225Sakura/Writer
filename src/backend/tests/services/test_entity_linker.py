"""Tests for EntityLinker - entity disambiguation, alias management, similarity."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.entity_linker import (
    EntityLinker,
    DisambiguationResult,
    EntityAlias,
)


@pytest.fixture
def mock_db():
    """Create a mock AsyncSession."""
    return MagicMock()


@pytest.fixture
def linker(mock_db):
    """Create an EntityLinker with mocked DB."""
    return EntityLinker(db=mock_db)


# =============================================================================
# Confidence evaluation
# =============================================================================

class TestConfidenceEvaluation:
    """Test confidence threshold evaluation."""

    def test_high_confidence_auto_adopts(self, linker):
        """High confidence (>= 0.85) auto-adopts."""
        action, adopt, warning = linker.evaluate_confidence(0.95)
        assert action == "auto"
        assert adopt is True
        assert warning is None

    def test_medium_confidence_warns(self, linker):
        """Medium confidence (0.60-0.85) warns but adopts."""
        action, adopt, warning = linker.evaluate_confidence(0.70)
        assert action == "warn"
        assert adopt is True
        assert warning is not None

    def test_low_confidence_needs_manual(self, linker):
        """Low confidence (< 0.60) needs manual review."""
        action, adopt, warning = linker.evaluate_confidence(0.30)
        assert action == "manual"
        assert adopt is False
        assert warning is not None

    def test_exact_boundary_high(self, linker):
        """Exactly 0.85 is high confidence."""
        action, adopt, _ = linker.evaluate_confidence(0.85)
        assert action == "auto"
        assert adopt is True

    def test_exact_boundary_medium(self, linker):
        """Exactly 0.60 is medium confidence."""
        action, adopt, _ = linker.evaluate_confidence(0.60)
        assert action == "warn"
        assert adopt is True


# =============================================================================
# process_uncertain
# =============================================================================

class TestProcessUncertain:
    """Test uncertain match processing."""

    def test_high_confidence_adopted(self, linker):
        """High confidence uncertain match is adopted."""
        result = linker.process_uncertain(
            mention="张三",
            candidates=[{"id": 1, "name": "张三"}],
            suggested_id=1,
            confidence=0.95,
        )
        assert result.adopted is True
        assert result.entity_id == 1

    def test_low_confidence_not_adopted(self, linker):
        """Low confidence uncertain match is not adopted."""
        result = linker.process_uncertain(
            mention="张三",
            candidates=[{"id": 1, "name": "张三"}],
            suggested_id=1,
            confidence=0.30,
        )
        assert result.adopted is False
        assert result.entity_id is None

    def test_result_has_mention(self, linker):
        """Result stores the original mention."""
        result = linker.process_uncertain(
            mention="某人", candidates=[], confidence=0.5
        )
        assert result.mention == "某人"


# =============================================================================
# Alias extraction
# =============================================================================

class TestAliasExtraction:
    """Test alias extraction from description field."""

    def test_extract_aliases_from_description(self, linker):
        """Aliases are extracted from description JSON tag."""
        entity = MagicMock()
        entity.description = '一些描述\n<!--aliases:["别名1","别名2"]-->'
        aliases = linker._extract_aliases(entity)
        assert aliases == ["别名1", "别名2"]

    def test_extract_aliases_empty_description(self, linker):
        """Empty description returns empty list."""
        entity = MagicMock()
        entity.description = ""
        aliases = linker._extract_aliases(entity)
        assert aliases == []

    def test_extract_aliases_none_description(self, linker):
        """None description returns empty list."""
        entity = MagicMock()
        entity.description = None
        aliases = linker._extract_aliases(entity)
        assert aliases == []

    def test_extract_aliases_no_tag(self, linker):
        """Description without alias tag returns empty list."""
        entity = MagicMock()
        entity.description = "普通描述，没有别名标记。"
        aliases = linker._extract_aliases(entity)
        assert aliases == []

    def test_extract_aliases_invalid_json(self, linker):
        """Invalid JSON in alias tag returns empty list."""
        entity = MagicMock()
        entity.description = '<!--aliases:not valid json-->'
        aliases = linker._extract_aliases(entity)
        assert aliases == []


# =============================================================================
# Alias writing
# =============================================================================

class TestAliasWriting:
    """Test alias writing to description field."""

    def test_write_aliases_to_empty_description(self, linker):
        """Aliases are written to empty description."""
        entity = MagicMock()
        entity.description = ""
        linker._write_aliases(entity, ["a", "b"])
        written = entity.description
        assert "aliases:" in written
        assert '"a"' in written

    def test_write_aliases_to_existing_description(self, linker):
        """Aliases are appended to existing description."""
        entity = MagicMock()
        entity.description = "已有的描述内容"
        linker._write_aliases(entity, ["新别名"])
        written = entity.description
        assert "已有的描述内容" in written
        assert "新别名" in written

    def test_write_aliases_replaces_old(self, linker):
        """Writing aliases replaces old alias tags."""
        entity = MagicMock()
        entity.description = '描述\n<!--aliases:["旧别名"]-->'
        linker._write_aliases(entity, ["新别名"])
        written = entity.description
        assert "旧别名" not in written
        assert "新别名" in written


# =============================================================================
# Attribute extraction
# =============================================================================

class TestAttributeExtraction:
    """Test attribute extraction for similarity calculation."""

    def test_extract_character_attrs(self, linker):
        """Character attributes are extracted."""
        entity = MagicMock()
        entity.gender = "男"
        entity.personality = "冷酷"
        entity.cultivation_realm = "元婴"
        entity.tier = "main"
        attrs = linker._extract_attrs(entity, "character")
        assert attrs["gender"] == "男"
        assert attrs["personality"] == "冷酷"

    def test_extract_skips_none_values(self, linker):
        """None attribute values are skipped."""
        entity = MagicMock()
        entity.gender = None
        entity.personality = ""
        entity.cultivation_realm = "元婴"
        entity.tier = None
        attrs = linker._extract_attrs(entity, "character")
        assert "gender" not in attrs
        assert "personality" not in attrs
        assert "cultivation_realm" in attrs


# =============================================================================
# Register alias (mocked DB)
# =============================================================================

class TestRegisterAlias:
    """Test alias registration with mocked DB."""

    @pytest.mark.asyncio
    async def test_register_alias_invalid_type(self, linker):
        """Invalid entity type returns False."""
        result = await linker.register_alias(1, "invalid_type", "alias")
        assert result is False

    @pytest.mark.asyncio
    async def test_register_alias_empty_alias(self, linker):
        """Empty alias returns False."""
        result = await linker.register_alias(1, "character", "")
        assert result is False

    @pytest.mark.asyncio
    async def test_register_alias_zero_id(self, linker):
        """Zero entity ID returns False."""
        result = await linker.register_alias(0, "character", "alias")
        assert result is False


# =============================================================================
# Lookup alias (mocked DB)
# =============================================================================

class TestLookupAlias:
    """Test alias lookup with mocked DB."""

    @pytest.mark.asyncio
    async def test_lookup_alias_no_results(self, linker):
        """No matches returns None."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        linker.db.execute = AsyncMock(return_value=mock_result)

        result = await linker.lookup_alias("不存在的名字")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_all_aliases_invalid_type(self, linker):
        """Invalid entity type returns empty list."""
        result = await linker.get_all_aliases(1, "invalid_type")
        assert result == []


# =============================================================================
# Similarity
# =============================================================================

class TestSimilarity:
    """Test entity similarity computation."""

    @pytest.mark.asyncio
    async def test_similarity_invalid_type_returns_zero(self, linker):
        """Invalid entity types return 0.0."""
        score = await linker.compute_similarity(1, "invalid", 2, "character")
        assert score == 0.0

    @pytest.mark.asyncio
    async def test_similarity_entity_not_found(self, linker):
        """Missing entity returns 0.0."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        linker.db.execute = AsyncMock(return_value=mock_result)

        score = await linker.compute_similarity(999, "character", 1, "character")
        assert score == 0.0


# =============================================================================
# find_potential_duplicates
# =============================================================================

class TestFindDuplicates:
    """Test duplicate detection."""

    @pytest.mark.asyncio
    async def test_find_duplicates_invalid_type(self, linker):
        """Invalid entity type returns empty list."""
        result = await linker.find_potential_duplicates("invalid_type")
        assert result == []


# =============================================================================
# Batch processing
# =============================================================================

class TestBatchProcessing:
    """Test batch processing of extraction results."""

    @pytest.mark.asyncio
    async def test_process_extraction_result_empty(self, linker):
        """Empty uncertain items returns empty results."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        linker.db.execute = AsyncMock(return_value=mock_result)

        results, warnings = await linker.process_extraction_result([])
        assert results == []
        assert warnings == []
