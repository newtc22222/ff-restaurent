import { createHash } from 'node:crypto';

type ObjectMetadata = {
  md5Hash?: string | null;
  size?: string | number | null;
};

export const md5Base64 = (buffer: Buffer) =>
  createHash('md5').update(buffer).digest('base64');

export const assertDestinationObjectMatchesSource = ({
  source,
  metadata,
  sourceBucket,
  destinationBucket,
  expectedSize,
}: {
  source: Buffer;
  metadata: ObjectMetadata;
  sourceBucket: string;
  destinationBucket: string;
  expectedSize?: number;
}) => {
  if (expectedSize !== undefined && source.length !== expectedSize) {
    throw new Error(`Source object size mismatch in ${sourceBucket}`);
  }
  if (Number(metadata.size) !== source.length) {
    throw new Error(`Destination object size mismatch in ${destinationBucket}`);
  }
  if (metadata.md5Hash !== md5Base64(source)) {
    throw new Error(
      `Destination object content mismatch in ${destinationBucket}`,
    );
  }
};
