import asyncio
import json
import sys
import os

# Add the parent directory to the Python path so we can import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.redis_client import redis_client

async def populate_test_data():
    """Populate Redis with complete Psychology textbook data (all 13 chapters)"""
    
    # Complete Psychology textbook data based on the provided table of contents
    textbook_data = {
        "textbook_id": "2",
        "title": "Research Methods in Psychology",
        "author": "Rajiv S. Jhangiani, I-Chant A. Chiang, Carrie Cuttler, and Dana C. Leighton",
        "edition": "4th Edition",
        "total_pages": 382,
        "cover_image_url": "https://opentextbc.ca/researchmethods/wp-content/uploads/sites/252/2019/09/Research-Methods-in-Psychology-4th-Edition.jpg",
        "chapters": [
            {
                "chapter_id": "ch1",
                "chapter_number": 1,
                "title": "The Science of Psychology",
                "page_start": 3,
                "page_end": 19,
                "sections": [
                    {
                        "section_id": "ch1_s1",
                        "section_number": "1.1",
                        "title": "Methods of Knowing",
                        "page_start": 3,
                        "page_end": 5,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch1_s2",
                        "section_number": "1.2",
                        "title": "Understanding Science",
                        "page_start": 6,
                        "page_end": 9,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch1_s3",
                        "section_number": "1.3",
                        "title": "Goals of Science",
                        "page_start": 10,
                        "page_end": 11,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch1_s4",
                        "section_number": "1.4",
                        "title": "Science and Common Sense",
                        "page_start": 12,
                        "page_end": 14,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch1_s5",
                        "section_number": "1.5",
                        "title": "Experimental and Clinical Psychologists",
                        "page_start": 15,
                        "page_end": 18,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch2",
                "chapter_number": 2,
                "title": "Overview of the Scientific Method",
                "page_start": 25,
                "page_end": 54,
                "sections": [
                    {
                        "section_id": "ch2_s1",
                        "section_number": "2.1",
                        "title": "A Model of Scientific Research in Psychology",
                        "page_start": 25,
                        "page_end": 27,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch2_s2",
                        "section_number": "2.2",
                        "title": "Finding a Research Topic",
                        "page_start": 28,
                        "page_end": 35,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch2_s3",
                        "section_number": "2.3",
                        "title": "Generating Good Research Questions",
                        "page_start": 36,
                        "page_end": 39,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch2_s4",
                        "section_number": "2.4",
                        "title": "Developing a Hypothesis",
                        "page_start": 40,
                        "page_end": 44,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch2_s5",
                        "section_number": "2.5",
                        "title": "Designing a Research Study",
                        "page_start": 45,
                        "page_end": 48,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch2_s6",
                        "section_number": "2.6",
                        "title": "Analyzing the Data",
                        "page_start": 49,
                        "page_end": 51,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch2_s7",
                        "section_number": "2.7",
                        "title": "Drawing Conclusions and Reporting the Results",
                        "page_start": 52,
                        "page_end": 54,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch3",
                "chapter_number": 3,
                "title": "Research Ethics",
                "page_start": 59,
                "page_end": 79,
                "sections": [
                    {
                        "section_id": "ch3_s1",
                        "section_number": "3.1",
                        "title": "Moral Foundations of Ethical Research",
                        "page_start": 59,
                        "page_end": 64,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch3_s2",
                        "section_number": "3.2",
                        "title": "From Moral Principles to Ethics Codes",
                        "page_start": 65,
                        "page_end": 73,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch3_s3",
                        "section_number": "3.3",
                        "title": "Putting Ethics Into Practice",
                        "page_start": 74,
                        "page_end": 79,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch4",
                "chapter_number": 4,
                "title": "Psychological Measurement",
                "page_start": 83,
                "page_end": 105,
                "sections": [
                    {
                        "section_id": "ch4_s1",
                        "section_number": "4.1",
                        "title": "Understanding Psychological Measurement",
                        "page_start": 83,
                        "page_end": 91,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch4_s2",
                        "section_number": "4.2",
                        "title": "Reliability and Validity of Measurement",
                        "page_start": 92,
                        "page_end": 98,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch4_s3",
                        "section_number": "4.3",
                        "title": "Practical Strategies for Psychological Measurement",
                        "page_start": 99,
                        "page_end": 105,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch5",
                "chapter_number": 5,
                "title": "Experimental Research",
                "page_start": 109,
                "page_end": 138,
                "sections": [
                    {
                        "section_id": "ch5_s1",
                        "section_number": "5.1",
                        "title": "Experiment Basics",
                        "page_start": 109,
                        "page_end": 116,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch5_s2",
                        "section_number": "5.2",
                        "title": "Experimental Design",
                        "page_start": 117,
                        "page_end": 124,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch5_s3",
                        "section_number": "5.3",
                        "title": "Experimentation and Validity",
                        "page_start": 125,
                        "page_end": 129,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch5_s4",
                        "section_number": "5.4",
                        "title": "Practical Considerations",
                        "page_start": 130,
                        "page_end": 138,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch6",
                "chapter_number": 6,
                "title": "Non-Experimental Research",
                "page_start": 143,
                "page_end": 179,
                "sections": [
                    {
                        "section_id": "ch6_s1",
                        "section_number": "6.1",
                        "title": "Overview of Non-Experimental Research",
                        "page_start": 143,
                        "page_end": 147,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch6_s2",
                        "section_number": "6.2",
                        "title": "Correlational Research",
                        "page_start": 148,
                        "page_end": 156,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch6_s3",
                        "section_number": "6.3",
                        "title": "Complex Correlation",
                        "page_start": 157,
                        "page_end": 162,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch6_s4",
                        "section_number": "6.4",
                        "title": "Qualitative Research",
                        "page_start": 163,
                        "page_end": 168,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch6_s5",
                        "section_number": "6.5",
                        "title": "Observational Research",
                        "page_start": 169,
                        "page_end": 179,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch7",
                "chapter_number": 7,
                "title": "Survey Research",
                "page_start": 185,
                "page_end": 204,
                "sections": [
                    {
                        "section_id": "ch7_s1",
                        "section_number": "7.1",
                        "title": "Overview of Survey Research",
                        "page_start": 185,
                        "page_end": 187,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch7_s2",
                        "section_number": "7.2",
                        "title": "Constructing Surveys",
                        "page_start": 188,
                        "page_end": 197,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch7_s3",
                        "section_number": "7.3",
                        "title": "Conducting Surveys",
                        "page_start": 198,
                        "page_end": 204,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch8",
                "chapter_number": 8,
                "title": "Quasi-Experimental Research",
                "page_start": 209,
                "page_end": 219,
                "sections": [
                    {
                        "section_id": "ch8_s1",
                        "section_number": "8.1",
                        "title": "One-Group Designs",
                        "page_start": 209,
                        "page_end": 214,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch8_s2",
                        "section_number": "8.2",
                        "title": "Non-Equivalent Groups Designs",
                        "page_start": 215,
                        "page_end": 219,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch9",
                "chapter_number": 9,
                "title": "Factorial Designs",
                "page_start": 223,
                "page_end": 238,
                "sections": [
                    {
                        "section_id": "ch9_s1",
                        "section_number": "9.1",
                        "title": "Setting Up a Factorial Experiment",
                        "page_start": 223,
                        "page_end": 228,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch9_s2",
                        "section_number": "9.2",
                        "title": "Interpreting the Results of a Factorial Experiment",
                        "page_start": 229,
                        "page_end": 238,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch10",
                "chapter_number": 10,
                "title": "Single-Subject Research",
                "page_start": 241,
                "page_end": 259,
                "sections": [
                    {
                        "section_id": "ch10_s1",
                        "section_number": "10.1",
                        "title": "Overview of Single-Subject Research",
                        "page_start": 241,
                        "page_end": 243,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch10_s2",
                        "section_number": "10.2",
                        "title": "Single-Subject Research Designs",
                        "page_start": 244,
                        "page_end": 253,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch10_s3",
                        "section_number": "10.3",
                        "title": "The Single-Subject Versus Group \"Debate\"",
                        "page_start": 254,
                        "page_end": 259,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch11",
                "chapter_number": 11,
                "title": "Presenting Your Research",
                "page_start": 263,
                "page_end": 293,
                "sections": [
                    {
                        "section_id": "ch11_s1",
                        "section_number": "11.1",
                        "title": "American Psychological Association (APA) Style",
                        "page_start": 263,
                        "page_end": 272,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch11_s2",
                        "section_number": "11.2",
                        "title": "Writing a Research Report in American Psychological Association (APA) Style",
                        "page_start": 273,
                        "page_end": 286,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch11_s3",
                        "section_number": "11.3",
                        "title": "Other Presentation Formats",
                        "page_start": 287,
                        "page_end": 293,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch12",
                "chapter_number": 12,
                "title": "Descriptive Statistics",
                "page_start": 297,
                "page_end": 337,
                "sections": [
                    {
                        "section_id": "ch12_s1",
                        "section_number": "12.1",
                        "title": "Describing Single Variables",
                        "page_start": 297,
                        "page_end": 308,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch12_s2",
                        "section_number": "12.2",
                        "title": "Describing Statistical Relationships",
                        "page_start": 309,
                        "page_end": 320,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch12_s3",
                        "section_number": "12.3",
                        "title": "Expressing Your Results",
                        "page_start": 321,
                        "page_end": 331,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch12_s4",
                        "section_number": "12.4",
                        "title": "Conducting Your Analyses",
                        "page_start": 332,
                        "page_end": 337,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch13",
                "chapter_number": 13,
                "title": "Inferential Statistics",
                "page_start": 343,
                "page_end": 382,
                "sections": [
                    {
                        "section_id": "ch13_s1",
                        "section_number": "13.1",
                        "title": "Understanding Null Hypothesis Testing",
                        "page_start": 343,
                        "page_end": 349,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch13_s2",
                        "section_number": "13.2",
                        "title": "Some Basic Null Hypothesis Tests",
                        "page_start": 350,
                        "page_end": 365,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch13_s3",
                        "section_number": "13.3",
                        "title": "Additional Considerations",
                        "page_start": 366,
                        "page_end": 373,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch13_s4",
                        "section_number": "13.4",
                        "title": "From the \"Replicability Crisis\" to Open Science Practices",
                        "page_start": 374,
                        "page_end": 381,
                        "content_type": "pdf"
                    }
                ]
            }
        ]
    }
    
    try:
        # Store textbook data in Redis
        key = f"textbook:{textbook_data['textbook_id']}"
        await redis_client.set(key, json.dumps(textbook_data))
        print(f"✅ Stored textbook data with key: {key}")
        
        # Store some dummy file data for sections (you can replace with real PDF data later)
        dummy_pdf_content = b"This is dummy PDF content for testing. In a real implementation, this would be the actual PDF file content for each section covering psychological research methods."
        
        section_count = 0
        for chapter in textbook_data["chapters"]:
            for section in chapter["sections"]:
                file_key = f"textbook_file:{textbook_data['textbook_id']}:{section['section_id']}"
                await redis_client.set(file_key, dummy_pdf_content)
                section_count += 1
                print(f"✅ Stored section file with key: {file_key}")
        
        print(f"🎉 Complete Psychology textbook data populated successfully!")
        print(f"📚 Title: {textbook_data['title']}")
        print(f"👨‍🏫 Authors: {textbook_data['author']}")
        print(f"📖 Edition: {textbook_data['edition']}")
        print(f"📖 Chapters: {len(textbook_data['chapters'])}")
        print(f"📄 Sections: {section_count}")
        print(f"📃 Total Pages: {textbook_data['total_pages']}")
        
        # Print chapter summary
        print("\n📋 Chapter Summary:")
        for chapter in textbook_data["chapters"]:
            print(f"  Chapter {chapter['chapter_number']}: {chapter['title']} (Pages {chapter['page_start']}-{chapter['page_end']})")
        
    except Exception as e:
        print(f"❌ Error populating data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(populate_test_data())
