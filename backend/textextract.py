import PyPDF2

def text_extract_with_save(pdf_path):
    with open(pdf_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
        with open(pdf_path.replace(".pdf", ".txt"), "w", encoding="utf-8") as file:
            file.write(text)
        return text

def text_extract(pdf_path):
    with open(pdf_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
        return text
