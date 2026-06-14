/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow all origins for image optimization (no external images used)
  images: { unoptimized: true },
};

module.exports = nextConfig;
