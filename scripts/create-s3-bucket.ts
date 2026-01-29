/**
 * Script to create S3 bucket for Telegram Admin Bot
 *
 * Run: bun run scripts/create-s3-bucket.ts
 */

import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const S3_ENDPOINT = process.env['S3_ENDPOINT'] || 'https://s3.sparksglee.dental';
const S3_ACCESS_KEY = process.env['S3_ACCESS_KEY'] || '';
const S3_SECRET_KEY = process.env['S3_SECRET_KEY'] || '';
const S3_BUCKET = process.env['S3_BUCKET'] || 'telegram-admin';
const S3_REGION = process.env['S3_REGION'] || 'us-east-1';

async function createBucket(): Promise<void> {
  if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
    console.error('S3_ACCESS_KEY and S3_SECRET_KEY are required');
    process.exit(1);
  }

  const client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    forcePathStyle: true,
  });

  console.log(`Checking if bucket "${S3_BUCKET}" exists...`);

  try {
    // Check if bucket already exists
    await client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`Bucket "${S3_BUCKET}" already exists!`);
    return;
  } catch (error) {
    const err = error as { name?: string };
    if (err.name !== 'NotFound' && err.name !== 'NoSuchBucket') {
      // If it's not a "not found" error, it might be a permission issue
      console.log(`Bucket check returned: ${err.name}, attempting to create...`);
    }
  }

  try {
    console.log(`Creating bucket "${S3_BUCKET}"...`);
    await client.send(
      new CreateBucketCommand({
        Bucket: S3_BUCKET,
      })
    );
    console.log(`Bucket "${S3_BUCKET}" created successfully!`);
    console.log(`Endpoint: ${S3_ENDPOINT}/${S3_BUCKET}`);
  } catch (error) {
    const err = error as { name?: string; message?: string };
    if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') {
      console.log(`Bucket "${S3_BUCKET}" already exists!`);
    } else {
      console.error('Failed to create bucket:', err.message || error);
      process.exit(1);
    }
  }
}

createBucket();
