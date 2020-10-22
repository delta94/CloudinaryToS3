const cloudinary = require('cloudinary');
const request = require('request');
require('dotenv').config();
const fs = require('fs');
const AWS = require('aws-sdk');
const path = require('path');

const {
  CLOUD_NAME,
  API_KEY,
  API_SECRET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_DEFAULT_REGION,
  S3_BUCKET_NAME,
} = process.env;

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const downloadImage = (uri, filename) =>
  new Promise((resolve, reject) => {
    request(uri)
      .pipe(fs.createWriteStream(filename, { flags: 'w' }))
      .on('close', resolve)
      .on('error', reject);
  });

const uploadImage = (uploadFilePath) =>
  new Promise((resolve, reject) => {
    const s3 = new AWS.S3({
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      region: AWS_DEFAULT_REGION,
    });
    s3.upload(
      {
        ACL: 'public-read',
        Bucket: S3_BUCKET_NAME,
        Key: uuidv4() + path.extname(uploadFilePath),
        Body: fs.createReadStream(uploadFilePath),
      },
      async (error, result) => {
        fs.unlinkSync(uploadFilePath);
        if (error) {
          return reject(error);
        }
        return resolve(result.Location);
      }
    );
  });

const uploadAllImagesFromCloudinaryToS3 = async () => {
  try {
    const res = await cloudinary.v2.api.resources({
      resource_type: 'image',
    });
    await Promise.all(
      res.resources.map(async (image) => {
        const uploadFilePath = `${image['asset_id']}.png`;
        await downloadImage(image.url, uploadFilePath);
        uploadImage(uploadFilePath);
      })
    );
  } catch (error) {
    console.error(error);
  }
};

uploadAllImagesFromCloudinaryToS3();
