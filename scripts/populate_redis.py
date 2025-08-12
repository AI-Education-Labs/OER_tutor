import asyncio
import json
import sys
import os

#
#
# TO RUN BE IN ROOT DIRECTORY AND RUN (python scripts/populate_redis.py)
#
#

# Add the parent directory to the Python path so we can import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.redis_client import redis_client

async def populate_test_data():
    """Populate Redis with complete Physics textbook data (all 23 chapters)"""
    
    # Complete Physics textbook data based on the provided table of contents
    textbook_data = {
        "textbook_id": "1",
        "title": "Physics",
        "author": "Paul Peter Urone",
        "total_pages": 801,
        "cover_image_url": "https://openstax.org/apps/cms/api/files/4276/",
        "chapters": [
            {
                "chapter_id": "ch1",
                "chapter_number": 1,
                "title": "What is Physics?",
                "page_start": 5,
                "page_end": 51,
                "sections": [
                    {
                        "section_id": "ch1_s1",
                        "section_number": "1.1",
                        "title": "Physics: Definitions and Applications",
                        "page_start": 5,
                        "page_end": 13,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch1_s2",
                        "section_number": "1.2",
                        "title": "The Scientific Methods",
                        "page_start": 14,
                        "page_end": 17,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch1_s3",
                        "section_number": "1.3",
                        "title": "The Language of Physics: Physical Quantities and Units",
                        "page_start": 18,
                        "page_end": 39,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch2",
                "chapter_number": 2,
                "title": "Motion in One Dimension",
                "page_start": 53,
                "page_end": 91,
                "sections": [
                    {
                        "section_id": "ch2_s1",
                        "section_number": "2.1",
                        "title": "Relative Motion, Distance, and Displacement",
                        "page_start": 54,
                        "page_end": 61,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch2_s2",
                        "section_number": "2.2",
                        "title": "Speed and Velocity",
                        "page_start": 62,
                        "page_end": 66,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch2_s3",
                        "section_number": "2.3",
                        "title": "Position vs. Time Graphs",
                        "page_start": 67,
                        "page_end": 72,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch2_s4",
                        "section_number": "2.4",
                        "title": "Velocity vs. Time Graphs",
                        "page_start": 73,
                        "page_end": 80,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch3",
                "chapter_number": 3,
                "title": "Acceleration",
                "page_start": 93,
                "page_end": 113,
                "sections": [
                    {
                        "section_id": "ch3_s1",
                        "section_number": "3.1",
                        "title": "Acceleration",
                        "page_start": 93,
                        "page_end": 98,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch3_s2",
                        "section_number": "3.2",
                        "title": "Representing Acceleration with Equations and Graphs",
                        "page_start": 99,
                        "page_end": 108,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch4",
                "chapter_number": 4,
                "title": "Forces and Newton's Laws of Motion",
                "page_start": 115,
                "page_end": 141,
                "sections": [
                    {
                        "section_id": "ch4_s1",
                        "section_number": "4.1",
                        "title": "Force",
                        "page_start": 116,
                        "page_end": 117,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch4_s2",
                        "section_number": "4.2",
                        "title": "Newton's First Law of Motion: Inertia",
                        "page_start": 118,
                        "page_end": 121,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch4_s3",
                        "section_number": "4.3",
                        "title": "Newton's Second Law of Motion",
                        "page_start": 122,
                        "page_end": 127,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch4_s4",
                        "section_number": "4.4",
                        "title": "Newton's Third Law of Motion",
                        "page_start": 128,
                        "page_end": 134,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch5",
                "chapter_number": 5,
                "title": "Motion in Two Dimensions",
                "page_start": 143,
                "page_end": 195,
                "sections": [
                    {
                        "section_id": "ch5_s1",
                        "section_number": "5.1",
                        "title": "Vector Addition and Subtraction: Graphical Methods",
                        "page_start": 144,
                        "page_end": 152,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch5_s2",
                        "section_number": "5.2",
                        "title": "Vector Addition and Subtraction: Analytical Methods",
                        "page_start": 153,
                        "page_end": 161,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch5_s3",
                        "section_number": "5.3",
                        "title": "Projectile Motion",
                        "page_start": 162,
                        "page_end": 170,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch5_s4",
                        "section_number": "5.4",
                        "title": "Inclined Planes",
                        "page_start": 171,
                        "page_end": 177,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch5_s5",
                        "section_number": "5.5",
                        "title": "Simple Harmonic Motion",
                        "page_start": 178,
                        "page_end": 184,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch6",
                "chapter_number": 6,
                "title": "Circular and Rotational Motion",
                "page_start": 197,
                "page_end": 227,
                "sections": [
                    {
                        "section_id": "ch6_s1",
                        "section_number": "6.1",
                        "title": "Angle of Rotation and Angular Velocity",
                        "page_start": 198,
                        "page_end": 204,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch6_s2",
                        "section_number": "6.2",
                        "title": "Uniform Circular Motion",
                        "page_start": 205,
                        "page_end": 211,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch6_s3",
                        "section_number": "6.3",
                        "title": "Rotational Motion",
                        "page_start": 212,
                        "page_end": 219,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch7",
                "chapter_number": 7,
                "title": "Newton's Law of Gravitation",
                "page_start": 229,
                "page_end": 251,
                "sections": [
                    {
                        "section_id": "ch7_s1",
                        "section_number": "7.1",
                        "title": "Kepler's Laws of Planetary Motion",
                        "page_start": 229,
                        "page_end": 236,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch7_s2",
                        "section_number": "7.2",
                        "title": "Newton's Law of Universal Gravitation and Einstein's Theory of General Relativity",
                        "page_start": 237,
                        "page_end": 245,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch8",
                "chapter_number": 8,
                "title": "Momentum",
                "page_start": 253,
                "page_end": 277,
                "sections": [
                    {
                        "section_id": "ch8_s1",
                        "section_number": "8.1",
                        "title": "Linear Momentum, Force, and Impulse",
                        "page_start": 254,
                        "page_end": 258,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch8_s2",
                        "section_number": "8.2",
                        "title": "Conservation of Momentum",
                        "page_start": 259,
                        "page_end": 261,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch8_s3",
                        "section_number": "8.3",
                        "title": "Elastic and Inelastic Collisions",
                        "page_start": 262,
                        "page_end": 271,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch9",
                "chapter_number": 9,
                "title": "Work, Energy, and Simple Machines",
                "page_start": 279,
                "page_end": 303,
                "sections": [
                    {
                        "section_id": "ch9_s1",
                        "section_number": "9.1",
                        "title": "Work, Power, and the Work–Energy Theorem",
                        "page_start": 280,
                        "page_end": 284,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch9_s2",
                        "section_number": "9.2",
                        "title": "Mechanical Energy and Conservation of Energy",
                        "page_start": 285,
                        "page_end": 289,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch9_s3",
                        "section_number": "9.3",
                        "title": "Simple Machines",
                        "page_start": 290,
                        "page_end": 294,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch10",
                "chapter_number": 10,
                "title": "Special Relativity",
                "page_start": 305,
                "page_end": 325,
                "sections": [
                    {
                        "section_id": "ch10_s1",
                        "section_number": "10.1",
                        "title": "Postulates of Special Relativity",
                        "page_start": 305,
                        "page_end": 311,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch10_s2",
                        "section_number": "10.2",
                        "title": "Consequences of Special Relativity",
                        "page_start": 312,
                        "page_end": 320,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch11",
                "chapter_number": 11,
                "title": "Thermal Energy, Heat, and Work",
                "page_start": 327,
                "page_end": 353,
                "sections": [
                    {
                        "section_id": "ch11_s1",
                        "section_number": "11.1",
                        "title": "Temperature and Thermal Energy",
                        "page_start": 327,
                        "page_end": 331,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch11_s2",
                        "section_number": "11.2",
                        "title": "Heat, Specific Heat, and Heat Transfer",
                        "page_start": 332,
                        "page_end": 339,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch11_s3",
                        "section_number": "11.3",
                        "title": "Phase Change and Latent Heat",
                        "page_start": 340,
                        "page_end": 347,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch12",
                "chapter_number": 12,
                "title": "Thermodynamics",
                "page_start": 355,
                "page_end": 387,
                "sections": [
                    {
                        "section_id": "ch12_s1",
                        "section_number": "12.1",
                        "title": "Zeroth Law of Thermodynamics: Thermal Equilibrium",
                        "page_start": 356,
                        "page_end": 357,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch12_s2",
                        "section_number": "12.2",
                        "title": "First law of Thermodynamics: Thermal Energy and Work",
                        "page_start": 358,
                        "page_end": 365,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch12_s3",
                        "section_number": "12.3",
                        "title": "Second Law of Thermodynamics: Entropy",
                        "page_start": 366,
                        "page_end": 371,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch12_s4",
                        "section_number": "12.4",
                        "title": "Applications of Thermodynamics: Heat Engines, Heat Pumps, and Refrigerators",
                        "page_start": 372,
                        "page_end": 377,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch13",
                "chapter_number": 13,
                "title": "Waves and Their Properties",
                "page_start": 389,
                "page_end": 413,
                "sections": [
                    {
                        "section_id": "ch13_s1",
                        "section_number": "13.1",
                        "title": "Types of Waves",
                        "page_start": 390,
                        "page_end": 393,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch13_s2",
                        "section_number": "13.2",
                        "title": "Wave Properties: Speed, Amplitude, Frequency, and Period",
                        "page_start": 394,
                        "page_end": 399,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch13_s3",
                        "section_number": "13.3",
                        "title": "Wave Interaction: Superposition and Interference",
                        "page_start": 400,
                        "page_end": 405,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch14",
                "chapter_number": 14,
                "title": "Sound",
                "page_start": 415,
                "page_end": 453,
                "sections": [
                    {
                        "section_id": "ch14_s1",
                        "section_number": "14.1",
                        "title": "Speed of Sound, Frequency, and Wavelength",
                        "page_start": 416,
                        "page_end": 422,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch14_s2",
                        "section_number": "14.2",
                        "title": "Sound Intensity and Sound Level",
                        "page_start": 423,
                        "page_end": 429,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch14_s3",
                        "section_number": "14.3",
                        "title": "Doppler Effect and Sonic Booms",
                        "page_start": 430,
                        "page_end": 433,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch14_s4",
                        "section_number": "14.4",
                        "title": "Sound Interference and Resonance",
                        "page_start": 434,
                        "page_end": 442,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch15",
                "chapter_number": 15,
                "title": "Light",
                "page_start": 455,
                "page_end": 475,
                "sections": [
                    {
                        "section_id": "ch15_s1",
                        "section_number": "15.1",
                        "title": "The Electromagnetic Spectrum",
                        "page_start": 455,
                        "page_end": 462,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch15_s2",
                        "section_number": "15.2",
                        "title": "The Behavior of Electromagnetic Radiation",
                        "page_start": 463,
                        "page_end": 468,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch16",
                "chapter_number": 16,
                "title": "Mirrors and Lenses",
                "page_start": 477,
                "page_end": 521,
                "sections": [
                    {
                        "section_id": "ch16_s1",
                        "section_number": "16.1",
                        "title": "Reflection",
                        "page_start": 478,
                        "page_end": 486,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch16_s2",
                        "section_number": "16.2",
                        "title": "Refraction",
                        "page_start": 487,
                        "page_end": 497,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch16_s3",
                        "section_number": "16.3",
                        "title": "Lenses",
                        "page_start": 498,
                        "page_end": 512,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch17",
                "chapter_number": 17,
                "title": "Diffraction and Interference",
                "page_start": 523,
                "page_end": 547,
                "sections": [
                    {
                        "section_id": "ch17_s1",
                        "section_number": "17.1",
                        "title": "Understanding Diffraction and Interference",
                        "page_start": 523,
                        "page_end": 531,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch17_s2",
                        "section_number": "17.2",
                        "title": "Applications of Diffraction, Interference, and Coherence",
                        "page_start": 532,
                        "page_end": 541,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch18",
                "chapter_number": 18,
                "title": "Static Electricity",
                "page_start": 549,
                "page_end": 601,
                "sections": [
                    {
                        "section_id": "ch18_s1",
                        "section_number": "18.1",
                        "title": "Electrical Charges, Conservation of Charge, and Transfer of Charge",
                        "page_start": 550,
                        "page_end": 561,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch18_s2",
                        "section_number": "18.2",
                        "title": "Coulomb's law",
                        "page_start": 562,
                        "page_end": 566,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch18_s3",
                        "section_number": "18.3",
                        "title": "Electric Field",
                        "page_start": 567,
                        "page_end": 571,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch18_s4",
                        "section_number": "18.4",
                        "title": "Electric Potential",
                        "page_start": 572,
                        "page_end": 579,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch18_s5",
                        "section_number": "18.5",
                        "title": "Capacitors and Dielectrics",
                        "page_start": 580,
                        "page_end": 590,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch19",
                "chapter_number": 19,
                "title": "Electrical Circuits",
                "page_start": 603,
                "page_end": 647,
                "sections": [
                    {
                        "section_id": "ch19_s1",
                        "section_number": "19.1",
                        "title": "Ohm's law",
                        "page_start": 604,
                        "page_end": 611,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch19_s2",
                        "section_number": "19.2",
                        "title": "Series Circuits",
                        "page_start": 612,
                        "page_end": 620,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch19_s3",
                        "section_number": "19.3",
                        "title": "Parallel Circuits",
                        "page_start": 621,
                        "page_end": 631,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch19_s4",
                        "section_number": "19.4",
                        "title": "Electric Power",
                        "page_start": 632,
                        "page_end": 637,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch20",
                "chapter_number": 20,
                "title": "Magnetism",
                "page_start": 649,
                "page_end": 689,
                "sections": [
                    {
                        "section_id": "ch20_s1",
                        "section_number": "20.1",
                        "title": "Magnetic Fields, Field Lines, and Force",
                        "page_start": 650,
                        "page_end": 664,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch20_s2",
                        "section_number": "20.2",
                        "title": "Motors, Generators, and Transformers",
                        "page_start": 665,
                        "page_end": 671,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch20_s3",
                        "section_number": "20.3",
                        "title": "Electromagnetic Induction",
                        "page_start": 672,
                        "page_end": 680,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch21",
                "chapter_number": 21,
                "title": "The Quantum Nature of Light",
                "page_start": 691,
                "page_end": 719,
                "sections": [
                    {
                        "section_id": "ch21_s1",
                        "section_number": "21.1",
                        "title": "Planck and Quantum Nature of Light",
                        "page_start": 692,
                        "page_end": 697,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch21_s2",
                        "section_number": "21.2",
                        "title": "Einstein and the Photoelectric Effect",
                        "page_start": 698,
                        "page_end": 703,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch21_s3",
                        "section_number": "21.3",
                        "title": "The Dual Nature of Light",
                        "page_start": 704,
                        "page_end": 710,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch22",
                "chapter_number": 22,
                "title": "The Atom",
                "page_start": 721,
                "page_end": 769,
                "sections": [
                    {
                        "section_id": "ch22_s1",
                        "section_number": "22.1",
                        "title": "The Structure of the Atom",
                        "page_start": 721,
                        "page_end": 733,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch22_s2",
                        "section_number": "22.2",
                        "title": "Nuclear Forces and Radioactivity",
                        "page_start": 734,
                        "page_end": 742,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch22_s3",
                        "section_number": "22.3",
                        "title": "Half Life and Radiometric Dating",
                        "page_start": 743,
                        "page_end": 746,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch22_s4",
                        "section_number": "22.4",
                        "title": "Nuclear Fission and Fusion",
                        "page_start": 747,
                        "page_end": 756,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch22_s5",
                        "section_number": "22.5",
                        "title": "Medical Applications of Radioactivity: Diagnostic Imaging and Radiation",
                        "page_start": 757,
                        "page_end": 762,
                        "content_type": "pdf"
                    }
                ]
            },
            {
                "chapter_id": "ch23",
                "chapter_number": 23,
                "title": "Particle Physics",
                "page_start": 771,
                "page_end": 801,
                "sections": [
                    {
                        "section_id": "ch23_s1",
                        "section_number": "23.1",
                        "title": "The Four Fundamental Forces",
                        "page_start": 772,
                        "page_end": 778,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch23_s2",
                        "section_number": "23.2",
                        "title": "Quarks",
                        "page_start": 779,
                        "page_end": 789,
                        "content_type": "pdf"
                    },
                    {
                        "section_id": "ch23_s3",
                        "section_number": "23.3",
                        "title": "The Unification of Forces",
                        "page_start": 790,
                        "page_end": 795,
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
        dummy_pdf_content = b"This is dummy PDF content for testing. In a real implementation, this would be the actual PDF file content for each section."
        
        section_count = 0
        for chapter in textbook_data["chapters"]:
            for section in chapter["sections"]:
                file_key = f"textbook_file:{textbook_data['textbook_id']}:{section['section_id']}"
                await redis_client.set(file_key, dummy_pdf_content)
                section_count += 1
                print(f"✅ Stored section file with key: {file_key}")
        
        print(f"🎉 Complete Physics textbook data populated successfully!")
        print(f"📚 Title: {textbook_data['title']}")
        print(f"👨‍🏫 Author: {textbook_data['author']}")
        print(f"📖 Chapters: {len(textbook_data['chapters'])}")
        print(f"📄 Sections: {section_count}")
        print(f"📃 Total Pages: {textbook_data['total_pages']}")
        
    except Exception as e:
        print(f"❌ Error populating data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(populate_test_data())
