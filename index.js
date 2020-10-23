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
        Key: uploadFilePath,
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

const uploadImageFromCloudinaryToS3 = async ({ url, format, public_id }) => {
  const uploadFilePath = `${public_id}.${format}`;
  await downloadImage(url, uploadFilePath);
  await uploadImage(uploadFilePath);
};

const uploadAllImagesFromCloudinaryToS3 = async () => {
  try {
    let next_cursor;
    let counter = 0;
    do {
      const res = await cloudinary.v2.api.resources({
        resource_type: 'image',
        max_results: 500,
        next_cursor,
      });
      next_cursor = res.next_cursor;
      await Promise.all(
        res.resources.map(throat(50, uploadImageFromCloudinaryToS3))
      );
      counter += res.resources.length;
      console.log(`${counter} item done`);
    } while (next_cursor);
  } catch (error) {
    console.error(error);
  }
};

uploadAllImagesFromCloudinaryToS3();
