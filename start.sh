#!/bin/bash
# YesPlayMusic 共享账号版启动脚本
# 用法: ./start.sh [start|stop|restart|status]
# 组件: 网易云 API(:3000) + 访问网关(:10005, IPv4+IPv6 双栈)
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
API_LOG="$DIR/logs/api.log"
GW_LOG="$DIR/logs/gateway.log"
PID_API="$DIR/logs/api.pid"
PID_GW="$DIR/logs/gateway.pid"
NODE=/root/.hermes/node/bin/node
NPX=/root/.hermes/node/bin/npx

start() {
  # 网易云 API（@neteaseapireborn/api，需 openssl-legacy-provider）
  if [ -f "$PID_API" ] && kill -0 "$(cat "$PID_API")" 2>/dev/null; then
    echo "API already running (pid $(cat "$PID_API"))"
  else
    cd "$DIR"
    # 直接 node 调入口，避免 npx 包装进程导致 pid 漂移
    NODE_OPTIONS=--openssl-legacy-provider nohup "$NODE" node_modules/@neteaseapireborn/api/app.js \
      >>"$API_LOG" 2>&1 &
    echo $! >"$PID_API"
    echo "API started (pid $(cat "$PID_API"))"
  fi

  # 访问网关
  if [ -f "$PID_GW" ] && kill -0 "$(cat "$PID_GW")" 2>/dev/null; then
    echo "Gateway already running (pid $(cat "$PID_GW"))"
  else
    cd "$DIR/gateway"
    nohup "$NODE" server.js >>"$GW_LOG" 2>&1 &
    echo $! >"$PID_GW"
    echo "Gateway started (pid $(cat "$PID_GW"))"
  fi

  sleep 2
  status
}

stop() {
  for pidf in "$PID_GW" "$PID_API"; do
    if [ -f "$pidf" ]; then
      kill "$(cat "$pidf")" 2>/dev/null
      rm -f "$pidf"
      echo "stopped $(basename "$pidf" .pid)"
    fi
  done
}

status() {
  for pair in "API:$PID_API:3000" "Gateway:$PID_GW:10005"; do
    name="${pair%%:*}"; rest="${pair#*:}"; pidf="${rest%%:*}"; port="${rest##*:}"
    if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
      echo "$name: running (pid $(cat "$pidf"), :$port)"
    else
      echo "$name: STOPPED"
    fi
  done
}

case "${1:-start}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; sleep 1; start ;;
  status)  status ;;
  *) echo "usage: $0 [start|stop|restart|status]"; exit 1 ;;
esac
