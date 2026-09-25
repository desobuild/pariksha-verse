import * as React from "react";
import { Button } from "@/components/ui/button";
import type { PracticeSubjectFilter, PracticePerformanceFilter } from "@/domain/practice";
import type { SubjectTaxonomyInfo } from "@/domain/dashboard";

export interface PracticeFiltersProps {
  subjects: SubjectTaxonomyInfo[];
  selectedSubject: PracticeSubjectFilter;
  onSelectSubject: (subject: PracticeSubjectFilter) => void;
  selectedPerformance: PracticePerformanceFilter;
  onSelectPerformance: (perf: PracticePerformanceFilter) => void;
}

export function PracticeFilters({
  subjects,
  selectedSubject,
  onSelectSubject,
  selectedPerformance,
  onSelectPerformance,
}: PracticeFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pb-1">
      {/* Subject Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by subject">
        <Button
          variant={selectedSubject === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectSubject("all")}
          className="min-h-[40px] text-xs font-semibold rounded-xl"
          role="tab"
          aria-selected={selectedSubject === "all"}
        >
          All Subjects
        </Button>
        {subjects.map((sub) => (
          <Button
            key={sub.slug}
            variant={selectedSubject === sub.slug ? "default" : "ghost"}
            size="sm"
            onClick={() => onSelectSubject(sub.slug)}
            className="min-h-[40px] text-xs font-semibold rounded-xl"
            role="tab"
            aria-selected={selectedSubject === sub.slug}
          >
            {sub.name}
          </Button>
        ))}
      </div>

      {/* Performance Filter Tabs */}
      <div className="flex items-center gap-1.5 self-start sm:self-auto" role="tablist" aria-label="Filter by performance">
        <Button
          variant={selectedPerformance === "all" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onSelectPerformance("all")}
          className="min-h-[36px] text-xs font-semibold"
          role="tab"
          aria-selected={selectedPerformance === "all"}
        >
          All
        </Button>
        <Button
          variant={selectedPerformance === "weak" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onSelectPerformance("weak")}
          className="min-h-[36px] text-xs font-semibold"
          role="tab"
          aria-selected={selectedPerformance === "weak"}
        >
          Weak (&lt;60%)
        </Button>
        <Button
          variant={selectedPerformance === "practiced" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onSelectPerformance("practiced")}
          className="min-h-[36px] text-xs font-semibold"
          role="tab"
          aria-selected={selectedPerformance === "practiced"}
        >
          Practiced
        </Button>
      </div>
    </div>
  );
}
