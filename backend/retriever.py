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
    Creates a retriever given a textbook pdf with fixed file path handling.

    Args:
        textbook_path (str): Path to the textbook pdf
        textbook_name (str): Name of the textbook

    Returns:
        ContextualCompressionRetriever
    """

    if not os.path.exists(textbook_path):
        raise Exception(f"Textbook path does not exist: {textbook_path}")

    # Initialize a persistent Chroma vector database
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
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

        # Initialize bookmarks
        bookmark_str = textbook_name + ".json"
        bookmark_path = os.path.join("./data", bookmark_str)
        try:
            with open(bookmark_path, "r") as f:
                bookmarks = json.load(f)
            print("Bookmarks loaded")
        except FileNotFoundError:
            print(f"Error: Bookmarks file not found at {bookmark_path}.  Ensure initialize_bookmarks was run.")
            return None
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from {bookmark_path}: {e}")
            return None

        # Create target directory first
        target_dir = f"./data/{textbook_name}"
        os.makedirs(target_dir, exist_ok=True)
        print(f"Created target directory: {target_dir}")

        # Create documents
        documents = []

        page_ranges = []
        for i in range(1, bookmarks["chapter_num"]+1):
            try:
                start_page = bookmarks[f"chapter {i}"]["page_num"]
                end_page = bookmarks[f"chapter {i}"]["last_page"]
                page_ranges.append((start_page - 1, end_page))
            except KeyError as e:
                print(f"Error: Could not find chapter {i} in bookmarks.  Skipping. {e}")
                continue

        reader = PdfReader(textbook_path)

        # Create chapter PDFs directly in the target directory
        for idx, (start_page, end_page) in enumerate(page_ranges):
            writer = PdfWriter()
            chapter_num = idx + 1
            print(f"Processing chapter {chapter_num} from pages {start_page+1} to {end_page}")

            for page_num in range(start_page, end_page):
                try:
                    writer.add_page(reader.pages[page_num])
                except IndexError as e:
                    print(f"Error: Page {page_num+1} not found in PDF. Skipping. {e}")
                    continue

            # Save directly to target directory
            output_pdf = os.path.join(target_dir, f"chapter{chapter_num}.pdf")
            
            with open(output_pdf, "wb") as f:
                writer.write(f)
            print(f"Created: {output_pdf}")

        # Load documents from the correct location
        for i in tqdm(range(1, bookmarks["chapter_num"]+1), desc="Loading documents"):
            file_path = os.path.join(target_dir, f"chapter{i}.pdf")
            
            if not os.path.exists(file_path):
                print(f"Warning: Chapter file not found at {file_path}. Skipping.")
                continue
                
            try:
                loader = PyPDFLoader(file_path)
                full_chapter = loader.load()
                print(f"Successfully loaded chapter {i} with {len(full_chapter)} pages")
            except Exception as e:
                print(f"Error loading chapter {i} from {file_path}: {e}")
                continue

            for page_num, document in enumerate(full_chapter, start=1):
                if document.page_content.strip():  # Only add if not empty
                    documents.append(
                        Document(
                            page_content=document.page_content, 
                            metadata={"chapter": f"Chapter {i}", "page": page_num}
                        )
                    )
                else:
                    print(f"Warning: Empty page content in chapter {i}, page {page_num}. Skipping.")
        
        print(f"Documents loaded: {len(documents)} total documents")

        # Remove bookmarks file
        if os.path.exists(bookmark_path):
            os.remove(bookmark_path)
            print("Removed bookmarks file")

        # Add documents to vector database
        if documents:
            print("Adding documents to vector database...")
            # Add documents in batches for better performance
            batch_size = 10
            for i in tqdm(range(0, len(documents), batch_size), desc="Adding documents to vector database"):
                batch = documents[i:i+batch_size]
                vector_store.add_documents(batch)
            print(f"Added {len(documents)} documents to vector database")
        else:
            print("Warning: No documents to add to vector database")

    else:
        print("Chroma vector database is not empty, skipping document loading")

    llm = ChatOpenAI(temperature=0, model="gpt-4o-mini")
    filter = LLMChainFilter.from_llm(llm)
    pipeline_compressor = DocumentCompressorPipeline(
        transformers=[filter]
    )
    retriever = ContextualCompressionRetriever(
        base_compressor=pipeline_compressor, 
        base_retriever=vector_store.as_retriever(),
        max_documents=6,
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
