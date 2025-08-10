import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.routes.textbook_information import Textbook, Chapter, Subsection, store_textbook
from backend.redis_client import redis_client

async def seed_physics_textbook():
    """Seed a sample physics textbook"""
    
    # Create subsections for Chapter 1
    chapter1_subsections = [
        Subsection(
            subsection_id="1.1",
            subsection_number="1.1",
            title="Physics: Definitions and Applications",
            page_start=1,
            page_end=13,
            description="Introduction to physics and its applications in everyday life"
        ),
        Subsection(
            subsection_id="1.2",
            subsection_number="1.2", 
            title="The Scientific Methods",
            page_start=14,
            page_end=17,
            description="Understanding the scientific method and how physics research is conducted"
        ),
        Subsection(
            subsection_id="1.3",
            subsection_number="1.3",
            title="The Language of Physics: Physical Quantities and Units",
            page_start=18,
            page_end=53,
            description="SI units, dimensional analysis, and measurement in physics"
        )
    ]
    
    # Create subsections for Chapter 2
    chapter2_subsections = [
        Subsection(
            subsection_id="2.1",
            subsection_number="2.1",
            title="Relative Motion, Distance, and Displacement",
            page_start=54,
            page_end=61,
            description="Understanding motion from different reference frames"
        ),
        Subsection(
            subsection_id="2.2",
            subsection_number="2.2",
            title="Speed and Velocity",
            page_start=62,
            page_end=66,
            description="Distinguishing between speed and velocity"
        ),
        Subsection(
            subsection_id="2.3",
            subsection_number="2.3",
            title="Position vs. Time Graphs",
            page_start=67,
            page_end=71,
            description="Interpreting and creating position-time graphs"
        ),
        Subsection(
            subsection_id="2.4",
            subsection_number="2.4",
            title="Velocity vs. Time Graphs",
            page_start=72,
            page_end=92,
            description="Interpreting and creating velocity-time graphs"
        )
    ]
    
    # Create subsections for Chapter 3
    chapter3_subsections = [
        Subsection(
            subsection_id="3.1",
            subsection_number="3.1",
            title="Acceleration",
            page_start=93,
            page_end=98,
            description="Understanding acceleration as the rate of change of velocity"
        ),
        Subsection(
            subsection_id="3.2",
            subsection_number="3.2",
            title="Representing Acceleration with Equations and Graphs",
            page_start=99,
            page_end=120,
            description="Mathematical and graphical representations of acceleration"
        )
    ]
    
    # Create chapters
    chapters = [
        Chapter(
            chapter_id="1",
            chapter_number=1,
            title="What is Physics",
            description="Introduction to the field of physics and its fundamental concepts",
            page_start=1,
            page_end=53,
            subsections=chapter1_subsections
        ),
        Chapter(
            chapter_id="2", 
            chapter_number=2,
            title="Motion in One Dimension",
            description="Study of motion along a straight line",
            page_start=54,
            page_end=92,
            subsections=chapter2_subsections
        ),
        Chapter(
            chapter_id="3",
            chapter_number=3,
            title="Acceleration",
            description="Understanding acceleration and its applications",
            page_start=93,
            page_end=120,
            subsections=chapter3_subsections
        )
    ]
    
    # Create the textbook
    physics_textbook = Textbook(
        textbook_id="physics101",
        title="Introduction to Physics",
        author="Dr. Sarah Johnson",
        isbn="978-0-123456-78-9",
        edition="3rd Edition",
        publisher="Academic Press",
        publication_year=2023,
        total_pages=450,
        description="A comprehensive introduction to physics covering mechanics, thermodynamics, and more.",
        cover_image_url="/images/physics101-cover.jpg",
        chapters=chapters
    )
    
    # Store in Redis
    await store_textbook(physics_textbook)
    print(f"✅ Stored textbook: {physics_textbook.title}")
    return physics_textbook

async def seed_chemistry_textbook():
    """Seed a sample chemistry textbook"""
    
    # Create subsections for Chapter 1
    chapter1_subsections = [
        Subsection(
            subsection_id="1.1",
            subsection_number="1.1",
            title="What is Chemistry?",
            page_start=1,
            page_end=15,
            description="Introduction to chemistry and its role in science"
        ),
        Subsection(
            subsection_id="1.2",
            subsection_number="1.2",
            title="The Scientific Method in Chemistry",
            page_start=16,
            page_end=25,
            description="How chemists use the scientific method"
        )
    ]
    
    # Create subsections for Chapter 2
    chapter2_subsections = [
        Subsection(
            subsection_id="2.1",
            subsection_number="2.1",
            title="Atoms and Elements",
            page_start=26,
            page_end=45,
            description="Basic structure of atoms and the periodic table"
        ),
        Subsection(
            subsection_id="2.2",
            subsection_number="2.2",
            title="Molecules and Compounds",
            page_start=46,
            page_end=65,
            description="How atoms combine to form molecules and compounds"
        )
    ]
    
    chapters = [
        Chapter(
            chapter_id="1",
            chapter_number=1,
            title="Introduction to Chemistry",
            description="Fundamentals of chemistry and scientific thinking",
            page_start=1,
            page_end=25,
            subsections=chapter1_subsections
        ),
        Chapter(
            chapter_id="2",
            chapter_number=2,
            title="Atoms and Molecules",
            description="Basic building blocks of matter",
            page_start=26,
            page_end=65,
            subsections=chapter2_subsections
        )
    ]
    
    chemistry_textbook = Textbook(
        textbook_id="chem101",
        title="General Chemistry",
        author="Prof. Michael Chen",
        isbn="978-0-987654-32-1",
        edition="2nd Edition",
        publisher="Science Publications",
        publication_year=2022,
        total_pages=380,
        description="A foundational course in general chemistry principles.",
        cover_image_url="/images/chem101-cover.jpg",
        chapters=chapters
    )
    
    await store_textbook(chemistry_textbook)
    print(f"✅ Stored textbook: {chemistry_textbook.title}")
    return chemistry_textbook

async def seed_all_textbooks():
    """Seed all sample textbooks"""
    try:
        print("🌱 Starting textbook seeding...")
        
        # Test Redis connection
        await redis_client.ping()
        print("✅ Redis connection successful")
        
        # Seed textbooks
        physics_book = await seed_physics_textbook()
        chemistry_book = await seed_chemistry_textbook()
        
        print(f"\n🎉 Successfully seeded {2} textbooks:")
        print(f"   - {physics_book.title} (ID: {physics_book.textbook_id})")
        print(f"   - {chemistry_book.title} (ID: {chemistry_book.textbook_id})")
        
        # List all textbooks to verify
        from backend.routes.textbook_information import get_all_textbooks
        all_books = await get_all_textbooks()
        print(f"\n📚 Total textbooks in database: {len(all_books)}")
        
    except Exception as e:
        print(f"❌ Error seeding textbooks: {e}")
        raise
    finally:
        # Close Redis connection
        await redis_client.close()

if __name__ == "__main__":
    asyncio.run(seed_all_textbooks())
