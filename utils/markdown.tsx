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

    // Headers (H6 → H1) - Beautiful, eye-catching styling
    html = html.replace(/^###### (.+)$/gm, '<h6 class="text-xs font-semibold text-white mt-3 mb-1.5 tracking-wide uppercase opacity-90">$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5 class="text-sm font-semibold text-white mt-3 mb-1.5 tracking-wide">$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-base font-bold text-white mt-4 mb-2 tracking-wide">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-white mt-5 mb-2.5 tracking-wide border-b border-[#007acc]/30 pb-1">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-[#4ec9b0] mt-6 mb-3 tracking-wide border-b-2 border-[#007acc] pb-2">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-extrabold text-white mt-7 mb-4 tracking-wide bg-gradient-to-r from-[#007acc] to-[#4ec9b0] bg-clip-text text-transparent pb-2 border-b-2 border-[#007acc]">$1</h1>');

    // Fenced code blocks (```lang ... ```) - Improved spacing
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-[#1e1e1e] text-[#d4d4d4] p-3 rounded-md overflow-x-auto my-3"><code>$1</code></pre>');

    // Inline code - Beautiful with accent color
    html = html.replace(/`([^`]+)`/g, '<code class="bg-[#2d2d30] px-2 py-1 rounded text-sm text-[#4ec9b0] font-mono border border-[#007acc]/20 shadow-sm">$1</code>');

    // Bold, italic, strikethrough - Enhanced with colors
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic text-[#ce9178]">$1</em>');
    html = html.replace(/~~(.*?)~~/g, '<del class="text-gray-500 line-through">$1</del>');

    // Blockquotes - Beautiful with accent and background
    html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-[#4ec9b0] bg-[#2d2d30] pl-4 pr-3 py-3 my-4 italic text-[#d4d4d4] rounded-r-md shadow-sm">$1</blockquote>');


    // Ordered lists - Beautiful with custom counters and spacing
    html = html.replace(/(?:^\d+\.\s.+\n?)+/gm, (match) => {
      const items = match
        .trim()
        .split("\n")
        .map((line) => line.replace(/^\d+\.\s(.+)/, '<li class="ml-3 mb-2 text-[#d4d4d4] leading-relaxed pl-1">$1</li>'))
        .join("");
      return `<ol class="list-decimal pl-6 my-4 marker:text-[#4ec9b0] marker:font-semibold">${items}</ol>`;
    });

    // Unordered lists - Beautiful with custom bullets
    html = html.replace(/(?:^[-*+]\s.+\n?)+/gm, (match) => {
      const items = match
        .trim()
        .split("\n")
        .map((line) => line.replace(/^[-*+]\s(.+)/, '<li class="ml-3 mb-2 text-[#d4d4d4] leading-relaxed pl-1">$1</li>'))
        .join("");
      return `<ul class="list-disc pl-6 my-4 marker:text-[#007acc] marker:text-lg">${items}</ul>`;
    });

    // Links - Beautiful hover effects
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#4ec9b0] underline decoration-[#007acc]/50 hover:decoration-[#007acc] hover:text-[#569cd6] transition-colors duration-200 font-medium">$1</a>');

    // Images - Beautiful with border and shadow
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-4 border border-[#3e3e42] shadow-lg" />');

    // Horizontal rules - Beautiful gradient
    html = html.replace(/^---$/gm, '<hr class="my-6 border-0 h-px bg-gradient-to-r from-transparent via-[#007acc] to-transparent" />');

    // Paragraphs - Enhanced readability
    html = html.replace(/^(?!<h\d|<pre|<blockquote|<ul|<ol|<li|<img|<hr|<p)(.+)$/gm, '<p class="text-[#d4d4d4] leading-relaxed my-2.5 text-[15px]">$1</p>');

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

    // Code block with beautiful styling and language badge
    parts.push(
      <div key={match.index} className="my-4 rounded-lg overflow-hidden border border-[#3e3e42] shadow-lg">
        {language && (
          <div className="bg-[#2d2d30] px-4 py-2 text-xs font-semibold text-[#4ec9b0] border-b border-[#3e3e42] flex items-center justify-between">
            <span className="uppercase tracking-wider">{language}</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-[#f48771]"></div>
              <div className="w-3 h-3 rounded-full bg-[#f5c763]"></div>
              <div className="w-3 h-3 rounded-full bg-[#5dc9a6]"></div>
            </div>
          </div>
        )}
        <SyntaxHighlighter
          language={language}
          style={dark}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            padding: "1rem",
            background: "#1e1e1e",
            fontSize: "0.9rem"
          }}
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
