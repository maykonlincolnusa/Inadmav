/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Saída standalone: a imagem do Cloud Run leva só o necessario para rodar.
  output: "standalone",
  poweredByHeader: false,
};
export default nextConfig;
