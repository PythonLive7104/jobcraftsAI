from docx import Document
from pypdf import PdfReader


def extract_text_from_docx(path_or_file) -> str:
    """Accept file path (str) or file-like object."""
    doc = Document(path_or_file)
    parts: list[str] = []
    for paragraph in doc.paragraphs:
        text = (paragraph.text or "").strip()
        if text:
            parts.append(text)
    return "\n".join(parts)


def extract_text_from_pdf(path_or_file) -> str:
    """Accept file path (str) or file-like object."""
    reader = PdfReader(path_or_file)
    parts: list[str] = []
    for page in reader.pages:
        text = (page.extract_text() or "").strip()
        if text:
            parts.append(text)
    return "\n".join(parts)