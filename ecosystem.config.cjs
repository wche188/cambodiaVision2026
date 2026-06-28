module.exports = {
  apps: [{
    name: 'cambodia-vision',
    cwd: '/home/ubuntu/cambodia-vision',
    script: 'scripts/start-prod.sh',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }]
};
