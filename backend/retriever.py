import os
import json
import shutil

from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings, OpenAI
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import DocumentCompressorPipeline, LLMChainFilter
from langchain_core.documents import Document
from langchain_chroma import Chroma
import chromadb

from PyPDF2 import PdfReader, PdfWriter

import backend.bookmark as bookmark

from dotenv import load_dotenv
from tqdm import tqdm

# Load .env file
env_path = os.path.join(os.path.dirname(__file__), ".env")
if not load_dotenv(env_path):
    raise Exception("Failed to load .env file") 
else:
    print(".env file loaded")

# Get OPENAI_API_KEY
api_key = os.environ["OPENAI_API_KEY"]
if not api_key:
    raise Exception("OPENAI_API_KEY not found in .env file")

os.environ["OPENAI_API_KEY"] = api_key

def create_retriever(textbook_path, textbook_name):
    """
    Creates a retriever given an OpenStax textbook pdf

    Args:
        textbook_path (str): Path to the OpenStax textbook pdf
        textbook_name (str): Name of the OpenStax textbook

    Returns:
        ContextualCompressionRetriever
    """

    if not os.path.exists(textbook_path):
        raise Exception("Textbook path does not exist")

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
        if not os.path.exists(bookmark_path):
            bookmark.initialize_bookmarks(textbook_path, bookmark_path)
        with open(bookmark_path, "r") as f:
            bookmarks = json.load(f)
        print("Bookmarks loaded")

        # Create documents
        documents = []

        page_ranges = []
        for i in range(1, bookmarks["chapter_num"]+1):
            start_page = bookmarks[f"chapter {i}"]["page_num"]
            end_page = bookmarks[f"chapter {i}"]["last_page"]
            page_ranges.append((start_page - 1, end_page))

        reader = PdfReader(textbook_path)

        for idx, (start_page, end_page) in enumerate(page_ranges):
            writer = PdfWriter()

            for page_num in range(start_page, end_page):
                writer.add_page(reader.pages[page_num])

            output_pdf = os.path.join("./data", f"chapter{idx+1}.pdf")

            with open(output_pdf, "wb") as f:
                writer.write(f)

        # Load documents
        for i in tqdm(range(1, bookmarks["chapter_num"]+1), desc="Loading documents"):
            file_path = f"./data/chapter{i}.pdf"
            loader = PyPDFLoader(file_path)
            full_chapter = loader.load()

            for page_num, document in enumerate(full_chapter, start=1):
                documents.append(
                    Document(
                        page_content=document.page_content, 
                        metadata={"chapter": f"Chapter {i}", "page": page_num}
                    )
                )
        print("Documents loaded")

        target_dir = f"./data/{textbook_name}"
        os.makedirs(target_dir, exist_ok=True)

        # Move chapter PDFs to the new folder
        for i in range(1, bookmarks["chapter_num"] + 1):
            src_path = f"./data/chapter{i}.pdf"
            dst_path = os.path.join(target_dir, f"chapter{i}.pdf")
            if os.path.exists(src_path):
                shutil.move(src_path, dst_path)

        print(f"Moved chapter PDFs to {target_dir}")

        # Remove bookmarks file
        if os.path.exists(bookmark_path):
            os.remove(bookmark_path)
        print("Removed bookmarks file")

        # Add documents to vector database
        for doc in tqdm(documents, desc="Adding documents to vector database"):
            vector_store.add_documents([doc])

    else:
        print("Chroma vector database is not empty, skipping document loading")

    llm = OpenAI(temperature=0)
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
    
