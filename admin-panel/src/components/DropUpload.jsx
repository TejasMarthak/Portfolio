import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { createPortal } from 'react-dom';
import { Check, CloudUpload, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/quicktime', 'application/pdf'];
const MiB = 1024 * 1024;
const uploadLimits = {
  image: 200 * MiB,
  video: 10 * 1024 * MiB,
  document: 10 * MiB
};

export function ProfilePhotoCrop({ file, onCancel, onCrop }) {
  const imageRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dimensions, setDimensions] = useState(null);
  const [frameSize, setFrameSize] = useState(() => Math.min(320, window.innerWidth * 0.78));
  const [zoom, setZoom] = useState(1);
  const [horizontalPosition, setHorizontalPosition] = useState(50);
  const [verticalPosition, setVerticalPosition] = useState(50);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const updateSize = () => setFrameSize(Math.min(320, window.innerWidth * 0.78));
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  const cropSize = dimensions ? Math.min(dimensions.width, dimensions.height) / zoom : 0;
  const scale = cropSize ? frameSize / cropSize : 1;
  const cropX = dimensions ? (dimensions.width - cropSize) * horizontalPosition / 100 : 0;
  const cropY = dimensions ? (dimensions.height - cropSize) * verticalPosition / 100 : 0;

  function createCrop() {
    const image = imageRef.current;
    if (!image || !dimensions) return;
    const outputSize = Math.max(1, Math.min(1200, Math.round(cropSize)));
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) {
      toast.error('The photo could not be cropped in this browser.');
      return;
    }
    context.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, outputSize, outputSize);
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error('The cropped photo could not be created.');
        return;
      }
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'profile-photo';
      onCrop(new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.92);
  }

  return createPortal(
    <div className="profile-crop-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="profile-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-crop-title">
        <header className="profile-crop-header">
          <div><h2 id="profile-crop-title">Crop profile photo</h2><p>Adjust the square crop before uploading.</p></div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close crop dialog"><X size={18} /></button>
        </header>
        <div className="profile-crop-preview">
          {previewUrl && <div className="profile-crop-window" style={{ width: `${frameSize}px`, height: `${frameSize}px` }}>
            <img
              ref={imageRef}
              className="profile-crop-image"
              src={previewUrl}
              alt="Photo crop preview"
              onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              style={dimensions ? {
                width: `${dimensions.width * scale}px`,
                height: `${dimensions.height * scale}px`,
                left: `${-cropX * scale}px`,
                top: `${-cropY * scale}px`
              } : undefined}
            />
            <span className="profile-crop-guide" aria-hidden="true" />
          </div>}
        </div>
        <div className="profile-crop-controls">
          <label>Zoom <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          <label>Horizontal position <input type="range" min="0" max="100" value={horizontalPosition} onChange={(event) => setHorizontalPosition(Number(event.target.value))} /></label>
          <label>Vertical position <input type="range" min="0" max="100" value={verticalPosition} onChange={(event) => setVerticalPosition(Number(event.target.value))} /></label>
        </div>
        <footer className="profile-crop-actions">
          <button type="button" className="button button-muted" onClick={() => {
            setZoom(1);
            setHorizontalPosition(50);
            setVerticalPosition(50);
          }}><RotateCcw size={14} />Reset crop</button>
          <div><button type="button" className="button button-muted" onClick={onCancel}>Cancel</button><button type="button" className="button button-primary" onClick={createCrop} disabled={!dimensions}><Check size={15} />Crop and upload</button></div>
        </footer>
      </section>
    </div>,
    document.body
  );
}

export default function DropUpload({ folder = 'pro-portfolio', onUploaded, acceptVideo = false, cropImage = false }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cropFile, setCropFile] = useState(null);
  const uploadFile = useCallback(async (file) => {
    const type = file.type.startsWith('video/') ? 'video' : file.type === 'application/pdf' ? 'document' : 'image';
    const maxSize = uploadLimits[type];
    if (file.size > maxSize) {
      toast.error(`The ${type} exceeds the ${type === 'video' ? '10 GB' : type === 'image' ? '200 MB' : '10 MB'} upload limit.`);
      return;
    }
    const data = new FormData();
    data.append('folder', folder);
    data.append('file', file);
    setBusy(true);
    setProgress(0);
    try {
      const uploadPath = file.type.startsWith('video/') ? '/api/media/upload/video' : '/api/media/upload';
      const { data: result } = await api.post(uploadPath, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (event) => {
          if (event.total) setProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      onUploaded?.(result.media);
      toast.success('Upload complete.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed.');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [folder, onUploaded]);
  const onCrop = useCallback((file) => {
    setCropFile(null);
    void uploadFile(file);
  }, [uploadFile]);
  const onDrop = useCallback((files) => {
    const file = files[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type) || (!acceptVideo && file.type.startsWith('video/'))) {
      toast.error('Choose an allowed image or PDF file.');
      return;
    }
    const type = file.type.startsWith('video/') ? 'video' : file.type === 'application/pdf' ? 'document' : 'image';
    if (file.size > uploadLimits[type]) {
      toast.error(`The ${type} exceeds the ${type === 'video' ? '10 GB' : type === 'image' ? '200 MB' : '10 MB'} upload limit.`);
      return;
    }
    if (cropImage && type === 'image') {
      setCropFile(file);
      return;
    }
    void uploadFile(file);
  }, [acceptVideo, cropImage, uploadFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/avif': [],
      ...(acceptVideo ? { 'video/mp4': [], 'video/quicktime': [] } : {}),
      'application/pdf': []
    },
    maxSize: acceptVideo ? uploadLimits.video : uploadLimits.image,
    onDropRejected: (rejections) => {
      if (rejections.some(({ errors }) => errors.some(({ code }) => code === 'file-too-large'))) {
        toast.error(`The selected file exceeds the ${acceptVideo ? '10 GB' : '200 MB'} upload limit.`);
      }
    }
  });

  return <>
    <div {...getRootProps()} className={`upload-dropzone ${isDragActive ? 'is-active' : ''} ${busy ? 'is-busy' : ''}`}>
      <input {...getInputProps()} />
      <CloudUpload size={19} />
      <span>{busy ? `Uploading… ${progress}%` : isDragActive ? 'Drop file to upload' : cropImage ? 'Choose profile photo to crop' : 'Drop a file here or browse'}</span>
      {busy && <progress className="upload-progress" max="100" value={progress} aria-label={`Upload progress: ${progress}%`} />}
      {!busy && <small>{cropImage ? 'Square crop · JPG, PNG, WebP or AVIF · up to 200 MB' : acceptVideo ? 'Images up to 200 MB · videos up to 10 GB · PDFs up to 10 MB' : 'Images up to 200 MB · PDFs up to 10 MB'}</small>}
    </div>
    {cropFile && <ProfilePhotoCrop file={cropFile} onCancel={() => setCropFile(null)} onCrop={onCrop} />}
  </>;
}
