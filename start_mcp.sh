#!/bin/bash
export $(grep -v '^#' .env | xargs)

source .venv/bin/activate

mkdir -p ./tmp
mkdir -p ${LOG_DIR}

host=${MCP_SERVICE_HOST}
port=${MCP_SERVICE_PORT}
export USER_MCP_CONFIG_FILE=conf/user_mcp_configs.json
LOG_FILE="${LOG_DIR}/start_mcp_$(date +%Y%m%d_%H%M%S).log"

lsof -t -i:$port | xargs kill -9 2> /dev/null
python src/main.py --mcp-conf conf/config.json --user-conf conf/user_mcp_config.json \
    --host ${host} --port ${port} > ${LOG_FILE} 2>&1 &
echo "Starting MCP service..."
