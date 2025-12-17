import logging
from backend.features.textbooks.repo import find_textbook_by_id

logger = logging.getLogger(__name__)


async def get_chapter_text(textbook_id: str, chapter_id: str) -> str:
    """
    Return the chapter text for a textbook.
    """

    chapter_key = str(chapter_id)

    try:
        textbook = await find_textbook_by_id(textbook_id)
        if textbook and textbook.chapter_texts:
            return textbook.chapter_texts.get(chapter_key)
        else:
            print("No text was found for chapter ", chapter_id, "in textbook ", textbook_id)
            return "No text found for this chapter"
    except Exception as e:
        logger.error(f"Error getting chapter text for {textbook_id}/chapter{chapter_id}: {e}")
        return "No text found for this chapter"

