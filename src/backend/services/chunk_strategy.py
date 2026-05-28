"""Chunk strategies for RAG text processing.

Provides multiple strategies for splitting text into chunks suitable for
vector storage and retrieval:
- ParagraphChunker: Split by Chinese paragraph boundaries (空行)
- SceneChunker: Split by scene markers (场景切换、章节标题等)
- ChapterChunker: Split by chapter boundaries
- SlidingWindowChunker: Sliding window with overlap

All chunkers return a list of Chunk dataclasses with content and metadata.
"""

from __future__ import annotations

import re
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Chunk:
    """A text chunk with metadata for RAG storage."""

    chunk_id: str
    content: str
    chunk_type: str = "scene"
    chapter_id: int = 0
    scene_index: int = 0
    parent_chunk_id: Optional[str] = None
    source_file: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    # SceneChunk extended fields (for entity-anchored retrieval)
    characters_present: List[str] = field(default_factory=list)
    timeline_position: int = 0  # chapter index
    emotional_tone: str = ""  # extracted emotion
    scene_type: str = ""  # "dialogue" | "action" | "introspection" | "description"

    @property
    def word_count(self) -> int:
        """Return approximate word count (Chinese chars + English words)."""
        chinese_chars = len(re.findall(r"[一-鿿]", self.content))
        english_words = len(re.findall(r"[A-Za-z]+", self.content))
        return chinese_chars + english_words

    @property
    def char_count(self) -> int:
        """Return character count."""
        return len(self.content)


class ChunkStrategy(ABC):
    """Abstract base class for chunk strategies."""

    @abstractmethod
    def chunk(self, text: str, metadata: dict) -> List[Chunk]:
        """Split text into chunks with metadata.

        Args:
            text: The input text to chunk.
            metadata: Dict containing:
                - chapter_id: Chapter ID
                - scene_index: Starting scene index (optional)
                - source_file: Source file path (optional)
                - parent_chunk_id: Parent chunk ID (optional)

        Returns:
            List of Chunk objects.
        """
        ...


class ParagraphChunker(ChunkStrategy):
    """Split text by Chinese paragraph boundaries (空行).

    Splits on double newlines (\\n\\n) or multiple consecutive newlines.
    Merges very short paragraphs (<50 chars) with the following paragraph.
    """

    MIN_PARAGRAPH_LEN: int = 50
    MAX_CHUNK_LEN: int = 800

    def chunk(self, text: str, metadata: dict) -> List[Chunk]:
        """Split by paragraph boundaries."""
        chunks: List[Chunk] = []
        chapter_id = metadata.get("chapter_id", 0)
        scene_index = metadata.get("scene_index", 0)
        source_file = metadata.get("source_file")
        parent_chunk_id = metadata.get("parent_chunk_id")

        # Split on double newlines or 3+ newlines
        paragraphs = re.split(r"\n{2,}|\n{3,}", text)

        current_content: List[str] = []
        current_len = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            para_len = len(para)

            # Merge short paragraphs with next one
            if para_len < self.MIN_PARAGRAPH_LEN:
                current_content.append(para)
                current_len += para_len
                continue

            # If adding this paragraph exceeds max, flush current
            if current_len + para_len > self.MAX_CHUNK_LEN and current_content:
                chunk = self._create_chunk(
                    chunks, current_content, chapter_id, scene_index,
                    source_file, parent_chunk_id, "paragraph"
                )
                chunks.append(chunk)
                scene_index += 1
                current_content = []
                current_len = 0

            current_content.append(para)
            current_len += para_len

        # Flush remaining content
        if current_content:
            chunk = self._create_chunk(
                chunks, current_content, chapter_id, scene_index,
                source_file, parent_chunk_id, "paragraph"
            )
            chunks.append(chunk)

        return chunks

    def _create_chunk(
        self,
        existing_chunks: List[Chunk],
        content_parts: List[str],
        chapter_id: int,
        scene_index: int,
        source_file: Optional[str],
        parent_chunk_id: Optional[str],
        chunk_type: str,
    ) -> Chunk:
        """Create a chunk from content parts."""
        content = "\n\n".join(content_parts)
        chunk_id = f"para_{uuid.uuid4().hex[:12]}"

        # Link to previous chunk in sequence
        prev_id = existing_chunks[-1].chunk_id if existing_chunks else None

        return Chunk(
            chunk_id=chunk_id,
            content=content,
            chunk_type=chunk_type,
            chapter_id=chapter_id,
            scene_index=scene_index,
            parent_chunk_id=parent_chunk_id or prev_id,
            source_file=source_file,
            metadata={"word_count": len(content), "parts": len(content_parts)},
        )


