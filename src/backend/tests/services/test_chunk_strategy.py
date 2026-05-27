"""Tests for chunk_strategy - paragraph, scene, chapter, sliding window chunkers."""

import re
import pytest
from backend.services.chunk_strategy import (
    Chunk,
    ChunkStrategy,
    ParagraphChunker,
    SceneChunker,
    ChapterChunker,
    SlidingWindowChunker,
    create_chunker,
)


# =============================================================================
# Chunk dataclass
# =============================================================================


class TestChunkDataclass:
    """Test Chunk dataclass properties."""

    def test_word_count_chinese(self):
        c = Chunk(chunk_id="c1", content="他修炼功法突破境界")
        assert c.word_count == 9  # 9 Chinese chars

    def test_word_count_english(self):
        c = Chunk(chunk_id="c1", content="hello world test")
        assert c.word_count == 3

    def test_word_count_mixed(self):
        c = Chunk(chunk_id="c1", content="修炼cultivation功法")
        # 4 Chinese chars (修,炼,功,法) + 1 English word (cultivation) = 5
        assert c.word_count == 5

    def test_word_count_empty(self):
        c = Chunk(chunk_id="c1", content="")
        assert c.word_count == 0

    def test_char_count(self):
        c = Chunk(chunk_id="c1", content="hello")
        assert c.char_count == 5

    def test_char_count_chinese(self):
        c = Chunk(chunk_id="c1", content="修炼功法")
        assert c.char_count == 4

    def test_char_count_empty(self):
        c = Chunk(chunk_id="c1", content="")
        assert c.char_count == 0

    def test_defaults(self):
        c = Chunk(chunk_id="c1", content="text")
        assert c.chunk_type == "scene"
        assert c.chapter_id == 0
        assert c.scene_index == 0
        assert c.parent_chunk_id is None
        assert c.source_file is None
        assert c.metadata == {}

    def test_metadata_default_factory(self):
        c1 = Chunk(chunk_id="c1", content="a")
        c2 = Chunk(chunk_id="c2", content="b")
        c1.metadata["key"] = "value"
        assert "key" not in c2.metadata  # separate instances


# =============================================================================
# ParagraphChunker
# =============================================================================


class TestParagraphChunker:
    """Test paragraph-based chunking."""

    def test_single_paragraph(self):
        chunker = ParagraphChunker()
        text = "这是一段足够长的测试文本内容，用来验证分段功能是否正常工作。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 1
        assert chunks[0].content.strip() == text

    def test_multiple_paragraphs_split(self):
        chunker = ParagraphChunker()
        text = (
            "第一段内容非常长，包含了很多文字用来测试分段功能。\n\n"
            "第二段内容也非常长，同样包含了很多文字用来测试分段。"
        )
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 1

    def test_short_paragraphs_merged(self):
        chunker = ParagraphChunker()
        # Both paragraphs are under MIN_PARAGRAPH_LEN (50 chars)
        text = "短段一。\n\n短段二。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) == 1
        assert "短段一" in chunks[0].content
        assert "短段二" in chunks[0].content

    def test_empty_text_returns_empty(self):
        chunker = ParagraphChunker()
        chunks = chunker.chunk("", {"chapter_id": 1})
        assert chunks == []

    def test_whitespace_only_returns_empty(self):
        chunker = ParagraphChunker()
        chunks = chunker.chunk("   \n\n   ", {"chapter_id": 1})
        assert chunks == []

    def test_metadata_fields_set(self):
        chunker = ParagraphChunker()
        text = "足够长的段落内容用来测试元数据字段是否正确设置到chunk对象上。"
        chunks = chunker.chunk(text, {
            "chapter_id": 5,
            "scene_index": 3,
            "source_file": "test.txt",
        })
        assert len(chunks) >= 1
        assert chunks[0].chapter_id == 5
        assert chunks[0].scene_index == 3
        assert chunks[0].source_file == "test.txt"
        assert chunks[0].chunk_type == "paragraph"

    def test_parent_chunk_id_from_metadata(self):
        chunker = ParagraphChunker()
        text = "足够长的段落内容用来测试parent_chunk_id是否正确传递。"
        chunks = chunker.chunk(text, {"chapter_id": 1, "parent_chunk_id": "parent_1"})
        assert chunks[0].parent_chunk_id == "parent_1"

    def test_parent_chunk_id_links_to_previous(self):
        chunker = ParagraphChunker()
        text = (
            "第一段内容很长用来测试链接功能是否正确实现到前一个chunk。\n\n"
            "第二段内容也很长用来测试链接功能是否正确实现到前一个chunk。"
        )
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if len(chunks) >= 2:
            assert chunks[1].parent_chunk_id == chunks[0].chunk_id

    def test_max_chunk_len_triggers_flush(self):
        chunker = ParagraphChunker()
        # Create a paragraph longer than MAX_CHUNK_LEN (800)
        long_para = "这" * 900
        text = f"{long_para}\n\n{long_para}"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 2

    def test_chunk_id_starts_with_para(self):
        chunker = ParagraphChunker()
        text = "足够长的段落内容用来验证chunk_id的前缀是否正确设置为para。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert chunks[0].chunk_id.startswith("para_")

    def test_metadata_word_count(self):
        chunker = ParagraphChunker()
        text = "足够长的段落内容用来验证metadata中word_count字段。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert "word_count" in chunks[0].metadata
        assert chunks[0].metadata["word_count"] > 0

    def test_metadata_parts_count(self):
        chunker = ParagraphChunker()
        text = "足够长的段落内容用来验证metadata中parts字段记录合并的段落数量。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert "parts" in chunks[0].metadata


