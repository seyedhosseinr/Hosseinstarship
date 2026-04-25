import campbellIndex from "../../../data/campbell-board-2025.json";

export type CampbellChapter = {
  chapter: number;
  volume: number;
  part: string;
  title: string;
  start_page: number;
  end_page: number;
  included: boolean;
};

export const campbellChapters = (campbellIndex as CampbellChapter[]).slice();

export const includedCampbellChapters = campbellChapters
  .filter((chapter) => chapter.included)
  .sort((a, b) => a.chapter - b.chapter);

export const campbellChapterMap = new Map(
  includedCampbellChapters.map((chapter) => [chapter.chapter, chapter]),
);

export function getCampbellChapter(chapterNo: number) {
  return campbellChapterMap.get(chapterNo) ?? null;
}
