import { expect, type Page, type TestInfo } from '@playwright/test';

// DOM Range positions plus canvas ink metrics measure text lines themselves,
// not just element boxes or the invisible font ascent/descent padding.
// This catches a two-line heading with a too-small line-height even when the
// document fits the viewport perfectly and no horizontal overflow is present.
export async function inspectTextLayout(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; });
  return page.evaluate(() => {
    type Box = { top: number; right: number; bottom: number; left: number; height: number; baseline: number };
    const canvas = document.createElement('canvas').getContext('2d');
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
    };
    const textBoxes = (element: Element): Box[] => {
      const boxes: Box[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim() || !node.parentElement || !visible(node.parentElement)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const style = getComputedStyle(node.parentElement);
        if (canvas) canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const metrics = canvas?.measureText(node.textContent);
        for (const rect of range.getClientRects()) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          const metricHeight = metrics ? metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent : 0;
          const scale = metricHeight > 0 ? rect.height / metricHeight : 1;
          const top = metrics && metricHeight > 0 ? rect.top + (metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent) * scale : rect.top;
          const bottom = metrics && metricHeight > 0 ? rect.top + (metrics.fontBoundingBoxAscent + metrics.actualBoundingBoxDescent) * scale : rect.bottom;
          const baseline = metrics && metricHeight > 0 ? rect.top + metrics.fontBoundingBoxAscent * scale : rect.bottom;
          boxes.push({ top, right: rect.right, bottom, left: rect.left, height: bottom - top, baseline });
        }
      }
      return boxes;
    };
    const describe = (element: Element) => `${element.tagName.toLowerCase()}.${element.className} "${element.textContent?.trim().slice(0, 75)}"`;
    const intersect = (a: Box, b: Box) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const collisions: string[] = [];
    const overflow: string[] = [];
    const blocks = Array.from(document.querySelectorAll('h1,h2,h3,p')).filter(visible);
    for (const element of blocks) {
      const boxes = textBoxes(element).sort((a, b) => a.top - b.top || a.left - b.left);
      const lines: Box[] = [];
      for (const box of boxes) {
        // Baselines keep punctuation-only React text nodes and inline emphasis
        // on their real line even though their visible ink heights differ.
        const line = lines.find((entry) => Math.abs(entry.baseline - box.baseline) < 2.5);
        if (line) {
          line.top = Math.min(line.top, box.top); line.bottom = Math.max(line.bottom, box.bottom);
          line.left = Math.min(line.left, box.left); line.right = Math.max(line.right, box.right); line.height = line.bottom - line.top;
        } else lines.push({ ...box });
      }
      for (let index = 1; index < lines.length; index += 1) {
        if (lines[index - 1].bottom - lines[index].top > 1) collisions.push(`Overlapping text lines: ${describe(element)}`);
      }
      const next = element.nextElementSibling;
      if (next && visible(next) && /^(H1|H2|H3|P|DIV)$/.test(next.tagName)) {
        if (boxes.some((box) => textBoxes(next).some((following) => intersect(box, following)))) collisions.push(`Adjacent text collision: ${describe(element)} / ${describe(next)}`);
      }
      const container = element.getBoundingClientRect();
      if (boxes.some((box) => box.left < container.left - 2 || box.right > container.right + 2)) overflow.push(`Text exceeds its own box: ${describe(element)}`);
    }
    // Wider wordmarks, translations, names and emails can collide in horizontal
    // headers while their parent remains well inside the document viewport.
    const headers = document.querySelectorAll('.landing-nav,.auth-brand,.coach-header,.profile-card,.account-strip,.card-heading,.setup-header,.session-top,.paywall-shell > header');
    for (const header of headers) {
      if (!visible(header)) continue;
      const children = Array.from(header.children).filter(visible);
      for (let first = 0; first < children.length; first += 1) {
        for (let second = first + 1; second < children.length; second += 1) {
          if (textBoxes(children[first]).some((box) => textBoxes(children[second]).some((other) => intersect(box, other)))) collisions.push(`Header text collision: ${describe(children[first])} / ${describe(children[second])}`);
        }
      }
    }
    return {
      collisions: [...new Set(collisions)], overflow: [...new Set(overflow)],
      contentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewportWidth: document.documentElement.clientWidth,
    };
  });
}

export async function auditAndCapture(page: Page, testInfo: TestInfo, label: string) {
  await expect(page.getByRole('heading').filter({ hasText: /[.。]/ })).toHaveCount(0);
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const findings = await inspectTextLayout(page);
  const imagePath = testInfo.outputPath(`${label}.png`);
  await page.screenshot({ path: imagePath, fullPage: true, animations: 'disabled' });
  await testInfo.attach(label, { path: imagePath, contentType: 'image/png' });
  expect.soft(findings.contentWidth, `${label}: page must not scroll horizontally`).toBeLessThanOrEqual(findings.viewportWidth + 1);
  expect.soft(findings.collisions, `${label}: text must not overlap`).toEqual([]);
  expect.soft(findings.overflow, `${label}: text must fit its own layout box`).toEqual([]);
}
