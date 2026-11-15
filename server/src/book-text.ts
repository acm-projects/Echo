import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import AdmZip from 'adm-zip';

// Pulls readable text out of an uploaded book and splits it into chapters, so the server can narrate and publish
// one chapter at a time. Chapters come from the file's own structure (an EPUB's spine, or "Chapter 3" style heading
// lines in PDF/TXT/MD), which is free and deterministic. A book with fewer than two chapters found is one chapter.

export type BookChapter = { title?: string; text: string };
export type ExtractedBook = { text: string; chapters: BookChapter[] };

// Below this a "chapter" is a contents entry, a part divider, a cover or a running page head.
const MIN_CHAPTER_WORDS = 40;
// Front matter this short (a title page) is read at the start of the first chapter instead of on its own.
const MAX_LOOSE_FRONT_WORDS = 150;

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

const NUMBER_WORD = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)';
// "Chapter 3", "CHAPTER IV: The Storm", "Part Two", "Chapter Twenty-One". The number is the heading's identity.
const NUMBERED = new RegExp(`^(chapter|part|book)\\s+(\\d{1,3}|[ivxlcdm]{1,7}|${NUMBER_WORD}(?:[\\s-]+${NUMBER_WORD})*)\\b\\.?(?:\\s*[:.\\-–—]?\\s*(.*))?$`, 'i');
// Named sections only count on their own line or followed by a separator, so "Introduction of the guests" is prose.
const NAMED = /^(prologue|epilogue|interlude|preface|foreword|introduction|afterword)\.?(?:\s*[:\-–—]\s*(.+))?$/i;
// Older novels number chapters with a bare Roman numeral: "IV", "IV.", "IV. THE STORM", "IV The Storm". Capitals only,
// and any title must be in title case, so a line of prose starting with the pronoun "I" isn't one.
const BARE_ROMAN = /^([IVXLC]{1,7})(?:\.?|\.?\s+(\S.{0,60}))$/;
const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with']);
const titleCase = (text: string) => !/[.!?,;]$/.test(text) && text.split(/\s+/).every((word) => /^[^a-z]/.test(word) || SMALL_WORDS.has(word));

type Heading = { line: number; key: string; title: string };

