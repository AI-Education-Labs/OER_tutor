import type React from "react"

export const formatMarkdown = (text: string): React.ReactNode => {
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  const formatInlineMarkdown = (t: string) => {
    let text = t
    text = text.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
    text = text.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-white mt-4 mb-2">$1</h2>')
    text = text.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-4 mb-3">$1</h1>')
    text = text.replace(/`([^`]+)`/g, '<code class="bg-[#3e3e42] px-1 py-0.5 rounded text-sm text-[#d4d4d4]">$1</code>')
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    text = text.replace(/\*(.*?)\*/g, '<em class="italic text-[#cccccc]">$1</em>')
    text = text.replace(/\n/g, "<br />")
    return <div dangerouslySetInnerHTML={{ __html: text }} />
  }

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(formatInlineMarkdown(text.slice(lastIndex, match.index)))
    const language = match[1] || "text"
    const code = match[2].trim()
    parts.push(
      <div key={match.index} className="my-2">
        <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-md overflow-hidden">
          <div className="bg-[#2d2d30] px-3 py-1 text-xs text-[#969696] border-b border-[#3e3e42]">{language}</div>
          <pre className="p-3 text-sm text-[#d4d4d4] overflow-x-auto">
            <code>{code}</code>
          </pre>
        </div>
      </div>,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) parts.push(formatInlineMarkdown(text.slice(lastIndex)))
  return parts.length > 1 ? <>{parts}</> : parts[0] || text
}
