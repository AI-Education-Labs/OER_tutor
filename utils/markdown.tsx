import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark } from "react-syntax-highlighter/dist/esm/styles/prism";

export const formatMarkdown = (text: string): React.ReactNode => {
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const formatInlineMarkdown = (t: string) => {
    let html = t;

    // Headers (H6 → H1) - Improved spacing
    html = html.replace(/^###### (.+)$/gm, '<h6 class="text-xs font-semibold text-white mt-3 mb-1.5">$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5 class="text-sm font-semibold text-white mt-3 mb-1.5">$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold text-white mt-4 mb-2">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-white mt-5 mb-2.5">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-6 mb-3">$1</h1>');

    // Fenced code blocks (```lang ... ```) - Improved spacing
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-[#1e1e1e] text-[#d4d4d4] p-3 rounded-md overflow-x-auto my-3"><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-[#3e3e42] px-1.5 py-0.5 rounded text-sm text-[#d4d4d4]">$1</code>');

    // Bold, italic, strikethrough
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-[#cccccc]">$1</em>');
    html = html.replace(/~~(.*?)~~/g, '<del class="text-gray-400">$1</del>');

    // Blockquotes - Improved spacing
    html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-gray-500 pl-4 py-2 my-3 italic text-gray-300">$1</blockquote>');


    // Ordered lists (group consecutive numbered items) - Improved spacing
    html = html.replace(/(?:^\d+\.\s.+\n?)+/gm, (match) => {
      const items = match
        .trim()
        .split("\n")
        .map((line) => line.replace(/^\d+\.\s(.+)/, '<li class="ml-2 mb-1">$1</li>'))
        .join("");
      return `<ol class="list-decimal pl-6 my-3">${items}</ol>`;
    });

    // Unordered lists (group consecutive -/*/+ items) - Improved spacing
    html = html.replace(/(?:^[-*+]\s.+\n?)+/gm, (match) => {
      const items = match
        .trim()
        .split("\n")
        .map((line) => line.replace(/^[-*+]\s(.+)/, '<li class="ml-2 mb-1">$1</li>'))
        .join("");
      return `<ul class="list-disc pl-6 my-3">${items}</ul>`;
    });

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline">$1</a>');

    // Images - Improved spacing
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-md my-3" />');

    // Horizontal rules - Improved spacing
    html = html.replace(/^---$/gm, '<hr class="my-5 border-gray-600" />');

    // Paragraphs (lines not matched by other rules) - Improved spacing and line height
    html = html.replace(/^(?!<h\d|<pre|<blockquote|<ul|<ol|<li|<img|<hr|<p)(.+)$/gm, '<p class="text-white leading-relaxed my-2">$1</p>');

    // Line breaks - Only convert double newlines to prevent excessive spacing
    html = html.replace(/\n\n+/g, "<br />");


    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before the code block
    if (match.index > lastIndex) {
      parts.push(formatInlineMarkdown(text.slice(lastIndex, match.index)));
    }

    const language = match[1] || "text";
    const code = match[2].trim();

    // Code block with improved spacing
    parts.push(
      <div key={match.index} className="my-3">
        <SyntaxHighlighter
          language={language}
          style={dark}
          customStyle={{ margin: 0, borderRadius: "0.375rem", overflowX: "auto" }}
          showLineNumbers={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    parts.push(formatInlineMarkdown(text.slice(lastIndex)));
  }

  return parts.length > 1 ? <>{parts}</> : parts[0] || text;
};
