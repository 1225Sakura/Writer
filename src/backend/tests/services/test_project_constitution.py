"""Tests for ProjectConstitution — creative vision and content rules."""

from backend.services.project_constitution import ProjectConstitution


class TestProjectConstitutionDefaults:
    """Test default state of ProjectConstitution."""

    def test_empty_constitution_returns_empty_string(self):
        """Empty constitution produces empty system prompt prefix."""
        c = ProjectConstitution()
        assert c.to_system_prompt_prefix() == ""

    def test_default_field_values(self):
        """All fields have correct defaults."""
        c = ProjectConstitution()
        assert c.creative_vision == ""
        assert c.tone == ""
        assert c.content_rules == []
        assert c.compliance == []
        assert c.themes == []
        assert c.style_directive == ""
        assert c.character_voice == {}


class TestProjectConstitutionPromptPrefix:
    """Test to_system_prompt_prefix output."""

    def test_creative_vision_only(self):
        """Only creative vision is included when set."""
        c = ProjectConstitution(creative_vision="An epic tale of redemption")
        result = c.to_system_prompt_prefix()
        assert "Creative Vision: An epic tale of redemption" in result

    def test_tone_only(self):
        """Only tone is included when set."""
        c = ProjectConstitution(tone="dark and brooding")
        result = c.to_system_prompt_prefix()
        assert "Tone: dark and brooding" in result

    def test_content_rules_joined(self):
        """Multiple content rules are joined with semicolons."""
        c = ProjectConstitution(content_rules=["no gore", "no profanity"])
        result = c.to_system_prompt_prefix()
        assert "Content Rules: no gore; no profanity" in result

    def test_compliance_joined(self):
        """Multiple compliance rules are joined with semicolons."""
        c = ProjectConstitution(compliance=["PG-13", "no real brands"])
        result = c.to_system_prompt_prefix()
        assert "Compliance: PG-13; no real brands" in result

    def test_themes_joined(self):
        """Multiple themes are joined with commas."""
        c = ProjectConstitution(themes=["redemption", "sacrifice", "love"])
        result = c.to_system_prompt_prefix()
        assert "Themes: redemption, sacrifice, love" in result

    def test_style_directive(self):
        """Style directive is included."""
        c = ProjectConstitution(style_directive="minimalist prose, short sentences")
        result = c.to_system_prompt_prefix()
        assert "Style: minimalist prose, short sentences" in result

    def test_character_voice(self):
        """Character voices are formatted as name: voice pairs."""
        c = ProjectConstitution(
            character_voice={
                "Hero": "confident and terse",
                "Villain": "flowery and menacing",
            }
        )
        result = c.to_system_prompt_prefix()
        assert "Character Voices:" in result
        assert "Hero: confident and terse" in result
        assert "Villain: flowery and menacing" in result

    def test_all_fields_populated(self):
        """All fields produce a multi-line prompt."""
        c = ProjectConstitution(
            creative_vision="Vision",
            tone="Tone",
            content_rules=["Rule1"],
            compliance=["Comp1"],
            themes=["Theme1"],
            style_directive="Style",
            character_voice={"Char": "Voice"},
        )
        result = c.to_system_prompt_prefix()
        lines = result.split("\n")
        assert len(lines) == 7


class TestProjectConstitutionSerialization:
    """Test to_dict / from_dict round-trip."""

    def test_to_dict_keys(self):
        """to_dict returns all expected keys."""
        c = ProjectConstitution()
        d = c.to_dict()
        expected_keys = {
            "creative_vision",
            "tone",
            "content_rules",
            "compliance",
            "themes",
            "style_directive",
            "character_voice",
        }
        assert set(d.keys()) == expected_keys

    def test_round_trip(self):
        """Constitution survives to_dict -> from_dict round-trip."""
        original = ProjectConstitution(
            creative_vision="Epic saga",
            tone="serious",
            content_rules=["rule A", "rule B"],
            compliance=["comp A"],
            themes=["theme1", "theme2"],
            style_directive="flowing prose",
            character_voice={"Alice": "warm", "Bob": "cold"},
        )
        restored = ProjectConstitution.from_dict(original.to_dict())
        assert restored.creative_vision == original.creative_vision
        assert restored.tone == original.tone
        assert restored.content_rules == original.content_rules
        assert restored.compliance == original.compliance
        assert restored.themes == original.themes
        assert restored.style_directive == original.style_directive
        assert restored.character_voice == original.character_voice

    def test_from_dict_with_missing_keys(self):
        """from_dict handles missing keys gracefully."""
        restored = ProjectConstitution.from_dict({})
        assert restored.creative_vision == ""
        assert restored.content_rules == []
        assert restored.character_voice == {}
