from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os
import logging


router = APIRouter()
logger = logging.getLogger(__name__)


PUBLIC_DIR = "./public"

# DEPRECIATED
@router.get("/api/pdf/{textbook}/{chapter}")
async def get_pdf(textbook: str, chapter: int):
    """Serve a PDF file for a specific textbook chapter."""
    # Construct the file path
    file_path = os.path.join(PUBLIC_DIR, textbook, f"chapter{chapter}.pdf")

    logger.info(f"Attempting to serve PDF: {file_path}")

    # Check if the file exists
    if not os.path.isfile(file_path):
        logger.error(f"PDF file not found: {file_path}")
        raise HTTPException(status_code=404, detail=f"PDF file not found: {file_path}")

    # Return the file
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=f"{textbook}_chapter{chapter}.pdf",
    )


