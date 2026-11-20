// Text helpers: escaping, inline formatting for lesson prose, and a tiny code highlighter.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Lesson prose is HTML plus two shortcuts:
//   [[key]] or [[key|shown text]]  → glossary term with a hover/tap definition
//   `code`                         → inline code (escaped)
//   **bold**                       → <b>bold</b>
//   *italic*                       → <i>italic</i> (used for console button and menu names)
export function fmt(s) {
  if (!s) return '';
  // odd parts are `code` spans (escaped, untouched); even parts get **bold** and [[glossary]] terms
  return String(s).split(/(`[^`]+`)/g).map((part, i) => (i % 2
    ? `<code>${esc(part.slice(1, -1))}</code>`
    : part
      .replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<i>$2</i>')
      .replace(/\[\[([\w-]+)(?:\|([^\]]+))?\]\]/g, (_, k, label) => `<span class="term" tabindex="0" data-t="${k}">${label || k}</span>`))).join('');
}

const KW = 'const|let|var|function|return|if|else|for|while|do|import|from|export|default|async|await|new|class|extends|this|null|undefined|true|false|typeof|instanceof|try|catch|finally|throw|of|in|switch|case|break|continue|yield|static|super|void|delete|interface|type|enum|implements|public|private|readonly|as|def|elif|lambda|None|True|False|pass|self|not|and|or|is|with';
const KWR = new RegExp(`^(?:${KW})$`);

function rules(lang) {
  const hashComment = ['bash', 'sh', 'py', 'python', 'yaml', 'toml'].includes(lang);
  const parts = [
    '(\\/\\/.*$|\\/\\*.*?\\*\\/|<!--.*?-->' + (hashComment ? '|#.*$' : '') + ')', // 1 comment
    '(`(?:\\\\.|[^`])*`|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')', // 2 string
    '(<\\/?[A-Za-z][\\w.:-]*|\\/?>)', // 3 tag
    '(\\b\\d+(?:\\.\\d+)?\\b)', // 4 number
    '([A-Za-z_$][\\w$]*)(?=\\s*\\()', // 5 function call
    '([A-Za-z_$][\\w$]*)', // 6 word
  ];
  return new RegExp(parts.join('|'), 'g');
}

// returns an array of HTML strings, one per line
export function highlight(src, lang = 'js') {
  const plain = ['text', 'txt', 'http', 'out', 'tree'].includes(lang);
  return String(src).replace(/\t/g, '  ').split('\n').map((line) => {
    if (plain) {
      if (lang === 'http' || lang === 'out') return esc(line).replace(/(\/\/.*)$/, '<span class="tk-c">$1</span>');
      return esc(line);
    }
    const rx = rules(lang);
    let out = '', last = 0, m;
    while ((m = rx.exec(line))) {
      out += esc(line.slice(last, m.index));
      const [tok, c, s, t, num, fn, w] = m;
      if (c) out += `<span class="tk-c">${esc(tok)}</span>`;
      else if (s) out += `<span class="tk-s">${esc(tok)}</span>`;
      else if (t) out += `<span class="tk-t">${esc(tok)}</span>`;
      else if (num) out += `<span class="tk-n">${esc(tok)}</span>`;
      else if (fn) out += KWR.test(fn) ? `<span class="tk-k">${esc(tok)}</span>` : `<span class="tk-f">${esc(tok)}</span>`;
      else if (w) out += KWR.test(w) ? `<span class="tk-k">${esc(tok)}</span>` : /^[A-Z]/.test(w) ? `<span class="tk-p">${esc(tok)}</span>` : esc(tok);
      else out += esc(tok);
      last = m.index + tok.length;
      if (tok.length === 0) rx.lastIndex++;
    }
    return out + esc(line.slice(last));
  });
}
