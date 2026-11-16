import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUpload } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/quicktime', 'application/pdf'];

export default function DropUpload({ folder = 'pro-portfolio', onUploaded, acceptVideo = false }) {
  const [busy, setBusy] = useState(false);
  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    if (!allowedTypes.includes(file.type) || (!acceptVideo && file.type.startsWith('video/'))) {
      toast.error('Choose an allowed image or PDF file.');
      return;
    }
    const maxSize = file.type.startsWith('video/') ? 200 : file.type === 'application/pdf' ? 10 : 25;
    if (file.size > maxSize * 1024 * 1024) {
      toast.error('The selected file is too large.');
      return;
    }
    const data = new FormData();
    data.append('file', file);
    data.append('folder', folder);
    setBusy(true);
    try {
      const uploadPath = file.type.startsWith('video/') ? '/api/media/upload/video' : '/api/media/upload';
      const { data: result } = await api.post(uploadPath, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onUploaded?.(result.media);
      toast.success('Upload complete.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed.');
    } finally {
      setBusy(false);
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
    maxSize: 200 * 1024 * 1024
  });

  return (
    <div {...getRootProps()} className={`upload-dropzone ${isDragActive ? 'is-active' : ''} ${busy ? 'is-busy' : ''}`}>
      <input {...getInputProps()} />
      <CloudUpload size={19} />
      <span>{busy ? 'Uploading…' : isDragActive ? 'Drop file to upload' : 'Drop a file here or browse'}</span>
    </div>
  );
}
