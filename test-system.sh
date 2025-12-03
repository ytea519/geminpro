#!/bin/bash

echo "🍌 测试 Banana Pro AI 系统..."

# 检查端口
echo "📡 检查端口状态..."
if ! lsof -i :3000 > /dev/null 2>&1; then
    echo "❌ 端口3000未被占用"
else
    echo "✅ 端口3000已被占用"
fi

if ! lsof -i :8000 > /dev/null 2>&1; then
    echo "❌ 端口8000未被占用"
else
    echo "✅ 端口8000已被占用"
fi

# 测试API
echo ""
echo "🔍 测试API连接..."

echo "测试主应用健康检查..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 主应用API正常"
else
    echo "❌ 主应用API无法访问"
fi

echo "测试模拟API健康检查..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ 模拟API正常"
else
    echo "❌ 模拟API无法访问"
fi

echo ""
echo "📊 当前运行的Node进程："
ps aux | grep -E "(node.*server|node.*mock)" | grep -v grep || echo "无相关进程"

echo ""
echo "🌐 测试完成！"