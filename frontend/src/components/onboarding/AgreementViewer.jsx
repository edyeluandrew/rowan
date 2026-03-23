import { useRef, useState, useEffect } from 'react';

/**
 * AgreementViewer — scrollable markdown agreement with bottom-scroll detection.
 * Props: content (markdown string), onScrolledToBottom()
 */
export default function AgreementViewer({ content, onScrolledToBottom }) {
  const containerRef = useRef(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
        if (!hasScrolledToBottom) {
          setHasScrolledToBottom(true);
          onScrolledToBottom?.();
        }
      }
    };

    el.addEventListener('scroll', handleScroll);
    /* Also check on mount in case content is short enough to not need scrolling */
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [content, hasScrolledToBottom, onScrolledToBottom]);

  const renderMarkdown = (md) => {
    if (!md) return null;
    return md.split('\n').map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-rowan-yellow font-bold text-sm mt-4 mb-1">{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-rowan-yellow font-bold text-base mt-4 mb-1">{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={i} className="text-rowan-yellow font-bold text-lg mt-4 mb-2">{line.slice(2)}</h1>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={i} className="text-rowan-text text-sm leading-relaxed ml-4 list-disc">{line.slice(2)}</li>;
      }
      if (line.match(/^\d+\. /)) {
        return <li key={i} className="text-rowan-text text-sm leading-relaxed ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="text-rowan-text text-sm leading-relaxed font-bold">{line.slice(2, -2)}</p>;
      }
      if (line.trim() === '') {
        return <br key={i} />;
      }
      return <p key={i} className="text-rowan-text text-sm leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="max-h-64 overflow-y-auto bg-rowan-surface border border-rowan-border rounded-md p-4"
      >
        {renderMarkdown(content)}
      </div>
      {/* Gradient overlay to hint more content below */}
      {!hasScrolledToBottom && (
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-rowan-surface to-transparent rounded-b-md pointer-events-none" />
      )}
    </div>
  );
}
