import { StudyInterface } from "@/components/study-interface"

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StudyInterface textbookId={id} />
}
