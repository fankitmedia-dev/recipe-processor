const path = require('path');
const rootDir = process.cwd();

module.exports = {
  apps: [
    {
      name: "recipe-processor-backend",
      cwd: path.join(rootDir, "recipe-processor-backend"),
      script: "server.js",
      watch: true,
      env: {
        NODE_ENV: "development",
        PORT: 3001
      },
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      exec_mode: "fork",
      autorestart: true
    },
    {
      name: "recipe-processor-frontend",
      cwd: path.join(rootDir, "recipe-processor-frontend"),
      script: "./node_modules/.bin/vite",
      watch: false,
      env: {
        NODE_ENV: "development",
        PORT: 5173
      },
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      exec_mode: "fork",
      autorestart: true
    }
  ]
} 