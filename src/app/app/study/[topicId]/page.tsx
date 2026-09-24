"use client";

import { useParams } from "next/navigation";
import { TopicDetailView } from "@/components/study/topic-detail-view";

/**
 * Topic detail (Phase 7): status updates, study-session logging, and
 * revision/practice information for a single canonical syllabus topic.
 */
export default function TopicDetailPage() {
  const params = useParams<{ topicId: string }>();
  const topicId = Array.isArray(params?.topicId) ? params.topicId[0] : params?.topicId;
  return <TopicDetailView topicId={topicId ? decodeURIComponent(topicId) : ""} />;
}