class SceneChunker(ChunkStrategy):
    """Split text by scene markers.

    Recognizes scene boundaries through:
    - Chapter/section headings (# 第X章, ## 第X节)
    - Scene transition markers (===, ---, ★★★)
    - Numbered sections (1. 2. 3.)
    - Time/location markers (【时间】, 【地点】)
    """

    SCENE_PATTERNS: List[re.Pattern] = [
        # Chapter headings: 第X章, 第一章, Chapter 1
        re.compile(r"^#{1,3}\s*[第章节]?\s*[　-〿\d\w一-鿿]+", re.MULTILINE),
        # Scene dividers: ===, ---, ★★★, ◆◆◆
        re.compile(r"^[=\-\*◆◇]{3,}\s*$", re.MULTILINE),
        # Numbered sections: 1. 2. (at line start)
        re.compile(r"^\d+\.\s+", re.MULTILINE),
        # Time/location markers: 【时间】 【地点】
        re.compile(r"^【[^】]+】\s*", re.MULTILINE),
        # Scene keywords
        re.compile(r"^场景[切换]?[：:]?\s*", re.MULTILINE),
        re.compile(r"^Scene\s*:?\s*", re.MULTILINE),
    ]

    TIME_LOCATION_PATTERN: re.Pattern = re.compile(r"【([^】]+)】")

    # Patterns for scene type detection
    DIALOGUE_PATTERN: re.Pattern = re.compile(r'[""「」].*?[""「」]|说道|问道|答道|喊道|笑道')
    ACTION_PATTERN: re.Pattern = re.compile(r'冲|跑|跳|打|杀|攻|挥|刺|劈|踢|拔|抽|扔|掷')
    INTROSPECTION_PATTERN: re.Pattern = re.compile(r'想到|心中|暗自|觉得|感到|明白|回忆|思考|盘算')

    def _detect_scene_type(self, text: str) -> str:
        """Detect scene type from text content."""
        dialogue_count = len(self.DIALOGUE_PATTERN.findall(text))
        action_count = len(self.ACTION_PATTERN.findall(text))
        introspection_count = len(self.INTROSPECTION_PATTERN.findall(text))

        total = dialogue_count + action_count + introspection_count
        if total == 0:
            return "description"

        if dialogue_count >= action_count and dialogue_count >= introspection_count:
            return "dialogue"
        elif action_count >= introspection_count:
            return "action"
        else:
            return "introspection"

    def _extract_characters(self, text: str, known_characters: List[str] = None) -> List[str]:
        """Extract character names mentioned in text."""
        characters = set()
        # Use known character names if provided
        if known_characters:
            for name in known_characters:
                if name in text:
                    characters.add(name)
        # Pattern-based extraction for Chinese names (2-4 char names)
        name_pattern = re.compile(r'(?:名叫|名为|是)([一-鿿]{2,4})')
        for match in name_pattern.finditer(text):
            characters.add(match.group(1))
        return sorted(characters)

    def chunk(self, text: str, metadata: dict) -> List[Chunk]:
        """Split by scene markers."""
        chunks: List[Chunk] = []
        chapter_id = metadata.get("chapter_id", 0)
        scene_index = metadata.get("scene_index", 0)
        source_file = metadata.get("source_file")
        parent_chunk_id = metadata.get("parent_chunk_id")
        known_characters = metadata.get("known_characters", [])

        # Find all scene boundary positions
        boundaries = [0]  # Start of text
        for line_num, line in enumerate(text.split("\n")):
            for pattern in self.SCENE_PATTERNS:
                if pattern.match(line.strip()):
                    boundaries.append(line_num)
                    break

        boundaries.append(len(text.split("\n")))  # End of text

        # Extract scenes
        lines = text.split("\n")
        for i in range(len(boundaries) - 1):
            start_line = boundaries[i]
            end_line = boundaries[i + 1]
            scene_text = "\n".join(lines[start_line:end_line]).strip()

            if not scene_text:
                continue

            # Extract time/location from first line
            time_loc = {}
            first_line = lines[start_line] if start_line < len(lines) else ""
            match = self.TIME_LOCATION_PATTERN.match(first_line)
            if match:
                time_loc["marker"] = match.group(1)

            # Check if starts with heading
            is_heading = bool(
                re.match(r"^#{1,3}", first_line.strip()) or
                re.match(r"^[第章]", first_line.strip())
            )

            chunk_id = f"scene_{uuid.uuid4().hex[:12]}"
            prev_id = chunks[-1].chunk_id if chunks else None

            # Extract SceneChunk metadata
            characters = self._extract_characters(scene_text, known_characters)
            scene_type = self._detect_scene_type(scene_text)

            chunk = Chunk(
                chunk_id=chunk_id,
                content=scene_text,
                chunk_type="heading" if is_heading else "scene",
                chapter_id=chapter_id,
                scene_index=scene_index,
                parent_chunk_id=parent_chunk_id or prev_id,
                source_file=source_file,
                metadata={**time_loc, "start_line": start_line},
                characters_present=characters,
                timeline_position=chapter_id,
                scene_type=scene_type,
            )
            chunks.append(chunk)
            scene_index += 1

        return chunks


