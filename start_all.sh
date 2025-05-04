#!/bin/bash
export $(grep -v '^#' .env | xargs)
export PYTHONPATH=./src:$PYTHONPATH
source .venv/bin/activate

# Create necessary directories
mkdir -p ./tmp 
mkdir -p ${LOG_DIR}

LOG_FILE1="${LOG_DIR}/start_mcp_$(date +%Y%m%d_%H%M%S).log"
LOG_FILE2="${LOG_DIR}/start_chatbot_$(date +%Y%m%d_%H%M%S).log"
MAX_LOG_SIZE=10M  # 设置日志文件大小上限为10MB
# Set environment variables
# Set protocol based on USE_HTTPS environment variable
if [ "${USE_HTTPS}" = "1" ] || [ "${USE_HTTPS}" = "true" ]; then
    PROTOCOL="https"
    HTTPS_ARGS="--https"
    # Check if certificates exist, if not generate them
    if [ ! -f "certificates/localhost.key" ] || [ ! -f "certificates/localhost.crt" ]; then
        echo "Generating certificates for HTTPS..."
        ./generate_certs.sh
    fi
else
    PROTOCOL="http"
    HTTPS_ARGS=""
fi

export MCP_BASE_URL=${PROTOCOL}://${MCP_SERVICE_HOST}:${MCP_SERVICE_PORT}
echo "MCP_BASE_URL: ${MCP_BASE_URL}"

# Update React UI environment variable for backend connection
REACT_ENV_FILE="react_ui/.env.local"
if [ -f "$REACT_ENV_FILE" ]; then
    # Update existing file
    sed -i.bak "s|SERVER_MCP_BASE_URL=.*|SERVER_MCP_BASE_URL=${PROTOCOL}://${MCP_SERVICE_HOST}:${MCP_SERVICE_PORT}|" "$REACT_ENV_FILE"
    # Add or update NEXT_PUBLIC_API_BASE_URL
    if grep -q "NEXT_PUBLIC_API_BASE_URL" "$REACT_ENV_FILE"; then
        sed -i.bak "s|NEXT_PUBLIC_API_BASE_URL=.*|NEXT_PUBLIC_API_BASE_URL=${PROTOCOL}://${MCP_SERVICE_HOST}:${MCP_SERVICE_PORT}|" "$REACT_ENV_FILE"
    else
        echo "" >> "$REACT_ENV_FILE"
        echo "# Base URL for direct client-side API access (used for WebSockets)" >> "$REACT_ENV_FILE"
        echo "NEXT_PUBLIC_API_BASE_URL=${PROTOCOL}://${MCP_SERVICE_HOST}:${MCP_SERVICE_PORT}" >> "$REACT_ENV_FILE"
    fi
    rm -f "${REACT_ENV_FILE}.bak"
else
    # Create new file
    echo "# API Key for authentication" > "$REACT_ENV_FILE"
    echo "NEXT_PUBLIC_API_KEY=${API_KEY}" >> "$REACT_ENV_FILE"
    echo "" >> "$REACT_ENV_FILE"
    echo "# Base URL for MCP service - Server side (internal)" >> "$REACT_ENV_FILE"
    echo "SERVER_MCP_BASE_URL=${PROTOCOL}://${MCP_SERVICE_HOST}:${MCP_SERVICE_PORT}" >> "$REACT_ENV_FILE"
    echo "" >> "$REACT_ENV_FILE"
    echo "# Base URL for MCP service - Client side (now uses Next.js API routes)" >> "$REACT_ENV_FILE"
    echo "NEXT_PUBLIC_MCP_BASE_URL=/api" >> "$REACT_ENV_FILE"
    echo "" >> "$REACT_ENV_FILE"
    echo "# Base URL for direct client-side API access (used for WebSockets)" >> "$REACT_ENV_FILE"
    echo "NEXT_PUBLIC_API_BASE_URL=${PROTOCOL}://${MCP_SERVICE_HOST}:${MCP_SERVICE_PORT}" >> "$REACT_ENV_FILE"
fi

echo "React UI environment updated with backend URL: ${PROTOCOL}://${MCP_SERVICE_HOST}:${MCP_SERVICE_PORT}"
# Start MCP service
echo "Starting MCP service with ${PROTOCOL}..."
nohup python src/main.py --mcp-conf conf/config.json --user-conf conf/user_mcp_config.json \
    --host ${MCP_SERVICE_HOST} --port ${MCP_SERVICE_PORT} ${HTTPS_ARGS} > ${LOG_FILE1} 2>&1 &

# Start Chatbot service 
# echo "Starting Chatbot service..."
# nohup streamlit run chatbot.py \
#     --server.port ${CHATBOT_SERVICE_PORT} > ${LOG_FILE2} 2>&1 &

# echo "Services started. Check logs in ${LOG_DIR}"
