import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { questionRepository } from "@/repositories/question.repository";
import type { PracticeScope } from "@/domain/practice-engine";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scopeType = searchParams.get("scopeType");
  const scopeId = searchParams.get("scopeId");
  const examId = searchParams.get("examId") || undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const db = getDb();

  if (scopeType && scopeId) {
    let scope: PracticeScope;
    if (scopeType === "topic") {
      scope = { type: "topic", topicId: scopeId };
    } else if (scopeType === "subject") {
      scope = { type: "subject", subjectId: scopeId };
    } else {
      scope = { type: "mixed", examAttemptId: scopeId };
    }

    const questions = await questionRepository.getQuestionsForScope(db, {
      examId,
      scope,
      limit,
    });
    return NextResponse.json({ questions });
  }

  const all = await questionRepository.getAllQuestions(db);
  return NextResponse.json({ questions: all });
}
