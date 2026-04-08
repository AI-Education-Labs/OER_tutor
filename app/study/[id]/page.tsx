import { StudyInterface } from "@/components/study-interface"

interface StudyPageProps {
  params: Promise<{ id: string }>
}

export default async function StudyPage({ params }: StudyPageProps) {
  const resolved = await params
  const { id } = resolved

  return <StudyInterface textbookId={id} />
}
