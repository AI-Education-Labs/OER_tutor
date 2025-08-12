#!/usr/bin/env python3
"""
Management script for textbook operations
"""

import asyncio
import sys
import os
import argparse

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from backend.routes.textbook_information import get_all_textbooks, get_textbook, delete_textbook
from backend.redis_client import redis_client
from capstone.v3_tutor.scripts.seed_textbooks import seed_all_textbooks

async def list_textbooks():
    """List all textbooks in the database"""
    try:
        books = await get_all_textbooks()
        if not books:
            print("📚 No textbooks found in database")
            return
        
        print(f"📚 Found {len(books)} textbook(s):")
        for book in books:
            print(f"   - {book.title} by {book.author} (ID: {book.textbook_id})")
            print(f"     ISBN: {book.isbn}, Chapters: {book.total_chapters}")
    except Exception as e:
        print(f"❌ Error listing textbooks: {e}")

async def show_textbook(textbook_id: str):
    """Show detailed information about a specific textbook"""
    try:
        book = await get_textbook(textbook_id)
        print(f"📖 {book.title}")
        print(f"   Author: {book.author}")
        print(f"   ISBN: {book.isbn}")
        print(f"   Edition: {book.edition}")
        print(f"   Publisher: {book.publisher} ({book.publication_year})")
        print(f"   Total Pages: {book.total_pages}")
        print(f"   Chapters: {len(book.chapters)}")
        
        for chapter in book.chapters:
            print(f"     {chapter.chapter_number}. {chapter.title} (Pages {chapter.page_start}-{chapter.page_end})")
            for subsection in chapter.subsections:
                print(f"        {subsection.subsection_number} {subsection.title}")
                
    except Exception as e:
        print(f"❌ Error showing textbook: {e}")

async def clear_textbooks():
    """Clear all textbooks from the database"""
    try:
        books = await get_all_textbooks()
        if not books:
            print("📚 No textbooks to clear")
            return
        
        print(f"🗑️  Clearing {len(books)} textbook(s)...")
        for book in books:
            await delete_textbook(book.textbook_id)
            print(f"   ✅ Deleted: {book.title}")
        
        print("🎉 All textbooks cleared!")
    except Exception as e:
        print(f"❌ Error clearing textbooks: {e}")

async def main():
    parser = argparse.ArgumentParser(description="Manage textbooks in the database")
    parser.add_argument("command", choices=["seed", "list", "show", "clear"], 
                       help="Command to execute")
    parser.add_argument("--textbook-id", help="Textbook ID (for show command)")
    
    args = parser.parse_args()
    
    try:
        # Test Redis connection
        await redis_client.ping()
        
        if args.command == "seed":
            await seed_all_textbooks()
        elif args.command == "list":
            await list_textbooks()
        elif args.command == "show":
            if not args.textbook_id:
                print("❌ --textbook-id is required for show command")
                return
            await show_textbook(args.textbook_id)
        elif args.command == "clear":
            confirm = input("⚠️  Are you sure you want to clear all textbooks? (y/N): ")
            if confirm.lower() == 'y':
                await clear_textbooks()
            else:
                print("Operation cancelled")
                
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await redis_client.close()

if __name__ == "__main__":
    asyncio.run(main())
