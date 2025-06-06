from PyPDF2 import PdfReader

import os
import json
import re

def _getBookmarksPageNumbers(pdf):
    bookmarks = []
    def reviewBookmarks(bookmarks_list, indent=0):
        for b in bookmarks_list:
            if isinstance(b, list):
                reviewBookmarks(b, indent + 4)
            else:
                pg_num = pdf.get_destination_page_number(b) + 1  # page count starts from 0
                bookmarks.append((indent, b.title, pg_num))

    reviewBookmarks(pdf.outline)
    return bookmarks

def _initialize_ranges(bookmarks_json):
    for chapter in bookmarks_json:
        if not chapter.startswith("chapter "):  # Skip metadata like "chapter_num"
            continue
        
        sections = bookmarks_json[chapter]["sections"]
        last_page = bookmarks_json[chapter].get("last_page", None)
        
        for i in range(len(sections)):
            start_page = sections[i]["page_num"]
            
            if i + 1 < len(sections):
                end_page = sections[i + 1]["page_num"] - 1
            elif last_page:
                end_page = last_page
            else:
                end_page = start_page  # fallback if no info
            
            sections[i]["page_range"] = [start_page, end_page]

def initialize_bookmarks(pdf_path, filepath):
    """
    Creates a new bookmarks.json file from a PDF. It will overwrite any existing file.

    Args:
        pdf_path (str): Path to the PDF file
        filepath (str): Path to the bookmarks.json file

    Returns:
        None
    """
    if os.path.exists(filepath):
        os.remove(filepath)
        print(f"Removed outdated bookmarks file at {filepath}")
    
    print(f"Generating new bookmarks at {filepath}...")

    bookmarks = []
    
    with open(pdf_path, "rb") as f:
        pdf = PdfReader(f)
        bookmarks = _getBookmarksPageNumbers(pdf)

    # print(bookmarks)

    bookmarks_json = {}
    chapter_num = 0
    bookmarks_json["chapter_num"] = chapter_num

    seen = set()

    for b in bookmarks:
        # Filters repeat bookmarks
        title = b[1]
        if title in seen and not "key terms" in title.lower():
            continue
        seen.add(title)

        if re.match(r"Chapter \d+", b[1]):
            chapter_num += 1
            chapter_key = "chapter " + str(chapter_num)
            bookmarks_json[chapter_key] = {
                "title": b[1],
                "page_num": b[2],
                "num_sections": 0,
                "sections": []
            }
        elif re.match(r"^\d+\.\d+", b[1]):
            chapter_key = "chapter " + str(chapter_num)
            bookmarks_json[chapter_key]["num_sections"] += 1
            bookmarks_json[chapter_key]["sections"].append({
                "section_num": bookmarks_json[chapter_key]["num_sections"],
                "title": b[1], 
                "page_num": b[2]
                })
        # Key Terms indicate the end of a chapter's sections
        elif "key terms" in b[1].lower():
            chapter_key = "chapter " + str(chapter_num)
            bookmarks_json[chapter_key]["last_page"] = b[2]
    
    bookmarks_json["chapter_num"] = chapter_num

    _initialize_ranges(bookmarks_json)

    # print(bookmarks_json)
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(bookmarks_json, f, ensure_ascii=False, indent=4)
        print(f"Bookmarks saved to {filepath}")
