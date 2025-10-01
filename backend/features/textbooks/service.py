import os
import json

PUBLIC_DIR = "./public"

def get_chapters_from_textbook(textbook_id: str):
    with open(os.path.join(PUBLIC_DIR, "textbooks", textbook_id, "metadata.json"), "r") as f:
        metadata = json.load(f)
    return metadata.get("chapters", [])