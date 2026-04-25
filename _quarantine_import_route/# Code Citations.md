# Code Citations

## License: unknown
https://github.com/clearan/vue-clear/blob/ff0ddbb86de0c1aca3b9f4294bd5a96db4101518/manager/src/views/Upload.vue

```
# Import and File Management Component

Here's a complete, modern `ImportManager.tsx` component with tabbed interface, drag & drop, and file management:

````tsx
// filepath: uro-killer/apps/web/src/components/ImportManager.tsx
'use client';

import { useState } from 'react';
import { Upload, FileText, Trash2, File } from 'lucide-react';

type FileCategory = 'flashcards' | 'notes' | 'questions';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export default function ImportManager() {
  const [activeTab, setActiveTab] = useState<FileCategory>('flashcards');
  const [files, setFiles] = useState<Record<FileCategory, UploadedFile[]>>({
    flashcards: [],
    notes: [],
    questions: [],
  });
  const [dragActive, setDragActive] = useState<FileCategory | null>(null);

  const tabs: { id: FileCategory; label: string; labelFa: string }[] = [
    { id: 'flashcards', label: 'Flashcards', labelFa: 'فلش کارت' },
    { id: 'notes', label: 'Notes', labelFa: 'جزوه' },
    { id: 'questions', label: 'Questions', labelFa: 'سوالات' },
  ];

  const handleDrag = (e: React.DragEvent, category: FileCategory, isActive: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(isActive ? category : null);
  };

  const handleDrop = (e: React.DragEvent, category: FileCategory) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(category, droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, category: FileCategory) => {
    if (e.target.files) {
      addFiles(category, Array.from(e.target.files));
    }
  };

  const addFiles = (category: FileCategory, newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toLocaleString('fa-IR'),
    }));

    setFiles((prev) => ({
      ...prev,
      [category]: [...prev[category], ...uploadedFiles],
    }));
  };

  const deleteFile = (category: FileCategory, fileId: string) => {
    setFiles((prev) => ({
      ...prev,
      [category]: prev[category].filter((f) => f.id !== fileId),
    }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k,
```


## License: unknown
https://github.com/clearan/vue-clear/blob/ff0ddbb86de0c1aca3b9f4294bd5a96db4101518/manager/src/views/Upload.vue

```
# Import and File Management Component

Here's a complete, modern `ImportManager.tsx` component with tabbed interface, drag & drop, and file management:

````tsx
// filepath: uro-killer/apps/web/src/components/ImportManager.tsx
'use client';

import { useState } from 'react';
import { Upload, FileText, Trash2, File } from 'lucide-react';

type FileCategory = 'flashcards' | 'notes' | 'questions';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export default function ImportManager() {
  const [activeTab, setActiveTab] = useState<FileCategory>('flashcards');
  const [files, setFiles] = useState<Record<FileCategory, UploadedFile[]>>({
    flashcards: [],
    notes: [],
    questions: [],
  });
  const [dragActive, setDragActive] = useState<FileCategory | null>(null);

  const tabs: { id: FileCategory; label: string; labelFa: string }[] = [
    { id: 'flashcards', label: 'Flashcards', labelFa: 'فلش کارت' },
    { id: 'notes', label: 'Notes', labelFa: 'جزوه' },
    { id: 'questions', label: 'Questions', labelFa: 'سوالات' },
  ];

  const handleDrag = (e: React.DragEvent, category: FileCategory, isActive: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(isActive ? category : null);
  };

  const handleDrop = (e: React.DragEvent, category: FileCategory) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(category, droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, category: FileCategory) => {
    if (e.target.files) {
      addFiles(category, Array.from(e.target.files));
    }
  };

  const addFiles = (category: FileCategory, newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toLocaleString('fa-IR'),
    }));

    setFiles((prev) => ({
      ...prev,
      [category]: [...prev[category], ...uploadedFiles],
    }));
  };

  const deleteFile = (category: FileCategory, fileId: string) => {
    setFiles((prev) => ({
      ...prev,
      [category]: prev[category].filter((f) => f.id !== fileId),
    }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k,
```