class ChapterChunker(ChunkStrategy):
    """Split text by chapter boundaries.

    Identifies chapters through:
    - Heading patterns (# 第X章, ## Chapter X)
    - Explicit chapter markers (第X章, Chapter X)
    - Large text gaps (3+ blank lines)
    """

    CHAPTER_PATTERNS: List[re.Pattern] = [
        re.compile(r"^#{1,2}\s*[第章节]?\s*[　-〿\d\w一-鿿]+"),
        re.compile(r"^第[一二三四五六七八九十百千\d]+[章节]"),
        re.compile(r"^Chapter\s+\d+", re.IGNORECASE),
        re.compile(r"^CHAPTER\s+\d+"),
    ]

    def chunk(self, text: str, metadata: dict) -> List[Chunk]:
        """Split by chapter boundaries."""
        chunks: List[Chunk] = []
        chapter_id = metadata.get("chapter_id", 0)
        scene_index = metadata.get("scene_index", 0)
        source_file = metadata.get("source_file")
        parent_chunk_id = metadata.get("parent_chunk_id")

        lines = text.split("\n")
        chapter_boundaries = [0]
        current_chapter_start = 0

        for i, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue

            # Check for chapter heading
            is_chapter_heading = False
            for pattern in self.CHAPTER_PATTERNS:
                if pattern.match(line_stripped):
                    is_chapter_heading = True
                    break

            if is_chapter_heading and i > 0:
                chapter_boundaries.append(i)
                # Each chapter gets its own chunk
                chapter_text = "\n".join(lines[current_chapter_start:i]).strip()
                if chapter_text:
                    chunk = self._create_chapter_chunk(
                        chapter_id, scene_index, chapter_text,
                        source_file, parent_chunk_id
                    )
                    chunks.append(chunk)
                    scene_index += 1
                    chapter_id += 1  # Increment for next chapter
                current_chapter_start = i

        # Handle last chapter
        if current_chapter_start < len(lines):
            chapter_text = "\n".join(lines[current_chapter_start:]).strip()
            if chapter_text:
                chunk = self._create_chapter_chunk(
                    chapter_id, scene_index, chapter_text,
                    source_file, parent_chunk_id
                )
                chunks.append(chunk)

        return chunks

    def _create_chapter_chunk(
        self,
        chapter_id: int,
        scene_index: int,
        content: str,
        source_file: Optional[str],
        parent_chunk_id: Optional[str],
    ) -> Chunk:
        """Create a chapter chunk."""
        chunk_id = f"chapter_{uuid.uuid4().hex[:12]}"
        return Chunk(
            chunk_id=chunk_id,
            content=content,
            chunk_type="chapter",
            chapter_id=chapter_id,
            scene_index=scene_index,
            parent_chunk_id=parent_chunk_id,
            source_file=source_file,
            metadata={"is_chapter": True},
        )


