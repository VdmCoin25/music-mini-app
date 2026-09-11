import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";

const s3 = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpoint,
  forcePathStyle: config.s3.forcePathStyle,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
});

export async function uploadBuffer(params: {
  buffer: Buffer;
  contentType: string;
  keyPrefix: "audio" | "covers" | "waveforms";
  extension: string;
}): Promise<string> {
  const key = `${params.keyPrefix}/${randomUUID()}.${params.extension}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
    }),
  );
  return `${config.s3.publicBaseUrl}/${key}`;
}
