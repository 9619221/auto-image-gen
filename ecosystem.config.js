module.exports = {
  apps: [
    {
      name: "auto-image-gen",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "C:\\Users\\Administrator\\auto-image-gen-dev",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      max_memory_restart: "1G",
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