# =============================================================================
# SceneChunker
# =============================================================================


class TestSceneChunker:
    """Test scene-marker-based chunking."""

    def test_single_scene(self):
        chunker = SceneChunker()
        text = "这是一段没有场景标记的普通文本内容。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 1

    def test_heading_marks_scene_boundary(self):
        chunker = SceneChunker()
        text = "# 第一章 开始\n内容一\n\n# 第二章 发展\n内容二"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 1

    def test_scene_divider_marks_boundary(self):
        chunker = SceneChunker()
        text = "场景一内容\n===\n场景二内容"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 1

    def test_time_location_marker(self):
        chunker = SceneChunker()
        text = "【时间】清晨\n张三起床。\n\n【地点】山上\n李四修炼。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        # Should extract time/location markers
        assert len(chunks) >= 1

    def test_heading_chunk_type(self):
        chunker = SceneChunker()
        text = "# 第一章\n这是一个很长的场景内容用来测试heading类型的标记是否正确。\n\n普通场景内容也很长用来测试scene类型的标记。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        # First chunk should be heading type if it starts with #
        has_heading = any(c.chunk_type == "heading" for c in chunks)
        has_scene = any(c.chunk_type == "scene" for c in chunks)
        assert has_heading or has_scene  # at least one type present

    def test_empty_text_returns_empty(self):
        chunker = SceneChunker()
        chunks = chunker.chunk("", {"chapter_id": 1})
        assert chunks == []

    def test_chunk_id_starts_with_scene(self):
        chunker = SceneChunker()
        text = "场景内容足够长用来验证chunk_id前缀。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if chunks:
            assert chunks[0].chunk_id.startswith("scene_")

    def test_metadata_start_line(self):
        chunker = SceneChunker()
        text = "场景一内容足够长用来验证start_line元数据。\n\n场景二内容足够长用来验证start_line元数据。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if chunks:
            assert "start_line" in chunks[0].metadata

    def test_numbered_section_boundary(self):
        chunker = SceneChunker()
        text = "1. 第一部分内容足够长测试编号场景边界。\n2. 第二部分内容足够长测试编号场景边界。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 1

    def test_scene_keyword_boundary(self):
        chunker = SceneChunker()
        text = "场景切换：张三出场\n足够长的内容用来测试场景关键字边界。\n\n场景：李四出场\n足够长的内容用来测试场景关键字边界。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 1

    def test_parent_chunk_id_links(self):
        chunker = SceneChunker()
        text = "场景一足够长的内容用来测试parent链接。\n\n场景二足够长的内容用来测试parent链接。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if len(chunks) >= 2:
            assert chunks[1].parent_chunk_id == chunks[0].chunk_id

    def test_star_divider(self):
        chunker = SceneChunker()
        text = "场景一\n★★★\n场景二"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 1


