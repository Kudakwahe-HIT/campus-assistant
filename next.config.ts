import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A stray package-lock.json in a parent directory (outside this project) makes Next.js
  // misdetect the workspace root and breaks build-trace collection. Pin it explicitly.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
