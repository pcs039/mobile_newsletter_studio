type EbookPageWithImagePath = {
  imagePath?: string | null;
};

export function isUsableEbookPage(page: EbookPageWithImagePath) {
  return typeof page.imagePath === "string" && page.imagePath.trim().length > 0;
}

export function getUsableEbookPages<Page extends EbookPageWithImagePath>(pages: Page[]) {
  return pages.filter(isUsableEbookPage);
}

export function hasUsableEbookPages(pages: EbookPageWithImagePath[]) {
  return pages.some(isUsableEbookPage);
}
