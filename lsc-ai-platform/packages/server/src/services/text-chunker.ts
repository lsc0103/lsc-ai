/**
 * 文本分块工具
 * 将长文本按照指定策略分割为适合向量化的文本块
 */

export interface TextChunk {
  /** 块内容 */
  content: string;
  /** 块序号（从 0 开始） */
  index: number;
  /** 元信息 */
  metadata: {
    /** 在原文中的起始字符位置 */
    startPos: number;
    /** 在原文中的结束字符位置 */
    endPos: number;
    /** 块字符长度 */
    charCount: number;
  };
}

/**
 * 按段落 → 句子 → 字符三级策略分块
 *
 * @param text      完整文本
 * @param chunkSize 目标块大小（字符数）
 * @param chunkOverlap 块之间的重叠字符数
 */
export function chunkText(
  text: string,
  chunkSize: number = 512,
  chunkOverlap: number = 64,
): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 1. 按段落分割（\n\n）
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  // 2. 将段落拆分为不超过 chunkSize 的片段
  const segments: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= chunkSize) {
      segments.push(para);
    } else {
      // 段落超长，按句子分割
      const sentences = splitIntoSentences(para);
      for (const sentence of sentences) {
        if (sentence.length <= chunkSize) {
          segments.push(sentence);
        } else {
          // 句子也超长，按字符硬切
          for (let i = 0; i < sentence.length; i += chunkSize - chunkOverlap) {
            segments.push(sentence.slice(i, i + chunkSize));
          }
        }
      }
    }
  }

  // 3. 贪心合并：尽量让每个 chunk 接近 chunkSize
  const chunks: TextChunk[] = [];
  let currentContent = '';
  let currentStartPos = 0;
  let globalPos = 0; // 追踪在原始 segments 拼接后的位置

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const separator = currentContent.length > 0 ? '\n\n' : '';
    const candidate = currentContent + separator + segment;

    if (candidate.length <= chunkSize || currentContent.length === 0) {
      // 可以合并，或者当前块为空（必须放入至少一个 segment）
      if (currentContent.length === 0) {
        currentStartPos = globalPos;
      }
      currentContent = candidate;
    } else {
      // 当前块已满，保存并开始新块
      chunks.push(makeChunk(currentContent, chunks.length, currentStartPos));

      // 用 overlap：从当前内容末尾取 chunkOverlap 个字符作为下一块开头
      if (chunkOverlap > 0 && currentContent.length > chunkOverlap) {
        const overlap = currentContent.slice(-chunkOverlap);
        currentContent = overlap + '\n\n' + segment;
        currentStartPos = globalPos - chunkOverlap;
      } else {
        currentContent = segment;
        currentStartPos = globalPos;
      }
    }

    globalPos += segment.length + 2; // +2 for '\n\n' separator
  }

  // 保存最后一个块
  if (currentContent.trim().length > 0) {
    chunks.push(makeChunk(currentContent, chunks.length, currentStartPos));
  }

  return chunks;
}

/**
 * 将文本按句子边界分割
 * 支持中文句号、英文句号、问号、感叹号、分号等
 */
function splitIntoSentences(text: string): string[] {
  // 匹配中英文句子结束符
  const sentenceEnds = /([。！？；…：.!?;:])\s*/g;
  const sentences: string[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = sentenceEnds.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const sentence = text.slice(lastIndex, end).trim();
    if (sentence.length > 0) {
      sentences.push(sentence);
    }
    lastIndex = end;
  }

  // 剩余部分
  const remaining = text.slice(lastIndex).trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }

  return sentences.length > 0 ? sentences : [text];
}

function makeChunk(content: string, index: number, startPos: number): TextChunk {
  return {
    content,
    index,
    metadata: {
      startPos: Math.max(0, startPos),
      endPos: Math.max(0, startPos) + content.length,
      charCount: content.length,
    },
  };
}
