'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, Trash2 } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
}

type TabType = 'flashcards' | 'notes' | 'questions';

export default function ImportManager() {
  const [activeTab, setActiveTab] = useState<TabType>('flashcards');
  const [files, setFiles] = useState<Record<TabType, FileItem[]>>({
    flashcards: [],
    notes: [],
    questions: [],
  });

  const fileInputRefs = useRef<Record<TabType, HTMLInputElement | null>>({
    flashcards: null,
    notes: null,
    questions: null,
  });

  const tabs: { id: TabType; label: string; labelPersian: string }[] = [
    { id: 'flashcards', label: 'Flashcards', labelPersian: 'فلش کارت' },
    { id: 'notes', label: 'Notes', labelPersian: 'جزوه' },
    { id: 'questions', label: 'Questions', labelPersian: 'سوالات' },
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, tab: TabType) => {
    const selectedFiles = e.currentTarget.files;
    if (selectedFiles) {
      addFilesToTab(Array.from(selectedFiles), tab);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('bg-blue-50', 'border-blue-400');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, tab: TabType) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400');

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      addFilesToTab(Array.from(droppedFiles), tab);
    }
  };

  const addFilesToTab = (newFiles: File[], tab: TabType) => {
    const fileItems: FileItem[] = newFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      uploadedAt: new Date(),
    }));

    setFiles((prev) => ({
      ...prev,
      [tab]: [...prev[tab], ...fileItems],
    }));
  };

  const removeFile = (tab: TabType, fileId: string) => {
    setFiles((prev) => ({
      ...prev,
      [tab]: prev[tab].filter((f) => f.id !== fileId),
    }));
  };

  const clearAllFiles = (tab: TabType) => {
    setFiles((prev) => ({
      ...prev,
      [tab]: [],
    }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Import & File Management</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="text-sm">{tab.label}</div>
            <div className="text-xs text-gray-500">{tab.labelPersian}</div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={activeTab === tab.id ? 'block' : 'hidden'}
        >
          {/* Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tab.id)}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50"
            onClick={() => fileInputRefs.current[tab.id]?.click()}
          >
            <input
              ref={(el) => {
                if (el) fileInputRefs.current[tab.id] = el;
              }}
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e, tab.id)}
              className="hidden"
            />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-700 mb-1">
              Drag & drop files here
            </p>
            <p className="text-sm text-gray-500 mb-3">or click to select files</p>
            <button className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
              Select Files
            </button>
          </div>

          {/* Files List */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Files ({files[tab.id].length})
              </h3>
              {files[tab.id].length > 0 && (
                <button
                  onClick={() => clearAllFiles(tab.id)}
                  className="text-sm px-3 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {files[tab.id].length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No files uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {files[tab.id].map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {file.name}
                        </p>
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>{formatFileSize(file.size)}</span>
                          <span>{formatDate(file.uploadedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(tab.id, file.id)}
                      className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                      title="Delete File"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}