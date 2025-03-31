'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, File, FileImage, FileText } from 'lucide-react';

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // base64 encoded data
}

interface FileUploadProps {
  files: FileItem[];
  onAddFiles: (files: FileItem[]) => void;
  onRemoveFile: (fileId: string) => void;
  maxFiles?: number;
}

export function FileUpload({ 
  files, 
  onAddFiles, 
  onRemoveFile,
  maxFiles = 10 
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    await processFiles(droppedFiles);
  };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      await processFiles(selectedFiles);
      
      // Reset the input value so the same file can be selected again
      e.target.value = '';
    }
  };
  
  const processFiles = async (filesToProcess: File[]) => {
    if (files.length + filesToProcess.length > maxFiles) {
      alert(`You can only upload a maximum of ${maxFiles} files.`);
      return;
    }
    
    const fileItems: FileItem[] = await Promise.all(
      filesToProcess.map(async (file) => {
        // Read file as base64
        const base64Data = await readFileAsBase64(file);
        
        return {
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data
        };
      })
    );
    
    onAddFiles(fileItems);
  };
  
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove data:mime;base64, prefix
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };
  
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileImage className="h-4 w-4" />;
    } else if (fileType.startsWith('text/')) {
      return <FileText className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };
  
  const getFilePreview = (file: FileItem) => {
    if (file.type.startsWith('image/')) {
      return (
        <div className="relative w-16 h-16 border rounded overflow-hidden mr-2">
          <img 
            src={`data:${file.type};base64,${file.data}`} 
            alt={file.name}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    return null;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  return (
    <div className="w-full">
      {files.length < maxFiles && (
        <div
          className={`
            border-2 border-dashed rounded-lg p-3 mb-3 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700'}
          `}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click();
            }
          }}
        >
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
            <Upload className="h-4 w-4" />
            <span className="text-sm">Drop files here or click to upload</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}
      
      {files.length > 0 && (
        <div className="space-y-2 mb-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Attached Files ({files.length}/{maxFiles})
          </div>
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                {getFilePreview(file)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {getFileIcon(file.type)}
                    <span className="text-sm font-medium truncate">{file.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(file.id);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