## License: unknown
https://github.com/clearan/vue-clear/blob/ff0ddbb86de0c1aca3b9f4294bd5a96db4101518/manager/src/views/Upload.vue

```
# Import and File Management Component

Here's a complete, modern `ImportManager.tsx` component with tabbed interface, drag & drop, and file management:

````tsx
// filepath: uro-killer/apps/web/src/components/ImportManager.tsx
'use client';

import { useState } from 'react';
import { Upload, FileText, Trash2, File } from 'lucide-react';

type FileCategory = 'flashcards' | 'notes' | 'questions';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export default function ImportManager() {
  const [activeTab, setActiveTab] = useState<FileCategory>('flashcards');
  const [files, setFiles] = useState<Record<FileCategory, UploadedFile[]>>({
    flashcards: [],
    notes: [],
    questions: [],
  });
  const [dragActive, setDragActive] = useState<FileCategory | null>(null);

  const tabs: { id: FileCategory; label: string; labelFa: string }[] = [
    { id: 'flashcards', label: 'Flashcards', labelFa: 'فلش کارت' },
    { id: 'notes', label: 'Notes', labelFa: 'جزوه' },
    { id: 'questions', label: 'Questions', labelFa: 'سوالات' },
  ];

  const handleDrag = (e: React.DragEvent, category: FileCategory, isActive: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(isActive ? category : null);
  };

  const handleDrop = (e: React.DragEvent, category: FileCategory) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(category, droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, category: FileCategory) => {
    if (e.target.files) {
      addFiles(category, Array.from(e.target.files));
    }
  };

  const addFiles = (category: FileCategory, newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toLocaleString('fa-IR'),
    }));

    setFiles((prev) => ({
      ...prev,
      [category]: [...prev[category], ...uploadedFiles],
    }));
  };

  const deleteFile = (category: FileCategory, fileId: string) => {
    setFiles((prev) => ({
      ...prev,
      [category]: prev[category].filter((f) => f.id !== fileId),
    }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k,
```


## License: unknown
https://github.com/clearan/vue-clear/blob/ff0ddbb86de0c1aca3b9f4294bd5a96db4101518/manager/src/views/Upload.vue

```
# Import and File Management Component

Here's a complete, modern `ImportManager.tsx` component with tabbed interface, drag & drop, and file management:

````tsx
// filepath: uro-killer/apps/web/src/components/ImportManager.tsx
'use client';

import { useState } from 'react';
import { Upload, FileText, Trash2, File } from 'lucide-react';

type FileCategory = 'flashcards' | 'notes' | 'questions';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
}

export default function ImportManager() {
  const [activeTab, setActiveTab] = useState<FileCategory>('flashcards');
  const [files, setFiles] = useState<Record<FileCategory, UploadedFile[]>>({
    flashcards: [],
    notes: [],
    questions: [],
  });
  const [dragActive, setDragActive] = useState<FileCategory | null>(null);

  const tabs: { id: FileCategory; label: string; labelFa: string }[] = [
    { id: 'flashcards', label: 'Flashcards', labelFa: 'فلش کارت' },
    { id: 'notes', label: 'Notes', labelFa: 'جزوه' },
    { id: 'questions', label: 'Questions', labelFa: 'سوالات' },
  ];

  const handleDrag = (e: React.DragEvent, category: FileCategory, isActive: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(isActive ? category : null);
  };

  const handleDrop = (e: React.DragEvent, category: FileCategory) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(category, droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, category: FileCategory) => {
    if (e.target.files) {
      addFiles(category, Array.from(e.target.files));
    }
  };

  const addFiles = (category: FileCategory, newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toLocaleString('fa-IR'),
    }));

    setFiles((prev) => ({
      ...prev,
      [category]: [...prev[category], ...uploadedFiles],
    }));
  };

  const deleteFile = (category: FileCategory, fileId: string) => {
    setFiles((prev) => ({
      ...prev,
      [category]: prev[category].filter((f) => f.id !== fileId),
    }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k,
```

