import os
import json
import shutil
import sys

from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import DocumentCompressorPipeline, LLMChainFilter
from langchain_core.documents import Document
from langchain_chroma import Chroma
import chromadb

from PyPDF2 import PdfReader, PdfWriter

from dotenv import load_dotenv
from tqdm import tqdm

# Load .env file
env_path = os.path.join(os.path.dirname(__file__), ".env")
if not load_dotenv(env_path):
    print("Warning: .env file not found.  Using Vercel environment variables.")
else:
    print(".env file loaded")

# Get OPENAI_API_KEY
api_key = os.environ.get("OPENAI_API_KEY")
if not api_key:
    print("Error: OPENAI_API_KEY not found in .env file or Vercel environment variables.")
    sys.exit(1)

os.environ["OPENAI_API_KEY"] = api_key

def create_retriever(textbook_path, textbook_name):
    """
    Creates a retriever given a textbook pdf with simplified, efficient file path handling.
    This version skips LLM-based filtering for speed/cost efficiency.
    """

    if not os.path.exists(textbook_path):
        raise Exception(f"Textbook path does not exist: {textbook_path}")

    # Use smaller embeddings for efficiency
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

    # Persistent Chroma vector database
    persistent_client = chromadb.PersistentClient()
    collection = persistent_client.get_or_create_collection(name=textbook_name)

    vector_store = Chroma(
        client=persistent_client,
        collection_name=textbook_name,
        embedding_function=embeddings
    )
    print("Chroma vector database initialized")

    if collection.count() == 0:
        print("Chroma vector database is empty, loading documents...")

        # Load bookmarks
        bookmark_str = textbook_name + ".json"
        bookmark_path = os.path.join("./data", bookmark_str)
        try:
            with open(bookmark_path, "r") as f:
                bookmarks = json.load(f)
            print("Bookmarks loaded")
        except FileNotFoundError:
            print(f"Error: Bookmarks file not found at {bookmark_path}. Ensure initialize_bookmarks was run.")
            return None
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from {bookmark_path}: {e}")
            return None

        # Create directory for chapter PDFs
        target_dir = f"./data/{textbook_name}"
        os.makedirs(target_dir, exist_ok=True)

        reader = PdfReader(textbook_path)
        documents = []

        # Extract chapters and save as PDFs
        for i in range(1, bookmarks["chapter_num"]+1):
            try:
                start_page = bookmarks[f"chapter {i}"]["page_num"]
                end_page = bookmarks[f"chapter {i}"]["last_page"]
            except KeyError:
                print(f"Error: Chapter {i} missing in bookmarks. Skipping.")
                continue

            writer = PdfWriter()
            for page_num in range(start_page - 1, end_page):
                try:
                    writer.add_page(reader.pages[page_num])
                except IndexError:
                    print(f"Warning: Page {page_num+1} missing, skipping.")
                    continue

            chapter_path = os.path.join(target_dir, f"chapter{i}.pdf")
            with open(chapter_path, "wb") as f:
                writer.write(f)
            print(f"Created: {chapter_path}")

            # Load and chunk chapter text
            loader = PyPDFLoader(chapter_path)
            try:
                chapter_docs = loader.load_and_split(
                    chunk_size=500,
                    chunk_overlap=50
                )
                for doc in chapter_docs:
                    doc.metadata.update({"chapter": f"Chapter {i}"})
                documents.extend(chapter_docs)
            except Exception as e:
                print(f"Error loading {chapter_path}: {e}")

        print(f"Total documents: {len(documents)}")

        # Clean up bookmarks
        if os.path.exists(bookmark_path):
            os.remove(bookmark_path)

        # Add to vector DB in batches
        if documents:
            batch_size = 10
            for i in range(0, len(documents), batch_size):
                vector_store.add_documents(documents[i:i+batch_size])
            print(f"Added {len(documents)} documents to Chroma")
        else:
            print("Warning: no documents added to vector DB")

    else:
        print("Chroma collection already populated, skipping document load")

    # Simple retriever, no LLM filter
    retriever = vector_store.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 6}  # adjust k if needed
    )
    print("Retriever initialized")

    return retriever


# Test function
def test_retriever():
    """Test the retriever with the Research Methods in Psychology textbook"""
    textbook_path = "./data/Research_Methods_in_Psychology.pdf"  # Adjust path as needed
    textbook_name = "Research_Methods_in_Psychology"
    
    if not os.path.exists(textbook_path):
        print(f"Error: Textbook not found at {textbook_path}")
        return
    
    try:
        retriever = create_retriever(textbook_path, textbook_name)
        if retriever:
            print("Retriever created successfully!")
            
            # Test a simple query
            test_query = "What is experimental research?"
            results = retriever.get_relevant_documents(test_query)
            print(f"Test query returned {len(results)} results")
            
            if results:
                print("Sample result:")
                print(f"Chapter: {results[0].metadata.get('chapter', 'Unknown')}")
                print(f"Content preview: {results[0].page_content[:200]}...")
        else:
            print("Failed to create retriever")
    except Exception as e:
        print(f"Error creating retriever: {e}")

if __name__ == "__main__":
    test_retriever()
