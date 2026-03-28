import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@giantanalyticsai/docx-js-editor', '@giantanalyticsai/docx-core'],
};

export default nextConfig;
