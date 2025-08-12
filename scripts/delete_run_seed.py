#!/usr/bin/env python3
"""
Script to seed the database with sample textbook data.
Run this from the project root directory.
"""

import asyncio
import sys
import os

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from capstone.v3_tutor.scripts.seed_textbooks import seed_all_textbooks

if __name__ == "__main__":
    print("🚀 Starting database seeding...")
    try:
        asyncio.run(seed_all_textbooks())
        print("✅ Database seeding completed successfully!")
    except KeyboardInterrupt:
        print("\n⚠️  Seeding interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        sys.exit(1)
