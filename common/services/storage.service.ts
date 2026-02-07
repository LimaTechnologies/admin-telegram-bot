import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

const S3_ENDPOINT = process.env['S3_ENDPOINT'] || 'http://localhost:9000';
const S3_BUCKET = process.env['S3_BUCKET'] || 'creatives';
const S3_ACCESS_KEY = process.env['S3_ACCESS_KEY'] || 'minioadmin';
const S3_SECRET_KEY = process.env['S3_SECRET_KEY'] || 'minioadmin';
const S3_REGION = process.env['S3_REGION'] || 'us-east-1';

interface UploadResult {
  key: string;
  url: string;
}

interface PresignedUrlResult {
  url: string;
  key: string;
  expiresAt: Date;
}

class StorageServiceClass {
  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (this.client) {
      return this.client;
    }

    this.client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
      forcePathStyle: true, // Required for MinIO
    });

    return this.client;
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: string = 'uploads'
  ): Promise<UploadResult> {
    const client = this.getClient();
    const extension = fileName.split('.').pop() || '';
    const key = `${folder}/${uuidv4()}.${extension}`;

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );

      const url = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
      logger.info('File uploaded', { key, mimeType });
      return { key, url };
    } catch (error) {
      logger.error('Failed to upload file', error);
      throw error;
    }
  }

  async getPresignedUploadUrl(
    fileName: string,
    mimeType: string,
    folder: string = 'uploads',
    expiresIn: number = 3600
  ): Promise<PresignedUrlResult> {
    const client = this.getClient();
    const extension = fileName.split('.').pop() || '';
    const key = `${folder}/${uuidv4()}.${extension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        ContentType: mimeType,
      });

      const url = await getSignedUrl(client, command, { expiresIn });
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      return { url, key, expiresAt };
    } catch (error) {
      logger.error('Failed to get presigned upload URL', error);
      throw error;
    }
  }

  async getPresignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<PresignedUrlResult> {
    const client = this.getClient();

    try {
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      });

      const url = await getSignedUrl(client, command, { expiresIn });
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      return { url, key, expiresAt };
    } catch (error) {
      logger.error('Failed to get presigned download URL', error);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    const client = this.getClient();

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
        })
      );

      logger.info('File deleted', { key });
      return true;
    } catch (error) {
      logger.error('Failed to delete file', error);
      return false;
    }
  }

  async listFiles(prefix: string = ''): Promise<string[]> {
    const client = this.getClient();

    try {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: prefix,
        })
      );

      return response.Contents?.map((item) => item.Key || '').filter(Boolean) || [];
    } catch (error) {
      logger.error('Failed to list files', error);
      return [];
    }
  }

  getPublicUrl(key: string): string {
    return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  }
}

export const StorageService = new StorageServiceClass();
