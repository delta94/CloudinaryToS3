const cloudinary = require('cloudinary');
const request = require('request');
require('dotenv').config();
const fs = require('fs');
const AWS = require('aws-sdk');
const path = require('path');
const throat = require('throat');

const {
  CLOUDINARY_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_DEFAULT_REGION,
  S3_BUCKET_NAME,
} = process.env;

cloudinary.config({
  cloud_name: CLOUDINARY_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const downloadImage = (uri, filename) =>
  new Promise((resolve, reject) => {
    request(uri)
      .pipe(fs.createWriteStream(filename, { flags: 'w' }))
      .on('close', resolve)
      .on('error', reject);
  });

const uploadImage = (uploadFilePath, fileName) =>
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
        Key: fileName + path.extname(uploadFilePath),
        Body: fs.createReadStream(uploadFilePath),
      },
      async (error, result) => {
        fs.unlinkSync(uploadFilePath);
        if (error) {
          return reject(error);
        }
        console.log(result.Location);
        return resolve(result.Location);
      }
    );
  });

const uploadImageFromCloudinaryToS3 = async (image) => {
  const uploadFilePath = `${image['asset_id']}.png`;
  await downloadImage(image.url, uploadFilePath);
  uploadImage(uploadFilePath, image['asset_id']);
};

const uploadAllImagesFromCloudinaryToS3 = async () => {
  try {
    const res = await cloudinary.v2.api.resources({
      resource_type: 'image',
    });
    await Promise.all(
      res.resources.map(throat(15, uploadImageFromCloudinaryToS3))
    );
  } catch (error) {
    console.error(error);
  }
};

uploadAllImagesFromCloudinaryToS3();
