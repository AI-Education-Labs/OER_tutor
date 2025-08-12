import json
import os
from PyPDF2 import PdfReader

def initialize_bookmarks(pdf_path, textbook_name):
    """
    Initialize bookmarks for the Research Methods in Psychology textbook using predefined structure only.
    
    Args:
        pdf_path (str): Path to the PDF file
        textbook_name (str): Name of the textbook (used for output filename)
    """
    
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found at {pdf_path}")
        return False
    
    try:
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
        print(f"PDF loaded successfully. Total pages: {total_pages}")
        
        # Always use predefined chapter structure
        print("Using predefined chapter structure from Redis data...")
        bookmarks = create_predefined_bookmarks(textbook_name, total_pages)
        
        # Save bookmarks to JSON file
        bookmark_filename = f"{textbook_name}.json"
        bookmark_path = os.path.join("./data", bookmark_filename)
        
        # Ensure data directory exists
        os.makedirs("./data", exist_ok=True)
        
        with open(bookmark_path, "w") as f:
            json.dump(bookmarks, f, indent=2)
        
        print(f"✅ Bookmarks saved to {bookmark_path}")
        print(f"📚 Found {bookmarks['chapter_num']} chapters")
        
        # Print chapter summary
        print("\n📋 Chapter Summary:")
        for i in range(1, bookmarks['chapter_num'] + 1):
            chapter_key = f"chapter {i}"
            if chapter_key in bookmarks:
                chapter = bookmarks[chapter_key]
                print(f"  Chapter {i}: {chapter.get('title', 'Unknown')} (Pages {chapter['page_num']}-{chapter['last_page']})")
        
        return True
        
    except Exception as e:
        print(f"❌ Error initializing bookmarks: {e}")
        import traceback
        traceback.print_exc()
        return False

def create_predefined_bookmarks(textbook_name, total_pages):
    """
    Create predefined bookmarks based on the exact Research Methods in Psychology structure
    """
    
    # Using the exact chapter structure from the Redis data
    chapters = [
        {"title": "The Science of Psychology", "start": 1, "end": 20},
        {"title": "Overview of the Scientific Method", "start": 21, "end": 53},
        {"title": "Research Ethics", "start": 54, "end": 76},
        {"title": "Psychological Measurement", "start": 77, "end": 102},
        {"title": "Experimental Research", "start": 103, "end": 135},
        {"title": "Non-Experimental Research", "start": 136, "end": 175},
        {"title": "Survey Research", "start": 176, "end": 197},
        {"title": "Quasi-Experimental Research", "start": 198, "end": 209},
        {"title": "Factorial Designs", "start": 210, "end": 226},
        {"title": "Single-Subject Research", "start": 227, "end": 247},
        {"title": "Presenting Your Research", "start": 248, "end": 280},
        {"title": "Descriptive Statistics", "start": 281, "end": 325},
        {"title": "Inferential Statistics", "start": 326, "end": 368},
        {"title": "Glossary", "start": 369, "end": 400},
        {"title": "References", "start": 401, "end": 412}
        
    ]
    
    bookmarks = {
        "textbook_name": textbook_name,
        "chapter_num": len(chapters)
    }
    
    for i, chapter in enumerate(chapters, 1):
        # Use the exact page numbers from the Redis structure
        start_page = chapter["start"]
        end_page = chapter["end"]
        
        # Only adjust if they exceed the actual PDF length
        if start_page > total_pages:
            start_page = total_pages
        if end_page > total_pages:
            end_page = total_pages
            
        bookmarks[f"chapter {i}"] = {
            "title": chapter["title"],
            "page_num": start_page,
            "last_page": end_page
        }
    
    return bookmarks

if __name__ == "__main__":
    # Initialize bookmarks for Research Methods in Psychology
    pdf_path = "data/Research-Methods-in-Psychology_repaired.pdf"
    textbook_name = "Research_Methods_in_Psychology"
    
    print("🔖 Initializing bookmarks for Research Methods in Psychology...")
    success = initialize_bookmarks(pdf_path, textbook_name)
    
    if success:
        print("✅ Bookmark initialization completed successfully!")
        print("You can now run the retriever script.")
    else:
        print("❌ Bookmark initialization failed.")
