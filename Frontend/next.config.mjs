/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const rawUrl =
      process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://ems-backend-api-wze1.onrender.com"
        : "http://localhost:8000");
    const backendUrl = rawUrl.replace(/\/+$/, "");

    return [
      {
        source: "/api/proxy/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
