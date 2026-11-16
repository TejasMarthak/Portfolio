const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

function uploadToCloudinary(buffer, mimetype, folder) {
  const resourceType = mimetype.startsWith('video/') ? 'video' : mimetype === 'application/pdf' ? 'raw' : 'image';
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder,
      resource_type: resourceType,
      transformation: resourceType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : undefined
    }, (error, result) => {
      if (error) return reject(error);
      return resolve({ ...result, resourceType });
    });
    stream.end(buffer);
  });
}

async function deleteFromCloudinary(publicId, resourceType = 'image') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = { uploadToCloudinary, deleteFromCloudinary };
