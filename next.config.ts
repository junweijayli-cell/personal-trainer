import type { NextConfig } from 'next';

const deployTarget = process.env.DEPLOY_TARGET ?? (process.env.GITHUB_ACTIONS === 'true' ? 'github-pages' : 'local');
const isGitHubPages = deployTarget === 'github-pages';
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'personal-trainer';
const basePath = isGitHubPages ? `/${repositoryName}` : '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
