import type { MockTestDetail } from "@/domain/mock-engine/types";

/**
 * Authored (production) sample mock test for the Phase 11 mock engine.
 *
 * PROVENANCE NOTICE:
 * This is an ORIGINAL ParikshaVerse practice simulation assembled from the
 * authored question bank. It is clearly labelled a sample practice mock and
 * makes no claim of being an official NEET paper, an official mock, or a
 * reproduction of any previous-year question paper.
 *
 * It is kept separate from the engine's test-only fixture mocks in
 * src/domain/mock-engine/fixtures.ts.
 */

export const AUTHORED_SAMPLE_MOCK_TEMPLATE_ID = "tpl_mock_authored_sample";

const now = new Date("2026-09-26T00:00:00.000Z");

export const AUTHORED_SAMPLE_MOCK_TEMPLATE: Omit<
  MockTestDetail,
  "id" | "workspaceId" | "createdAt" | "updatedAt"
> & { templateId: string } = {
  templateId: AUTHORED_SAMPLE_MOCK_TEMPLATE_ID,
  examId: "exam_neet",
  title: "Sample Practice Mock (ParikshaVerse Original)",
  description:
    "A representative practice simulation built from ParikshaVerse's original authored question bank, covering foundational Physics, Chemistry and Biology with standard competitive marking (+4 / -1).",
  type: "full_syllabus",
  durationMinutes: 35,
  totalQuestions: 30,
  markingScheme: {
    correctMarks: 4,
    incorrectPenalty: 1,
    unansweredMarks: 0,
  },
  sections: [
    {
      id: "sec_auth_phy",
      name: "Physics",
      description: "Foundational mechanics, gravitation, thermodynamics and electrostatics",
      displayOrder: 1,
      questionCount: 10,
      subjectId: "exam_neet_physics",
    },
    {
      id: "sec_auth_chm",
      name: "Chemistry",
      description: "Basic concepts, atomic structure, bonding, equilibrium and electrochemistry",
      displayOrder: 2,
      questionCount: 10,
      subjectId: "exam_neet_chemistry",
    },
    {
      id: "sec_auth_bio",
      name: "Biology",
      description: "Diversity, cell biology, physiology, genetics and ecology",
      displayOrder: 3,
      questionCount: 10,
      subjectId: "exam_neet_biology",
    },
  ],
  scheduledAt: null,
  source: "ParikshaVerse Authored Bank",
  externalUrl: null,
  provenance: "authored",
  status: "active",
};

/**
 * Stable per-workspace ID so repeated ensures never duplicate the sample mock.
 */
export function authoredSampleMockIdForWorkspace(workspaceId: string): string {
  return `mock_${workspaceId}_${AUTHORED_SAMPLE_MOCK_TEMPLATE_ID}`;
}

/**
 * Instantiates the authored sample mock for a given workspace.
 */
export function createAuthoredSampleMockForWorkspace(workspaceId: string): MockTestDetail {
  return {
    id: authoredSampleMockIdForWorkspace(workspaceId),
    workspaceId,
    examId: AUTHORED_SAMPLE_MOCK_TEMPLATE.examId,
    title: AUTHORED_SAMPLE_MOCK_TEMPLATE.title,
    description: AUTHORED_SAMPLE_MOCK_TEMPLATE.description,
    type: AUTHORED_SAMPLE_MOCK_TEMPLATE.type,
    scheduledAt: null,
    durationMinutes: AUTHORED_SAMPLE_MOCK_TEMPLATE.durationMinutes,
    totalQuestions: AUTHORED_SAMPLE_MOCK_TEMPLATE.totalQuestions,
    markingScheme: AUTHORED_SAMPLE_MOCK_TEMPLATE.markingScheme,
    sections: AUTHORED_SAMPLE_MOCK_TEMPLATE.sections,
    questionSelectionConfig: null,
    source: AUTHORED_SAMPLE_MOCK_TEMPLATE.source,
    externalUrl: null,
    provenance: AUTHORED_SAMPLE_MOCK_TEMPLATE.provenance,
    status: AUTHORED_SAMPLE_MOCK_TEMPLATE.status,
    createdAt: now,
    updatedAt: now,
  };
}
