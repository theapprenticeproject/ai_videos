// /** @type {import('next').NextConfig} */
// const nextConfig = {};

// export default nextConfig;


/** @type {import('next').NextConfig} */
// const nextConfig = {
//   webpack(config) {
//     // Ignore markdown files to avoid parse errors
//     config.module.rules.push(
//       {
//         test: /\.md$/,
//         use: 'ignore-loader',
//       },
//       {
//         test: /\.d\.ts$/,
//         use: 'ignore-loader',
//       },
//     {
//       test: /node_modules\/@ffprobe-installer\/ffprobe\/tsconfig\.json$/,
//       use: 'ignore-loader',
//     }
//     );

//     // Ignore 'fsevents' module on Windows (optional native dependency for macOS)
//     config.resolve.fallback = {
//       ...config.resolve.fallback,
//       fsevents: false,
//     };

//     return config;
//   },
// };

// export default nextConfig;

// const nextConfig = {
//   webpack: (config, { isServer }) => {
//     if (isServer) {
//       config.externals.push('@revideo/renderer');
//     }
//     return config;
//   }
// };

// export default nextConfig;


// const nextConfig = {
//   webpack: (config, { isServer }) => {
//     if (isServer) {
//       config.externals.push('@revideo/renderer');
//     }
//     return config;
//   },

//   async headers() {
//     return [
//       {
//         source: "/:path*", // Match all paths
//         headers: [
//           {
//             key: "Access-Control-Allow-Origin",
//             value: "*", // Allow any origin (OK for dev)
//           },
//           {
//             key: "Access-Control-Allow-Methods",
//             value: "GET,OPTIONS",
//           },
//           {
//             key: "Access-Control-Allow-Headers",
//             value: "Content-Type, Range",
//           },
//         ],
//       },
//     ];
//   },
// };

// export default nextConfig;



const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@revideo/renderer');
    }
    return config;
  },

  async headers() {
    return [
      {
        source: "/:path*", // Match all paths
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // Use "*" only for dev. For prod, use specific domain.
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Range",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
