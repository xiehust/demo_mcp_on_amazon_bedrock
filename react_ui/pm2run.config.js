module.exports = {
  apps: [{
    name: "mcpui",
    script: "npm",
    args: "run start -- -H 0.0.0.0",
    interpreter: "none",
    // Add environment variables
    env: {
      NODE_ENV: "production",
      // Keep connections alive longer for streaming responses
      NODE_OPTIONS: "--http-parser=legacy --max-http-header-size=16384"
    },
    // Set up server runtime options
    max_memory_restart: "1G", // Auto-restart if memory exceeds 1GB
    kill_timeout: 5000,      // Allow time for connections to close properly
    // Configure specific Next.js options for better performance
    node_args: "--max-old-space-size=512", // Limit memory usage
    exp_backoff_restart_delay: 100, // Prevent spinning on immediate failures
    // Event handling
    wait_ready: true // Wait for application to signal ready
  }]
}
