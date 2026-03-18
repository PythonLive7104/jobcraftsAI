import logging
from celery import shared_task
from django.core.exceptions import ObjectDoesNotExist

logger = logging.getLogger(__name__)


def _sanitize_extracted_text(text: str) -> str:
    """Remove NUL chars that break PostgreSQL/JSON."""
    if not text:
        return text
    return text.replace("\x00", "")


@shared_task(bind=True, name="resumeai.parse_resume")
def parse_resume_task(self, resume_id: int) -> None:
    """
    Extract text from an uploaded resume (PDF or DOCX) and update the Resume record.
    Runs asynchronously in a Celery worker to avoid blocking the API.
    """
    from .models import Resume
    from .utils import extract_text_from_pdf, extract_text_from_docx

    try:
        resume = Resume.objects.get(id=resume_id)
    except ObjectDoesNotExist:
        logger.warning("parse_resume_task: Resume id=%s not found", resume_id)
        return

    if resume.parse_status != "processing":
        logger.info("parse_resume_task: Resume id=%s already %s, skipping", resume_id, resume.parse_status)
        return

    file_type = (resume.file_type or "pdf").lower()
    try:
        path = getattr(resume.original_file, "path", None)
        if path:
            if file_type == "pdf":
                text = extract_text_from_pdf(path)
            else:
                text = extract_text_from_docx(path)
        else:
            with resume.original_file.open("rb") as fp:
                if file_type == "pdf":
                    text = extract_text_from_pdf(fp)
                else:
                    text = extract_text_from_docx(fp)

        resume.extracted_text = _sanitize_extracted_text(text or "")
        resume.parse_status = "done"
        resume.save(update_fields=["extracted_text", "parse_status"])
        logger.info("parse_resume_task: Resume id=%s parsed successfully", resume_id)
    except Exception as e:
        resume.parse_status = "failed"
        resume.parse_error = str(e)
        resume.save(update_fields=["parse_status", "parse_error"])
        logger.exception("parse_resume_task: Resume id=%s failed: %s", resume_id, e)