class SlidingWindowChunker(ChunkStrategy):
    """Sliding window chunker with overlap.

    Creates chunks of fixed character/word length with configurable overlap.
    Best for maintaining context across chunk boundaries.
    """

    def __init__(
        self,
        window_size: int = 500,
        overlap: int = 50,
        chunk_size_type: str = "chars",
    ):
        """Initialize sliding window chunker.

        Args:
            window_size: Size of each window (in chars or words depending on chunk_size_type)
            overlap: Number of overlapping units between windows
            chunk_size_type: "chars" for character count, "words" for word count
        """
        self.window_size = window_size
        self.overlap = overlap
        self.chunk_size_type = chunk_size_type

    def chunk(self, text: str, metadata: dict) -> List[Chunk]:
        """Create sliding window chunks."""
        chunks: List[Chunk] = []
        chapter_id = metadata.get("chapter_id", 0)
        scene_index = metadata.get("scene_index", 0)
        source_file = metadata.get("source_file")
        parent_chunk_id = metadata.get("parent_chunk_id")

        if not text:
            return chunks

        # Calculate step size
        step = self.window_size - self.overlap
        if step <= 0:
            step = self.window_size // 2

        if self.chunk_size_type == "words":
            # Split by words for word-based windows
            words = text.split()
            window_idx = 0
            start_idx = 0

            while start_idx < len(words):
                end_idx = min(start_idx + self.window_size, len(words))
                window_words = words[start_idx:end_idx]
                content = " ".join(window_words)

                if len(content.strip()) < 50:
                    start_idx += step
                    continue

                chunk_id = f"slide_{uuid.uuid4().hex[:12]}"
                prev_id = chunks[-1].chunk_id if chunks else None

                chunk = Chunk(
                    chunk_id=chunk_id,
                    content=content,
                    chunk_type="sliding_window",
                    chapter_id=chapter_id,
                    scene_index=scene_index,
                    parent_chunk_id=parent_chunk_id or prev_id,
                    source_file=source_file,
                    metadata={
                        "window_idx": window_idx,
                        "start_word": start_idx,
                        "end_word": end_idx,
                    },
                )
                chunks.append(chunk)
                scene_index += 1
                window_idx += 1
                start_idx += step
        else:
            # Character-based windows
            start_idx = 0
            window_idx = 0

            while start_idx < len(text):
                end_idx = min(start_idx + self.window_size, len(text))
                content = text[start_idx:end_idx]

                # Try to break at word boundary (space or Chinese punctuation)
                if end_idx < len(text):
                    # Look for good break point in last 20 chars
                    search_start = max(start_idx, end_idx - 20)
                    for i in range(end_idx - 1, search_start, -1):
                        char = text[i]
                        if char in " \n\t，。！？；：" "।।":
                            end_idx = i + 1
                            content = text[start_idx:end_idx].strip()
                            break

                if len(content.strip()) < 50:
                    start_idx += step
                    continue

                chunk_id = f"slide_{uuid.uuid4().hex[:12]}"
                prev_id = chunks[-1].chunk_id if chunks else None

                chunk = Chunk(
                    chunk_id=chunk_id,
                    content=content,
                    chunk_type="sliding_window",
                    chapter_id=chapter_id,
                    scene_index=scene_index,
                    parent_chunk_id=parent_chunk_id or prev_id,
                    source_file=source_file,
                    metadata={
                        "window_idx": window_idx,
                        "start_char": start_idx,
                        "end_char": end_idx,
                    },
                )
                chunks.append(chunk)
                scene_index += 1
                window_idx += 1
                start_idx += step

        return chunks


# Factory function for easy access
def create_chunker(
    strategy: str = "paragraph",
    **kwargs,
) -> ChunkStrategy:
    """Create a chunker by name.

    Args:
        strategy: One of "paragraph", "scene", "chapter", "sliding_window"
        **kwargs: Additional arguments passed to the chunker constructor

    Returns:
        ChunkStrategy instance
    """
    chunkers = {
        "paragraph": ParagraphChunker,
        "scene": SceneChunker,
        "chapter": ChapterChunker,
        "sliding_window": SlidingWindowChunker,
        "sliding": SlidingWindowChunker,
    }

    chunker_class = chunkers.get(strategy.lower())
    if not chunker_class:
        raise ValueError(f"Unknown chunker strategy: {strategy}")

    return chunker_class(**kwargs)
