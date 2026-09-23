"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Target, RotateCcw, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/shared/section-header";

const ACTIONS = [
  {
    title: "Study",
    description: "Browse syllabus",
    href: "/app/study",
    icon: BookOpen,
  },
  {
    title: "Practice",
    description: "Question sets",
    href: "/app/study",
    icon: Target,
  },
  {
    title: "Revise",
    description: "Scheduled queue",
    href: "/app/study",
    icon: RotateCcw,
  },
  {
    title: "Plan",
    description: "Study calendar",
    href: "/app/planner",
    icon: Calendar,
  },
];

export function QuickActions() {
  return (
    <section>
      <SectionHeader title="Quick Actions" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
            >
              <Card
                className="p-3.5 h-full flex flex-col justify-between transition-all group-hover:border-primary/40 group-hover:bg-surface-tint/30"
                variant="base"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tint text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="mt-2.5">
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {action.title}
                  </p>
                  <p className="text-[10px] text-foreground-subtle">
                    {action.description}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