// Markdown heading marks and emphasis ("## **Chapter 1**") aren't part of the heading.
const plainLine = (line: string) => line.trim().replace(/^#{1,6}\s+/, '').replace(/^([*_]{1,3})(.+)\1$/, '$2').trim();

function headingAt(lines: string[], index: number): Heading | undefined {
  const line = plainLine(lines[index]);
  if (!line || line.length > 80 || /[,;]$/.test(line)) return undefined;
  const numbered = line.match(NUMBERED);
  const named = numbered ? undefined : line.match(NAMED);
  const roman = numbered || named ? undefined : line.match(BARE_ROMAN);
  if (roman?.[2] && !titleCase(roman[2])) return undefined;
  if (!numbered && !named && !roman) return undefined;
  const key = numbered ? `${numbered[1]} ${numbered[2]}`.toLowerCase().replace(/[\s-]+/g, ' ') : named ? named[1].toLowerCase() : `roman ${roman![1]}`;
  let title = line.replace(/\s+/g, ' ');
  if (roman && !roman[2]) title = `Chapter ${roman[1]}`;
  // "Chapter 3" on one line and its name on the next: "Chapter 3: The Storm".
  if (!(numbered?.[3] || named?.[2] || roman?.[2])) {
    const next = lines.slice(index + 1).map(plainLine).find(Boolean);
    if (next && next.length <= 60 && wordCount(next) <= 10 && !/[.!?,;:]$/.test(next) && !headingLike(next)) title = `${title}: ${next}`;
  }
  return { line: index, key, title };
}

/** Whether a line on its own reads as a chapter or section heading. */
export const headingLike = (line: string) => {
  const plain = plainLine(line);
  const roman = plain.match(BARE_ROMAN);
  return NUMBERED.test(plain) || NAMED.test(plain) || Boolean(roman && (!roman[2] || titleCase(roman[2])));
};

/** Splits plain text on heading lines; returns one chapter when fewer than two real chapters are found. */
export function splitChapters(text: string): BookChapter[] {
  const lines = text.split('\n');
  const found = lines.map((_, index) => headingAt(lines, index)).filter((item): item is Heading => Boolean(item));
  // A contents page is a run of three or more headings a line or two apart, each turning up again later (by number or
  // by title). Its last entry would otherwise run on into the opening text as if it were a chapter. A pair of headings
  // ("Part One" over "Chapter 1", a story's title over its "I.") isn't a contents page.
  const words = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const near = (a: Heading | undefined, b: Heading | undefined) => Boolean(a && b && Math.abs(a.line - b.line) <= 3);
  const runLength = new Array<number>(found.length).fill(1);
  for (let start = 0; start < found.length;) {
    let end = start;
    while (near(found[end], found[end + 1])) end += 1;
    for (let index = start; index <= end; index += 1) runLength[index] = end - start + 1;
    start = end + 1;
  }
  const repeatedLater = (index: number) => found.slice(index + 1).some((later) => later.key === found[index].key || words(later.title) === words(found[index].title));
  const contentsEntries = new Set(found.filter((heading, index) => runLength[index] >= 3 && repeatedLater(index)).map((heading) => heading.line));
  const candidates = found.filter((heading) => !contentsEntries.has(heading.line));
  const bodyWords = (index: number) => wordCount(lines.slice(candidates[index].line + 1, candidates[index + 1]?.line ?? lines.length).join('\n'));

  const kept: Heading[] = [];
  // A heading straight above another ("Part One" over "Chapter 1", a story's title over its "I.") starts the next
  // chapter and joins its title, rather than being a chapter of its own.
  let above: Heading | undefined;
  candidates.forEach((candidate, index) => {
    if (bodyWords(index) < MIN_CHAPTER_WORDS) {
      above = near(candidate, candidates[index + 1]) ? { ...candidate, title: above ? `${above.title} · ${candidate.title}` : candidate.title, line: above?.line ?? candidate.line } : undefined;
      return;
    }
    // A PDF's running page head repeats the chapter heading on every page; it continues the same chapter.
    if (!above && kept.at(-1)?.key === candidate.key) {
      lines[candidate.line] = '';
      return;
    }
    kept.push(above ? { line: above.line, key: candidate.key, title: `${above.title} · ${candidate.title}` } : candidate);
    above = undefined;
  });
  if (kept.length < 2) return [{ text: text.trim() }];

  // Heading lines before the first real chapter are a table of contents, which shouldn't be narrated.
  const contents = new Set(found.filter((item) => item.line < kept[0].line).map((item) => item.line));
  const front = lines.slice(0, kept[0].line).filter((_, index) => !contents.has(index)).join('\n').trim();
  const chapters = kept.map((heading, index) => ({
    title: heading.title,
    text: lines.slice(heading.line, kept[index + 1]?.line ?? lines.length).join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  }));
  if (front && wordCount(front) > MAX_LOOSE_FRONT_WORDS) chapters.unshift({ title: 'Opening', text: front });
  else if (front) chapters[0].text = `${front}\n\n${chapters[0].text}`;
  return chapters;
}

/** Cuts text into pieces of at most `limit` characters, at a paragraph, line, sentence or word break. */
export function chunkText(text: string, limit: number) {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const breakAt = [window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), Math.max(window.lastIndexOf('. '), window.lastIndexOf('." '), window.lastIndexOf('? '), window.lastIndexOf('! ')), window.lastIndexOf(' ')]
      .find((index) => index > limit * 0.5);
    const cut = breakAt === undefined ? limit : breakAt + 1;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };

// Keeps one line per block element, so heading lines survive for splitChapters.
function htmlToText(html: string) {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (entity, name: string) => {
      if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
      return ENTITIES[name.toLowerCase()] ?? entity;
    })
    .split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SKIPPED_EPUB_ITEM = /\b(cover|copyright|toc|contents|nav|titlepage|title-page)\b/i;

