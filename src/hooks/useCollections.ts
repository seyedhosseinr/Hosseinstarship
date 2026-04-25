"use client";

import { useCallback, useEffect, useState } from "react";

export type CollectionItem = {
  id: string;
  type: "note" | "question" | "flashcard" | "article";
  title: string;
  href: string;
  chapterNo?: number;
  addedAt: string;
};

export type Collection = {
  id: string;
  name: string;
  createdAt: string;
  items: CollectionItem[];
};

const STORAGE_KEY = "starship:collections";

function loadCollections(): Collection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultCollections();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultCollections();
  } catch {
    return getDefaultCollections();
  }
}

function getDefaultCollections(): Collection[] {
  return [
    { id: "bookmarks", name: "Bookmarks", createdAt: new Date().toISOString(), items: [] },
    { id: "study-later", name: "Study Later", createdAt: new Date().toISOString(), items: [] },
  ];
}

function saveCollections(collections: Collection[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  } catch { /* quota exceeded — ignore */ }
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    setCollections(loadCollections());
  }, []);

  const persist = useCallback((next: Collection[]) => {
    setCollections(next);
    saveCollections(next);
  }, []);

  const createCollection = useCallback((name: string) => {
    const id = `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newCol: Collection = { id, name, createdAt: new Date().toISOString(), items: [] };
    persist([...collections, newCol]);
    return newCol;
  }, [collections, persist]);

  const renameCollection = useCallback((collectionId: string, name: string) => {
    persist(collections.map((c) => (c.id === collectionId ? { ...c, name } : c)));
  }, [collections, persist]);

  const deleteCollection = useCallback((collectionId: string) => {
    persist(collections.filter((c) => c.id !== collectionId));
  }, [collections, persist]);

  const addItem = useCallback((collectionId: string, item: Omit<CollectionItem, "id" | "addedAt">) => {
    persist(
      collections.map((c) => {
        if (c.id !== collectionId) return c;
        // Prevent duplicates by href
        if (c.items.some((i) => i.href === item.href)) return c;
        const newItem: CollectionItem = {
          ...item,
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          addedAt: new Date().toISOString(),
        };
        return { ...c, items: [newItem, ...c.items] };
      }),
    );
  }, [collections, persist]);

  const removeItem = useCallback((collectionId: string, itemId: string) => {
    persist(
      collections.map((c) => {
        if (c.id !== collectionId) return c;
        return { ...c, items: c.items.filter((i) => i.id !== itemId) };
      }),
    );
  }, [collections, persist]);

  const isBookmarked = useCallback((href: string) => {
    return collections.some((c) => c.items.some((i) => i.href === href));
  }, [collections]);

  const quickBookmark = useCallback((item: Omit<CollectionItem, "id" | "addedAt">) => {
    const bookmarks = collections.find((c) => c.id === "bookmarks");
    if (!bookmarks) return;
    if (bookmarks.items.some((i) => i.href === item.href)) {
      // Remove if already bookmarked
      persist(
        collections.map((c) => {
          if (c.id !== "bookmarks") return c;
          return { ...c, items: c.items.filter((i) => i.href !== item.href) };
        }),
      );
    } else {
      addItem("bookmarks", item);
    }
  }, [collections, persist, addItem]);

  return {
    collections,
    createCollection,
    renameCollection,
    deleteCollection,
    addItem,
    removeItem,
    isBookmarked,
    quickBookmark,
  };
}
