import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingRoot: path.join(process.cwd(), '../..'),
  },
  webpack: (config, { isServer }) => {
    // Handle node:crypto and other Node.js built-ins for browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        path: false,
        stream: false,
        util: false,
        buffer: false,
        process: false,
        os: false,
        url: false,
        querystring: false,
        http: false,
        https: false,
        net: false,
        tls: false,
        zlib: false,
        assert: false,
        constants: false,
        timers: false,
        events: false,
        string_decoder: false,
        punycode: false,
        domain: false,
        dns: false,
        dgram: false,
        cluster: false,
        module: false,
        vm: false,
        async_hooks: false,
        inspector: false,
        perf_hooks: false,
        worker_threads: false,
        child_process: false,
        readline: false,
        repl: false,
        console: false,
        trace_events: false,
        v8: false,
      };
    }
    return config;
  },
};

export default nextConfig;
