import type { MockTestDetail } from "./types";

const now = new Date("2026-09-25T12:00:00.000Z");

/**
 * Standard fixture mock test templates for development, automated testing, and demo environments.
 *
 * PROVENANCE & ETHICS NOTICE:
 * All mock test definitions and their questions are educational fixtures created
 * specifically for engine verification. None of these mocks claim to be official
 * exam papers or previous year questions (PYQs).
 */
export const FIXTURE_MOCK_TEMPLATES: Array<
  Omit<MockTestDetail, "id" | "workspaceId" | "createdAt" | "updatedAt"> & {
    templateId: string;
  }
> = [
  {
    templateId: "tpl_mock_full_sample",
    examId: "exam_neet",
    title: "Full Syllabus Sample Mock (Demo)",
    description:
      "A timed multi-section practice simulation covering foundational Physics, Chemistry, and Biology concepts with standard competitive marking (+4 / -1).",
    type: "full_syllabus",
    durationMinutes: 15,
    totalQuestions: 12,
    markingScheme: {
      correctMarks: 4,
      incorrectPenalty: 1,
      unansweredMarks: 0,
    },
    sections: [
      {
        id: "sec_phy_sample",
        name: "Physics",
        description: "Mechanics, Vectors, and Dynamics",
        displayOrder: 1,
        questionCount: 4,
        subjectId: "exam_neet_physics",
      },
      {
        id: "sec_chm_sample",
        name: "Chemistry",
        description: "Chemical Bonding and Thermodynamics",
        displayOrder: 2,
        questionCount: 4,
        subjectId: "exam_neet_chemistry",
      },
      {
        id: "sec_bio_sample",
        name: "Biology",
        description: "Cell Structure and Division",
        displayOrder: 3,
        questionCount: 4,
        subjectId: "exam_neet_biology",
      },
    ],
    scheduledAt: null,
    source: "ParikshaVerse Synthetic Fixture",
    externalUrl: null,
    provenance: "fixture",
    status: "active",
  },
  {
    templateId: "tpl_mock_pc_sample",
    examId: "exam_neet",
    title: "Physics & Chemistry Core Sample Mock",
    description:
      "Targeted sectional practice covering Kinematics, Dynamics, Bonding, and Thermochemistry.",
    type: "subject",
    durationMinutes: 10,
    totalQuestions: 8,
    markingScheme: {
      correctMarks: 4,
      incorrectPenalty: 1,
      unansweredMarks: 0,
    },
    sections: [
      {
        id: "sec_pc_phy",
        name: "Physics Core",
        description: "Vectors & Laws of Motion",
        displayOrder: 1,
        questionCount: 4,
        subjectId: "exam_neet_physics",
      },
      {
        id: "sec_pc_chm",
        name: "Chemistry Core",
        description: "Bonding & Thermochemistry",
        displayOrder: 2,
        questionCount: 4,
        subjectId: "exam_neet_chemistry",
      },
    ],
    scheduledAt: null,
    source: "ParikshaVerse Synthetic Fixture",
    externalUrl: null,
    provenance: "fixture",
    status: "active",
  },
  {
    templateId: "tpl_mock_bio_sample",
    examId: "exam_neet",
    title: "Biology Diagnostics Sample Mock",
    description:
      "Rapid diagnostic mock covering Cell Biology, Cell Cycle, and Mitosis/Meiosis transitions.",
    type: "chapter",
    durationMinutes: 8,
    totalQuestions: 6,
    markingScheme: {
      correctMarks: 4,
      incorrectPenalty: 1,
      unansweredMarks: 0,
    },
    sections: [],
    scheduledAt: null,
    source: "ParikshaVerse Synthetic Fixture",
    externalUrl: null,
    provenance: "fixture",
    status: "active",
  },
];

/**
 * Instantiates fixture mock tests for a given workspace.
 */
export function createFixtureMocksForWorkspace(workspaceId: string): MockTestDetail[] {
  return FIXTURE_MOCK_TEMPLATES.map((tpl) => ({
    id: `mock_${workspaceId}_${tpl.templateId}`,
    workspaceId,
    examId: tpl.examId,
    title: tpl.title,
    description: tpl.description,
    type: tpl.type,
    scheduledAt: null,
    durationMinutes: tpl.durationMinutes,
    totalQuestions: tpl.totalQuestions,
    markingScheme: tpl.markingScheme,
    sections: tpl.sections,
    questionSelectionConfig: null,
    source: "ParikshaVerse Synthetic Fixture",
    externalUrl: null,
    provenance: tpl.provenance,
    status: tpl.status,
    createdAt: now,
    updatedAt: now,
  }));
}
