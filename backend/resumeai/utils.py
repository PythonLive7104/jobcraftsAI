from docx import Document
from pypdf import PdfReader


def _sanitize_text(text: str) -> str:
    """Remove NUL and other control chars that break DB/JSON."""
    if not text:
        return text
    return text.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")


def extract_text_from_docx(path_or_file) -> str:
    """Accept file path (str) or file-like object."""
    doc = Document(path_or_file)
    parts: list[str] = []
    for paragraph in doc.paragraphs:
        text = _sanitize_text((paragraph.text or "").strip())
        if text:
            parts.append(text)
    return _sanitize_text("\n".join(parts))


def extract_text_from_pdf(path_or_file) -> str:
    """Accept file path (str) or file-like object."""
    reader = PdfReader(path_or_file)
    parts: list[str] = []
    for page in reader.pages:
        text = _sanitize_text((page.extract_text() or "").strip())
        if text:
            parts.append(text)
    return _sanitize_text("\n".join(parts))