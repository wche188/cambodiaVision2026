module.exports = {
  apps: [{
    name: 'cambodia-vision',
    script: 'server.mjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
  }]
};