// The spine is the EPUB's reading order; zip entry order often isn't.
function epubDocuments(zip: AdmZip) {
  const read = (name: string) => zip.getEntry(name)?.getData().toString('utf8');
  const opfPath = read('META-INF/container.xml')?.match(/full-path="([^"]+)"/)?.[1];
  const opf = opfPath ? read(opfPath) : undefined;
  if (opfPath && opf) {
    const base = path.posix.dirname(opfPath);
    const items = new Map<string, { href: string; nav: boolean }>();
    for (const tag of opf.match(/<item\b[^>]*>/g) ?? []) {
      const id = tag.match(/\bid="([^"]+)"/)?.[1];
      const href = tag.match(/\bhref="([^"]+)"/)?.[1];
      if (id && href) items.set(id, { href: decodeURIComponent(href), nav: /properties="[^"]*\bnav\b/.test(tag) });
    }
    const documents = (opf.match(/<itemref\b[^>]*>/g) ?? []).flatMap((tag) => {
      const item = items.get(tag.match(/\bidref="([^"]+)"/)?.[1] ?? '');
      if (!item || item.nav || /linear="no"/.test(tag)) return [];
      const html = read(base === '.' ? item.href : path.posix.join(base, item.href));
      return html ? [{ name: item.href, html }] : [];
    });
    if (documents.length) return documents;
  }
  return zip.getEntries().filter((entry) => /\.(x?html?)$/i.test(entry.entryName)).map((entry) => ({ name: entry.entryName, html: entry.getData().toString('utf8') }));
}

function epubChapters(buffer: Buffer): BookChapter[] {
  const chapters = epubDocuments(new AdmZip(buffer)).flatMap(({ name, html }) => {
    const text = htmlToText(html);
    const heading = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] ?? html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const title = heading ? htmlToText(heading).replace(/\s+/g, ' ').slice(0, 120) || undefined : undefined;
    if (wordCount(text) < MIN_CHAPTER_WORDS || SKIPPED_EPUB_ITEM.test(name) || (title && SKIPPED_EPUB_ITEM.test(title))) return [];
    // One file can hold several chapters; split it when its headings say so.
    const inner = splitChapters(text);
    return inner.length > 1 ? inner : [{ title, text }];
  });
  return chapters.length > 1 ? chapters : [{ text: chapters.map((chapter) => chapter.text).join('\n\n') }];
}

export async function extractBook(fileName: string, buffer: Buffer): Promise<ExtractedBook> {
  const extension = path.extname(fileName).toLowerCase();
  let chapters: BookChapter[];
  if (extension === '.pdf') {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    // pdf-parse inserts "-- 1 of 2 --" page markers, which would otherwise be narrated.
    chapters = splitChapters(result.text.replace(/^-- \d+ of \d+ --$/gm, '').replace(/\n{3,}/g, '\n\n').trim());
  } else if (extension === '.txt' || extension === '.md') {
    let text = buffer.toString('utf8').replace(/\r\n?/g, '\n');
    // Markdown marks would otherwise be read out ("hash hash Chapter one").
    if (extension === '.md') text = text.replace(/^#{1,6}\s+/gm, '').replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/^\s*[-*]{3,}\s*$/gm, '');
    chapters = splitChapters(text.trim());
  } else if (extension === '.epub') {
    chapters = epubChapters(buffer);
  } else {
    throw new Error('Supported book formats are PDF, EPUB, TXT, and MD.');
  }
  return { text: chapters.map((chapter) => chapter.text).join('\n\n'), chapters };
}

// Project Gutenberg plain-text editions wrap the book in a licence header and footer.
const GUTENBERG_START = /^\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/im;
const GUTENBERG_END = /^\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/im;

/** Downloads a public-domain book from Project Gutenberg and splits it into chapters like an uploaded TXT file. */
export async function gutenbergBook(gutenbergId: number): Promise<ExtractedBook & { buffer: Buffer }> {
  const response = await fetch(`https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`);
  if (!response.ok) throw new Error(`Project Gutenberg returned ${response.status} for book ${gutenbergId}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  let text = buffer.toString('utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const start = text.match(GUTENBERG_START);
  if (start?.index !== undefined) text = text.slice(start.index + start[0].length);
  const end = text.match(GUTENBERG_END);
  if (end?.index !== undefined) text = text.slice(0, end.index);
  // Illustration captions and underscores for italics would be read out. Some editions put the chapter heading inside
  // the caption ("[Illustration: ... Chapter I.]"), so heading lines in a caption are kept.
  text = text
    .replace(/\[Illustration[^\]]*\]/gi, (caption) => caption.slice(1, -1).replace(/^Illustration:?/i, '').split('\n').map((line) => line.trim()).filter(headingLike).join('\n'))
    .replace(/_([^_\n]+)_/g, '$1')
    .trim();
  const chapters = splitChapters(text);
  return { buffer, text: chapters.map((chapter) => chapter.text).join('\n\n'), chapters };
}
