#!/bin/bash

# Banana Pro AI 启动脚本
# 同时启动主应用和模拟API服务器

echo "🍌 启动 Banana Pro AI 应用..."

# 检查是否已有进程在运行
if pgrep -f "node server.js" > /dev/null; then
    echo "⚠️  检测到主应用已在运行，先停止..."
    pkill -f "node server.js"
    sleep 2
fi

if pgrep -f "node mock-api.js" > /dev/null; then
    echo "⚠️  检测到模拟API已在运行，先停止..."
    pkill -f "node mock-api.js"
    sleep 2
fi

# 启动模拟API服务器
echo "🤖 启动模拟API服务器 (端口8000)..."
OPENAI_API_URL=http://127.0.0.1:8000/v1/chat/completions node mock-api.js &
API_PID=$!

# 等待API服务器启动
sleep 3

# 启动主应用
echo "🍌 启动主应用服务器 (端口3000)..."
OPENAI_API_URL=http://127.0.0.1:8000/v1/chat/completions node server.js &
MAIN_PID=$!

echo ""
echo "=========================================="
echo "✅ Banana Pro AI 已成功启动！"
echo "=========================================="
echo "🎨 Web应用地址: http://localhost:3000"
echo "🤖 模拟API地址: http://localhost:8000"
echo "🔑 登录密码: 123456"
echo ""
echo "💡 提示:"
echo "   - 模拟API会生成彩色SVG图片作为演示"
echo "   - 社区画廊已包含示例作品"
echo "   - 按 Ctrl+C 停止所有服务"
echo "=========================================="

# 等待用户中断
trap "echo '🛑 正在停止服务...'; kill $API_PID $MAIN_PID 2>/dev/null; exit" INT
wait