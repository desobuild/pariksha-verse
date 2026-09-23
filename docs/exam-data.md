# ParikshaVerse — Exam Data Foundation (NEET & Extensibility)

This document formalizes the canonical exam dataset standards for ParikshaVerse, records the official source, baseline version, and provenance status for the inaugural NEET (UG) dataset, and details the procedure for onboarding future exams.

---

## 1. Architectural Mandate: "NEET Is Data"

ParikshaVerse treats competitive exams strictly as **data definitions**, not application business logic:
- **No Hardcoded Scoring**: Scoring rules reside in `exam_attempts.scoring_config`, never in code branches.
- **No Hardcoded Subjects**: Subjects are stored in the relational `subjects` table.
- **Unified Hierarchy**: Every supported exam strictly follows the 5-tier canonical hierarchy:

```
Exam (e.g. NEET)
  └── Exam Attempt (e.g. NEET 2027)
        └── Subject (e.g. Biology)
              └── Chapter (e.g. Human Reproduction)
                    └── Topic (e.g. Menstrual Cycle)
```

---

## 2. Canonical NEET (UG) Dataset Provenance

### Exact Official Source
- **Issuing Authority**: National Medical Commission (NMC) — Undergraduate Medical Education Board (UGMEB).
- **Public Notice Reference**: Public Notice No. `U.14023/19/2023-UGMEB`.
- **Official Source Date**: 6th October 2023.
- **Syllabus Year**: NEET-UG 2024 (official revised syllabus finalized by NMC).
- **Subsequent Cycles**: NMC subsequently published the NEET-UG 2025 syllabus and NMC/NTA published the NEET-UG 2026 syllabus.
- **Verification Date**: 23rd September 2026.

### Status for Target Attempt: NEET-UG 2027
> [!IMPORTANT]
> **Provisional Baseline**: As of the verification date (23rd September 2026), **no official NEET-UG 2027 syllabus has been issued or identified** on official NTA or NMC document portals.
>
> The seeded dataset for `neet-2027` is therefore **provisional**. It is derived directly from the official NMC NEET-UG 2024 baseline. When the official NTA/NMC NEET-UG 2027 information bulletin and syllabus notification are published, the dataset will be audited and reconciled without requiring any schema changes.

---

## 3. Official Syllabus Structure vs. ParikshaVerse Application Taxonomy

It is vital to distinguish between the official document structure published by NMC/NTA and ParikshaVerse's internal study taxonomy:

### Official NMC Syllabus Structure
The official NMC syllabus document organizes content strictly into narrative **Units**:
- **Physics**: 20 Units (Units 1 to 20), ranging from "Physics and Measurement" to "Experimental Skills".
- **Chemistry**: 20 Units across Physical Chemistry (Units 1–8), Inorganic Chemistry (Units 9–12), and Organic Chemistry (Units 13–20).
- **Biology**: 10 Units (Units 1 to 10), covering "Diversity in Living World" through "Ecology and Environment".
- **Granularity**: The official document presents topics as dense, comma-separated and semicolon-separated narrative paragraphs within each Unit. It does **not** specify individual chapter numbers, separate sub-chapter IDs, or granular tracking topic slugs.

### ParikshaVerse Application Taxonomy
To power daily study planning, spaced repetition, progress metrics, and question-level practice tracking, ParikshaVerse decomposes the official narrative into an **application-level taxonomy**:
- **Physics & Chemistry**: The 20 official Units in each subject are mapped 1:1 into study `chapters`, with distinct sub-topics extracted from the syllabus text into ordered `topics`.
- **Biology**: Unit 6 of the official syllabus ("Reproduction") combines flowering plant reproduction, human reproduction, and reproductive health in a single unit. ParikshaVerse decomposes Unit 6 into **3 practical study chapters** matching NCERT textbook divisions familiar to medical aspirants:
  1. `sexual-reproduction-in-flowering-plants`
  2. `human-reproduction`
  3. `reproductive-health`
  This brings Biology to 12 study chapters (and 37 tracking topics), and the total curriculum to **52 chapters** and **139 topics**.
- **Taxonomy Scope**: This chapter and topic breakdown is an **application taxonomy** engineered for student tracking, **not** an official NMC unit naming or hierarchy.

```
Subject: Biology
  └── Chapter: Human Reproduction (Application Chapter)
        ├── Topic 1: Male and Female Reproductive Systems Anatomy
        ├── Topic 2: Microscopic Anatomy of Testis and Ovary
        ├── Topic 3: Gametogenesis: Spermatogenesis and Oogenesis
        ├── Topic 4: Menstrual Cycle Phases and Hormonal Regulation
        ├── Topic 5: Fertilisation, Blastocyst Formation and Implantation
        └── Topic 6: Pregnancy, Placenta Formation, Parturition and Lactation
```

### Dataset Summary

| Subject | Application Chapters | Application Topics | Canonical Official Focus |
| :--- | :---: | :---: | :--- |
| **Physics** | 20 | 58 | Mechanics, Thermodynamics, Electromagnetism, Optics, Modern Physics, Experimental Skills |
| **Chemistry** | 20 | 44 | Physical Chemistry (Units 1–8), Inorganic Chemistry (Units 9–12), Organic Chemistry (Units 13–20) |
| **Biology** | 12 | 37 | Diversity, Structural Organisation, Cell Biology, Plant Physiology, Human Physiology, Reproduction, Genetics, Biotechnology, Ecology |
| **Total** | **52** | **139** | Full NMC NEET (UG) Syllabus Content |

---

## 4. How Future Exams Are Added

Because ParikshaVerse enforces the data-driven model, onboarding new exams (e.g. JEE Main, JEE Advanced, UPSC CSE, GATE, CAT, CUET) requires **zero schema migrations** and **zero code changes**:

### Step-by-step Onboarding Procedure:
1. **Source Identification**: Obtain the authoritative notification from the conducting agency (e.g. NTA for JEE Main, UPSC for Civil Services, IIT for GATE).
2. **Create Data Definition**: In `src/db/seeds/data/<exam-slug>.ts`, define the `SeedExamData` object:
   - `exam`: slug, name, category (e.g. `engineering`, `civil-services`), metadata.
   - `attempt`: cycle slug, target date, and `scoringConfig`:
     ```typescript
     scoringConfig: {
       totalMarks: 300,
       defaultRule: { correctMarks: 4, incorrectMarks: -1, unattemptedMarks: 0 },
       durationMinutes: 180,
       totalQuestions: 75,
       sections: [
         { name: "Physics", subjectSlug: "physics", totalQuestions: 25, scoringRule: ... },
         { name: "Chemistry", subjectSlug: "chemistry", totalQuestions: 25, scoringRule: ... },
         { name: "Mathematics", subjectSlug: "mathematics", totalQuestions: 25, scoringRule: ... },
       ]
     }
     ```
   - `subjects`: subjects, chapters, and topics with stable slugs and display orders.
3. **Execute Seed**: Run `seedExam(db, examData)` or include the dataset in `src/db/seeds/generate-sql.ts`.
4. **Idempotency Guarantee**: The existing `seedExam` function uses SQLite `ON CONFLICT DO UPDATE` on all unique constraints `(slug)`, `(exam_id, slug)`, `(subject_id, slug)`, and `(chapter_id, slug)`, preventing duplication on repeated runs.