# =============================================================================
# ChapterChunker
# =============================================================================


class TestChapterChunker:
    """Test chapter-based chunking."""

    def test_single_chapter_no_heading(self):
        chunker = ChapterChunker()
        text = "这是一段没有章节标题的普通文本内容。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) == 1

    def test_chinese_chapter_heading(self):
        chunker = ChapterChunker()
        text = "第一章 开始\n内容一\n\n第二章 发展\n内容二"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 2

    def test_hash_heading(self):
        chunker = ChapterChunker()
        text = "# 第一章\n内容一\n\n# 第二章\n内容二"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 2

    def test_english_chapter_heading(self):
        chunker = ChapterChunker()
        text = "Chapter 1 Beginning\nContent one\n\nChapter 2 Development\nContent two"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 2

    def test_empty_text_returns_empty(self):
        chunker = ChapterChunker()
        chunks = chunker.chunk("", {"chapter_id": 1})
        assert chunks == []

    def test_chunk_type_is_chapter(self):
        chunker = ChapterChunker()
        text = "第一章\n足够长的章节内容用来验证chunk_type字段。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if chunks:
            assert chunks[0].chunk_type == "chapter"

    def test_chunk_id_starts_with_chapter(self):
        chunker = ChapterChunker()
        text = "第一章\n足够长的章节内容用来验证chunk_id前缀。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if chunks:
            assert chunks[0].chunk_id.startswith("chapter_")

    def test_metadata_is_chapter(self):
        chunker = ChapterChunker()
        text = "第一章\n足够长的章节内容用来验证is_chapter元数据。"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if chunks:
            assert chunks[0].metadata.get("is_chapter") is True

    def test_chapter_id_increments(self):
        chunker = ChapterChunker()
        text = "第一章 开始\n足够长的内容\n\n第二章 发展\n足够长的内容"
        chunks = chunker.chunk(text, {"chapter_id": 0})
        if len(chunks) >= 2:
            # Second chunk should have incremented chapter_id
            assert chunks[1].chapter_id > chunks[0].chapter_id

    def test_number_chapter_heading(self):
        chunker = ChapterChunker()
        text = "第一章\n内容一\n\n第一百章\n内容二"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 2

    def test_parent_chunk_id_from_metadata(self):
        chunker = ChapterChunker()
        text = "第一章\n足够长的章节内容。"
        chunks = chunker.chunk(text, {"chapter_id": 1, "parent_chunk_id": "parent_1"})
        if chunks:
            assert chunks[0].parent_chunk_id == "parent_1"


# =============================================================================
# SlidingWindowChunker
# =============================================================================


