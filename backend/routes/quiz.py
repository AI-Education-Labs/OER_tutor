from fastapi import APIRouter, Depends, HTTPException, status
from backend.features.quiz.models import *
from backend.routes.auth import validate_cookie_token
from backend.services.openai_client import get_openai_client
from typing import Dict, List, Any
from backend.features.textbooks.service import get_textbook_chapter_txt
from backend.db.models import UserQuiz
router = APIRouter()

@router.post("/generate", response_model=GeneratedQuiz)
async def generate_quiz(req: GenerateRequest, current_user = Depends(validate_cookie_token)):
    """
    Generate quiz from textbook chapter context using LLM.

    Request Body:
    - textbook_id: The ID of the textbook
    - chapter: The chapter of the textbook to generate the quiz for
    - num_questions: The number of questions to generate for the quiz
    """
    client = get_openai_client()

    system_prompt = f"You are a helpful tutor for a student currently studying a textbook. Help create a formatted quiz for the student. Each question should be a multiple choice question with four options and one correct answer. The options should be realistic but clearly wrong to someone who understands the material. Generate a multiple choice quiz with {req.num_questions} questions based on the following their current chapter: "

    # Get the text from the chapter stored in S3 via shared helper
    chapter_text = await get_textbook_chapter_txt(req.textbook_id, req.chapter) # TODO: validate that the user has access to this textbook/chapter

    try:
        response = client.beta.chat.completions.parse(
            model="gpt-4.1",
            messages=[
                {"role": "developer", "content": system_prompt},
                {"role": "system","content": chapter_text}, # Provide context as system message, allows for caching of developer prompt
                {"role": "user", "content": "Generate a quiz"}
            ],
            response_format=GeneratedQuiz
        )

        quiz = response.choices[0].message.parsed

        if not quiz:
            raise HTTPException(status_code=500, detail="Failed to parse quiz data from OpenAI response")
        # Persist quiz for the user
        user_id = current_user if isinstance(current_user, str) else getattr(current_user, "id", current_user)
        quizdoc =  UserQuiz(
            user_uuid=user_id,
            quiz=quiz,
            chapter=req.chapter,
            textbook_id=req.textbook_id,
            quiz_result={},
        )
        await quizdoc.insert()
        return quiz
    except Exception as e:
        print(f"Error generating quiz: {e}") #TODO: proper logging
        raise HTTPException(status_code=500, detail=f"Internal server error")


# TODO: this could get scoped down to the specific book they are working on
@router.get("/list", status_code=status.HTTP_200_OK, response_model=List[QuizItem])
async def list_user_quizzes(current_user:str = Depends(validate_cookie_token)):
    """
    List all quizzes for the current user.

    user is obtained from the validated cookie token.
    """
    userQuizzes = await UserQuiz.find(UserQuiz.user_uuid == current_user).to_list()
    return userQuizzes

@router.get("/{item_id}", status_code=status.HTTP_200_OK, response_model=QuizItem)
async def get_user_quiz(item_id: str, current_user = Depends(validate_cookie_token)):
    """
    Get a specific quiz for the current user by id.
    """
    quiz = await UserQuiz.get(item_id)
    # don't show quiz if it doesn't belong to user
    if quiz is None or quiz.user_uuid != current_user:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.delete("/{item_id}", status_code=status.HTTP_200_OK, response_model=DeleteResponse)
async def delete_user_quiz(item_id: str, current_user = Depends(validate_cookie_token)):
    """
    Delete a specific quiz for the current user.
    """
    quiz = await UserQuiz.get(item_id)
    # don't delete quiz if it doesn't belong to user
    if quiz is None or quiz.user_uuid != current_user:
        raise HTTPException(status_code=404, detail="Quiz not found")
    await quiz.delete()
    return DeleteResponse(ok=True)
