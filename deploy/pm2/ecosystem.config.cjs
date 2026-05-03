// PM2 process manifest for Rathinam Crackers API.
//
// Usage on the EC2 box:
//   pm2 startOrReload /var/www/ratinam/deploy/pm2/ecosystem.config.cjs --env production
//   pm2 save
//   pm2 startup            # then run the command pm2 prints, once
//
// Cluster mode = 2 instances. On a t3.small (2 vCPU) this gives one Node
// worker per core. Bump `instances` to "max" on a larger box.

module.exports = {
  apps: [
    {
      name: "ratinam-api",
      script: "artifacts/api-server/dist/index.mjs",
      cwd: "/var/www/ratinam",
      node_args: "--enable-source-maps",
      instances: 2,
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "500M",
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
        PORT: "8080",
      },
      error_file: "/var/log/ratinam/api.err.log",
      out_file: "/var/log/ratinam/api.out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