class TestSlidingWindowChunker:
    """Test sliding window chunking."""

    def test_char_based_basic(self):
        chunker = SlidingWindowChunker(window_size=100, overlap=20)
        text = "这" * 300
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 2

    def test_word_based_basic(self):
        chunker = SlidingWindowChunker(window_size=10, overlap=2, chunk_size_type="words")
        text = " ".join([f"word{i}" for i in range(30)])
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert len(chunks) >= 2

    def test_empty_text_returns_empty(self):
        chunker = SlidingWindowChunker()
        chunks = chunker.chunk("", {"chapter_id": 1})
        assert chunks == []

    def test_short_text_returns_empty(self):
        chunker = SlidingWindowChunker(window_size=500, overlap=50)
        text = "短文本"
        chunks = chunker.chunk(text, {"chapter_id": 1})
        assert chunks == []  # below 50-char minimum

    def test_overlap_creates_more_chunks(self):
        chunker_no_overlap = SlidingWindowChunker(window_size=100, overlap=0)
        chunker_with_overlap = SlidingWindowChunker(window_size=100, overlap=50)
        text = "这" * 500
        chunks_no = chunker_no_overlap.chunk(text, {"chapter_id": 1})
        chunks_with = chunker_with_overlap.chunk(text, {"chapter_id": 1})
        # With overlap, we should get more chunks
        assert len(chunks_with) >= len(chunks_no)

    def test_chunk_type_sliding_window(self):
        chunker = SlidingWindowChunker(window_size=100, overlap=10)
        text = "这" * 300
        chunks = chunker.chunk(text, {"chapter_id": 1})
        for c in chunks:
            assert c.chunk_type == "sliding_window"

    def test_chunk_id_starts_with_slide(self):
        chunker = SlidingWindowChunker(window_size=100, overlap=10)
        text = "这" * 300
        chunks = chunker.chunk(text, {"chapter_id": 1})
        for c in chunks:
            assert c.chunk_id.startswith("slide_")

    def test_metadata_window_idx(self):
        chunker = SlidingWindowChunker(window_size=100, overlap=10)
        text = "这" * 300
        chunks = chunker.chunk(text, {"chapter_id": 1})
        for i, c in enumerate(chunks):
            assert c.metadata["window_idx"] == i

    def test_word_based_metadata(self):
        chunker = SlidingWindowChunker(window_size=10, overlap=2, chunk_size_type="words")
        text = " ".join([f"word{i}" for i in range(30)])
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if chunks:
            assert "start_word" in chunks[0].metadata
            assert "end_word" in chunks[0].metadata

    def test_char_based_metadata(self):
        chunker = SlidingWindowChunker(window_size=100, overlap=10)
        text = "这" * 300
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if chunks:
            assert "start_char" in chunks[0].metadata
            assert "end_char" in chunks[0].metadata

    def test_overlap_greater_than_window_uses_half(self):
        """If overlap >= window_size, step = window_size // 2."""
        chunker = SlidingWindowChunker(window_size=100, overlap=200)
        text = "这" * 500
        chunks = chunker.chunk(text, {"chapter_id": 1})
        # Should still produce chunks (step = 50)
        assert len(chunks) >= 1

    def test_parent_chunk_id_links(self):
        chunker = SlidingWindowChunker(window_size=100, overlap=10)
        text = "这" * 300
        chunks = chunker.chunk(text, {"chapter_id": 1})
        if len(chunks) >= 2:
            assert chunks[1].parent_chunk_id == chunks[0].chunk_id

    def test_parent_chunk_id_from_metadata(self):
        chunker = SlidingWindowChunker(window_size=100, overlap=10)
        text = "这" * 300
        chunks = chunker.chunk(text, {"chapter_id": 1, "parent_chunk_id": "p1"})
        if chunks:
            assert chunks[0].parent_chunk_id == "p1"

    def test_word_based_short_content_skipped(self):
        chunker = SlidingWindowChunker(window_size=5, overlap=1, chunk_size_type="words")
        text = "a b c d e"  # only 5 words, content will be short
        chunks = chunker.chunk(text, {"chapter_id": 1})
        # Content < 50 chars is skipped
        assert chunks == []


# =============================================================================
# create_chunker factory
# =============================================================================


class TestCreateChunker:
    """Test the create_chunker factory function."""

    def test_create_paragraph(self):
        chunker = create_chunker("paragraph")
        assert isinstance(chunker, ParagraphChunker)

    def test_create_scene(self):
        chunker = create_chunker("scene")
        assert isinstance(chunker, SceneChunker)

    def test_create_chapter(self):
        chunker = create_chunker("chapter")
        assert isinstance(chunker, ChapterChunker)

    def test_create_sliding_window(self):
        chunker = create_chunker("sliding_window")
        assert isinstance(chunker, SlidingWindowChunker)

    def test_create_sliding_alias(self):
        chunker = create_chunker("sliding")
        assert isinstance(chunker, SlidingWindowChunker)

    def test_case_insensitive(self):
        chunker = create_chunker("Paragraph")
        assert isinstance(chunker, ParagraphChunker)

    def test_unknown_strategy_raises(self):
        with pytest.raises(ValueError, match="Unknown chunker strategy"):
            create_chunker("nonexistent")

    def test_kwargs_passed_to_sliding_window(self):
        chunker = create_chunker("sliding_window", window_size=200, overlap=30)
        assert chunker.window_size == 200
        assert chunker.overlap == 30

    def test_default_strategy_is_paragraph(self):
        chunker = create_chunker()
        assert isinstance(chunker, ParagraphChunker)
