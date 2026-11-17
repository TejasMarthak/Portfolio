const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

function uploadToCloudinaryStream({ folder, publicId, resourceType }, callback) {
  const cloudinaryResourceType = resourceType === 'document' ? 'raw' : resourceType;
  return cloudinary.uploader.upload_chunked_stream({
    folder,
    public_id: publicId,
    resource_type: cloudinaryResourceType,
    chunk_size: 20 * 1024 * 1024,
    transformation: resourceType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : undefined
  }, callback);
}

async function deleteFromCloudinary(publicId, resourceType = 'image') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
}

module.exports = { uploadToCloudinaryStream, deleteFromCloudinary };
