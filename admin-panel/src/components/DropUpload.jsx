import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/quicktime', 'application/pdf'];
const MiB = 1024 * 1024;
const uploadLimits = {
  image: 200 * MiB,
  video: 10 * 1024 * MiB,
  document: 10 * MiB
};

export default function DropUpload({ folder = 'pro-portfolio', onUploaded, acceptVideo = false }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type) || (!acceptVideo && file.type.startsWith('video/'))) {
      toast.error('Choose an allowed image or PDF file.');
      return;
    }
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
  }, [acceptVideo, folder, onUploaded]);
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

  return (
    <div {...getRootProps()} className={`upload-dropzone ${isDragActive ? 'is-active' : ''} ${busy ? 'is-busy' : ''}`}>
      <input {...getInputProps()} />
      <CloudUpload size={19} />
      <span>{busy ? `Uploading… ${progress}%` : isDragActive ? 'Drop file to upload' : 'Drop a file here or browse'}</span>
      {busy && <progress className="upload-progress" max="100" value={progress} aria-label={`Upload progress: ${progress}%`} />}
      {!busy && <small>{acceptVideo ? 'Images up to 200 MB · videos up to 10 GB · PDFs up to 10 MB' : 'Images up to 200 MB · PDFs up to 10 MB'}</small>}
    </div>
  );
}
