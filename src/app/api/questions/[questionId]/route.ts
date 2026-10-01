import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { questionRepository } from "@/repositories/question.repository";
import { apiErrorResponse } from "@/lib/observability/api-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questionId } = await params;
    const db = getDb();
    const q = await questionRepository.getQuestionById(db, questionId);

    if (!q) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json(q);
  } catch (error) {
    return apiErrorResponse({
      event: "api.questions.detail.failure",
      error,
      request,
      message: "Failed to load question",
    });
  }
}
