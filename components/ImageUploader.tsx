"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { ImageUp } from "lucide-react";

import { cn } from "@/lib/utils";

type ImageUploaderProps = {
  file: File | null;
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  className?: string;
};

export function ImageUploader({
  file,
  onFileSelect,
  disabled = false,
  className,
}: ImageUploaderProps) {
  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    multiple: false,
    disabled,
    onDropAccepted(files) {
      if (files[0]) onFileSelect(files[0]);
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex min-h-[260px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border/70 bg-muted/40 p-4 transition",
        isDragActive && "border-primary bg-primary/10",
        disabled && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <input {...getInputProps()} />
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt="Uploaded preview"
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 600px"
        />
      ) : (
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
            <ImageUp className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Drag & drop your photo</p>
          <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP up to 10MB</p>
        </div>
      )}
    </div>
  );
}

