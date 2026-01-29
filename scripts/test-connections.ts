/**
 * Script to test MongoDB and S3 connections
 *
 * Run: bun run scripts/test-connections.ts
 */

import mongoose from 'mongoose';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

const MONGODB_URI = process.env['MONGODB_URI'] || '';
const S3_ENDPOINT = process.env['S3_ENDPOINT'] || 'https://s3.sparksglee.dental';
const S3_ACCESS_KEY = process.env['S3_ACCESS_KEY'] || '';
const S3_SECRET_KEY = process.env['S3_SECRET_KEY'] || '';
const S3_REGION = process.env['S3_REGION'] || 'us-east-1';

async function testMongoDB(): Promise<boolean> {
  console.log('\n--- Testing MongoDB Connection ---');
  console.log(`URI: ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')}`);

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB: Connected successfully!');
    await mongoose.disconnect();
    return true;
  } catch (error) {
    const err = error as { message?: string };
    console.error('MongoDB: Connection failed -', err.message);
    return false;
  }
}

async function testS3(): Promise<boolean> {
  console.log('\n--- Testing S3 Connection ---');
  console.log(`Endpoint: ${S3_ENDPOINT}`);

  const client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
    forcePathStyle: true,
  });

  try {
    const response = await client.send(new ListBucketsCommand({}));
    console.log('S3: Connected successfully!');
    console.log('Buckets:', response.Buckets?.map((b) => b.Name).join(', '));
    return true;
  } catch (error) {
    const err = error as { message?: string };
    console.error('S3: Connection failed -', err.message);
    return false;
  }
}

async function main(): Promise<void> {
  console.log('Testing external service connections...');

  const mongoOk = await testMongoDB();
  const s3Ok = await testS3();

  console.log('\n--- Summary ---');
  console.log(`MongoDB: ${mongoOk ? 'OK' : 'FAILED'}`);
  console.log(`S3: ${s3Ok ? 'OK' : 'FAILED'}`);

  if (!mongoOk || !s3Ok) {
    process.exit(1);
  }
}

main();
